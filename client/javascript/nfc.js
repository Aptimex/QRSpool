
// Redirect console output to window
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

/*
if ('NDEFReader' in window) {
    readNFC();
}
*/

function parseNFCData(data) {
    console.log("Parsing tag data: " + data);
    var tagData = JSON.parse(data);
    if (tagData == null) {
        console.log("Invalid data read: [empty]");
        return null;
    }

    try {
        let protocol = tagData.protocol;
        if (protocol.toLowerCase() != "openspool") {
            console.log("Invalid tag protocol, must be 'openspool': " + protocol);
            return null;
        }
    } catch (e) {
        console.log("Error processing tag: " + e);
        return null;
    }
    console.log("Protocol is correct");

    try {
        var fosTag = new FilamentOpenSpool(
            tagData.type,
            tagData.color_hex,
            tagData.brand,
            tagData.min_temp,
            tagData.max_temp
        );
    } catch (e) {
        console.log("Error processing tag: " + e);
        return null;
    }
    fosTag.rawData = fosTag.toDataString();
    console.log("Parse successful");

    return fosTag;
}

function readNFC() {
    if (!('NDEFReader' in window)) {
        console.log("NFC not supported by your browser");
        return null;
    }

    const ndef = new NDEFReader();
    ndef.scan().then(() => {
        console.log("Scan started successfully.");
        ndef.onreadingerror = () => {
            console.log("Error readting the NFC tag. Try another one?");
        };
        ndef.onreading = event => {
            console.log("NDEF message read.");
            const message = event.message;
            for (const record of message.records) {
                console.log("Record type:  " + record.recordType);
                console.log("MIME type:    " + record.mediaType);
                console.log("Record id:    " + record.id);

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
                    break;
                default:
                    console.log("Record type not supported (must be text): " + record.recordType);
                }
            }
        };

    }).catch(error => {
        console.log(`Error! Scan failed to start: ${error}.`);
    });

}

