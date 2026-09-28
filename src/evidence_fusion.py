"""
evidence_fusion.py — NeuroAgent Evidence Fusion
================================================

Combines three independent evidence sources:

    1. ICLabel
    2. PSD
    3. ALICE

Then produces an interpretable decision for every ICA component:

    KEEP
    REMOVE
    REVIEW

Pipeline:

    ICLabel ──┐
    PSD ──────┼──> Evidence Fusion ──> NeuroAgent Decision
    ALICE ────┘

Output:
    data/processed/S002R01_fusion.csv
"""

from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

ICLABEL_FILE = PROCESSED_DIR / "S002R01_iclabel.csv"
PSD_FILE = PROCESSED_DIR / "S002R01_psd.csv"
ALICE_FILE = PROCESSED_DIR / "S002R01_alice.csv"

OUTPUT_FILE = PROCESSED_DIR / "S002R01_fusion.csv"


# ============================================================
# FUSION WEIGHTS
# ============================================================

# ICLabel is the strongest direct IC classifier.
ICLABEL_WEIGHT = 0.45

# PSD provides frequency-domain evidence.
PSD_WEIGHT = 0.25

# ALICE provides additional artifact evidence.
ALICE_WEIGHT = 0.30


# Decision thresholds
REMOVE_THRESHOLD = 0.70
KEEP_THRESHOLD = 0.30


# ============================================================
# LOAD EVIDENCE
# ============================================================

def load_evidence():

    print("\n==========================================")
    print("       NEUROAGENT EVIDENCE FUSION")
    print("==========================================")

    # --------------------------------------------------------
    # ICLabel
    # --------------------------------------------------------

    print("\nLoading ICLabel results:")
    print(ICLABEL_FILE)

    if not ICLABEL_FILE.exists():
        raise FileNotFoundError(
            f"ICLabel results not found:\n{ICLABEL_FILE}"
        )

    iclabel = pd.read_csv(ICLABEL_FILE)

    print(
        f"ICLabel components : {len(iclabel)}"
    )

    # --------------------------------------------------------
    # PSD
    # --------------------------------------------------------

    print("\nLoading PSD results:")
    print(PSD_FILE)

    if not PSD_FILE.exists():
        raise FileNotFoundError(
            f"PSD results not found:\n{PSD_FILE}"
        )

    psd = pd.read_csv(PSD_FILE)

    print(
        f"PSD components     : {len(psd)}"
    )

    # --------------------------------------------------------
    # ALICE
    # --------------------------------------------------------

    print("\nLoading ALICE results:")
    print(ALICE_FILE)

    if not ALICE_FILE.exists():
        raise FileNotFoundError(
            f"ALICE results not found:\n{ALICE_FILE}"
        )

    alice = pd.read_csv(ALICE_FILE)

    print(
        f"ALICE components   : {len(alice)}"
    )

    return iclabel, psd, alice


# ============================================================
# CHECK COMPONENT ALIGNMENT
# ============================================================

def validate_components(
    iclabel,
    psd,
    alice
):

    print("\n==========================================")
    print("       VALIDATING COMPONENTS")
    print("==========================================")

    ic_components = set(
        iclabel["component"]
    )

    psd_components = set(
        psd["component"]
    )

    alice_components = set(
        alice["component"]
    )

    common = (
        ic_components
        & psd_components
        & alice_components
    )

    if not common:

        raise ValueError(
            "No common ICA components found "
            "between ICLabel, PSD and ALICE."
        )

    print(
        f"Common ICA components : {len(common)}"
    )

    if (
        ic_components != psd_components
        or
        ic_components != alice_components
    ):

        print(
            "\nWARNING:"
            "\nComponent lists are not identical."
            "\nUsing only common components."
        )

    return sorted(
        common,
        key=lambda x: int(
            x.replace("IC", "")
        )
    )


# ============================================================
# ICLabel ARTIFACT SCORE
# ============================================================

def get_iclabel_artifact_score(row):

    label = str(
        row["label"]
    ).lower()

    confidence = float(
        row["confidence"]
    )

    # Strong artifact classes
    artifact_labels = {
        "eye blink",
        "muscle artifact",
        "channel noise",
        "line noise",
        "heart beat",
        "other artifact",
    }

    # Brain is evidence for KEEP
    if label == "brain":

        return 1.0 - confidence

    # Known artifact
    if label in artifact_labels:

        return confidence

    # "other" is uncertain
    if label == "other":

        return 0.50

    # Unknown class
    return 0.50


# ============================================================
# PSD ARTIFACT SCORE
# ============================================================

def get_psd_artifact_score(row):

    """
    Estimate artifact evidence from PSD.

    This is an interpretable heuristic rather than a
    trained classifier.

    High beta/gamma can indicate muscle/high-frequency
    contamination.

    Very strong delta dominance can indicate slow artifacts.
    """

    beta = float(
        row.get(
            "beta_relative",
            0.0
        )
    )

    gamma = float(
        row.get(
            "gamma_relative",
            0.0
        )
    )

    delta = float(
        row.get(
            "delta_relative",
            0.0
        )
    )

    # High-frequency evidence
    high_frequency = beta + gamma

    high_freq_score = np.clip(
        (high_frequency - 0.25) / 0.50,
        0.0,
        1.0
    )

    # Slow-frequency evidence
    slow_frequency_score = np.clip(
        (delta - 0.60) / 0.40,
        0.0,
        1.0
    )

    # Combine
    artifact_score = max(
        high_freq_score,
        slow_frequency_score
    )

    return float(
        np.clip(
            artifact_score,
            0.0,
            1.0
        )
    )


