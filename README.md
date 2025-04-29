<div align="center">

# QRSpool

<img align="center" src="client/logo.svg" width="20%">

</div>

QR Code-based broswer implementation of the OpenSpool standard. Quickly apply filament settings to specific multi-material slots using printable QR codes and your smartphone intead of RFID tags and readers. 

**THIS PROJECT IS STILL UNDER ACTIVE DEVELOPMENT. The main branch may not contain stable code.**

This project consists of two nearly-decoupled components: 
- A static website ("frontend") that uses client-side Javascript to access a webcam/camera, scan and parse QR codes to extract filament information, and provide a visual interface for applying scanned filament data to a slot on the printer. Hosted instance available at https://aptimex.github.io/QRSpool
- A local API server ("backend") that acts as a communication bridge between your printer and the device accessing the website, translating between standard REST API requests and whatever protocol the target printer uses. 

<div align="center">

![QRSpool Diagram](media/QRSpool.drawio.svg)

</div>

The frontend is simple enough to be hosted on GitHub Pages (which does not support any server-side operations), providing additional assurance that your camera feed is not being sent to some Internet server. It can also be hosted locally for even more security. 

The backend server must be run on a computer on the same local network as the target printer, or otherwise able to route to it. It provides specific REST API endpoints that accept and return well-defined but extensible data. Currently I have implemented a Python (Flask) server that will communicate with Bambu Labs printer in LAN-only mode using the [bambulabs-api package](https://pypi.org/project/bambulabs-api/), but other servers could be written to support other printer brands without needing to change the frontend code (or at least that was my design goal). 

## Getting Started
Requirements:
- An always-on computer with a static IP (Raspberry Pi is a good option)
    - Python 3 (tested with 3.10.12)
- A Bambu printer in LAN-only mode on the same local network as that computer
- A smartphone, or a computer with a webcam (a USB webcam with long cable will provide the best experience when using a computer)
    - A modern web browser (tested wtih Firefox and Chrome)

> [!NOTE]
> Currently there is only a backend server for interacting with Bambu printers, and only in LAN mode. Cloud-connected printers could theoretically be supported, but with the upcoming breaking "security" changes they have planned I decided not to spend time writing code to support that. 

### Backend Server Setup
First, copy the `bambu_config.example.py` file to `bambu_config.py` and modify it with your printer settings and desired server access credential. You can leave the credentials empty, but the server will still expect you to supply an empty username and password to access it. 


There are two recommended ways to run this: 
- HTTP accessible only to localhost, with a reverse proxy that adds TLS with real certificates to it and exposes it to the rest of the network, or
- Exposed HTTPS with a self-signed cert

Docker, with HTTP only, accessible on localhost (use this if using a reverse proxy that adds HTTPS and exposes it to your network):
```bash
# First edit the Dockerfile to use the HTTP CMD line
docker build --tag "qrspool-bambu" .
docker run -p 127.0.0.1:5000:5000 qrspool-bambu
```

> [!WARNING]
> If you expose a HTTP-only server to your network then any other devices on your network will be able to sniff your server credentials. 

Docker, with auto-generated self-signed HTTPS certificate, exposed to your network on port 5000:
```bash
docker build --tag "qrspool-bambu" .
docker run -p 0.0.0.0:5000:5000 qrspool-bambu
```

> [!CAUTION]
> The frontend and backend servers MUST be accessed using the same protocol, HTTP or HTTPS. If you mix protocols your broswer will silently refuse to communicate with the backend server when using the frontend.

> [!IMPORTANT]
> If the backend server uses HTTPS with a self-signed certificate you may need to navigate to it each time your broswer re-starts to accept the security risk; otherwise your broswer will silently refuse to communicate with it when using the frontend. 

Want to run it natively instead? Setup your config file and then run something like this:
```bash
pip install -r requirements.txt
openssl req -new -x509 -keyout key.pem -out server.pem -days 3650 -nodes
flask run --host=0.0.0.0 --cert=cert.pem --key=key.pem
```

### Frontend Usage
Navigate to https://aptimex.github.io/QRSpool/settings.html on your smartphone. 

Fill out the connection info for your backend server, save it, and validate it. You only need to do this once. 

Go to the Scan tab and grant access to your camera. 

> [!TIP]
> In my own testing, toggling the phone's camera LED (torch) only worked in Chrome, not Firefox. 

Scan a properly-formatted QR code and select a slot to apply it to. 

### Frontend Local Hosting
Use any webserver of your choice to host the `client` folder. For example, `python3 -m http.server` provides a quick and easy development server for testing. 

If you want fully-offline local hosting, you'll need to replace the Bootstrap (CSS and Javascript) and jsQR CDN references on each page with references to local copies of those library files that you download. 

## QR Code Data Format
This project uses the [OpenSpool protocol data format](https://openspool.io/rfid.html), modified for minimal size to allow the QR Code to be as small and compact as possible. OpenSpool currently defines a JSON format with 6 values:
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

### Filament Settings with Bambu Printers
Currently only the official filament profile names (Brand + Type displayed in the Filament dropdown in the slicer) are supported because Bambu uses static identifiers for each that have to be mapped to the human-readable data supplied in a QR code. For example, you must specify `Bambu` as the Brand and `PLA Matte` as the Type in a QR code, with that exact spelling and case, in order for the server to identify the internal code assigned to that profile. The server combines the two fields (inserting a space in between them) and looks for a mtach in the `bambu-ams-codes.json` file. 

If a code match cannot be found, the server will replace the Brand with `Generic` and attempt to find a match again. 

If that fails, the server will check to see if the Type field contains a known filament code (in `bambu-ams-codes.json`) and use that directly. This allows you to create tags for [custom filament profiles you have saved to your AMS](https://forum.bambulab.com/t/how-to-add-custom-filaments-so-you-can-select-them-in-the-ams/52140) by adding them to that JSON code file. 

If that fails, the server will return an error. 

From my testing Bambu printers seem to ignore any temperature values you specify and just use the ones in the profile settings associated with the code; only the filament code and color seem to matter. 

### Printing QR Codes
I recommend [QR2STL](https://printer.tools/qrcode2stl) for generating printable QR codes. It provides a lot of customization options (notably including different error correction levels) and a quick 3D preview of the STL. 

I've had good luck generating QR codes with this data format that are 30x30mm, printed with a 0.4mm nozzle. Smaller QR codes may be difficult to print with enough detail to be decoded reliably unless you switch to a 0.2mm nozzle. [Here's an example](https://printer.tools/qrcode2stl/#shareQR-eyJlcnJvckNvcnJlY3Rpb25MZXZlbCI6IkwiLCJ0ZXh0IjoiT1MxLjB8UExBIE1hdHRlfDFlODQ0MHxCYW1idXwxOTB8MjQwIiwiYmFzZSI6eyJ3aWR0aCI6MzAsImhlaWdodCI6MzAsImRlcHRoIjoxLCJjb3JuZXJSYWRpdXMiOjIsImhhc0JvcmRlciI6ZmFsc2UsImhhc1RleHQiOnRydWUsInRleHRNYXJnaW4iOjEuMiwidGV4dFNpemUiOjMsInRleHRNZXNzYWdlIjoiQmFtYnUgUExBIFxuTWF0dGUgR3JlZW4iLCJ0ZXh0RGVwdGgiOjAuNH0sImNvZGUiOnsiZGVwdGgiOjAuNCwibWFyZ2luIjoxLjJ9fQ==) of some good starting settings for generating your own QR codes. 

When printing, use the Arachne wall generation method for best results. 

# Technical Notes
This section provides implementation details about the project architecture for anyone who wants to create an interoperable server or client. 

## Server Interactions
The frontend (web client) is responsible for parsing QR codes, extracting filament data from them, and sending that data in a specific format to a separate server that handles passing it off to your printer. Since different printer brands have different APIs, this modular separation makes developing servers that can interact with different printers much easier since the frontend code (theoretically) can be re-used. 

The server should expose the following API endpoints:
- `/serverStatus` should accept unauthenticated GET requests and return this JSON-formatted response indicating that the server is running (regardless of printer status), plus information about server authentication requirements: 
```json
{
    "status": "running",
    "authRequired": "<true|false>",
    "authCorrect": "<true|false>"
}
```
`authRequired` indicates whether requests to all other endpoints require Basic Auth. `authCorrect` indicates whether the Basic Auth credentials provided in the request (if any; they're optional for this endpoint) are correct. 

- `/printerStatus` should accept GET requests and return this JSON response, where `<statusMessage>` is some status message obtained from the printer, or a message indicating a communication error with the printer: 
```json
{
    "status": "<statusMessage>"
}
```

- `/slots` should accept GET requests and return JSON data about the printer's available AMS slots. In particular, it should provide everything the frontend needs to help the user generate a request to the `setFilament` endpoint using the data from a QR code. More details in the `/slots` section below. 

- `/setFilament` should accept POST or PUT requests containing JSON data that describes a new filament to be configured in a particular AMS slot. The data keys that needs to be submitted to this endpoint are defined by the response returned by the `/slots` endpoint. 

- `/reconnect` should accept a GET request with no parameters, and take necessary actions to reset the connection between the server and printer. This is intended to be used as an easy quick-fix option if things aren't working as expected. 

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
- `slots` is a list of `slot` objects representing filament slots available on the printer. The `ids` and `displayID` keys are mandatory, the rest are optional. 
- `ids` is an opaque object with data that uniquely identifies the slot. The client supplies this exact object back to the server to identify this slot, such as when requesting to modify its filament settings. The data in this slot must be able to be JSON-stringified and then parsed back to a JavaScript object without losing any ionformation. 
- `displayID` is a string that will be displayed to help the user identify the slot from a list of available slots; ideally this would correspond to identifying markings on the physical filament slots. 
- `displayKeys` is a list of keys present in every `slot` object that should be displayed on the client when the user is selecting a slot to apply filament settings to. This list should ideally include as many of the fields that are present in the QR codes as possible, minus the tag headers (e.g., `OS1.0`). 
- `colorHexKeys` is a list of keys in a `slot` object whose values should be interpreted by the client as a 6-digit hex color code and displayed to the user as that color. 

### /setFilament
This endpoint accepts a JSON object describing a target filament slot and what filament to set for that slot. It should have the following format that mirrors the QR code format (data in `<>` brackets should be replaced with an appropriate string):
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

### Authentication
The server may optionally enforce a standard [Basic Authentication scheme](https://en.wikipedia.org/wiki/Basic_access_authentication) with username and password, separate from any authentication that has to happen between the server and printer. This is intended to provide some baseline protection against unauthorized configuration changes being submitted through the server, for example if the server is reachable by guests on your wifi network. Note that this approach may be vulnerable to CSRF attacks. 

> [!IMPORTANT]
> This provides very minimal protection if the server uses no encryption (HTTP), moderate protection if the server uses encryption (HTTPS) with a self-signed certificate, and best protection if the server uses encryption with a proper (not self-signed) certificate. However, in all cases this is still vulnerable to brute-force attacks, so pick a strong secret and don't expose the server to the Internet. 

The server may provide a configuration option to disable authentication; but this option is not implemented in the current Bambu server, and authentication is always required. 

To authenticate, the client provides a standard Basic Authentication header in all API requests, where `<cred>` is the base64-encoded `<AUTH_USER>:<AUTH_PASS>` string: 
```
Authorization: Basic <cred>
```

The username and password supplied by the client can be set by the user in the `Settings` page, and are stored in the client's local storage, just like the server URL. They are NOT stored in a cookie in order to help prevent accidental exposure to the client website server. 


# Other Notes
## Modified Library Code
Currently the `bambulabs-api` [Python library](https://github.com/BambuTools/bambulabs_api) does not provide support for setting arbitrary filament data, it has to match an option from an internal list. Bambu printers map [filament profiles to internal codes](https://github.com/bambulab/BambuStudio/tree/5f1714f02ceeb34519e0ec401d37be3ff7efa87b/resources/profiles/BBL/filament), so you utlimately have to supply a code it recognizes to change a filament slot. 

I have a pull request in with that library to enable setting filament codes no in their internal list, but in the meantime the `requirements.txt` file pulls from a [specific commit in my forked repo](https://github.com/Aptimex/bambulabs_api/commit/70a459f0314a83403c2dc40d2596ffcba874b360) that implements that change. You can change this line to use the official repo directly, but then a lot of newer filament profiles (defined in `bambu-ams-codes.py`) will silently fail if you try to use them. 


## Bambu AMS Code Matching
If you've managed to get another profile added to your AMS (I have no idea if or how you could do that), then you can add the name and code to that json file so the server can map it to the proper code. 
