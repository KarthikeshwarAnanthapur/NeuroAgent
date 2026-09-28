"""
quality_check.py — NeuroAgent EEG Quality Check
================================================

Compares:
    - Preprocessed EEG
    - Reconstructed/Clean EEG

Checks:
    1. Signal validity
    2. Signal amplitude
    3. RMS
    4. Peak-to-peak amplitude
    5. Variance
    6. PSD / frequency-band power
    7. Overall quality

Output:
    S002R01_quality_report.csv
"""

from pathlib import Path

import mne
import numpy as np
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

ORIGINAL_FILE = (
    PROCESSED_DIR /
    "S002R01_preprocessed_raw.fif"
)

CLEAN_FILE = (
    PROCESSED_DIR /
    "S002R01_reconstructed_raw.fif"
)

NEUROAGENT_FILE = (
    PROCESSED_DIR /
    "S002R01_neuroagent.csv"
)

OUTPUT_FILE = (
    PROCESSED_DIR /
    "S002R01_quality_report.csv"
)


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("\n==========================================")
    print("       NEUROAGENT QUALITY CHECK")
    print("==========================================")

    # --------------------------------------------------------
    # Original EEG
    # --------------------------------------------------------

    print("\nLoading original preprocessed EEG:")
    print(ORIGINAL_FILE)

    if not ORIGINAL_FILE.exists():
        raise FileNotFoundError(
            f"Original EEG not found:\n{ORIGINAL_FILE}"
        )

    original = mne.io.read_raw_fif(
        ORIGINAL_FILE,
        preload=True,
        verbose=False
    )

    print("Original EEG loaded.")

    # --------------------------------------------------------
    # Clean EEG
    # --------------------------------------------------------

    print("\nLoading reconstructed clean EEG:")
    print(CLEAN_FILE)

    if not CLEAN_FILE.exists():
        raise FileNotFoundError(
            f"Reconstructed EEG not found:\n{CLEAN_FILE}"
        )

    clean = mne.io.read_raw_fif(
        CLEAN_FILE,
        preload=True,
        verbose=False
    )

    print("Clean EEG loaded.")

    # --------------------------------------------------------
    # NeuroAgent results
    # --------------------------------------------------------

    print("\nLoading NeuroAgent decisions:")
    print(NEUROAGENT_FILE)

    if not NEUROAGENT_FILE.exists():
        raise FileNotFoundError(
            f"NeuroAgent results not found:\n{NEUROAGENT_FILE}"
        )

    decisions = pd.read_csv(
        NEUROAGENT_FILE
    )

    print("NeuroAgent decisions loaded.")

    return original, clean, decisions


# ============================================================
# BASIC VALIDATION
# ============================================================

def validate_data(original, clean):

    print("\n==========================================")
    print("          DATA VALIDATION")
    print("==========================================")

    print(
        f"\nOriginal channels : "
        f"{original.info['nchan']}"
    )

    print(
        f"Clean channels    : "
        f"{clean.info['nchan']}"
    )

    print(
        f"Original samples  : "
        f"{original.n_times}"
    )

    print(
        f"Clean samples     : "
        f"{clean.n_times}"
    )

    print(
        f"Original sampling : "
        f"{original.info['sfreq']} Hz"
    )

    print(
        f"Clean sampling    : "
        f"{clean.info['sfreq']} Hz"
    )

    valid = True

    if original.info["nchan"] != clean.info["nchan"]:
        print("\nWARNING: Channel count changed.")
        valid = False

    if original.n_times != clean.n_times:
        print("\nWARNING: Number of samples changed.")
        valid = False

    if original.info["sfreq"] != clean.info["sfreq"]:
        print("\nWARNING: Sampling rate changed.")
        valid = False

    if valid:
        print("\nData structure check: PASSED")

    return valid


# ============================================================
# SIGNAL STATISTICS
# ============================================================

def calculate_statistics(raw):

    data = raw.get_data()

    statistics = {
        "mean": float(np.mean(data)),
        "std": float(np.std(data)),
        "variance": float(np.var(data)),
        "rms": float(
            np.sqrt(np.mean(data ** 2))
        ),
        "peak_to_peak": float(
            np.ptp(data)
        ),
        "max_amplitude": float(
            np.max(np.abs(data))
        )
    }

    return statistics


