"""
build_training_dataset.py — Unified Training Dataset Generator
=============================================================

Gathers extracted features and NeuroAgent decisions from all processed recordings,
constructs a unified dataset with explicit pseudo-label tagging, and partitions
data using strict subject-level splitting to prevent data leakage.

Outputs:
    data/training/features.csv
    data/training/labels.csv
    data/training/metadata.csv
    data/training/train.csv
    data/training/validation.csv
    data/training/test.csv
"""

import sys
import os
import argparse
from pathlib import Path
import numpy as np
import pandas as pd

SRC_DIR = Path(__file__).resolve().parent
BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR
DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
TRAINING_DIR = DATA_DIR / "training"
METADATA_DIR = DATA_DIR / "metadata"


def discover_processed_recordings():
    """
    Find all recordings that have both features.csv and neuroagent.csv.
    Checks subject folders (data/processed/S002/) as well as the legacy flat root.
    """
    recordings = []
    
    # 1. Check subject directories
    for subj_dir in sorted(PROCESSED_DIR.glob("S*")):
        if subj_dir.is_dir():
            subj_id = subj_dir.name
            for feat_file in sorted(subj_dir.glob("*_features.csv")):
                prefix = feat_file.name.replace("_features.csv", "")
                neuro_file = subj_dir / f"{prefix}_neuroagent.csv"
                if neuro_file.exists():
                    rec_id = prefix.replace(subj_id, "")
                    recordings.append({
                        "subject_id": subj_id,
                        "recording_id": rec_id,
                        "features_path": feat_file,
                        "neuroagent_path": neuro_file,
                    })
                    
    # 2. Check legacy flat directory if not already included
    for feat_file in sorted(PROCESSED_DIR.glob("S*R*_features.csv")):
        prefix = feat_file.name.replace("_features.csv", "")
        neuro_file = PROCESSED_DIR / f"{prefix}_neuroagent.csv"
        if neuro_file.exists():
            subj_id = prefix[:4]
            rec_id = prefix[4:]
            # Only add if not already present from subdir
            if not any(r["subject_id"] == subj_id and r["recording_id"] == rec_id for r in recordings):
                recordings.append({
                    "subject_id": subj_id,
                    "recording_id": rec_id,
                    "features_path": feat_file,
                    "neuroagent_path": neuro_file,
                })

    return recordings


