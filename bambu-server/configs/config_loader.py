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

if os.path.exists(_json_path):
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
else:
    try:
        from configs.bambu_config import IP, SERIAL, ACCESS_CODE
        from configs.bambu_config import AUTH_USER as _AU, AUTH_PASS as _AP, INACTIVITY_TIMEOUT as _IT
        PRINTERS = [{"ip": IP, "serial": SERIAL, "access_code": ACCESS_CODE}]
        AUTH_USER = _AU
        AUTH_PASS = _AP
        INACTIVITY_TIMEOUT = _IT
        print("Loaded Python config (bambu_config.py)")
    except ImportError:
        raise RuntimeError(
            "No printer config found. Create configs/bambu_config.json "
            "(see bambu_config.example.json) or configs/bambu_config.py "
            "(see bambu_config.example.py)."
        )

if not PRINTERS:
    raise RuntimeError("Config loaded but no printers defined.")


def _normalize_printer(printer: dict) -> dict:
    """Apply defaults for the per-printer backend flags.

    enable_custom_libraries selects the mqtt.py backend (bambu-mqtt-comms +
    bambu-mqtt-generator) over the bambulabs_api one in bambu.py. It was
    previously called new_dev_mode; the old name is still honoured so existing
    configs don't silently fall back to the other backend.

    enable_signing controls whether that backend registers a certificate and
    signs its commands. It defaults to false: signing needs key/chain/CRL PEM
    files that most setups don't have, and firmware predating January 2025
    accepts unsigned commands anyway. Turn it on for a printer whose firmware
    rejects unsigned commands, which also requires the three cert file paths at
    the top level of the config. Ignored when enable_custom_libraries is false.

    overwrite_auto_filament controls whether setFilament may write over a slot
    whose filament the printer identified from an RFID tag. It defaults to
    false, which is what an unattended writer wants: the AMS reads the tag
    within seconds of a spool going in and fills the slot in correctly, so a
    write that lands afterwards only replaces good data with a guess. Set it
    true for a printer whose slots should always take whatever is sent. Ignored
    when enable_custom_libraries is false.
    """
    if "enable_custom_libraries" not in printer and "new_dev_mode" in printer:
        print(f"  Note: printer '{printer.get('name', printer.get('ip'))}' uses "
              "'new_dev_mode', which is now 'enable_custom_libraries'")
        printer["enable_custom_libraries"] = printer["new_dev_mode"]

    printer.setdefault("enable_custom_libraries", False)
    printer.setdefault("enable_signing", False)
    printer.setdefault("overwrite_auto_filament", False)
    return printer


PRINTERS = [_normalize_printer(p) for p in PRINTERS]
