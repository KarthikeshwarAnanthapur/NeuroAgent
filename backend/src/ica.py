"""
ica.py — NeuroAgent ICA Decomposition
=====================================

Performs Independent Component Analysis (ICA) on the
preprocessed EEG recording.

Pipeline:
    Preprocessed EEG
          ↓
    Extended Infomax ICA
          ↓
    Independent Components
          ↓
    Save ICA solution
          ↓
    Next → ICLabel + PSD + ALICE
"""

import mne
from pathlib import Path


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_FILE = PROCESSED_DIR / "S002R01_preprocessed_raw.fif"

OUTPUT_FILE = PROCESSED_DIR / "S002R01_ica.fif"


# ============================================================
# LOAD PREPROCESSED EEG
# ============================================================

def load_preprocessed_eeg():

    print()
    print("=" * 50)
    print("       NEUROAGENT ICA DECOMPOSITION")
    print("=" * 50)

    print()
    print("Loading preprocessed EEG:")
    print(INPUT_FILE)

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"\nPreprocessed EEG not found:\n{INPUT_FILE}\n"
            "Run preprocess.py first."
        )

    raw = mne.io.read_raw_fif(
        str(INPUT_FILE),
        preload=True,
        verbose=False
    )

    print()
    print("Preprocessed EEG loaded.")

    print()
    print("=" * 42)
    print("          EEG INFORMATION")
    print("=" * 42)

    print(f"Channels       : {raw.info['nchan']}")
    print(f"Sampling rate  : {raw.info['sfreq']} Hz")
    print(f"Duration       : {raw.times[-1]:.2f} seconds")
    print(f"Samples        : {raw.n_times}")

    return raw


# ============================================================
# RUN ICA
# ============================================================

def run_ica(raw):

    print()
    print("=" * 50)
    print("          RUNNING ICA")
    print("=" * 50)

    print()
    print("ICA algorithm : Extended Infomax")
    print("Components    : Automatic")
    print()

    # --------------------------------------------------------
    # Extended Infomax ICA
    # --------------------------------------------------------
    #
    # ICLabel was designed around extended Infomax ICA
    # decompositions.
    #
    # n_components=None means MNE determines the number
    # of components from the data.
    #
    # random_state makes the result reproducible.
    # --------------------------------------------------------

    ica = mne.preprocessing.ICA(
        n_components=None,
        method="infomax",
        fit_params=dict(
            extended=True
        ),
        random_state=97,
        max_iter="auto"
    )

    print("Fitting ICA...")
    print("This may take some time...")
    print()

    ica.fit(
        raw,
        picks="eeg",
        verbose=True
    )

    print()
    print("=" * 50)
    print("          ICA COMPLETE")
    print("=" * 50)

    print()
    print(f"ICA method        : {ica.method}")
    print(f"ICA components    : {ica.n_components_}")
    print(f"Original channels : {raw.info['nchan']}")

    return ica


# ============================================================
# SAVE ICA
# ============================================================

def save_ica(ica):

    print()
    print("Saving ICA solution:")
    print(OUTPUT_FILE)

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    ica.save(
        str(OUTPUT_FILE),
        overwrite=True
    )

    print()
    print("ICA solution saved successfully.")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    try:

        # 1. Load preprocessed EEG
        raw = load_preprocessed_eeg()

        # 2. Run Extended Infomax ICA
        ica = run_ica(raw)

        # 3. Save ICA solution
        save_ica(ica)

        print()
        print("=" * 50)
        print("       ICA DECOMPOSITION SUCCESS")
        print("=" * 50)

        print()
        print("Output:")
        print(OUTPUT_FILE)

        print()
        print("Next stage → ICLabel CLASSIFICATION")
        print("=" * 50)

    except Exception as e:

        print()
        print("=" * 50)
        print("             ICA ERROR")
        print("=" * 50)

        print()
        print(e)

        raise