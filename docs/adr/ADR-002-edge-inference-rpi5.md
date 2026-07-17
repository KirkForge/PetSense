# ADR-002: On-device inference on Raspberry Pi 5 via ONNX Runtime

**Status:** Accepted (premises unverified — see Correction 2026-07)
**Date:** 2026-06 (corrected 2026-07)

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

## Correction (2026-07): two premises were not true of the code

A 2026-07 audit of the implementation against this ADR found two factual errors.
Both are corrected here rather than left as silent inaccuracies.

1. **"Models trained in PyTorch, exported to ONNX" (Decision, line 12) — never
   executed.** `find . -name '*.onnx'` returns zero files; `data/csi/` and
   `edge-hub/models/` are both empty; `models/train_cnn.py` exists but has never
   been run (no CSI dataset to train on). The hub boot path
   `edge-hub/src/index.ts:30` calls `engine.loadModel('models/petsense-v0.onnx')`,
   and `inference.ts:24` throws `Model not loaded` when the session is null, so
   the hub **cannot start** today. The ONNX/RPi5 architecture is the intended
   design, not a shipped capability. The PyTorch→ONNX path is real code that
   awaits a dataset.

2. **"Kalman filter … runs in Python on the RPi" (Consequences, line 24) — it is
   TypeScript, not Python.** The Kalman tracker is `class KalmanTracker` in
   `edge-hub/src/tracker.ts:52` (a `predict()`/`update()` state-space filter in
   TS, part of the Node edge-hub). There is no Python Kalman implementation in
   this repo. The RPi runs the Node hub, not a Python process.

Neither error changes the *architectural* decision (RPi5 edge hub + ONNX Runtime
remains the target). They correct the record on what is implemented today. The
repo has since been pivoted to firmware-first scope (see `PIVOT.md`); the hub,
model, and app are deferred integration work, not a running system.
