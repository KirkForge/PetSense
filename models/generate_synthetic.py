from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

N_SUBCARRIERS = 52
SAMPLE_RATE = 50


class SyntheticCSIGenerator:
    """Per-subcarrier amplitude modulation + phase shift based on body mass, speed, distance."""

    def __init__(self, n_subcarriers: int = N_SUBCARRIERS, sample_rate: int = SAMPLE_RATE,
                 carrier_freq: float = 2.437e9, seed: int = 42) -> None:
        self.n_sub = n_subcarriers
        self.sr = sample_rate
        self.fc = carrier_freq
        self.subcarrier_freqs = carrier_freq + np.linspace(-10e6, 10e6, n_subcarriers)
        self.rng = np.random.default_rng(seed)

    def generateEmptyRoom(self, duration_sec: float) -> np.ndarray:
        n_frames = int(duration_sec * self.sr)
        noise_floor_lin = 10 ** (-92.0 / 10)
        noise = np.sqrt(noise_floor_lin) * self.rng.normal(0, 0.15, (n_frames, self.n_sub))
        return noise.astype(np.complex64)

    def _body_perturbation(self, n_frames: int, body_mass_kg: float, speed_ms: float,
                           distance_m: float, gait_hz: float, gait_variance: float) -> np.ndarray:
        t = np.arange(n_frames) / self.sr
        base_amp = 10 ** (-(30 + 20 * np.log10(max(distance_m, 0.1))) / 20)
        strength = base_amp * np.sqrt(body_mass_kg / 70.0) * (speed_ms / 1.2)
        gait = np.sin(2 * np.pi * gait_hz * t + self.rng.uniform(0, 2 * np.pi))
        gait += gait_variance * self.rng.normal(0, 0.3, n_frames)
        fdg = ((self.subcarrier_freqs / self.fc) ** -0.5).reshape(1, -1)
        amp_mod = 1.0 + strength * gait.reshape(-1, 1) * fdg
        phase_shift = strength * 2.0 * np.pi * gait.reshape(-1, 1) * fdg
        return (amp_mod * np.exp(1j * phase_shift)).astype(np.complex64)

    def generateHumanWalking(self, duration_sec: float, speed: float = 1.2) -> np.ndarray:
        return self._body_perturbation(int(duration_sec * self.sr), 70, speed,
                                       self.rng.uniform(1.0, 5.0),
                                       self.rng.uniform(1.4, 2.2), 0.15)

    def generateDogWalking(self, duration_sec: float, breed_size: str = "medium") -> np.ndarray:
        mass = {"small": 10, "medium": 25, "large": 40}.get(breed_size, 25)
        return self._body_perturbation(int(duration_sec * self.sr), mass,
                                       self.rng.uniform(1.5, 2.0), self.rng.uniform(0.5, 3.0),
                                       self.rng.uniform(2.5, 4.0), 0.25)

    def generateDogRunning(self, duration_sec: float) -> np.ndarray:
        return self._body_perturbation(int(duration_sec * self.sr), self.rng.uniform(15, 35),
                                       self.rng.uniform(2.5, 3.5), self.rng.uniform(0.5, 4.0),
                                       self.rng.uniform(3.0, 5.5), 0.4)

    def generateCatWalking(self, duration_sec: float) -> np.ndarray:
        return self._body_perturbation(int(duration_sec * self.sr), self.rng.uniform(3, 7),
                                       self.rng.uniform(0.5, 2.0), self.rng.uniform(0.3, 3.5),
                                       self.rng.uniform(3.0, 5.5), 0.2)

    def generateCatJumping(self, duration_sec: float) -> np.ndarray:
        n_frames = int(duration_sec * self.sr)
        pert = self.generateCatWalking(duration_sec) * 0.3
        jt = self.rng.integers(n_frames // 4, 3 * n_frames // 4)
        iw = self.rng.integers(3, 8)
        impulse = np.zeros(n_frames, dtype=np.float32)
        impulse[jt:jt + iw] = np.exp(-np.linspace(0, 2, iw))
        jump_amp = 10 ** (-(20 + 20 * np.log10(self.rng.uniform(0.5, 2.5))) / 20)
        ip = jump_amp * impulse.reshape(-1, 1) * np.exp(1j * 2 * np.pi * self.rng.uniform(0, 1, (1, self.n_sub)))
        return (pert + ip).astype(np.complex64)

    @staticmethod
    def applyWallAttenuation(data: np.ndarray, num_walls: int = 1) -> np.ndarray:
        return (data * 10 ** (-3.0 * num_walls / 20)).astype(np.complex64)

    @staticmethod
    def addAWGN(data: np.ndarray, snr_db: float) -> np.ndarray:
        sp = np.mean(np.abs(data) ** 2)
        npwr = sp / (10 ** (snr_db / 10))
        noise = np.sqrt(npwr / 2) * (np.random.randn(*data.shape) + 1j * np.random.randn(*data.shape))
        return (data + noise).astype(np.complex64)


def main() -> None:
    ap = argparse.ArgumentParser(description="Synthetic CSI Generator for PetSense")
    ap.add_argument("--output", default="data/synthetic")
    ap.add_argument("--samples", type=int, default=5000)
    ap.add_argument("--window-duration", type=float, default=2.56)
    ap.add_argument("--snr-range", nargs=2, type=float, default=[15, 40])
    args = ap.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    gen = SyntheticCSIGenerator()
    spc = args.samples // 7
    dur = args.window_duration

    generators: list[tuple[str, str, str, callable]] = [
        ("empty", "idle", "livingroom", lambda: gen.generateEmptyRoom(dur)),
        ("human", "walking", "livingroom", lambda: gen.generateHumanWalking(dur)),
        ("dog", "walking", "livingroom", lambda: gen.generateDogWalking(dur)),
        ("dog", "running", "livingroom", lambda: gen.generateDogRunning(dur)),
        ("cat", "walking", "livingroom", lambda: gen.generateCatWalking(dur)),
        ("cat", "jumping", "bedroom", lambda: gen.generateCatJumping(dur)),
        ("dog", "lying", "kitchen", lambda: gen.generateDogWalking(dur) * 0.15),
    ]
    total = 0
    for species, activity, room, gen_fn in generators:
        (out_dir / room).mkdir(parents=True, exist_ok=True)
        for i in range(spc):
            csi = gen_fn()
            csi = gen.applyWallAttenuation(csi, np.random.randint(0, 2))
            csi = gen.addAWGN(csi, np.random.uniform(*args.snr_range))
            fname = out_dir / room / f"{species}_{activity}_{room}_{i:05d}.npy"
            np.save(str(fname), csi)
            total += 1
        log.info("Generated %d %s/%s windows", spc, species, activity)
    log.info("Total synthetic windows: %d -> %s", total, out_dir)


if __name__ == "__main__":
    main()
