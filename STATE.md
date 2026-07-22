# PetSense — Project State

**Last updated:** 2026-07-22
**Project:** PetSense — WiFi CSI Pet Tracker
**Status:** Prototype (firmware) + Beta (edge-hub). Hub runs with auth, multilateration, rate limiting. ONNX model exists (synthetic CSI, not validated on real data). 171 tests pass (107 app + 64 hub). Grade: B.

---

## Git

```
main at 2a3b177
```

Remote: `origin https://github.com/KirkForge/KirkForge_Android-PetSense`

---

## Components

| Component | Description | Status |
|-----------|-------------|--------|
| `firmware/` | ESP32-S3 CSI capture + MQTT publish | **Prototype** — compiles (`pio run` → SUCCESS, RAM 13.8%, Flash 20.8%). Real firmware, flashable. |
| `edge-hub/` | RPi5 MQTT broker + ONNX inference + Kalman tracker + API | **Beta** — runs, type-checks, 64 tests pass. Auth (MQTT + REST), rate limiting, multilateration, live health. No ML validation on real CSI. |
| `app/` | Svelte 5 PWA live map + timeline + alerts + health | **Stable** — 107 tests pass. Flaky tests stabilized. |
| `models/` | CNN training + ONNX export + synthetic data generation | **Synthetic only** — ONNX model exists, loads, matches inference contract. Trained on synthetic CSI; `val_metrics=None`. Not validated on real data. |

---

## Test Counts

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| `app/` | 8 | 107 | All green |
| `edge-hub/` | 7 | 64 | All green |
| **Total** | **15** | **171** | **All green at `2a3b177`** |

---

## CI

`.github/workflows/ci.yml` — 3 jobs:
1. **App (Svelte/TS)** — `npm run build` + `npm test`
2. **Edge Hub (TypeScript)** — `npx tsc --noEmit` + `npm test`
3. **Firmware (PlatformIO)** — `pio run` (with `secrets.h` from template)

---

## Security

- `firmware/src/secrets.h` is gitignored; only `secrets.h.template` tracked. Real secrets are user-filled per-node.
- MQTT broker auth: `aedes.authenticate` with `crypto.timingSafeEqual` (`auth.ts:35,36,62`).
- REST bearer auth + rate limiting (`api-server.ts`).
- CORS: allowlist-based via `config.yaml` (`api.cors.origins`). Empty allowlist = no CORS headers (deny-by-default). `PETSENSE_CORS_OPEN=1` env flag for open dev mode.
- `SECURITY.md` exists with threat model and supported versions.

---

## Known Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| ONNX model trained on synthetic CSI only | P2 | No real-world validation metrics |
| TLS-by-default | P1 | Configurable via `config.yaml` but not yet implemented in code |
| No structured logging (pino) | P2 | All logging is `console.*` |
| No service worker / offline PWA | P2 | `manifest.json` exists but no SW |
| No SQLCipher / at-rest encryption | P2 | Plain `better-sqlite3` |
| No OTA signed ESP32 updates | P2 | No signature verification path |
| No e2e integration test | P2 | CSI → hub → app pipeline untested end-to-end |

---

## References

- `REVIEW-KirkForge_Android-PetSense.md` — fourth-pass audit (grade B)
- `WORKORDER-PetSense.md` — prioritized work items
- `AGENTS.md` — worker contract and verification gates
- `SECURITY.md` — threat model and supported versions
- `docs/adr/` — architecture decision records
