# PetSense — Project State

**Last updated:** 2026-07-23
**Project:** PetSense — WiFi CSI Pet Tracker
**Status:** Prototype (firmware) + Beta (edge-hub). Hub runs with auth, multilateration, rate limiting, loopback bind, zone validation, DB migrations, SQLCipher encryption, MQTT TLS flag. 85 edge-hub tests + 111 app tests pass. Grade: A.

---

## Git

```
main at 9f8459b (branch: feat/a-grade-closers, 4 commits ahead)
```

Remote: `origin git@github.com:KirkForge/PetSense.git`

---

## Components

| Component | Description | Status |
|-----------|-------------|--------|
| `firmware/` | ESP32-S3 CSI capture + MQTT publish | **Prototype** — compiles (`pio run` → SUCCESS, RAM 13.8%, Flash 20.8%). Real Ed25519 OTA verification via libsodium. MQTT TLS via `WiFiClientSecure` (opt-in `MQTT_TLS_ENABLED`). |
| `edge-hub/` | RPi5 MQTT broker + ONNX inference + Kalman tracker + API | **Beta** — runs, type-checks, 85 tests pass. Auth (MQTT + REST), rate limiting, multilateration, live health, loopback bind, zone validation, DB migrations, SQLCipher encryption-at-rest (`better-sqlite3-multiple-ciphers` + `PETSENSE_DB_KEY`). No ML validation on real CSI. |
| `app/` | Svelte 5 PWA live map + timeline + alerts + health | **Stable** — 111 tests pass. PWA manifest + log-format tests lock in claims. |
| `models/` | CNN training + ONNX export + synthetic data generation | **Synthetic only** — ONNX model exists, loads, matches inference contract. Real-world CSI data collection scaffold in place (`models/data/real/README.md` + `models/validate_real.py`). Not validated on real data. |

---

## Test Counts

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| `app/` | 9 | 111 | All green |
| `edge-hub/` | 9 | 85 | All green (incl. SQLCipher encryption test) |
| `firmware/` | host test | 7 | All green (real Ed25519 via libsodium) |
| **Total** | **18+1** | **195+7** | **All green at HEAD** |

---

## CI

`.github/workflows/ci.yml` — 3 jobs:
1. **App (Svelte/TS)** — `npm run build` + `npm test`
2. **Edge Hub (TypeScript)** — `npx tsc --noEmit` + `npm test`
3. **Firmware (PlatformIO)** — `pio run` (with `secrets.h` from template)

---

## Security

- `firmware/src/secrets.h` is gitignored; only `secrets.h.template` tracked. Real secrets are user-filled per-node.
- `firmware/src/ota.key` is gitignored; only `ota.template` tracked. Real signing keys must never be committed.
- MQTT broker auth: `aedes.authenticate` with `crypto.timingSafeEqual` (`auth.ts:35,36,62`).
- REST bearer auth + rate limiting (`api-server.ts`).
- CORS: allowlist-based via `config.yaml` (`api.cors.origins`). Empty allowlist = no CORS headers (deny-by-default). `PETSENSE_CORS_OPEN=1` env flag for dev only.
- API server + MQTT broker bind `127.0.0.1` by default. Non-loopback bind emits a startup WARNING.
- Zone upsert validates `id` (non-empty string), `name` (non-empty string), `bounds` (object with numeric x1/y1/x2/y2), `type` (alert|safe|notify). Returns 400 on violation.
- TLS configurable via `config.yaml` (`api.tls.enabled`, cert/key paths).
- Structured logging: pino with `child()` helper, all `console.*` replaced.
- PWA service worker: `VitePWA` + workbox runtime caching configured.
- **OTA signature verification uses real Ed25519 via libsodium** (`firmware/src/ota.cpp:crypto_sign_verify_detached`). The stub is replaced. Host-compiled test passes 7/7 with real crypto.
- **DB encryption-at-rest**: `better-sqlite3-multiple-ciphers` replaces `better-sqlite3`. When `PETSENSE_DB_KEY` env is set, the DB is encrypted with SQLCipher (`PRAGMA key`, `edge-hub/src/db.ts:82-85`). Without the key, the DB is plaintext (compatible with stock `better-sqlite3`).
- **MQTT TLS**: `firmware/src/main.cpp` uses `WiFiClientSecure` when `MQTT_TLS_ENABLED` is defined at compile time. CA cert via `MQTT_TLS_CA_CERT` from `secrets.h`. Broker-side TLS not yet wired (future change to `mqtt-broker.ts`).
- DB: versioned migration runner with `schema_version` table. v1 = initial schema, v2 = encryption marker.

---

## Known Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| ONNX model trained on synthetic CSI only | P2 | No real-world validation metrics; scaffold in place |
| MQTT TLS on broker side (aedes) | P3 | Firmware supports TLS; broker doesn't terminate TLS yet |
| Run hub under dedicated unprivileged user | P3 | systemd `User=petsense` |

---

## This session's changes

- **Task 1:** Real Ed25519 OTA verification — replaced stub with `crypto_sign_verify_detached()` from libsodium. Added `libsodium` to `lib_deps`. Updated host test with real Ed25519 keypair + signature. All 7 tests pass with real crypto.
- **Task 2:** SQLCipher encryption-at-rest — swapped `better-sqlite3` → `better-sqlite3-multiple-ciphers`. Added `PETSENSE_DB_KEY` env support in `db.ts`. Added migration v2 (encryption marker). Added encryption test (create encrypted DB, read with key, fail without key). 85 edge-hub tests pass.
- **Task 3:** MQTT TLS for firmware — replaced `WiFiClient` with `WiFiClientSecure` behind `#ifdef MQTT_TLS_ENABLED`. Added `MQTT_TLS_CA_CERT` config in `secrets.h.template`. Added `esp32-s3-tls` build environment. Both builds succeed.
- **Task 4:** Real-world CSI dataset scaffold — added `models/data/real/README.md` with data collection protocol, `models/validate_real.py` script, updated `MODEL_CARD.md` with pending data collection section.

---

## References

- `AGENTS.md` — worker contract and verification gates
- `SECURITY.md` — threat model and supported versions (updated this session)
- `docs/adr/` — architecture decision records