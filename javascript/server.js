function makeError(msg) {
    let e = {
        error: msg
    };
    return e;
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

async function amsinfo() {
    let server = getServer()
    if (server == null || server.length < 1) {
        return '{"error": "Server not set"}'
    }
    
    let url = "" + server + "/amsinfo"
    try {
        let x = new URL(url)
    } catch (e) {
        return '{"error": "Invalid URL. Make sure you include http(s):// at the start"}'
    } 
    
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
