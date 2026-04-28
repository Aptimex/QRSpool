#!/usr/bin/env python3

import json
import ssl
import time
import threading
import paho.mqtt.client as mqtt

from bambu import (
    getKnownFilaments,
    getTypeAbbreviations,
    getModifierAbbreviations,
    filamentToCode,
    EXTERNAL_SPOOL_AMSID,
    EXTERNAL_SPOOL_SLOTID,
)

getKnownFilaments()
getTypeAbbreviations()
getModifierAbbreviations()

MQTT_PORT = 8883
MQTT_USER = "bblp"

_PUSHALL_CMD = {
    "pushing": {
        "sequence_id": "1",
        "command": "pushall",
        "version": 1,
        "push_target": 1,
    }
}


def makeError(msg: str):
    return {"error": msg}


def _make_tls_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


class _PrinterState:
    def __init__(self, cfg: dict):
        self.ip = cfg["ip"]
        self.serial = cfg["serial"]
        self.access_code = cfg["access_code"]
        self.topic_req = f"device/{self.serial}/request"
        self.topic_report = f"device/{self.serial}/report"
        self.client: mqtt.Client = None
        self.connected = False
        self.print_data: dict = None
        self.data_lock = threading.Lock()
        self.data_ready = threading.Event()


_states: dict = {}   # serial -> _PrinterState
_current: _PrinterState = None
CURRENT_PRINTER_NAME: str = None


def setCurrentPrinter(cfg: dict, name: str):
    global _current, CURRENT_PRINTER_NAME
    serial = cfg["serial"]
    if serial not in _states:
        _states[serial] = _PrinterState(cfg)
    _current = _states[serial]
    CURRENT_PRINTER_NAME = name


# ── MQTT callbacks ─────────────────────────────────────────────────────────────

def _on_connect(client, userdata, connect_flags, reason_code, properties=None):
    state: _PrinterState = userdata
    if not reason_code.is_failure:
        state.connected = True
        client.subscribe(state.topic_report)
        client.publish(state.topic_req, json.dumps(_PUSHALL_CMD))
    else:
        print(f"[mqtt] Connection failed: {reason_code}")


def _on_disconnect(client, userdata, disconnect_flags, reason_code, properties=None):
    state: _PrinterState = userdata
    state.connected = False
    if reason_code.is_failure:
        print(f"[mqtt] Unexpected disconnect: {reason_code}")


def _on_message(client, userdata, msg):
    state: _PrinterState = userdata
    try:
        data = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        return

    if "print" in data and data["print"].get("command") == "push_status":
        with state.data_lock:
            state.print_data = data["print"]
        state.data_ready.set()


# ── Connection management ──────────────────────────────────────────────────────

def connect():
    if _current is None:
        return
    if _current.connected:
        return

    if _current.client is not None:
        try:
            _current.client.loop_stop()
            _current.client.disconnect()
        except Exception:
            pass

    _current.connected = False
    _current.data_ready.clear()

    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, userdata=_current)
    c.username_pw_set(MQTT_USER, _current.access_code)
    c.tls_set_context(_make_tls_context())
    c.on_connect = _on_connect
    c.on_message = _on_message
    c.on_disconnect = _on_disconnect

    c.connect(_current.ip, MQTT_PORT, keepalive=60)
    c.loop_start()
    _current.client = c


def disconnect():
    if _current is None:
        return
    if _current.client is not None:
        try:
            _current.client.loop_stop()
            _current.client.disconnect()
        except Exception:
            pass
    _current.connected = False


def ensureConnected():
    if _current is None:
        return makeError("No printer configured")
    if not _current.connected:
        connect()
        time.sleep(3)
        if not _current.connected:
            return makeError("Unable to connect to printer")
    return None


# ── Slot helpers ───────────────────────────────────────────────────────────────

def _is_empty_tray(tray: dict) -> bool:
    return not tray.get("tray_type")


def _empty_tray_dict() -> dict:
    return {
        "tray_info_idx": "",
        "tray_type": "EMPTY",
        "tray_color": "xxxxxxxx",
        "tray_sub_brands": "",
        "nozzle_temp_min": "0",
        "nozzle_temp_max": "0",
        "bed_temp": "0",
        "k": 0.0,
    }


def _tray_to_slot(amsID: int, slotID: int, tray: dict) -> dict:
    slot = dict(tray)
    slot["ids"] = {"amsID": amsID, "slotID": slotID}

    brand = "Generic"
    current_code = tray.get("tray_info_idx", "")
    for name, code in getKnownFilaments().items():
        if code == current_code:
            brand = name.split()[0]
            break

    t = tray.get("tray_type", "EMPTY")
    sub = tray.get("tray_sub_brands", "")
    if sub:
        t += f" ({sub})"

    slot["Type"]     = t
    slot["Color"]    = tray.get("tray_color", "xxxxxx")[:6]
    slot["Brand"]    = brand
    slot["Min Temp"] = int(tray.get("nozzle_temp_min", 0) or 0)
    slot["Max Temp"] = int(tray.get("nozzle_temp_max", 0) or 0)
    slot["Bed Temp"] = int(tray.get("bed_temp", 0) or 0)
    slot["k"]        = tray.get("k", 0.0)

    if amsID == EXTERNAL_SPOOL_AMSID:
        slot["displayID"] = "External Spool (no AMS)"
    else:
        slot["displayID"] = f"AMS #{amsID} | Slot #{slotID + 1}"

    return slot


