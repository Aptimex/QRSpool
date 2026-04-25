const CLIENT_VERSION = "0.5.0";

// Minimum server version required by this client. Bump manually on breaking API changes.
const MIN_SERVER_VERSION = "0.0.0";

// Minimum server version to support all current features. Servers between MIN and this
// version still work but are missing newer functionality. Bump when adding non-breaking
// new server features.
const RECOMMENDED_SERVER_VERSION = "0.5.0";

// First server version to support the colorName field in /setFilament.
// Servers older than this receive requests without colorName to avoid a TypeError.
// This compatability hack will be removed in the future
const COLORNAME_MIN_VERSION = "0.5.0";

let cachedServerVersion = null;

// Compare semantic version strings
function semverLt(a, b) {
    const pa = (a || "0").split('.').map(Number);
    const pb = (b || "0").split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) < (pb[i] || 0)) return true;
        if ((pa[i] || 0) > (pb[i] || 0)) return false;
    }
    return false;
}

function injectVersionWarningBanner() {
    const banner = document.createElement('div');
    banner.id = 'server-version-warning';
    banner.hidden = true;
    banner.style.cssText = 'text-align:center;padding:0.75rem 1rem;font-weight:bold;font-size:1.1em;';
    document.querySelector('main')?.before(banner);
}

function showServerVersionWarning(serverVersion) {
    const banner = document.getElementById('server-version-warning');
    if (!banner) return;
    banner.style.background = '#b91c1c';
    banner.style.color = '#fff';
    banner.textContent = `⚠ Your backend server version ${serverVersion} is not compatible with this frontend version. You must update it for this site to work.`;
    banner.hidden = false;
}

function showServerVersionRecommendation(serverVersion) {
    const banner = document.getElementById('server-version-warning');
    if (!banner) return;
    banner.style.background = '#ca8a04';
    banner.style.color = '#fff';
    banner.textContent = `⚠ Your backend server has a newer version available. Please update it ASAP to maintain full compatibility with this site.`;
    banner.hidden = false;
}

function hideServerVersionWarning() {
    const el = document.getElementById('server-version-warning');
    if (el) el.hidden = true;
}

async function checkServerCompatibility() {
    if (!getServerURL()) return;
    const status = await getServerStatus();
    if (status.error) return;
    cachedServerVersion = status.serverVersion || "0.0.0";
    if (semverLt(cachedServerVersion, MIN_SERVER_VERSION)) {
        showServerVersionWarning(cachedServerVersion);
    } else if (semverLt(cachedServerVersion, RECOMMENDED_SERVER_VERSION)) {
        showServerVersionRecommendation(cachedServerVersion);
    } else {
        hideServerVersionWarning();
    }
}

// colorName had to be added to the server API support OpenTag, but old servers throw an error if they recieve it
// This check reverts to old behavior for older servers to maintain compatibility temporarily
function serverSupportsColorName() {
    if (cachedServerVersion === null) return false;
    return !semverLt(cachedServerVersion, COLORNAME_MIN_VERSION);
}

document.addEventListener('DOMContentLoaded', () => {
    injectVersionWarningBanner();
    checkServerCompatibility();
});

function makeError(msg, errObj = null) {
    
    if (errObj == null) {
        errObj = {};
    }
    errObj.error = msg;
    //console.error(errObj);
    return errObj;
}

function getAuthHeader() {
    let authCred = getAuthCredHeader();
    if (!authCred) {
        return null;
    }
    return "Basic " + authCred;
}

//Set the target slot to have the filament described in the tag
async function setFilamentSlotFromTag(IDjson, tag=null) {
    //Default to using the current active tag
    if (tag == null) {
        tag = parseActiveTag();
        if (tag == null) {
            return makeError("Empty or invalid active tag")
        }
    }
    IDs = JSON.parse(IDjson)

    try {
        var fType = tag.type;
        var colorHex = tag.colorHex;
        var brand = tag.brand;
        var minTemp = tag.minTemp;
        var maxTemp = tag.maxTemp;
        var colorName = tag.colorName || "";
    } catch (e) {
        return makeError("Tag object is missing expected value(s)")
    }
    const r = await setFilamentSlot(IDs, colorHex, fType, brand, minTemp, maxTemp, colorName);
    return r;
}

//Set the target slot to have specified filament settings
async function setFilamentSlot(IDs, colorHex, fType, brand, minTemp, maxTemp, colorName = "") {
    let server = getServer()
    if (server == null || server.length < 1) {
        return makeError("server not set")
    }
    let url = "" + server + "/setFilament"
    
    let data = {
        ids: IDs,
        type: fType,
        colorHex: colorHex,
        brand: brand,
        minTemp: minTemp,
        maxTemp: maxTemp,
    };
    if (serverSupportsColorName()) {
        data.colorName = colorName;
    }
    console.log(data);
    
    let headers = new Headers({
        'Content-Type': 'application/json',
        "Authorization": getAuthHeader()
    });
    
    const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(data)
    });
    
    if (! response.ok) {
        return makeError("Server responded with code " + response.status);
    }
    return response.json();
}

function getServerURL() {
    let server = getServer();
    if (server == null || server == "") {
        return null;
    }
    
    try {
        //If it's not a valid URL, this will fail
        let x = new URL(server);
    } catch (e) {
        return null;
    } 
    return server;
}

//Send a GET request to the server and return JSON response converted to an object
//On error, returns an object with an "error" key describing the issue
//route should start with / and is relative to the saved server URL
async function serverGETjson(route) {
    let server = getServerURL();
    if (server == null) {
        return makeError("Server not set or invalid URL");
    }
    var r;
    
    let url = "" + server + route;
    let headers = new Headers({
        "Authorization": getAuthHeader()
    });
    try {
        r = await fetch(url, {
            headers: headers
        });
    } catch (e) {
        console.error(e);
        return makeError("Error connecting to server: " + e.message);
    }
    
    try {
        const jsonResp = await r.json();
        return jsonResp;
    } catch (e) {
        console.error(e);
        return makeError("Unable to get server response: " + e.message);
    }
}

async function getSlots() {
    return await serverGETjson("/slots");
}

async function getServerStatus() {
    //This route doesn't require auth, but using it won't hurt. 
    return await serverGETjson("/serverStatus");
}

async function getPrinterStatus() {
    return await serverGETjson("/printerStatus");
}

async function serverPrinterReconnect() {
    console.log(await serverGETjson("/reconnect"));
}
