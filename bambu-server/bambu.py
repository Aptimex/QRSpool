#!/usr/bin/env python3

import time
import bambulabs_api as bl
import json

#local files
from configs.config_loader import PRINTERS

def getKnownFilaments(path = "./configs/bambu-ams-codes.json"):
    with open(path, "r") as f:
        codes = json.loads(f.read())
    return codes

def getTypeAbbreviations(path = "./configs/type-abbreviations.json"):
    with open(path, "r") as f:
        return json.loads(f.read())

def getModifierAbbreviations(path = "./configs/modifier-abbreviations.json"):
    with open(path, "r") as f:
        return json.loads(f.read())

#try loading files at start so server will immediately crash if they are missing/invalid
getKnownFilaments()
getTypeAbbreviations()
getModifierAbbreviations()

def _printer_name(idx, cfg):
    return cfg.get("name") or cfg.get("ip", f"Printer {idx+1}")

PRINTERS_MAP = {}
for _i, _cfg in enumerate(PRINTERS):
    if _cfg.get("new_dev_mode"):
        continue
    _name = _printer_name(_i, _cfg)
    if _name not in PRINTERS_MAP:  # first entry wins on duplicate names
        PRINTERS_MAP[_name] = bl.Printer(_cfg["ip"], _cfg["access_code"], _cfg["serial"])

EXTERNAL_SPOOL_AMSID = 255
EXTERNAL_SPOOL_SLOTID = 254

CURRENT_PRINTER = next(iter(PRINTERS_MAP.values())) if PRINTERS_MAP else None
CURRENT_PRINTER_NAME = next(iter(PRINTERS_MAP.keys())) if PRINTERS_MAP else None

def setCurrentPrinter(cfg, name):
    global CURRENT_PRINTER, CURRENT_PRINTER_NAME
    CURRENT_PRINTER = PRINTERS_MAP[name]
    CURRENT_PRINTER_NAME = name

def connect():
    CURRENT_PRINTER.connect()
    CURRENT_PRINTER.camera_stop()

def disconnect():
    CURRENT_PRINTER.disconnect()

def ensureConnected():
    if not CURRENT_PRINTER.mqtt_client_connected():
        connect()
        time.sleep(3)
        if not CURRENT_PRINTER.mqtt_client_connected():
            return makeError("Unable to connect to printer")
    return None

def makeError(msg: str):
    return {
        "error": msg
    }

def getPrinterStatus():
    error = ensureConnected()
    if error:
        return error

    return {
        "status": CURRENT_PRINTER.get_state()
    }

def getPrinterState():
    error = ensureConnected()
    if error:
        return error

    state = CURRENT_PRINTER.get_current_state()
    return {"state": state.name}

def trayToSlot(amsID, slotID, tray):
    # Start by just copying all the tray/slot data returned by the printer
    slot = tray.__dict__.copy()
    
    # Asign unique identifiers
    slot["ids"] = {
        "amsID": amsID,
        "slotID": slotID,
    }
    
    # Try to lookup brand based on code; fallback to "generic"
    brand = "Generic"
    currentCode = tray.tray_info_idx
    for name, code in getKnownFilaments().items():
        if code == currentCode:
            brand = name.split()[0]
            break

    # Map important internal values to more user-friendly (display) values
    t = tray.tray_type
    if (tray.tray_sub_brands and tray.tray_sub_brands != ""):
        t += f" ({tray.tray_sub_brands})"
    slot["Type"] = t
    slot["Color"] = tray.tray_color[:6]
    slot["Brand"] = brand
    slot["Min Temp"] = tray.nozzle_temp_min
    slot["Max Temp"] = tray.nozzle_temp_max
    slot["Bed Temp"] = tray.bed_temp
    if (amsID == EXTERNAL_SPOOL_AMSID and slotID == EXTERNAL_SPOOL_SLOTID):
        slot["displayID"] = f"External Spool (no AMS)"
    else:
        slot["displayID"] = f"AMS #{amsID} | Slot #{int(slotID)+1}"
    
    return slot

