"""
dataset_inventory.py — NeuroAgent Dataset Inventory & Manifest Generator
========================================================================

Scans raw EEG directory, reads EDF metadata (without full preload),
validates integrity, and outputs data/metadata/dataset_manifest.csv.
"""

import sys
import os
import re
import time
from pathlib import Path
import pandas as pd
import mne

# Resolve root and data directories
SRC_DIR = Path(__file__).resolve().parent
BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"


def parse_subject_recording(filepath):
    """
    Extract subject_id and recording_id from filepath or filename.
    Examples:
        S002/S002R01.edf -> subject_id: S002, recording_id: R01
        S049R14.edf      -> subject_id: S049, recording_id: R14
    """
    stem = filepath.stem
    match = re.match(r"^(S\d{3})(R\d{2})$", stem, re.IGNORECASE)
    if match:
        return match.group(1).upper(), match.group(2).upper()
    
    # Fallback to parent dir if named S002 etc.
    parent_name = filepath.parent.name
    if re.match(r"^S\d{3}$", parent_name, re.IGNORECASE):
        rec_match = re.search(r"R\d{2}", stem, re.IGNORECASE)
        rec_id = rec_match.group(0).upper() if rec_match else stem
        return parent_name.upper(), rec_id
    
    return parent_name, stem


def is_already_processed(subject_id, recording_id):
    """
    Check if a recording has already been processed to completion.
    Checks both subject directory and legacy flat directory.
    """
    prefix = f"{subject_id}{recording_id}"
    subj_recon = PROCESSED_DIR / subject_id / f"{prefix}_reconstructed_raw.fif"
    subj_report = PROCESSED_DIR / subject_id / f"{prefix}_quality_report.csv"
    flat_recon = PROCESSED_DIR / f"{prefix}_reconstructed_raw.fif"
    flat_report = PROCESSED_DIR / f"{prefix}_quality_report.csv"
    
    return (subj_recon.exists() and subj_report.exists()) or (flat_recon.exists() and flat_report.exists())


def generate_manifest(output_csv=None, verbose=True):
    """
    Recursively scans raw EEG files, creates manifest CSV and prints summary.
    """
    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    if output_csv is None:
        output_csv = METADATA_DIR / "dataset_manifest.csv"
    else:
        output_csv = Path(output_csv)

    print("\n" + "=" * 60)
    print("       NEUROAGENT DATASET INVENTORY SCANNER")
    print("=" * 60)
    print(f"Scanning directory: {RAW_DIR}")

    edf_files = sorted(RAW_DIR.rglob("*.edf"))
    print(f"Discovered EDF files: {len(edf_files)}\n")

    manifest_rows = []
    total_duration = 0.0
    valid_count = 0
    invalid_count = 0
    subjects_set = set()
    channels_set = set()
    sfreq_set = set()

    for idx, fpath in enumerate(edf_files, 1):
        subj_id, rec_id = parse_subject_recording(fpath)
        subjects_set.add(subj_id)
        fsize = fpath.stat().st_size
        already_done = is_already_processed(subj_id, rec_id)

        try:
            raw = mne.io.read_raw_edf(str(fpath), preload=False, verbose=False)
            chans = raw.info["nchan"]
            sfreq = float(raw.info["sfreq"])
            duration = float(raw.times[-1]) if len(raw.times) > 0 else 0.0
            nsamples = int(raw.n_times)
            status = "VALID"
            err_msg = ""

            valid_count += 1
            total_duration += duration
            channels_set.add(chans)
            sfreq_set.add(sfreq)

            if verbose and (idx <= 5 or idx % 50 == 0 or idx == len(edf_files)):
                print(f"[{idx:3d}/{len(edf_files)}] {subj_id}{rec_id} | {chans} ch @ {sfreq:.0f} Hz | {duration:.1f}s | {status}")

        except Exception as e:
            chans = 0
            sfreq = 0.0
            duration = 0.0
            nsamples = 0
            status = "INVALID"
            err_msg = str(e)
            invalid_count += 1
            print(f"[{idx:3d}/{len(edf_files)}] {subj_id}{rec_id} | ERROR: {err_msg}")

        manifest_rows.append({
            "subject_id": subj_id,
            "recording_id": rec_id,
            "file_path": str(fpath.resolve()),
            "file_size": fsize,
            "channels": chans,
            "sampling_rate": sfreq,
            "duration": round(duration, 2),
            "number_of_samples": nsamples,
            "status": status,
            "error": err_msg,
            "processed": already_done,
            "processing_time": 0.0
        })

    df = pd.DataFrame(manifest_rows)
    df.to_csv(output_csv, index=False)
    print(f"\nManifest saved to: {output_csv}")

    # Print summary
    print("\n" + "=" * 60)
    print("             DATASET SUMMARY")
    print("=" * 60)
    print(f"Total subjects discovered : {len(subjects_set)}")
    print(f"Total EDF files           : {len(edf_files)}")
    print(f"Total channels variants   : {sorted(list(channels_set)) if channels_set else 'None'}")
    print(f"Sampling frequencies (Hz) : {sorted(list(sfreq_set)) if sfreq_set else 'None'}")
    print(f"Total recording duration  : {total_duration / 3600:.2f} hours ({total_duration:.1f} seconds)")
    print(f"Valid files               : {valid_count}")
    print(f"Invalid files             : {invalid_count}")
    print(f"Already processed files   : {df['processed'].sum()}")
    print("=" * 60 + "\n")

    return df


if __name__ == "__main__":
    generate_manifest()
