#!/usr/bin/env python3

import time
import bambulabs_api as bl
import json
import jsonpickle
import os
#import importlib
from copy import deepcopy

#local files
from bambu_config import IP, SERIAL, ACCESS_CODE

def getKnownFilaments(path = "./bambu-ams-codes.json"):
    with open(path, "r") as f:
        codes = json.loads(f.read())
    print(f"Loaded {len(codes)} filament codes")
    return codes
CODES = getKnownFilaments()
PRINTER = bl.Printer(IP, ACCESS_CODE, SERIAL)

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

'''
# ======== Begin Monkey Patch ========
# This actually doesn't seem to patch internal class usage... 
LibraryFilament = bl.Filament
class AnyFilament(bl.AMSFilamentSettings):
    """Changes the behavior of the Filament library class to allow unknown/new filaments (tray_info_idx codes) to be set. 
    Does not validate manually-set the filament codes against a known list, but printer should just safely/silently ignore it if it's not real"""

    def __init__(self, filament: str | bl.AMSFilamentSettings):
        # Support lookup by standard filament names known to the library
        if type(filament) is str:
            name = filament 
            print(name)
            
            # This will throw an exception if the type is unknown, just like the library
            knownF = LibraryFilament(name)
            
            super(AnyFilament, self).__init__(
                knownF.tray_info_idx,
                knownF.nozzle_temp_min,
                knownF.nozzle_temp_max,
                knownF.tray_type,
                )
        
        # Support creating your own arbitrary AMSFilamentSettings so newer codes can be used
        else:
            super(AnyFilament, self).__init__(
                filament.tray_info_idx,
                filament.nozzle_temp_min,
                filament.nozzle_temp_max,
                filament.tray_type,
                )
bl.Filament = AnyFilament
#importlib.reload(bl)
# ======== End Monkey Patch ========
'''

'''
class Slot(bl.FilamentTray):
    """docstring for Slot."""

    def __init__(self, id):
        super(Slot, self).__init__()
        self.object = "slot";
        self.id = id;

class AMS(bl.AMS):
    """docstring for AMS."""

    def __init__(self, id):
        super(AMS, self).__init__("", "")
        self.object = "ams"
        self.id = id;
        #self.slots = [];
    
    # def addSlot(self, slot: Slot):
    #    self.slots.append(slot)
    
    #@cached_property
    def slots(self):
        ret = []
        for id, tray in self.filament_trays:
            s = Slot(tray)
            s.id = id
            ret.append(s)
        return ret

class Printer(object):
    """docstring for Printer."""

    def __init__(self):
        self.AMSs = []
    
    def addAMS(self, ams: AMS):
        self.AMSs.append(ams)
'''

def listFilamentTrays(ams: bl.AMS):
    trays = []
    for ft in ams.filament_trays.keys():
        trays.append(ft)
    
    return trays

def getPrinterStatus():
    error = ensureConnected()
    if error:
        return error
    
    return {
        "status": PRINTER.get_state()
    }

def getSlots():
    error = ensureConnected()
    if error:
        return error
    
    amsh = PRINTER.ams_hub()
    slots = []
    for amsID, ams in amsh.ams_hub.items():
        for slotID, tray in ams.filament_trays.items():
            # Start by just copying all the tray/slot data returned by the printer
            slot = tray.__dict__.copy()
            
            # Asign unique identifiers
            #slot["amsID"] = amsID
            #slot["slotID"] = id
            slot["ids"] = {
                "amsID": amsID,
                "slotID": slotID,
            }
            
            brand = "Generic"
            currentCode = tray.tray_info_idx
            for name, code in getKnownFilaments().items():
                if code == currentCode:
                    brand = name.split()[0]
                    break

            
            # Map important internal values to more user-friendly (display) values
            slot["Type"] = tray.tray_type
            slot["Color"] = tray.tray_color[:6]
            slot["Brand"] = brand
            slot["Min Temp"] = tray.nozzle_temp_min
            slot["Max Temp"] = tray.nozzle_temp_max
            slot["Bed Temp"] = tray.bed_temp
            slot["displayID"] = f"AMS #{amsID} | Slot #{int(slotID)+1}"
            
            slots.append(slot)

    resp = {
        "slots": slots,
        #"slotIDKeys": ["amsID", "slotID"],
        "displayKeys": ["Type", "Color", "Brand", "Min Temp", "Max Temp", "k", "Bed Temp"],
        "colorHexKeys": ["Color"],
    }
    
    return resp
    

# Returns a list of AMS units indexed by their index number
# Each AMS has a list of trays (spool slots), also indexed by their index number
def getAMSInfo():
    error = ensureConnected()
    if error:
        return error
    
    amsh = PRINTER.ams_hub()
    #trays = []
    
    p = []
    for id, ams in amsh.ams_hub.items():
        a = {}
        a["object"] = "ams"
        a["id"] = id
        
        slots = []
        for id, tray in ams.filament_trays.items():
            x = tray.__dict__.copy()
            x["object"] = "slot"
            x["id"] = id
            slots.append(x)
        a["slots"] = slots
        p.append(a)
    
    
    """
    try:
        for ams in amsh:
            p.addAMS(ams)
            trays.append(ams.filament_trays)
            
            
            '''
            for trayID in ams.filament_trays.keys():
                if trayID in trays.keys():
                    return {"error": "Duplicate tray ID found"}
                trays[trayID] = ams.filament_trays[trayID]
            '''
            
            '''
            ts = ams.filament_trays
            for id in ts.keys():
                trays.append(ts[id])
                trayIDs.append(id)
            '''
    
    except Exception as e:
        pass
    """
    
    #return trays
    #return jsonpickle.encode(p, keys=True, max_depth=10, indent=1, include_properties=True)
    return p

