# ADR-002: On-device inference on Raspberry Pi 5 via ONNX Runtime

**Status:** Accepted  
**Date:** 2026-06

## Context

CSI data from ESP32 nodes must be aggregated and classified (pet present / location estimate) in real time. Options: cloud inference, RPi edge inference, inference on the ESP32 itself.

## Decision

RPi5 as the edge hub running ONNX Runtime. Models trained in PyTorch, exported to ONNX for deployment (`models/` → `edge-hub/models/`).

## Rationale

- Zero cloud dependency — all processing stays on the home network
- RPi5 (ARM Cortex-A76) handles ONNX inference at sufficient throughput for the update rate (1–5Hz)
- ONNX Runtime is well-supported on ARM64 and decouples training framework from inference
- PyTorch training allows easy experimentation; ONNX export is a one-command step

## Consequences

- Model updates require re-exporting to ONNX and redeploying to the RPi
- Kalman filter for position smoothing runs in Python on the RPi — CPU bound but acceptable at this update rate
- If multi-pet tracking requires faster inference, the path is TensorRT on a Jetson or moving to the RPi5's ONNX-accelerated NPU path
