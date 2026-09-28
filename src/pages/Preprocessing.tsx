import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { SlidersHorizontal, Play, CheckCircle2, AlertCircle, RefreshCw, Cpu, Activity } from 'lucide-react';

export const Preprocessing: React.FC = () => {
  const { session, runPipelineStage, isProcessing, processingProgress, processingStage } = useNeuro();

  // Preprocessing filter parameters matching backend/src/preprocess.py DEFAULT_CONFIG
  const [highPass, setHighPass] = useState<number>(1.0);
  const [lowPass, setLowPass] = useState<number>(40.0);
  const [notch, setNotch] = useState<number>(50.0);
  const [reference, setReference] = useState<'average' | 'cz' | 'mastoid'>('average');
  const [badThreshold, setBadThreshold] = useState<number>(5.0);
  const [resampleRate, setResampleRate] = useState<string>('Original (160 Hz)');

  const [hasRun, setHasRun] = useState<boolean>(true);

  const handleRunPreprocessing = async () => {
    await runPipelineStage('PREPROCESSING (Montage, Filtering, Re-reference)');
    setHasRun(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
            <span>EEG Preprocessing Pipeline</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Standardized 10–20 montage alignment, band-pass filtering, notch attenuation, and robust bad channel interpolation.
          </p>
        </div>

        <button
          onClick={handleRunPreprocessing}
          disabled={isProcessing}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${
            isProcessing
              ? 'bg-cyan-500/40 text-cyan-200 cursor-not-allowed'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-glow-cyan'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing... {processingProgress}%</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Preprocessing</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Bar (when running) */}
      {isProcessing && (
        <div className="p-4 rounded-2xl glass-panel border border-cyan-400/40 shadow-glow-cyan animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-cyan-300 font-bold">{processingStage}</span>
            <span className="text-cyan-400">{processingProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-cyan-500/30">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_10px_#00d4ff]"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Acquisition Specs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Montage Specification</span>
          <div className="text-base font-bold font-mono text-cyan-300 mt-1">standard_1020</div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">Case-insensitive matching</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Reference Mode</span>
          <div className="text-base font-bold font-mono text-white mt-1">Common Average (CAR)</div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">Active Ground</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Power-Line Filter</span>
          <div className="text-base font-bold font-mono text-white mt-1">50.0 Hz Notch</div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">India / EU Grid Standard</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Bad Channel Detection</span>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1">Spherical Spline</div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">Threshold: {badThreshold}σ</div>
        </div>
      </div>

      {/* Filter & Preprocessing Configuration Controls */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-6 p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-4">
          <h2 className="text-sm font-bold font-mono tracking-wider text-cyan-300 uppercase border-b border-cyan-500/15 pb-2">
            Spectral Bandpass Filters
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-gray-300">High-pass Filter (removes DC drift & sweat)</span>
                <span className="text-cyan-300 font-bold">{highPass.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={highPass}
                onChange={e => setHighPass(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-gray-300">Low-pass Filter (anti-aliasing & EMG cutoff)</span>
                <span className="text-cyan-300 font-bold">{lowPass.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min="30.0"
                max="70.0"
                step="1.0"
                value={lowPass}
                onChange={e => setLowPass(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-gray-300">Notch Filter (Mains frequency)</span>
                <span className="text-cyan-300 font-bold">{notch.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min="45.0"
                max="65.0"
                step="5.0"
                value={notch}
                onChange={e => setNotch(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="col-span-6 p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-4">
          <h2 className="text-sm font-bold font-mono tracking-wider text-cyan-300 uppercase border-b border-cyan-500/15 pb-2">
            Reference & Artifact Detection
          </h2>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-gray-300 block mb-1">EEG Reference Scheme</label>
              <select
                value={reference}
                onChange={e => setReference(e.target.value as any)}
                className="w-full p-2 rounded-lg bg-black/40 border border-cyan-500/30 text-cyan-300 focus:outline-none cursor-pointer"
              >
                <option value="average">Average Reference (Recommended for 64-ch)</option>
                <option value="cz">Cz Vertex Reference</option>
                <option value="mastoid">Linked Mastoids</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-gray-300">Bad Channel Z-score Threshold</span>
                <span className="text-cyan-300 font-bold">{badThreshold.toFixed(1)} SD</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="8.0"
                step="0.5"
                value={badThreshold}
                onChange={e => setBadThreshold(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">
                  Output cached at <code className="text-white">backend/data/processed/S002R01_preprocessed_raw.fif</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
