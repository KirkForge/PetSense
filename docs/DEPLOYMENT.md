# PetSense Deployment Guide

PetSense has three deployable components. This guide covers a single-node
home/LAN deployment on a Raspberry Pi 5 (edge hub) plus ESP32-S3 firmware nodes
and a static Svelte PWA. See `docs/adr/` for architecture rationale.

## 1. Edge hub (RPi5, Node/TS)

### Prerequisites
- Node.js 20+ on the RPi5.
- An ONNX model at `models/petsense-v0.onnx` (see `models/` for training/export).

### Install & run (dev)
```
cd edge-hub
npm install
npm run dev          # tsx src/index.ts
```

### Production build
```
npm install
npm run build        # tsc -> dist/
npm start            # node dist/index.js
```

### Configuration
The hub reads `edge-hub/config.yaml` at startup (rooms, nodes, zones, MQTT
ports, API port). Missing/invalid config falls back to defaults
(MQTT `1883`/`8083`, API `3000`). Override paths via env if needed:
- `PETSENSE_DB_PATH` — SQLite path (default `petsense.db`)
- `PETSENSE_MODEL_PATH` — ONNX model path (default `models/petsense-v0.onnx`)

### systemd unit
`/etc/systemd/system/petsense-hub.service`:
```
[Unit]
Description=PetSense edge hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/petsense/edge-hub
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
User=petsense

[Install]
WantedBy=multi-user.target
```
Then `sudo systemctl enable --now petsense-hub`.

## 2. Firmware (ESP32-S3)

1. `cd firmware && cp src/secrets.h.template src/secrets.h` and fill in real
   WiFi + MQTT broker values. `secrets.h` is gitignored.
2. `pio run -t upload` (PlatformIO). See `firmware/platformio.ini` for board/pins.

The node publishes CSI packets to `csi/<NODE_ID>/<timestamp>`.

## 3. App (Svelte 5 PWA)

```
cd app
npm install
npm run build       # static output in dist/ (or build/)
```
Serve `dist/` behind any static host / reverse proxy. The default WebSocket URL
is derived from the page origin: `wss://` when served over HTTPS, `ws://` over
HTTP. Override per-client via `localStorage['petsense-hub-url']`.

### Reverse proxy + TLS (nginx)

To use `wss://` and HTTPS, terminate TLS in front of the hub. nginx snippet:
```
server {
    listen 443 ssl http2;
    server_name petsense.lan;
    ssl_certificate     /etc/letsencrypt/live/petsense.lan/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/petsense.lan/privkey.pem;

    location / {
        root /var/www/petsense-app;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/realtime {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }
}
```
Cert instructions: `certbot --nginx -d petsense.lan` (or self-signed for LAN
only).

## Operational notes
- The SQLite DB uses WAL journaling; files `petsense.db`, `*.db-wal`,
  `*.db-shm` are gitignored.
- The DB is **not encrypted at rest** — keep the RPi5 filesystem secured
  (full-disk encryption / restricted physical access). See SECURITY.md.
- Logs are plain `console.*` for now; redirect stdout/stderr in systemd
  (`StandardOutput=journal`) and inspect with `journalctl -u petsense-hub`.

## Troubleshooting
- **`[api] listening` not appearing** → port in use; check `config.yaml`
  `api.port` and `ss -ltnp`.
- **`mqttConnected: false` in `/api/health`** → broker TCP server failed to
  bind; verify `mqtt.port` is free.
- **`modelLoaded: false`** → ONNX model path missing or wrong format; check
  `PETSENSE_MODEL_PATH`.
- **App cannot connect** → confirm the hub URL port matches `api.port`, and
  that the reverse proxy upgrades `/api/realtime` (see nginx block above).
- **Firmware not publishing** → verify `secrets.h` MQTT broker IP matches the
  RPi5; watch `Serial` output at 115200 baud.