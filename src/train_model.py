"""
train_model.py — 1D CNN Model Training for EEG Artifact Classification
======================================================================

Extracts windowed ICA component time-series, trains EEGArtifact1DCNN,
monitors validation loss/F1, applies class weighting to combat imbalance,
and saves the best model checkpoint and metadata.

Supports RESUMING from the best saved checkpoint.

CLI Usage:
    python src/train_model.py --epochs 20 --batch-size 32 --lr 0.001
"""

import sys
import os
import json
import argparse
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import mne
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
)

# Safe encoding for Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


SRC_DIR = Path(__file__).resolve().parent

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from cnn_model import EEGArtifact1DCNN
from build_training_dataset import build_dataset


BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR
DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
TRAINING_DIR = DATA_DIR / "training"
MODELS_DIR = DATA_DIR / "models"
REPORTS_DIR = DATA_DIR / "reports"


# ============================================================
# DATASET
# ============================================================

class EEGWindowDataset(Dataset):
    """PyTorch Dataset of normalized EEG window segments."""

    def __init__(self, windows, labels, subjects, recordings, components):
        self.windows = torch.tensor(windows, dtype=torch.float32)

        if self.windows.dim() == 2:
            self.windows = self.windows.unsqueeze(1)

        self.labels = torch.tensor(labels, dtype=torch.long)
        self.subjects = subjects
        self.recordings = recordings
        self.components = components

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.windows[idx], self.labels[idx]


# ============================================================
# FIND ICA COMPONENT SOURCE
# ============================================================

def find_component_source(subj, rec, comp_id):
    """
    Load ICA sources and retrieve the time-series for a specific component.
    """

    prefix = f"{subj}{rec}"
    subj_dir = PROCESSED_DIR / subj

    # Try subject folder first, then flat
    for folder in [subj_dir, PROCESSED_DIR]:

        ica_p = folder / f"{prefix}_ica.fif"
        raw_p = folder / f"{prefix}_preprocessed_raw.fif"

        if ica_p.exists() and raw_p.exists():

            ica = mne.preprocessing.read_ica(
                str(ica_p),
                verbose=False
            )

            raw = mne.io.read_raw_fif(
                str(raw_p),
                preload=True,
                verbose=False
            )

            sources = ica.get_sources(raw)
            sfreq = float(sources.info["sfreq"])

            comp_idx = int(comp_id.replace("IC", "")) - 1
            src_data = sources.get_data()

            if comp_idx < src_data.shape[0]:
                return src_data[comp_idx], sfreq

    return None, None


# ============================================================
# EXTRACT WINDOWS
# ============================================================

def extract_windows_from_csv(
    csv_path,
    window_sec=2.0,
    overlap=0.5,
    verbose=False
):
    """
    Read recording entries from a dataset CSV (train/val/test),
    slice ICA signals into normalized windows,
    and collect (X, y, metadata).
    """

    df = pd.read_csv(csv_path)

    # Binary classification:
    # KEEP (0) vs REMOVE (1)
    # REVIEW is excluded.
    df = df[df["label"].isin(["KEEP", "REMOVE"])].copy()

    windows = []
    labels = []
    subjects = []
    recordings = []
    components = []

    # Cache loaded sources per (subj, rec)
    # to avoid reloading FIF repeatedly
    cache = {}

    for _, row in df.iterrows():

        subj = str(row["subject_id"])
        rec = str(row["recording_id"])
        comp = str(row["component_id"])
        label_str = str(row["label"])

        y = 0 if label_str == "KEEP" else 1

        key = (subj, rec)

        if key not in cache:

            prefix = f"{subj}{rec}"
            subj_dir = PROCESSED_DIR / subj

            ica_p = subj_dir / f"{prefix}_ica.fif"
            raw_p = subj_dir / f"{prefix}_preprocessed_raw.fif"

            if not ica_p.exists():

                ica_p = PROCESSED_DIR / f"{prefix}_ica.fif"
                raw_p = PROCESSED_DIR / f"{prefix}_preprocessed_raw.fif"

            if ica_p.exists() and raw_p.exists():

                try:

                    ica = mne.preprocessing.read_ica(
                        str(ica_p),
                        verbose=False
                    )

                    raw = mne.io.read_raw_fif(
                        str(raw_p),
                        preload=True,
                        verbose=False
                    )

                    sources = ica.get_sources(raw)

                    cache[key] = (
                        sources.get_data(),
                        float(sources.info["sfreq"])
                    )

                except Exception as e:

                    if verbose:
                        print(f"Error loading {key}: {e}")

                    cache[key] = (None, None)

            else:
                cache[key] = (None, None)

        src_data, sfreq = cache[key]

        if src_data is None:
            continue

        comp_idx = int(comp.replace("IC", "")) - 1

        if comp_idx >= src_data.shape[0]:
            continue

        ts = src_data[comp_idx]

        win_samples = int(window_sec * sfreq)

        step = max(
            1,
            int(win_samples * (1.0 - overlap))
        )

        for start in range(
            0,
            len(ts) - win_samples + 1,
            step
        ):

            segment = ts[start:start + win_samples]

            # Z-score normalization
            std = float(np.std(segment))

            if std > 1e-8:

                norm_seg = (
                    segment - np.mean(segment)
                ) / std

            else:

                norm_seg = (
                    segment - np.mean(segment)
                )

            windows.append(norm_seg)
            labels.append(y)
            subjects.append(subj)
            recordings.append(rec)
            components.append(comp)

    return (
        np.array(windows, dtype=np.float32),
        np.array(labels, dtype=np.int64),
        subjects,
        recordings,
        components,
    )