'''
# tray.filament() will fail if the filament is a newer one not in the bambulabs_api code yet
# This does the same thing as that function but allows unknown values to be returned, rather than throwing an exception. 
def getTrayFilament(tray: bl.FilamentTray):
    
    # Somehow the nozzle temp values get returned as a string even though they should be integers. 
    # Lots of other things silently fail if they are not cast back to int
    return bl.AMSFilamentSettings(
        tray.tray_info_idx,
        int(tray.nozzle_temp_min),
        int(tray.nozzle_temp_max),
        tray.tray_type
    )
'''

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
    lookup = ("" + fManufacturer.strip() + " " + fType.strip()).lower()
    lookupGeneric = ("Generic " + fType.strip()).lower()
    lookupByCode = fType.strip().lower()
    backupCode = ""
    
    knownTypes = list(CODES.keys())
    
    for t in knownTypes:
        if lookup == t.lower():
            return CODES[t]
        if lookupGeneric == t.lower():
            # This will be returned if an exact match isn't found
            backupCode = CODES[t]
    
    if backupCode != "":
        return backupCode
    
    knownCodes = list(CODES.values())
    for c in knownCodes:
        if lookupByCode == c.lower():
            return c
    
    return None
    

# Pass in an instance of a connected printer
def testRun():
    if len(CODES) < 1:
        print("No filament codes loaded")
        return
    
    m1 = "Bambu     "
    n1 = "TPU 95A HF    "
    c = filamentToCode(m1, n1)
    print(f"{c}- {m1} {n1}")
    
    m2 = " NoExists   "
    n2 = "ABS    "
    c = filamentToCode(m2, n2)
    print(f"{c}- {m2} {n2}")
    
    m3 = " NoExists   "
    n3 = "GFG02    "
    c = filamentToCode(m3, n3)
    print(f"{c}- {m3} {n3}")
    
    m4 = " NoExists   "
    n4 = "NoExists    "
    c = filamentToCode(m4, n4)
    print(f"{c}- {m4} {n4}")
    
    
    

def main():
    '''
    print(bl.Filament)
    test = bl.AMSFilamentSettings("GFG02", 220, 270, "PETG")
    test2 = bl.Filament(test)
    print(test2)
    test3 = bl.Filament("PLA")
    print(test3)
    return
    '''
    checkFilamentPatch()
    #testRun()
    #return
    
    print('Starting bambulabs_api example')
    print('Connecting to BambuLab 3D printer')
    print(f'IP: {IP}')
    print(f'Serial: {SERIAL}')
    print(f'Access Code: {ACCESS_CODE}')

    # Create a new instance of the API
    printer = bl.Printer(IP, ACCESS_CODE, SERIAL)

    # Connect to the BambuLab 3D printer
    printer.connect()
    print("Waiting 3s to ensure reliable connection")
    time.sleep(3)

    # Get the printer status
    status = printer.get_state()
    print(f'Printer status: {status}')
    print()
    
    amsh = printer.ams_hub()
    amss = []
    i = 0
    try:
        for ams in amsh:
            amss.append(ams)
            i += 1
    except Exception as e:
        print(f"Found {i} AMS units")
        if i < 1:
            print("exiting")
            return
    
    amsTrays = []
    for i, ams in enumerate(amss):
        trays = listFilamentTrays(ams)
        print(f"AMS #{i} has the following trays: {trays}")
        for t in trays:
            amsTrays.append(t)
    
    amsID = 0
    trayID = 1
    
    tray = amsh[amsID][trayID]
    #currentFilament = getTrayFilament(tray)
    currentFilament = tray.filament
    currFColor = tray.tray_color[:-2] #The extra two hex characters are probably unused alpha values
    print(currentFilament)
    print(currFColor)
    test = bl.AMSFilamentSettings("GFG02", 220, 270, "PETG") #PETG-HF
    test2 = bl.AMSFilamentSettings("GFA05", 192, 240, "PETG") #PLA-Silk
    
    #result = printer.set_filament_printer("7c4b00", "PLA", amsID, trayID)
    result = printer.set_filament_printer("0c4b00", test2, amsID, trayID)
    if result:
        print("Success!")
    else:
        print("Failed")
    
    
    time.sleep(5)
    result = printer.set_filament_printer(currFColor, currentFilament, amsID, trayID)
    #result = printer.set_filament_printer("000000", "PETG", amsID, trayID)
    #result = printer.set_filament_printer("38CC0A", test2, amsID, trayID)
    if result:
        print("Success!")
    else:
        print("Failed")

    # Turn the light off
    #printer.turn_light_off()
    #time.sleep(2)
    # Turn the light on
    #printer.turn_light_on()

    # Disconnect from the Bambulabs 3D printer
    printer.disconnect()


if __name__ == '__main__':
    main()
