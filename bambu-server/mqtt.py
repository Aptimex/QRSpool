#!/usr/bin/env python3
"""
Printer communication backend built on the bambu-mqtt-comms and
bambu-mqtt-generator libraries.

This module owns no protocol knowledge of its own. Connections, the certificate
bootstrap and request/response correlation come from bambu-mqtt-comms; payload
construction, signing and push_status interpretation come from
bambu-mqtt-generator. What is left here is the translation between QRSpool's
API (brand/type names, {"error": ...} dicts, (ok, message) tuples) and those
libraries.

The public functions mirror bambu.py so app.py can use either backend
interchangeably.
"""

import threading
from typing import Optional

from bambu_mqtt_comms import BambuMQTTClient, PrinterConfig
from bambu_mqtt_comms import BambuMQTTError
from bambu_mqtt_generator import (
    ExternalSpool,
    MQTTSigner,
    check_command_result,
    extract_leaf_cert,
    get_payload_builder,
    load_config,
    load_pem,
    parse_response,
)

from configs.config_loader import KEY_PEM_FILE, CERT_CHAIN_PEM_FILE, CRL_PEM_FILE
from bambu import (
    getKnownFilaments,
    getTypeAbbreviations,
    getModifierAbbreviations,
    filamentToCode,
)

# Ids the printer uses for external spools rather than an AMS bay.
EXTERNAL_SPOOL_AMS_IDS = (ExternalSpool.MAIN, ExternalSpool.DEPUTY)

# Fail fast at import if the lookup tables are missing or malformed.
getKnownFilaments()
getTypeAbbreviations()
getModifierAbbreviations()

# Slot values the client renders, and which of them are colors. Unchanged from
# the bambu.py backend so both produce the same shape.
DISPLAY_KEYS = ["Type", "Color", "Brand", "Min Temp", "Max Temp", "k", "Bed Temp"]
COLOR_HEX_KEYS = ["Color"]

CONNECT_TIMEOUT = 20.0
STATUS_TIMEOUT = 20.0
# How stale the pushed status may be before a fresh pushall is worth asking for.
# Printers push on their own every 1-2s, so anything within a few seconds is
# current. Asking every time is what to avoid: a pushall makes the printer send
# a full report, and enough of them in a row makes it stop sending them at all,
# after which every read fails until the connection is rebuilt.
STATUS_MAX_AGE = 5.0
COMMAND_TIMEOUT = 15.0

_CONFIG = load_config()


def makeError(msg: str):
    return {"error": msg}


# ── Signing credentials ────────────────────────────────────────────────────────

def _build_signer() -> Optional[MQTTSigner]:
    """Build the shared signer from the configured PEM paths.

    Signing is optional — firmware older than January 2025 accepts unsigned
    commands — but it is all-or-nothing: the chain and CRL are what the
    app_cert_install bootstrap registers, and without that registration the
    printer rejects signed commands. The leaf certificate is the first block of
    the chain, so it isn't configured separately.
    """
    configured = [
        ("key_pem_file", KEY_PEM_FILE),
        ("cert_chain_pem_file", CERT_CHAIN_PEM_FILE),
        ("crl_pem_file", CRL_PEM_FILE),
    ]
    if not any(path for _, path in configured):
        return None

    missing = [name for name, path in configured if not path]
    if missing:
        raise RuntimeError(
            f"Signing requires all three cert file fields; missing: {missing}"
        )

    chain_pem = load_pem(CERT_CHAIN_PEM_FILE)
    return MQTTSigner(
        cert_pem=extract_leaf_cert(chain_pem),
        key_pem=load_pem(KEY_PEM_FILE),
        cert_chain_pem=chain_pem,
        crl_pem=load_pem(CRL_PEM_FILE),
    )


_SIGNER = _build_signer()


# ── Printer sessions ───────────────────────────────────────────────────────────

