"""
generate_report.py — NeuroAgent Final Dataset & Model Report Generator
======================================================================

Aggregates statistics from dataset inventory, processing logs, quality reports,
training dataset metadata, and model evaluation metrics into:
    data/reports/final_dataset_report.json
"""

import sys
import json
import argparse
from pathlib import Path
import numpy as np
import pandas as pd

SRC_DIR = Path(__file__).resolve().parent
BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR
DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"
TRAINING_DIR = DATA_DIR / "training"
MODELS_DIR = DATA_DIR / "models"
REPORTS_DIR = DATA_DIR / "reports"


def generate_final_report():
    """
    Compile and export final_dataset_report.json without inventing any metrics.
    """
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_file = REPORTS_DIR / "final_dataset_report.json"

    print("\n" + "=" * 60)
    print("      NEUROAGENT FINAL DATASET & MODEL REPORT")
    print("=" * 60)

    # 1. Processing statistics from processed folder and summary CSV
    summary_csv = REPORTS_DIR / "processing_summary.csv"
    processed_subjs = set()
    recordings_processed = 0
    recordings_failed = 0
    total_components = 0
    total_keep = 0
    total_remove = 0
    total_review = 0
    good_quality_count = 0
    total_quality_reports = 0
    delta_reductions = []

    # Scan processed directories
    for subj_dir in sorted(PROCESSED_DIR.glob("S*")):
        if subj_dir.is_dir():
            s_name = subj_dir.name
            q_files = list(subj_dir.glob("*_quality_report.csv"))
            if q_files:
                processed_subjs.add(s_name)
            for qf in q_files:
                recordings_processed += 1
                try:
                    q_df = pd.read_csv(qf)
                    total_quality_reports += 1
                    q_dict = dict(zip(q_df["metric"], q_df["value"]))
                    if str(q_dict.get("overall_quality", "")).upper() == "GOOD":
                        good_quality_count += 1
                    rem = int(float(q_dict.get("components_removed", 0)))
                    kp = int(float(q_dict.get("components_kept", 0)))
                    rev = int(float(q_dict.get("components_review", 0)))
                    total_remove += rem
                    total_keep += kp
                    total_review += rev
                    total_components += (rem + kp + rev)

                    # Artifact reduction (delta band power reduction is primary EEG artifact indicator)
                    d_change = q_dict.get("delta_change_percent")
                    if d_change is not None:
                        try:
                            # positive reduction = -change_percent
                            reduction = -float(d_change)
                            delta_reductions.append(reduction)
                        except (ValueError, TypeError):
                            pass
                except Exception as e:
                    print(f"Warning reading {qf}: {e}")

    # Fallback to legacy flat if S002 was not in subfolder yet
    if not processed_subjs:
        for qf in PROCESSED_DIR.glob("S*R*_quality_report.csv"):
            recordings_processed += 1
            s_id = qf.name[:4]
            processed_subjs.add(s_id)
            try:
                q_df = pd.read_csv(qf)
                total_quality_reports += 1
                q_dict = dict(zip(q_df["metric"], q_df["value"]))
                if str(q_dict.get("overall_quality", "")).upper() == "GOOD":
                    good_quality_count += 1
                rem = int(float(q_dict.get("components_removed", 0)))
                kp = int(float(q_dict.get("components_kept", 0)))
                rev = int(float(q_dict.get("components_review", 0)))
                total_remove += rem
                total_keep += kp
                total_review += rev
                total_components += (rem + kp + rev)
                d_change = q_dict.get("delta_change_percent")
                if d_change is not None:
                    delta_reductions.append(-float(d_change))
            except Exception:
                pass

    # Read processing log for failures
    log_csv = METADATA_DIR / "processing_log.csv"
    if log_csv.exists():
        try:
            log_df = pd.read_csv(log_csv)
            failed_rows = log_df[log_df["status"] == "FAILED"]
            recordings_failed = len(failed_rows["recording"].unique())
        except Exception:
            pass

    # 2. Training Dataset Samples
    train_samples = 0
    val_samples = 0
    test_samples = 0

    for split_name, var_name in [("train", "train_samples"), ("validation", "val_samples"), ("test", "test_samples")]:
        sp_path = TRAINING_DIR / f"{split_name}.csv"
        if sp_path.exists():
            try:
                sp_df = pd.read_csv(sp_path)
                if split_name == "train":
                    train_samples = len(sp_df)
                elif split_name == "validation":
                    val_samples = len(sp_df)
                elif split_name == "test":
                    test_samples = len(sp_df)
            except Exception:
                pass

    # 3. Model Evaluation Metrics
    metrics_json = REPORTS_DIR / "training_metrics.json"
    model_acc = "N/A"
    model_prec = "N/A"
    model_rec = "N/A"
    model_f1 = "N/A"

    if metrics_json.exists():
        try:
            with open(metrics_json, "r") as f:
                m_data = json.load(f)
            model_acc = m_data.get("accuracy", "N/A")
            model_prec = m_data.get("macro_precision", "N/A")
            model_rec = m_data.get("macro_recall", "N/A")
            model_f1 = m_data.get("macro_f1", "N/A")
        except Exception as e:
            print(f"Warning reading training metrics: {e}")

    # Compute averages
    avg_quality = (
        f"{round((good_quality_count / total_quality_reports) * 100, 1)}% GOOD"
        if total_quality_reports > 0
        else "N/A"
    )
    avg_artifact_red = (
        f"{round(float(np.mean(delta_reductions)), 2)}%"
        if delta_reductions
        else "N/A"
    )

    final_report = {
        "subjects_processed": len(processed_subjs),
        "recordings_processed": recordings_processed,
        "recordings_failed": recordings_failed,
        "total_ica_components": total_components,
        "total_keep": total_keep,
        "total_remove": total_remove,
        "total_review": total_review,
        "average_quality_score": avg_quality,
        "average_artifact_reduction": avg_artifact_red,
        "training_samples": train_samples,
        "validation_samples": val_samples,
        "test_samples": test_samples,
        "model_accuracy": model_acc,
        "model_precision": model_prec,
        "model_recall": model_rec,
        "model_f1": model_f1,
    }

    with open(report_file, "w") as f:
        json.dump(final_report, f, indent=2)

    print("\nFinal Dataset Report:")
    for k, v in final_report.items():
        print(f"  {k:<30}: {v}")

    print(f"\nReport saved to: {report_file}")
    print("=" * 60 + "\n")
    return final_report


if __name__ == "__main__":
    generate_final_report()
