# filamentQR
QRCode-based broswer implementation of the OpenTag standard

The goal is to put as much functionality into client-side javascript so this can be hosted on github.io. Custom user settings will be saved in cookies or similar. 

To support multiple printer brands, in most cases we probably need a separate server that users setup on their local network to translate standard API requests into commands sent to their printer AMS. 
- For Bambu, it may be possible to do this in the browser too using https://github.com/mqttjs/MQTT.js

## QR Code Data Format
This uses the [OpenSpool protocol data format](https://openspool.io/rfid.html), modified for minimal size to allow the QR Code to be as small and compact as possible. OpenSpool currently defines a JSON format with 6 values:
- protocol 
- version 
- type 
- color_hex 
- brand
- min_temp
- max_temp

These values have been converted into the following string format that can be stored more compactly in a QR code, with values in a specific order and separated by the pipe (`|`) character:
```
OS1.0|TYPE|COLOR_HEX|BRAND|MIN_TEMP|MAX_TEMP
```

`OS1.0` is shorthand for `openspool1.0`, and its presence at the start of the string helps the scanner identify valid QR codes so it doesn't waste time trying to process unrelated codes. 

The remaining fields are approximately in order of importance/necessity for configuring an AMS slot. This project will parse as many fields as are provided, allowing one or more on the end to be left off. For example, if your printer automatically configures print temperatures based on pre-configured profiles for certain types and brands, you can leave these values off. 

### Printing QR Codes
I recommend [QR2STL](https://printer.tools/qrcode2stl) for generating printable QR codes. It provides a lot of customization options (notably including different error correction levels) and a quick 3D preview of the STL. 

I've had good luck generating QR codes with this data format that are 30x30mm, with a 0.4mm nozzle. Much smaller and your printer may not be able to print the code with enough detail to be decoded reliably unless you switch to a 0.2mm nozzle. [Here's an example](https://printer.tools/qrcode2stl/#shareQR-eyJlcnJvckNvcnJlY3Rpb25MZXZlbCI6IkwiLCJ0ZXh0IjoiT1MxLjB8QUJTfDFlODQ0MHxCYW1idXwyMTB8MjMwIiwiYmFzZSI6eyJ3aWR0aCI6MzAsImhlaWdodCI6MzAsImRlcHRoIjoxLCJjb3JuZXJSYWRpdXMiOjIsImhhc0JvcmRlciI6ZmFsc2UsImhhc1RleHQiOnRydWUsInRleHRNYXJnaW4iOjEuMiwidGV4dFNpemUiOjMsInRleHRNZXNzYWdlIjoiQmFtYnUgQUJTXG5HcmVlbiIsInRleHREZXB0aCI6MC40fSwiY29kZSI6eyJkZXB0aCI6MC40LCJtYXJnaW4iOjEuMn19) of some good starting settings for generating your own QR code. 

When printing, use Arachne slicing for best results. 

## Server Interactions
The frontend is responsible for parsing QR codes, extracting filament data, and sending it to a separate server that handles passing it off to your printer. Since different printer brands have different APIs, this modular separation makes developing support for different printers much easier. 

The server should expose to endpoints: `/amsinfo` and `/setFilament`. 
- The `setFilament` endpoint should accept POST requests with JSON data that describes a new filament to be configured in a particular AMS slot. 
- The `amsinfo` endpoint should return JSON data about the available AMS slots. In particular, it should provide everything the frontend needs to help the user generate a request to the `setFilament` endpoint using the data from a QR code.

### amsinfo
This should return the following required JSON data:
```json
{
    "printer": [
        {
            "type": "ams",
            "id": "<ams_identifier>",
            "slots": [
                {
                    "type": "slot",
                    "id": "<slot_identifier>"
                },
            ]
        },
    ]
}
```
- The `printer` key contains a list of `ams`-typed objects 
- Each `ams`-typed object also contains an identifier (`id`), and a list of `slot`-typed objects (`slots`)
- Each `slot`-typed object contains an identifier `id`
- Other info may be included in addition to these required fields, such as data about the existing filament slot configurations
- The `id` values should be the same ones that are needed to identify the AMS slot when interacting with the `setFilament` endpoint

### setFilament





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

It currently seems that Bambu printers (or at least the A1) only care about the filament code and color and disregard the temperature and type values that are sent. 

### Library issues
The `bambulabs-api` python library currently does not have all the available filament profiles programmed into it, and doesn't support setting filaments with unknown codes. To work around this I modified the library, so you'll need to `pip install git+https://github.com/Aptimex/bambulabs_api` if you want to use many of the newer filament codes with `bambu.py`. 

TODO: allow specifying json mappings at HTTP URLs so users can load custom profiles without having to host their own server. 
