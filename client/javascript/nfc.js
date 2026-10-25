
// Redirect console output to window
/*
(function() {
  const oldLog = console.log;
  const logElementId = 'console-output';

  console.log = function(message) {
    oldLog.apply(console, arguments);

    let logElement = document.getElementById(logElementId);
    if (!logElement) {
      logElement = document.createElement('div');
      logElement.id = logElementId;
      document.body.appendChild(logElement);
    }

    const p = document.createElement('p');
    p.textContent = message;
    logElement.appendChild(p);
  };
})();
*/

// Returns {type: 'filament'|'slot', tag: <object>} or null
function parseNFCData(data) {
    var fosTag = FilamentOpenSpool.newEmpty();
    if (fosTag.parseDataString(data)) {
        return {type: 'filament', tag: fosTag};
    }

    var slotTag = SlotTag.tryParse(data);
    if (slotTag != null) {
        return {type: 'slot', tag: slotTag};
    }

    console.log("Error parsing NFC tag data");
    return null;
}

// Pull filament/slot data out of a qrspool.com-style URL, if it has any. Lets
// multi-record tags (URL record first, for native phone handling) be read here too.
// A combined URL carries both halves of a pair, so this returns a list; filament
// data comes first so it's stored before the slot half triggers an apply.
function nfcDataFromURL(url) {
    try {
        const params = new URL(url).searchParams;
        return [
            params.get('qrstring') ?? params.get('osjson'),
            params.get('slotstring')
        ].filter(d => d != null);
    } catch (e) {
        return [];
    }
}

// Handle a decoded text payload from an NFC tag. Used for plain "text" records
// (QR-style strings), OpenSpool "application/json" records, and URL records.
// Returns the kind of data applied ('filament' or 'slot'), or null if nothing was.
// Kinds already present in `applied` are skipped, so a tag that repeats the same
// data in several formats doesn't get processed more than once.
function handleNFCTextData(data, applied=null) {
    var result = parseNFCData(data);
    if (result == null) {
        console.log("Error parsing NFC tag data");
        nfcError("NFC Error: Unrecognized tag format");
        return null;
    }

    if (applied != null && applied.has(result.type)) {
        console.log("Ignoring duplicate " + result.type + " record");
        return null;
    }

    if (result.type === 'filament') {
        console.log("Activating filament tag");
        activateTag(result.tag);
        if (typeof scanState !== 'undefined') { scanState.filamentScanned = true; }
        const filamentPairComplete = getActiveSlotIDs() != null;

        if (typeof onNFCTagScanned === 'function') {
            navigator.vibrate(filamentPairComplete ? [80, 50, 80] : 100);
            if (typeof playScanSound === 'function') playScanSound(filamentPairComplete);
            onNFCTagScanned('filament', result.tag);

        } else if (filamentPairComplete || getAlwaysJumpToApply()) {
            navigator.vibrate([80, 50, 80]);
            if (typeof playScanSound === 'function') playScanSound(true);
            setTimeout(() => { window.location.href = "apply.html"; }, 300);

        } else {
            navigator.vibrate(100);
            if (typeof playScanSound === 'function') playScanSound(false);
            if (typeof updateScanStatus === 'function') updateScanStatus();
        }

    } else if (result.type === 'slot') {
        console.log("Activating slot tag");
        if (result.tag.ids != null) {
            setActiveSlotIDs(JSON.stringify(result.tag.ids));
            if (typeof scanState !== 'undefined') { scanState.slotScanned = true; }
        }
        const filamentReady = getActiveTagData() != null;
        const slotReady = getActiveSlotIDs() != null;
        const pairComplete = filamentReady && slotReady;
        navigator.vibrate(pairComplete ? [80, 50, 80] : 100);
        if (typeof playScanSound === 'function') playScanSound(pairComplete);

        if (result.tag.printer_name != null && result.tag.printer_name !== getActivePrinterName()) {
            setActivePrinter(result.tag.printer_name).then(switchResult => {
                if (typeof onNFCTagScanned === 'function') {
                    onNFCTagScanned('slot', result.tag, switchResult);
                } else {
                    const statusEl = document.querySelector("#nfc-status");
                    if (switchResult.error) {
                        if (statusEl) {
                            statusEl.innerText = "Error switching printer: " + switchResult.error;
                            statusEl.style.color = "red";
                        }
                    } else {
                        setActivePrinterName(switchResult.name);
                        if (pairComplete) {
                            setTimeout(() => { window.location.href = "apply.html"; }, 300);
                        } else {
                            if (statusEl) {
                                const nextStep = filamentReady ? "" : " Scan a filament tag.";
                                statusEl.innerText = "Printer \"" + switchResult.name + "\" selected." + nextStep;
                                statusEl.style.color = "green";
                            }
                        }
                    }
                }
            });
        } else if (typeof onNFCTagScanned === 'function') {
            onNFCTagScanned('slot', result.tag);
        } else if (pairComplete) {
            setTimeout(() => { window.location.href = "apply.html"; }, 300);
        } else {
            if (typeof updateScanStatus === 'function') updateScanStatus();
        }
    }

    return result.type;
}

// Enables fully disabling NFC during cooldowns between tag reads
var nfcAbortController = null;

