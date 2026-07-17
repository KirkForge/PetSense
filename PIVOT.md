# PetSense — Pivot: firmware-first data-collection node

**Date:** 2026-07-17
**Verdict:** PIVOT (not alive, not killed). The repo is repositioned to its one
verifiable, stands-alone asset — the ESP32-S3 firmware — and the un-integrated
hub/app/model claims are pruned to honest "deferred, not running."

## Why not "alive"

The system does not run end-to-end, and the blocker is not a mechanical fix:

- **No model.** Zero `.onnx` files; `data/csi/` and `edge-hub/models/` are empty;
  `models/train_cnn.py` has never been run (no CSI dataset). `index.ts:30`
  `loadModel('models/petsense-v0.onnx')` → `inference.ts:24` throws
  `Model not loaded` → **the hub cannot boot.**
- **No integration.** `index.ts:32` passes literal `mqttConnected: true,
  modelLoaded: true`; `tracker.update(..., {x:0,y:0})` hardcodes position;
  the app pointed at `ws://…:8081/ws` (wrong port, wrong path — the hub's WS
  endpoint is `/api/realtime` on :3000).
- **Status docs were fabricated.** 11 of 14 "FIXED" claims in `state.md` did not
  match the code (see the rewritten `state.md` for file:line evidence). The
  external review (`REVIEW-KirkForge_Android-PetSense.md`) reached the same
  verdict: "prototype (firmware) + toy (integration). Not MVP."

Going "alive" would require building the integration **and** training a model
with no data — out of scope. The workorder's warning applies: a smaller model
must not "fix" against the fabricated spec.

## Why not "kill"

The firmware is real and valuable: `firmware/src/main.cpp:39`
`esp_wifi_set_csi_rx_cb` + `esp_wifi_set_csi(true)` captures WiFi CSI on an
ESP32-S3 and publishes it over MQTT (`PubSubClient`, `main.cpp:16`). That is a
genuine data-collection node. The CNN training code (`models/train_cnn.py`) is
also real engineering, blocked only on a dataset. Killing the repo would discard
working hardware work.

## Pivot scope

**In scope (real, kept):**
- `firmware/` — ESP32-S3 WiFi-CSI capture + MQTT publish. This **is** the
  product: a CSI data-collection node. ADR-001 (WiFi CSI on ESP32-S3) stands.
- `models/train_cnn.py` — retained as **untrained training code**, explicitly
  not claimed as working. It becomes useful once `data/csi/` has a dataset.

**Deferred (code retained, claims pruned — not running today):**
- `edge-hub/` — the Node hub is real module-by-module but does not run as a
  system (no model → boot throws; literal health flags; hardcoded position).
  CI now type-checks it (`tsc --noEmit`) so it doesn't silently rot.
- `app/` — the Svelte app is deferred. Its WS URL now points at the hub's
  *intended* endpoint (`/api/realtime` :3000) so the contract is honest, but
  there is no live backend to connect to.

**Removed claims (were fabricated):**
- "Trained ONNX model (≈800 KB, ≈3 ms inference)" — never existed.
- All 11 fabricated "FIXED" entries in the prior `state.md` (CI language,
  config loading, health callbacks, error logging, body cap, zone validation,
  CSP, ws protocol, secrets untracking, firmware truncation log, dependabot).
  See the rewritten `state.md` for the per-claim file:line evidence.

## Resolved: tracked `firmware/src/secrets.h` (placeholder hygiene, not a leak)

- **`firmware/src/secrets.h` was tracked in git, but it has only ever contained
  placeholders** (`your_wifi_ssid`, `your_wifi_password`, `192.168.1.100`,
  `1883`, `esp32-living-room`) — verified with `git log -p --follow
  firmware/src/secrets.h`. No real credentials were ever committed, so there is
  **no credential leak to rotate** and **no history to scrub**. An earlier draft
  of this section called it a P0 real-credential leak; that was wrong — it
  repeated the same unverified overclaim this pivot exists to correct.
- **Fix applied:** `git rm --cached firmware/src/secrets.h`, added
  `firmware/src/secrets.h` to `.gitignore`, committed
  `firmware/src/secrets.h.template` (placeholders only) as the tracked source.
  The real per-node file is now untracked + gitignored, so a careless `git add`
  cannot ship it.

## Follow-ups (not done in this pivot — listed, not claimed)

- Firmware CI compile: no `platformio.ini` exists, so a firmware build job would
  be speculative. Add `platformio.ini` + a `platformio run` CI step once the
  toolchain is verified locally.
- MQTT auth, REST auth/rate-limit, DB encryption, service worker, edge-hub tests
  — all still open; tracked honestly in `state.md` as STILL-OPEN/deferred.