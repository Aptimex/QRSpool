#!/usr/bin/env python3

import time
import bambulabs_api as bl
import json
import os
#import importlib
from copy import deepcopy

#local files
from bambu_config import IP, SERIAL, ACCESS_CODE


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


def listFilamentTrays(ams: bl.AMS):
    trays = []
    for ft in ams.filament_trays.keys():
        trays.append(ft)
    
    return trays

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
    for ams in amss:
        trays = listFilamentTrays(ams)
        print(f"AMS #{i} has the following trays: {trays}")
        for t in trays:
            amsTrays.append(t)
    
    amsID = 0
    trayID = 1
    
    tray = amsh[amsID][trayID]
    currentFilament = getTrayFilament(tray)
    currFColor = tray.tray_color[:-2] #The extra two hex characters are probably alpha values
    print(currentFilament)
    print(currFColor)
    test = bl.AMSFilamentSettings("GFG02", 220, 270, "PETG") #PETG-HF
    test2 = bl.AMSFilamentSettings("GFA05", 192, 240, "PLA") #PLA-Silk
    
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
