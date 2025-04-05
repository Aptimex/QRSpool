#!/usr/bin/env python3

import time
import bambulabs_api as bl
import json

#local files
from bambu_config import IP, SERIAL, ACCESS_CODE

'''
class AnyFilament(bl.AMSFilamentSettings):
    """docstring for AnyFilament."""

    def __init__(self):
        super(AnyFilament, self).__init__()
    
    @classmethod
    def _missing_(cls, value: Any):
        if isinstance(value, str):
            for filament in cls:
                if value == filament.name:
                    return filament

        raise ValueError(f"Filament {value} not found")
    
    
bl.Filament = AnyFilament
'''

# Monkey patch to allow arbitrary AMSFilamentSettings objects to be sent to the AMS
def sfp(
        self,
        color: str,
        filament: str | bl.AMSFilamentSettings,
        ams_id: int = 255,
        tray_id: int = 254,
    ) -> bool:
        """
        Set the filament of the printer.

        Parameters
        ----------
        color : str
            The color of the filament.
        filament : str | AMSFilamentSettings
            The filament to be set.
        ams_id : int
            The index of the AMS, by default the external spool 255.
        tray_id : int
            The index of the spool/tray in the ams, by default the external
            spool 254.

        Returns
        -------
        bool
            True if the filament is set successfully.
        """
        assert len(color) == 6, "Color must be a 6 character hex code"
        if isinstance(filament, str) or isinstance(filament, bl.AMSFilamentSettings):  # type: ignore # noqa: E501
            if isinstance(filament, str):
                filament = bl.Filament(filament)
        else:
            raise ValueError(
                "Filament must be a string or AMSFilamentSettings object")
        return self.mqtt_client.set_printer_filament(
            filament,
            color,
            ams_id=ams_id,
            tray_id=tray_id)
bl.Printer.set_filament_printer = sfp

def spf(
    self,
    filament_material: bl.AMSFilamentSettings,
    colour: str,
    ams_id: int = 255,
    tray_id: int = 254,
) -> bool:
    """
    Set the printer filament manually fed into the printer

    Args:
        filament_material (Filament): filament material to set.
        colour (str): colour of the filament.
        ams_id (int): ams id. Default to external filament spool: 255.
        tray_id (int): tray id. Default to external filament spool: 254.

    Returns:
        bool: success of setting the printer filament
    """
    assert len(colour) == 6, "Colour must be a 6 character hex string"
    print(f"Setting type to {filament_material.tray_type} via ID {filament_material.tray_info_idx}")

    return self.__publish_command(
        {
            "print": {
                "command": "ams_filament_setting",
                "ams_id": ams_id,
                "tray_id": tray_id,
                "tray_info_idx": filament_material.tray_info_idx,
                "tray_color": f"{colour.upper()}FF",
                "nozzle_temp_min": filament_material.nozzle_temp_min,
                "nozzle_temp_max": filament_material.nozzle_temp_max,
                "tray_type": filament_material.tray_type
            }
        }
    )

def pc(self, payload: dict[any, any]) -> bool:
    """
    Generate a command payload and publish it to the MQTT server

    Args:
        payload (dict[Any, Any]): command to send to the printer
    """
    if self._client.is_connected() is False:
        logging.error("Not connected to the MQTT server")
        return False

    command = self._client.publish(self.command_topic, json.dumps(payload))
    #logging.debug(f"Published command: {payload}")
    command.wait_for_publish()
    return command.is_published()

bl.PrinterMQTTClient.__publish_command = pc
bl.PrinterMQTTClient.set_printer_filament = spf


def listFilamentTrays(ams: bl.AMS):
    trays = []
    for ft in ams.filament_trays.keys():
        trays.append(ft)
    
    return trays

# tray.filament() will fail if the filament is a newer one not in the bambulabs_api code yet
# This does the same thing as that function but allows unknown values to be used, rather than throwing an exception. 
def getTrayFilament(tray: bl.FilamentTray):
    return bl.AMSFilamentSettings(
        tray.tray_info_idx,
        tray.nozzle_temp_min,
        tray.nozzle_temp_max,
        tray.tray_type
    )

def main():
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
    test = bl.AMSFilamentSettings("GFG02", 220, 270, "PETG")
    
    #result = printer.set_filament_printer("7c4b00", "PLA", amsID, trayID)
    result = printer.set_filament_printer("0c4b00", test, amsID, trayID)
    if result:
        print("Success!")
    else:
        print("Failed")
    
    '''
    time.sleep(12)
    result = printer.set_filament_printer(currFColor, currentFilament, amsID, trayID)
    #result = printer.set_filament_printer("000000", "PETG", amsID, trayID)
    if result:
        print("Success!")
    else:
        print("Failed")
    '''

    # Turn the light off
    #printer.turn_light_off()
    #time.sleep(2)
    # Turn the light on
    #printer.turn_light_on()

    # Disconnect from the Bambulabs 3D printer
    printer.disconnect()


if __name__ == '__main__':
    main()
