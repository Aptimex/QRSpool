import difflib
import json
import os

_config_dir = os.path.dirname(os.path.abspath(__file__))
_json_path = os.path.join(_config_dir, "bambu_config.json")

PRINTERS = []
AUTH_USER = ""
AUTH_PASS = ""
INACTIVITY_TIMEOUT = 5 * 60
KEY_PEM_FILE: str = None
CERT_CHAIN_PEM_FILE: str = None
CRL_PEM_FILE: str = None

if not os.path.exists(_json_path):
    raise RuntimeError(
        "No printer config found. Create configs/bambu_config.json by copying "
        "configs/bambu_config.example.json."
    )

with open(_json_path) as _f:
    _cfg = json.load(_f)
PRINTERS = _cfg.get("printers", [])
AUTH_USER = _cfg.get("auth_user", "")
AUTH_PASS = _cfg.get("auth_pass", "")
INACTIVITY_TIMEOUT = _cfg.get("inactivity_timeout", 5 * 60)
KEY_PEM_FILE = _cfg.get("key_pem_file")
CERT_CHAIN_PEM_FILE = _cfg.get("cert_chain_pem_file")
CRL_PEM_FILE = _cfg.get("crl_pem_file")
print(f"Loaded JSON config: {len(PRINTERS)} printer(s)")

if not PRINTERS:
    raise RuntimeError("Config loaded but no printers defined.")


BACKENDS = ("custom", "bambulabs_api")
DEFAULT_BACKEND = "custom"

# Every key the server reads. Anything else in the config is rejected at
# startup rather than ignored: a silently-dropped key looks like the setting
# took effect, and the resulting behaviour is then very hard to explain. A
# typo in "overwrite_auto_filament" is indistinguishable from the feature not
# working, which is the kind of bug report nobody can act on.
TOP_LEVEL_KEYS = frozenset({
    "printers",
    "auth_user",
    "auth_pass",
    "inactivity_timeout",
    "key_pem_file",
    "cert_chain_pem_file",
    "crl_pem_file",
})

PRINTER_KEYS = frozenset({
    "name",
    "ip",
    "serial",
    "access_code",
    "backend",
    "model_id",
    "firmware_version",
    "overwrite_auto_filament",
})

# Keys that must be present for a printer to be usable at all. Without this
# check the failure is a KeyError raised later, from whichever backend happened
# to touch it first, with no indication of which printer was at fault.
REQUIRED_PRINTER_KEYS = ("ip", "serial", "access_code")


def _is_comment(key: str) -> bool:
    """Whether a key is an annotation rather than a setting.

    JSON has no comment syntax, so people annotate configs with an extra key.
    Allowing a conventional few means strict checking doesn't punish that.
    """
    return key.startswith("_") or key.lower() in ("comment", "comments",
                                                  "note", "notes")


def _unknown_key_problems(where: str, mapping: dict, allowed) -> list:
    """Describe every unrecognized key in one section, with a suggestion."""
    problems = []
    for key in mapping:
        if key in allowed or _is_comment(key):
            continue
        close = difflib.get_close_matches(key, sorted(allowed), n=1, cutoff=0.7)
        hint = f" Did you mean '{close[0]}'?" if close else ""
        problems.append(f"{where}: unknown setting '{key}'.{hint}")
    return problems


def _normalize_printer(printer: dict) -> dict:
    """Validate and apply defaults for the per-printer settings.

    backend picks which library talks to this printer: "custom" (the default)
    for bambu-mqtt-comms + bambu-mqtt-generator, or "bambulabs_api" for the
    original third-party library. It is a name rather than a boolean so that a
    typo is rejected loudly instead of being read as false.

    There is deliberately no signing setting. Whether a printer rejects
    unsigned commands is detected at connect time, in one round trip, and a
    certificate is registered only for the printers that need one. Supplying
    the three *_pem_file paths at the top level of the config is all that is
    ever needed, and the majority of setups need nothing at all.

    overwrite_auto_filament controls whether setFilament may write over a slot
    whose filament the printer identified from an RFID tag. It defaults to
    false, which is what an unattended writer wants: the AMS reads the tag
    within seconds of a spool going in and fills the slot in correctly, so a
    write that lands afterwards only replaces good data with a guess. Set it
    true for a printer whose slots should always take whatever is sent. Only
    applies to the "custom" backend.
    """
    name = printer.get("name", printer.get("ip", "?"))
    where = f"printer '{name}'"
    problems = _unknown_key_problems(where, printer, PRINTER_KEYS)

    for required in REQUIRED_PRINTER_KEYS:
        if not printer.get(required):
            problems.append(f"{where}: missing required setting '{required}'.")

    printer.setdefault("backend", DEFAULT_BACKEND)
    if printer["backend"] not in BACKENDS:
        problems.append(
            f"{where}: backend '{printer['backend']}' is not recognized; "
            f"expected one of {list(BACKENDS)}."
        )

    printer.setdefault("overwrite_auto_filament", False)
    return printer, problems


def uses_custom_backend(printer: dict) -> bool:
    """Whether this printer is handled by the custom libraries."""
    return printer.get("backend", DEFAULT_BACKEND) == "custom"


_problems = _unknown_key_problems("config", _cfg, TOP_LEVEL_KEYS)

_checked = []
for _printer in PRINTERS:
    _normalized, _printer_problems = _normalize_printer(_printer)
    _checked.append(_normalized)
    _problems += _printer_problems
PRINTERS = _checked

if _problems:
    raise RuntimeError(
        "Problems in configs/bambu_config.json:\n  - "
        + "\n  - ".join(_problems)
        + "\n\nSee configs/README.md for every supported setting. Keys "
          "beginning with '_', and 'comment'/'note', are ignored and can be "
          "used for annotations."
    )
