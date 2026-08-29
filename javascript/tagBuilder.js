/*
Page logic for tag.html: turns the two forms into filament and slot tags, renders
the copyable outputs, and writes those tags over NFC.
*/

const el = (sel) => document.querySelector(sel);

// Timers that blank out the transient "saved" messages, keyed by their element
const msgTimers = new Map();

function showTimedMsg(selector, html) {
    let msg = el(selector);
    msg.innerHTML = html;
    clearTimeout(msgTimers.get(selector));
    msgTimers.set(selector, setTimeout(() => { msg.innerHTML = ""; }, 8000));
}

// ----- Form <-> tag -----

// Build a tag from the current form values
function formTag() {
    return new FilamentOpenSpool(
        el("#tagType").value.trim(),
        FilamentOpenSpool.normalizeColorHex(el("#colorHex").value),
        el("#brand").value.trim(),
        el("#minTemp").value.trim(),
        el("#maxTemp").value.trim()
    );
}

function fillForm(tag) {
    el("#tagType").value = tag.type ?? "";
    el("#colorHex").value = FilamentOpenSpool.normalizeColorHex(tag.colorHex);
    el("#brand").value = tag.brand ?? "";
    el("#minTemp").value = tag.minTemp ?? "";
    el("#maxTemp").value = tag.maxTemp ?? "";
    syncColorPickr();
    refresh();
}

function fillDefaultLabel() {
    el("#label").value = formTag().defaultLabel();
    refresh();
}

function clearBuilder() {
    el("#tagType").value = "";
    el("#colorHex").value = "";
    el("#brand").value = "";
    el("#minTemp").value = "";
    el("#maxTemp").value = "";
    el("#label").value = "";
    refresh();
}

// Load whatever tag was last scanned/saved. Only complains about a missing
// tag when the user explicitly asked for it.
function loadActiveTag(explicit=false) {
    if (getActiveTagData() == null) {
        if (explicit) showTimedMsg("#saveMsg", "No active tag saved yet. Scan one, or build one here.");
        return;
    }
    let tag = parseActiveTag(); // writes to #error if it can't be parsed
    if (tag == null) return;
    fillForm(tag);
    if (explicit) showTimedMsg("#saveMsg", "Loaded the active tag.");
}

function saveActiveTag() {
    activateTag(formTag());
    showTimedMsg("#saveMsg", 'Saved as the active tag. <a href="apply.html">Go to the Apply page</a> to write it to a slot.');
}

// ----- Color picker -----
// https://github.com/simonwep/pickr

const colorPickr = Pickr.create({
    el: "#colorPickerBtn",
    theme: "monolith",
    default: "#1E8440",
    swatches: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#8F00FF", "#FF69B4", "#000000", "#FFFFFF", "#8B4513"],
    components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
            input: true,
            save: true
        }
    }
});

colorPickr.on("save", (color, instance) => {
    // Only commit to the hex field once the user confirms with Save, not on every
    // drag/hover change within the popup
    if (color) {
        el("#colorHex").value = color.toHEXA().toString().replace("#", "");
        refresh();
    }
    instance.hide();
}).on("init", () => {
    // Pickr finishes setting up (and applies its own default color) asynchronously,
    // after this script runs. Re-sync once it's ready so a tag loaded on page init
    // (see loadActiveTag() below) isn't clobbered by that default.
    syncColorPickr();
});

