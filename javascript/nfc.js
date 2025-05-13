
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

function parseNFCData(data) {
    //console.log("Parsing tag data: " + data);
    var fosTag = FilamentOpenSpool.newEmpty();
    if ( !(fosTag.parseDataString(data)) ) {
        console.log("Error parsing NFC tag data");
        return null;
    }

    return fosTag;
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
                    // Read text record with record data, lang, and encoding.
                    console.log("Parsing text record");
                    const textDecoder = new TextDecoder(record.encoding);
                    const data = textDecoder.decode(record.data);
                    var tag = parseNFCData(data);
                    if (tag == null) {
                        console.log("Error parsing tag data");
                        return;
                    }

                    console.log("Activating tag");
                    activateTag(tag);

                    // Slight delay to prevent double reads
                    setTimeout(() => {
                        window.location.href = "apply.html";
                    }, 300);
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
}

function nfcDisabled(error = null) {
    if (error == null) {
        document.querySelector("#nfc-status").innerText = "NFC Scanner Disabled";
    } else {
        document.querySelector("#nfc-status").innerText = "NFC Scanner error: " + error;
    }
    document.querySelector("#btn-enable-nfc").hidden = false;
}

readNFC();