function readNFC() {
    if (!('NDEFReader' in window)) {
        onnfcDisabled("");
        document.querySelector("#nfc-status").hidden = true;
        document.querySelector("#btn-enable-nfc").hidden = true;
        console.log("NFC not supported by your browser; it currently is only available on Chrome for Android.")
        return null;
    }

    startNFCScan();
}

function startNFCScan() {
    nfcAbortController = new AbortController();
    const ndef = new NDEFReader();
    ndef.scan({ signal: nfcAbortController.signal }).then(() => {
        onNfcEnabled();
        ndef.onreadingerror = () => {
            console.log("Error reading the NFC tag. Try another one?");
        };
        ndef.onreading = event => {
            nfcAbortController.abort();
            nfcAbortController = null;
            nfcCooldown();
            console.log("NDEF message read.");
            const message = event.message;
            if (message.records.length === 0) {
                nfcError("NFC Error: Tag is blank");
            }
            // A tag can hold the same data in several formats (e.g. a URL record for
            // native phone handling followed by a plain text record), and can also
            // carry a filament/slot pair. Track which kinds have been applied so
            // repeats are ignored but both halves of a pair still get through.
            let applied = new Set();
            const apply = (data) => {
                let kind = handleNFCTextData(data, applied);
                if (kind) applied.add(kind);
            };

            for (const record of message.records) {
                switch (record.recordType) {
                case "text": {
                    console.log("Parsing text record");
                    const textDecoder = new TextDecoder(record.encoding);
                    apply(textDecoder.decode(record.data));
                    break;
                }

                case "url":
                case "absolute-url": {
                    console.log("Parsing URL record");
                    const url = new TextDecoder().decode(record.data);
                    const urlData = nfcDataFromURL(url);
                    if (urlData.length === 0) {
                        // Not one of ours; a later record may still be usable
                        console.log("No filament/slot data in URL record: " + url);
                        break;
                    }
                    urlData.forEach(apply);
                    break;
                }

                case "mime": {
                    // OpenSpool tags store their JSON in an application/json record
                    if (record.mediaType === "application/json") {
                        console.log("Parsing OpenSpool JSON record");
                        apply(new TextDecoder().decode(record.data));
                        break;
                    }

                    if (record.mediaType !== FilamentOpenTag.mimeType) {
                        console.log("Unsupported MIME type: " + record.mediaType);
                        nfcError("NFC Error: Unsupported MIME type");
                        break;
                    }
                    console.log("Parsing OpenTag3D record");
                    let fotTag = FilamentOpenTag.tryParse(record.data);
                    if (fotTag == null) {
                        console.log("Error parsing OpenTag3D tag data");
                        nfcError("NFC Error: Unrecognized tag format");
                        break;
                    }
                    activateTag(fotTag);
                    applied.add('filament');
                    if (typeof scanState !== 'undefined') { scanState.filamentScanned = true; }
                    const mimePairComplete = getActiveSlotIDs() != null;

                    if (typeof onNFCTagScanned === 'function') {
                        navigator.vibrate(mimePairComplete ? [80, 50, 80] : 100);
                        if (typeof playScanSound === 'function') playScanSound(mimePairComplete);
                        onNFCTagScanned('filament', fotTag);

                    } else if (mimePairComplete || getAlwaysJumpToApply()) {
                        navigator.vibrate([80, 50, 80]);
                        if (typeof playScanSound === 'function') playScanSound(true);
                        setTimeout(() => { window.location.href = "apply.html"; }, 300);

                    } else {
                        navigator.vibrate(100);
                        if (typeof playScanSound === 'function') playScanSound(false);
                        if (typeof updateScanStatus === 'function') updateScanStatus();

                    }
                    break;
                }

                default:
                    console.log("Record type not supported: " + record.recordType);
                    nfcError("NFC Error: Unsupported record type");
                }

                // Nothing left that a further record could add
                if (applied.has('filament') && applied.has('slot')) break;
            }
            setTimeout(startNFCScan, getScanDelay());
        };

    }).catch(error => {
        if (error.name === 'AbortError') return;
        console.log(`Error! Scan failed to start: ${error}.`);
        onnfcDisabled(error);
    });
}

function nfcError(message) {
    document.querySelector("#btn-enable-nfc").hidden = true;
    const el = document.querySelector("#nfc-status");
    el.innerText = message;
    el.classList.remove("pulsing-text");
    el.style.color = "red";
}


function nfcCooldown() {
    const el = document.querySelector("#nfc-status");
    document.querySelector("#btn-enable-nfc").hidden = true;
    el.innerText = "NFC Scanner Cooling Down...";
    el.classList.remove("pulsing-text");
    el.style.color = "";
}

// This doesn't enable NFC, just handles things that should happen when it starts
function onNfcEnabled() {
    const el = document.querySelector("#nfc-status");
    document.querySelector("#btn-enable-nfc").hidden = true;
    el.innerText = "NFC Scanner Enabled";
    el.classList.add("pulsing-text");
    el.style.color = "";
}

// Stuff to do when NFC is being disabled
function onnfcDisabled(error = null) {
    const el = document.querySelector("#nfc-status");
    el.innerText = error == null ? "NFC Scanner Disabled" : "NFC Scanner error: " + error;
    el.classList.remove("pulsing-text");
    el.style.color = "";
    document.querySelector("#btn-enable-nfc").hidden = false;
}

readNFC();
