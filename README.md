# filamentQR
QRCode-based broswer implementation of the OpenTag standard

The goal is to put as much functionality into client-side javascript so this can be hosted on github.io. Custom user settings will be saved in cookies or similar. 

To support multiple printer brands, in most cases we probably need a separate server that users setup on their local network to translate standard API requests into commands sent to their printer AMS. 
- For Bambu, it may be possible to do this in the browser too using https://github.com/mqttjs/MQTT.js


## Tasks
- [x] Get QR code scanning working on smartphone browsers
- [X] Figure out a data format to use for QR codes
    - Modified OpenSpool: https://openspool.io/rfid.html
    - Modified OpenTag: https://github.com/Bambu-Research-Group/RFID-Tag-Guide/blob/main/OpenTag.md#data-structure-standard
- [ ] Document format changes for QR codes
- [x] Find the size of printed QR codes that are scannable
    - 40mm work well with 0.4mm nozzle; 30mm might be doable with OpenSool format
- [ ] Build a flask server that translates JSON POST requests to MQTT messages to Bambu printers
    - Figure out how to make CORS happy when phone on github site sends POST to flask

## Working notes
The `bambulabs-api` package available in pypi is a good candidate for integrating into a simple flask API server. However it currently is missing a lot of the Bambu filament code mappings. 


## Bambu AMS
Currently only the official filament profile names are supported because Bambu uses static identifiers for each that have to be mapped to the human-readable data supplied in a QR code. 

Matches are generating by combining the QR's manufacturer and name values into one space-separated string. If this does not match anything in the `bambu-ams-codes.json` list, the Manufacturer is changed to "Generic" and another match attempt is made. If that fails, an error is returned. 

If you've managed to get another profile added to your AMS (I have no idea if or how you could do that), then you can add the name and code to the json file. 

### Library issues
The `bambulabs-api` python library currently does not have all the available filament profiles programmed into it, and doesn't support setting filaments with unknown codes. To work around this I modified the library, so you'll need to `pip install git+https://github.com/Aptimex/bambulabs_api` if you want to use many of the newer filament codes with `bambu.py`. 

TODO: allow specifying json mappings at HTTP URLs so users can load custom profiles without having to host their own server. 
