# PetSense Edge Hub API

The edge hub exposes a small HTTP/JSON API on `api.port` (default `3000`, see
`edge-hub/config.yaml`) and a WebSocket realtime stream at `/api/realtime`.

## REST endpoints

### `GET /api/health`
Liveness + component status. Returns:
```json
{
  "status": "ok",
  "uptime": 12345,
  "mqttConnected": true,
  "modelLoaded": true
}
```
`mqttConnected` and `modelLoaded` are **currently hardcoded to `true`** at
`edge-hub/src/index.ts:32` — the hub does not run today (see `PIVOT.md`), so
health does not yet reflect live broker/model state. Wire live status when the
hub is brought online. `status` and `uptime` are real.

### `GET /api/pets/location`
Current per-pet Kalman-tracked positions. Returns:
```json
{
  "pets": [
    { "id": "dog", "x": 3.2, "y": 1.1, "vx": 0.1, "vy": -0.05 }
  ]
}
```

### `GET /api/events`
Recent alerts (in-memory) plus the last 50 persisted DB events. Returns:
```json
{ "alerts": [ { ... } ], "events": [ { ... } ] }
```

### `GET /api/zones`
List configured alert zones from the DB. Returns `{ "zones": [ ... ] }`.

### `POST /api/zones`
Upsert a zone. Request body (JSON, max 1 MiB):
```json
{ "id": "kitchen-alert", "name": "kitchen-alert", "bounds": { "x1": 6, "y1": 0, "x2": 10, "y2": 5 }, "type": "alert" }
```
All four fields are required. `id` and `name` must be non-empty strings.
`bounds` must be an object with numeric `x1`, `y1`, `x2`, `y2` fields.
`type` must be one of `alert`, `safe`, or `notify`.
Runtime validation at `edge-hub/src/api-server.ts:validateZone()` returns `400`
with a descriptive error on violation. Returns `{ "ok": true }` on success,
`413` if the body exceeds 1 MiB.

### `DELETE /api/zones`
Delete a zone by id. Request body (JSON): `{ "id": "<zone-id>" }`.
Returns `{ "ok": true }`, `400` on invalid body, `413` if too large.

### CORS
`Access-Control-Allow-Origin` is currently `*` (open on LAN; tighten before
exposing the hub to untrusted networks — see SECURITY.md). Allowed methods:
`GET, POST, DELETE, OPTIONS`.

## WebSocket realtime stream

Connect to `ws://<hub-host>:<api-port>/api/realtime` (use `wss://` behind a TLS
reverse proxy — see `docs/DEPLOYMENT.md`).

Server-to-client messages (JSON):

| `type`         | `data`                                                          |
|----------------|-----------------------------------------------------------------|
| `pet_location` | `{ id, species, name?, position: {x,y}, room, activity, confidence }` |
| `alert`        | `{ id, type, message, timestamp, petId? }`                       |
| `pong`         | (none) — reply to client `ping`                                 |

Client-to-server messages:

| `type` | purpose                      |
|-------|------------------------------|
| `ping` | heartbeat; server replies `pong` |

The browser client (`app/src/lib/api.ts`) auto-reconnects with exponential
backoff (1s → 30s cap, reset to 1s on open) and sends a `ping` every 15s.