def build_dataset(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=42):
    """
    Compile feature table, labels, and generate subject-split train/val/test sets.
    """
    TRAINING_DIR.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "=" * 60)
    print("      NEUROAGENT TRAINING DATASET GENERATOR")
    print("=" * 60)
    
    recordings = discover_processed_recordings()
    print(f"Discovered processed recordings: {len(recordings)}")
    
    if not recordings:
        print("No processed recordings found with features and decisions. Run batch_process.py first.")
        return None

    all_rows = []
    
    for r in recordings:
        subj = r["subject_id"]
        rec = r["recording_id"]
        
        try:
            f_df = pd.read_csv(r["features_path"])
            n_df = pd.read_csv(r["neuroagent_path"])
            
            # Align by component
            merged = pd.merge(f_df, n_df, on="component", suffixes=("_feat", "_neuro"))
            
            for _, row in merged.iterrows():
                comp = row["component"]
                decision = str(row.get("neuroagent_decision", "REVIEW")).upper()
                
                # Exclude purely metadata columns for feature set
                feat_dict = {
                    "subject_id": subj,
                    "recording_id": rec,
                    "component_id": comp,
                }
                
                # Copy numerical feature columns
                for c in f_df.columns:
                    if c != "component":
                        feat_dict[c] = row[c]
                
                # Label information (pseudo-label acknowledgment)
                feat_dict["label"] = decision
                feat_dict["label_type"] = "pseudo_label"
                feat_dict["label_source"] = "neuroagent_evidence_fusion"
                feat_dict["iclabel_label"] = row.get("iclabel_label", "")
                feat_dict["iclabel_confidence"] = row.get("iclabel_confidence", 0.0)
                feat_dict["artifact_score"] = row.get("artifact_score", 0.0)
                feat_dict["brain_score"] = row.get("brain_score", 0.0)
                
                all_rows.append(feat_dict)
                
        except Exception as e:
            print(f"Warning: Failed to parse {subj}{rec}: {e}")

    if not all_rows:
        print("Error: No data rows could be compiled.")
        return None

    full_df = pd.DataFrame(all_rows)
    print(f"Total compiled component samples: {len(full_df)}")
    
    # --------------------------------------------------------
    # Save features.csv, labels.csv, metadata.csv
    # --------------------------------------------------------
    feature_cols = [c for c in full_df.columns if c not in [
        "label", "label_type", "label_source", "iclabel_label", 
        "iclabel_confidence", "artifact_score", "brain_score"
    ]]
    features_df = full_df[feature_cols]
    features_df.to_csv(TRAINING_DIR / "features.csv", index=False)

    label_cols = [
        "subject_id", "recording_id", "component_id", 
        "label", "label_type", "label_source", "iclabel_label", 
        "iclabel_confidence", "artifact_score", "brain_score"
    ]
    labels_df = full_df[label_cols]
    labels_df.to_csv(TRAINING_DIR / "labels.csv", index=False)

    # --------------------------------------------------------
    # Subject-level Split (Prevent Data Leakage)
    # --------------------------------------------------------
    distinct_subjects = sorted(list(full_df["subject_id"].unique()))
    n_subjects = len(distinct_subjects)
    np.random.seed(seed)
    shuffled_subjects = np.random.permutation(distinct_subjects).tolist()
    
    if n_subjects == 1:
        # Single subject fallback (cannot split across subjects)
        print("\nNote: Only 1 subject available. Allocating all to training for initial validation.")
        train_subjs = distinct_subjects
        val_subjs = distinct_subjects
        test_subjs = distinct_subjects
    elif n_subjects == 2:
        train_subjs = [shuffled_subjects[0]]
        val_subjs = [shuffled_subjects[1]]
        test_subjs = [shuffled_subjects[1]]
    else:
        n_train = max(1, int(round(n_subjects * train_ratio)))
        n_val = max(1, int(round(n_subjects * val_ratio)))
        if n_train + n_val >= n_subjects:
            n_train = max(1, n_subjects - 2)
            n_val = 1
        
        train_subjs = shuffled_subjects[:n_train]
        val_subjs = shuffled_subjects[n_train:n_train + n_val]
        test_subjs = shuffled_subjects[n_train + n_val:]
        if not test_subjs:
            test_subjs = val_subjs

    print(f"\nSubject split ({len(distinct_subjects)} subjects total):")
    print(f"  Training subjects   ({len(train_subjs)}): {train_subjs}")
    print(f"  Validation subjects ({len(val_subjs)}): {val_subjs}")
    print(f"  Testing subjects    ({len(test_subjs)}): {test_subjs}")

    train_df = full_df[full_df["subject_id"].isin(train_subjs)].copy()
    val_df = full_df[full_df["subject_id"].isin(val_subjs)].copy()
    test_df = full_df[full_df["subject_id"].isin(test_subjs)].copy()

    train_df.to_csv(TRAINING_DIR / "train.csv", index=False)
    val_df.to_csv(TRAINING_DIR / "validation.csv", index=False)
    test_df.to_csv(TRAINING_DIR / "test.csv", index=False)

    # --------------------------------------------------------
    # Metadata & Limitations Summary
    # --------------------------------------------------------
    meta_records = [
        {"property": "total_samples", "value": len(full_df)},
        {"property": "total_subjects", "value": n_subjects},
        {"property": "total_recordings", "value": len(recordings)},
        {"property": "keep_count", "value": int((full_df["label"] == "KEEP").sum())},
        {"property": "remove_count", "value": int((full_df["label"] == "REMOVE").sum())},
        {"property": "review_count", "value": int((full_df["label"] == "REVIEW").sum())},
        {"property": "label_type", "value": "pseudo-labels (automatically generated via NeuroAgent evidence fusion)"},
        {"property": "ground_truth_status", "value": "NO clinical ground-truth available; labels are algorithmic pseudo-labels"},
        {"property": "train_samples", "value": len(train_df)},
        {"property": "val_samples", "value": len(val_df)},
        {"property": "test_samples", "value": len(test_df)},
    ]
    pd.DataFrame(meta_records).to_csv(TRAINING_DIR / "metadata.csv", index=False)

    print("\nDataset generation complete!")
    print(f"  KEEP samples   : {(full_df['label'] == 'KEEP').sum()}")
    print(f"  REMOVE samples : {(full_df['label'] == 'REMOVE').sum()}")
    print(f"  REVIEW samples : {(full_df['label'] == 'REVIEW').sum()}")
    print(f"Files written to: {TRAINING_DIR}")
    print("=" * 60 + "\n")

    return full_df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NeuroAgent Training Dataset Builder")
    parser.add_argument("--train-ratio", type=float, default=0.70)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    build_dataset(
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
    )
