#!/usr/bin/env python3

'''
Query which certificates are currently trusted by a Bambu Lab printer.
'''

import json, ssl, time
try:
    import paho.mqtt.client as mqtt
except ImportError:
    raise SystemExit("paho-mqtt is required: pip install paho-mqtt")


PRINTER_IP = "192.168.1.100"
ACCESS_CODE = "12345678"
SERIAL = "0123456789ABCDE"

def query_certs(host, code, serial, timeout=8.0):
    out = {}
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    c.username_pw_set("bblp", code)
    c.tls_set_context(ctx)

    def on_connect(c, *_):
        c.subscribe(f"device/{serial}/report")
        c.publish(f"device/{serial}/request", json.dumps({"security": {
            "command": "app_cert_list", "sequence_id": "qcl",
            "timestamp": int(time.time()), "type": "app"}}))

    def on_message(_c, _ud, msg):
        sec = json.loads(msg.payload).get("security", {})
        if sec.get("command") == "app_cert_list":
            out.update(result=sec.get("result"), cert_ids=sec.get("cert_ids", []))

    c.on_connect = on_connect
    c.on_message = on_message
    c.connect(host, 8883, keepalive=30)
    c.loop_start()
    deadline = time.time() + timeout
    while time.time() < deadline and not out:
        time.sleep(0.1)
    c.loop_stop()
    c.disconnect()
    return out

r = query_certs(PRINTER_IP, ACCESS_CODE, SERIAL)
ids = r.get("cert_ids", [])
print(f"result={r.get('result')}  certs_trusted={len(ids)}")
for cid in ids:
    print(f"  {cid}")