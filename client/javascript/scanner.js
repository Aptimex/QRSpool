// Modified example code from https://github.com/cozmo/jsQR

var video = document.createElement("video");
var canvasElement = document.getElementById("canvas");
var canvas = canvasElement.getContext("2d");
var loadingMessage = document.getElementById("loadingMessage");
var outputContainer = document.getElementById("output");
var outputMessage = document.getElementById("outputMessage");
var outputData = document.getElementById("outputData");

var camTrack = null;
var isTorchOn = false;
var torchStartsOn = getTorchStart();
var keepLooking = true;

// Track which tag types have been scanned and are active
var scanState = {
    filamentScanned: getActiveTagData() != null,
    slotScanned: getActiveSlotIDs() != null
};

var lastScanTime = 0;

function playScanSound(pairComplete = false) {
    if (!getScanSound()) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        function beep(freq, startTime, duration) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        }
        beep(880, ctx.currentTime, 0.08);
        if (pairComplete) {
            beep(1047, ctx.currentTime + 0.13, 0.08);
        }
    } catch(e) {
        console.log("Audio playback failed: " + e);
    }
}

function drawLine(begin, end, color) {
    canvas.beginPath();
    canvas.moveTo(begin.x, begin.y);
    canvas.lineTo(end.x, end.y);
    canvas.lineWidth = 4;
    canvas.strokeStyle = color;
    canvas.stroke();
}

// Use facingMode: environment to attemt to get the front camera on phones
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
    video.srcObject = stream;
    video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
    video.play();

    camTrack = stream.getVideoTracks()[0];
    if (torchStartsOn) {
        //Try to enable phone torch for easier QR reading
        camTrack.applyConstraints({
                advanced: [{torch: true}]
        });
        isTorchOn = true;
    }


    requestAnimationFrame(tick);
});

function tick() {
    if ( !(keepLooking) ) {
        return;
    }
    loadingMessage.innerText = "⌛ Loading video..."
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        loadingMessage.hidden = true;
        canvasElement.hidden = false;
        outputContainer.hidden = false;

        // Dynamically shrink the video to fit the window width if it's too wide
        var widthPadding = 40;
        var vHeight = video.videoHeight;
        var vWidth = Math.min(window.innerWidth-widthPadding, video.videoWidth);
        if (vWidth < video.videoWidth) {
            vHeight = (vWidth / video.videoWidth) * video.videoHeight;
        }

        canvasElement.height = vHeight;
        canvasElement.width = vWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        var code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        if (code) {
            drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
            drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
            drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
            drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
            outputMessage.hidden = true;
            outputData.parentElement.hidden = false;
            outputData.innerText = code.data;

            handleCodeData(code.data)

        } else {
            outputMessage.hidden = false;
            outputData.parentElement.hidden = true;
        }
    }
    requestAnimationFrame(tick);
}

function turnOffTorch() {
    if (camTrack == null || !isTorchOn) return;
    camTrack.applyConstraints({ advanced: [{torch: false}] });
    isTorchOn = false;
    console.log("Torch Off");
}

function toggleTorch() {
    if (camTrack == null) {
        return;
    }

    if (isTorchOn) {
        camTrack.applyConstraints({
            advanced: [{torch: false}]
        });
        isTorchOn = false;
        console.log("Torch Off");
    } else {
        camTrack.applyConstraints({
            advanced: [{torch: true}]
        });
        isTorchOn = true;
        console.log("Torch ON");
    }
}

function updateScanStatus() {
    const statusEl = document.getElementById("scanStatus");
    if (!statusEl) return;

    if (scanState.filamentScanned && scanState.slotScanned) {
        statusEl.innerHTML = 'Both tags scanned! Redirecting...';
        statusEl.className = "alert alert-success mt-2";
        statusEl.hidden = false;
    } else if (scanState.filamentScanned) {
        statusEl.innerHTML = '\u2713 Filament tag scanned. Scan a slot tag, or <a href="apply.html" class="alert-link">continue to select a slot manually</a>.';
        statusEl.className = "alert alert-info mt-2";
        statusEl.hidden = false;
    } else if (scanState.slotScanned) {
        statusEl.innerHTML = '\u2713 Slot tag scanned. Now scan a filament tag.';
        statusEl.className = "alert alert-info mt-2";
        statusEl.hidden = false;
    } else {
        statusEl.hidden = true;
    }
}

