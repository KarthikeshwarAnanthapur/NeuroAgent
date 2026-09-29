"""
batch_process.py — NeuroAgent Batch Processing Engine
=====================================================

Processes multiple EEG recordings across subjects in a robust, resumable,
and memory-safe manner. Supports single-subject, multi-subject, single-recording,
full dataset, and resumable execution.

CLI Usage:
    python src/batch_process.py --all
    python src/batch_process.py --subject S002
    python src/batch_process.py --subject S002 S003
    python src/batch_process.py --recording S002R01
    python src/batch_process.py --resume
    python src/batch_process.py --force
"""

import sys
import os
import argparse
import time
from pathlib import Path
from datetime import datetime
import pandas as pd

# Safe encoding for Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend/src to path
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from dataset_inventory import generate_manifest, parse_subject_recording
from pipeline_runner import process_recording

BASE_DIR = SRC_DIR.parent if SRC_DIR.name == "src" else SRC_DIR
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"
REPORTS_DIR = DATA_DIR / "reports"


def get_recordings_list(args):
    """
    Determine the list of EDF files to process based on CLI arguments.
    """
    manifest_path = METADATA_DIR / "dataset_manifest.csv"
    if not manifest_path.exists():
        print("Manifest not found. Generating inventory first...")
        manifest_df = generate_manifest(manifest_path, verbose=False)
    else:
        manifest_df = pd.read_csv(manifest_path)

    # Filter by recording
    if args.recording:
        target = args.recording.strip().upper()
        # Could be S002R01 or R01
        mask = (
            manifest_df["subject_id"] + manifest_df["recording_id"] == target
        ) | (manifest_df["recording_id"] == target)
        matched = manifest_df[mask]
        if matched.empty:
            print(f"Error: Recording '{args.recording}' not found in manifest.")
            return []
        return matched.to_dict("records")

    # Filter by subject(s)
    if args.subject:
        targets = [s.strip().upper() for s in args.subject]
        matched = manifest_df[manifest_df["subject_id"].isin(targets)]
        if matched.empty:
            print(f"Error: None of the subjects {args.subject} found in manifest.")
            return []
        return matched.to_dict("records")

    # Default to all if --all or --resume specified without targets
    if args.all or args.resume:
        return manifest_df.to_dict("records")

    return []


def run_batch(args):
    """
    Execute batch processing with progress display and summary reporting.
    """
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

    recordings = get_recordings_list(args)
    if not recordings:
        print("No recordings selected. Use --all, --subject <ID>, or --recording <ID>.")
        return

    # Count unique subjects
    unique_subjects = len(set(r["subject_id"] for r in recordings))
    total_files = len(recordings)

    print("\n" + "=" * 60)
    print("           NEUROAGENT BATCH PROCESSING")
    print("=" * 60)
    print(f"Subjects to process: {unique_subjects}")
    print(f"EDF recordings to process: {total_files}")
    if args.resume:
        print("Mode: RESUME (skipping already completed recordings)")
    if args.force:
        print("Mode: FORCE (overwriting completed recordings)")
    print("=" * 60 + "\n")

    success_list = []
    failed_list = []
    skipped_list = []
    batch_start = time.time()

    summary_records = []

    for idx, item in enumerate(recordings, 1):
        subj = item["subject_id"]
        rec = item["recording_id"]
        edf_path = Path(item["file_path"])
        prefix = f"{subj}{rec}"

        print(f"[{idx:3d}/{total_files}] {prefix}")

        # Stage callback for terminal display
        def cli_stage_callback(stage_name, status, dur):
            if stage_name != "TOTAL":
                mark = "[OK]" if status == "SUCCESS" else ("[FAIL]" if status == "FAILED" else "[-]")
                print(f"    {stage_name:<16} {mark}  ({dur:.1f}s)")

        res = process_recording(
            edf_path=edf_path,
            subject_id=subj,
            recording_id=rec,
            force=args.force,
            verbose=False,
            stage_callback=cli_stage_callback,
        )

        status = res["status"]
        dur = res["duration"]

        if status == "SUCCESS":
            success_list.append(prefix)
            print(f"    Total: {dur:.1f}s  [OK] COMPLETE\n")
            summary_records.append({
                "subject_id": subj,
                "recording_id": rec,
                "status": "SUCCESS",
                "duration": round(dur, 2),
                "components": res.get("components", 0),
                "removed": res.get("removed", 0),
                "kept": res.get("kept", 0),
                "review": res.get("review", 0),
                "quality": res.get("quality", "N/A"),
                "error": "",
            })
        elif status == "SKIPPED":
            skipped_list.append(prefix)
            print("    Already completed  - SKIPPED\n")
            summary_records.append({
                "subject_id": subj,
                "recording_id": rec,
                "status": "SKIPPED",
                "duration": 0.0,
                "components": "",
                "removed": "",
                "kept": "",
                "review": "",
                "quality": "",
                "error": "",
            })
        else:
            failed_list.append((prefix, res.get("failed_stage", "UNKNOWN"), res.get("error", "")))
            print(f"    Total: {dur:.1f}s  ✕ FAILED at {res.get('failed_stage', 'UNKNOWN')}\n")
            summary_records.append({
                "subject_id": subj,
                "recording_id": rec,
                "status": "FAILED",
                "duration": round(dur, 2),
                "components": 0,
                "removed": 0,
                "kept": 0,
                "review": 0,
                "quality": "NOT GOOD",
                "error": res.get("error", ""),
            })

        # Save / update summary CSV incrementally
        summary_df = pd.DataFrame(summary_records)
        summary_df.to_csv(REPORTS_DIR / "processing_summary.csv", index=False)

    total_batch_time = time.time() - batch_start

    # Final summary display
    print("\n" + "=" * 60)
    print("             BATCH PROCESSING COMPLETE")
    print("=" * 60)
    print(f"Total time elapsed: {total_batch_time / 60:.1f} minutes")
    print(f"SUCCESS : {len(success_list)}")
    print(f"SKIPPED : {len(skipped_list)}")
    print(f"FAILED  : {len(failed_list)}")

    if failed_list:
        print("\n" + "-" * 40)
        print("FAILED RECORDINGS:")
        print("-" * 40)
        for p, stg, err in failed_list:
            print(f"  {p} — Failed at {stg}: {err}")

    print("\nSummary saved to: reports/processing_summary.csv")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="NeuroAgent Batch Processing Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--all", action="store_true", help="Process all EDF files in dataset")
    parser.add_argument("--subject", nargs="+", help="Process specific subject(s), e.g. S002 S003")
    parser.add_argument("--recording", help="Process a single recording, e.g. S002R01")
    parser.add_argument("--resume", action="store_true", help="Resume batch, skipping completed")
    parser.add_argument("--force", action="store_true", help="Reprocess even if already completed")
    parser.add_argument("--workers", type=int, default=1, help="Number of workers (default 1)")

    args = parser.parse_args()

    # If no arguments given, print help
    if not (args.all or args.subject or args.recording or args.resume):
        parser.print_help()
        sys.exit(0)

    run_batch(args)


if __name__ == "__main__":
    main()
