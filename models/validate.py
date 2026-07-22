#!/usr/bin/env python3
"""Validate the PetSense ONNX model on a real-world CSI dataset.

Usage:
    python models/validate.py \
        --model edge-hub/models/petsense-v0.onnx \
        --data <path-to-real-dataset> \
        [--output models/validation-report.json]

Dataset format:
    <data-dir>/
        <label>.npy  (e.g., dog_walking_living_001.npy)
        labels.csv   (session_id,species,activity,room,start_time,end_time)

Output:
    Per-class precision, recall, F1, and confusion matrix.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SPECIES_LABELS = ["human", "dog", "cat"]
ACTIVITY_LABELS = ["walking", "running", "lying", "playing", "scratching", "jumping"]


def load_model(model_path: str):
    """Load ONNX model via onnxruntime."""
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


def load_dataset(data_dir: str) -> list[tuple[np.ndarray, str, str]]:
    """Load labeled CSI windows from dataset directory.

    Returns list of (window, species, activity) tuples.
    """
    data_path = Path(data_dir)
    windows = []

    # Try to load from labels.csv if it exists
    labels_csv = data_path / "labels.csv"
    if labels_csv.exists():
        with open(labels_csv) as f:
            header = f.readline().strip()
            for line in f:
                parts = line.strip().split(",")
                if len(parts) < 3:
                    continue
                session_id, species, activity = parts[0], parts[1], parts[2]
                label = f"{species}_{activity}_{_*}_{session_id}"
                for npy_file in data_path.rglob(f"{label}.npy"):
                    window = np.load(npy_file)
                    windows.append((window, species, activity))
    else:
        # Fall back to filename convention: species_activity_room_session.npy
        for npy_file in data_path.rglob("*.npy"):
            parts = npy_file.stem.split("_")
            if len(parts) >= 2:
                species, activity = parts[0], parts[1]
                window = np.load(npy_file)
                windows.append((window, species, activity))

    log.info("Loaded %d windows from %s", len(windows), data_dir)
    return windows


def run_inference(session, window: np.ndarray) -> tuple[str, str]:
    """Run inference on a single window. Returns (species, activity)."""
    import onnxruntime as ort

    tensor = ort.Tensor("float32", window.astype(np.float32).flatten(), [1, 128, 8])
    input_name = session.get_inputs()[0].name
    results = session.run(None, {input_name: tensor})

    # Parse outputs
    species_idx = np.argmax(results[1][0])  # species output
    activity_idx = np.argmax(results[2][0])  # activity output

    return SPECIES_LABELS[species_idx], ACTIVITY_LABELS[activity_idx]


def compute_metrics(predictions: list[tuple[str, str]], ground_truth: list[tuple[str, str]]) -> dict:
    """Compute per-class precision, recall, F1."""
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
    ap = argparse.ArgumentParser(description="Validate PetSense ONNX model")
    ap.add_argument("--model", required=True, help="Path to ONNX model")
    ap.add_argument("--data", required=True, help="Path to real-world CSI dataset")
    ap.add_argument("--output", default=None, help="Output JSON report path")
    args = ap.parse_args()

    session = load_model(args.model)
    windows = load_dataset(args.data)

    if not windows:
        log.error("No data found in %s", args.data)
        return

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