def emptyTray(trayIDX):
    d = {
        "tray_info_idx": trayIDX,
        "tray_type": "EMPTY",
        "tray_color": "xxxxxx",
        "tray_sub_brands": "",
        "nozzle_temp_min": 0,
        "nozzle_temp_max": 0,
        "bed_temp": 0,
        "k": 0.0,
        "n": 0,
        "tag_uid": "",
        "tray_id_name": "",
        "tray_weight": "",
        "tray_diameter": "",
        "tray_temp": "",
        "tray_time": "",
        "bed_temp_type": "",
        "bed_temp": "",
        "xcam_info": "",
        "tray_uuid": "",
    }
    newTray = bl.FilamentTray.from_dict(d)
    return newTray

def getSlots():
    error = ensureConnected()
    if error:
        return error
    
    amsh = CURRENT_PRINTER.ams_hub()
    slots = []

    if amsh is not None and amsh.ams_hub is not None:
        for amsID, ams in amsh.ams_hub.items():
            # https://github.com/BambuTools/bambulabs_api/blob/e775d9a1a0eb2f8478d64e6e61dae3c45a4507da/bambulabs_api/mqtt_client.py#L1229
            # Printers don't seem to return info for slots that have no filament loaded
            # Possibly the slicers just know to expect slots #0-3 for each AMS and display them as missing if no data is returned
            # So try to emulate that behavior
            newSlots = [
                trayToSlot(amsID, 0, emptyTray(0)),
                trayToSlot(amsID, 1, emptyTray(1)),
                trayToSlot(amsID, 2, emptyTray(2)),
                trayToSlot(amsID, 3, emptyTray(3))
            ]

            for slotID, tray in (ams.filament_trays or {}).items():
                slot = trayToSlot(amsID, slotID, tray)
                newSlots[slotID] = slot
            slots += newSlots

    try:
        externalTray = CURRENT_PRINTER.vt_tray()
    except AttributeError:
        externalTray = None
    if externalTray is not None:
        slot = trayToSlot(EXTERNAL_SPOOL_AMSID, EXTERNAL_SPOOL_SLOTID, externalTray)
        slots.append(slot)

    resp = {
        "slots": slots,
        "displayKeys": ["Type", "Color", "Brand", "Min Temp", "Max Temp", "k", "Bed Temp"],
        "colorHexKeys": ["Color"],
    }
    
    return resp

def setFilament(amsID, trayID, colorHex, brand, fType, minTemp = 0, maxTemp = 0, colorName = ""):
    ensureConnected()

    minTemp = 0 if (minTemp == "") else minTemp
    maxTemp = 0 if (maxTemp == "") else maxTemp

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
        return False, f"Invalid max temperature: {maxTemp}: {e}"

    code, codeError = filamentToCode(brand, fType, colorName)
    if codeError:
        return False, codeError
    if not code:
        return False, "Unable to match brand and type with known Bambu codes"

    newFilament = bl.AMSFilamentSettings(code, minTemp, maxTemp, fType)
    hub = CURRENT_PRINTER.ams_hub()
    try:
        _ = hub[amsID]
    except KeyError as e:
        return False, f"Printer does not recognize AMS #{amsID}"

    try:
        _ = hub[amsID][trayID]
    except KeyError as e:
        return False, f"No filament is loaded in that slot, or printer does not advertise AMS #{amsID} with Slot #{trayID+1})"

    result = CURRENT_PRINTER.set_filament_printer(colorHex, newFilament, amsID, trayID)
    if result:
        return True, ""
    else:
        return False, "Printer rejected setFilament request for unknown reasons"