# ============================================================
# PSD ANALYSIS
# ============================================================

def calculate_band_power(raw):

    spectrum = raw.compute_psd(
        method="welch",
        fmin=1.0,
        fmax=40.0,
        picks="eeg",
        verbose=False
    )

    psd = spectrum.get_data()
    freqs = spectrum.freqs

    # Average across channels
    psd_mean = np.mean(
        psd,
        axis=0
    )

    bands = {
        "delta": (1.0, 4.0),
        "theta": (4.0, 8.0),
        "alpha": (8.0, 13.0),
        "beta": (13.0, 30.0),
        "gamma": (30.0, 40.0)
    }

    results = {}

    for name, (low, high) in bands.items():

        mask = (
            (freqs >= low) &
            (freqs < high)
        )

        if np.any(mask):

            power = np.trapezoid(
                psd_mean[mask],
                freqs[mask]
            )

        else:

            power = 0.0

        results[f"{name}_power"] = float(power)

    return results


# ============================================================
# COMPARE SIGNALS
# ============================================================

def compare_signals(original, clean):

    print("\n==========================================")
    print("         SIGNAL COMPARISON")
    print("==========================================")

    original_stats = calculate_statistics(
        original
    )

    clean_stats = calculate_statistics(
        clean
    )

    print("\nOriginal EEG:")
    print(
        f"  RMS           : "
        f"{original_stats['rms']:.6f}"
    )

    print(
        f"  Variance      : "
        f"{original_stats['variance']:.6f}"
    )

    print(
        f"  Peak-to-peak  : "
        f"{original_stats['peak_to_peak']:.6f}"
    )

    print("\nClean EEG:")
    print(
        f"  RMS           : "
        f"{clean_stats['rms']:.6f}"
    )

    print(
        f"  Variance      : "
        f"{clean_stats['variance']:.6f}"
    )

    print(
        f"  Peak-to-peak  : "
        f"{clean_stats['peak_to_peak']:.6f}"
    )

    return original_stats, clean_stats


# ============================================================
# FREQUENCY COMPARISON
# ============================================================

def compare_frequency_content(original, clean):

    print("\n==========================================")
    print("       FREQUENCY ANALYSIS")
    print("==========================================")

    original_power = calculate_band_power(
        original
    )

    clean_power = calculate_band_power(
        clean
    )

    rows = []

    bands = [
        "delta",
        "theta",
        "alpha",
        "beta",
        "gamma"
    ]

    for band in bands:

        original_value = original_power[
            f"{band}_power"
        ]

        clean_value = clean_power[
            f"{band}_power"
        ]

        if original_value != 0:

            change = (
                (clean_value - original_value)
                / original_value
            ) * 100.0

        else:

            change = 0.0

        rows.append({
            "band": band,
            "original_power": original_value,
            "clean_power": clean_value,
            "change_percent": change
        })

    frequency_df = pd.DataFrame(
        rows
    )

    print(
        "\n"
        + frequency_df.to_string(
            index=False
        )
    )

    return frequency_df


# ============================================================
# OVERALL QUALITY
# ============================================================

def determine_quality(
    structure_valid,
    original_stats,
    clean_stats
):

    # --------------------------------------------------------
    # Basic safety checks
    # --------------------------------------------------------

    if not structure_valid:

        return "NOT GOOD"

    values = [
        clean_stats["rms"],
        clean_stats["variance"],
        clean_stats["peak_to_peak"],
        clean_stats["max_amplitude"]
    ]

    if not all(
        np.isfinite(value)
        for value in values
    ):

        return "NOT GOOD"

    # --------------------------------------------------------
    # Compare RMS
    # --------------------------------------------------------

    original_rms = original_stats["rms"]
    clean_rms = clean_stats["rms"]

    if original_rms == 0:

        return "NOT GOOD"

    rms_ratio = (
        clean_rms /
        original_rms
    )

    # --------------------------------------------------------
    # Very large amplitude increase
    # --------------------------------------------------------

    if rms_ratio > 1.5:

        return "NOT GOOD"

    # --------------------------------------------------------
    # Extremely large amplitude reduction
    # --------------------------------------------------------

    if rms_ratio < 0.05:

        return "NOT GOOD"

    return "GOOD"


# ============================================================
# SAVE REPORT
# ============================================================

