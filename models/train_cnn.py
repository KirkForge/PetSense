from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset, Subset
from sklearn.model_selection import train_test_split

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SPECIES_MAP = {"human": 0, "dog": 1, "cat": 2}
ACTIVITY_MAP = {"walking": 0, "running": 1, "lying": 2, "playing": 3, "scratching": 4, "other": 5}


class PetSenseCNN(nn.Module):
    """Input: [batch, 128, 8] — 128 time steps, 8 PCA components."""

    def __init__(self, filters: tuple = (32, 64, 128), kernels: tuple = (7, 5, 3),
                 dense_units: int = 64, dropout: float = 0.4, num_species: int = 3,
                 num_activities: int = 6):
        super().__init__()
        f0, f1, f2 = filters
        k0, k1, k2 = kernels

        self.conv1 = nn.Conv1d(8, f0, k0, padding=k0 // 2)
        self.bn1 = nn.BatchNorm1d(f0)
        self.pool1 = nn.MaxPool1d(2)

        self.conv2 = nn.Conv1d(f0, f1, k1, padding=k1 // 2)
        self.bn2 = nn.BatchNorm1d(f1)
        self.pool2 = nn.MaxPool1d(2)

        self.conv3 = nn.Conv1d(f1, f2, k2, padding=k2 // 2)
        self.bn3 = nn.BatchNorm1d(f2)

        self.dense = nn.Linear(f2, dense_units)
        self.dropout = nn.Dropout(dropout)

        self.head_presence = nn.Linear(dense_units, 1)
        self.head_species = nn.Linear(dense_units, num_species)
        self.head_activity = nn.Linear(dense_units, num_activities)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        x = x.permute(0, 2, 1)  # [N, 128, 8] -> [N, 8, 128]

        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = F.relu(self.bn3(self.conv3(x)))

        x = x.mean(dim=-1)  # global avg pool

        x = self.dropout(F.relu(self.dense(x)))

        presence = torch.sigmoid(self.head_presence(x)).squeeze(-1)
        species = F.softmax(self.head_species(x), dim=-1)
        activity = F.softmax(self.head_activity(x), dim=-1)

        return presence, species, activity


class CSIWindowDataset(Dataset):
    """Loads .npy windows from data/csi/ with labels parsed from filenames.

    Expected filename format: {species}_{activity}_{room}_{sessionId}.npy
    The presence label is derived: species != 'empty' -> presence=1.
    Each file is a window of shape [128, 8].
    """

    def __init__(self, root_dir: str) -> None:
        self.root_dir = Path(root_dir)
        self.files = sorted(self.root_dir.glob("*.npy"))
        if not self.files:
            raise FileNotFoundError(f"No .npy files found in {root_dir}")

    def __len__(self) -> int:
        return len(self.files)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        fpath = self.files[idx]
        data = np.load(fpath).astype(np.float32)  # [128, 8]
        tensor = torch.from_numpy(data)

        stem = fpath.stem
        parts = stem.split("_")
        species_str = parts[0]
        activity_str = parts[1] if len(parts) > 1 else "other"

        presence = 0.0 if species_str == "empty" else 1.0
        species_idx = SPECIES_MAP.get(species_str, SPECIES_MAP["human"])
        activity_idx = ACTIVITY_MAP.get(activity_str, ACTIVITY_MAP["other"])

        presence_t = torch.tensor(presence, dtype=torch.float32)
        species_t = torch.tensor(species_idx, dtype=torch.long)
        activity_t = torch.tensor(activity_idx, dtype=torch.long)

        return tensor, presence_t, species_t, activity_t


def stratified_split(dataset: CSIWindowDataset, train_r: float = 0.70, val_r: float = 0.15,
                     test_r: float = 0.15, seed: int = 42) -> Tuple[Subset, Subset, Subset]:
    labels = []
    for f in dataset.files:
        sp = f.stem.split("_")[0]
        labels.append(SPECIES_MAP.get(sp, 0))
    labels = np.array(labels)
    indices = np.arange(len(dataset))

    train_idx, rest_idx = train_test_split(indices, train_size=train_r, stratify=labels, random_state=seed)
    rest_labels = labels[rest_idx]
    val_frac = val_r / (val_r + test_r)
    val_idx, test_idx = train_test_split(rest_idx, train_size=val_frac, stratify=rest_labels, random_state=seed)

    return (
        Subset(dataset, train_idx.tolist()),
        Subset(dataset, val_idx.tolist()),
        Subset(dataset, test_idx.tolist()),
    )


def save_checkpoint(model: PetSenseCNN, path: str, optimizer=None, epoch: int = 0,
                    loss: float = 0.0) -> None:
    payload = {
        "model_state": model.state_dict(),
        "epoch": epoch,
        "loss": loss,
    }
    if optimizer is not None:
        payload["optimizer_state"] = optimizer.state_dict()
    torch.save(payload, path)
    log.info("Checkpoint saved -> %s", path)


def load_checkpoint(path: str, model: PetSenseCNN, optimizer=None) -> dict:
    ckpt = torch.load(path, map_location=DEVICE, weights_only=False)
    model.load_state_dict(ckpt["model_state"])
    if optimizer is not None and "optimizer_state" in ckpt:
        optimizer.load_state_dict(ckpt["optimizer_state"])
    log.info("Checkpoint loaded from %s (epoch=%d loss=%.4f)", path, ckpt["epoch"], ckpt["loss"])
    return ckpt


def train_epoch(model: PetSenseCNN, loader: DataLoader, optimizer, scaler,
                bce: nn.Module, ce: nn.Module) -> float:
    model.train()
    total_loss = 0.0
    for x, p, s, a in loader:
        x, p, s, a = x.to(DEVICE), p.to(DEVICE), s.to(DEVICE), a.to(DEVICE)
        optimizer.zero_grad()

        with torch.cuda.amp.autocast(enabled=scaler.is_enabled()):
            p_out, s_out, a_out = model(x)
            loss = bce(p_out, p) + ce(s_out, s) + ce(a_out, a)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        total_loss += loss.item()
    return total_loss / len(loader)


@torch.no_grad()
def eval_epoch(model: PetSenseCNN, loader: DataLoader, bce: nn.Module, ce: nn.Module) -> float:
    model.eval()
    total_loss = 0.0
    for x, p, s, a in loader:
        x, p, s, a = x.to(DEVICE), p.to(DEVICE), s.to(DEVICE), a.to(DEVICE)
        p_out, s_out, a_out = model(x)
        loss = bce(p_out, p) + ce(s_out, s) + ce(a_out, a)
        total_loss += loss.item()
    return total_loss / len(loader)


def main() -> None:
    data_dir = os.environ.get("PET_DATA_DIR", "data/csi")
    checkpoint_dir = Path("models/checkpoints")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    log.info("Loading dataset from %s on %s", data_dir, DEVICE)
    dataset = CSIWindowDataset(data_dir)
    train_ds, val_ds, test_ds = stratified_split(dataset)
    log.info("Split: train=%d val=%d test=%d", len(train_ds), len(val_ds), len(test_ds))

    bs = int(os.environ.get("PET_BATCH_SIZE", 64))
    train_loader = DataLoader(train_ds, batch_size=bs, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=bs, shuffle=False, num_workers=2, pin_memory=True)
    test_loader = DataLoader(test_ds, batch_size=bs, shuffle=False, num_workers=2, pin_memory=True)

    model = PetSenseCNN().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer, T_0=20, T_mult=2)
    scaler = torch.cuda.amp.GradScaler(enabled=(DEVICE.type == "cuda"))
    bce = nn.BCELoss()
    ce = nn.CrossEntropyLoss()

    patience = 15
    best_loss = float("inf")
    epochs_no_improve = 0
    max_epochs = int(os.environ.get("PET_MAX_EPOCHS", 150))

    log.info("Starting training (%d max epochs)", max_epochs)
    for epoch in range(1, max_epochs + 1):
        train_loss = train_epoch(model, train_loader, optimizer, scaler, bce, ce)
        val_loss = eval_epoch(model, val_loader, bce, ce)
        scheduler.step()

        log.info("Epoch %3d | train=%.4f  val=%.4f  lr=%.2e",
                 epoch, train_loss, val_loss, scheduler.get_last_lr()[0])

        if val_loss < best_loss:
            best_loss = val_loss
            epochs_no_improve = 0
            save_checkpoint(model, str(checkpoint_dir / "best.pt"), optimizer, epoch, val_loss)
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                log.info("Early stopping at epoch %d", epoch)
                break

    log.info("Loading best checkpoint for test evaluation")
    load_checkpoint(str(checkpoint_dir / "best.pt"), model)
    test_loss = eval_epoch(model, test_loader, bce, ce)
    log.info("Test loss: %.4f", test_loss)

    export_path = checkpoint_dir / "petsense-final.pt"
    save_checkpoint(model, str(export_path))
    log.info("Final model exported -> %s", export_path)


if __name__ == "__main__":
    main()
