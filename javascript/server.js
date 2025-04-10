function makeError(msg, errObj = null) {
    
    if (errObj == null) {
        errObj = {};
    }
    errObj.error = msg;
    console.log(errObj);
    return errObj;
}

function getAuthHeader() {
    let authCred = getAuthCredHeader();
    if (!authCred) {
        return null;
    }
    return "Basic " + authCred;
}

async function setFilamentFromTag(amsID, slotID, tag) {
    try {
        var fType = tag.type;
        var colorHex = tag.colorHex;
        var brand = tag.brand;
        var minTemp = tag.minTemp;
        var maxTemp = tag.maxTemp;
    } catch (e) {
        return makeError("Tag object is missing expected value(s)")
    }
    const r = await setFilament(amsID, slotID, colorHex, fType, brand, minTemp, maxTemp);
    return r;
}

async function setFilament(amsID, slotID, colorHex, fType, brand, minTemp, maxTemp) {
    let server = getServer()
    if (server == null || server.length < 1) {
        return makeError("server not set")
    }
    let url = "" + server + "/setFilament"
    
    let data = {
        amsID: amsID,
        slotID: slotID,
        type: fType,
        colorHex: colorHex,
        brand: brand,
        minTemp: minTemp,
        maxTemp: maxTemp
    };
    
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

async function amsinfo() {
    let server = getServerURL();
    if (server == null) {
        return "error: Server not set or invalid URL";
    }
    
    let url = "" + server + "/amsinfo";
    let headers = new Headers({
        "Authorization": getAuthHeader()
    });
    try {
        const response = await fetch(url, {
            headers: headers
        });
        const rj = await response.json();
        return JSON.stringify(rj, null, 2);
        
    } catch (e) {
        //return JSON.stringify(makeError(e));
        console.log(e);
        return e.message + "; See broswer console for more details";
    }
    
}

async function getServerStatus() {
    let server = getServerURL();
    if (server == null) {
        return makeError("Server not set or invalid URL");
    }
    var r;
    
    let url = "" + server + "/serverStatus";
    let headers = new Headers({
        "Authorization": getAuthHeader()
    });
    try {
        r = await fetch(url, {
            headers: headers
        });
    } catch (e) {
        console.log(e);
        return makeError("Error connecting to server: " + e.message);
    }
    
    try {
        const jsonResp = await r.json();
        return jsonResp;
    } catch (e) {
        console.log(e);
        return makeError("Unable to get server response: " + e.message);
    }
    
}