def save_report(
    original_stats,
    clean_stats,
    frequency_df,
    quality,
    structure_valid,
    decisions
):

    remove_count = int(
        (
            decisions[
                "neuroagent_decision"
            ]
            .astype(str)
            .str.upper()
            .eq("REMOVE")
        ).sum()
    )

    keep_count = int(
        (
            decisions[
                "neuroagent_decision"
            ]
            .astype(str)
            .str.upper()
            .eq("KEEP")
        ).sum()
    )

    review_count = int(
        (
            decisions[
                "neuroagent_decision"
            ]
            .astype(str)
            .str.upper()
            .eq("REVIEW")
        ).sum()
    )

    rows = []

    # Overall information

    rows.append({
        "metric": "structure_valid",
        "value": structure_valid
    })

    rows.append({
        "metric": "overall_quality",
        "value": quality
    })

    rows.append({
        "metric": "components_removed",
        "value": remove_count
    })

    rows.append({
        "metric": "components_kept",
        "value": keep_count
    })

    rows.append({
        "metric": "components_review",
        "value": review_count
    })

    # Signal statistics

    for key, value in original_stats.items():

        rows.append({
            "metric": f"original_{key}",
            "value": value
        })

    for key, value in clean_stats.items():

        rows.append({
            "metric": f"clean_{key}",
            "value": value
        })

    # Frequency information

    for _, row in frequency_df.iterrows():

        band = row["band"]

        rows.append({
            "metric": f"{band}_original_power",
            "value": row["original_power"]
        })

        rows.append({
            "metric": f"{band}_clean_power",
            "value": row["clean_power"]
        })

        rows.append({
            "metric": f"{band}_change_percent",
            "value": row["change_percent"]
        })

    report = pd.DataFrame(
        rows
    )

    report.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\n==========================================")
    print("       QUALITY REPORT SAVED")
    print("==========================================")

    print("\nFile:")
    print(OUTPUT_FILE)

    return report


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    # --------------------------------------------------------
    # 1. Load
    # --------------------------------------------------------

    original, clean, decisions = load_data()

    # --------------------------------------------------------
    # 2. Validate
    # --------------------------------------------------------

    structure_valid = validate_data(
        original,
        clean
    )

    # --------------------------------------------------------
    # 3. Signal statistics
    # --------------------------------------------------------

    original_stats, clean_stats = compare_signals(
        original,
        clean
    )

    # --------------------------------------------------------
    # 4. Frequency analysis
    # --------------------------------------------------------

    frequency_df = compare_frequency_content(
        original,
        clean
    )

    # --------------------------------------------------------
    # 5. Overall quality
    # --------------------------------------------------------

    quality = determine_quality(
        structure_valid,
        original_stats,
        clean_stats
    )

    # --------------------------------------------------------
    # 6. Display final result
    # --------------------------------------------------------

    print("\n==========================================")
    print("          FINAL QUALITY CHECK")
    print("==========================================")

    print(
        f"\nOverall EEG Quality : {quality}"
    )

    if quality == "GOOD":

        print(
            "\nThe reconstructed EEG passed "
            "the basic quality checks."
        )

    else:

        print(
            "\nWARNING:"
            "\nThe reconstructed EEG requires "
            "further inspection."
        )

    # --------------------------------------------------------
    # 7. Save
    # --------------------------------------------------------

    save_report(
        original_stats,
        clean_stats,
        frequency_df,
        quality,
        structure_valid,
        decisions
    )

    # --------------------------------------------------------
    # 8. Pipeline completion
    # --------------------------------------------------------

    print("\n==========================================")
    print("      QUALITY CHECK COMPLETE")
    print("==========================================")

    print("\nPipeline:")

    print(
        "\nRAW EEG"
        "\n   ↓"
        "\nPREPROCESSING"
        "\n   ↓"
        "\nICA"
        "\n   ↓"
        "\nICLabel + PSD + ALICE"
        "\n   ↓"
        "\nEVIDENCE FUSION"
        "\n   ↓"
        "\nNEUROAGENT"
        "\n   ↓"
        "\nICA COMPONENT REMOVAL"
        "\n   ↓"
        "\nCLEAN EEG"
        "\n   ↓"
        "\nQUALITY CHECK"
    )

    print("\nNext stage →")
    print("HUMAN REVIEW")
    print("       ↓")
    print("FINAL CLEAN EEG")