class _PrinterSession:
    """One printer: its connection, payload builder, and cached status."""

    def __init__(self, cfg: dict, name: str):
        self.name = name
        self.printer = PrinterConfig(
            ip=cfg["ip"],
            serial=cfg["serial"],
            access_code=cfg["access_code"],
            response_timeout=COMMAND_TIMEOUT,
        )
        self.model_id = cfg.get("model_id")
        self.firmware_version = cfg.get("firmware_version")

        # Signing is per-printer and off unless asked for: it needs credentials
        # most setups don't have. A printer whose firmware rejects unsigned
        # commands opts in, without forcing the others in the same config to.
        self.signing_enabled = bool(cfg.get("enable_signing", False))
        if self.signing_enabled and _SIGNER is None:
            print(f"[mqtt] {name}: enable_signing is set but no signing "
                  "credentials are configured; commands will be sent unsigned")
            self.signing_enabled = False

        self.client: Optional[BambuMQTTClient] = None
        self.builder = None
        self._cert_trusted = False
        self._status: Optional[dict] = None
        self._lock = threading.Lock()

    # -- connection ------------------------------------------------------------

    @property
    def connected(self) -> bool:
        return self.client is not None and self.client.is_connected

    def connect(self) -> None:
        """Connect, register the signing certificate, and prepare the builder."""
        if self.connected:
            return

        self.disconnect()

        client = BambuMQTTClient(self.printer)
        client.connect(timeout=CONNECT_TIMEOUT)
        self.client = client

        try:
            self._finish_connect()
        except Exception:
            # Anything below needs the connection, so a failure there leaves a
            # session that looks connected but has no builder. Tear it down so
            # the next call retries from scratch instead of failing oddly.
            self.disconnect()
            raise

    def _finish_connect(self) -> None:
        """Register the certificate and prepare the payload builder."""

        # The printer forgets registered certificates on power cycle, so this
        # runs per connection. install_app_cert polls until the cert actually
        # shows up in app_cert_list; signed commands sent before then are
        # rejected with 84033545. Skipped entirely when signing is off, so a
        # printer without credentials never pays for the bootstrap poll.
        self._cert_trusted = False
        if self.signing_enabled:
            result = self.client.install_app_cert(
                _SIGNER.build_app_cert_install(), cert_id=_SIGNER.get_cert_id()
            )
            self._cert_trusted = result["trusted"]
            if not self._cert_trusted:
                print(f"[mqtt] {self.name}: printer did not trust cert "
                      f"{_SIGNER.get_cert_id()} after {result['attempts_used']} "
                      f"polls; commands will be sent unsigned")

        self._resolve_model()
        self.builder = get_payload_builder(self.model_id, self.firmware_version)

    def disconnect(self) -> None:
        if self.client is not None:
            try:
                self.client.disconnect()
            except Exception:
                pass
        self.client = None
        self._cert_trusted = False

    def ensure_connected(self) -> Optional[dict]:
        """Connect if needed. Returns an error dict on failure, else None."""
        if self.connected:
            return None
        try:
            self.connect()
        except BambuMQTTError as e:
            return makeError(f"Unable to connect to printer: {e}")
        except Exception as e:
            return makeError(f"Unable to connect to printer: {type(e).__name__}: {e}")
        return None

    def _resolve_model(self) -> None:
        """Fill in model id / firmware version if the config didn't supply them.

        Configuring them is preferred, but existing configs predate those
        fields, so fall back to asking the printer. Different models answer
        get_version differently: some report the model id in `project_name`,
        others the marketing name in `product_name`. Both forms resolve, since
        the generator accepts either.
        """
        if self.model_id and self.firmware_version:
            return

        response = self.client.send_and_wait(
            {"info": {"sequence_id": self.client.random_sequence_id(),
                      "command": "get_version"}},
            timeout=COMMAND_TIMEOUT,
        )
        modules = response.get("info", {}).get("module", [])
        ota = next((m for m in modules if m.get("name") == "ota"), {})

        if not self.firmware_version:
            self.firmware_version = ota.get("sw_ver")

        if not self.model_id:
            for candidate in (ota.get("project_name"), ota.get("product_name")):
                if candidate and _CONFIG.resolve_model_id(candidate.strip()):
                    self.model_id = candidate.strip()
                    break

        if not self.model_id or not self.firmware_version:
            raise RuntimeError(
                f"Could not determine model_id/firmware_version for '{self.name}' "
                f"({self.model_id!r}/{self.firmware_version!r}). Set them in "
                "bambu_config.json."
            )

        print(f"[mqtt] {self.name}: detected model {self.model_id} "
              f"firmware {self.firmware_version}")

    # -- status ----------------------------------------------------------------

    def refresh_status(self) -> Optional[dict]:
        """Request a full status push and cache it."""
        with self._lock:
            self._status = self.client.request_status(timeout=STATUS_TIMEOUT)
            return self._status

    def current_status(self, max_age: float = STATUS_MAX_AGE) -> Optional[dict]:
        """Status from the printer's own push stream, or a pushall if stale."""
        pushed = self.client.get_status(max_age=max_age)
        if pushed is not None:
            with self._lock:
                self._status = pushed
            return pushed
        return self.refresh_status()

    @property
    def status(self) -> Optional[dict]:
        with self._lock:
            return self._status

    def parse_slots(self, status: dict) -> list:
        parsed = parse_response(
            {"print": status}, self.model_id, self.firmware_version, _CONFIG
        )
        if not parsed.get("success"):
            raise RuntimeError("could not interpret the printer's status response")
        return parsed["slots"]


