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

`OS1.0` is shorthand for `openspool1.0`, and its presence at the start of the string helps the scanner identify valid QR codes matching this modified format so it doesn't waste time trying to process unrelated codes. 

The remaining fields are approximately in order of importance/necessity for configuring an AMS slot. This project will parse as many fields as are provided, allowing one or more on the end to be left off. For example, if your printer automatically configures print temperatures based on pre-configured profiles for certain types and brands, you can leave these values off. 

### Printing QR Codes
I recommend [QR2STL](https://printer.tools/qrcode2stl) for generating printable QR codes. It provides a lot of customization options (notably including different error correction levels) and a quick 3D preview of the STL. 

I've had good luck generating QR codes with this data format that are 30x30mm, with a 0.4mm nozzle. Much smaller and your printer may not be able to print the code with enough detail to be decoded reliably unless you switch to a 0.2mm nozzle. [Here's an example](https://printer.tools/qrcode2stl/#shareQR-eyJlcnJvckNvcnJlY3Rpb25MZXZlbCI6IkwiLCJ0ZXh0IjoiT1MxLjB8QUJTfDFlODQ0MHxCYW1idXwyMTB8MjMwIiwiYmFzZSI6eyJ3aWR0aCI6MzAsImhlaWdodCI6MzAsImRlcHRoIjoxLCJjb3JuZXJSYWRpdXMiOjIsImhhc0JvcmRlciI6ZmFsc2UsImhhc1RleHQiOnRydWUsInRleHRNYXJnaW4iOjEuMiwidGV4dFNpemUiOjMsInRleHRNZXNzYWdlIjoiQmFtYnUgQUJTXG5HcmVlbiIsInRleHREZXB0aCI6MC40fSwiY29kZSI6eyJkZXB0aCI6MC40LCJtYXJnaW4iOjEuMn19) of some good starting settings for generating your own QR code. 

When printing, use Arachne slicing for best results. 

## Server Interactions
The frontend (web client) is responsible for parsing QR codes, extracting filament data, and sending it to a separate server that handles passing it off to your printer. Since different printer brands have different APIs, this modular separation makes developing servers that can interact with different printers much easier. 

The server should expose these API endpoints:
- `/serverStatus` should accept GET requests and return this JSON-formatted response indicating that the server is running (regardless of printer status), and information about authentication requirements: 
```json
{
    "status": "running",
    "authRequired": "true|false"
}
```
If `authRequired` is set to `true`, then requests to all other endpoints 

- `/printerStatus` should accept GET requests and return this JSON response, where `<statusMessage>` is some status message obtained from the printer, or a message indicating a communication error with the printer: 
```json
{
    "status": "<statusMessage>"
}
```
- `/slots` should accept GET requests and return JSON data about the printer's available AMS slots. In particular, it should provide everything the frontend needs to help the user generate a request to the `setFilament` endpoint using the data from a QR code. More details in the `/slots` section below. 
- `/setFilament` should accept POST or PUT requests containing JSON data that describes a new filament to be configured in a particular AMS slot. The data keys that needs to be submitted to this endpoint are defined by the response returned by the `/slots` endpoint. 

### /slots
This endpoint should return the following JSON data (data in `<>` brackets should be replaced with an appropriate string):
```json
{
    "slots": [
        {
            "ids": {
                "OPAQUE": "OPAQUE"
            },
            "displayID": "<value>",
            "<dk1>": "<value>",
            "<dk2>": "<value>",
            "<dk3>": "<value>",
            "<otherKey>": "<value>",
        },
    ],
    "displayKeys": ["<dk1>", "<dk2>", "<dk3>"],
    "colorHexKeys": ["<dk3>"]
}
```
- `slots` is a list of `slot` objects representing filament slots available on the printer. The keys can have any names, 
    - The server may return additional keys-value pairs in the `slot` object that do not need to be used by the client. 
- `ids` is an opaque object with data that uniquely identifies the slot. The client supplies this exact object back to the server to identify this slot, such as when requesting to modify its filament settings. The data in this slot must be able to be JSON-stringified and then parsed back to a JavaScript object without losing any ionformation. 
- `displayID` is a string that will be displayed to help the user identify the slot from a list of available slots. 
- `displayKeys` is a list of keys present in every `slot` object that should be displayed on the client when the user is selecting a slot to apply filament settings to. `slotIDKeys` will always be displayed and should not be included in this list. This list should usually include at least the fields (minus the `OS1.0` header) that are present in the QR codes. 
- `colorHexKeys` is a list of keys that, IF present in a `slot` object and displayed to the user, should be interpreted by the client as a 6-digit hex color code and displayed to the user as that color. 

### /setFilament
This endpoint accepts a JSON object describing a target filament slot and what filament to set for that slot. It should have the following format (data in `<>` brackets should be replaced with an appropriate string):
```json
{
    "ids": {
        "OPAQUE": "OPAQUE"
    },
    "type": "<value>",
    "colorHex": "<value>",
    "brand": "<value>",
    "minTemp": "<value>",
    "maxTemp": "<value>",
}
```
- The `<idX>` keys and values are the same as the ones provided by the `/slots` endpoint for the target slot, as defined in the `slotIDKeys` list. Even if only one slot is available, this value(s) should still be provided. 
- The remaining values are taken from the scanned QR code. 

### Authentication
The server may optionally enforce a Basic Authentication scheme with username and password, separate from any authentication that has to happen between the server and printer. This is intended to provide some baseline protection against unauthorized configuration changes being submitted through the server, for example if the server is reachable by guests on your wifi network. Note that this approach is probably still vulnerable to CSRF attacks. 

Note that this provides very minimal protection if the server uses no encryption (HTTP), moderate protection if the server uses encryption (HTTPS) with a self-signed certificate, and best protection if the server uses encryption with a proper (not self-signed) certificate. However, in all cases this is still vulnerable to brute-force attacks, so pick a strong secret and don't expose the server to the Internet. 

To enable server authentication, set non-empty ASCII strings for the `AUTH_USER` and `AUTH_PASS` variables in the `bambu_config.py` file. 

If either of those variables is non-empty, the server must return the `true` value for the `authRequired` key in the `/serverStatus` response and require authentication before processing requests on any other API endpoint. 

To authenticate, the client provides a standard Basic Authentication header in all API requests, where `<cred>` is the base64-encoded `<AUTH_USER>:<AUTH_PASS>` string: 
```
Authorization: Basic <cred>
```

The username and password can be set by the user in the `settings.html` page, and are stored in the client's local storage, just like the server URL. They are NOT stored in a cookie in order to help prevent accidental exposure to the client website server. 



## Tasks
- [x] Get QR code scanning working on smartphone browsers
- [X] Figure out a data format to use for QR codes
    - Modified OpenSpool: https://openspool.io/rfid.html
    - Modified OpenTag: https://github.com/Bambu-Research-Group/RFID-Tag-Guide/blob/main/OpenTag.md#data-structure-standard
- [x] Document format changes for QR codes
- [x] Find the size of printed QR codes that are scannable
    - 40mm work well with 0.4mm nozzle; 30mm might be doable with OpenSool format
- [x] Build a flask server that translates JSON POST requests to MQTT messages to Bambu printers
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
