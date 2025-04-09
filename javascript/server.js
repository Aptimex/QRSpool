function makeError(msg, errObj = null) {
    
    if (errObj == null) {
        errObj = {}
    }
    errObj.error = msg;
    return errObj;
}

async function setFilamentFromTag(amsID, slotID, tag) {
    try {
        var colorHex = tag.colorHex;
        var fType = tag.type;
        var brand = tag.brand;
        var minTemp = tag.minTemp;
        var maxTemp = tag.maxTemp;
    } catch (e) {
        return '{"error": "Tag object is missing expected value(s)"}'
    }
    const r = await setFilament(amsID, slotID, colorHex, fType, brand, minTemp, maxTemp);
    return r;
}

async function setFilament(amsID, slotID, colorHex, fType, brand, minTemp, maxTemp) {
    let server = getServer()
    if (server == null || server.length < 1) {
        return '{"error": "Server not set"}'
    }
    let url = "" + server + "/setFilament/" + amsID + "/" + slotID
    
    let data = {
        colorHex: colorHex,
        type: fType,
        brand: brand,
        minTemp: minTemp,
        maxTemp: maxTemp
    };
    
    const response = await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return response.text();
}

function getServerURL() {
    let server = getServer()
    if (server == null || server.length < 1) {
        return '{"error": "Server not set"}'
    }
    
    try {
        //If it's not a valid URL, this will fail
        let x = new URL(server)
    } catch (e) {
        return null;
    } 
    return server;
}

async function amsinfo() {
    let server = getServerURL()
    if (server == null) {
        return "error: Server not set or invalid URL"
    }
    
    let url = "" + server + "/amsinfo"
    try {
        const response = await fetch(url);
        const rj = await response.json();
        return JSON.stringify(rj, null, 2);
        
    } catch (e) {
        //return JSON.stringify(makeError(e));
        console.log(e);
        return e.message + "; See broswer console for more details";
    }
    
}

async function getServerStatus() {
    let server = getServerURL()
    if (server == null) {
        return makeError("Server not set or invalid URL")
    }
    
    let url = "" + server + "/serverStatus"
    try {
        const r = await fetch(url);
        const jsonResp = await r.json();
        return jsonResp;
        
    } catch (e) {
        //return JSON.stringify(makeError(e));
        console.log(e);
        return makeError("" + e.message + "; See broswer console for more details");
    }
    
}
