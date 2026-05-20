# PetSense — WiFi CSI Pet Detection & Companion Tracker

**Status:** Spec v0.1 | **2026-05-03**

Track dogs and cats through walls using commodity WiFi Channel State Information (CSI). No cameras, no wearables, no BLE tags. Pure RF sensing with ML classification.

---

## Technical Foundation

### How WiFi CSI Sensing Works

WiFi signals bounce off everything. When a living body moves through the RF field, it perturbs the signal's amplitude and phase across OFDM subcarriers. CSI captures these per-subcarrier measurements 30-100 times per second from standard WiFi chipsets.

```
Router/AP ────CSI stream──▶ ESP32/SBC ──▶ Classifier ──▶ Location/Action
    │                            │
    └── 2.4/5GHz OFDM ──────────┘
         (52-234 subcarriers)
```

**Key metrics extracted from CSI:**
- **Amplitude variance** → presence detection (any moving body)
- **Phase shift patterns** → direction and velocity of movement
- **Subcarrier correlation** → body size estimation (human vs dog vs cat)
- **Temporal frequency** → activity type (walking, running, lying down)
- **Doppler spread** → speed of movement

### Why Pets Are Different From Humans

| Factor | Human | Dog (med) | Cat |
|--------|-------|-----------|-----|
| Body mass | 60-90kg | 15-40kg | 3-7kg |
| Height above floor | 1.5-1.8m | 0.4-0.8m | 0.15-0.3m |
| Gait frequency | 1.4-2.2 Hz | 2.5-4.0 Hz | 3.0-5.5 Hz |
| Typical speed | 1.0-1.4 m/s | 1.5-3.0 m/s | 0.5-2.0 m/s |
| Signal perturbation | Strong | Medium | Weak |
| Posture variance | Standing/sitting | Standing/sitting/lying | Crouching/curled (near invisible) |

**The cat problem:** A curled-up cat is RF-near-invisible. You're detecting cat *movement*, not cat *presence*. A sleeping cat in a ball may not register at all on 2.4GHz. 5GHz helps but still marginal.

---

## Architecture

### Hardware Layer

```
┌─────────────────────────────────────────────────┐
│                  YOUR HOME                        │
│                                                   │
│  WiFi AP ◄──────────► ESP32-S3 #1 (living room)  │
│  (existing)           ESP32-S3 #2 (kitchen)       │
│                       ESP32-S3 #3 (bedroom)       │
│                                                   │
│  Each ESP32:                                      │
│  - Promiscuous monitor mode                       │
│  - Captures CSI from AP's beacon frames           │
│  - Extracts CSI matrix per packet                 │
│  - Streams to edge hub via MQTT/WebSocket         │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│              EDGE HUB (RPi5 / Mini PC)            │
│                                                   │
│  MQTT Broker (mosquitto)                          │
│  CSI Aggregator (combine multi-node streams)      │
│  Inference Engine (ONNX runtime / TFLite)          │
│  Local DB (SQLite — positions, events, patterns)  │
│  API Server (Node.js — REST + WS to app)          │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│              MOBILE / WEB APP                     │
│                                                   │
│  Real-time pet location map (heatmap overlay)     │
│  Activity timeline (sleeping, playing, roaming)   │
│  Zone alerts (pet enters kitchen → notify)        │
│  Health analytics (activity decline detection)    │
└─────────────────────────────────────────────────┘
```

### Hardware Options

| Platform | CSI Support | Cost | Range | Notes |
|----------|-------------|------|-------|-------|
| **ESP32-S3** | ESP-CSI toolkit | $5-8 | 15-30m | Best value. Active development. WiFi 4 (2.4GHz only) |
| **ESP32-C5** | ESP-CSI (soon) | $8-12 | 15-30m | WiFi 6 + 5GHz. Much better cat detection. Pre-release |
| **Raspberry Pi 4 + Nexmon** | Nexmon CSI patch | $35-55 | 20-40m | Broadcom chip. 80MHz bandwidth. 5GHz support. Mature. |
| **Intel AX210 + PicoScenes** | PicoScenes Linux | $25 + PC | 30-50m | Research-grade. 160MHz, 6GHz, MIMO. Overkill but gold standard. |

**Recommended starter stack:** 2-3x ESP32-S3 nodes + RPi5 edge hub. ~$150 total BOM.

### CSI Extraction Pipeline

