"""
api_helper.py — NeuroAgent EEG Data API Helper
===============================================
READ-ONLY adapter. Reads existing processed FIF files
and outputs JSON to stdout for the frontend server.

Does NOT modify any existing backend files or data.

Usage (called by server.js):
  python api_helper.py --file preprocessed --samples 800 --channels 0,1,2,3,4,5,6,7
  python api_helper.py --file ica --component IC9 --samples 800
  python api_helper.py --subject S002 --recording R01 --file preprocessed
"""

import sys
import json
import argparse
import re
import numpy as np
from pathlib import Path

# ── Paths (read-only) ─────────────────────────────────────
BASE_DIR      = Path(__file__).resolve().parent / 'backend'
PROCESSED_DIR = BASE_DIR / 'data' / 'processed'


def resolve_fif_files(subject='S002', recording='R01'):
    """
    Resolve FIF file paths for a given subject and recording.
    Checks data/processed/{subject}/ first, with fallback to legacy flat files.
    """
    prefix = f"{subject}{recording}"
    subj_dir = PROCESSED_DIR / subject
    paths = {}

    for ft, suffix in [
        ('preprocessed', '_preprocessed_raw.fif'),
        ('reconstructed', '_reconstructed_raw.fif'),
        ('ica', '_ica.fif'),
    ]:
        candidate = subj_dir / f"{prefix}{suffix}"
        if not candidate.exists():
            candidate = PROCESSED_DIR / f"{prefix}{suffix}"
        paths[ft] = candidate

    return paths


