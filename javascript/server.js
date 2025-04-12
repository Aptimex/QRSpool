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

//Set the target slot to have the filament described in the tag
async function setFilamentSlotFromTag(IDjson, tag=null) {
    //Default to using the current active tag
    if (tag == null) {
        tag = parseActiveTag();
        if (tag == null) {
            return makeError("Active tag empty or invalid")
        }
    }
    IDs = JSON.parse(IDjson)

    try {
        var fType = tag.type;
        var colorHex = tag.colorHex;
        var brand = tag.brand;
        var minTemp = tag.minTemp;
        var maxTemp = tag.maxTemp;
    } catch (e) {
        return makeError("Tag object is missing expected value(s)")
    }
    const r = await setFilamentSlot(IDs, colorHex, fType, brand, minTemp, maxTemp);
    return r;
}

//Set the target slot to have specified filament settings
async function setFilamentSlot(IDs, colorHex, fType, brand, minTemp, maxTemp) {
    let server = getServer()
    if (server == null || server.length < 1) {
        return makeError("server not set")
    }
    let url = "" + server + "/setFilament"
    
    let data = {
        //amsID: amsID,
        //slotID: slotID,
        ids: IDs,
        type: fType,
        colorHex: colorHex,
        brand: brand,
        minTemp: minTemp,
        maxTemp: maxTemp
    };
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

async function amsinfo() {
    return await serverGETjson("/amsinfo")
}

async function getSlots() {
    return await serverGETjson("/slots")
}

async function getServerStatus() {
    //This route doesn't require auth, but using it won't hurt. 
    return await serverGETjson("/serverStatus")
}

async function getPrinterStatus() {
    return await serverGETjson("/printerStatus")
}