# ── Public API (mirrors bambu.py) ──────────────────────────────────────────────

def getPrinterStatus():
    error = ensureConnected()
    if error:
        return error

    with _current.data_lock:
        pd = _current.print_data

    state = pd.get("gcode_state", "UNKNOWN") if pd else "UNKNOWN"
    return {"status": state}


def getPrinterState():
    error = ensureConnected()
    if error:
        return error

    with _current.data_lock:
        pd = _current.print_data

    state = pd.get("gcode_state", "UNKNOWN") if pd else "UNKNOWN"
    return {"state": state}


def getSlots():
    error = ensureConnected()
    if error:
        return error

    _current.data_ready.wait(timeout=10)

    with _current.data_lock:
        pd = dict(_current.print_data) if _current.print_data else None

    if pd is None:
        return makeError("No printer data received yet")

    ams_list = pd.get("ams", {}).get("ams", [])
    slots = []

    for ams in ams_list:
        amsID = int(ams["id"])
        row = [_tray_to_slot(amsID, i, _empty_tray_dict()) for i in range(4)]

        for tray in ams.get("tray", []):
            slotID = int(tray["id"])
            if 0 <= slotID < 4 and not _is_empty_tray(tray):
                row[slotID] = _tray_to_slot(amsID, slotID, tray)

        slots += row

    if "vir_slot" in pd:
        vir = pd["vir_slot"]
        ext = vir[0] if vir else _empty_tray_dict()
        slots.append(_tray_to_slot(EXTERNAL_SPOOL_AMSID, 255, ext))
    elif "vt_tray" in pd:
        ext = pd["vt_tray"]
        if _is_empty_tray(ext):
            ext = _empty_tray_dict()
        slots.append(_tray_to_slot(EXTERNAL_SPOOL_AMSID, EXTERNAL_SPOOL_SLOTID, ext))

    return {
        "slots": slots,
        "displayKeys": ["Type", "Color", "Brand", "Min Temp", "Max Temp", "k", "Bed Temp"],
        "colorHexKeys": ["Color"],
    }


def setFilament(amsID, trayID, colorHex, brand, fType, minTemp=0, maxTemp=0, colorName=""):
    ensureConnected()

    minTemp = 0 if minTemp == "" else minTemp
    maxTemp = 0 if maxTemp == "" else maxTemp

    try:
        amsID = int(amsID)
    except Exception as e:
        return False, f"Invalid AMS ID '{amsID}': {e}"

    try:
        trayID = int(trayID)
    except Exception as e:
        return False, f"Invalid Tray ID '{trayID}': {e}"

    try:
        minTemp = int(minTemp)
    except Exception as e:
        return False, f"Invalid min temperature '{minTemp}': {e}"

    try:
        maxTemp = int(maxTemp)
    except Exception as e:
        return False, f"Invalid max temperature '{maxTemp}': {e}"

    code, codeError = filamentToCode(brand, fType, colorName)
    if codeError:
        return False, codeError
    if not code:
        return False, "Unable to match brand and type with known Bambu codes"

    with _current.data_lock:
        pd = _current.print_data

    if pd is None:
        return False, "No printer data available"

    if amsID == EXTERNAL_SPOOL_AMSID:
        if "vir_slot" not in pd and "vt_tray" not in pd:
            return False, "Printer does not have an external spool slot"
    else:
        ams_list = pd.get("ams", {}).get("ams", [])
        ams_by_id = {int(a["id"]): a for a in ams_list}
        if amsID not in ams_by_id:
            return False, f"Printer does not recognize AMS #{amsID}"

        tray_by_id = {int(t["id"]): t for t in ams_by_id[amsID].get("tray", [])}
        if trayID not in tray_by_id or _is_empty_tray(tray_by_id[trayID]):
            return False, f"No filament is loaded in AMS #{amsID} Slot #{trayID + 1}"

    color_with_alpha = f"{colorHex.upper()}FF"

    payload = {
        "print": {
            "sequence_id": "1",
            "command": "ams_filament_setting",
            "ams_id": amsID,
            "tray_id": trayID,
            "tray_info_idx": code,
            "tray_color": color_with_alpha,
            "nozzle_temp_min": minTemp,
            "nozzle_temp_max": maxTemp,
            "tray_type": fType,
        }
    }

    _current.client.publish(_current.topic_req, json.dumps(payload))
    return True, ""