_sessions: dict = {}          # serial -> _PrinterSession
_current: Optional[_PrinterSession] = None
CURRENT_PRINTER_NAME: Optional[str] = None


def setCurrentPrinter(cfg: dict, name: str):
    global _current, CURRENT_PRINTER_NAME
    serial = cfg["serial"]
    if serial not in _sessions:
        _sessions[serial] = _PrinterSession(cfg, name)
    _current = _sessions[serial]
    CURRENT_PRINTER_NAME = name


# ── Public API (mirrors bambu.py) ──────────────────────────────────────────────

def connect():
    if _current is None:
        return
    _current.ensure_connected()


def disconnect():
    if _current is None:
        return
    _current.disconnect()


def ensureConnected():
    if _current is None:
        return makeError("No printer configured")
    return _current.ensure_connected()


def _gcode_state() -> dict:
    """Shared body of getPrinterStatus/getPrinterState."""
    error = ensureConnected()
    if error:
        return error

    try:
        status = _current.current_status()
    except BambuMQTTError:
        status = None

    return {"state": (status or {}).get("gcode_state", "UNKNOWN")}


def getPrinterStatus():
    result = _gcode_state()
    if "error" in result:
        return result
    return {"status": result["state"]}


def getPrinterState():
    return _gcode_state()


def getSlots():
    error = ensureConnected()
    if error:
        return error

    try:
        status = _current.current_status()
    except BambuMQTTError as e:
        return makeError(f"No printer data received: {e}")

    if not status:
        return makeError("No printer data received yet")

    try:
        slots = _current.parse_slots(status)
    except Exception as e:
        return makeError(str(e))

    return {
        "slots": slots,
        "displayKeys": DISPLAY_KEYS,
        "colorHexKeys": COLOR_HEX_KEYS,
    }


def _validate_int(value, label, blank_is_zero=False):
    """Coerce a client-supplied value to int, returning (value, error).

    Temperatures arrive blank when the client has nothing to send and mean
    "use the filament's default". An id must never be defaulted that way —
    blank would silently become AMS 0.
    """
    if blank_is_zero and value in ("", None):
        return 0, None
    try:
        return int(value), None
    except (TypeError, ValueError) as e:
        return None, f"Invalid {label} '{value}': {e}"


def _slot_exists(status: dict, amsID: int, trayID: int):
    """Confirm the target slot exists and is loaded. Returns an error or None."""
    if amsID in EXTERNAL_SPOOL_AMS_IDS:
        if "vir_slot" not in status and "vt_tray" not in status:
            return "Printer does not have an external spool slot"
        return None

    ams_by_id = {
        int(a["id"]): a for a in (status.get("ams") or {}).get("ams", [])
        if str(a.get("id", "")).isdigit()
    }
    if amsID not in ams_by_id:
        return f"Printer does not recognize AMS #{amsID}"

    trays = {
        int(t["id"]): t for t in ams_by_id[amsID].get("tray", [])
        if str(t.get("id", "")).isdigit()
    }
    tray = trays.get(trayID)
    if tray is None or not tray.get("tray_type"):
        return f"No filament is loaded in AMS #{amsID} Slot #{trayID + 1}"
    return None


