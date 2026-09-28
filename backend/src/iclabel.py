"""
iclabel.py — NeuroAgent ICLabel Classification
================================================

Loads:
    - Preprocessed EEG
    - Extended Infomax ICA solution

Runs the real ICLabel model and reports the
predicted class and confidence for every
independent component.
"""

from pathlib import Path

import mne
import pandas as pd

from mne_icalabel import label_components


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

RAW_FILE = PROCESSED_DIR / "S002R01_preprocessed_raw.fif"
ICA_FILE = PROCESSED_DIR / "S002R01_ica.fif"

OUTPUT_FILE = PROCESSED_DIR / "S002R01_iclabel.csv"


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("\n==========================================")
    print("       NEUROAGENT ICLabel")
    print("==========================================")

    print("\nLoading preprocessed EEG:")
    print(RAW_FILE)

    if not RAW_FILE.exists():
        raise FileNotFoundError(
            f"Preprocessed EEG not found:\n{RAW_FILE}"
        )

    raw = mne.io.read_raw_fif(
        RAW_FILE,
        preload=True,
        verbose=False
    )

    print("Preprocessed EEG loaded.")

    print("\nLoading ICA:")
    print(ICA_FILE)

    if not ICA_FILE.exists():
        raise FileNotFoundError(
            f"ICA file not found:\n{ICA_FILE}"
        )

    ica = mne.preprocessing.read_ica(
        ICA_FILE,
        verbose=False
    )

    print("ICA solution loaded.")

    print("\n==========================================")
    print("DATA INFORMATION")
    print("==========================================")

    print(f"Channels       : {raw.info['nchan']}")
    print(f"Sampling rate  : {raw.info['sfreq']} Hz")
    print(f"ICA components : {ica.n_components_}")
    print(f"ICA method     : {ica.method}")

    return raw, ica


# ============================================================
# RUN ICLabel
# ============================================================

def run_iclabel(raw, ica):

    print("\n==========================================")
    print("          RUNNING ICLabel")
    print("==========================================")

    print("\nAnalyzing ICA components...")
    print("This may take a little while.\n")

    result = label_components(
        raw,
        ica,
        method="iclabel"
    )

    print("ICLabel analysis completed successfully.")

    return result


# ============================================================
# PROCESS RESULTS
# ============================================================

def process_results(result):

    print("\n==========================================")
    print("        ICLabel CLASSIFICATION")
    print("==========================================")

    # --------------------------------------------------------
    # Current mne-icalabel output structure:
    #
    # result["labels"]
    #       → predicted label for every IC
    #
    # result["y_pred_proba"]
    #       → confidence of the predicted label
    #
    # Example:
    #
    # IC1 → eye blink → 0.9965
    # IC2 → eye blink → 0.9940
    # IC3 → brain     → 0.9997
    # --------------------------------------------------------

    if "labels" not in result:
        raise KeyError(
            f"'labels' not found in ICLabel result. "
            f"Available keys: {list(result.keys())}"
        )

    if "y_pred_proba" not in result:
        raise KeyError(
            f"'y_pred_proba' not found in ICLabel result. "
            f"Available keys: {list(result.keys())}"
        )

    labels = result["labels"]
    probabilities = result["y_pred_proba"]

    print(f"\nNumber of labels       : {len(labels)}")
    print(f"Number of probabilities: {len(probabilities)}")

    if len(labels) != len(probabilities):
        raise ValueError(
            "Number of labels and probabilities do not match."
        )

    rows = []

    for index, (label, probability) in enumerate(
        zip(labels, probabilities)
    ):

        row = {
            "component": f"IC{index + 1}",
            "label": label,
            "confidence": float(probability)
        }

        rows.append(row)

    df = pd.DataFrame(rows)

    return df


# ============================================================
# DISPLAY RESULTS
# ============================================================

def display_results(df):

    print("\nFirst 10 ICA components:\n")

    display_columns = [
        "component",
        "label",
        "confidence"
    ]

    display_df = df[display_columns].head(10).copy()

    display_df["confidence"] = (
        display_df["confidence"] * 100
    ).round(2).astype(str) + "%"

    print(
        display_df.to_string(index=False)
    )

    print("\n==========================================")
    print("CLASS DISTRIBUTION")
    print("==========================================")

    print(
        df["label"]
        .value_counts()
        .to_string()
    )


# ============================================================
# SAVE RESULTS
# ============================================================

def save_results(df):

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\n==========================================")
    print("ICLabel RESULTS SAVED")
    print("==========================================")

    print("\nFile:")
    print(OUTPUT_FILE)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    raw, ica = load_data()

    result = run_iclabel(
        raw,
        ica
    )

    df = process_results(
        result
    )

    display_results(
        df
    )

    save_results(
        df
    )

    print("\n==========================================")
    print("       ICLabel STAGE COMPLETE")
    print("==========================================")

    print("\nNext stage →")
    print("PSD + ALICE")
    print("        ↓")
    print("Evidence Fusion")
    print("        ↓")
    print("NeuroAgent")