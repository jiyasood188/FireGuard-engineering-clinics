CREATE TABLE IF NOT EXISTS readings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ts           TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    smoke        INTEGER NOT NULL,
    temperature  REAL    NOT NULL,
    humidity     REAL    NOT NULL,
    flame        INTEGER NOT NULL,
    vision_smoke REAL    NOT NULL DEFAULT 0,
    level        TEXT    NOT NULL,
    source       TEXT    NOT NULL DEFAULT 'sim'
);

CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    level      TEXT    NOT NULL,
    reason     TEXT    NOT NULL,
    reading_id INTEGER REFERENCES readings(id)
);

CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
CREATE INDEX IF NOT EXISTS idx_alerts_ts   ON alerts(ts);