# ============================================================
# ALICE ARTIFACT SCORE
# ============================================================

def get_alice_artifact_score(row):

    if "alice_artifact_score" in row:

        return float(
            np.clip(
                row["alice_artifact_score"],
                0.0,
                1.0
            )
        )

    # Fallback
    if "alice_brain_score" in row:

        return float(
            np.clip(
                1.0 -
                row["alice_brain_score"],
                0.0,
                1.0
            )
        )

    return 0.50


# ============================================================
# FUSION
# ============================================================

def calculate_fusion(
    iclabel_score,
    psd_score,
    alice_score
):

    fused_score = (

        ICLABEL_WEIGHT *
        iclabel_score

        +

        PSD_WEIGHT *
        psd_score

        +

        ALICE_WEIGHT *
        alice_score

    )

    return float(
        np.clip(
            fused_score,
            0.0,
            1.0
        )
    )


# ============================================================
# DECISION
# ============================================================

def make_decision(
    artifact_score
):

    if artifact_score >= REMOVE_THRESHOLD:

        return "REMOVE"

    elif artifact_score <= KEEP_THRESHOLD:

        return "KEEP"

    else:

        return "REVIEW"


# ============================================================
# FUSE ALL COMPONENTS
# ============================================================

def fuse_evidence(
    iclabel,
    psd,
    alice,
    components
):

    print("\n==========================================")
    print("       FUSING EVIDENCE")
    print("==========================================")

    iclabel_index = iclabel.set_index(
        "component"
    )

    psd_index = psd.set_index(
        "component"
    )

    alice_index = alice.set_index(
        "component"
    )

    rows = []

    for component in components:

        ic_row = iclabel_index.loc[
            component
        ]

        psd_row = psd_index.loc[
            component
        ]

        alice_row = alice_index.loc[
            component
        ]

        # ------------------------------------
        # Individual evidence
        # ------------------------------------

        iclabel_score = (
            get_iclabel_artifact_score(
                ic_row
            )
        )

        psd_score = (
            get_psd_artifact_score(
                psd_row
            )
        )

        alice_score = (
            get_alice_artifact_score(
                alice_row
            )
        )

        # ------------------------------------
        # Evidence fusion
        # ------------------------------------

        artifact_score = (
            calculate_fusion(
                iclabel_score,
                psd_score,
                alice_score
            )
        )

        brain_score = (
            1.0 -
            artifact_score
        )

        decision = make_decision(
            artifact_score
        )

        # ------------------------------------
        # Original ICLabel information
        # ------------------------------------

        iclabel_label = (
            str(
                ic_row["label"]
            )
        )

        iclabel_confidence = (
            float(
                ic_row["confidence"]
            )
        )

        # ------------------------------------
        # Store
        # ------------------------------------

        rows.append({

            "component":
                component,

            "iclabel_label":
                iclabel_label,

            "iclabel_confidence":
                iclabel_confidence,

            "iclabel_artifact_score":
                iclabel_score,

            "psd_artifact_score":
                psd_score,

            "alice_artifact_score":
                alice_score,

            "artifact_score":
                artifact_score,

            "brain_score":
                brain_score,

            "decision":
                decision,
        })

    return pd.DataFrame(rows)


# ============================================================
# DISPLAY RESULTS
# ============================================================

def display_results(df):

    print("\n==========================================")
    print("       EVIDENCE FUSION RESULTS")
    print("==========================================")

    columns = [

        "component",

        "iclabel_label",

        "iclabel_confidence",

        "iclabel_artifact_score",

        "psd_artifact_score",

        "alice_artifact_score",

        "artifact_score",

        "brain_score",

        "decision",
    ]

    print(
        df[columns]
        .head(15)
        .to_string(
            index=False
        )
    )

    print("\n==========================================")
    print("       FINAL DECISION DISTRIBUTION")
    print("==========================================")

    print(
        df["decision"]
        .value_counts()
        .to_string()
    )


# ============================================================
# SAVE
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
    print("       FUSION RESULTS SAVED")
    print("==========================================")

    print("\nFile:")
    print(OUTPUT_FILE)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    # Load
    iclabel, psd, alice = (
        load_evidence()
    )

    # Validate
    components = (
        validate_components(
            iclabel,
            psd,
            alice
        )
    )

    # Fuse
    df = fuse_evidence(
        iclabel,
        psd,
        alice,
        components
    )

    # Display
    display_results(
        df
    )

    # Save
    save_results(
        df
    )

    print("\n==========================================")
    print("       EVIDENCE FUSION COMPLETE")
    print("==========================================")

    print("\nNext stage →")
    print("NEUROAGENT DECISION")
    print("       ↓")
    print("KEEP / REMOVE / REVIEW")
    print("       ↓")
    print("EEG RECONSTRUCTION")