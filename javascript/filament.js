// Example QR data format: openspool1.0|PLA|0a2b3c|SomeBrand|210|230
class FilamentOpenSpool {
    //static protocol = "openspool";
    static protocol = "OS";
    static version = "1.0";
    static delim = "|";
    
    constructor(type, colorHex, brand, minTemp, maxTemp, rawData=null) {
        this.rawData = rawData;
        this.displayProtocol = "" + FilamentOpenSpool.protocol + FilamentOpenSpool.version;
        this.type = type;
        this.colorHex = colorHex;
        this.brand = brand;
        this.minTemp = minTemp;
        this.maxTemp = maxTemp;
    }
    
    static newEmpty() {
        return new FilamentOpenSpool("", "", "", "", "");
    }
    
    static isValidFormat(data) {
        let header = "" + FilamentOpenSpool.protocol + FilamentOpenSpool.version + FilamentOpenSpool.delim;
        let headerLen = header.length;
        if (data.substring(0,headerLen) == header) {
            return true;
        }
        //console.log(data.substring(0,headerLen) + " vs " + header )
        return false;
    }
    
    parseDataString(data) {
        if (! FilamentOpenSpool.isValidFormat(data)) {
            //console.log("Invalid data format")
            return false;
        }
        this.rawData = data;
        
        let fields = data.split(FilamentOpenSpool.delim);
        try {
            this.displayProtocol = fields[0];
            this.type = fields[1];
            this.colorHex = fields[2];
            this.brand = fields[3];
            this.minTemp = fields[4];
            this.maxTemp = fields[5];
        } catch (e) {
            console.log(e);
        }
        return true
    }
    
    display(parentEl) {
        var tbl = document.createElement("table");
        tbl.classList.add("table", "table-striped", "table-bordered");
        const {...iterableSelf} = this;
        
        Object.entries(iterableSelf).forEach(([k, v]) => {
            if (k == "colorHex") {
                v = v.substring(0,6);
            }
            let tr = tbl.insertRow();
            tr.setAttribute("scope","row");
            
            let td = tr.insertCell();
            td.setAttribute("scope","col");
            
            let th = document.createElement("th");
            tr.insertBefore(th, td);
            
            th.innerText = k;
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
    toDataString() {
        let d = FilamentOpenSpool.delim;
        let str = "" + FilamentOpenSpool.protocol + FilamentOpenSpool.version + d;
        str += this.type + d;
        str += this.colorHex + d;
        str += this.brand + d;
        str += this.minTemp + d;
        str += this.maxTemp;
        return str;
    }
}

//TODO: Make this accept arbitrary data
class FilamentSlot {
    constructor(ids, displayID, displayKeys, colorHexKeys, data) {
        //id MUST be present and MUSt be an object containing the ID values
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
            apply.onclick = function() {
                setFilamentSlotFromTag(this.dataset.ids);
                //TODO: refresh the page
            }
            th.appendChild(document.createElement("br"));
            th.appendChild(apply);
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
                box.style.backgroundColor = '#' + v;
                box.classList.add("color-box");
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

function parseOpenSpool(data) {
    let tag = new FilamentOpenSpool();
    result = tag.parseDataString(data);
    if (! result) {
        return null;
    }
    return tag;
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
    setActiveTagData(tag.toDataString());
}