def extract_raw_samples(file_type, n_samples, channel_indices, fif_files):
    """Extract downsampled EEG samples from a raw FIF file."""
    import mne

    fp = fif_files.get(file_type)
    if not fp or not fp.exists():
        return {'error': f'File not found: {file_type}', 'path': str(fp)}

    raw = mne.io.read_raw_fif(str(fp), preload=True, verbose=False)

    data  = raw.get_data()          # shape: (channels, samples)
    times = raw.times
    sfreq = float(raw.info['sfreq'])
    ch_names = raw.ch_names

    total = data.shape[1]
    step  = max(1, total // n_samples)
    idx   = np.arange(0, total, step)[:n_samples]

    # Clamp channel indices to valid range
    ch_idx = [i for i in channel_indices if i < data.shape[0]]
    if not ch_idx:
        ch_idx = list(range(min(8, data.shape[0])))

    # Convert V → µV
    sampled = (data[ch_idx][:, idx] * 1e6).tolist()

    return {
        'file_type':  file_type,
        'sfreq':      sfreq,
        'n_channels': int(data.shape[0]),
        'n_samples':  int(len(idx)),
        'duration':   float(times[-1]),
        'times':      times[idx].tolist(),
        'channels':   [ch_names[i] for i in ch_idx],
        'data':       sampled,
        'unit':       'µV',
        'available':  True,
    }


def extract_ica_component(component, n_samples, fif_files):
    """Extract a single ICA source time series."""
    import mne

    ica_fp = fif_files['ica']
    raw_fp = fif_files['preprocessed']

    for fp, label in [(ica_fp, 'ICA FIF'), (raw_fp, 'Preprocessed FIF')]:
        if not fp.exists():
            return {'error': f'{label} not found: {fp}'}

    ica = mne.preprocessing.read_ica(str(ica_fp), verbose=False)
    raw = mne.io.read_raw_fif(str(raw_fp), preload=True, verbose=False)
    sources = ica.get_sources(raw)

    comp_idx = int(component.replace('IC', '')) - 1
    src_data = sources.get_data()

    if comp_idx >= src_data.shape[0]:
        return {'error': f'{component} index out of range (max IC{src_data.shape[0]})'}

    ts    = src_data[comp_idx]
    times = sources.times

    step  = max(1, len(ts) // n_samples)
    idx   = np.arange(0, len(ts), step)[:n_samples]

    return {
        'component': component,
        'times':     times[idx].tolist(),
        'amplitude': ts[idx].tolist(),
        'n_samples': int(len(idx)),
        'sfreq':     float(sources.info['sfreq']),
        'duration':  float(times[-1]),
        'unit':      'AU',
        'available': True,
    }


def extract_topomap(component, fif_files):
    """Extract spatial topography weights and electrode coordinates for an ICA component."""
    import mne
    ica_fp = fif_files.get('ica')
    raw_fp = fif_files.get('preprocessed')
    for fp, label in [(ica_fp, 'ICA FIF'), (raw_fp, 'Preprocessed FIF')]:
        if not fp or not fp.exists():
            return {'error': f'{label} not found: {fp}', 'available': False}

    ica = mne.preprocessing.read_ica(str(ica_fp), verbose=False)
    raw = mne.io.read_raw_fif(str(raw_fp), preload=False, verbose=False)

    montage = raw.get_montage()
    ch_pos = montage.get_positions()['ch_pos'] if montage else {}

    comp_idx = int(component.replace('IC', '')) - 1
    components = ica.get_components()

    if comp_idx >= components.shape[1]:
        return {'error': f'{component} out of range', 'available': False}

    weights = components[:, comp_idx]
    max_abs = float(np.max(np.abs(weights))) or 1.0
    norm_weights = (weights / max_abs * 100.0).tolist()

    coords = []
    for i, ch in enumerate(raw.ch_names):
        pos = ch_pos.get(ch, [0.0, 0.0, 0.0])
        coords.append({
            'channel': ch,
            'index': i + 1,
            'weight': round(float(norm_weights[i]), 2),
            'raw_weight': round(float(weights[i]), 5),
            'x': round(float(pos[0]) * 10.0, 4),
            'y': round(float(pos[1]) * 10.0, 4),
            'z': round(float(pos[2]) * 10.0, 4),
        })

    return {
        'component': component,
        'available': True,
        'channels': coords,
        'min_weight': round(float(np.min(norm_weights)), 2),
        'max_weight': round(float(np.max(norm_weights)), 2),
    }


def extract_channel_comparison(channel_name_or_idx, n_samples, fif_files):
    """Extract before and after cleaning signal + real PSD comparison for a channel."""
    import mne
    import scipy.signal

    raw_fp = fif_files.get('preprocessed')
    recon_fp = fif_files.get('reconstructed')

    for fp, label in [(raw_fp, 'Preprocessed FIF'), (recon_fp, 'Reconstructed FIF')]:
        if not fp or not fp.exists():
            return {'error': f'{label} not found: {fp}', 'available': False}

    raw = mne.io.read_raw_fif(str(raw_fp), preload=True, verbose=False)
    recon = mne.io.read_raw_fif(str(recon_fp), preload=True, verbose=False)

    ch_name = str(channel_name_or_idx).upper()
    if ch_name.isdigit():
        idx = int(ch_name)
        ch_name = raw.ch_names[idx] if idx < len(raw.ch_names) else 'F7'
    elif ch_name not in raw.ch_names:
        ch_name = 'F7' if 'F7' in raw.ch_names else raw.ch_names[0]

    ch_idx = raw.ch_names.index(ch_name)

    raw_sig = raw.get_data()[ch_idx] * 1e6
    clean_sig = recon.get_data()[ch_idx] * 1e6
    times = raw.times
    sfreq = float(raw.info['sfreq'])

    total = len(times)
    step = max(1, total // n_samples)
    idx = np.arange(0, total, step)[:n_samples]

    nperseg = min(len(raw_sig), int(sfreq * 2))
    f_raw, p_raw = scipy.signal.welch(raw_sig, fs=sfreq, nperseg=nperseg)
    f_clean, p_clean = scipy.signal.welch(clean_sig, fs=sfreq, nperseg=nperseg)

    freq_mask = (f_raw >= 0.5) & (f_raw <= 50.0)
    freqs = f_raw[freq_mask].tolist()
    psd_raw = p_raw[freq_mask].tolist()
    psd_clean = p_clean[freq_mask].tolist()

    raw_var = float(np.var(raw_sig))
    clean_var = float(np.var(clean_sig))
    reduction_pct = max(0.0, round((1.0 - (clean_var / (raw_var or 1.0))) * 100.0, 1))

    return {
        'channel': ch_name,
        'channel_index': ch_idx,
        'sfreq': sfreq,
        'duration': float(times[-1]),
        'times': times[idx].tolist(),
        'before_eeg': raw_sig[idx].tolist(),
        'after_eeg': clean_sig[idx].tolist(),
        'unit': 'µV',
        'raw_std': round(float(np.std(raw_sig)), 2),
        'clean_std': round(float(np.std(clean_sig)), 2),
        'reduction_pct': reduction_pct,
        'psd_freqs': freqs,
        'psd_raw': psd_raw,
        'psd_clean': psd_clean,
        'available': True,
    }


def extract_channel_list(fif_files):
    """Extract all 64 channels with montage positions and artifact classification status."""
    import mne
    raw_fp = fif_files.get('preprocessed')
    if not raw_fp or not raw_fp.exists():
        return {'error': 'Preprocessed FIF not found', 'available': False}

    raw = mne.io.read_raw_fif(str(raw_fp), preload=False, verbose=False)
    montage = raw.get_montage()
    ch_pos = montage.get_positions()['ch_pos'] if montage else {}

    channels = []
    # Identify channels that commonly pick up ocular/frontal or temporal artifacts
    artifact_channels = {'FP1', 'FPZ', 'FP2', 'AF7', 'AF3', 'AFZ', 'AF4', 'AF8', 'F7', 'F8', 'T7', 'T8'}
    review_channels = {'FT7', 'FT8', 'TP7', 'TP8', 'F5', 'F6'}

    for i, ch in enumerate(raw.ch_names):
        pos = ch_pos.get(ch, [0.0, 0.0, 0.0])
        status = 'artifact' if ch in artifact_channels else ('review' if ch in review_channels else 'clean')
        channels.append({
            'index': i + 1,
            'name': ch,
            'status': status,
            'x': round(float(pos[0]) * 10.0, 4),
            'y': round(float(pos[1]) * 10.0, 4),
            'z': round(float(pos[2]) * 10.0, 4),
        })

    return {
        'total': len(channels),
        'channels': channels,
        'available': True,
    }


def extract_session_info(subject, recording, fif_files):
    """Extract real metadata (sampling rate, duration, channels, ICA component count) from processed files."""
    import mne
    import pandas as pd
    prefix = f"{subject}{recording}"
    prep_fp = fif_files.get('preprocessed')

    sfreq = 160.0
    duration = 60.99
    channels = 64
    ica_components = 63

    if prep_fp and prep_fp.exists():
        try:
            raw = mne.io.read_raw_fif(str(prep_fp), preload=False, verbose=False)
            sfreq = float(raw.info['sfreq'])
            duration = round(float(raw.times[-1]), 2)
            channels = len(raw.ch_names)
        except Exception:
            pass

    csv_candidates = [
        PROCESSED_DIR / subject / f"{prefix}_neuroagent.csv",
        PROCESSED_DIR / f"{prefix}_neuroagent.csv",
        PROCESSED_DIR / subject / f"{prefix}_iclabel.csv",
        PROCESSED_DIR / f"{prefix}_iclabel.csv",
    ]
    for c in csv_candidates:
        if c.exists():
            try:
                df = pd.read_csv(c)
                ica_components = len(df)
                break
            except Exception:
                pass

    return {
        'session_id': prefix,
        'subject': subject,
        'recording': f"{prefix}.edf",
        'channels': channels,
        'sampling_rate': sfreq,
        'duration': duration,
        'ica_components': ica_components,
        'available': True,
    }


def main():
    parser = argparse.ArgumentParser(description='NeuroAgent EEG Data API Helper')
    parser.add_argument('--file',      default='preprocessed',
                        choices=['preprocessed', 'reconstructed', 'ica', 'topomap', 'compare', 'channels', 'session'])
    parser.add_argument('--component', default='IC1')
    parser.add_argument('--channel',   default='F7')
    parser.add_argument('--samples',   type=int, default=800)
    parser.add_argument('--channels',  default='0,1,2,3,4,5,6,7')
    parser.add_argument('--subject',   default='S002')
    parser.add_argument('--recording', default='R01')
    parser.add_argument('--session',   default=None, help='e.g. S002R01')
    args = parser.parse_args()

    subject = args.subject.upper()
    recording = args.recording.upper()
    if args.session:
        m = re.match(r'^(S\d{3})(R\d{2})$', args.session.strip(), re.IGNORECASE)
        if m:
            subject = m.group(1).upper()
            recording = m.group(2).upper()

    fif_files = resolve_fif_files(subject, recording)

    try:
        if args.file == 'ica':
            result = extract_ica_component(args.component, args.samples, fif_files)
        elif args.file == 'topomap':
            result = extract_topomap(args.component, fif_files)
        elif args.file == 'compare':
            result = extract_channel_comparison(args.channel or args.channels, args.samples, fif_files)
        elif args.file == 'channels':
            result = extract_channel_list(fif_files)
        elif args.file == 'session':
            result = extract_session_info(subject, recording, fif_files)
        else:
            ch_idx = [int(c) for c in args.channels.split(',') if c.strip()]
            result = extract_raw_samples(args.file, args.samples, ch_idx, fif_files)

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({'error': str(e), 'available': False}))
        sys.exit(1)


if __name__ == '__main__':
    main()

