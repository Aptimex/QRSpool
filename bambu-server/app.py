from flask import Flask, jsonify, request
import json
import bambu
import time
from threading import Timer

app = Flask(__name__)

CONNECTED = False
T: Timer = None
TIMEOUT = 5*60 #make negative to disable the auto-disconnect

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

class FilamentData(object):
    def __init__(self, fType, brand, colorHex, minTemp = 0, maxTemp = 0):
        super(FilamentData, self).__init__()
        self.type = fType
        self.brand = brand
        self.colorHex = colorHex
        self.minTemp = minTemp
        self.maxTemp = maxTemp
        

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

@app.route("/amsinfo")
def getAMSInfo():
    connect()
    p = bambu.getAMSInfo()
    return jsonify(p)
    
    

@app.route("/setFilament/<amsIndex>/<trayIndex>/", methods=['PUT', 'POST'])
def setFilament(amsIndex, trayIndex):
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
        return makeError(e)
    
    connect()
    bambu.setFilament(amsIndex, trayIndex, fData.colorHex, fData.brand, fData.type, fData.minTemp, fData.maxTemp)
    
    
    
    
    
    
