from configs.bambu_config import IP, SERIAL, ACCESS_CODE
import time
import bambulabs_api as bl
import bambu

def makeError(msg):
    return {"error": msg}

def makeWarning(msg):
    return {"warning": msg}


def main():
    print(bambu.getSlots())
    return 0

    PRINTER = bl.Printer(IP, ACCESS_CODE, SERIAL)
    PRINTER.connect()
    time.sleep(3)
    amsh = PRINTER.ams_hub()
    for amsID, ams in amsh.ams_hub.items():
        print(amsID)
        print(ams.filament_trays.items())
    
        print("--------------------")
        print(ams.get_filament_tray(1))
        print(ams.get_filament_tray(2))

    print("Disconnecting")
    PRINTER.disconnect()

if __name__ == "__main__":
    main()