import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { BeforeAfterCharts } from '../components/charts/BeforeAfterCharts';
import { RefreshCw, Play, CheckCircle2, Trash2, ArrowRight } from 'lucide-react';

export const Reconstruction: React.FC = () => {
  const { components, runPipelineStage, isProcessing } = useNeuro();

  const removedComponents = components.filter(c => c.decision === 'REMOVE');

  const handleReconstruct = async () => {
    await runPipelineStage('EEG SIGNAL RECONSTRUCTION (Zeroing artifact mixing vectors)');
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            <span>Clean EEG Signal Reconstruction</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Back-projects clean ICA sources into scalp sensor space: <span className="font-mono text-cyan-300">X_clean = A_kept · S_kept</span>.
          </p>
        </div>

        <button
          onClick={handleReconstruct}
          disabled={isProcessing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-glow-cyan transition-all cursor-pointer"
        >
          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          <span>Reconstruct EEG</span>
        </button>
      </div>

      {/* Components Zeroed Out in Reconstruction */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold font-mono uppercase text-red-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Components Scheduled for Removal ({removedComponents.length})</span>
          </span>
          <span className="text-xs font-mono text-gray-400">
            Spatial mixing weights set to zero
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {removedComponents.map(c => (
            <div
              key={c.component}
              className="px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 font-mono text-xs flex items-center gap-2"
            >
              <span className="font-bold">{c.component}</span>
              <span className="text-[10px] text-gray-400">({c.iclabel_label})</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            </div>
          ))}

          {removedComponents.length === 0 && (
            <div className="text-xs text-gray-400 font-mono italic">
              No components marked for removal. All 63 components currently retained.
            </div>
          )}
        </div>
      </div>

      {/* Real Before / After Scientific Comparisons */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider">
          Electrophysiological Before & After Cleaning Comparison
        </h2>
        <BeforeAfterCharts />
      </div>

      {/* Output FIF Artifact Confirmation */}
      <div className="p-4 rounded-2xl glass-panel border border-emerald-500/30 shadow-panel flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div className="text-xs font-mono">
            <div className="font-bold text-white">Reconstructed Raw FIF Artifact Ready</div>
            <div className="text-gray-400 text-[11px]">
              Saved as: <code className="text-cyan-300">backend/data/processed/S002/S002R01_reconstructed_raw.fif</code>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-emerald-400 font-bold">
          Status: Synchronized
        </div>
      </div>
    </div>
  );
};
