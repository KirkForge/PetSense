# PetSense -- Project State

**Last updated:** 2026-05-03 (end of session)
**Project:** PetSense -- WiFi CSI Pet Tracker
**Status:** v0.1 built. Gap fixes applied. Ready for push to GitHub.

---

## Overview

Track dogs and cats through walls using commodity WiFi Channel State Information (CSI). No cameras, no wearables, no BLE tags. Pure RF sensing with ML classification.

**Unique advantage:** No collar required. Works with any pet. Through-wall. Fully local processing (no cloud).

---

## Git

```
2e3d5d0 feat: PetSense v0.1 — WiFi CSI pet companion tracker
```

Remote: `origin https://github.com/55N10E/PetSence.git`
Branch: `master`

---

## Codebase Snapshot

| Metric | Count |
|--------|-------|
| Total files | 61 |
| Total lines | 6,068 |
| Source directories | firmware/, edge-hub/, app/, models/ |

---

## Codebases

| Codebase | Description | Files | Lines | Status |
|----------|-------------|-------|-------|--------|
| `firmware/` | ESP32-S3 CSI capture + MQTT stream | 5 (main.cpp, csi_extract.h/cpp, secrets.h, platformio.ini, calibration.json) | ~270 | Complete |
| `edge-hub/` | RPi5 MQTT broker + CSI aggregation + preprocessing + ONNX inference + Kalman tracker + event engine + API server + SQLite | 10 | ~950 | Complete |
| `app/` | Svelte 5 PWA: live SVG map, timeline, alerts, health dashboard | 18 (4 views, 3 components, 2 lib modules, CSS, tests) | ~3,200 | Complete |
| `models/` | CNN training, ONNX export, synthetic data generator, preprocessing | 7 (train_cnn.py, export_onnx.py, generate_synthetic.py, preprocess_data.py, config.yaml, quickstart.sh, requirements.txt) | ~680 | Complete |

---

## Architecture (3-layer)

```
WiFi AP ──CSI──▶ ESP32-S3 nodes ──MQTT──▶ Edge Hub (RPi5) ──WS/REST──▶ PWA App
  (existing)    (2-3x, $5-8/ea)         (inference + API)          (Svelte 5)
```

---

## Gap Fixes Applied (session end)

| Fix | File(s) | Status |
|-----|---------|--------|
| Floor plan types + utilities | `app/src/lib/floorplan.ts` | Done |
| Stores reactivity ($state for isConnected) | `app/src/lib/stores.svelte.ts` | Done |
| PWA icons (192px + 512px) | `app/static/icon-192.png`, `icon-512.png` | Done |
| requirements.txt fix (sklearn→scikit-learn) | `models/requirements.txt` | Done |
| Inference tensor shape [1,128,8] | `edge-hub/src/inference.ts` | Done |
| Pipeline wired (features→classify→track) | `edge-hub/src/index.ts` | Done |
| getAllPositions() on tracker | `edge-hub/src/tracker.ts` | Done |
| Live location data in API | `edge-hub/src/api-server.ts` | Done |
| Training bootstrap script | `models/scripts/quickstart.sh` | Done |

---

## Views (PWA)

| View | File | Lines | Purpose |
|------|------|-------|---------|
| LiveMap | `app/src/views/LiveMap.svelte` | 243 | SVG floor plan + pet dots with pulse animation |
| Timeline | `app/src/views/Timeline.svelte` | 309 | Horizontal timeline + filter chips + activity bars |
| Alerts | `app/src/views/Alerts.svelte` | 296 | Zone editor + alert history with dismiss |
| Health | `app/src/views/Health.svelte` | 280 | Stats row, sparklines, heatmap, anomaly detection |

## Components

| Component | File | Lines |
|-----------|------|-------|
| FloorPlan | `app/src/components/FloorPlan.svelte` | 202 |
| SpeciesBadge | `app/src/components/SpeciesBadge.svelte` | 70 |
| ActivitySparkline | `app/src/components/ActivitySparkline.svelte` | 81 |

## Tests

| Test | File | Lines | Tests |
|------|------|-------|-------|
| Stores | `app/tests/stores.test.ts` | 313 | 20 |
| LiveMap | `app/tests/views/LiveMap.test.ts` | 152 | -- |
| Timeline | `app/tests/views/Timeline.test.ts` | 208 | -- |
| Alerts | `app/tests/views/Alerts.test.ts` | 181 | -- |
| Health | `app/tests/views/Health.test.ts` | 163 | -- |
| SpeciesBadge | `app/tests/components/SpeciesBadge.test.ts` | 77 | -- |
| ActivitySparkline | `app/tests/components/ActivitySparkline.test.ts` | 72 | -- |
| FloorPlan | `app/tests/components/FloorPlan.test.ts` | 148 | -- |

---

## ML Pipeline

| Step | File | Purpose |
|------|------|---------|
| Generate synthetic data | `models/generate_synthetic.py` | Creates training data for all pet/human scenarios |
| Preprocess | `models/preprocess_data.py` | Hampel filter → z-score → phase sanitize → PCA → sliding windows |
| Train | `models/train_cnn.py` | 3-head CNN (Conv1D, GlobalAvgPool, 3 classifiers) |
| Export | `models/export_onnx.py` | ONNX opset 17, fp16 + int8 quantized |
| Bootstrap | `models/scripts/quickstart.sh` | One-command: generate → preprocess → train → export |

---

## Key Technical Details

| Detail | Value |
|--------|-------|
| ML model | 3-head CNN (presence, species, activity), ~800KB int8 quantized |
| Input tensor | [1, 128, 8] — batch × window_size × pca_components |
| CSI sampling rate | 50Hz (128-sample window = 2.56s) |
| Inference time | ~3ms on RPi5 CPU |
| WiFi bands | 2.4GHz minimum; 5GHz recommended for cats |
| Hardware BOM | ~$110 (3x ESP32-S3 + RPi5) |

---

## Next Steps

1. **Push to GitHub:** `git push -u origin master` (needs auth token)
2. **Install deps:** `cd edge-hub && npm install` then `cd ../app && npm install`
3. **Train model:** `cd models && bash scripts/quickstart.sh`
4. **Run tests:** `cd app && npm test`
5. **Full sprint plan:** See bottom of this file

---

## Sprint Plan

### Sprint 1 -- Proof of Life (2 weeks)
- Single ESP32-S3 + existing WiFi AP
- Raw CSI capture to MQTT to laptop
- Binary presence detection
- **Deliverable:** Detect a dog walking through the living room

### Sprint 2 -- Species + Activity (3 weeks)
- Species classifier: human vs dog vs cat
- Activity classifier: 6 classes
- Edge inference on RPi5 with ONNX
- Web app: floor plan with live position dot

### Sprint 3 -- Multi-Node (2 weeks)
- 2-3 ESP32 nodes for room coverage
- Kalman filter multi-node tracking fusion
- Zone-based alerts

### Sprint 4 -- Health + Polish (2 weeks)
- Activity baseline per pet
- Anomaly detection
- PWA offline capability
- Historical timeline

---

## Quick Restart Guide (for next LLM session)

1. `cd /home/kirk/Madlab/Sandbox-build/pet-wifi-sense`
2. Read `SPEC.md` for full specification (325 lines)
3. Read `deepseek.md` for agent instructions
4. `cd app && npm install && npm run dev` — start PWA dev server
5. `cd edge-hub && npm install && npm run dev` — start edge hub
6. Push: `git push -u origin master` (needs GitHub auth token)
