"""
evaluate_model.py — 1D CNN Model Evaluation & Per-Subject Breakdown
===================================================================

Evaluates the trained EEGArtifact1DCNN on held-out test subjects,
computes overall performance metrics, generates confusion matrix,
and outputs per-subject evaluation breakdown.

Outputs:
    data/reports/training_metrics.json
    data/reports/per_subject_results.csv
    data/reports/confusion_matrix.png
"""

import sys
import os
import json
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
)

# Safe encoding for Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


# ============================================================
# PATH SETUP
# ============================================================

SRC_DIR = Path(__file__).resolve().parent

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from cnn_model import EEGArtifact1DCNN
from train_model import extract_windows_from_csv


BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR

DATA_DIR = BASE_DIR / "data"
TRAINING_DIR = DATA_DIR / "training"
MODELS_DIR = DATA_DIR / "models"
REPORTS_DIR = DATA_DIR / "reports"


# ============================================================
# MODEL EVALUATION
# ============================================================

def evaluate_model(eval_set="test"):
    """
    Run evaluation and produce comprehensive metrics
    and per-subject breakdown.
    """

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODELS_DIR / "best_model.pth"
    meta_path = MODELS_DIR / "model_metadata.json"

    # --------------------------------------------------------
    # Check model
    # --------------------------------------------------------

    if not model_path.exists():
        print(
            f"Error: Model file not found at {model_path}. "
            f"Train model first with train_model.py."
        )
        return None

    if not meta_path.exists():
        print(
            f"Error: Metadata file not found at {meta_path}."
        )
        return None

    # --------------------------------------------------------
    # Load metadata
    # --------------------------------------------------------

    with open(meta_path, "r") as f:
        metadata = json.load(f)

    win_sec = metadata.get("window_size_seconds", 2.0)
    overlap = metadata.get("overlap", 0.5)

    # --------------------------------------------------------
    # Determine CSV to evaluate
    # --------------------------------------------------------

    csv_file = TRAINING_DIR / f"{eval_set}.csv"

    if not csv_file.exists():
        print(
            f"Warning: {csv_file} not found."
        )

        csv_file = TRAINING_DIR / "validation.csv"

        if not csv_file.exists():
            csv_file = TRAINING_DIR / "train.csv"

    # --------------------------------------------------------
    # Header
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("         NEUROAGENT 1D CNN MODEL EVALUATION")
    print("=" * 60)

    print(f"Evaluating dataset file : {csv_file}")
    print(f"Model path              : {model_path}")

    # --------------------------------------------------------
    # Extract evaluation windows
    # --------------------------------------------------------

    print("\nExtracting evaluation windows...")

    X_eval, y_eval, subjs, recs, comps = extract_windows_from_csv(
        csv_file,
        window_sec=win_sec,
        overlap=overlap
    )

    if len(X_eval) == 0:

        print(
            "Warning: No evaluation windows extracted. "
            "Trying validation or train set..."
        )

        for alt in ["validation.csv", "train.csv"]:

            alt_path = TRAINING_DIR / alt

            if alt_path.exists():

                X_eval, y_eval, subjs, recs, comps = (
                    extract_windows_from_csv(
                        alt_path,
                        window_sec=win_sec,
                        overlap=overlap
                    )
                )

                if len(X_eval) > 0:

                    csv_file = alt_path

                    print(
                        f"Loaded {len(X_eval)} windows from {alt}"
                    )

                    break

    if len(X_eval) == 0:

        print(
            "Error: No evaluation samples could be loaded."
        )

        return None

    print(
        f"Total evaluation windows : {len(X_eval):,}"
    )

    # --------------------------------------------------------
    # Load trained model
    # --------------------------------------------------------

    print("\nLoading trained model...")

    model = EEGArtifact1DCNN(
        in_channels=1,
        n_classes=2
    )

    model.load_state_dict(
        torch.load(
            model_path,
            map_location="cpu"
        )
    )

    model.eval()

    print("✓ Model loaded successfully")

    # ========================================================
    # BATCH INFERENCE
    # ========================================================
    #
    # IMPORTANT:
    #
    # Previously the code did:
    #
    #     inputs = torch.tensor(X_eval)
    #
    # This attempted to convert the ENTIRE test dataset
    # into one huge tensor.
    #
    # That caused:
    #
    #     not enough memory
    #
    # because the system attempted to allocate ~15 GB.
    #
    # We now process small batches instead.
    #
    # ========================================================

    print("\n" + "-" * 60)
    print("                 BATCH INFERENCE")
    print("-" * 60)

    # Small batch size because this machine is CPU-only
    BATCH_SIZE = 128

    print(
        f"Batch size              : {BATCH_SIZE}"
    )

    print(
        "Running predictions..."
    )

    all_probas = []

    total_windows = len(X_eval)

    with torch.no_grad():

        for start in range(
            0,
            total_windows,
            BATCH_SIZE
        ):

            end = min(
                start + BATCH_SIZE,
                total_windows
            )

            # Extract only a small portion
            batch_x = X_eval[start:end]

            # Convert only this batch to a tensor
            batch_tensor = torch.tensor(
                batch_x,
                dtype=torch.float32
            )

            # Run model
            batch_proba = model.predict_proba(
                batch_tensor
            ).numpy()

            all_probas.append(
                batch_proba
            )

            # Delete temporary tensors immediately
            del batch_tensor
            del batch_x

            # Progress display
            processed = end

            percent = (
                processed / total_windows
            ) * 100

            print(
                f"\r  Progress: "
                f"{processed:,}/{total_windows:,} "
                f"windows "
                f"({percent:.1f}%)",
                end="",
                flush=True
            )

    print()

    # Combine probabilities
    probas = np.concatenate(
        all_probas,
        axis=0
    )

    # Predicted class
    preds = probas.argmax(
        axis=-1
    )

    print(
        f"✓ Inference complete: "
        f"{len(preds):,} windows"
    )

    # Free list after combining
    del all_probas

    # --------------------------------------------------------
    # Overall Performance Metrics
    # --------------------------------------------------------

    acc = float(
        accuracy_score(
            y_eval,
            preds
        )
    )

    prec, rec, f1, _ = (
        precision_recall_fscore_support(
            y_eval,
            preds,
            average="macro",
            zero_division=0
        )
    )

    prec_w, rec_w, f1_w, _ = (
        precision_recall_fscore_support(
            y_eval,
            preds,
            average="weighted",
            zero_division=0
        )
    )

    cm = confusion_matrix(
        y_eval,
        preds,
        labels=[0, 1]
    ).tolist()

    # --------------------------------------------------------
    # Print Overall Metrics
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("                 OVERALL METRICS")
    print("=" * 60)

    print(
        f"  Accuracy          : "
        f"{acc * 100:.2f}%"
    )

    print(
        f"  Macro Precision   : "
        f"{prec:.4f}"
    )

    print(
        f"  Macro Recall      : "
        f"{rec:.4f}"
    )

    print(
        f"  Macro F1-Score    : "
        f"{f1:.4f}"
    )

    print(
        f"  Weighted F1-Score : "
        f"{f1_w:.4f}"
    )

    # --------------------------------------------------------
    # Confusion Matrix
    # --------------------------------------------------------

    print(
        "\nConfusion Matrix "
        "(Rows=True, Cols=Pred):"
    )

    print(
        "              Pred: KEEP   Pred: REMOVE"
    )

    print(
        f"  True: KEEP    "
        f"{cm[0][0]:<12} "
        f"{cm[0][1]}"
    )

    print(
        f"  True: REMOVE  "
        f"{cm[1][0]:<12} "
        f"{cm[1][1]}"
    )

    # --------------------------------------------------------
    # Save Metrics JSON
    # --------------------------------------------------------

    metrics_dict = {
        "evaluation_file": str(csv_file),
        "total_windows": len(y_eval),
        "accuracy": round(acc, 4),
        "macro_precision": round(
            float(prec),
            4
        ),
        "macro_recall": round(
            float(rec),
            4
        ),
        "macro_f1": round(
            float(f1),
            4
        ),
        "weighted_f1": round(
            float(f1_w),
            4
        ),
        "confusion_matrix": cm,
        "classes": {
            "0": "KEEP",
            "1": "REMOVE"
        },
    }

    metrics_path = (
        REPORTS_DIR /
        "training_metrics.json"
    )

    with open(
        metrics_path,
        "w"
    ) as f:

        json.dump(
            metrics_dict,
            f,
            indent=2
        )

    print(
        f"\nMetrics saved to:"
        f"\n{metrics_path}"
    )

    # ========================================================
    # PER-SUBJECT BREAKDOWN
    # ========================================================

    print("\n" + "=" * 60)
    print("              PER-SUBJECT EVALUATION")
    print("=" * 60)

    per_subj_rows = []

    df_results = pd.DataFrame({
        "subject": subjs,
        "recording": recs,
        "component": comps,
        "y_true": y_eval,
        "y_pred": preds,
        "prob_artifact": probas[:, 1],
    })

    for s, group in df_results.groupby(
        "subject"
    ):

        y_t = group[
            "y_true"
        ].values

        y_p = group[
            "y_pred"
        ].values

        s_acc = float(
            accuracy_score(
                y_t,
                y_p
            )
        )

        s_p, s_r, s_f1, _ = (
            precision_recall_fscore_support(
                y_t,
                y_p,
                average="macro",
                zero_division=0
            )
        )

        keep_mask = (
            y_t == 0
        )

        rem_mask = (
            y_t == 1
        )

        keep_acc = (
            float(
                (
                    y_p[keep_mask] == 0
                ).mean()
            )
            if keep_mask.sum() > 0
            else 0.0
        )

        rem_acc = (
            float(
                (
                    y_p[rem_mask] == 1
                ).mean()
            )
            if rem_mask.sum() > 0
            else 0.0
        )

        per_subj_rows.append({
            "subject_id": s,

            "total_windows": len(
                group
            ),

            "keep_count": int(
                keep_mask.sum()
            ),

            "remove_count": int(
                rem_mask.sum()
            ),

            "accuracy": round(
                s_acc,
                4
            ),

            "precision": round(
                float(s_p),
                4
            ),

            "recall": round(
                float(s_r),
                4
            ),

            "f1_score": round(
                float(s_f1),
                4
            ),

            "keep_accuracy": round(
                keep_acc,
                4
            ),

            "remove_accuracy": round(
                rem_acc,
                4
            ),
        })

    per_subj_df = pd.DataFrame(
        per_subj_rows
    )

    per_subject_path = (
        REPORTS_DIR /
        "per_subject_results.csv"
    )

    per_subj_df.to_csv(
        per_subject_path,
        index=False
    )

    print(
        "\nPer-Subject Results Summary:"
    )

    print(
        per_subj_df.to_string(
            index=False
        )
    )

    print(
        f"\nPer-subject results saved to:"
        f"\n{per_subject_path}"
    )

    # ========================================================
    # CONFUSION MATRIX IMAGE
    # ========================================================

    try:

        import matplotlib

        matplotlib.use(
            "Agg"
        )

        import matplotlib.pyplot as plt

        plt.figure(
            figsize=(6, 5)
        )

        plt.imshow(
            cm,
            interpolation="nearest",
            cmap="Blues"
        )

        plt.title(
            "NeuroAgent 1D CNN Confusion Matrix"
        )

        plt.colorbar()

        tick_marks = np.arange(
            2
        )

        plt.xticks(
            tick_marks,
            ["KEEP", "REMOVE"]
        )

        plt.yticks(
            tick_marks,
            ["KEEP", "REMOVE"]
        )

        thresh = (
            cm[0][0]
            + cm[1][1]
            + cm[0][1]
            + cm[1][0]
        ) / 4.0

        for i in range(2):

            for j in range(2):

                plt.text(
                    j,
                    i,
                    format(
                        cm[i][j],
                        "d"
                    ),
                    horizontalalignment="center",
                    color=(
                        "white"
                        if cm[i][j] > thresh
                        else "black"
                    ),
                )

        plt.ylabel(
            "True Label"
        )

        plt.xlabel(
            "Predicted Label"
        )

        plt.tight_layout()

        confusion_path = (
            REPORTS_DIR /
            "confusion_matrix.png"
        )

        plt.savefig(
            confusion_path,
            dpi=150
        )

        plt.close()

        print(
            f"\nConfusion matrix plot saved:"
            f"\n{confusion_path}"
        )

    except Exception as e:

        print(
            f"\n(Matplotlib plot skipped: {e})"
        )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print("\n" + "=" * 60)
    print("              EVALUATION COMPLETE")
    print("=" * 60)

    print(
        f"Test windows : {len(y_eval):,}"
    )

    print(
        f"Accuracy     : {acc * 100:.2f}%"
    )

    print(
        f"Macro F1     : {f1:.4f}"
    )

    print(
        f"Weighted F1  : {f1_w:.4f}"
    )

    print(
        f"\nAll evaluation outputs saved to:"
        f"\n{REPORTS_DIR}"
    )

    print("=" * 60 + "\n")

    return metrics_dict


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description="NeuroAgent 1D CNN Evaluation"
    )

    parser.add_argument(
        "--eval-set",
        default="test",
        choices=[
            "test",
            "validation",
            "train"
        ]
    )

    args = parser.parse_args()

    evaluate_model(
        eval_set=args.eval_set
    )


if __name__ == "__main__":
    main()