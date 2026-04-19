
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

function readNFC() {
    if (!('NDEFReader' in window)) {
        nfcDisabled("");
        document.querySelector("#nfc-status").hidden = true;
        document.querySelector("#btn-enable-nfc").hidden = true;
        console.log("NFC not supported by your browser; it currently is only available on Chrome for Android.")
        return null;
    }

    nfcEnabled();

    const ndef = new NDEFReader();
    ndef.scan().then(() => {
        //console.log("NFC Scanner Enabled.");
        ndef.onreadingerror = () => {
            console.log("Error readting the NFC tag. Try another one?");
        };
        ndef.onreading = event => {
            console.log("NDEF message read.");
            const message = event.message;
            for (const record of message.records) {
                switch (record.recordType) {
                case "text":
                    console.log("Parsing text record");
                    const textDecoder = new TextDecoder(record.encoding);
                    const data = textDecoder.decode(record.data);
                    var result = parseNFCData(data);
                    if (result == null) {
                        console.log("Error parsing NFC tag data");
                        return;
                    }

                    if (result.type === 'filament') {
                        console.log("Activating filament tag");
                        activateTag(result.tag);
                        if (typeof scanState !== 'undefined') { scanState.filamentScanned = true; }
                        navigator.vibrate([80, 50, 80]);
                        playScanSound(true);
                        setTimeout(() => { window.location.href = "apply.html"; }, 300);
                    } else if (result.type === 'slot') {
                        console.log("Activating slot tag");
                        setActiveSlotIDs(JSON.stringify(result.tag.ids));
                        if (typeof scanState !== 'undefined') { scanState.slotScanned = true; }
                        if (getActiveTagData() != null) {
                            navigator.vibrate([80, 50, 80]);
                            playScanSound(true);
                            setTimeout(() => { window.location.href = "apply.html"; }, 300);
                        } else {
                            navigator.vibrate(100);
                            playScanSound(false);
                            if (typeof updateScanStatus === 'function') updateScanStatus();
                        }
                    }
                    break;
                default:
                    console.log("Record type not supported (must be text): " + record.recordType);
                }
            }
        };

    }).catch(error => {
        console.log(`Error! Scan failed to start: ${error}.`);
        nfcDisabled(error);
    });

}

// This doesn't enable NFC, just handles things that should happen when it is
function nfcEnabled() {
    document.querySelector("#btn-enable-nfc").hidden = true;
    document.querySelector("#nfc-status").innerText = "NFC Scanner Enabled";
    document.querySelector("#nfc-status").classList.add("pulsing-text");
}

function nfcDisabled(error = null) {
    if (error == null) {
        document.querySelector("#nfc-status").innerText = "NFC Scanner Disabled";
    } else {
        document.querySelector("#nfc-status").innerText = "NFC Scanner error: " + error;
    }
    document.querySelector("#btn-enable-nfc").hidden = false;
    document.querySelector("#nfc-status").classList.remove("pulsing-text");
}

readNFC();
