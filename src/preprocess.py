"""
preprocess.py — NeuroAgent EEG Preprocessing Pipeline
======================================================

Pipeline:

    RAW EEG
       ↓
    Channel-name cleanup
       ↓
    EEG Montage
       ↓
    Band-pass filtering
       ↓
    Notch filtering
       ↓
    Average reference
       ↓
    Bad-channel detection
       ↓
    Bad-channel interpolation
       ↓
    Optional resampling
       ↓
    Save preprocessed EEG

The montage is important because later stages such as
ICLabel require electrode position information.
"""

import mne
import numpy as np
from pathlib import Path


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"


# ============================================================
# PREPROCESSING CONFIGURATION
# ============================================================

DEFAULT_CONFIG = {

    # High-pass filter
    "l_freq": 1.0,

    # Low-pass filter
    "h_freq": 40.0,

    # Power-line noise
    # India commonly uses 50 Hz
    "notch_freq": 50.0,

    # EEG reference
    "reference": "average",

    # Optional downsampling
    # None = keep original 160 Hz
    "resample_freq": None,

    # Bad channel detection threshold
    "bad_threshold": 5.0,
}


# ============================================================
# CHANNEL NAME CLEANUP
# ============================================================

def clean_channel_names(raw):
    """
    Clean channel names so they can be matched with
    standard EEG montage channel names.

    Example:

        Fc5.  → FC5
        C3..  → C3
        Fz..  → FZ

    The physical EEG data is NOT changed.
    Only channel labels are cleaned.
    """

    print("\n[preprocess] Cleaning channel names...")

    rename_map = {}

    for name in raw.ch_names:

        # Remove trailing dots
        cleaned = name.rstrip(".")

        # Convert to uppercase
        cleaned = cleaned.upper()

        if cleaned != name:
            rename_map[name] = cleaned

    if rename_map:

        raw.rename_channels(rename_map)

        print(
            f"[preprocess] Cleaned {len(rename_map)} channel name(s)."
        )

    else:

        print("[preprocess] Channel names already clean.")

    return raw


# ============================================================
# SET EEG MONTAGE
# ============================================================

def set_eeg_montage(raw):
    """
    Assign standard EEG electrode positions.

    ICLabel requires electrode locations to generate
    ICA topographic features.
    """

    print("\n[preprocess] Setting EEG montage...")

    montage = mne.channels.make_standard_montage(
        "standard_1020"
    )

    raw.set_montage(
        montage,
        match_case=False,
        on_missing="warn"
    )

    print("[preprocess] EEG montage assigned.")

    return raw


# ============================================================
# FILTERING
# ============================================================

def bandpass_filter(
    raw,
    l_freq,
    h_freq,
    notch_freq=None
):
    """
    Apply band-pass filtering followed by optional
    notch filtering.
    """

    print(
        f"\n[preprocess] Band-pass filter: "
        f"{l_freq}–{h_freq} Hz"
    )

    raw.filter(
        l_freq=l_freq,
        h_freq=h_freq,
        fir_window="hamming",
        method="fir",
        verbose=False
    )

    if notch_freq is not None:

        print(
            f"[preprocess] Notch filter: "
            f"{notch_freq} Hz"
        )

        raw.notch_filter(
            freqs=notch_freq,
            verbose=False
        )

    return raw


# ============================================================
# RE-REFERENCE
# ============================================================

def rereference(
    raw,
    reference="average"
):
    """
    Re-reference EEG signals.

    Default:
        Average reference
    """

    print(
        f"\n[preprocess] Re-referencing to: "
        f"{reference}"
    )

    raw, _ = mne.set_eeg_reference(
        raw,
        ref_channels=reference,
        verbose=False
    )

    return raw


# ============================================================
# BAD CHANNEL DETECTION
# ============================================================

def detect_bad_channels(
    raw,
    threshold=5.0
):
    """
    Detect abnormal EEG channels using the
    standard deviation of each channel.

    Channels whose standard deviation has an
    unusually high z-score are flagged.
    """

    print(
        "\n[preprocess] Detecting bad channels..."
    )

    data = raw.get_data(
        picks="eeg"
    )

    # Standard deviation for every EEG channel
    std_per_channel = data.std(
        axis=1
    )

    # Z-score
    mean_std = std_per_channel.mean()

    std_std = std_per_channel.std()

    z_scores = (
        std_per_channel - mean_std
    ) / (
        std_std + 1e-9
    )

    bad_indices = np.where(
        np.abs(z_scores) > threshold
    )[0]

    bad_channels = [
        raw.ch_names[index]
        for index in bad_indices
    ]

    print(
        f"[preprocess] Detected "
        f"{len(bad_channels)} bad channel(s)."
    )

    if bad_channels:

        print(
            "[preprocess] Bad channels:"
        )

        for channel in bad_channels:
            print(
                f"   - {channel}"
            )

    else:

        print(
            "[preprocess] No bad channels detected."
        )

    return bad_channels


