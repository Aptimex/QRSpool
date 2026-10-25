# Server configuration

Copy `bambu_config.example.json` to `bambu_config.json` and edit it. Here's a minimal example of what should be in it:

```json
{
  "auth_user": "",
  "auth_pass": "",
  "printers": [
    {
      "name": "My Printer",
      "ip": "192.168.1.100",
      "serial": "0123456789ABCDE",
      "access_code": "98765432"
    }
  ]
}
```

The tables below list every setting the server understands. Any unrecognized keys will generate an error and cause the server to fail to start.

If you want to add comments to the config that the parser will ignore, use a key beginning with `_`, or `comment`/`note`:

```json
{
  "_comment": "Located in the garage",
  "printers": [ ... ]
}
```

## Top-level settings

| Key | Required | Default | Purpose |
|---|---|---|---|
| `printers` | yes | — | List of printer entries. Detailed in the next section. |
| `auth_user` / `auth_pass` | yes | `""` | Credentials required to interact with this server's interface. |
| `inactivity_timeout` | no | `300` | Seconds of inactivity before the server drops its printer connection. `0` disables it. |
| `key_pem_file`<br>`cert_chain_pem_file`<br>`crl_pem_file` | no | — | Signing credentials, as paths relative to `bambu-server/`. See the `Command signing` section of the main README |

## Per-printer settings

| Key | Required | Default | Purpose |
|---|---|---|---|
| `name` | recommended | the printer's IP | Display name. Must be unique within the config file. |
| `ip` | yes | — | The printer's local IP address. |
| `serial` | yes | — | The printer's serial number. |
| `access_code` | yes | — | Access code from the printer's screen, under *Settings → LAN Only*. |
| `backend` | no | `"custom"` | Which library to use for printer communication. See [Backends](#backends). |
| `model_id` | no | queried at connect | Printer model id, e.g. `N2S` for an A1. See the mapping table below. |
| `firmware_version` | no | queried at connect | e.g. `01.05.00.00`. Check *Settings → Device → Firmware* on the printer. |
| `overwrite_auto_filament` | no | `false` | Allow writes to AMS slots whose filament the AMS already identified from an official Bambu RFID tag. |

Leaving `model_id` and `firmware_version` out is usually fine, the server will attempt to auto-detect these when it connects to the printer. Auto-detect hasn't been extensively tested though, so explicitly set them if you want to be safe.

Here's a list of valid `model_id` values associated with each printer name:

| Printer | Model ID | | Printer | Model ID |
|---|---|---|---|---|
| X1 Carbon | BL-P001 | | A1 | N2S |
| X1 | BL-P002 | | A2L | N9 |
| X1E | C13 | | H2C | O1C |
| X2D | N6 | | H2C | O1C2 |
| P1P | C11 | | H2D | O1D |
| P1S | C12 | | H2D Pro | O1E |
| P2S | N7 | | H2S | O1S |
| A1 mini | N1 | | | |

For convenience, supplying one these exact printer names instead of an ID is also supported. The H2C is the one exception: it ships as two model IDs with different capabilities, so the name `H2C` is rejected as ambiguous. Use `O1C` or `O1C2`. Note that name and ID values are both are matched case-insensitively.

This table is maintained in the [bambu-mqtt-generator](https://github.com/Aptimex/bambu-mqtt-generator) library, which is where these IDs come from; check there for possible updates if a newer printer is missing here.

## Backends

Two backends are available for server-to-printer communication:

- `"custom"` *(default)*: [bambu-mqtt-comms](https://github.com/Aptimex/bambu-mqtt-comms) + [bambu-mqtt-generator](https://github.com/Aptimex/bambu-mqtt-generator), both written specifically for this project based on Bambu Studio source code. Supports modern firmware, tailors each message to your printer model and firmware version, and enables command signing with some extra manual setup.
- `"bambulabs_api"`: The third-party [bambulabs_api](https://github.com/BambuTools/bambulabs_api) library. It is slow to incorporate updates for newer printers and firmwares, and has no support for command signing. May be more reliable for pre-2025 printer firmwares. Will likely be removed in the future.

Each printer can have its backend selected independent of other printers.

## Command signing

Firmware from roughly January 2025 onward rejects filament writes when the printer that is **not** in LAN + Developer mode. The server auto-detects this, per printer, during the initial connection.

**If your printer is in LAN + Developer mode**: signing is not enforced and you can ignore this section entirely. This mode is Bambu's only officially-supported 3rd-party integration option, and it disables all cloud features.

If you want to use this project while your printer is in any other mode, you need to obtain and provide valid files used for signing. See the Command Signing section of the main project README for more information. Most users should just stick with LAN+DEV mode.
