"""
features.py — NeuroAgent ICA Component Feature Extraction
==========================================================

Loads:
    1. Preprocessed EEG
    2. ICA solution

Then:
    Preprocessed EEG
          ↓
        ICA
          ↓
    Independent Components
          ↓
    Feature Extraction
          ↓
    CSV file
"""

from pathlib import Path

import numpy as np
import pandas as pd
import mne
from scipy.signal import welch


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

RAW_FILE = PROCESSED_DIR / "S002R01_preprocessed_raw.fif"

ICA_FILE = PROCESSED_DIR / "S002R01_ica.fif"

OUTPUT_FILE = PROCESSED_DIR / "S002R01_features.csv"


# ============================================================
# EEG FREQUENCY BANDS
# ============================================================

FREQUENCY_BANDS = {
    "delta": (1, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta": (13, 30),
    "gamma": (30, 40),
}


# ============================================================
# LOAD PREPROCESSED EEG
# ============================================================

def load_preprocessed_eeg():

    print("\n==========================================")
    print("       LOADING PREPROCESSED EEG")
    print("==========================================")

    print("\nFile:")
    print(RAW_FILE)

    if not RAW_FILE.exists():

        raise FileNotFoundError(
            f"\nPreprocessed EEG not found:\n{RAW_FILE}\n\n"
            "Run preprocess.py first."
        )

    raw = mne.io.read_raw_fif(
        RAW_FILE,
        preload=True,
        verbose=False
    )

    print("\nPreprocessed EEG loaded successfully.")

    print(f"Channels : {raw.info['nchan']}")
    print(f"Sampling : {raw.info['sfreq']} Hz")
    print(f"Duration : {raw.times[-1]:.2f} seconds")

    return raw


# ============================================================
# LOAD ICA MODEL
# ============================================================

def load_ica():

    print("\n==========================================")
    print("             LOADING ICA")
    print("==========================================")

    print("\nICA file:")
    print(ICA_FILE)

    if not ICA_FILE.exists():

        raise FileNotFoundError(
            f"\nICA file not found:\n{ICA_FILE}\n\n"
            "Run ica.py first."
        )

    # IMPORTANT:
    # ICA files are loaded with read_ica(),
    # NOT read_raw_fif()

    ica = mne.preprocessing.read_ica(
        ICA_FILE,
        verbose=False
    )

    print("\nICA model loaded successfully.")

    print(f"ICA components : {ica.n_components_}")

    return ica


# ============================================================
# EXTRACT ICA COMPONENTS
# ============================================================

def extract_ica_components(raw, ica):

    print("\n==========================================")
    print("       EXTRACTING ICA COMPONENTS")
    print("==========================================")

    print("\nApplying ICA to preprocessed EEG...")

    # Get ICA source signals
    sources = ica.get_sources(raw)

    data = sources.get_data()

    sfreq = sources.info["sfreq"]

    print("\nICA source extraction complete.")

    print(f"Components : {data.shape[0]}")
    print(f"Samples    : {data.shape[1]}")
    print(f"Sampling   : {sfreq} Hz")

    return data, sfreq


# ============================================================
# CALCULATE BAND POWER
# ============================================================

def calculate_band_power(signal, sfreq, low, high):

    frequencies, power = welch(
        signal,
        fs=sfreq,
        nperseg=min(
            len(signal),
            int(sfreq * 4)
        )
    )

    mask = (
        (frequencies >= low)
        &
        (frequencies < high)
    )

    if not np.any(mask):

        return 0.0

    band_power = np.trapezoid(
        power[mask],
        frequencies[mask]
    )

    return float(band_power)


# ============================================================
# EXTRACT FEATURES
# ============================================================

def extract_features(data, sfreq):

    print("\n==========================================")
    print("          FEATURE EXTRACTION")
    print("==========================================")

    feature_rows = []

    number_of_components = data.shape[0]

    print(
        f"\nAnalyzing {number_of_components} "
        "ICA components..."
    )

    for index, signal in enumerate(data):

        component_name = f"IC{index + 1}"

        # ----------------------------------------------------
        # TIME DOMAIN
        # ----------------------------------------------------

        mean_value = float(
            np.mean(signal)
        )

        std_value = float(
            np.std(signal)
        )

        variance = float(
            np.var(signal)
        )

        rms = float(
            np.sqrt(
                np.mean(signal ** 2)
            )
        )

        peak_to_peak = float(
            np.ptp(signal)
        )

        max_amplitude = float(
            np.max(
                np.abs(signal)
            )
        )

        # ----------------------------------------------------
        # FREQUENCY DOMAIN
        # ----------------------------------------------------

        band_powers = {}

        for band_name, (low, high) in FREQUENCY_BANDS.items():

            band_powers[band_name] = (
                calculate_band_power(
                    signal,
                    sfreq,
                    low,
                    high
                )
            )

        # ----------------------------------------------------
        # TOTAL POWER
        # ----------------------------------------------------

        total_power = sum(
            band_powers.values()
        )

        # ----------------------------------------------------
        # RELATIVE POWER
        # ----------------------------------------------------

        if total_power > 0:

            relative_powers = {

                band:
                power / total_power

                for band, power
                in band_powers.items()
            }

        else:

            relative_powers = {

                band: 0.0

                for band
                in FREQUENCY_BANDS
            }

        # ----------------------------------------------------
        # CREATE FEATURE ROW
        # ----------------------------------------------------

        row = {

            "component": component_name,

            # Time-domain features
            "mean": mean_value,
            "std": std_value,
            "variance": variance,
            "rms": rms,
            "peak_to_peak": peak_to_peak,
            "max_amplitude": max_amplitude,

            # Absolute frequency power
            "delta_power":
                band_powers["delta"],

            "theta_power":
                band_powers["theta"],

            "alpha_power":
                band_powers["alpha"],

            "beta_power":
                band_powers["beta"],

            "gamma_power":
                band_powers["gamma"],

            # Relative frequency power
            "delta_relative":
                relative_powers["delta"],

            "theta_relative":
                relative_powers["theta"],

            "alpha_relative":
                relative_powers["alpha"],

            "beta_relative":
                relative_powers["beta"],

            "gamma_relative":
                relative_powers["gamma"],
        }

        feature_rows.append(row)

    features = pd.DataFrame(
        feature_rows
    )

    return features


# ============================================================
# SAVE FEATURES
# ============================================================

def save_features(features):

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    features.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\n==========================================")
    print("           FEATURES SAVED")
    print("==========================================")

    print("\nOutput:")
    print(OUTPUT_FILE)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    # --------------------------------------------------------
    # 1. Load preprocessed EEG
    # --------------------------------------------------------

    raw = load_preprocessed_eeg()

    # --------------------------------------------------------
    # 2. Load ICA model
    # --------------------------------------------------------

    ica = load_ica()

    # --------------------------------------------------------
    # 3. Extract independent components
    # --------------------------------------------------------

    data, sfreq = extract_ica_components(
        raw,
        ica
    )

    # --------------------------------------------------------
    # 4. Extract features
    # --------------------------------------------------------

    features = extract_features(
        data,
        sfreq
    )

    # --------------------------------------------------------
    # 5. Save CSV
    # --------------------------------------------------------

    save_features(features)

    # --------------------------------------------------------
    # 6. Display results
    # --------------------------------------------------------

    print("\n==========================================")
    print("       FEATURE EXTRACTION COMPLETE")
    print("==========================================")

    print("\nFeature matrix shape:")
    print(features.shape)

    print("\nColumns:")
    print(
        list(features.columns)
    )

    print("\nFirst 5 ICA components:")
    print(
        features.head().to_string(
            index=False
        )
    )

    print("\n==========================================")
    print("NEXT STAGE → IC CLASSIFICATION")
    print("ICLabel + ALICE + PSD")
    print("==========================================")