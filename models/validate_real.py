#!/usr/bin/env python3
"""Validate the PetSense ONNX model on real-world CSI data.

Usage:
    python models/validate_real.py \
        --model edge-hub/models/petsense-v0.onnx \
        --data models/data/real \
        [--output models/validation-report-real.json]

This script mirrors the interface of models/validate.py but targets
the real-world data directory (models/data/real/). If no real data
is present, it exits with a message and code 0 (not an error — data
collection is a separate step).

Dataset format:
    models/data/real/
        labels.csv   (session_id,species,activity,room,start_time,end_time,npy_file)
        *.npy         (CSI windows: shape [N, 128, 8])

Output:
    Per-class precision, recall, F1 for species and activity.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SPECIES_LABELS = ["human", "dog", "cat"]
ACTIVITY_LABELS = ["walking", "running", "lying", "playing", "scratching", "jumping"]

DATA_DIR = Path(__file__).parent / "data" / "real"


def check_data_available(data_dir: Path) -> bool:
    if not data_dir.exists():
        return False
    labels_csv = data_dir / "labels.csv"
    if not labels_csv.exists():
        return False
    npy_files = list(data_dir.glob("*.npy"))
    return len(npy_files) > 0


def load_model(model_path: str):
    try:
        import onnxruntime as ort
    except ImportError:
        log.error("onnxruntime not installed. Run: pip install onnxruntime")
        raise

    session = ort.InferenceSession(model_path)
    log.info("Model loaded: %s", model_path)
    log.info("  Inputs: %s", [i.name for i in session.get_inputs()])
    log.info("  Outputs: %s", [o.name for o in session.get_outputs()])
    return session


def load_real_dataset(data_dir: str) -> list[tuple[np.ndarray, str, str]]:
    data_path = Path(data_dir)
    windows = []

    labels_csv = data_path / "labels.csv"
    if not labels_csv.exists():
        log.warning("No labels.csv found in %s", data_dir)
        return windows

    with open(labels_csv) as f:
        header = f.readline().strip()
        for line in f:
            parts = line.strip().split(",")
            if len(parts) < 3:
                continue
            session_id, species, activity = parts[0], parts[1], parts[2]
            npy_file = parts[6] if len(parts) >= 7 else f"{session_id}.npy"
            npy_path = data_path / npy_file
            if not npy_path.exists():
                log.warning("Missing npy file: %s", npy_path)
                continue
            window = np.load(npy_path)
            if window.ndim == 2:
                window = window[np.newaxis, :, :]
            windows.append((window, species, activity))

    log.info("Loaded %d windows from %s", len(windows), data_dir)
    return windows


def run_inference(session, window: np.ndarray) -> tuple[str, str]:
    import onnxruntime as ort

    tensor = ort.Tensor("float32", window.astype(np.float32).flatten(), [1, 128, 8])
    input_name = session.get_inputs()[0].name
    results = session.run(None, {input_name: tensor})

    species_idx = np.argmax(results[1][0])
    activity_idx = np.argmax(results[2][0])

    return SPECIES_LABELS[species_idx], ACTIVITY_LABELS[activity_idx]


def compute_metrics(predictions: list[tuple[str, str]], ground_truth: list[tuple[str, str]]) -> dict:
    from collections import defaultdict

    metrics = {}
    for task_name, task_idx in [("species", 0), ("activity", 1)]:
        tp = defaultdict(int)
        fp = defaultdict(int)
        fn = defaultdict(int)

        for pred, gt in zip(predictions, ground_truth):
            pred_label = pred[task_idx]
            gt_label = gt[task_idx]
            if pred_label == gt_label:
                tp[gt_label] += 1
            else:
                fp[pred_label] += 1
                fn[gt_label] += 1

        all_labels = set([gt[task_idx] for gt in ground_truth])
        per_class = {}
        for label in all_labels:
            p = tp[label] / (tp[label] + fp[label]) if (tp[label] + fp[label]) > 0 else 0
            r = tp[label] / (tp[label] + fn[label]) if (tp[label] + fn[label]) > 0 else 0
            f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0
            per_class[label] = {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f1, 3)}

        total_tp = sum(tp.values())
        total = len(ground_truth)
        metrics[task_name] = {
            "accuracy": round(total_tp / total, 3) if total > 0 else 0,
            "per_class": per_class,
        }

    return metrics


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate PetSense ONNX model on real-world CSI data")
    ap.add_argument("--model", default="edge-hub/models/petsense-v0.onnx",
                    help="Path to ONNX model")
    ap.add_argument("--data", default=str(DATA_DIR),
                    help="Path to real-world CSI data directory")
    ap.add_argument("--output", default=None,
                    help="Output JSON report path")
    args = ap.parse_args()

    if not check_data_available(Path(args.data)):
        log.info("No real-world CSI data found in %s — data collection pending.", args.data)
        log.info("See models/data/real/README.md for the data collection protocol.")
        if args.output:
            report = {
                "model": args.model,
                "dataset": args.data,
                "status": "pending_data_collection",
                "total_windows": 0,
                "metrics": None,
            }
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w") as f:
                json.dump(report, f, indent=2)
            log.info("Pending report saved to %s", args.output)
        sys.exit(0)

    session = load_model(args.model)
    windows = load_real_dataset(args.data)

    if not windows:
        log.warning("No data loaded from %s", args.data)
        sys.exit(0)

    predictions = []
    ground_truth = []
    for window, species, activity in windows:
        pred_species, pred_activity = run_inference(session, window)
        predictions.append((pred_species, pred_activity))
        ground_truth.append((species, activity))

    metrics = compute_metrics(predictions, ground_truth)

    report = {
        "model": args.model,
        "dataset": args.data,
        "total_windows": len(windows),
        "metrics": metrics,
    }

    print(json.dumps(report, indent=2))

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)
        log.info("Report saved to %s", args.output)


if __name__ == "__main__":
    main()