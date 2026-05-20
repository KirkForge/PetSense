# PetSense — Enterprise Readiness Assessment

**Date:** 2026-05-20 | **Version:** v0.1

## Architecture

Clean 3-layer design — ESP32 CSI capture → RPi5 edge hub → Svelte 5 PWA. Zero cloud dependencies.

```
WiFi AP ──CSI──▶ ESP32-S3 nodes (2-3x) ──MQTT──▶ Edge Hub (RPi5) ──WS/REST──▶ PWA App
  (existing)      $5-8/ea                        inference + API          Svelte 5
```

**Edge hub pipeline:** MQTT broker (aedes) → CSI Aggregator (ring buffer, 128-window) → Preprocessing (DFT, PCA, feature extraction) → ONNX Inference (3-head CNN: presence/species/activity) → Kalman Tracker (4-state) → SQLite DB → API Server (REST + WebSocket)

**Stats:**

| Layer | Files | Lines | Status |
|-------|-------|-------|--------|
| Firmware | 5 | ~200 | Complete |
| Edge Hub | 9 | ~1,000 | Incomplete (see gaps) |
| App (PWA) | 15 | ~1,800 | Complete |
| Models | 5 | ~700 | Training code only |
| Tests | 9 | ~1,000 | Stores only (20 tests) |

---

## Critical Bugs (crash-on-start or silent failure)

### 1. `extractFeatures` type mismatch — **crashes on first CSI packet**
**File:** `edge-hub/src/index.ts:37`

```ts
const features = extractFeatures(frame.combinedVector);
```

`combinedVector` is `Float32Array` (1D). `extractFeatures` signature is `(window: Float32Array[])` (2D — array of frames). Calling `.map()` on a `Float32Array` throws `TypeError: window.map is not a function`.

**Fix:** Wrap in an array: `extractFeatures([frame.combinedVector])`, or redesign `extractFeatures` to accept both shapes.

### 2. MQTT broker starts before model loads — **race condition**
**File:** `edge-hub/src/index.ts:27-36`

```ts
broker.startBroker(MQTT_PORT, MQTT_WS_PORT);  // data starts flowing
await engine.loadModel('models/petsense-v0.onnx');  // model not ready yet
```

CSI packets arrive before the ONNX model is loaded. If model load takes 2 seconds, 100+ frames are processed with no inference capability, silently dropping data.

**Fix:** Swap order — load model first, then start broker.

### 3. Position hardcoded to `{x:0, y:0}` — **multilateration not implemented**
**File:** `edge-hub/src/index.ts:39`

```ts
tracker.update(result.species || 'unknown', { x: 0, y: 0 });
// comment: "position from multilateration"
```

Multinode triangulation is referenced but never implemented. The Kalman tracker always receives [0,0], so position tracking is non-functional.

**Fix:** Implement multilateration from 2+ node RSSI values (trilateration requires 3 nodes; 2 nodes give a circle intersection).

### 4. WebSocket broadcast missing — **PWA shows stale data**
**File:** `edge-hub/src/index.ts:40`

```ts
// broadcast via WebSocket
```

Comment only — the inference result is never pushed to `APIServer` WebSocket clients. The PWA connects but receives no live location updates.

**Fix:** Wire `APIServer` into the `onFrame` callback, or emit events that the server subscribes to.

---

## High-Priority Gaps

### 5. CSI Aggregator unbounded memory growth
**File:** `edge-hub/src/csi-aggregator.ts:54`

`nodeBuffers` Map never evicts stale nodes. If an ESP32 disconnects without cleanup, its buffer accumulates indefinitely. Memory leak under production load.

**Fix:** Add TTL-based eviction (~60s of inactivity). Remove node from Map on disconnect.

### 6. No error handling on model load failure
**File:** `edge-hub/src/index.ts:32`

If `engine.loadModel()` throws (missing file, corrupt ONNX), the error propagates to `main().catch()` which calls `process.exit(1)`. No retry, no graceful degradation, no health status update.

**Fix:** Wrap in try/catch, set `modelLoaded: false` on health endpoint, retry with backoff.

