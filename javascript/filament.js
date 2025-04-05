const BambuColorsTest = {
    WHITE: Symbol("FFFFFF"),
    YELLOW: Symbol("FFF144"),
    YELLOW_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("0ACC38"),
    GREEN: Symbol("057748"),
    BLUE_GREY: Symbol("0D6284"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    LIME_GREEN: Symbol("DCF478"),
    
};
Object.freeze(BambuColorsTest);

/*
https://github.com/bambulab/BambuStudio/blob/733531b1c68e755da991c9503a09c2206c2e4984/src/slic3r/GUI/AMSMaterialsSetting.cpp#L1398-L1425
0xFFFFFF 0xfff144 0xDCF478 0x0ACC38 0x057748 0x0d6284 0x0EE2A0 0x76D9F4 0x46a8f9 0x2850E0 0x443089 0xA03CF7 0xF330F9 0xD4B1DD 0xf95d73 0xf72323 0x7c4b00 0xf98c36 0xfcecd6 0xD3C5A3 0xAF7933 0x898989 0xBCBCBC 0x161616
*/
const BambuColors = ["FFFFFF", "fff144", "DCF478", "0ACC38", "057748", "0d6284", "0EE2A0", "76D9F4", "46a8f9", "2850E0", "443089", "A03CF7", "F330F9", "D4B1DD", "f95d73", "f72323", "7c4b00", "f98c36", "fcecd6", "D3C5A3", "AF7933", "898989", "BCBCBC", "161616"]

// Find the color value that has the smallest combined difference between all three RGB values
// IDK if this is the best approach, but better than nothing
function closestBambuColor(colorHex) {
    if (colorHex.length != 6) {
        return "";
    }
    
    let x = "0x" + colorHex[0] + colorHex[1];
    let y = "0x" + colorHex[4] + colorHex[3];
    let z = "0x" + colorHex[4] + colorHex[5];
    let r = Number(x);
    let g = Number(y);
    let b = Number(z);
    
    let diff = [];
    
    BambuColors.forEach((ch, i) => {
        let x1 = "0x" + ch[0] + ch[1];
        let y1 = "0x" + ch[4] + ch[3];
        let z1 = "0x" + ch[4] + ch[5];
        
        let r2 = Number(x1);
        let g2 = Number(y1);
        let b2 = Number(z1);
        
        let rd = Math.abs(r2-r);
        let gd = Math.abs(g2-g);
        let bd = Math.abs(b2-b);
        diff.push(rd+gd+bd);
    });
    
    //console.log(diff);
    
    let best = 256*3;
    let bestI = 0;
    diff.forEach((d, i) => {
        if (d < best) {
            best = d;
            bestI = i;
        }
    });
    
    return BambuColors[bestI];
}

class filamentOpenTag {
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
class filamentOpenSpool {
    static protocol = "openspool";
    static version = "1.0";
    static delim = "|";
    
    constructor(type, colorHex, brand, minTemp, maxTemp) {
        this.type = type;
        this.colorHex = colorHex;
        this.brand = brand;
        this.minTemp = minTemp;
        this.maxTemp = maxTemp;
    }
    
    static newEmpty() {
        return new filamentOpenSpool("", "", "", "", "");
    }
    
    isValidFormat(data) {
        header = this.protocol + this.version + this.delim;
        headerLen = header.length;
        if (data.substring(0,headerLen) == header) {
            return true;
        }
        return false;
    }
    
    parseDataString(data) {
        if (! this.isValidFormat(data)) {
            return null;
        }
        
        let fields = data.split(this.delim);
        try {
            this.type = fields[1];
            this.colorHex = fields[2];
            this.brand = fields[3];
            this.minTemp = fields[4];
            this.maxTemp = fields[5];
        } catch (e) {
            console.log(e);
        }
    }
    
    // Return the data that should be placed in a QR code
    toDataString() {
        let str = this.protocol + this.version + this.delim;
        str += this.type + this.delim;
        str += this.colorHex + this.delim;
        str += this.brand + this.delim;
        str += this.minTemp + this.delim;
        str += this.maxTemp + this.delim;
        return str;
    }
}

function parseDataString(data) {
    let tmpData = data;
    let tag = new filamentOpenTag();
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

function displayTag(tag) {
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
