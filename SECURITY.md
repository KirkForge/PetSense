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
PetSense runs on a trusted home LAN. The default deployment assumes:
- The edge hub (RPi5) is on a private network segment.
- ESP32 firmware nodes are physically controlled.
- The web app is served to trusted household members.

Out of that trust boundary, the following are **known limitations** (not
covered by current code):

1. **Database is not encrypted at rest.** Location history on the RPi5
   filesystem is plaintext SQLite (`better-sqlite3`). Use full-disk
   encryption for the RPi5. (Planned: migration to
   `better-sqlite3-multiple-ciphers` — see `edge-hub/src/db.ts` migration
   runner, but the encryption swap itself is not yet implemented.)
2. **MQTT broker uses plain TCP.** `firmware/src/main.cpp` uses
   `WiFiClient` (not `WiFiClientSecure`). MQTT over TLS (port 8883) is
   not yet wired.
3. **Firmware OTA updates have no real cryptographic verification.**
   `firmware/src/ota.cpp` implements a stub signature check (length,
   magic prefix, test key comparison). Real Ed25519 verification is
   TODO(crypto).

## What is in place
Every claim below cites the file and line that implements it.

- `firmware/src/secrets.h` is gitignored (`.gitignore:68`) and is not tracked
  (`git ls-files firmware/src/secrets.h` returns nothing). The tracked source is
  `firmware/src/secrets.h.template`, which contains placeholders only. History
  was audited with `git log -p --follow firmware/src/secrets.h` and never
  contained real credentials, so there is no credential leak to rotate and no
  history scrub required.
- `firmware/src/ota.key` is gitignored (`.gitignore:69`). The tracked source is
  `firmware/src/ota.template`, which contains test placeholders only. Real
  signing keys must never be committed.
- The app ships a Content-Security-Policy meta tag in `app/index.html`.
- The edge-hub TypeScript is type-checked by CI (`npx tsc --noEmit`) on every
  push (`.github/workflows/ci.yml:42-44`).
- Hub request bodies are capped at 1 MiB; `readBody` in
  `edge-hub/src/api-server.ts` destroys the stream and returns `413` on
  overflow.
- `POST /api/zones` validates that `id` and `name` are non-empty strings,
  `bounds` is an object with numeric `x1`, `y1`, `x2`, `y2`, and `type` is one
  of `alert`, `safe`, or `notify` — returns `400` on violation
  (`edge-hub/src/api-server.ts:validateZone`). `DELETE /api/zones` validates
  `id` as a non-empty string the same way.
- MQTT broker authentication is wired: `edge-hub/src/auth.ts:48` uses
  `crypto.timingSafeEqual` for credential comparison via `aedes.authenticate`.
- REST API bearer-token auth and rate limiting are in place:
  `edge-hub/src/api-server.ts:87` validates the `Authorization: Bearer` header;
  `edge-hub/src/api-server.ts:80` enforces a 120-request/minute rate limit per IP.
- CORS is allowlist-gated by default (`edge-hub/src/api-server.ts:setCORS`).
  The `Access-Control-Allow-Origin: *` fallback is only enabled behind the
  `PETSENSE_CORS_OPEN=1` environment variable (dev escape hatch).
- API server and MQTT broker bind to `127.0.0.1` by default
  (`edge-hub/src/api-server.ts:30`, `edge-hub/src/mqtt-broker.ts:87`). A
  non-loopback bind logs a startup WARNING naming the exposure
  (`edge-hub/src/api-server.ts:44`).
- TLS is configurable via `edge-hub/config.yaml` (`api.tls.enabled`,
  `api.tls.certFile`, `api.tls.keyFile`); `edge-hub/src/api-server.ts:51`
  replaces the HTTP server with HTTPS when TLS is enabled.
- Structured logging uses pino (`edge-hub/src/logger.ts`) with a `child()`
  helper that adds a `module` field. All `console.*` calls have been replaced.
- PWA service worker is configured via `VitePWA` in `app/vite.config.ts` with
  NetworkFirst caching for `/api/health` and `/api/data`.

## Hardening checklist for exposed deployments
- [ ] Swap `better-sqlite3` for `better-sqlite3-multiple-ciphers` (encryption at rest).
- [ ] Wire MQTT over TLS (`WiFiClientSecure` in firmware, TLS in `mqtt-broker.ts`).
- [ ] Replace OTA signature stub with real Ed25519 verification
      (`firmware/src/ota.cpp` TODO(crypto)).
- [ ] Validate the ONNX model on real-world CSI data (`models/MODEL_CARD.md`
      documents `val_metrics=None`; synthetic-only training is the current state).
- [ ] Run the hub under a dedicated unprivileged user (systemd `User=petsense`).