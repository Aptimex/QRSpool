<div align="center">

# QRSpool

<img align="center" src="client/media/logo.svg" width="20%">

</div>

Update your 3D printer's filament slot settings by scanning a printed QR code or NFC tag with your phone. Point your camera at a filament code, the a slot code, and the printer updates its AMS settings instantly.

> **Beta:** Fully functional for Bambu Labs printers in LAN-only mode, with experimental support for printers that use the newer LAN+DEV mode (tested on a P2S with AMS 2 Pro). Please report any issues you encounter.

## Table of Contents
- [What It Does](#what-it-does)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
  - [Step 1: Set Up the Backend Server](#step-1-set-up-the-backend-server)
  - [Step 2: Connect the Frontend](#step-2-connect-the-frontend)
- [Scanning and Applying Filament](#scanning-and-applying-filament)
- [Creating Tags](#creating-tags)
  - [Filament QR Codes](#filament-qr-codes)
  - [Slot QR Codes](#slot-qr-codes)
  - [Printing Your Tags](#printing-your-tags)
  - [Attaching Tags to Spools](#attaching-tags-to-spools)
  - [NFC Tags](#nfc-tags)
- [Bambu Printer Notes](#bambu-printer-notes)
- [Technical Reference](#technical-reference)
  - [URL Parameters](#url-parameters)
  - [OpenTag3D Field Length Limits](#opentag3d-field-length-limits)
  - [Backend Server API](#backend-server-api)
  - [Backend Server Authentication](#backend-server-authentication)
  - [3rd Party Dependencies](#3rd-party-dependencies)

---

## What It Does

QRSpool has two components:

- **Frontend** — A website ([qrspool.com](https://qrspool.com)) that uses your phone's camera or NFC to scan filament tags. All image processing happens locally in your browser; no camera data is ever sent to any server.
- **Backend server** — A small server you run on your home network that bridges the website and your printer.

The typical workflow:

1. 3D print some QR codes or write some NFC tags* and attach them to your filament spools and AMS slots
2. Scan the QR code (or tap an NFC tag) on a filament spool with your phone camera, right from your browser
3. Scan the QR code (or tap an NFC tag) on the slot you want the filament settings applied to
4. View and verify your printer's new AMS slot setting right from your phone

[Quick demo video.](https://www.youtube.com/watch?v=UtbaKgVyuF8)

<img align="center" src="media/scanning.png">
<img align="center" src="media/apply.png">

You can also scan just a filament code/tag and then manually select a slot to apply it to on your phone. 

*If you have an Android phone with Chrome, you can use standardized NFC tags instead of QR codes. For everyone else, custom web URL NFC tags can be used and provide similar functionality, but may require extra confirmation steps each time you scan a tag. See the [NFC Tags](#nfc-tags) section for info about supported formats and how to write tags.

---

## Requirements

- **Printer:** A Bambu Labs printer in LAN-only mode, or LAN+DEV mode for newer printers/firmware (other printer brands not currently supported)
- **Server:** An always-on computer (server) on the same network as your printer, able to run either Docker (recommended) or Python ≥3.10
  - Will work best if it has a stable local IP address or DNS name
- **Phone:** Any modern smartphone with a camera
  - Chrome is recommended; Firefox and Safari support the core scanning features with some limitations

---

## Quick Start

### Step 1: Set Up the Backend Server

The backend server translates data between the website and your printer. It runs on a computer on your home network.

```bash
git clone https://github.com/Aptimex/QRSpool.git
cd QRSpool/bambu-server
cp configs/bambu_config.example.json configs/bambu_config.json
```

Now edit `configs/bambu_config.json` and fill in your printer's IP address, serial number, and access code, and set a username and password for the server.

**Run it with Docker (recommended):**

```bash
sudo docker compose up --build -d
```

This starts the server on port 5123 using HTTP only. Configuration files are mounted from the `configs/` folder and persist across container restarts. If you ever change a config, just run `sudo docker compose restart` to reload them. 

<details>
<summary>Running natively without Docker</summary>

```bash
cd bambu-server/
python3 -m pip install -r requirements.txt
openssl req -new -x509 -keyout key.pem -out server.pem -days 3650 -nodes
flask run --host=0.0.0.0 --port=5123
```
</details>

> [!WARNING]
> The frontend and backend must both use HTTP or both use HTTPS — mixing protocols will cause the browser to silently refuse communication.

> [!WARNING]
> HTTP-only mode should only be used for testing out the project, unless you fully trust the security of your local network. Any device on your network can passively sniff your server credentials in every request when you use HTTP instead of HTTPS. 

**HTTPS certificate options** (uncomment the appropriate `CMD` line in the Dockerfile):
- **HTTP only** *(lowest friction to get started)*: No certificate needed. Use with `http://qrspool.com` (no `s` before the `:`) for the frontend. Upgrade to one of the HTTPS options below once you've decided you want to keep using this project. Remember, HTTP exposes your credentials to anyone on the local network.
- **Real certificate via reverse proxy** *(recommended for continued use)*: Use a tool like [Caddy](https://caddyserver.com/) to add proper TLS. A free [DuckDNS](https://www.duckdns.org/) subdomain gets you a real domain name to attach a certificate to. Step-by-step instructions for this kind of setup are [included in the repo here.](bambu-server/REVERSE_PROXY.md)
- **Self-signed cert** *(only use for dev work)*: Works immediately, but requires a one-time browser exception confirmation on every browser restart, which is really annoying (see the frontend setup note below). Usable for development work, not recommend for long-term use. 

### Step 2: Connect the Frontend

The frontend is already hosted at [qrspool.com](https://qrspool.com) (available over both HTTP and HTTPS) so you don't need to do any setup for that part on your end!

1. Open **https://qrspool.com/settings.html** on your phone in Chrome (use **http://qrspool.com/settings.html** if your backend is HTTP-only)
2. Enter your backend server's URL (e.g. `https://192.168.1.100:5123`), username, and password
3. Tap **Save**, then **Validate** to confirm the connection works

> [!IMPORTANT]
> If your server uses a self-signed certificate, you'll need to open the server URL directly in your browser and accept the security warning. You may need to do this again each time your browser restarts. Using a real certificate with Caddy as described above avoids this nuisance entirely.

Go to the **Scan** tab and grant camera and/or NFC access as prompted. Now you're ready to go!

> [!TIP]
> Firefox and Safari also support QR scanning, but lack torch (flashlight) control, vibrate-on-scan, and NFC scanning. Chrome on Android is recommended for the full experience.

**Prefer to host the frontend yourself?** Serve the `client/` folder with any web server — for example, `python3 -m http.server` or the included `https-server.py` script. For fully offline use, download the Bootstrap and jsQR files referenced in each HTML file and update the references in the code to point to your local copies.

---

## Scanning and Applying Filament

From the **Scan** tab, point your camera at a filament or slot QR code. The page responds automatically when a tag is recognized.

**Two tag types, one workflow:**
- Scan a **filament tag** → goes to the Apply page showing filament info and available printer slots; tap any slot to apply
- Scan a **slot tag** → stores that slot as the target; the next filament scan (or a previously scanned one) applies immediately with no manual selection

Scanning both tag types in either order causes the filament to be applied to the slot automatically. If you'd prefer to confirm before applying, there's a setting for that on the Settings page.

---

## Creating Tags

### Filament QR Codes

Filament tags use a compact pipe-delimited format derived from [OpenSpool 1.0](https://openspool.io/rfid.html):

```
OS1.0|TYPE|COLOR_HEX|BRAND|MIN_TEMP|MAX_TEMP
```

Example:
```
OS1.0|PLA Matte|FF5733|Bambu|190|230
```

Fields are parsed left to right. You can omit fields from the right end, or leave individual fields empty, if you don't need them. `OS1.0` is the format identifier the scanner uses to recognize compatible codes.

> [!NOTE]
> For Bambu printers, `TYPE` and `BRAND` must exactly match a profile name from the Bambu Studio filament dropdown. See [Bambu Printer Notes](#bambu-printer-notes) for details and workarounds.

### Slot QR Codes

Slot tags identify a specific printer and/or AMS slot:

```
SLOT|IDS|PRINTER_NAME
```

Both `IDS` and `PRINTER_NAME` are optional, but at least one must be present for the tag to have any effect.

Full tag (slot + printer switch):
```
SLOT|{"amsID":0,"slotID":0}|My Printer
```

Slot only (no printer switch):
```
SLOT|{"amsID":0,"slotID":0}|
```

Printer switch only (no slot):
```
SLOT||My Printer
```

To find the correct `ids` value for a slot, open the Apply page and expand the "↓ Show/Hide All Slot Info ↓" section under any slot — tap the value to copy it. Don't try to guess slot IDs; they can change with firmware updates or AMS hardware changes.

If you have multiple printers configured, only one printer is "active" at a time, and switching printers takes a few seconds. For the fastest workflow, scan the filament tag first, then the slot tag.

### Printing Your Tags

[QR2STL](https://qrcode2stl.printer.tools/) generates printable 3D QR codes. A [self-hostable fork](https://github.com/Aptimex/qrcode2stl) (with ads and wait times removed) is also available. [Here's a JSON file](qr2stl.json) with good starting values that you can import into the site. 

Tips for reliable scanning:
- **30×30mm** with a 0.4mm nozzle works well; smaller dimensions need a 0.2mm nozzle
- Use the **Arachne** wall generation method
- Use the lowest error correction level, or else increase the tag size to compensate for a denser code

### Attaching Tags to Spools

A custom clip with multiple attachment options for filament spools [is available on MakerWorld](https://makerworld.com/en/models/1408538-filament-clip-for-qrspool-tags). It's designed for QR2STL models with a 5mm keychain hole.

### NFC Tags

**On Android with Chrome**, the Scan and Apply pages show a button to enable NFC scanning. Once enabled, tapping an NFC tag works just like scanning a QR code with the camera.

Supported NFC formats:
- Tags containing the same plain text as a QR code
- [OpenSpool](https://openspool.io/rfid.html#protocol) tags
- [OpenTag3D](https://opentag3d.info/spec) tags — see [OpenTag3D Field Length Limits](#opentag3d-field-length-limits) for important notes if you're using OpenTag3D with a Bambu printer

To write tags, use the [OpenTag3D Make tab](https://opentag3d.info/make), or a generic app like [NFC Tools](https://play.google.com/store/apps/details?id=com.wakdev.wdnfc) or [NFC TagWriter](https://play.google.com/store/apps/details?id=com.nxp.nfc.tagwriter).

**On iOS (and any phone without in-browser NFC):** Use URL-based NFC tags. A tag containing a URL like this will open the site with filament data pre-loaded when tapped:

```
https://qrspool.com?qrstring=OS1.0|PLA|FF5733|Bambu|190|230
```

You can even combine filament and slot data in a single URL to auto-apply on tap:

```
https://qrspool.com?qrstring=OS1.0|PLA|FF5733|Bambu|190|230&slotstring=SLOT|{"amsID":0,"slotID":1}|
```

> [!TIP]
> NFC tags support multiple NDEF records. Set the first to a URL (for native phone handling) and the second to a plain-text QR string, or one of the other supported formats. Most phone scans will only process the first record; qrspool.com will try all records, giving you compatibility with both approaches across all phones in one tag.

See [URL Parameters](#url-parameters) for additional supported URL formats.

---

## Bambu Printer Notes

**Filament code matching:** `BRAND` and `TYPE` in a tag must match a profile name from Bambu Studio exactly (e.g. `Bambu` + `PLA Matte`). The server combines them and looks up the internal code (e.g. `GFA01`) in `bambu-ams-codes.json`.

If an exact match fails, the server tries these fallbacks in order:
1. Replace the brand with `Generic` and search again
2. Treat the `TYPE` field directly as a filament code
3. If `BRAND` is `RAWCODE`, use `TYPE` as the code verbatim — useful for [custom AMS profiles](https://forum.bambulab.com/t/how-to-add-custom-filaments-so-you-can-select-them-in-the-ams/52140)

If all fallbacks fail, the server returns an error. In testing, unrecognized codes were silently ignored by the printer and never caused any problems.

**Temperature fields** are generally ignored by Bambu printers — the profile defaults are used instead. You can safely omit `MIN_TEMP` and `MAX_TEMP` from your tags.

**Empty slot limitation:** Currently-empty slots can't have their filament settings changed. Make sure filemant is loaded before trying to apply a tag to the slot. 

**Cloud-connected printers:** Slot data can be read, but applying filament changes will silently fail. LAN-only mode (LAN+DEV on newer printers/firmware) is required for writes.

**Tested hardware:** A1 (firmware 01.04.00.00) with AMS Lite (firmware 00.00.07.94). Should work with any printer and AMS supported by [bambulabs-api](https://pypi.org/project/bambulabs-api/).

**Experimental LAN+DEV support:** Only tested on a P2S. If you know of a Python library that has proper support for this mode let me know, the current support is fully custom and based on limited traffic analysis. 

---

## Technical Reference

This section covers implementation details for developers who want to build compatible servers or clients.

QRSpool's frontend and backend are intentionally decoupled: the frontend handles all QR/NFC parsing and generates standard REST requests; the backend translates those into whatever protocol a given printer needs. A server for a different printer brand could be built without changing the frontend at all.

### URL Parameters

The scan page accepts pre-loaded data via URL parameters, checked in this order:

| Parameter | Format |
|---|---|
| `?qrstring=X` | Same string as a filament QR code |
| `?osjson=X` | OpenSpool JSON string (no line breaks) |
| `?type=A&color_hex=B&brand=C&min_temp=D&max_temp=E` | Individual OpenSpool fields (`type` key required) |
| `?slotstring=X` | Same string as a slot QR code |

### OpenTag3D Field Length Limits

OpenTag3D limits the Material Name and Modifier fields to 5 characters, which many Bambu filament names exceed. Options when a value doesn't fit:

1. **Truncate to 5 characters** — works if only one possible expansion exists; the server returns an error if the truncation is ambiguous
2. **Use a recognized abbreviation** — e.g. `Supp` → `Support`, `HiSpd` → `High Speed`, `Tgh+` → `Tough+`; see `bambu-server/configs/type-abbreviations.json` and `modifier-abbreviations.json` for the full list, and add your own or submit a PR
3. **Use the Color Name field** — put the full name there and leave the dedicated fields blank; the server will attempt to match it
4. **Use RAWCODE** — set Name to `RAWCODE` and put the code from `bambu-ams-codes.json` in the Type field

### Backend Server API

Data in `<>` should be replaced with appropriate values; everything else is a literal string.

#### GET /serverStatus *(unauthenticated)*

Returns server status and authentication information. This is the endpoint hit when the user validates their server settings.

```json
{
    "status": "running",
    "authRequired": "<true|false>",
    "authCorrect": "<true|false>",
    "serverVersion": "<SemVer version string>"
}
```
- `authRequired`: whether other endpoints enforce Basic Auth. 
- `authCorrect`: whether the credentials in this request (optional here) are valid.
- `serverVersion`: allows the frontend to detect when the backend is outdated and alert the user, without requiring any network-based update checks. 

#### GET /printerStatus

On success:
```json
{
    "status": "<statusMessage>"
}
```

On connection failure:
```json
{
    "error": "<errorMessage>"
}
```

#### GET /slots

Returns available filament slots. `ids` and `displayID` are mandatory per slot; all others are optional.

```json
{
    "slots": [
        {
            "ids": { "<OPAQUE>": "<OPAQUE>" },
            "displayID": "<value>",
            "<dk1>": "<value>",
            "<dk2>": "<value>"
        }
    ],
    "displayKeys": ["<dk1>", "<dk2>"],
    "colorHexKeys": ["<dk2>"]
}
```

- `ids` — opaque object uniquely identifying the slot; the frontend echoes it back in `/setFilament` requests unchanged
- `displayID` — human-readable identifier that corresponds to physical markings on the printer
- `displayKeys` — important slot fields to display by default in the slot selection UI
- `colorHexKeys` — fields whose values are 6-digit hex color codes and should be rendered as colors in the UI

#### POST /setFilament

```json
{
    "ids": { "OPAQUE": "OPAQUE" },
    "type": "<value>",
    "colorHex": "<value>",
    "brand": "<value>",
    "minTemp": "<value>",
    "maxTemp": "<value>"
}
```

Field values may be empty strings if data was omitted from the scanned tag. The server must silently ignore unknown keys, and may support more than these. Recommended optional fields for maximum compatibility:

```json
{
    "colorName": "<value>",
    "bedTemp": "<value>"
}
```

#### GET /reconnect

Resets the connection between server and printer. No parameters. Intended as a quick-fix when things aren't working as expected.

### Backend Server Authentication

The server uses standard [HTTP Basic Authentication](https://en.wikipedia.org/wiki/Basic_access_authentication). All endpoints except `/serverStatus` require:

```
Authorization: Basic <base64(username:password)>
```

Credentials and settings are stored in the browser's `localStorage`, not cookies, to avoid accidental exposure to the frontend's website server.

Security levels by configuration:
- **HTTP only** — minimal protection; credentials can be passively sniffed on the local network
- **HTTPS with self-signed cert** — moderate protection
- **HTTPS with real cert** — best protection

In all cases the server is vulnerable to brute-force authentication attacks; so use a strong password and don't expose the server to the Internet.

### 3rd Party Dependencies

- [jsQR](https://github.com/cozmo/jsQR) — QR code decoding from the camera feed (frontend)
- [Bootstrap](https://getbootstrap.com/) — UI framework (frontend)
- [bambulabs-api](https://pypi.org/project/bambulabs-api/) ≥2.6.2 — Bambu printer communication (backend) for LAN-only printers
