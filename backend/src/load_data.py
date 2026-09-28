"""
load_data.py — NeuroAgent EEG Data Loader
==========================================

Purpose:
    Find and load EEG recordings from the NeuroAgent dataset.

Supported formats:
    - EDF
    - BDF
    - SET
    - FIF

Dataset structure supported:

    data/
    └── raw/
        └── EEGc/
            ├── S002/
            │   ├── S002R01.edf
            │   ├── S002R02.edf
            │   └── ...
            ├── S003/
            ├── S004/
            └── ...

The loader recursively searches data/raw/ so that EEG files
inside subject folders can be detected automatically.
"""

import mne
from pathlib import Path


# ============================================================
# PATH CONFIGURATION
# ============================================================

# backend/
BASE_DIR = Path(__file__).resolve().parents[1]

# backend/data/raw/
RAW_DIR = BASE_DIR / "data" / "raw"

# backend/data/processed/
PROCESSED_DIR = BASE_DIR / "data" / "processed"


# ============================================================
# SUPPORTED EEG FORMATS
# ============================================================

SUPPORTED_FORMATS = {
    ".edf": mne.io.read_raw_edf,
    ".bdf": mne.io.read_raw_bdf,
    ".set": mne.io.read_raw_eeglab,
    ".fif": mne.io.read_raw_fif,
}


# ============================================================
# FIND EEG FILES
# ============================================================

def find_eeg_files():
    """
    Recursively search data/raw/ for supported EEG files.

    Returns
    -------
    list[Path]
        List of EEG file paths.
    """

    RAW_DIR.mkdir(parents=True, exist_ok=True)

    eeg_files = []

    for file in RAW_DIR.rglob("*"):

        if not file.is_file():
            continue

        if file.suffix.lower() in SUPPORTED_FORMATS:
            eeg_files.append(file)

    return sorted(eeg_files)


# ============================================================
# LOAD EEG FILE
# ============================================================

def load_eeg(filepath, preload=True):
    """
    Load an EEG recording using MNE-Python.

    Parameters
    ----------
    filepath : str or Path
        Path to the EEG file.

    preload : bool
        Load EEG data into memory if True.

    Returns
    -------
    raw : mne.io.BaseRaw
        MNE Raw EEG object.
    """

    filepath = Path(filepath)

    # --------------------------------------------------------
    # Handle relative paths
    # --------------------------------------------------------

    if not filepath.is_absolute():
        filepath = RAW_DIR / filepath

    # --------------------------------------------------------
    # Check file exists
    # --------------------------------------------------------

    if not filepath.exists():
        raise FileNotFoundError(
            f"\nEEG file not found:\n{filepath}"
        )

    # --------------------------------------------------------
    # Check format
    # --------------------------------------------------------

    suffix = filepath.suffix.lower()

    if suffix not in SUPPORTED_FORMATS:

        raise ValueError(
            f"\nUnsupported EEG format: {suffix}\n"
            f"Supported formats: {list(SUPPORTED_FORMATS.keys())}"
        )

    # --------------------------------------------------------
    # Select MNE reader
    # --------------------------------------------------------

    reader = SUPPORTED_FORMATS[suffix]

    # --------------------------------------------------------
    # Load EEG
    # --------------------------------------------------------

    print("\n==========================================")
    print("             LOADING EEG")
    print("==========================================")

    print(f"\nFile:")
    print(filepath)

    raw = reader(
        str(filepath),
        preload=preload,
        verbose=False
    )

    # ========================================================
    # DISPLAY BASIC INFORMATION
    # ========================================================

    print("\n========== EEG INFORMATION ==========")

    print(
        f"Channels       : {raw.info['nchan']}"
    )

    print(
        f"Sampling rate  : {raw.info['sfreq']} Hz"
    )

    print(
        f"Duration       : {raw.times[-1]:.2f} seconds"
    )

    print(
        f"Samples        : {raw.n_times}"
    )

    print(
        f"Data shape     : {raw.get_data().shape}"
    )

    print("\nChannel names:")

    for index, channel in enumerate(raw.ch_names, start=1):
        print(f"{index:02d}. {channel}")

    print("\n==========================================")
    print("             EEG LOADED")
    print("==========================================\n")

    return raw


# ============================================================
# GET DATASET SUMMARY
# ============================================================

def print_dataset_summary():
    """
    Print all EEG files found in the dataset.
    """

    files = find_eeg_files()

    print("\n==========================================")
    print("          NEUROAGENT DATASET")
    print("==========================================")

    print(f"\nDataset directory:")
    print(RAW_DIR)

    print(f"\nTotal EEG files found: {len(files)}")

    if not files:
        print("\nNo EEG files found.")
        print("\nExpected structure:")
        print(
            "data/raw/EEGc/S002/S002R01.edf"
        )
        return

    print("\nEEG files:")

    for index, file in enumerate(files, start=1):

        relative_path = file.relative_to(RAW_DIR)

        print(
            f"{index:03d}. {relative_path}"
        )

    print("\n==========================================\n")


# ============================================================
# GET FIRST EEG FILE
# ============================================================

def get_first_eeg_file():
    """
    Return the first EEG file found in the dataset.

    Returns
    -------
    Path
        First EEG file.

    Raises
    ------
    FileNotFoundError
        If no EEG files are found.
    """

    files = find_eeg_files()

    if not files:
        raise FileNotFoundError(
            "\nNo EEG files found inside:\n"
            f"{RAW_DIR}"
        )

    return files[0]


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("\n")
    print("================================================")
    print("              NEUROAGENT")
    print("              EEG DATA LOADER")
    print("================================================")

    # --------------------------------------------------------
    # Find all EEG files
    # --------------------------------------------------------

    files = find_eeg_files()

    print("\nDataset location:")
    print(RAW_DIR)

    print(
        f"\nFound {len(files)} EEG file(s).\n"
    )

    # --------------------------------------------------------
    # No files
    # --------------------------------------------------------

    if not files:

        print("❌ No EEG files found.")

        print("\nMake sure your dataset looks like:")

        print(
            """
data/
└── raw/
    └── EEGc/
        └── S002/
            ├── S002R01.edf
            ├── S002R02.edf
            └── ...
            """
        )

    # --------------------------------------------------------
    # Files found
    # --------------------------------------------------------

    else:

        print("Available EEG files:\n")

        for index, file in enumerate(files[:20], start=1):

            relative_path = file.relative_to(RAW_DIR)

            print(
                f"{index:02d}. {relative_path}"
            )

        # ----------------------------------------------------
        # Load first EEG file
        # ----------------------------------------------------

        first_file = files[0]

        print(
            "\n\nLoading first EEG file for testing..."
        )

        raw = load_eeg(first_file)

        # ----------------------------------------------------
        # Final confirmation
        # ----------------------------------------------------

        print("\n==========================================")
        print("           DATA LOADING SUCCESS")
        print("==========================================")

        print(
            f"\nLoaded file : "
            f"{first_file.name}"
        )

        print(
            f"Channels    : "
            f"{raw.info['nchan']}"
        )

        print(
            f"Sampling    : "
            f"{raw.info['sfreq']} Hz"
        )

        print(
            f"Duration    : "
            f"{raw.times[-1]:.2f} seconds"
        )

        print(
            "\nNext stage → EEG PREPROCESSING"
        )

        print("==========================================\n")