function syncColorPickr() {
    // Only follow complete values, so the swatch doesn't jump around mid-typing
    let hex = el("#colorHex").value.trim().replace(/^#/, "");
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return;

    colorPickr.setColor("#" + hex, true);
    // setColor's "silent" flag skips applyColor(), which is what actually paints
    // the swatch button's background, so it has to be called separately here.
    colorPickr.applyColor(true);
}

function onColorTextInput() {
    // Tolerate a pasted leading "#", but keep it out of the field itself
    let field = el("#colorHex");
    if (field.value.startsWith("#")) field.value = field.value.slice(1);
    syncColorPickr();
    refresh();
}

// ----- Outputs -----

function refresh() {
    let tag = formTag();
    let label = el("#label").value.trim();

    el("#QR-string").innerText = tag.toQRString();
    el("#OS-JSON").innerText = tag.toOpenSpoolJSON();
    el("#QRSpool-URL").innerText = tag.toQRSpoolURL();
    el("#STL-JSON").innerText = tag.toQR2STLJSON(label);

    updateNFCSize("filament");
    // A combined slot tag embeds the filament data, so it changes too
    if (el("#slot-nfc-combine").checked) refreshSlot();
}

function toClipboard(selector, btn) {
    copyToClipboard(el(selector).innerText, btn);
}

// ----- Slot tag -----

// displayID of the slot chosen from the picker, used for the default label.
// Cleared when the IDs are edited by hand, since it no longer describes them.
let pickedSlotDisplayID = null;

// Parsed contents of the Slot IDs field: {ids: <object|null>, error: <bool>}
function parseSlotIDs() {
    let text = el("#slotIDs").value.trim();
    if (text === "") return { ids: null, error: false };
    try {
        let ids = JSON.parse(text);
        if (ids === null || typeof ids !== "object" || Array.isArray(ids)) {
            return { ids: null, error: true };
        }
        return { ids: ids, error: false };
    } catch (e) {
        return { ids: null, error: true };
    }
}

function slotFormTag() {
    return new SlotTag(parseSlotIDs().ids, el("#slotPrinter").value.trim(), pickedSlotDisplayID);
}

function onSlotPicked() {
    let opt = el("#slotPicker").selectedOptions[0];
    if (opt && opt.value !== "") {
        el("#slotIDs").value = opt.value;
        pickedSlotDisplayID = opt.dataset.displayID;
    } else {
        el("#slotIDs").value = "";
        pickedSlotDisplayID = null;
    }
    refreshSlot();
}

function onSlotIDsInput() {
    // Keep the picker in sync if the text happens to match one of its options
    let match = [...el("#slotPicker").options].find(o => o.value !== "" && o.value === el("#slotIDs").value.trim());
    el("#slotPicker").value = match ? match.value : "";
    pickedSlotDisplayID = match ? match.dataset.displayID : null;
    refreshSlot();
}

function fillDefaultSlotLabel() {
    el("#slotLabel").value = slotFormTag().defaultLabel();
    refreshSlot();
}

function clearSlotBuilder() {
    el("#slotPrinter").value = "";
    el("#slotIDs").value = "";
    el("#slotPicker").value = "";
    el("#slotLabel").value = "";
    pickedSlotDisplayID = null;
    refreshSlot();
}

function saveActiveSlot() {
    let parsed = parseSlotIDs();
    if (parsed.ids == null) {
        showTimedMsg("#slotSaveMsg", "Enter or pick a slot ID first.");
        return;
    }
    setActiveSlotIDs(JSON.stringify(parsed.ids));
    showTimedMsg("#slotSaveMsg", 'Saved as the active slot. <a href="apply.html">Go to the Apply page</a> to use it.');
}

// Populate the slot and printer pickers from the configured backend. Everything
// stays usable without a server; the IDs just have to be pasted in by hand.
async function loadSlotOptions() {
    let status = el("#slotPickerStatus");
    if (!getServerURL()) {
        status.innerText = "No backend server configured, so slots can't be listed. Enter the IDs by hand below.";
        return;
    }

    status.innerText = "Loading slots from the active printer...";
    const [slotsResp, printersResp, activeResp] = await Promise.all([
        getSlots(), getPrinters(), getActivePrinter()
    ]);

    if (!printersResp.error && Array.isArray(printersResp)) {
        let list = el("#printerNames");
        printersResp.forEach(name => {
            let opt = document.createElement("option");
            opt.value = name;
            list.appendChild(opt);
        });
    }

    if (slotsResp.error) {
        status.innerText = "Couldn't load slots: " + slotsResp.error;
        return;
    }

    let picker = el("#slotPicker");
    (slotsResp.slots || []).forEach(slot => {
        let opt = document.createElement("option");
        opt.value = JSON.stringify(slot.ids);
        opt.dataset.displayID = slot.displayID;
        opt.textContent = slot.displayID;
        picker.appendChild(opt);
    });

    // Slots are only ever reported for the active printer, so building tags for
    // a different one means switching first (which takes a few seconds).
    let activeName = activeResp.error ? null : activeResp.name;
    status.innerText = activeName
        ? `Showing slots for "${activeName}". To build tags for another printer, switch to it on the Settings page.`
        : "Showing slots for the active printer.";

    // Effectively required for multi-printer setups, so pre-fill it rather than
    // leaving it to default to "whichever printer is active" at scan time.
    let printerField = el("#slotPrinter");
    if (activeName && !printerField.value.trim()) {
        printerField.value = activeName;
        refreshSlot();
    }
}

function refreshSlot() {
    let parsed = parseSlotIDs();
    el("#slotIDsError").innerText = parsed.error
        ? "Not valid JSON. Paste the value exactly as copied from the Apply page."
        : "";

    let tag = slotFormTag();
    // Bad JSON must block the tag rather than quietly degrading to a
    // printer-only one, which isn't what the user asked for
    let usable = tag.isUsable() && !parsed.error;
    let label = el("#slotLabel").value.trim();

    if (usable) {
        el("#SLOT-string").innerText = tag.toQRString();
        el("#SLOT-URL").innerText = tag.toQRSpoolURL();
        el("#SLOT-STL-JSON").innerText = tag.toQR2STLJSON(label);
    } else {
        let hint = parsed.error
            ? "Fix the slot IDs above."
            : "Pick a slot or enter a printer name above.";
        el("#SLOT-string").innerText = hint;
        el("#SLOT-URL").innerText = hint;
        el("#SLOT-STL-JSON").innerText = hint;
    }

    let combine = el("#slot-nfc-combine").checked;
    el("#slot-combined-url-wrap").hidden = !combine;
    if (combine) {
        el("#SLOT-combined-URL").innerText = usable
            ? qrspoolURL(formTag(), tag)
            : "Pick a slot or enter a printer name above.";
    }

    updateNFCSize("slot");
}

// ----- NFC writing -----

function nfcSupported() {
    return ("NDEFReader" in window);
}

// Each writable section of the page maps to its own controls and record set
const nfcSections = {
    filament: {
        size: "#nfc-size", status: "#nfc-write-status",
        write: "#btn-write-nfc", cancel: "#btn-cancel-nfc",
        records: buildFilamentRecords
    },
    slot: {
        size: "#slot-nfc-size", status: "#slot-nfc-write-status",
        write: "#btn-write-slot-nfc", cancel: "#btn-cancel-slot-nfc",
        records: buildSlotRecords
    }
};

function buildFilamentRecords() {
    let tag = formTag();
    let records = [];
    // Order matters: most phones only act on the first record when the tag is
    // tapped outside of QRSpool, so the URL goes first.
    if (el("#nfc-url").checked) {
        records.push({ recordType: "url", data: tag.toQRSpoolURL() });
    }
    if (el("#nfc-os1").checked) {
        records.push({ recordType: "text", data: tag.toQRString() });
    }
    if (el("#nfc-osjson").checked) {
        records.push({
            recordType: "mime",
            mediaType: "application/json",
            data: new TextEncoder().encode(tag.toOpenSpoolJSON())
        });
    }
    return records;
}

function buildSlotRecords() {
    let slotTag = slotFormTag();
    if (!slotTag.isUsable() || parseSlotIDs().error) return [];

    let combine = el("#slot-nfc-combine").checked;
    let filamentTag = combine ? formTag() : null;
    let records = [];

    if (el("#slot-nfc-url").checked) {
        records.push({ recordType: "url", data: qrspoolURL(filamentTag, slotTag) });
    }
    if (el("#slot-nfc-text").checked) {
        // Filament first, matching the order the scanner applies a pair in
        if (filamentTag != null) {
            records.push({ recordType: "text", data: filamentTag.toQRString() });
        }
        records.push({ recordType: "text", data: slotTag.toQRString() });
    }
    return records;
}

// Rough NDEF message size, to compare against a tag's capacity before writing
function estimateNFCSize(records) {
    const utf8Len = (s) => new TextEncoder().encode(s).length;
    let total = 2; // TLV header + terminator
    for (const r of records) {
        let payload, typeLen;
        if (r.recordType === "url") {
            typeLen = 1;
            // A known scheme prefix is stored as a single identifier byte
            let prefix = ["https://www.", "http://www.", "https://", "http://"].find(p => r.data.startsWith(p)) || "";
            payload = 1 + utf8Len(r.data) - prefix.length;
        } else if (r.recordType === "text") {
            typeLen = 1;
            payload = 3 + utf8Len(r.data); // status byte + 2-char language code
        } else {
            typeLen = utf8Len(r.mediaType);
            payload = r.data.length;
        }
        total += 3 + typeLen + payload + (payload > 255 ? 3 : 0);
    }
    return total;
}

function updateNFCSize(section) {
    let records = nfcSections[section].records();
    let sizeEl = el(nfcSections[section].size);
    if (records.length === 0) {
        sizeEl.innerText = "Nothing to write yet.";
        sizeEl.className = "form-text mt-2 text-danger";
        return;
    }

    let bytes = estimateNFCSize(records);
    let fits = bytes <= 144 ? "fits an NTAG213 (144 bytes)"
        : bytes <= 504 ? "too big for an NTAG213 (144 bytes), fits an NTAG215 (504 bytes)"
        : bytes <= 888 ? "needs an NTAG216 (888 bytes) or larger"
        : "larger than an NTAG216 (888 bytes); deselect a record type or shorten the fields";

    sizeEl.innerText = `${records.length} record${records.length > 1 ? "s" : ""}, roughly ${bytes} bytes: ${fits}.`;
    sizeEl.className = "form-text mt-2" + (bytes > 504 ? " text-danger" : "");
}

function setNFCStatus(section, text, cls="") {
    let s = el(nfcSections[section].status);
    s.innerText = text;
    s.className = "mt-2 " + cls;
}

// Only one write can be pending at a time, so both sections share the controller
var nfcWriteAbort = null;

function setWriteBusy(busy, activeSection=null) {
    for (const [name, s] of Object.entries(nfcSections)) {
        el(s.write).disabled = busy || !nfcSupported();
        el(s.cancel).hidden = !(busy && name === activeSection);
    }
}

async function writeNFC(section) {
    if (!nfcSupported() || nfcWriteAbort != null) return;

    let records = nfcSections[section].records();
    if (records.length === 0) {
        setNFCStatus(section, "Nothing to write. Fill in the fields and select a record type.", "text-danger");
        return;
    }

    nfcWriteAbort = new AbortController();
    setWriteBusy(true, section);
    setNFCStatus(section, "Hold an NFC tag against your phone...", "pulsing-text");

    try {
        const ndef = new NDEFReader();
        await ndef.write({ records: records }, { overwrite: true, signal: nfcWriteAbort.signal });
        setNFCStatus(section, "Tag written successfully.", "text-success");
        if (navigator.vibrate) navigator.vibrate([80, 50, 80]);

    } catch (error) {
        if (error.name === "AbortError") {
            setNFCStatus(section, "Write cancelled.");
        } else {
            console.log(error);
            setNFCStatus(section, "Write failed: " + error, "text-danger");
        }

    } finally {
        nfcWriteAbort = null;
        setWriteBusy(false);
    }
}

function cancelNFCWrite() {
    if (nfcWriteAbort != null) nfcWriteAbort.abort();
}

function checkNFCSupport() {
    if (nfcSupported()) return;

    let warning = el("#nfc-unsupported");
    warning.innerText = window.isSecureContext
        ? "Your browser doesn't support Web NFC, so tags can't be written here. Web NFC is currently only available in Chrome on Android; use an app like NFC Tools to manually write this data to a tag."
        : "Web NFC requires HTTPS. Load this page over HTTPS (or on localhost) in Chrome on Android to write tags directly.";
    warning.hidden = false;
    setWriteBusy(false);
}

// ----- Advanced settings -----

function onTargetDomainInput() {
    setQrspoolBaseURLOverride(el("#targetDomain").value.trim());
    refresh();
    refreshSlot();
}

// ----- Init -----

checkNFCSupport();
loadActiveTag();
el("#targetDomain").value = qrspoolBaseURL();
refresh();
refreshSlot();
loadSlotOptions();
