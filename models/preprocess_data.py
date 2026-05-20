from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
from scipy.signal import medfilt
from sklearn.decomposition import PCA

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


class CSIPreprocessor:
    """Full CSI preprocessing pipeline from raw captures to ML-ready windows."""

    def __init__(self, window_size: int = 128, stride: int = 64, n_components: int = 8) -> None:
        self.window_size = window_size
        self.stride = stride
        self.n_components = n_components
        self.pca: Optional[PCA] = None

    def loadRawCSI(self, path: str) -> np.ndarray:
        """Load raw CSI array. Expects .npy [n_frames, n_subcarriers] complex64."""
        data = np.load(path)
        if data.dtype == np.complex64 or data.dtype == np.complex128:
            return data
        log.warning("%s is real-valued, treating as amplitude-only", path)
        return data.astype(np.float32)

    @staticmethod
    def hampelFilter(data: np.ndarray, window: int = 7, threshold: float = 3.0) -> np.ndarray:
        """Hampel identifier: replace outliers with local median along axis=-1."""
        cleaned = data.copy()
        half = window // 2
        n = data.shape[-1]
        for i in range(n):
            lo = max(0, i - half)
            hi = min(n, i + half + 1)
            segment = data[..., lo:hi]
            med = np.median(segment, axis=-1)
            mad = np.median(np.abs(segment - med[..., None]), axis=-1)
            mad = np.where(mad == 0, 1e-8, mad)
            z = 0.6745 * (data[..., i] - med) / mad
            mask = np.abs(z) > threshold
            cleaned[..., i][mask] = med[mask]
        return cleaned

    @staticmethod
    def amplitudeNormalize(amplitudes: np.ndarray) -> np.ndarray:
        """Per-subcarrier z-score normalization. Input: [frames, subcarriers]."""
        mean = amplitudes.mean(axis=0, keepdims=True)
        std = amplitudes.std(axis=0, keepdims=True)
        std = np.where(std == 0, 1e-8, std)
        return (amplitudes - mean) / std

    @staticmethod
    def phaseSanitize(phases: np.ndarray) -> np.ndarray:
        """Linear detrend + unwrap per subcarrier. Input: [frames, subcarriers]."""
        n_frames = phases.shape[0]
        x = np.arange(n_frames, dtype=np.float64)
        sanitized = np.zeros_like(phases, dtype=np.float64)
        for sc in range(phases.shape[1]):
            series = phases[:, sc]
            coeffs = np.polyfit(x, series, 1)
            detrended = series - np.polyval(coeffs, x)
            unwrapped = np.unwrap(detrended)
            sanitized[:, sc] = unwrapped
        return sanitized

    def pcaReduce(self, matrix: np.ndarray, n_components: int = 8) -> np.ndarray:
        """Fit PCA on first call; subsequent calls use fitted PCA for transform."""
        if self.pca is None:
            self.pca = PCA(n_components=n_components)
            reduced = self.pca.fit_transform(matrix)
            log.info("PCA fit: explained_variance_ratio sum=%.3f",
                     self.pca.explained_variance_ratio_.sum())
        else:
            reduced = self.pca.transform(matrix)
        return reduced

    def slidingWindows(self, data: np.ndarray) -> np.ndarray:
        """Generate overlapping windows. Returns [n_windows, window_size, features]."""
        n_frames = data.shape[0]
        starts = range(0, n_frames - self.window_size + 1, self.stride)
        windows = np.stack([data[i:i + self.window_size] for i in starts], axis=0)
        return windows

    @staticmethod
    def extractFeatures(window: np.ndarray) -> np.ndarray:
        """Time + freq domain feature vector for one window [T, F]."""
        features: list[float] = []
        for c in range(window.shape[1]):
            col = window[:, c]
            features.extend([
                float(np.mean(col)),
                float(np.std(col)),
                float(np.sqrt(np.mean(col ** 2))),
                float(np.sum(np.abs(np.diff(np.sign(col)))) / (len(col) - 1)),
            ])
            fft = np.abs(np.fft.rfft(col))
            if len(fft) > 0:
                freqs = np.fft.rfftfreq(len(col))
                centroid = np.sum(freqs * fft) / (np.sum(fft) + 1e-8)
                features.append(float(centroid))
            else:
                features.append(0.0)
        return np.array(features, dtype=np.float32)

    def processSession(self, raw_dir: str, output_dir: str, label: str) -> None:
        """Full pipeline for one recording session.

        Loads <raw_dir>/<label>*.npy, processes, writes windows to output_dir.
        Label format: species_activity_room_sessionId
        """
        raw_path = Path(raw_dir)
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        candidates = sorted(raw_path.glob(f"{label.split('_')[0]}*.npy"))
        if not candidates:
            candidates = sorted(raw_path.glob("*.npy"))
        if not candidates:
            log.warning("No raw files found in %s for label %s", raw_dir, label)
            return

        for raw_file in candidates:
            csi = self.loadRawCSI(str(raw_file))
            if csi.dtype in (np.complex64, np.complex128):
                amp = np.abs(csi)
                ph = np.angle(csi)
                amp = self.hampelFilter(amp)
                amp = self.amplitudeNormalize(amp)
                ph = self.phaseSanitize(ph)
                combined = np.concatenate([amp, ph], axis=-1)
            else:
                combined = self.hampelFilter(csi)
                combined = self.amplitudeNormalize(combined)

            reduced = self.pcaReduce(combined)
            windows = self.slidingWindows(reduced)
            session_id = label.rsplit("_", 1)[-1]
            for wi, win in enumerate(windows):
                fname = out_path / f"{label}_{wi}.npy"
                np.save(fname, win.astype(np.float32))
            log.info("Session %s -> %d windows -> %s", label, len(windows), output_dir)


def main() -> None:
    ap = argparse.ArgumentParser(description="CSI Preprocessor for PetSense")
    ap.add_argument("--input", required=True, help="Raw CSI data directory")
    ap.add_argument("--output", required=True, help="Processed output directory")
    ap.add_argument("--labels", required=True, help="CSV: session_id,species,activity,room,start_time,end_time")
    args = ap.parse_args()

    preprocessor = CSIPreprocessor()
    labels_path = Path(args.labels)

    if not labels_path.exists():
        log.error("Labels file not found: %s", labels_path)
        return

    with open(labels_path) as f:
        header = f.readline().strip()
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            if len(parts) < 4:
                continue
            session_id = parts[0]
            species = parts[1]
            activity = parts[2]
            room = parts[3]
            label = f"{species}_{activity}_{room}_{session_id}"
            log.info("Processing session: %s", label)
            preprocessor.processSession(args.input, args.output, label)

    if preprocessor.pca is not None:
        import pickle
        pca_path = Path(args.output) / "pca_model.pkl"
        with open(pca_path, "wb") as pf:
            pickle.dump(preprocessor.pca, pf)
        log.info("PCA model saved -> %s", pca_path)


if __name__ == "__main__":
    main()
