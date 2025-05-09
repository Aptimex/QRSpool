#!/usr/bin/env python3

import time
import bambulabs_api as bl
import json

#local files
from configs.bambu_config import IP, SERIAL, ACCESS_CODE

def getKnownFilaments(path = "./configs/bambu-ams-codes.json"):
    with open(path, "r") as f:
        codes = json.loads(f.read())
    #print(f"Loaded {len(codes)} filament codes")
    return codes
CODES = getKnownFilaments() #not actualy used, but try loading them at start so errors are apparent
PRINTER = bl.Printer(IP, ACCESS_CODE, SERIAL)
EXTERNAL_SPOOL_AMSID = 255
EXTERNAL_SPOOL_SLOTID = 254

def connect():
    # Connect to the BambuLab 3D printer
    PRINTER.connect()

def ensureConnected():
    if not PRINTER.mqtt_client_connected():
        connect()
        time.sleep(3)
        if not PRINTER.mqtt_client_connected():
            return makeError("Unable to connect to printer")
    return None

def disconnect():
    PRINTER.disconnect()

def makeError(msg: str):
    return {
        "error": msg
    }

def getPrinterStatus():
    error = ensureConnected()
    if error:
        return error
    
    return {
        "status": PRINTER.get_state()
    }

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
        "tray_color": "000000",
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
    
    # https://github.com/BambuTools/bambulabs_api/blob/e775d9a1a0eb2f8478d64e6e61dae3c45a4507da/bambulabs_api/mqtt_client.py#L1229
    # Printers don't seem to return info for slots that have no filament loaded
    # Possibly the slicers just know to expect slots #0-3 for each AMS and display them as missing if no data is returned
    # So try to emulate that behavior
    amsh = PRINTER.ams_hub()
    slots = [emptyTray(0), emptyTray(1), emptyTray(2), emptyTray(3)]

    for amsID, ams in amsh.ams_hub.items():
        for slotID, tray in ams.filament_trays.items():
            slot = trayToSlot(amsID, slotID, tray)
            #slots.append(slot)
            slots[slotID] = slot
    
    externalTray = PRINTER.vt_tray()
    slot = trayToSlot(EXTERNAL_SPOOL_AMSID, EXTERNAL_SPOOL_SLOTID, externalTray)
    slots.append(slot)

    resp = {
        "slots": slots,
        "displayKeys": ["Type", "Color", "Brand", "Min Temp", "Max Temp", "k", "Bed Temp"],
        "colorHexKeys": ["Color"],
    }
    
    return resp

def setFilament(amsID, trayID, colorHex, brand, fType, minTemp = 0, maxTemp = 0):
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
    
    code = filamentToCode(brand, fType)
    if not code:
        return False, "Unable to match brand and type with known Bambu codes"
    
    newFilament = bl.AMSFilamentSettings(code, minTemp, maxTemp, fType)
    try:
        h = PRINTER.ams_hub()
        x = h[amsID][trayID]
    except Exception as e:
        return False, f"Printer does not seem to have an AMS #{amsID} with Tray #{trayID}: {e}"
    
    result = PRINTER.set_filament_printer(colorHex, newFilament, amsID, trayID)
    if result:
        return True, ""
    else:
        return False, "Printer rejected request for unknown reasons"

# Combine manufacturer and type, normalize spaces, convert to lowercase, and compare
# If an exact match isn't found, change the manufacturer to "generic" and look again
# If that's not found, check if the type is a known code and use that directly
# Otherwise return None
def filamentToCode(fManufacturer: str, fType: str):
    # Check if the filament code is set directly in the tag
    if fManufacturer == "RAWCODE":
        return fType

    lookup = ("" + fManufacturer.strip() + " " + fType.strip()).lower()
    lookupGeneric = ("Generic " + fType.strip()).lower()
    lookupByCode = fType.strip().lower()
    backupCode = ""
    
    try:
        fCodes = getKnownFilaments()
    except Exception as e:
        print(f"Unable to load known filament codes: {e}")
        return None
    
    knownTypes = list(fCodes.keys())
    
    for t in knownTypes:
        if lookup == t.lower():
            # Return exact match
            return fCodes[t]
        if lookupGeneric == t.lower():
            # This match will be returned later if an exact match isn't found
            backupCode = fCodes[t]
    
    if backupCode != "":
        return backupCode
    
    # No match, check if the filament type is a known code
    knownCodes = list(fCodes.values())
    for c in knownCodes:
        if lookupByCode == c.lower():
            return c
    
    return None