# ============================================================
# BAD CHANNEL INTERPOLATION
# ============================================================

def interpolate_bad_channels(
    raw,
    bad_channels
):
    """
    Interpolate bad EEG channels using
    spherical spline interpolation.
    """

    if not bad_channels:

        print(
            "\n[preprocess] No interpolation required."
        )

        return raw

    print(
        f"\n[preprocess] Interpolating "
        f"{len(bad_channels)} bad channel(s)..."
    )

    raw.info["bads"] = bad_channels

    raw.interpolate_bads(
        reset_bads=True,
        verbose=False
    )

    print(
        "[preprocess] Bad channels interpolated."
    )

    return raw


# ============================================================
# RESAMPLING
# ============================================================

def resample(
    raw,
    target_freq
):
    """
    Resample EEG to another sampling frequency.
    """

    print(
        f"\n[preprocess] Resampling: "
        f"{raw.info['sfreq']} → "
        f"{target_freq} Hz"
    )

    raw.resample(
        sfreq=target_freq,
        verbose=False
    )

    return raw


# ============================================================
# SAVE PREPROCESSED EEG
# ============================================================

def save_preprocessed(
    raw,
    filename
):
    """
    Save preprocessed EEG as FIF.
    """

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = (
        PROCESSED_DIR / filename
    )

    raw.save(
        str(output_path),
        overwrite=True,
        verbose=False
    )

    print(
        f"\n[preprocess] Saved:"
    )

    print(
        output_path
    )

    return output_path


# ============================================================
# COMPLETE PREPROCESSING PIPELINE
# ============================================================

def run_preprocessing(
    raw,
    config=None,
    save_as="preprocessed_raw.fif"
):
    """
    Execute the complete EEG preprocessing pipeline.

    Order:

        1. Clean channel names
        2. Set montage
        3. Band-pass filter
        4. Notch filter
        5. Re-reference
        6. Detect bad channels
        7. Interpolate bad channels
        8. Optional resampling
        9. Save result
    """

    cfg = {
        **DEFAULT_CONFIG,
        **(config or {})
    }

    print("\n")
    print("=" * 50)
    print("       NEUROAGENT PREPROCESSING")
    print("=" * 50)

    # --------------------------------------------------------
    # STEP 1 — CLEAN CHANNEL NAMES
    # --------------------------------------------------------

    raw = clean_channel_names(raw)

    # --------------------------------------------------------
    # STEP 2 — SET MONTAGE
    # --------------------------------------------------------

    raw = set_eeg_montage(raw)

    # --------------------------------------------------------
    # STEP 3 — FILTER
    # --------------------------------------------------------

    raw = bandpass_filter(
        raw,
        cfg["l_freq"],
        cfg["h_freq"],
        cfg["notch_freq"]
    )

    # --------------------------------------------------------
    # STEP 4 — REFERENCE
    # --------------------------------------------------------

    raw = rereference(
        raw,
        cfg["reference"]
    )

    # --------------------------------------------------------
    # STEP 5 — BAD CHANNEL DETECTION
    # --------------------------------------------------------

    bad_channels = detect_bad_channels(
        raw,
        cfg["bad_threshold"]
    )

    # --------------------------------------------------------
    # STEP 6 — INTERPOLATION
    # --------------------------------------------------------

    raw = interpolate_bad_channels(
        raw,
        bad_channels
    )

    # --------------------------------------------------------
    # STEP 7 — OPTIONAL RESAMPLING
    # --------------------------------------------------------

    if cfg["resample_freq"] is not None:

        raw = resample(
            raw,
            cfg["resample_freq"]
        )

    # --------------------------------------------------------
    # STEP 8 — SAVE
    # --------------------------------------------------------

    save_preprocessed(
        raw,
        save_as
    )

    print("\n")
    print("=" * 50)
    print("       PREPROCESSING COMPLETE")
    print("=" * 50)

    print(
        f"\nChannels    : "
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

    return raw


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    from load_data import load_eeg

    # --------------------------------------------------------
    # IMPORTANT:
    # Your current dataset contains the EEG files inside:
    #
    # data/raw/EEGc/S002/S002R01.edf
    #
    # So we directly specify the first file for testing.
    # --------------------------------------------------------

    eeg_file = (
        "EEGc/S002/S002R01.edf"
    )

    print("\n")
    print("=" * 50)
    print("       NEUROAGENT")
    print("       PREPROCESSING TEST")
    print("=" * 50)

    print(
        f"\nInput EEG:\n"
        f"{RAW_DIR / eeg_file}"
    )

    # Load EEG
    raw = load_eeg(
        eeg_file
    )

    # Run preprocessing
    run_preprocessing(
        raw,
        save_as="S002R01_preprocessed_raw.fif"
    )

    print("\n")
    print("=" * 50)
    print("Next stage → ICA DECOMPOSITION")
    print("=" * 50)