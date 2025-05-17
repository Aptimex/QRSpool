// Example QR data format: OS1.0|PLA|0a2b3c|SomeBrand|210|230
class FilamentOpenSpool {
    static protocol = "OS";
    static version = "1.0";
    static delim = "|";
    static displayMap = {
        "rawData": "Raw Tag Data",
        "displayProtocol": "Tag Protocol",
        "type": "Type",
        "colorHex": "Color",
        "brand": "Brand",
        "minTemp": "Min Temp (C)",
        "maxTemp": "Max Temp (C)"
    }
    
    constructor(type, colorHex, brand, minTemp, maxTemp, rawData=null) {
        this.rawData = rawData;
        this.displayProtocol = "" + FilamentOpenSpool.protocol + FilamentOpenSpool.version;
        this.type = type;
        this.colorHex = colorHex;
        this.brand = brand;
        this.minTemp = minTemp;
        this.maxTemp = maxTemp;

        if (this.rawData == null) {
            this.rawData = this.toQRString();
        }
    }
    
    static newEmpty() {
        return new FilamentOpenSpool("", "", "", "", "");
    }
    
    // This doesn't fully validate the input, just does some light sanity checking to quickly discard stuff that is obviously not worth parsing
    static isValidFormat(data) {
        let header = "" + FilamentOpenSpool.protocol + FilamentOpenSpool.version + FilamentOpenSpool.delim;
        let headerLen = header.length;
        if (data.substring(0,headerLen) == header) {
            return true;
        }

        // Not QR format, check if it's OpenSpool JSON
        try {
            let x = JSON.parse(data);
            if (x.protocol.toLowerCase() == "openspool") {
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
    
    parseDataString(data) {
        if (! FilamentOpenSpool.isValidFormat(data)) {
            return false;
        }

        //If it's valid JSON, try to parse it as a proper OpenSpool tag
        try {
            JSON.parse(data);
            console.log("Parsing JSON tag data");
            return this.parseJSONString(data);
        } catch (e) {
            // Not valid JSON, treat as a QR string
            console.log("Parsing QR string");
            return this.parseQRString(data);
        }
    }

    parseQRString(data) {
        this.rawData = data;
        let fields = data.split(FilamentOpenSpool.delim);
        try {
            this.displayProtocol = fields[0] ? fields[0] : "";
            this.type = fields[1] ? fields[1] : "";
            this.colorHex = fields[2] ? fields[2] : "";
            this.brand = fields[3]  ? fields[3] : "";
            this.minTemp = fields[4]  ? fields[4] : "";
            this.maxTemp = fields[5] ? fields[5] : "";
        } catch (e) {
            console.log(e);
            //still return true to support tags missing the later less-important fields
        }

        return true
    }

    // Prase a full OpenSpool JSON string
    parseJSONString(data) {
        if (data == null || data == "") {
            console.log("Empty data");
            return false;
        }

        if (typeof data === 'object') { //handle object that was already parsed
            var tagObj = data;
            this.rawData = JSON.stringify(tagObj);
        } else {
            // If it's a string, try to parse it as JSON
            try {
                var tagObj = JSON.parse(data);
                this.rawData = data;
            } catch (e) {
                console.log("Error parsing JSON: " + e);
                return false;
            }
        }

        try {
            this.displayProtocol = tagObj.protocol;
            this.type = tagObj.type;
            this.colorHex = tagObj.color_hex;
            this.brand = tagObj.brand;
            this.minTemp = tagObj.min_temp;
            this.maxTemp = tagObj.max_temp;
        } catch (e) {
            console.log(e);
            return false;
        }
        if (this.displayProtocol.toLowerCase() != "openspool") {
            console.log("Invalid tag protocol, must be 'openspool', but got: " + this.displayProtocol);
            return false;
        }
        return true
    }
    
    display(parentEl) {
        var tbl = document.createElement("table");
        tbl.classList.add("table", "table-striped", "table-bordered");
        const {...iterableSelf} = this;
        
        Object.entries(iterableSelf).forEach(([k, v]) => {
            var displayK = k;
            for (let key in FilamentOpenSpool.displayMap) {
                if (key === k) {
                    displayK = FilamentOpenSpool.displayMap[key];
                    break;
                }
            }
            if (k == "colorHex") {
                v = v.substring(0,6);
            }

            let tr = tbl.insertRow();
            tr.setAttribute("scope","row");
            
            let td = tr.insertCell();
            td.setAttribute("scope","col");
            
            let th = document.createElement("th");
            tr.insertBefore(th, td);
            
            th.innerText = displayK;
            td.innerText = v;
            if (k == "colorHex") {
                let box = document.createElement("div");
                box.style.backgroundColor = '#' + v;
                box.classList.add("color-box");
                td.appendChild(box);
            }
        });
        
        parentEl.appendChild(tbl);
        //console.log(tbl);
    }
    
    // Return the data that should be placed in a QR code
    toQRString() {
        let d = FilamentOpenSpool.delim;
        let str = "" + FilamentOpenSpool.protocol + FilamentOpenSpool.version + d;
        str += this.type + d;
        str += this.colorHex + d;
        str += this.brand + d;
        str += this.minTemp + d;
        str += this.maxTemp;
        return str;
    }

    toOpenSpoolJSON() {
        let str = "{";
        str += '"protocol":"openspool",';
        str += '"type":"' + this.type + '",';
        str += '"color_hex":"' + this.colorHex + '",';
        str += '"brand":"' + this.brand + '",';
        str += '"min_temp":"' + this.minTemp + '",';
        str += '"max_temp":"' + this.maxTemp + '"';
        str += "}";
        return str;
    }

    toSTLLink() {
        let s = "https://printer.tools/qrcode2stl/#shareQR-";
        let qrstring = this.toQRString();
        let json = `{"errorCorrectionLevel":"L","text":"${qrstring}","base":{"width":30,"height":30,"depth":1,"cornerRadius":2,"hasBorder":false,"hasText":true,"textMargin":1.2,"textSize":3,"textMessage":"${this.brand} ${this.type}\\n#${this.colorHex}","textDepth":0.4,"hasKeychainAttachment":true,"keychainPlacement":"top","keychainHoleDiameter":5},"code":{"depth":0.4,"margin":1.2}}`;
        console.log(json);
        return s + btoa(json);
    }
}

class FilamentSlot {
    constructor(ids, displayID, displayKeys, colorHexKeys, data) {
        this.ids = ids; //opaque object
        this.displayID = displayID; //string
        this.data = data; //object

        this.displayKeys = displayKeys;
        this.colorHexKeys = colorHexKeys;
    }
    
    //Dynamically construct a table that displays the slot info stored in this object
    //Table will be inserted as a child of the parentEl DOM element
    display(parentEl, applyButton=true) {
        var tbl = document.createElement("table");
        tbl.classList.add("table", "table-striped", "table-bordered", "border", "border-dark", "border-5", "rounded-5", "overflow-hidden");
        tbl.style["border-top-right-radius"] = "15px";
        tbl.style["border-top-left-radius"] = "15px";

        //Title
        let tr = tbl.insertRow();
        var th = document.createElement("th");
        tr.appendChild(th);
        
        th.colSpan = 2;
        th.style.textAlign = "center";
        th.classList.add("h2");
        th.innerText = this.displayID;

        //Add a button for applying the current filament tag to this slot. 
        if (applyButton) {
            let apply = document.createElement("button");
            apply.innerText = "Apply tag to this slot";
            apply.classList.add("btn", "btn-primary");
            apply.dataset.ids = JSON.stringify(this.ids);
            apply.onclick = async function() {
                this.parentElement.lastChild.innerText = "Applying, please wait 5-10 seconds..."
                await setFilamentSlotFromTag(this.dataset.ids);
                showFilamentSlots();
                
            }
            th.appendChild(document.createElement("br"));
            th.appendChild(apply);
            th.appendChild(document.createElement("br"));
            th.appendChild(document.createElement("p"));
        }
        
        //Make an iterable version of this object
        //const {...iterableSelf} = this;
        
        //Display all data fields that match a displayKeys key
        this.displayKeys.forEach(k => {
            let v = this.data[k];

            let tr = tbl.insertRow();
            let th = document.createElement("th");
            tr.appendChild(th);
            let td = tr.insertCell();
            
            th.innerText = k;
            td.innerText = v;
            
            //Render color box if appropriate
            if (this.colorHexKeys.includes(k)) {
                let box = document.createElement("div");

                // regex to check if the string is a valid hex color (3 or 6 hex chars)
                if (/^([0-9A-Fa-f]{3}){1,2}$/.test(v)) {
                    box.style.backgroundColor = '#' + v;
                    box.classList.add("color-box");
                } else {
                    box.classList.add("color-box-unknown");
                }
                td.appendChild(box);
            }
        });

        //Optional More info, show everything else in the data object
        let moreID = "M" + Math.random().toString(32).slice(2); //easy unique alphanumeric string generator
        tr = tbl.insertRow();
        th = document.createElement("th");
        tr.appendChild(th);
        th.colSpan = 2;
        th.style.textAlign = "center";
        
        //The entire col triggers extra data collapse
        th.innerText = "↓ Show/Hide All Slot Info ↓";
        th.setAttribute("data-bs-toggle", "collapse");
        th.setAttribute("data-bs-target", `.${moreID}`);

        for (const [k, v] of Object.entries(this.data)) {
            if (this.displayKeys.includes(k)) {
                continue
            }

            let tr = tbl.insertRow();
            let th = document.createElement("th");
            tr.appendChild(th);
            let td = tr.insertCell();
            
            tr.classList.add("collapse", `${moreID}`);
            th.innerText = k;
            td.innerText = v;
        };
        parentEl.appendChild(tbl);
    }
}

function parseActiveTag() {
    let tagData = getActiveTagData();
    if (tagData == null) {
        document.querySelector("#error").innerText = "No active tag found"
        return null
    }
    
    let tag = FilamentOpenSpool.newEmpty();
    if (! tag.parseDataString(tagData)) {
        document.querySelector("#error").innerText = "Active tag could not be parsed as OpenSpool format"
        return null
    }
    return tag;
}

function activateTag(tag) {
    setActiveTagData(tag.rawData);
}
