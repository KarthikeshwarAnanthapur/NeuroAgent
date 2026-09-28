"""
cnn_model.py — 1D CNN Architecture for ICA Component Artifact Classification
=============================================================================

1D Convolutional Neural Network designed to learn temporal pattern representations
from windowed ICA component time-series signals.

Architecture:
    Input: (batch_size, 1, window_samples)
    Conv1D(32, k=7, p=3) -> BatchNorm1d -> ReLU -> MaxPool1d(2)
    Conv1D(64, k=5, p=2) -> BatchNorm1d -> ReLU -> MaxPool1d(2)
    Conv1D(128, k=3, p=1) -> BatchNorm1d -> ReLU
    AdaptiveAvgPool1d(1) -> Flatten
    Linear(128 -> 64) -> ReLU -> Dropout(0.3)
    Linear(64 -> n_classes)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class EEGArtifact1DCNN(nn.Module):
    """
    1D CNN for classifying EEG Independent Component time-series windows
    into artifact vs brain signal classes (KEEP=0, REMOVE=1).
    """

    def __init__(self, in_channels=1, n_classes=2, dropout_rate=0.3):
        super(EEGArtifact1DCNN, self).__init__()

        self.in_channels = in_channels
        self.n_classes = n_classes

        # Feature Extractor Blocks
        self.block1 = nn.Sequential(
            nn.Conv1d(in_channels, 32, kernel_size=7, stride=1, padding=3, bias=False),
            nn.BatchNorm1d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2, stride=2),
        )

        self.block2 = nn.Sequential(
            nn.Conv1d(32, 64, kernel_size=5, stride=1, padding=2, bias=False),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2, stride=2),
        )

        self.block3 = nn.Sequential(
            nn.Conv1d(64, 128, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm1d(128),
            nn.ReLU(inplace=True),
        )

        # Global Average Pooling
        self.gap = nn.AdaptiveAvgPool1d(1)

        # Classification Head
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout_rate),
            nn.Linear(64, n_classes),
        )

    def forward(self, x):
        # Allow (batch, length) or (batch, 1, length)
        if x.dim() == 2:
            x = x.unsqueeze(1)

        feat = self.block1(x)
        feat = self.block2(feat)
        feat = self.block3(feat)
        pooled = self.gap(feat)
        logits = self.classifier(pooled)
        return logits

    def predict_proba(self, x):
        """Compute softmax class probabilities."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            return F.softmax(logits, dim=-1)


if __name__ == "__main__":
    # Smoke test model forward pass
    model = EEGArtifact1DCNN(in_channels=1, n_classes=2)
    dummy_input = torch.randn(8, 1, 320)  # 2s window at 160Hz = 320 samples
    out = model(dummy_input)
    proba = model.predict_proba(dummy_input)
    print("EEGArtifact1DCNN Smoke Test:")
    print(f"  Input shape:       {dummy_input.shape}")
    print(f"  Logits shape:      {out.shape}")
    print(f"  Probabilities:     {proba.shape}")
    print("  Model architecture verified successfully.")