```
Raw WiFi frames (radiotap)
    │
    ▼
CSI Matrix Extraction (ESP-CSI / nexmon_csi)
  - Timestamp, RSSI, noise floor
  - CSI matrix: [N_tx × N_rx × N_subcarriers] complex numbers
  - Typical: 1×1×52 for 20MHz 2.4GHz, 1×1×114 for 40MHz 5GHz
    │
    ▼
Preprocessing (on-device or edge)
  - Outlier removal (Hampel filter, window=7)
  - Amplitude normalization (per-subcarrier z-score)
  - Phase sanitization (linear regression + unwrap)
  - Dimensionality reduction (PCA: 52→8 components)
    │
    ▼
Feature Extraction (sliding window, 128 samples @ 50Hz = 2.56s)
  - Time-domain: mean, std, RMS, peak count, zero-crossing rate
  - Freq-domain: spectral centroid, bandwidth, entropy (FFT)
  - Correlation: subcarrier pairwise correlation matrix
  - Temporal: autocorrelation peaks (gait frequency extraction)
    │
    ▼
ML Classifier (ONNX, <2MB model)
  - Presence: binary (nothing vs something moving)
  - Species: human vs dog vs cat
  - Activity: walking, running, lying down, playing, scratching
  - Location: room-level classification (multilateration from RSSI)
```

---

## ML Model Design

### Model Architecture

```
Input: [batch, 128, 8]  (128 time steps, 8 PCA components)
    │
    ▼
Conv1D(32, kernel=7) → BatchNorm → ReLU → MaxPool(2)
    │
    ▼
Conv1D(64, kernel=5) → BatchNorm → ReLU → MaxPool(2)
    │
    ▼
Conv1D(128, kernel=3) → BatchNorm → ReLU → GlobalAvgPool
    │
    ▼
Dense(64) → ReLU → Dropout(0.4)
    │
    ├──▶ Dense(1) → Sigmoid        [presence: yes/no]
    ├──▶ Dense(3) → Softmax         [species: human/dog/cat]
    └──▶ Dense(6) → Softmax         [activity: 6 classes]
```

**Size:** ~800KB quantized (int8). Inference time: ~3ms on RPi5 CPU, ~0.5ms on ESP32-S3 accelerator.

### Training Data Requirements

| Class | Minimum samples | Ideal samples | Collection method |
|-------|----------------|---------------|-------------------|
| Empty room | 500 | 2000 | Record empty room at various times |
| Human walking | 1000 | 5000 | Multiple people, paths, speeds |
| Dog walking | 800 | 3000 | Medium/large dogs, various breeds |
| Dog running | 400 | 1500 | Fetch/zoomies sessions |
| Dog lying down | 300 | 1000 | Resting positions |
| Cat walking | 600 | 2500 | Various rooms, times of day |
| Cat jumping | 300 | 1000 | Furniture jumps |
| Cat sleeping | 200 | 800 | Curled positions (hardest class) |

**Data collection strategy:**
1. Bootstrap with self-labeling: user presses "I'm walking the dog now" → records 30s CSI window → labels it
2. Synthetic augmentation: time-stretch (±15%), amplitude jitter (±5%), simulated noise floor shifts
3. Transfer learning: start with pretrained human presence model, fine-tune on pet data

---

## Software Stack

### Edge Hub (`edge-hub/`)

```
edge-hub/
├── package.json
├── src/
│   ├── mqtt-broker.ts       — mosquitto config + topic structure
│   ├── csi-aggregator.ts    — combine streams from N ESP32s
│   ├── preprocessing.ts     — Hampel filter, PCA, feature extraction
│   ├── inference.ts         — ONNX runtime, classification loop
│   ├── tracker.ts           — Kalman filter for per-pet position tracking
│   ├── event-engine.ts      — zone alerts, activity change detection
│   ├── api-server.ts        — REST + WebSocket for app connection
│   └── db.ts                — SQLite: positions, events, patterns
├── models/
│   └── petsense-v0.onnx     — pretrained model
└── config.yaml              — room layout, zones, ESP32 positions
```

### ESP32 Firmware (`firmware/`)

```
firmware/
├── platformio.ini
├── src/
│   ├── main.cpp             — WiFi init, CSI capture, MQTT client
│   ├── csi_extract.cpp      — raw CSI → structured data
│   └── secrets.h            — WiFi + MQTT credentials
└── data/
    └── calibration.json     — per-node calibration values
```

**Firmware flow:**
1. Connect to target AP (the one to monitor)
2. Enable promiscuous mode + CSI capture
3. For each captured frame: extract CSI matrix, timestamp, RSSI
4. Serialize to compact binary format (protobuf or MessagePack)
5. Publish to MQTT topic: `csi/{node_id}/{timestamp}`

### Mobile App (`app/`)

