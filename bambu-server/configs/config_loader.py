import json
import os

_config_dir = os.path.dirname(os.path.abspath(__file__))
_json_path = os.path.join(_config_dir, "bambu_config.json")

PRINTERS = []
AUTH_USER = ""
AUTH_PASS = ""
INACTIVITY_TIMEOUT = 5 * 60

if os.path.exists(_json_path):
    with open(_json_path) as _f:
        _cfg = json.load(_f)
    PRINTERS = _cfg.get("printers", [])
    AUTH_USER = _cfg.get("auth_user", "")
    AUTH_PASS = _cfg.get("auth_pass", "")
    INACTIVITY_TIMEOUT = _cfg.get("inactivity_timeout", 5 * 60)
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
