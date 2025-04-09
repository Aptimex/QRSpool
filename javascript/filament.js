class FilamentOpenTag {
    constructor() {
        this.tagVersion = "";   //5
        this.manufacturer = ""; //16
        this.material = "";     //16
        this.colorHex = "";     //6
        this.colorName = "";    //28 (32-6)
        this.diameter = "";     //5
        this.weight = "";       //5
        this.printTemp = "";    //5
        this.bedTemp = "";      //5
        this.density = "";      //5
    }
    
    parseDataString(data) {
        let tmpData = data;
        
        tag.tagVersion = tmpData.substring(0, 5);
        tmpData = tmpData.substring(5);
        tag.manufacturer = tmpData.substring(0, 16);
        tmpData = tmpData.substring(16);
        tag.material = tmpData.substring(0, 16);
        tmpData = tmpData.substring(16);
        tag.colorHex = tmpData.substring(0, 6);
        tmpData = tmpData.substring(6);
        tag.colorName = tmpData.substring(0, 28);
        tmpData = tmpData.substring(28);
        tag.diameter = tmpData.substring(0, 5);
        tmpData = tmpData.substring(5);
        tag.weight = tmpData.substring(0, 5);
        tmpData = tmpData.substring(5);
        tag.printTemp = tmpData.substring(0, 5);
        tmpData = tmpData.substring(5);
        tag.bedTemp = tmpData.substring(0, 5);
        tmpData = tmpData.substring(5);
        tag.density = tmpData.substring(0, 5);
        tmpData = tmpData.substring(5);
    }
}

// Example QR data format: openspool1.0|PLA|0a2b3c|SomeBrand|210|230
class FilamentOpenSpool {
    //static protocol = "openspool";
    static protocol = "OS";
    static version = "1.0";
    static delim = "|";
    
    constructor(type, colorHex, brand, minTemp, maxTemp) {
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
        return
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

class AMSSlot {
    constructor(id, type, colorHex, brand, minTemp, maxTemp, k, bedTemp) {
        this.id = id;
        this.type = type;
        this.colorHex = colorHex;
        this.brand = brand;
        this.minTemp = minTemp;
        this.maxTemp = maxTemp;
        this.k = k;
        this.bedTemp = bedTemp;
    }
    
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

function parseOpenSpool(data) {
    /*
    let fields = data.split("|")
    if (fields.length < 1) {
        return null;
    }
    if (fields[0] != "OS1.0") {
        return null;
    }
    */
    
    let tag = new FilamentOpenSpool();
    result = tag.parseDataString(data);
    if (! result) {
        return null;
    }
    
    return tag;
    
    /*
    
    fields.forEach((f, i) => {
        if (i == 1) {
            tag.type = f;
            continue;
        }
        if (i == 2) {
            tag.colorHex = f;
            continue;
        }
        if (i == 3) {
            tag.brand = f;
            continue;
        }
        if (i == 4) {
            tag.minTemp = f;
            continue;
        }
        if (i == 5) {
            tag.maxTemp = f;
            continue;
        }
    });
    return tag;
    */
}

function parseOpenTag(data) {
    let tmpData = data;
    let tag = new FilamentOpenTag();
    let i = 0;
    let ln = 0;
    
    while (tmpData.length != 0) {
        switch (i) {
            case 0:
                ln = 5;
                tag.tagVersion = tmpData.substring(0, ln);
                tag.tagVersion = tag.tagVersion.substring(0,1) + "." + tag.tagVersion.substring(1);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 1:
                ln = 16;
                tag.manufacturer = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 2:
                ln = 16;
                tag.material = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 3:
                ln = 6;
                tag.colorHex = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 4:
                ln = 26;
                tag.colorName = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 5:
                ln = 5;
                tag.diameter = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 6:
                ln = 5;
                tag.weight = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 7:
                ln = 5;
                tag.printTemp = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 8:
                ln = 5;
                tag.bedTemp = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            case 9:
                ln = 5;
                tag.density = tmpData.substring(0, ln);
                tmpData = tmpData.substring(ln);
                i++;
                continue;
            default:
                break;
        }
        tmpData = "";
    }
    console.log(tag);
    //displayTag(tag);
    return tag;
}

function activateTag(tag) {
    setActiveTagData(tag.toDataString());
}

function displayOpenTag(tag) {
    if (! tag instanceof FilamentOpenTag) {
        console.log("Tag is not an instance of the FilamentOpenTag class")
        return
    }
    document.getElementById("tagVersion").innerText = tag.tagVersion;
    document.getElementById("manufacturer").innerText = tag.manufacturer;
    document.getElementById("material").innerText = tag.material;
    document.getElementById("colorHex").innerText = tag.colorHex;
    document.getElementById("colorName").innerText = tag.colorName;
    document.getElementById("diameter").innerText = tag.diameter;
    document.getElementById("weight").innerText = tag.weight;
    document.getElementById("printTemp").innerText = tag.printTemp;
    document.getElementById("bedTemp").innerText = tag.bedTemp;
    document.getElementById("density").innerText = tag.density;
    
    document.getElementById("colorHex").style.backgroundColor = "#" + tag.colorHex;
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