# Returns (code, error). On success error is None; on ambiguous prefix match code is None, 
# and the error describes the candidates; on no match both are None. 
# Other errors are returned as (None, error).
#
# Lookup order:
#   1. If type is blank: try progressively shorter prefixes of colorName as the type (Option 1)
#   2. Exact brand+type → exact generic+type → direct Bambu code → prefix brand+type → prefix generic+type
#   3. If a match is found: try to upgrade to a more specific entry using colorName words (Option 3)
# 
# Most of this logic is just to proactively handle several workarounds people will likely use for the 
# type and modifier byte limits in the OpenTag3D standard.
def filamentToCode(fManufacturer: str, fType: str, colorName: str = ""):
    if fManufacturer == "RAWCODE":
        return fType, None

    # Some filament names have a - between the type and modifier, normalize to a space for easier matching logic
    def normalize(s):
        return s.replace("-", " ").lower()

    try:
        fCodes = getKnownFilaments()
    except Exception as e:
        msg = f"Unable to load known filament codes: {e}"
        print(msg)
        return None, msg

    knownTypes = list(fCodes.keys())

    def tryExact(manufacturer, typeStr):
        """Exact brand+type, then generic fallback, then direct code. Returns (code, None) or (None, None)."""
        lookup = normalize(manufacturer.strip() + " " + typeStr.strip())
        lookupGeneric = normalize("Generic " + typeStr.strip())
        backupCode = ""
        for t in knownTypes:
            if lookup == normalize(t):
                return fCodes[t], None
            if lookupGeneric == normalize(t):
                backupCode = fCodes[t]
        if backupCode:
            return backupCode, None
        for c in fCodes.values():
            if typeStr.strip().lower() == c.lower():
                return c, None
        return None, None

    def tryPrefix(manufacturer, typeStr):
        """Prefix matching with ambiguity detection. Returns (code, error)."""
        lookup = normalize(manufacturer.strip() + " " + typeStr.strip())
        lookupGeneric = normalize("Generic " + typeStr.strip())

        def prefixMatches(prefix):
            return [t for t in knownTypes if normalize(t).startswith(prefix)]

        def ambiguousError(matches):
            names = ", ".join(f'"{m}"' for m in matches[:4])
            if len(matches) > 4:
                names += f" and {len(matches) - 4} more"
            return f'Ambiguous filament type "{typeStr.strip()}" matches multiple entries: {names}. Use RAWCODE for an exact match.'

        for prefix in [lookup, lookupGeneric]:
            ms = prefixMatches(prefix)
            if len(ms) == 1:
                return fCodes[ms[0]], None
            if len(ms) > 1:
                return None, ambiguousError(ms)
        return None, None

    def tryLookup(manufacturer, typeStr):
        """Try exact then prefix. Returns (code, error)."""
        code, _ = tryExact(manufacturer, typeStr)
        if code:
            return code, None
        return tryPrefix(manufacturer, typeStr)

    def tryExpanded(manufacturer, typeStr):
        """Expand abbreviated base type and/or modifier, then retry lookup.
        Returns (code, error) or (None, None) if nothing expanded or still no match."""
        try:
            typeAbbrevs = getTypeAbbreviations()
            modAbbrevs = getModifierAbbreviations()
        except Exception as e:
            msg = f"Unable to load abbreviation files: {e}"
            print(msg)
            return None, msg

        def reverseMap(abbrevDict):
            return {abbrev.lower(): full
                    for full, abbrevs in abbrevDict.items()
                    for abbrev in abbrevs}

        typeRevMap = reverseMap(typeAbbrevs)
        modRevMap  = reverseMap(modAbbrevs)

        parts = typeStr.strip().split(" ", 1)
        base     = parts[0]
        modifier = parts[1] if len(parts) > 1 else ""

        expandedBase = typeRevMap.get(base.lower(), base)
        expandedMod  = modRevMap.get(modifier.lower(), modifier) if modifier else ""

        expandedType = (expandedBase + " " + expandedMod).strip()
        if expandedType.lower() == typeStr.strip().lower():
            return None, None  # nothing changed, no point retrying

        return tryLookup(manufacturer, expandedType)

    # Option 1: type is blank — try progressively shorter prefixes of colorName as the full type
    if not fType.strip() and colorName.strip():
        words = colorName.strip().split()
        for length in range(len(words), 0, -1):
            candidate = " ".join(words[:length])
            code, err = tryLookup(fManufacturer, candidate)
            if code:
                return code, None
            if err:
                return None, err
            code, err = tryExpanded(fManufacturer, candidate)
            if code:
                return code, None
            if err:
                return None, err
        return None, None

    # Normal lookup
    code, err = tryLookup(fManufacturer, fType)
    if err:
        return None, err
    if not code:
        code, err = tryExpanded(fManufacturer, fType)
        if err:
            return None, err
        if not code:
            return None, None

    # Option 3: try to upgrade to a more specific match using colorName words
    if colorName.strip():
        words = colorName.strip().split()
        for length in range(len(words), 0, -1):
            extendedType = fType.strip() + " " + " ".join(words[:length])
            upgradeCode, _ = tryExact(fManufacturer, extendedType)
            if upgradeCode:
                return upgradeCode, None

    return code, None
