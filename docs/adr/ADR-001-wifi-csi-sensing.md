# ADR-001: WiFi CSI as the sensing modality

**Status:** Accepted  
**Date:** 2026-06

## Context

Tracking pet location through walls without cameras or wearables. Options: UWB, BLE RSSI triangulation, radar (60GHz), WiFi CSI.

## Decision

WiFi Channel State Information (CSI) captured on ESP32-S3 via the Espressif CSI API.

## Rationale

- Commodity hardware: ESP32-S3 is ~$5–10, no specialised sensors
- CSI captures multipath propagation changes caused by movement — sufficient to detect and roughly locate pets in a room
- Works through walls and furniture; not line-of-sight dependent
- No camera, no privacy concerns, no wearable on the animal

## Consequences

- CSI accuracy for fine-grained localisation is limited (room-level, not cm-level)
- Requires multiple ESP32 nodes for multi-room coverage
- Signal quality depends on the 2.4GHz environment; interference from other devices affects readings
- Model training requires synthetic data generation (handled in `models/`) due to difficulty collecting labelled real-world data
