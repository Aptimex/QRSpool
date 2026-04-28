from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from flask_basicauth import BasicAuth
import json
import bambu
import time
from threading import Timer
from base64 import b64encode, b64decode

from configs.config_loader import AUTH_USER, AUTH_PASS, INACTIVITY_TIMEOUT, PRINTERS

app = Flask(__name__)
CORS(app) # allow CORS for all domains on all routes.
# CORS(app, origins=["http://localhost:3000"]) # Allow CORS from specific domains for better security

SERVER_VERSION = "0.5.0"

app.config['BASIC_AUTH_USERNAME'] = AUTH_USER
app.config['BASIC_AUTH_PASSWORD'] = AUTH_PASS
basic_auth = BasicAuth(app)

CONNECTED = False
T: Timer = None

BASIC_AUTH = None

def connect():
    global CONNECTED
    global T
    
    if CONNECTED:
        return
    bambu.connect()
    CONNECTED = True
    time.sleep(3) # Give it some time to fully connect
    
    if INACTIVITY_TIMEOUT > 0:
        T = Timer(INACTIVITY_TIMEOUT, disconnect)
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
    print(f"Error: {msg}")
    return {"error": msg}

def makeWarning(msg):
    print(f"Warning: {msg}")
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
        self.type = type
        self.brand = brand
        self.colorHex = colorHex
        self.minTemp = minTemp
        self.maxTemp = maxTemp

class OpenSpoolData(object):
    def __init__(self, type, brand, colorHex, minTemp = 0, maxTemp = 0):
        self.type = type
        self.brand = brand
        self.colorHex = colorHex
        self.minTemp = minTemp
        self.maxTemp = maxTemp

class OpenSpoolBambuSlot(OpenSpoolData):
    def __init__(self, ids, type, brand, colorHex, minTemp = 0, maxTemp = 0, colorName = "", **_):
        super().__init__(type, brand, colorHex, minTemp, maxTemp)
        self.amsID = ids["amsID"]
        self.slotID = ids["slotID"]
        self.colorName = colorName
        self.displayID = f"AMS #{self.amsID} | Slot #{self.slotID}"
    

@app.route("/")
def root():
    return redirect("/serverStatus")

@app.route("/printers")
@basic_auth.required
def printers():
    names = [p.get("name") or p.get("ip", f"Printer {i+1}") for i, p in enumerate(PRINTERS)]
    return jsonify(names)

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
        "authCorrect": authCorrect,
        "serverVersion": SERVER_VERSION
    }
    return jsonify(status)

@app.route("/printerStatus")
@basic_auth.required
def printerStatus():
    return jsonify(bambu.getPrinterStatus())

@app.route("/printerState")
@basic_auth.required
def printerState():
    return jsonify(bambu.getPrinterState())

@app.route("/slots")
@basic_auth.required
def getSlots():
    connect()
    try:
        p = bambu.getSlots()
    except Exception as e:
        return jsonify(makeError(str(e))), 500
    return jsonify(p)


@app.route("/activePrinter", methods=['GET', 'PUT', 'POST'])
@basic_auth.required
def activePrinter():
    global CONNECTED, T

    if request.method == 'GET':
        return jsonify({"name": bambu.CURRENT_PRINTER_NAME})

    # POST/PUT: switch the active printer
    try:
        data = json.loads(request.data)
    except Exception as e:
        return makeError(str(e))

    printer_name = (data.get("name") or "").strip()
    if not printer_name and len(bambu.PRINTERS_MAP) == 1:
        printer = next(iter(bambu.PRINTERS_MAP.values()))
        printer_name = next(iter(bambu.PRINTERS_MAP.keys()))
    elif printer_name:
        printer_name, printer = bambu.findPrinterByName(printer_name)
        if printer is None:
            return makeError(f"Unknown printer '{printer_name}'. Known printers: {list(bambu.PRINTERS_MAP.keys())}")
    else:
        return makeError(f"name is required when multiple printers are configured. Known printers: {list(bambu.PRINTERS_MAP.keys())}")

    # Tear down current connection before switching
    if T:
        T.cancel()
        T = None
    if CONNECTED:
        bambu.disconnect()
        CONNECTED = False

    bambu.setCurrentPrinter(printer, printer_name)
    connect()
    return jsonify({"name": printer_name})


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
    good, result = bambu.setFilament(fData.amsID, fData.slotID, fData.colorHex, fData.brand, fData.type, fData.minTemp, fData.maxTemp, fData.colorName)

    if not good:
        return makeError(result)

    # For some reason the printer won't return changed AMS data unless a new connection is established, so proactively disconnect
    disconnect()

    # Takes ~5s for new filament change to take effect, so proactively wait
    time.sleep(5)
    return jsonify({"success": result})

@app.route("/reconnect")
@basic_auth.required
def reconnect():
    disconnect()
    connect()
    return jsonify({"info": "reconnect triggered"})
