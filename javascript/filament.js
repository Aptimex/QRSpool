class FilamentData {
    constructor(header) {
        this.header = header;
    }
    
    //Build a table showing all the object's properties
    display(parentEl) {
        var tbl = document.createElement("table");
        tbl.classList.add("table");
        tbl.classList.add("table-striped");
        tbl.classList.add("table-bordered");
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
}

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

class FilamentSlot {
    constructor(ids, displayID, type, colorHex, brand, minTemp, maxTemp, k, bedTemp) {
        //id MUST be present and MUSt be an object containing the ID values
        this.ids = ids; 
        this.displayID = displayID;

        //All these can be changed/deleted and this.display() will still work
        //All these values are assumed to be strings or integers
        this.type = type;
        this.colorHex = colorHex; //this key name will cause a color box to be displayed
        this.brand = brand;
        this.minTemp = minTemp;
        this.maxTemp = maxTemp;
        this.k = k;
        this.bedTemp = bedTemp;
    }
    
    //Dynamically construct a table that displays the slot info stored in this object
    //Table will be inserted as a child of the parentEl DOM element
    display(parentEl, applyButton=true) {
        var tbl = document.createElement("table");
        tbl.classList.add("table", "table-striped", "table-bordered", "border-3", "rounded-5");

        //Title
        let tr = tbl.insertRow();
        tr.setAttribute("scope","row");
        let th = document.createElement("th");
        th.colSpan = 2;
        th.style.textAlign = "center";
        th.classList.add("h2");
        th.innerText = this.displayID;
        tr.appendChild(th);
        
        //Make an iterable version of this object
        const {...iterableSelf} = this;
        
        Object.entries(iterableSelf).forEach(([k, v]) => {
            //We handle displaying these specific values separately
            if (k == "ids" || k == "displayID") {
                //v = this.idToString();
                return; //same effect as 'continue'
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

        //Add a button for applying the current filament tag to this slot. 
        if (applyButton) {
            let tr = tbl.insertRow();
            tr.setAttribute("scope","row");

            let td = tr.insertCell();
            td.colSpan = 2;
            td.style.textAlign = "center";

            let apply = document.createElement("button");
            apply.innerText = "Apply tag to this slot";
            apply.classList.add("btn", "btn-primary");
            apply.dataset.ids = JSON.stringify(this.ids);
            apply.onclick = function() {
                setFilamentSlotFromTag(this.dataset.ids); 
            } 
            td.appendChild(apply);
        }
        parentEl.appendChild(tbl);
        //console.log(tbl);
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

function displayOpenSpoolTag(tag) {
    if (! tag instanceof FilamentOpenSpool) {
        console.log("Tag is not an instance of the FilamentOpenSpool class")
        return
    }
    document.getElementById("protocol").innerText = ""  + tag.displayProtocol;
    document.getElementById("type").innerText = tag.type;
    document.getElementById("colorHex").innerText = tag.colorHex;
    document.getElementById("brand").innerText = tag.brand;
    document.getElementById("minTemp").innerText = tag.minTemp;
    document.getElementById("maxTemp").innerText = tag.maxTemp;
    
    //document.getElementById("colorHexDisplay").style.backgroundColor = "#" + tag.colorHex;
    document.getElementById("tagColorDisplay").style.backgroundColor = "#" + tag.colorHex;
}
