"""
reconstruction.py — NeuroAgent EEG Reconstruction
==================================================

Loads:
    1. Preprocessed EEG
    2. ICA solution
    3. NeuroAgent decisions

Removes ICA components marked as REMOVE
and reconstructs the cleaned EEG.
"""

from pathlib import Path

import mne
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

RAW_FILE = (
    PROCESSED_DIR /
    "S002R01_preprocessed_raw.fif"
)

ICA_FILE = (
    PROCESSED_DIR /
    "S002R01_ica.fif"
)

NEUROAGENT_FILE = (
    PROCESSED_DIR /
    "S002R01_neuroagent.csv"
)

OUTPUT_FILE = (
    PROCESSED_DIR /
    "S002R01_reconstructed_raw.fif"
)


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("\n==========================================")
    print("       NEUROAGENT EEG RECONSTRUCTION")
    print("==========================================")

    # --------------------------------------------------------
    # Load EEG
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Load ICA
    # --------------------------------------------------------

    print("\nLoading ICA solution:")
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

    # --------------------------------------------------------
    # Load NeuroAgent decisions
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

    return raw, ica, decisions


# ============================================================
# DISPLAY INFORMATION
# ============================================================

def display_information(raw, ica, decisions):

    print("\n==========================================")
    print("          DATA INFORMATION")
    print("==========================================")

    print(
        f"EEG channels       : {raw.info['nchan']}"
    )

    print(
        f"Sampling rate      : {raw.info['sfreq']} Hz"
    )

    print(
        f"EEG duration       : {raw.times[-1]:.2f} seconds"
    )

    print(
        f"ICA components     : {ica.n_components_}"
    )

    print(
        f"NeuroAgent records : {len(decisions)}"
    )


# ============================================================
# FIND COMPONENTS TO REMOVE
# ============================================================

def find_remove_components(decisions):

    print("\n==========================================")
    print("       NEUROAGENT DECISION ANALYSIS")
    print("==========================================")

    # --------------------------------------------------------
    # Check required columns
    # --------------------------------------------------------

    required_columns = [
        "component",
        "neuroagent_decision"
    ]

    for column in required_columns:

        if column not in decisions.columns:

            raise ValueError(
                f"Required column missing from NeuroAgent CSV: "
                f"{column}"
            )

    # --------------------------------------------------------
    # Find REMOVE decisions
    # --------------------------------------------------------

    remove_rows = decisions[
        decisions["neuroagent_decision"]
        .astype(str)
        .str.upper()
        .eq("REMOVE")
    ]

    remove_components = []

    for component in remove_rows["component"]:

        component = str(component).strip().upper()

        if component.startswith("IC"):

            try:

                index = int(
                    component.replace("IC", "")
                ) - 1

                remove_components.append(index)

            except ValueError:

                print(
                    f"Warning: Could not parse "
                    f"component {component}"
                )

    # --------------------------------------------------------
    # Remove duplicates
    # --------------------------------------------------------

    remove_components = sorted(
        set(remove_components)
    )

    print(
        f"\nComponents marked REMOVE: "
        f"{len(remove_components)}"
    )

    if remove_components:

        print("\nICA components to remove:")

        for index in remove_components:

            print(
                f"  IC{index + 1}"
            )

    else:

        print(
            "\nNo ICA components marked REMOVE."
        )

    return remove_components


# ============================================================
# RECONSTRUCT EEG
# ============================================================

def reconstruct_eeg(
    raw,
    ica,
    remove_components
):

    print("\n==========================================")
    print("        EEG RECONSTRUCTION")
    print("==========================================")

    # --------------------------------------------------------
    # Copy ICA object
    # --------------------------------------------------------

    ica_clean = ica.copy()

    # --------------------------------------------------------
    # Set components to exclude
    # --------------------------------------------------------

    ica_clean.exclude = remove_components

    print(
        "\nApplying ICA reconstruction..."
    )

    print(
        f"Removing {len(remove_components)} "
        f"component(s)."
    )

    # --------------------------------------------------------
    # Apply ICA
    # --------------------------------------------------------

    cleaned_raw = raw.copy()

    ica_clean.apply(
        cleaned_raw,
        verbose=False
    )

    print(
        "ICA reconstruction completed."
    )

    return cleaned_raw


# ============================================================
# SAVE CLEAN EEG
# ============================================================

def save_reconstructed_eeg(cleaned_raw):

    print("\n==========================================")
    print("       SAVING CLEAN EEG")
    print("==========================================")

    cleaned_raw.save(
        OUTPUT_FILE,
        overwrite=True,
        verbose=False
    )

    print("\nClean EEG saved successfully.")

    print("\nOutput:")
    print(OUTPUT_FILE)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    # --------------------------------------------------------
    # 1. Load everything
    # --------------------------------------------------------

    raw, ica, decisions = load_data()

    # --------------------------------------------------------
    # 2. Display information
    # --------------------------------------------------------

    display_information(
        raw,
        ica,
        decisions
    )

    # --------------------------------------------------------
    # 3. Find components to remove
    # --------------------------------------------------------

    remove_components = find_remove_components(
        decisions
    )

    # --------------------------------------------------------
    # 4. Reconstruct EEG
    # --------------------------------------------------------

    cleaned_raw = reconstruct_eeg(
        raw,
        ica,
        remove_components
    )

    # --------------------------------------------------------
    # 5. Save clean EEG
    # --------------------------------------------------------

    save_reconstructed_eeg(
        cleaned_raw
    )

    # --------------------------------------------------------
    # 6. Completion
    # --------------------------------------------------------

    print("\n==========================================")
    print("     EEG RECONSTRUCTION COMPLETE")
    print("==========================================")

    print("\nPipeline result:")

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
    )

    print("\nNext stage →")
    print("QUALITY CHECK")
    print("       ↓")
    print("Clean EEG vs Original EEG")