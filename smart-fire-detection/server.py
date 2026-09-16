import json
import os
import random
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "fire.db")
STATIC_DIR = os.path.join(BASE, "static")

SMOKE_LIMIT = 400
TEMP_LIMIT = 50.0
VISION_LIMIT = 0.55

db_lock = threading.Lock()
state = {"vision_smoke": 0.0, "demo_until": 0.0, "buzzer": False, "last_hw_ts": 0.0}


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with open(os.path.join(BASE, "schema.sql"), "r") as f:
        script = f.read()
    conn = get_db()
    conn.executescript(script)
    conn.commit()
    conn.close()


def decide(smoke, temp, flame, vision):
    reasons = []
    if smoke > SMOKE_LIMIT:
        reasons.append("Smoke/gas %d > %d" % (smoke, SMOKE_LIMIT))
    if temp > TEMP_LIMIT:
        reasons.append("Temperature %.1fC > %.1fC" % (temp, TEMP_LIMIT))
    if flame == 1:
        reasons.append("Flame sensor triggered")
    if vision >= VISION_LIMIT:
        reasons.append("Camera smoke pattern %.2f" % vision)

    if len(reasons) >= 2:
        level = "FIRE"
    elif len(reasons) == 1:
        level = "WARNING"
    else:
        level = "NORMAL"
    return level, " | ".join(reasons) if reasons else "All parameters normal"


def save_reading(smoke, temp, humidity, flame, vision, source):
    level, reason = decide(smoke, temp, flame, vision)
    with db_lock:
        conn = get_db()
        cur = conn.execute(
            "INSERT INTO readings (smoke, temperature, humidity, flame, vision_smoke, level, source)"
            " VALUES (?,?,?,?,?,?,?)",
            (smoke, temp, humidity, flame, vision, level, source),
        )
        reading_id = cur.lastrowid
        if level != "NORMAL":
            conn.execute(
                "INSERT INTO alerts (level, reason, reading_id) VALUES (?,?,?)",
                (level, reason, reading_id),
            )
        conn.commit()
        conn.close()
    state["buzzer"] = level == "FIRE"
    return reading_id, level, reason


def simulator():
    while True:
        if time.time() - state["last_hw_ts"] < 5:
            time.sleep(1)
            continue
        fire_mode = time.time() < state["demo_until"]
        if fire_mode:
            smoke = random.randint(520, 780)
            temp = round(random.uniform(55, 72), 1)
            humidity = round(random.uniform(20, 35), 1)
            flame = 1
        else:
            smoke = random.randint(90, 240)
            temp = round(random.uniform(26, 34), 1)
            humidity = round(random.uniform(45, 65), 1)
            flame = 0
        save_reading(smoke, temp, humidity, flame, state["vision_smoke"], "sim")
        time.sleep(2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path):
        types = {".html": "text/html", ".css": "text/css", ".js": "application/javascript"}
        ext = os.path.splitext(path)[1]
        if not os.path.isfile(path):
            self.send_error(404)
            return
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", types.get(ext, "text/plain"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except ValueError:
            return {}

    def do_GET(self):
        url = urlparse(self.path)
        route = url.path

        if route == "/" or route == "/index.html":
            return self.send_file(os.path.join(STATIC_DIR, "index.html"))

        if route.startswith("/static/"):
            name = os.path.basename(route)
            return self.send_file(os.path.join(STATIC_DIR, name))

        if route == "/api/latest":
            conn = get_db()
            row = conn.execute(
                "SELECT * FROM readings ORDER BY id DESC LIMIT 1"
            ).fetchone()
            conn.close()
            if row is None:
                return self.send_json({"status": "empty"})
            data = dict(row)
            data["buzzer"] = data["level"] == "FIRE"
            data["reason"] = decide(
                data["smoke"], data["temperature"], data["flame"], data["vision_smoke"]
            )[1]
            return self.send_json(data)

        if route == "/api/history":
            limit = int(parse_qs(url.query).get("limit", ["30"])[0])
            conn = get_db()
            rows = conn.execute(
                "SELECT id, ts, smoke, temperature, vision_smoke, level"
                " FROM readings ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            conn.close()
            return self.send_json([dict(r) for r in rows][::-1])

        if route == "/api/alerts":
            limit = int(parse_qs(url.query).get("limit", ["15"])[0])
            conn = get_db()
            rows = conn.execute(
                "SELECT * FROM alerts ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            conn.close()
            return self.send_json([dict(r) for r in rows])

        self.send_error(404)

    def do_POST(self):
        route = urlparse(self.path).path
        body = self.read_json()

        if route == "/api/reading":
            source = body.get("source", "esp32")
            if source != "sim":
                state["last_hw_ts"] = time.time()
            rid, level, reason = save_reading(
                int(body.get("smoke", 0)),
                float(body.get("temperature", 0)),
                float(body.get("humidity", 0)),
                int(body.get("flame", 0)),
                float(body.get("vision_smoke", state["vision_smoke"])),
                source,
            )
            return self.send_json({"id": rid, "level": level, "reason": reason,
                                   "buzzer": level == "FIRE"})

        if route == "/api/vision":
            state["vision_smoke"] = round(float(body.get("confidence", 0)), 2)
            return self.send_json({"vision_smoke": state["vision_smoke"]})

        if route == "/api/demo":
            seconds = int(body.get("seconds", 20))
            state["demo_until"] = time.time() + seconds if body.get("on", True) else 0
            return self.send_json({"demo": body.get("on", True), "seconds": seconds})

        if route == "/api/reset":
            with db_lock:
                conn = get_db()
                conn.execute("DELETE FROM alerts")
                conn.execute("DELETE FROM readings")
                conn.commit()
                conn.close()
            return self.send_json({"cleared": True})

        self.send_error(404)


if __name__ == "__main__":
    init_db()
    threading.Thread(target=simulator, daemon=True).start()
    print("Dashboard: http://localhost:8000")
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
