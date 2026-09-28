"""
cnn_inference.py — 1D CNN Inference Adapter for NeuroAgent Integration
======================================================================

Provides offline and batch inference capabilities for trained EEGArtifact1DCNN models,
producing component-level predictions (cnn_label, cnn_confidence, cnn_artifact_score)
to serve as an additional evidence stream for Evidence Fusion and NeuroAgent.
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from cnn_model import EEGArtifact1DCNN

BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"


def load_trained_cnn(model_path=None):
    """
    Load saved 1D CNN model and metadata.
    Returns (model, metadata) or (None, None) if not found.
    """
    if model_path is None:
        model_path = MODELS_DIR / "best_model.pth"
    else:
        model_path = Path(model_path)

    meta_path = model_path.parent / "model_metadata.json"
    if not model_path.exists() or not meta_path.exists():
        return None, None

    try:
        with open(meta_path, "r") as f:
            metadata = json.load(f)

        model = EEGArtifact1DCNN(in_channels=1, n_classes=2)
        model.load_state_dict(torch.load(model_path, map_location="cpu"))
        model.eval()
        return model, metadata
    except Exception as e:
        print(f"Warning: Failed to load trained CNN model: {e}")
        return None, None


def predict_component_signals(sources_data, sfreq, model=None, window_sec=2.0, overlap=0.5):
    """
    Generate CNN predictions for ICA component time series.

    Parameters
    ----------
    sources_data : np.ndarray
        Shape (n_components, n_samples)
    sfreq : float
        Sampling frequency
    model : nn.Module, optional
        Loaded EEGArtifact1DCNN. If None, attempts to load from default path.

    Returns
    -------
    pd.DataFrame or None
        Columns: component, cnn_label, cnn_confidence, cnn_artifact_score
    """
    if model is None:
        model, meta = load_trained_cnn()
        if model is None:
            return None
        if meta and "window_size_seconds" in meta:
            window_sec = meta["window_size_seconds"]
            overlap = meta.get("overlap", 0.5)

    n_components, n_samples = sources_data.shape
    win_samples = int(window_sec * sfreq)
    step = max(1, int(win_samples * (1.0 - overlap)))

    rows = []

    for comp_idx in range(n_components):
        ts = sources_data[comp_idx]
        windows = []

        for start in range(0, len(ts) - win_samples + 1, step):
            seg = ts[start : start + win_samples]
            std = float(np.std(seg))
            norm_seg = (seg - np.mean(seg)) / (std + 1e-8) if std > 1e-8 else (seg - np.mean(seg))
            windows.append(norm_seg)

        if not windows:
            # Fallback if recording is shorter than window
            std = float(np.std(ts))
            norm_ts = (ts - np.mean(ts)) / (std + 1e-8)
            pad_len = win_samples - len(ts)
            if pad_len > 0:
                norm_ts = np.pad(norm_ts, (0, pad_len), "constant")
            else:
                norm_ts = norm_ts[:win_samples]
            windows.append(norm_ts)

        tensor_x = torch.tensor(np.array(windows, dtype=np.float32)).unsqueeze(1)
        with torch.no_grad():
            probas = model.predict_proba(tensor_x).numpy()  # (n_win, 2)
            avg_probas = probas.mean(axis=0)

        prob_keep = float(avg_probas[0])
        prob_remove = float(avg_probas[1])

        if prob_remove >= 0.5:
            cnn_label = "REMOVE"
            cnn_confidence = prob_remove
        else:
            cnn_label = "KEEP"
            cnn_confidence = prob_keep

        rows.append({
            "component": f"IC{comp_idx + 1}",
            "cnn_label": cnn_label,
            "cnn_confidence": round(cnn_confidence, 4),
            "cnn_artifact_score": round(prob_remove, 4),
        })

    return pd.DataFrame(rows)