function handleCodeData(data, tag=null) {
    if (tag == null) {
        const now = Date.now();
        if (now - lastScanTime < getScanDelay()) return;

        // Try filament tag
        let filamentTag = FilamentOpenSpool.newEmpty();
        if (filamentTag.parseDataString(data)) {
            lastScanTime = Date.now();
            activateTag(filamentTag);
            scanState.filamentScanned = true;
            if (scanState.slotScanned || getAlwaysJumpToApply()) {
                navigator.vibrate([80, 50, 80]);
                playScanSound(true);
                keepLooking = false;
                turnOffTorch();
                setTimeout(() => { window.location.href = "./apply.html"; }, 250);
            } else {
                navigator.vibrate(100);
                playScanSound(false);
            }
            updateScanStatus();
            return;
        }

        // Try slot tag
        let slotTag = SlotTag.tryParse(data);
        if (slotTag != null) {
            lastScanTime = Date.now();
            if (slotTag.ids != null) {
                setActiveSlotIDs(JSON.stringify(slotTag.ids));
                scanState.slotScanned = true;
            }
            
            const pairComplete = scanState.filamentScanned && scanState.slotScanned;
            navigator.vibrate(pairComplete ? [80, 50, 80] : 100);
            playScanSound(pairComplete);
            if (slotTag.printer_name != null && slotTag.printer_name !== getActivePrinterName()) {
                const statusEl = document.getElementById("scanStatus");
                if (statusEl) {
                    statusEl.innerHTML = `Switching to printer "${slotTag.printer_name}"&hellip;`;
                    statusEl.className = "alert alert-info mt-2";
                    statusEl.hidden = false;
                }
                setActivePrinter(slotTag.printer_name).then(result => {
                    if (result.error) {
                        if (statusEl) {
                            statusEl.innerHTML = `Error switching printer: ${result.error}`;
                            statusEl.className = "alert alert-danger mt-2";
                        }
                    } else {
                        setActivePrinterName(result.name);
                        if (pairComplete) {
                            keepLooking = false;
                            turnOffTorch();
                            setTimeout(() => { window.location.href = "./apply.html"; }, 250);
                        } else {
                            if (statusEl) {
                                const nextStep = scanState.filamentScanned ? "" : " Now scan a filament tag.";
                                statusEl.innerHTML = `&#10003; Printer &ldquo;${result.name}&rdquo; selected.${nextStep}`;
                                statusEl.className = "alert alert-info mt-2";
                                statusEl.hidden = false;
                            }
                        }
                    }
                });
            } else if (pairComplete) {
                keepLooking = false;
                turnOffTorch();
                setTimeout(() => { window.location.href = "./apply.html"; }, 250);
            } else {
                updateScanStatus();
            }
            return;
        }

        if (! data || data.length < 1) {
            console.log("Invalid data read: [empty]");
            return;
        }
        console.log("Invalid data read: " + data);
        return;
    }

    // Called with a pre-parsed tag from URL params — go directly
    keepLooking = false;
    turnOffTorch();
    activateTag(tag);
    window.location.href = "./apply.html";
}


function handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('qrstring')) {
        console.log("Handling qrstring param");
        return handleCodeData(urlParams.get('qrstring'));
    }
    if (urlParams.has('osjson')) {
        console.log("Handling osjson param");
        return handleCodeData(urlParams.get('osjson'));
    }
    if (urlParams.has('slotstring')) {
        console.log("Handling slotstring param");
        let slotTag = SlotTag.tryParse(urlParams.get('slotstring'));
        if (slotTag != null && slotTag.ids != null) {
            setActiveSlotIDs(JSON.stringify(slotTag.ids));
            scanState.slotScanned = true;
            updateScanStatus();
        } else {
            console.log("Invalid slotstring param");
        }
        return;
    }

    if (urlParams.has("type")) {
        console.log("Handling individual data params");
        let type = urlParams.get('type');
        let colorHex = urlParams.get('color_hex') ?? "xxxxxx";
        let brand = urlParams.get('brand') ?? "";
        let minTemp = urlParams.get('min_temp') ?? "0";
        let maxTemp = urlParams.get('max_temp') ?? "0";

        let tag = new FilamentOpenSpool(type, colorHex, brand, minTemp, maxTemp);
        return handleCodeData(null, tag);
    }

    console.log("No valid URL params to parse");
}

// Show initial state if tags are already stored from a previous session
updateScanStatus();
handleURLParams();
