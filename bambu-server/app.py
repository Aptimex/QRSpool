from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from flask_basicauth import BasicAuth
import json
import bambu
import time
from threading import Timer
from base64 import b64encode, b64decode

from bambu_config import AUTH_USER, AUTH_PASS

app = Flask(__name__)
CORS(app) # allow CORS for all domains on all routes.
# CORS(app, origins=["http://localhost:3000"]) # Allow CORS from specific domains for better security

app.config['BASIC_AUTH_USERNAME'] = AUTH_USER
app.config['BASIC_AUTH_PASSWORD'] = AUTH_PASS
basic_auth = BasicAuth(app)

CONNECTED = False
T: Timer = None
TIMEOUT = 5*60 #make negative to disable the auto-disconnect

BASIC_AUTH = None

def connect():
    global CONNECTED
    global T
    
    if CONNECTED:
        return
    bambu.connect()
    CONNECTED = True
    time.sleep(3) # Give it some time to fully connect
    
    if TIMEOUT > 0:
        T = Timer(TIMEOUT, disconnect)
        T.cancel()
        T.start()
    
def disconnect():
    global CONNECTED
    global T
    if not CONNECTED or not T:
        return
    T.cancel()
    CONNECTED = False

def makeError(msg):
    return {"error": msg}

def makeWarning(msg):
    return {"warning": msg}

def setAuth():
    global BASIC_AUTH
    
    # Verify that the credential can be properly accessed and encoded
    try:
        cred = f"{AUTH_USER}:{AUTH_PASS}"
        BASIC_AUTH = b64encode(bytes(cred, "utf-8")).decode("utf-8")
    except Exception as e:
        print(e)
        BASIC_AUTH = None
setAuth()


class FilamentData(object):
    def __init__(self, type, brand, colorHex, minTemp = 0, maxTemp = 0):
        #super(FilamentData, self).__init__()
        self.type = type
        self.brand = brand
        self.colorHex = colorHex
        self.minTemp = minTemp
        self.maxTemp = maxTemp

class OpenSpoolData(object):
    #def __init__(self, header, type, brand, colorHex, minTemp = 0, maxTemp = 0):
    def __init__(self, type, brand, colorHex, minTemp = 0, maxTemp = 0):
        #super(OpenSpoolData, self).__init__()
        #self.header = header
        self.type = type
        self.brand = brand
        self.colorHex = colorHex
        self.minTemp = minTemp
        self.maxTemp = maxTemp

class OpenSpoolBambuSlot(OpenSpoolData):
    #def __init__(self, ids, header, type, brand, colorHex, minTemp = 0, maxTemp = 0):
    def __init__(self, ids, type, brand, colorHex, minTemp = 0, maxTemp = 0):
        #super(OpenSpoolData, self).__init__(header, type, brand, colorHex, minTemp, maxTemp)
        super().__init__(type, brand, colorHex, minTemp, maxTemp)
        self.amsID = ids["amsID"]
        self.slotID = ids["slotID"]
        self.displayID = f"AMS #{self.amsID} | Slot #{self.slotID}"
    

@app.route("/")
def hello_world():
    return "<p>Server Up</p>"

@app.route("/serverStatus")
def serverStatus():
    authRequired = False
    authCorrect = None
    if BASIC_AUTH != None:
        authRequired = True
        
        authHeader = None
        try:
            authHeader = request.headers.get('Authorization')
        except KeyError as e:
            print("Authorization header not found")
        print(f"Authorization header: {authHeader}")
            
        if authHeader:
            targetHeader = f"Basic {BASIC_AUTH}"
            print(f"Expected header: {targetHeader}")
            if authHeader == targetHeader:
                authCorrect = True
            else:
                authCorrect = False
    
    
    
    status = {
        "status": "running",
        "authRequired": authRequired,
        "authCorrect": authCorrect
    }
    return jsonify(status)

@app.route("/printerStatus")
@basic_auth.required
def printerStatus():
    return jsonify(bambu.getPrinterStatus())

@app.route("/amsinfo")
@basic_auth.required
def AMSInfo():
    connect()
    p = bambu.getAMSInfo()
    return jsonify(p)

@app.route("/slots")
@basic_auth.required
def getAMSInfo():
    connect()
    p = bambu.getSlots()
    return jsonify(p)
    

@app.route("/setFilamentOld/<amsIndex>/<trayIndex>", methods=['PUT', 'POST'])
@basic_auth.required
def setFilamentOld(amsIndex, trayIndex):
    '''
    expectedKeys = ["type", "brand", "colorHex"]
    optionalKeys = ["minTemp", "maxTemp"]
    
    try:
        data = json.loads(request.data)
    except Exception as e:
        return makeError(e)
    
    for ek in expectedKeys:
        if ek not in data.keys():
            return makeError(f"Missing expected data '{ek}'")
    fType = data["type"]
    fBrand = data["brand"]
    fColor = data["colorHex"]
    '''
    
    try:
        data = json.loads(request.data)
        print(data)
        fData = FilamentData(**data)
    except Exception as e:
        print(e)
        return makeError(e.message)
    
    connect()
    good, result = bambu.setFilament(amsIndex, trayIndex, fData.colorHex, fData.brand, fData.type, fData.minTemp, fData.maxTemp)
    if not good:
        return jsonify({"error": result})
    return jsonify({"success": result})


@app.route("/setFilament", methods=['PUT', 'POST'])
@basic_auth.required
def setFilament():
    try:
        data = json.loads(request.data)
        print(data)
        fData = OpenSpoolBambuSlot(**data)
    except Exception as e:
        print(e)
        return makeError(str(e))
    
    connect()
    #print(fData.__dict__)
    good, result = bambu.setFilament(fData.amsID, fData.slotID, fData.colorHex, fData.brand, fData.type, fData.minTemp, fData.maxTemp)
    if not good:
        return jsonify({"error": result})
    return jsonify({"success": result})
    
    
#if __name__ == '__main__':
    #context = ('cert.pem', 'key.pem')#certificate and key files
    #app.run(debug=True, ssl_context=context)
    
    
    
    
