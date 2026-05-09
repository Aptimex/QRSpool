# Filament Spool Schema Changes: N2S/P1S (old) → P2S (new)

Note: This analysis was performed by Claude and not all manually validated. But it was succesfully used to implement initial working support for the new LAN+DEV mode, so is probably largely correct. 

---

This document covers only the filament-related fields in `pushall` / `push_status` responses.
"Old" = ~~N2S/P1S~~ (actually A1) firmware ~01.04.x. "New" = P2S firmware ~01.02.x (higher model generation despite lower version number).

## 1. External spool — complete breaking change

This is the most impactful difference. Everything about the external spool changed.

### Key renamed: `vt_tray` → `vir_slot`

Old path: `print.vt_tray` (object)
New path: `print.vir_slot` (array)

The type changed from a single object to an array. Access the spool as `vir_slot[0]`.

### Field differences on the external spool object

| Field | Old (`vt_tray`) | New (`vir_slot[0]`) | Notes |
|---|---|---|---|
| `id` | `"254"` | `"255"` | ID value changed |
| `k` | `0.02` (float) | absent | Pressure advance K moved; see §4 |
| `n` | `1` (int) | absent | Pressure advance N; see §4 |
| `tray_temp` | `"0"` (string) | absent | Removed |
| `tray_time` | `"0"` (string) | absent | Removed |
| `cols` | absent | `["DCF478FF"]` (string array) | Color list; same format as AMS trays |
| `ctype` | absent | `2` (int) | Filament category type |
| `drying_temp` | absent | `"0"` (string) | Recommended drying temp in °C |
| `drying_time` | absent | `"0"` (string) | Recommended drying time in hours |
| `total_len` | absent | `330000` (int) | Total spool length in mm (330 m) |

Fields present and unchanged in both: `bed_temp`, `bed_temp_type`, `cali_idx`, `nozzle_temp_max`,
`nozzle_temp_min`, `remain`, `tag_uid`, `tray_color`, `tray_diameter`, `tray_id_name`,
`tray_info_idx`, `tray_sub_brands`, `tray_type`, `tray_uuid`, `tray_weight`, `xcam_info`.

### Detection

Use the presence of `vir_slot` vs `vt_tray` as the format discriminator:

```python
if "vir_slot" in print_data:
    ext_spool = print_data["vir_slot"][0]   # new format
else:
    ext_spool = print_data["vt_tray"]       # old format
```

---

## 2. AMS tray fields

Both formats use the same path: `print.ams.ams[N].tray[N]`.

### Fields removed in the new format (present in old, absent in new)

| Field | Old type | Notes |
|---|---|---|
| `k` | float | Per-tray pressure advance K value. Moved; see §4 |
| `n` | int | Per-tray pressure advance N value. Moved; see §4 |
| `tray_temp` | string | Removed |
| `tray_time` | string | Removed |

### Fields added in the new format (absent in old, present in new)

| Field | New type | Notes |
|---|---|---|
| `state` | int | Tray slot state. Observed values: `11` = filament loaded, `26` = empty/no spool. New format uses sparse objects for absent trays (see §2a) |
| `total_len` | int | Total spool filament length in mm. `330000` = 330 m spool |
| `drying_temp` | string | Manufacturer-recommended drying temperature in °C |
| `drying_time` | string | Manufacturer-recommended drying time in hours |

### Fields present and unchanged in both formats

`bed_temp`, `bed_temp_type`, `cali_idx`, `cols`, `ctype`, `id`, `nozzle_temp_max`,
`nozzle_temp_min`, `remain`, `tag_uid`, `tray_color`, `tray_diameter`, `tray_id_name`,
`tray_info_idx`, `tray_sub_brands`, `tray_type`, `tray_uuid`, `tray_weight`, `xcam_info`.

### `remain` value semantics change

In the old format `remain` is a percentage integer (0–100).
In the new format `remain` is `-1` when the value is unknown/not tracked by the sensor. Do not
treat `-1` as 0% — treat it as "no data".

### 2a. Sparse tray objects in the new format

In the old format every tray slot is fully populated regardless of whether filament is loaded.
In the new format an empty slot may be represented with only `id` and `state`:

```json
{ "id": "2", "state": 26 }
```

Guard all tray field reads with `.get()` or equivalent null checks when handling the new format.

---

## 3. AMS unit fields

Both formats use the same path: `print.ams.ams[N]`.

### Fields added in the new format

| Field | Type | Notes |
|---|---|---|
| `dry_setting` | object | Active drying configuration. `-1` means not set. Sub-fields: `dry_duration` (int, minutes), `dry_filament` (string, filament type being dried), `dry_temperature` (int, °C) |
| `dry_sf_reason` | array | Reasons the safe-drying policy was applied. Empty array when not active |
| `dry_time` | int | Elapsed drying time in seconds. `0` when not drying |
| `humidity_raw` | string | Raw humidity sensor reading as a percentage string (e.g. `"31"` = 31%). The existing `humidity` field remains but is an index (1–5) |
| `info` | string | Opaque hex status bitmask (e.g. `"10001003"`). Not documented; do not parse |

### Fields present and unchanged in both formats

`humidity` (index string 1–5), `id`, `temp`, `tray`.

---

## 4. Pressure advance K/N values

In the old format K and N are stored **per tray** (both on AMS trays and `vt_tray`).

In the new format these fields are absent from all tray objects. The new format exposes a single
top-level `k` field on `print` (e.g. `print.k = "0.0200"`) representing the currently active K
value. Per-tray K values are not present in the `pushall` response in the new format.

---

## 5. AMS container-level fields

Path: `print.ams` (the outer object, not the `ams[]` array).

### Fields added in the new format

| Field | Type | Notes |
|---|---|---|
| `ams_exist_bits_raw` | string | Raw bitmask before filtering, alongside the existing `ams_exist_bits` |
| `cali_id` | int | ID of the active AMS calibration profile. `255` = none |
| `cali_stat` | int | Calibration status code |
| `cfs` | int array | Slot indices available for color/filament selection (e.g. `[2, 5, 6, 7]`) |
| `tray_hall_out_bits` | string | Bitmask of hall-effect (magnetic) sensor readings per slot |
| `unbind_ams_stat` | int | AMS unbind operation status. `0` = idle |

### Fields present and unchanged in both formats

`ams_exist_bits`, `insert_flag`, `power_on_flag`, `tray_exist_bits`, `tray_is_bbl_bits`,
`tray_now`, `tray_pre`, `tray_read_done_bits`, `tray_reading_bits`, `tray_tar`, `version`.

---

## Summary checklist for updating a parser

1. **Detect format**: check for `vir_slot` (new) vs `vt_tray` (old) in the `print` object.
2. **External spool**: read from `vir_slot[0]` instead of `vt_tray`; update the expected `id` from `"254"` to `"255"`; drop reads of `k`, `n`, `tray_temp`, `tray_time`; add reads for `cols`, `ctype`, `drying_temp`, `drying_time`, `total_len`.
3. **AMS trays**: drop reads of `k`, `n`, `tray_temp`, `tray_time`; add reads for `state`, `total_len`, `drying_temp`, `drying_time`; guard all field access with null checks (sparse objects); treat `remain == -1` as unknown, not 0%.
4. **AMS units**: add optional reads for `dry_setting`, `dry_time`, `humidity_raw`.
5. **Pressure advance**: if K is needed, read `print.k` (single active value) instead of per-tray `k`/`n`.