# ============================================================
# TRAINING
# ============================================================

def train_cnn(args):
    """Main training routine."""

    MODELS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    (
        MODELS_DIR / "checkpoints"
    ).mkdir(
        parents=True,
        exist_ok=True
    )

    REPORTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    train_csv = TRAINING_DIR / "train.csv"
    val_csv = TRAINING_DIR / "validation.csv"
    test_csv = TRAINING_DIR / "test.csv"

    if not train_csv.exists() or not val_csv.exists():

        print(
            "Training CSVs not found. "
            "Building dataset first..."
        )

        build_dataset()

    print("\n" + "=" * 60)
    print("           NEUROAGENT 1D CNN TRAINING")
    print("=" * 60)

    print(f"Window length : {args.window_sec}s")
    print(f"Window overlap: {args.overlap * 100:.0f}%")
    print(f"Epochs        : {args.epochs}")
    print(f"Batch size    : {args.batch_size}")
    print(f"Learning rate : {args.lr}")

    # ========================================================
    # TRAINING DATA
    # ========================================================

    print(
        "\nExtracting windows for training set..."
    )

    X_train, y_train, s_tr, r_tr, c_tr = (
        extract_windows_from_csv(
            train_csv,
            window_sec=args.window_sec,
            overlap=args.overlap
        )
    )

    print(
        f"  Training windows:   {len(X_train)} "
        f"(KEEP: {(y_train == 0).sum()}, "
        f"REMOVE: {(y_train == 1).sum()})"
    )

    # ========================================================
    # VALIDATION DATA
    # ========================================================

    print(
        "Extracting windows for validation set..."
    )

    X_val, y_val, s_val, r_val, c_val = (
        extract_windows_from_csv(
            val_csv,
            window_sec=args.window_sec,
            overlap=args.overlap
        )
    )

    print(
        f"  Validation windows: {len(X_val)} "
        f"(KEEP: {(y_val == 0).sum()}, "
        f"REMOVE: {(y_val == 1).sum()})"
    )

    if len(X_train) == 0:

        print(
            "Error: No training windows extracted. "
            "Ensure preprocessed & ICA FIF files exist."
        )

        return

    # ========================================================
    # VALIDATION FALLBACK
    # ========================================================

    if len(X_val) == 0:

        print(
            "Validation windows empty. "
            "Using 20% of training data for validation."
        )

        n_split = int(0.8 * len(X_train))

        X_val, y_val = (
            X_train[n_split:],
            y_train[n_split:]
        )

        s_val, r_val, c_val = (
            s_tr[n_split:],
            r_tr[n_split:],
            c_tr[n_split:]
        )

        X_train, y_train = (
            X_train[:n_split],
            y_train[:n_split]
        )

        s_tr, r_tr, c_tr = (
            s_tr[:n_split],
            r_tr[:n_split],
            c_tr[:n_split]
        )

    # ========================================================
    # CLASS WEIGHTS
    # ========================================================

    count_0 = max(
        1,
        int((y_train == 0).sum())
    )

    count_1 = max(
        1,
        int((y_train == 1).sum())
    )

    total = count_0 + count_1

    w0 = total / (2.0 * count_0)
    w1 = total / (2.0 * count_1)

    class_weights = torch.tensor(
        [w0, w1],
        dtype=torch.float32
    )

    print(
        f"\nClass weights: "
        f"KEEP={w0:.3f}, REMOVE={w1:.3f}"
    )

    # ========================================================
    # DATASETS / LOADERS
    # ========================================================

    train_dataset = EEGWindowDataset(
        X_train,
        y_train,
        s_tr,
        r_tr,
        c_tr
    )

    val_dataset = EEGWindowDataset(
        X_val,
        y_val,
        s_val,
        r_val,
        c_val
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False
    )

    # ========================================================
    # MODEL
    # ========================================================

    win_len = X_train.shape[1]

    model = EEGArtifact1DCNN(
        in_channels=1,
        n_classes=2,
        dropout_rate=args.dropout
    )

    criterion = nn.CrossEntropyLoss(
        weight=class_weights
    )

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=1e-4
    )

    # ========================================================
    # CHECKPOINT RESUME
    # ========================================================

    checkpoint_path = (
        MODELS_DIR
        / "checkpoints"
        / "best_checkpoint.pth"
    )

    start_epoch = 1
    best_val_f1 = -1.0
    history = []

    if checkpoint_path.exists():

        print("\n" + "=" * 60)
        print("             CHECKPOINT FOUND")
        print("=" * 60)

        try:

            checkpoint = torch.load(
                checkpoint_path,
                map_location="cpu"
            )

            # ------------------------------------------------
            # Restore model
            # ------------------------------------------------

            model.load_state_dict(
                checkpoint["model_state_dict"]
            )

            # ------------------------------------------------
            # Restore optimizer
            # ------------------------------------------------

            optimizer.load_state_dict(
                checkpoint["optimizer_state_dict"]
            )

            # ------------------------------------------------
            # Restore training state
            # ------------------------------------------------

            completed_epoch = int(
                checkpoint.get("epoch", 0)
            )

            best_val_f1 = float(
                checkpoint.get("val_f1", -1.0)
            )

            start_epoch = completed_epoch + 1

            print(
                f"Checkpoint : {checkpoint_path}"
            )

            print(
                f"Completed epoch : {completed_epoch}"
            )

            print(
                f"Best Val F1     : {best_val_f1:.4f}"
            )

            print(
                f"Resuming from   : Epoch {start_epoch}"
            )

            print("=" * 60)

        except Exception as e:

            print(
                "\nWARNING: Checkpoint could not be loaded."
            )

            print(
                f"Reason: {e}"
            )

            print(
                "Starting from Epoch 1."
            )

            start_epoch = 1
            best_val_f1 = -1.0

    else:

        print(
            "\nNo checkpoint found."
        )

        print(
            "Starting training from Epoch 1."
        )

    # ========================================================
    # ALREADY COMPLETE CHECK
    # ========================================================

    if start_epoch > args.epochs:

        print("\n" + "=" * 60)
        print("        TRAINING ALREADY COMPLETE")
        print("=" * 60)

        print(
            f"Checkpoint epoch : {start_epoch - 1}"
        )

        print(
            f"Requested epochs : {args.epochs}"
        )

        print(
            "Nothing more to train."
        )

        return

    # ========================================================
    # TRAINING LOOP
    # ========================================================

    print("\nStarting training loop...")

    for epoch in range(
        start_epoch,
        args.epochs + 1
    ):

        model.train()

        train_loss = 0.0
        correct_train = 0
        total_train = 0

        # ----------------------------------------------------
        # Training phase
        # ----------------------------------------------------

        for batch_x, batch_y in train_loader:

            optimizer.zero_grad()

            logits = model(batch_x)

            loss = criterion(
                logits,
                batch_y
            )

            loss.backward()

            optimizer.step()

            train_loss += (
                loss.item()
                * len(batch_y)
            )

            preds = logits.argmax(
                dim=-1
            )

            correct_train += (
                (preds == batch_y)
                .sum()
                .item()
            )

            total_train += len(batch_y)

        train_loss /= max(
            1,
            total_train
        )

        train_acc = (
            correct_train
            / max(1, total_train)
        )

        # ----------------------------------------------------
        # Validation phase
        # ----------------------------------------------------

        model.eval()

        val_loss = 0.0

        val_preds_list = []
        val_targets_list = []

        with torch.no_grad():

            for batch_x, batch_y in val_loader:

                logits = model(batch_x)

                loss = criterion(
                    logits,
                    batch_y
                )

                val_loss += (
                    loss.item()
                    * len(batch_y)
                )

                preds = logits.argmax(
                    dim=-1
                )

                val_preds_list.extend(
                    preds.cpu()
                    .numpy()
                    .tolist()
                )

                val_targets_list.extend(
                    batch_y.cpu()
                    .numpy()
                    .tolist()
                )

        val_loss /= max(
            1,
            len(val_targets_list)
        )

        val_acc = accuracy_score(
            val_targets_list,
            val_preds_list
        )

        p, r, f1, _ = (
            precision_recall_fscore_support(
                val_targets_list,
                val_preds_list,
                average="macro",
                zero_division=0
            )
        )

        # ----------------------------------------------------
        # Training history
        # ----------------------------------------------------

        history.append(
            {
                "epoch": epoch,
                "train_loss": round(
                    train_loss,
                    4
                ),
                "train_acc": round(
                    train_acc,
                    4
                ),
                "val_loss": round(
                    val_loss,
                    4
                ),
                "val_acc": round(
                    val_acc,
                    4
                ),
                "val_precision": round(
                    p,
                    4
                ),
                "val_recall": round(
                    r,
                    4
                ),
                "val_f1": round(
                    f1,
                    4
                ),
            }
        )

        # ----------------------------------------------------
        # BEST MODEL CHECKPOINT
        # ----------------------------------------------------

        is_best = f1 > best_val_f1

        if is_best:

            best_val_f1 = f1

            # Save best model weights
            torch.save(
                model.state_dict(),
                MODELS_DIR
                / "best_model.pth"
            )

            # Save complete checkpoint
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict":
                        model.state_dict(),
                    "optimizer_state_dict":
                        optimizer.state_dict(),
                    "val_f1": f1,
                },
                MODELS_DIR
                / "checkpoints"
                / "best_checkpoint.pth"
            )

            marker = "[BEST]"

        else:

            marker = ""

        print(
            f"Epoch [{epoch:2d}/{args.epochs:2d}] "
            f"Loss: {train_loss:.4f} | "
            f"Val Loss: {val_loss:.4f} | "
            f"Val Acc: {val_acc:.4f} | "
            f"Val F1: {f1:.4f} "
            f"{marker}"
        )

    # ========================================================
    # SAVE TRAINING HISTORY
    # ========================================================

    pd.DataFrame(
        history
    ).to_csv(
        REPORTS_DIR
        / "training_history.csv",
        index=False
    )

    # ========================================================
    # LOAD SUBJECT METADATA
    # ========================================================

    train_subjs = list(
        set(s_tr)
    )

    val_subjs = list(
        set(s_val)
    )

    test_subjs = []

    if test_csv.exists():

        t_df = pd.read_csv(
            test_csv
        )

        test_subjs = list(
            t_df["subject_id"]
            .unique()
        )

    # ========================================================
    # MODEL METADATA
    # ========================================================

    metadata = {

        "model_name":
            "EEGArtifact1DCNN",

        "architecture":
            "1D_CNN_Conv3_Gap_Dense",

        "input_shape":
            [1, win_len],

        "sampling_rate":
            160.0,

        "window_size_seconds":
            args.window_sec,

        "window_samples":
            win_len,

        "overlap":
            args.overlap,

        "classes":
            {
                "0": "KEEP",
                "1": "REMOVE"
            },

        "normalization":
            "z-score per window",

        "training_subjects":
            train_subjs,

        "validation_subjects":
            val_subjs,

        "test_subjects":
            test_subjs,

        "training_date":
            datetime.now().isoformat(),

        "best_val_f1":
            round(
                best_val_f1,
                4
            ),

        "total_train_windows":
            len(X_train),

        "total_val_windows":
            len(X_val),
    }

    with open(
        MODELS_DIR
        / "model_metadata.json",
        "w"
    ) as f:

        json.dump(
            metadata,
            f,
            indent=2
        )

    # ========================================================
    # COMPLETE
    # ========================================================

    print("\n" + "=" * 60)
    print("             TRAINING COMPLETE")
    print("=" * 60)

    print(
        f"Best Validation F1 : "
        f"{best_val_f1:.4f}"
    )

    print(
        f"Best model saved   : "
        f"{MODELS_DIR / 'best_model.pth'}"
    )

    print(
        f"Metadata saved     : "
        f"{MODELS_DIR / 'model_metadata.json'}"
    )

    print(
        f"History CSV saved  : "
        f"{REPORTS_DIR / 'training_history.csv'}"
    )

    print("=" * 60 + "\n")


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=
        "NeuroAgent 1D CNN Model Trainer"
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=15
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=32
    )

    parser.add_argument(
        "--lr",
        type=float,
        default=0.001
    )

    parser.add_argument(
        "--window-sec",
        type=float,
        default=2.0
    )

    parser.add_argument(
        "--overlap",
        type=float,
        default=0.5
    )

    parser.add_argument(
        "--dropout",
        type=float,
        default=0.3
    )

    args = parser.parse_args()

    train_cnn(args)


if __name__ == "__main__":
    main()