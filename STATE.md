# PetSense — Project State

**Last updated:** 2026-07-22
**Project:** PetSense — WiFi CSI Pet Tracker
**Status:** Prototype (firmware) + Beta (edge-hub). Hub runs with auth, multilateration, rate limiting, loopback bind, zone validation, DB migrations. 84 edge-hub tests + 111 app tests pass. Grade: B+.

---

## Git

```
main at 29038d9 (worktree branch feat/p2-zone-validation-loopback-migrations)
```

Remote: `origin https://github.com/KirkForge/KirkForge_Android-PetSense`

---

## Components

| Component | Description | Status |
|-----------|-------------|--------|
| `firmware/` | ESP32-S3 CSI capture + MQTT publish | **Prototype** — compiles (`pio run` → SUCCESS, RAM 13.8%, Flash 20.8%). OTA verify stub + tests in place. Real Ed25519 verification is TODO(crypto). |
| `edge-hub/` | RPi5 MQTT broker + ONNX inference + Kalman tracker + API | **Beta** — runs, type-checks, 84 tests pass. Auth (MQTT + REST), rate limiting, multilateration, live health, loopback bind, zone validation, DB migrations, structured logging. No ML validation on real CSI. |
| `app/` | Svelte 5 PWA live map + timeline + alerts + health | **Stable** — 111 tests pass. PWA manifest + log-format tests lock in claims. |
| `models/` | CNN training + ONNX export + synthetic data generation | **Synthetic only** — ONNX model exists, loads, matches inference contract. Trained on synthetic CSI; `val_metrics=None`. Not validated on real data. |

---

## Test Counts

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| `app/` | 9 | 111 | All green |
| `edge-hub/` | 9 | 84 | All green |
| `firmware/` | host test | 7 | All green (host-compiled) |
| **Total** | **18+1** | **195+7** | **All green at `29038d9`** |

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
- CORS: allowlist-based via `config.yaml` (`api.cors.origins`). Empty allowlist = no CORS headers (deny-by-default). `PETSENSE_CORS_OPEN=1` env flag for open dev mode.
- API server + MQTT broker bind `127.0.0.1` by default. Non-loopback bind emits a startup WARNING.
- Zone upsert validates `id` (non-empty string), `name` (non-empty string), `bounds` (object with numeric x1/y1/x2/y2), `type` (alert|safe|notify). Returns 400 on violation.
- TLS configurable via `config.yaml` (`api.tls.enabled`, cert/key paths).
- Structured logging: pino with `child()` helper, all `console.*` replaced.
- PWA service worker: `VitePWA` + workbox runtime caching configured.
- OTA signature verify stub in place (documented `TODO(crypto): replace with real Ed25519`).
- DB: versioned migration runner with `schema_version` table. v1 = initial schema.

---

## Known Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| ONNX model trained on synthetic CSI only | P2 | No real-world validation metrics |
| No SQLCipher / at-rest DB encryption | P2 | Migration runner in place; `better-sqlite3-multiple-ciphers` swap deferred |
| OTA verify is stub, not real Ed25519 | P2 | Contract tested; `TODO(crypto)` in `ota.cpp` |
| MQTT TLS (port 8883) for firmware | P2 | `WiFiClient` in firmware, no `WiFiClientSecure` |
| No real-world CSI dataset + model validation | P0 (future) | `models/validate.py` + `models/MODEL_CARD.md` scaffolding in place |

---

## This session's changes

- **Task 1:** Runtime zone validation (`validateZone()`) + 7 tests. `docs/api.md` updated.
- **Task 2:** Loopback bind by default (`127.0.0.1`) for API server + MQTT broker. Non-loopback WARNING logged. `config.yaml` updated. 2 loopback tests.
- **Task 3:** Versioned DB migration runner (`schema_version` table + `MIGRATIONS` array). 3 migration tests.
- **Task 4:** OTA signature verify stub (`ota.h` + `ota.cpp`) + host-compiled test (7 cases). `ota.template` + `.gitignore` for `ota.key`.
- **Task 5:** PWA manifest test (4 cases) + pino log-format test (3 cases).
- **Task 6:** Dependabot yml rationale corrected. SECURITY.md rewritten with honest file:line citations. Stale `summary.md` (enterprise assessment) untracked.

---

## References

- `REVIEW-KirkForge_Android-PetSense.md` — fourth-pass audit (grade B)
- `WORKORDER-PetSense.md` — prioritized work items (B → B+/A− push)
- `AGENTS.md` — worker contract and verification gates
- `SECURITY.md` — threat model and supported versions (updated this session)
- `docs/adr/` — architecture decision records