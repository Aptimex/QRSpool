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

function handleCodeData(data) {
    //let tag = new FilamentOpenSpool();
    let tag = FilamentOpenSpool.newEmpty();
    let result = tag.parseDataString(data);
    if (! result) {
        if (! data || data.length < 1) {
            console.log("Invalid data read: [empty]");
            return;
        }
        console.log("Invalid data read: " + data);
        return;
    }
    
    activateTag(tag);
    window.location.href = "./apply.html"
}
