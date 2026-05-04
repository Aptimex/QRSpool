#!/usr/bin/env python3
"""
Bambu Lab local MQTT client.
Queries all printers listed in a printers.json file simultaneously
and writes each response set to its own file.

Usage:
    python mqttDump.py [--config /path/to/printers.json]

The config file follows the same format as printers.example.json.
Defaults to printers.json in the same directory as this script.
"""

import argparse
import json
import ssl
import sys
import time
import threading
from pathlib import Path
import paho.mqtt.client as mqtt

MQTT_PORT = 8883
MQTT_USER = "bblp"
TIMEOUT   = 30  # seconds to wait for all responses

COMMANDS = {
    "get_version": {
        "info": {
            "sequence_id": "1",
            "command": "get_version",
        }
    },
    "pushall": {
        "pushing": {
            "sequence_id": "2",
            "command": "pushall",
            "version": 1,
            "push_target": 1,
        }
    },
}


def _pretty(obj: dict) -> str:
    return json.dumps(obj, indent=2)


def _make_tls_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


class PrinterClient:
    def __init__(self, label: str, ip: str, device_id: str, access_code: str):
        self.label       = label
        self.ip          = ip
        self.device_id   = device_id
        self.access_code = access_code
        self.topic_req    = f"device/{device_id}/request"
        self.topic_report = f"device/{device_id}/report"
        self.pending  = set(COMMANDS.keys())
        self.received = {}
        self.done     = threading.Event()

        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._client.username_pw_set(MQTT_USER, access_code)
        self._client.tls_set_context(_make_tls_context())
        self._client.on_connect    = self._on_connect
        self._client.on_message    = self._on_message
        self._client.on_disconnect = self._on_disconnect

    # ── MQTT callbacks ────────────────────────────────────────────────────────

    def _on_connect(self, client, userdata, connect_flags, reason_code, properties=None):
        if not reason_code.is_failure:
            print(f"[{self.label}] Connected to {self.ip}:{MQTT_PORT}")
            client.subscribe(self.topic_report)
            for name, payload in COMMANDS.items():
                client.publish(self.topic_req, json.dumps(payload))
                print(f"[{self.label}] Sent {name}")
        else:
            print(f"[{self.label}] Connection failed: {reason_code!s}")
            self.done.set()

    def _on_message(self, client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode())
        except json.JSONDecodeError:
            print(f"[{self.label}] Non-JSON payload: {msg.payload!r}")
            return

        if "info" in data and data["info"].get("command") == "get_version":
            self._accept("get_version", data)
        elif "print" in data and data["print"].get("command") == "push_status":
            self._accept("pushall", data)
        elif self.pending:
            # Unsolicited push_status variant — accept as pushall if still waiting
            top = next(iter(data))
            if isinstance(data[top], dict) and "pushall" in self.pending:
                self._accept("pushall", data)

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None):
        if reason_code.is_failure:
            print(f"[{self.label}] Unexpected disconnect: {reason_code!s}")

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _accept(self, name: str, data: dict):
        if name not in self.pending:
            return
        self.pending.discard(name)
        self.received[name] = data
        print(f"[{self.label}] Received {name}")
        if not self.pending:
            self.done.set()

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self):
        print(f"[{self.label}] Connecting to {self.ip}:{MQTT_PORT} ...")
        try:
            self._client.connect(self.ip, MQTT_PORT, keepalive=60)
        except OSError as exc:
            print(f"[{self.label}] Could not connect: {exc}")
            self.done.set()
            return
        self._client.loop_start()

    def stop(self):
        self._client.loop_stop()
        self._client.disconnect()

    def write_results(self, output_dir: Path):
        out = output_dir / f"{self.label}_{self.device_id}.json"
        out.write_text(_pretty(self.received))
        print(f"[{self.label}] Results written to {out}")


def load_config(config_path: Path) -> list[dict]:
    if not config_path.exists():
        sys.exit(f"Config file not found: {config_path}\nCopy printers.example.json to printers.json and fill in your printer details.")
    with config_path.open() as f:
        cfg = json.load(f)
    if not isinstance(cfg, list) or not cfg:
        sys.exit("Config must be a non-empty JSON array of printer objects.")
    return cfg


def main():
    default_config = Path(__file__).parent / "printers.json"
    parser = argparse.ArgumentParser(description="Dump MQTT data from Bambu printers.")
    parser.add_argument("--config", type=Path, default=default_config,
                        help=f"Path to printers.json (default: {default_config})")
    args = parser.parse_args()

    printer_cfgs = load_config(args.config)
    printers = [
        PrinterClient(p["name"], p["ip"], p["serial"], p["access_code"])
        for p in printer_cfgs
    ]

    for p in printers:
        p.start()

    deadline = time.time() + TIMEOUT
    try:
        for p in printers:
            remaining = max(0.0, deadline - time.time())
            p.done.wait(timeout=remaining)
    except KeyboardInterrupt:
        print("\n[!] Interrupted by user.")
    finally:
        for p in printers:
            p.stop()

    output_dir = Path(".")
    all_ok = True
    for p in printers:
        if p.pending:
            print(f"[{p.label}] Timed out waiting for: {', '.join(p.pending)}")
            all_ok = False
        if p.received:
            p.write_results(output_dir)

    print("\n[+] Done." if all_ok else "\n[-] Finished with errors (see above).")


if __name__ == "__main__":
    main()
