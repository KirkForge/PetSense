## WiFi CSI Pet Tracker

Track dogs and cats through walls using commodity WiFi Channel State Information (CSI). No cameras, no wearables, no cloud.

### Structure
- `firmware/` - ESP32-S3 CSI capture + MQTT publish
- `edge-hub/` - RPi5 aggregation + ONNX inference + Kalman tracker + API
- `app/` - Svelte 5 PWA live map + timeline + alerts + health
- `models/` - CNN training + ONNX export + synthetic data generation

### Quick Start
1. Flash ESP32: `cd firmware && pio run -t upload`
2. Start hub: `cd edge-hub && npm install && npm run dev`
3. Launch app: `cd app && npm install && npm run dev`

### Spec
See `SPEC.md` for full technical architecture.

Part of the Sandbox-build lab series. Zero cloud dependencies.
