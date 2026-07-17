# Security Policy

## Supported versions
PetSense is a research / home-lab project. Security fixes land on `main` only;
there are no backport branches. Run the latest `main`.

## Reporting a vulnerability
Report security issues privately — **do not open a public GitHub issue**.
Email: security@kirkforge.dev (replace with your real contact) with a
description, repro steps, and impact. You should receive a response within
72 hours. Coordinated disclosure is fine; please allow a reasonable window
before any public disclosure.

## Threat model
> **Status (2026-07):** the edge hub and app are deferred integration work, not
> a running system (see `PIVOT.md` — `loadModel` throws with no ONNX model, and
> `index.ts:32` hardcodes status literals). The only running component today is
> the ESP32-S3 firmware CSI node. The threats below describe the *intended*
> deployment for when the hub is brought online.

PetSense runs on a trusted home LAN. The default deployment assumes:
- The edge hub (RPi5) is on a private network segment.
- ESP32 firmware nodes are physically controlled.
- The web app is served to trusted household members.

Out of that trust boundary, the following are **known limitations** (not
covered by current code):

1. **MQTT broker has no authentication.** Anyone on the LAN can publish CSI
   packets or subscribe. Restrict at the network layer (VLAN / firewall) or
   put the broker behind a VPN until `aedes.authenticate` is wired
   (tracked in `state.md` gap 2).
2. **REST API has no auth / rate limiting.** `/api/zones` and other routes are
   open. Do not expose `api.port` (default 3000) to untrusted networks without
   a reverse proxy that adds auth.
3. **CORS is `*`.** `setCORS` in `api-server.ts` allows any origin. Tighten to
   your app origin before exposing the hub.
4. **Database is not encrypted at rest.** Location history on the RPi5
   filesystem is plaintext SQLite. Use full-disk encryption for the RPi5.
5. **WebSocket is `ws://` by default.** Use `wss://` behind a TLS reverse
   proxy (see `docs/DEPLOYMENT.md`).
6. **`/api/health` returns hardcoded status.** `index.ts:32` passes literal
   `mqttConnected: true, modelLoaded: true` to the API server, so health reports
   `true` regardless of real broker/model state. Wire live status when the hub
   is brought online.

## What is in place
- `firmware/src/secrets.h` is gitignored; copy `firmware/src/secrets.h.template`
  and fill in real WiFi/MQTT values. The template (placeholders only) is the
  tracked source; the real file is never committed.
- The app ships a Content-Security-Policy meta tag in `app/index.html`.
- The edge-hub TypeScript is type-checked by CI (`tsc --noEmit`) on every push.
- Hub request bodies are capped at 1 MiB; `readBody` in `api-server.ts`
  destroys the stream and returns `413` on overflow.
- `POST /api/zones` validates that `id`, `name`, `bounds`, `type` are non-empty
  strings (`400` on violation) before reaching `db.upsertZone`; `DELETE` validates
  `id` the same way.

## Hardening checklist for exposed deployments
- [ ] Wire MQTT broker authentication (`aedes.authenticate`).
- [ ] Add bearer-token middleware + rate limiting to the REST API.
- [ ] Replace `Access-Control-Allow-Origin: *` with the app origin.
- [ ] Terminate TLS in front of the hub (nginx + certbot).
- [ ] Encrypt the RPi5 filesystem (LUKS).
- [ ] Run the hub under a dedicated unprivileged user (systemd `User=petsense`).