```
app/
├── package.json
├── src/
│   ├── App.svelte           — main app shell
│   ├── lib/
│   │   ├── api.ts           — WebSocket client to edge hub
│   │   ├── stores.ts        — Svelte 5 runes: pet positions, events
│   │   └── floorplan.ts     — room layout editor + renderer
│   ├── views/
│   │   ├── LiveMap.svelte   — real-time heatmap of pet location
│   │   ├── Timeline.svelte  — activity timeline with filters
│   │   ├── Alerts.svelte    — zone alert configuration
│   │   └── Health.svelte    — activity trend analytics
│   └── components/
│       ├── FloorPlan.svelte — SVG-based floor plan with pet overlay
│       ├── SpeciesBadge.svelte
│       └── ActivitySparkline.svelte
└── static/
    └── manifest.json        — PWA
```

---

## Detection Capabilities Matrix

| Scenario | 2.4GHz ESP32 | 5GHz ESP32-C5 | RPi+Nexmon | Accuracy |
|----------|:---:|:---:|:---:|:---:|
| Dog walking (open room) | Yes | Yes | Yes | 90-95% |
| Dog running | Yes | Yes | Yes | 95%+ |
| Dog lying still | Marginal | Yes | Yes | 70-85% |
| Cat walking | Marginal | Yes | Yes | 80-90% |
| Cat jumping | Yes | Yes | Yes | 85% |
| Cat curled sleeping | No | Marginal | Yes | 50-65% |
| Multi-pet (2+ animals) | No | Marginal | Yes | 60-75% |
| Through 1 wall | Yes | Yes | Yes | 75-90% |
| Through 2 walls | No | Marginal | Yes | 50-70% |
| Distinguish dog from cat | Marginal | Yes | Yes | 75-85% |
| Distinguish pet from human | Marginal | Yes | Yes | 80-90% |
| Room-level location | Yes | Yes | Yes | 85-95% |
| Zone-level (sub-room) | No | Marginal | Yes | 60-75% |

**The hard truth:** If you want reliable cat detection, you need 5GHz minimum. The ESP32-C5 (WiFi 6, just shipping) is the inflection point for affordable pet CSI.

---

## Roadmap

### Sprint 1 — Proof of Life (2 weeks)
- Single ESP32-S3 + existing WiFi AP
- Raw CSI capture → MQTT → laptop
- Presence detection: "something is moving" (binary classifier)
- Terminal-based visualization (ASCII heatmap)
- **Deliverable:** Can detect a dog walking through the living room

### Sprint 2 — Species + Activity (3 weeks)
- Train species classifier (human/dog/cat)
- Train activity classifier (6 classes)
- Edge inference on RPi5 with ONNX
- Basic web app with floor plan + live position dot
- **Deliverable:** App shows dog icon moving on floor plan

### Sprint 3 — Multi-Node (2 weeks)
- 2-3 ESP32 nodes for coverage
- Kalman filter tracking fusion
- Room-level location classification
- Zone-based alerts (pet in kitchen → push notification)
- **Deliverable:** Multi-room tracking with zone alerts

### Sprint 4 — Health + Polish (2 weeks)
- Activity baseline per pet (7-day rolling average)
- Anomaly detection: "dog is 40% less active than normal"
- PWA with offline capability
- Historical timeline with filtering
- **Deliverable:** App store-ready PWA with health analytics

---

## Competitive Landscape

| Solution | Method | Range | Cat? | Cost | Privacy |
|----------|--------|------|------|------|---------|
| **PetSense** | WiFi CSI | 15-40m | Marginal (5GHz) | $150 | Full local |
| Whistle/ Fi | GPS + BLE collar | Unlimited | Yes | $80+$10/mo | Cloud |
| Tile/AirTag | BLE | 10-100m | Yes (collar only) | $25 | Mixed |
| Home cameras | CV + object detection | FOV only | Yes | $50-200 | Cloud |
| mmWave radar | 60GHz FMCW | 5-10m | Yes | $200+ | Local |
| UWB tags | UWB anchors | 10-50m | Yes (collar only) | $300+ | Local |

**PetSense's unique advantage:** No collar required. Works with any pet. Through-wall. Privacy-preserving (all local). The tradeoff is accuracy — it'll never be as precise as a GPS collar.

---

## Open Questions

1. **Cat sensitivity:** Is 5GHz enough for curled cats, or do we need 6GHz/UWB? Needs empirical testing.
2. **Multi-pet deconfliction:** How do you track 2 nearly identical dogs in the same room? Likely requires some form of gait fingerprinting.
3. **Calibration drift:** WiFi environments change (furniture moved, new devices). How often does the model need recalibration?
4. **Battery-powered ESP32 nodes:** Battery life at 50Hz CSI capture? Probably measured in hours, not days. USB-C power is realistic.
5. **Pet privacy regulations:** GDPR applies to pets? Currently no, but companion animal data laws are emerging in the EU.

---

## Blog Post

See `blog/blog_1.md` for the public-facing announcement post.
