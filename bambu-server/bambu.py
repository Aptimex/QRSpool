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
CODES = getKnownFilaments()
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
        

def getSlots():
    error = ensureConnected()
    if error:
        return error
    
    amsh = PRINTER.ams_hub()
    slots = []
    for amsID, ams in amsh.ams_hub.items():
        for slotID, tray in ams.filament_trays.items():
            slot = trayToSlot(amsID, slotID, tray)
            slots.append(slot)
    
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
    
    amsID = int(amsID)
    trayID = int(trayID)
    minTemp = int(minTemp)
    maxTemp = int(maxTemp)
    
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

def checkFilamentPatch():
    test = bl.AMSFilamentSettings("GFG02", 220, 270, "PETG") #PETG-HF
    try:
        f = bl.Filament(test)
    except ValueError as e:
        print("bambulabs-api library not patched, not all filament types will be supported")
        print("See the README for more info")

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
    
    knownTypes = list(CODES.keys())
    
    for t in knownTypes:
        if lookup == t.lower():
            # Return exact match
            return CODES[t]
        if lookupGeneric == t.lower():
            # This match will be returned later if an exact match isn't found
            backupCode = CODES[t]
    
    if backupCode != "":
        return backupCode
    
    # No match, check if the filament type is a known code
    knownCodes = list(CODES.values())
    for c in knownCodes:
        if lookupByCode == c.lower():
            return c
    
    return None
