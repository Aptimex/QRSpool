<div align="center">

# QRSpool

<img align="center" src="client/media/logo.svg" width="20%">

</div>

Change your printer's filament by scanning a QR code with your phone. 

This project consists of two nearly-decoupled components: 
- A static website ("frontend") that uses client-side Javascript to access your webcam/camera, scan and parse QR codes to extract filament information, and provide a visual interface for applying scanned filament data to a slot on your printer. GitHub Pages hosted instance available at https://qrspool.com
- A local API server ("backend") that acts as a communication bridge between your printer and browser, translating between standard REST API requests and whatever protocol your printer uses. 

<div align="center">

![QRSpool Diagram](media/QRSpool.drawio.svg)

</div>

The frontend is simple enough to be hosted on GitHub Pages (which does not support any server-side operations), providing additional assurance the hosting server is not accessing your camera data. It can also be hosted locally (including offline) for even greater assurance. 

The backend server must be run on a computer on the same local network as the target printer, or otherwise able to route to it. It provides specific REST API endpoints that accept and return well-defined but extensible data. Currently I have implemented a Python (Flask) server that will communicate with Bambu Labs printer in LAN-only mode using the [bambulabs-api package](https://pypi.org/project/bambulabs-api/), but other servers could be written to support other printer brands, without needing to change the frontend code. 

## Getting Started
Requirements:
- A Bambu Labs printer in LAN-only mode; other brands may be supported in the future
- A server (always-on computer) with a static IP on the same LAN as the printer
    - Docker, or Python 3 (tested with >=3.10.12)
- A smartphone with camera, or a computer with a webcam (a USB webcam with long cable is best)
    - A modern web browser (tested wtih Firefox and Chrome)

> [!NOTE]
> Currently there is only a backend server for interacting with Bambu printers, and only in LAN mode. Cloud-connected printers could theoretically be supported, but with the upcoming breaking "security" changes they have planned I decided not to spend time writing code to support that. 

### Backend Server Setup
The backend server code is in the `bambu-server` folder. Configuration files are in the `configs` subfolder. 

First, copy or rename the `bambu_config.example.py` file to `bambu_config.py` and modify it with your printer settings and desired backend server access credentials. You can leave the credentials empty, but the server will still expect you to supply an empty username and password to access it (authentication can't be disabled). 

There are two recommended ways to run this backend server: 
- (Default, easiest) HTTPS with a self-signed cert, exposed directly to your LAN. Optionally obtain a real certificate and use that instead. 
- (Recommended, more complex) HTTP, using a reverse proxy to add proper SSL/TLS and expose that to your LAN.

Docker is the recommended way to run the server. The provided `Dockerfile` supports both options, just uncomment the appropriate `CMD` line. Then from that folder run:
```bash
sudo docker compose up --build -d
```

This will expose the API server on port 5123, but that can be customized by editing the provided docker files. The files in the `configs` subdirectory will be mounted into the container so they will persist across container restarts. 

> [!WARNING]
> If you expose a HTTP-only server to your network then any other devices on your network will be able to sniff your server credentials. 

> [!WARNING]
> The frontend and backend servers MUST be accessed using the same protocol, HTTP or HTTPS. If you mix protocols your broswer will proabably silently refuse to communicate with the backend server when using the frontend.

Reverse proxy setup instructions are outside the scope of this project. 

Want to run it natively instead? Setup your config files and then run something like this:
```bash
python3 -m pip install -r requirements.txt
openssl req -new -x509 -keyout key.pem -out server.pem -days 3650 -nodes
flask run --host=0.0.0.0 --cert=cert.pem --key=key.pem
```

### Frontend Usage
Navigate to https://qrspool.com/settings.html on your smartphone using Chrome or Firefox. 

Fill out the URL for your backend server, save it, and validate it. You only need to do this once, unless your settings/network change.

> [!IMPORTANT]
> If the backend server uses HTTPS with a self-signed certificate you may need to navigate to it each time your broswer re-starts to accept the security risk; otherwise your broswer will silently refuse to communicate with the backend server. 

Go to the Scan tab and grant access to your camera. 

> [!TIP]
> In my own testing, toggling the phone's camera LED (torch) only worked in Chrome, not Firefox. 

Scan a properly-formatted QR code (described in the next section) and select a printer filament slot to apply it to. 

### Optional: Frontend Local Hosting
Use any webserver of your choice to host the `client` folder. For example, `python3 -m http.server` provides a quick and easy development server for testing. There is also a python script in that folder for running a development HTTPS webserver. 

If you want fully-offline local hosting, you'll need to download the `Bootstrap` (CSS and Javascript) and `jsQR` files referenced in each HTML file and modify those references to point to the downloaded files. 

## QR Code Data Format
This project supports QR codes with the following data format:
```
OS1.0|TYPE|COLOR_HEX|BRAND|MIN_TEMP|MAX_TEMP
```

`OS1.0` is a static string that helps the scanner identify valid QR codes matching this format so it doesn't waste time trying to process unrelated codes. 

The remaining fields, separated by the pipe (`|`) character, should be replaced with data related to the filament you want it to represent. They are approximately in order of importance/necessity for configuring a filament slot. The scanner will parse as many fields as are provided, allowing you to skip values (leave them empty, or ommit them from the end) that you don't care about or that your printer doesn't support setting. 

### Printing QR Codes
I recommend [QR2STL](https://printer.tools/qrcode2stl) for generating printable QR codes. It provides a lot of customization options (notably including different error correction levels) and a quick 3D preview of the STL. 

I've had good luck generating QR codes with this data format that are 30x30mm, printed with a 0.4mm nozzle. Smaller QR codes may be difficult to print with enough detail to be decoded reliably unless you switch to a 0.2mm nozzle. [Here's an example](https://printer.tools/qrcode2stl/#shareQR-eyJlcnJvckNvcnJlY3Rpb25MZXZlbCI6IkwiLCJ0ZXh0IjoiT1MxLjB8UExBIE1hdHRlfDFlODQ0MHxCYW1idXwxOTB8MjQwIiwiYmFzZSI6eyJ3aWR0aCI6MzAsImhlaWdodCI6MzAsImRlcHRoIjoxLCJjb3JuZXJSYWRpdXMiOjIsImhhc0JvcmRlciI6ZmFsc2UsImhhc1RleHQiOnRydWUsInRleHRNYXJnaW4iOjEuMiwidGV4dFNpemUiOjMsInRleHRNZXNzYWdlIjoiQmFtYnUgUExBIFxuTWF0dGUgR3JlZW4iLCJ0ZXh0RGVwdGgiOjAuNH0sImNvZGUiOnsiZGVwdGgiOjAuNCwibWFyZ2luIjoxLjJ9fQ==) of some good starting settings for generating your own QR codes. 

When printing, use the Arachne wall generation method for best results. 

### Bambu Printers Caveats
Currently only the official filament profile names (Brand + Type, displayed in the Filament dropdown in Bambu Studio) are supported. Bambu uses static internal identifiers for each available profile that have to be mapped to the human-readable data supplied in a QR code. For example, you must specify `Bambu` as the Brand and `PLA Matte` as the Type in a QR code, with that exact spelling and case, in order for the server to identify the internal code (`GFA01`) assigned to that profile. The server combines the two fields (inserting a space in between them) and looks for a match in the `bambu-ams-codes.json` file to find the correct code to send to the printer. 

If a code match cannot be found, the server will replace the Brand with `Generic` and attempt to find a match again. 

If that fails, the server will check to see if the Type field contains a known filament code (in the `bambu-ams-codes.json` file) and use that directly. 

Alternatively, if the `BRAND` field contains the string `RAWCODE` then the server will just assume that the `TYPE` field contains a custom filament code and use it directly. This allows you to use [custom filament profile saved to your AMS](https://forum.bambulab.com/t/how-to-add-custom-filaments-so-you-can-select-them-in-the-ams/52140) without having to edit the JSON code file. However, I recommend just editing the JSON code file instead since that will be a lot easier to update than printed QR codes if you ever have to reset your AMS or get a new one or something. 

> [!NOTE]
> In my own testing the printer/AMS just silently ignored requests that contained unrecognized codes. So this *should* be safe to play around with, but you ultimately do so at your own risk. 

If all those tests fail to identify an appropriate code, the server will return an error. 

From my testing Bambu printers seem to ignore any temperature values you specify and just use the ones in the profile settings associated with the code; only the filament code and color seem to matter. So you can completely ommit the temperature fields in your QR codes if you want. 

# Technical Notes
This section provides implementation details about the project architecture for anyone who wants to create an interoperable server or client. 

## QR Codes

This project uses the [OpenSpool protocol data format](https://openspool.io/rfid.html), modified for minimal size to allow the QR Code to be as small and compact as possible. OpenSpool 1.0 defines a JSON format with 6 values:
- protocol 
- version 
- type 
- color_hex 
- brand
- min_temp
- max_temp

These values have been converted into the string format described above, which can be stored much more compactly in a QR code than JSON data.

## Backend Server Endpoints
The frontend (web client) is responsible for parsing QR codes, extracting filament data from them, and sending that data in a specific format to a separate server that handles passing it off to your printer. Since different printer brands have different APIs, this modular separation makes developing servers that can interact with different printers much easier since the frontend code can (theoretically) be re-used without any changes. 

Unless otherwise stated, data in `<>` brackets should be replaced with an appropriate string, while everything else is a string literal. 

The server should expose the following API endpoints:

###  /serverStatus
This should accept unauthenticated GET requests and return this JSON-formatted response indicating that the server is up and running (regardless of printer status), plus information about server authentication requirements: 
```json
{
    "status": "running",
    "authRequired": "<true|false>",
    "authCorrect": "<true|false>"
}
```

`authRequired` indicates whether requests to all other endpoints require/enforce Basic Auth. `authCorrect` indicates whether the Basic Auth credentials provided in the request (if any; they're optional for this endpoint) are correct. 

This is the endpoint that gets hit when the user validates the server information they saved in the frontend. 

### /printerStatus
This should accept GET requests and return this JSON response, where `<statusMessage>` is some status message obtained from the printer, or a message indicating a communication error between the server and printer: 
```json
{
    "status": "<statusMessage>"
}
```

### /slots
This should accept GET requests and return JSON data about the printer's available filament slots. In particular, it should provide everything the frontend needs to help the user generate a request to the `setFilament` endpoint using the data from a QR code. 

This endpoint should return data with this JSON format:
```json
{
    "slots": [
        {
            "ids": {
                "<OPAQUE>": "<OPAQUE>"
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
- `ids` is an opaque object with data that uniquely identifies the slot on this printer. The frontend supplies this exact object back to the server to identify this slot when requesting to modify its filament settings. This object must be able to be JSON-stringified and then parsed back to a JavaScript object without any information loss. 
- `displayID` is a string that will be displayed to help the user identify the slot from a list of available slots; where possible, this value should correspond to identifying physical markings on the filament slots. 
- `displayKeys` is a list of keys present in every `slot` object that should be displayed by default on the frontend when the user is selecting a slot to apply filament settings to. This list should ideally include as many of the fields that are present in the QR codes as possible, minus the tag headers (e.g., `OS1.0`). 
- `colorHexKeys` is a list of keys in a `slot` object whose values should be interpreted by the client as a 6-digit hex color code and displayed to the user as that color. 

###  /setFilament
This should accept POST or PUT requests containing JSON data that describes a new filament to be configured in a specific filament slot:
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

The `ids` value will be copied from a response returned by the `/slots` endpoint to identify the target slot. The remaining values mirror the QR code data format. These keys may have empty string values if the associated data is not available (for example, because some fields were omitted from a scanned QR code). 

###  /reconnect
This should accept a GET request with no parameters, and take necessary actions to reset the connection between the server and printer. This is intended to be used as an easy quick-fix option if things aren't working as expected. 

## Backend Server Authentication
The server may optionally enforce a standard [Basic Authentication scheme](https://en.wikipedia.org/wiki/Basic_access_authentication) with username and password, separate from any authentication that has to happen between the server and printer. This is intended to provide some baseline protection against unauthorized configuration changes being submitted through the backend server, for example if the backend is reachable by guests on your WiFi network. 

> [!IMPORTANT]
> This provides very minimal protection if the server uses no encryption (HTTP), moderate protection if the server uses encryption (HTTPS) with a self-signed certificate, and best protection if the server uses encryption with a proper (not self-signed) certificate. However, in all cases this is still vulnerable to brute-force attacks, so pick a strong secret and don't expose the server to the Internet. 

The server may provide a configuration option to disable authentication; but this option is not implemented in the current Bambu server, and authentication is always required. 

To authenticate, the client provides a standard Basic Authentication header in all API requests, where `<cred>` is the base64-encoded `<AUTH_USER>:<AUTH_PASS>` string: 
```
Authorization: Basic <cred>
```

The username and password supplied by the client can be set by the user in the `Settings` page, and are stored in the client's local storage, just like the server URL. They are NOT stored in a cookie in order to help prevent accidental exposure to the client website server. 


# Other Notes

## Bambulabs-api Dependancy
When I started this project I realized that the `bambulabs-api` [Python library](https://github.com/BambuTools/bambulabs_api) didn't support sending arbitrary filament codes or data, requiring matches against an internal code list that isn't always up-to-date. That was fixed with [this commit](https://github.com/BambuTools/bambulabs_api/pull/130/commits/f0838aaf963cfdd09178bc45caecd782bf983d9f), so the `requirements.txt` file for the backend server references that commit directly. This will updated to point to a normal version number once the next update is released. 
