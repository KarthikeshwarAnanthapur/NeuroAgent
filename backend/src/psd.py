"""
psd.py — NeuroAgent PSD Analysis
=================================

Analyzes the frequency content of every ICA component.

Input:
    data/processed/S002R01_preprocessed_raw.fif
    data/processed/S002R01_ica.fif

Output:
    data/processed/S002R01_psd.csv
"""

from pathlib import Path

import mne
import numpy as np
import pandas as pd
from scipy.signal import welch


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

RAW_FILE = PROCESSED_DIR / "S002R01_preprocessed_raw.fif"
ICA_FILE = PROCESSED_DIR / "S002R01_ica.fif"

OUTPUT_FILE = PROCESSED_DIR / "S002R01_psd.csv"


# ============================================================
# FREQUENCY BANDS
# ============================================================

FREQUENCY_BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 40.0),
}


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("\n==========================================")
    print("       NEUROAGENT PSD ANALYSIS")
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
# EXTRACT ICA SOURCES
# ============================================================

def extract_components(raw, ica):

    print("\n==========================================")
    print("       EXTRACTING ICA COMPONENTS")
    print("==========================================")

    sources = ica.get_sources(raw)

    component_data = sources.get_data()

    print(
        f"\nICA source data shape: "
        f"{component_data.shape}"
    )

    print(
        f"Number of components : "
        f"{component_data.shape[0]}"
    )

    print(
        f"Number of samples    : "
        f"{component_data.shape[1]}"
    )

    return component_data


# ============================================================
# CALCULATE PSD
# ============================================================

def calculate_psd(component_data, sfreq):

    print("\n==========================================")
    print("          CALCULATING PSD")
    print("==========================================")

    print("\nFrequency bands:")

    for name, (low, high) in FREQUENCY_BANDS.items():

        print(
            f"  {name.capitalize():<6}: "
            f"{low}–{high} Hz"
        )

    print("\nUsing Welch PSD estimation...")

    all_psd = []
    frequencies = None

    # --------------------------------------------------------
    # Calculate PSD separately for every ICA component
    # --------------------------------------------------------

    for component_index in range(
        component_data.shape[0]
    ):

        signal = component_data[
            component_index
        ]

        frequencies, power = welch(
            signal,
            fs=sfreq,
            nperseg=min(
                1024,
                len(signal)
            )
        )

        all_psd.append(power)

    psd = np.asarray(all_psd)

    # Keep only 1–40 Hz
    frequency_mask = (
        (frequencies >= 1.0)
        &
        (frequencies <= 40.0)
    )

    frequencies = frequencies[
        frequency_mask
    ]

    psd = psd[
        :,
        frequency_mask
    ]

    print("\nPSD calculation complete.")

    print(f"PSD shape       : {psd.shape}")
    print(
        f"Frequency range : "
        f"{frequencies[0]:.2f}–"
        f"{frequencies[-1]:.2f} Hz"
    )

    return psd, frequencies


# ============================================================
# CALCULATE BAND POWER
# ============================================================

def calculate_band_power(psd, frequencies):

    print("\n==========================================")
    print("         CALCULATING BAND POWER")
    print("==========================================")

    rows = []

    for component_index in range(
        psd.shape[0]
    ):

        component_psd = psd[
            component_index
        ]

        # ----------------------------------------------------
        # Total power
        # ----------------------------------------------------

        total_power = np.trapezoid(
            component_psd,
            frequencies
        )

        row = {
            "component":
                f"IC{component_index + 1}",

            "total_power":
                float(total_power)
        }

        band_powers = {}

        # ----------------------------------------------------
        # Individual frequency bands
        # ----------------------------------------------------

        for band_name, (low, high) in (
            FREQUENCY_BANDS.items()
        ):

            mask = (
                (frequencies >= low)
                &
                (frequencies < high)
            )

            if np.any(mask):

                power = np.trapezoid(
                    component_psd[mask],
                    frequencies[mask]
                )

            else:

                power = 0.0

            band_powers[
                band_name
            ] = float(power)

            row[
                f"{band_name}_power"
            ] = float(power)

        # ----------------------------------------------------
        # Relative power
        # ----------------------------------------------------

        for band_name, power in (
            band_powers.items()
        ):

            if total_power > 0:

                relative = (
                    power /
                    total_power
                )

            else:

                relative = 0.0

            row[
                f"{band_name}_relative"
            ] = float(relative)

        rows.append(row)

    return pd.DataFrame(rows)


# ============================================================
# DISPLAY RESULTS
# ============================================================

def display_results(df):

    print("\n==========================================")
    print("             PSD RESULTS")
    print("==========================================")

    columns = [
        "component",
        "delta_relative",
        "theta_relative",
        "alpha_relative",
        "beta_relative",
        "gamma_relative",
    ]

    display_df = df[
        columns
    ].head(10).copy()

    for column in columns[1:]:

        display_df[column] = (
            display_df[column] * 100
        ).round(2).astype(str) + "%"

    print(
        "\nFirst 10 ICA components:\n"
    )

    print(
        display_df.to_string(
            index=False
        )
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
    print("          PSD RESULTS SAVED")
    print("==========================================")

    print("\nFile:")
    print(OUTPUT_FILE)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    raw, ica = load_data()

    component_data = (
        extract_components(
            raw,
            ica
        )
    )

    sfreq = raw.info[
        "sfreq"
    ]

    psd, frequencies = (
        calculate_psd(
            component_data,
            sfreq
        )
    )

    df = calculate_band_power(
        psd,
        frequencies
    )

    display_results(
        df
    )

    save_results(
        df
    )

    print("\n==========================================")
    print("       PSD STAGE COMPLETE")
    print("==========================================")

    print("\nNext stage →")
    print("ALICE ANALYSIS")
    print("       ↓")
    print("Evidence Fusion")
    print("       ↓")
    print("NeuroAgent")