def setFilament(amsID, trayID, colorHex, brand, fType, minTemp=0, maxTemp=0, colorName=""):
    error = ensureConnected()
    if error:
        return False, error["error"]

    parsed = {}
    for name, value, label, blank_ok in (
        ("amsID", amsID, "AMS ID", False),
        ("trayID", trayID, "Tray ID", False),
        ("minTemp", minTemp, "min temperature", True),
        ("maxTemp", maxTemp, "max temperature", True),
    ):
        parsed[name], err = _validate_int(value, label, blank_is_zero=blank_ok)
        if err:
            return False, err
    amsID, trayID = parsed["amsID"], parsed["trayID"]
    minTemp, maxTemp = parsed["minTemp"], parsed["maxTemp"]

    code, codeError = filamentToCode(brand, fType, colorName)
    if codeError:
        return False, codeError
    if not code:
        return False, "Unable to match brand and type with known Bambu codes"

    try:
        status = _current.current_status()
    except BambuMQTTError as e:
        return False, f"No printer data available: {e}"
    if not status:
        return False, "No printer data available"

    slot_error = _slot_exists(status, amsID, trayID)
    if slot_error:
        return False, slot_error

    try:
        payload = _build_filament_payload(
            code, colorHex, amsID, trayID, fType, minTemp, maxTemp
        )
    except ValueError as e:
        return False, str(e)

    message = _SIGNER.sign(payload) if _can_sign() else payload

    try:
        response = _current.client.send_and_wait(message, timeout=COMMAND_TIMEOUT)
    except BambuMQTTError:
        return False, (f"No response from printer within {COMMAND_TIMEOUT:.0f}s; the change may or may not have been applied")

    result = check_command_result(response)
    if not result["accepted"]:
        detail = result["description"] or f"err_code={result['err_code']}"
        return False, f"Printer rejected command: {detail}"

    # Accepted, not yet applied. Printers take 5-10s to reflect a filament change, which is handled by the frontend polling /slots
    return True, ""


def _can_sign() -> bool:
    """Sign only when enabled for this printer and it trusts our certificate."""
    return (_current is not None
            and _current.signing_enabled
            and _current._cert_trusted)


def _build_filament_payload(code, colorHex, amsID, trayID, fType, minTemp, maxTemp):
    """Build ams_filament_setting, filling gaps from the filament preset.

    build_filament_setting() derives temperatures and type from the configured
    preset and works out the id triple, but it only accepts filament ids it has
    a preset for. QRSpool's code list is broader than the extracted presets
    (discontinued filaments such as GFA03 have no profile in current Bambu
    Studio), so those fall back to build_payload with every field supplied.
    """
    builder = _current.builder
    color = colorHex if colorHex.startswith("#") else f"#{colorHex}"

    if builder.get_filament_defaults(code):
        overrides = {}
        # 0 means "unset" from the client; let the preset supply the value.
        if minTemp:
            overrides["nozzle_temp_min"] = minTemp
        if maxTemp:
            overrides["nozzle_temp_max"] = maxTemp
        if fType:
            overrides["tray_type"] = fType
        return builder.build_filament_setting(
            tray_info_idx=code, tray_color=color, ams_id=amsID, tray_id=trayID,
            **overrides,
        )

    # Unknown filament id: supply everything explicitly.
    is_external = amsID in EXTERNAL_SPOOL_AMS_IDS
    return builder.build_payload(
        "ams_filament_settings",
        sequence_id=None,
        ams_id=amsID,
        tray_id=254 if is_external else trayID,
        slot_id=0 if is_external else trayID,
        tray_info_idx=code,
        setting_id="",
        tray_color=f"{colorHex.lstrip('#').upper()}FF",
        nozzle_temp_min=minTemp,
        nozzle_temp_max=maxTemp,
        tray_type=fType,
    )