### 7. Stores test import mismatch
**File:** `app/tests/stores.test.ts:14`

```ts
import { ..., isConnected, ... } from '../src/lib/stores.svelte';
```

`stores.svelte.ts` exports `getConnectionStatus()` and `setConnectionStatus()` — `isConnected` is a module-scoped `let`, not exported. Test fails to import.

**Fix:** Export `isConnected` as a getter, or update tests to use `getConnectionStatus()`.

---

## Enterprise Readiness Gaps

| # | File | Gap | Severity |
|---|------|-----|----------|
| 8 | `edge-hub/src/index.ts` | All config hardcoded — ports, paths, model location | Medium |
| 9 | `edge-hub/src/api-server.ts` | No auth, no rate limiting, CORS wildcard `*` | High |
| 10 | `edge-hub/src/mqtt-broker.ts` | MQTT over raw TCP — no TLS encryption | Medium |
| 11 | `edge-hub/src/index.ts` | `console.log` only — no structured logging, levels, rotation | Medium |
| 12 | `edge-hub/src/inference.ts` | No circuit breaker or retry on inference failure | Medium |
| 13 | `edge-hub/src/api-server.ts` | Missing endpoints — `/api/health/trends`, `/api/pets/trails` | Low |
| 14 | `edge-hub/src/mqtt-broker.ts` | `EventEmitter` with raw strings — no event type safety | Low |
| 15 | `app/src/lib/stores.svelte.ts` | `isConnected` not exported as reactive — breaks component access | Medium |
| 16 | `models/` | No trained ONNX model committed — `petsense-v0.onnx` missing | Critical |

---

## What Works Well

- **Signal processing:** DFT, PCA, feature extraction (mean, std, RMS, ZCR, spectral centroid, bandwidth, entropy) — professional quality
- **Kalman tracker:** Proper 4-state model (x, y, vx, vy) with full covariance propagation (predict + update)
- **DB schema:** WAL mode, proper indices on `(pet_id, timestamp)` and `(timestamp)`
- **API client:** Exponential backoff reconnect (1s → 30s), heartbeat ping every 15s, type-safe callbacks
- **Svelte 5 runes:** `$state`, `$derived`, `$effect` — modern, correct reactivity pattern
- **Test infrastructure:** Vitest + jsdom + `@testing-library/svelte` — proper setup
- **Firmware:** WiFi reconnect with backoff, MQTT reconnect with exponential backoff, LED status indicator, deep sleep stubs with battery estimates

---

## Remediation Path

### Phase 1 — Fix crash bugs (1-2 hours)
1. Fix `extractFeatures` type mismatch
2. Reorder `loadModel` before `startBroker`
3. Implement 2-node multilateration (RSSI-based distance estimation)
4. Wire WebSocket broadcast to PWA clients

### Phase 2 — Stabilize (2-3 hours)  
5. Add CSI aggregator TTL eviction
6. Add model load error handling with retry
7. Fix stores test import
8. Add config via env vars / YAML

### Phase 3 — Harden (3-4 hours)
9. Add TLS to MQTT + API
10. Add structured logging (pino/winston)
11. Add API auth (API key / JWT)
12. Add inference circuit breaker
13. Train and commit ONNX model

### Phase 4 — Productionize (ongoing)
14. Docker Compose for edge hub
15. Health endpoint metrics (Prometheus)
16. Integration tests (hardware-in-loop)
17. OTA firmware updates for ESP32

---

## Enterprise Score: 5/10

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 8/10 | Clean 3-layer, zero cloud, proper separation |
| Code Quality | 6/10 | Signal processing excellent, but 4 runtime bugs |
| Error Handling | 3/10 | Missing at every level |
| Security | 3/10 | No TLS, no auth, open CORS |
| Observability | 2/10 | console.log only, no metrics |
| Testability | 5/10 | Tests exist but incomplete coverage |
| Deployability | 3/10 | No Docker, no config management |
| Documentation | 7/10 | Good SPEC, README, state tracking |

**Bottom line:** Strong foundation, clean architecture. Fix the 4 runtime bugs + wire the broken pipeline connections to reach functional. Then add TLS, auth, and observability for production.
