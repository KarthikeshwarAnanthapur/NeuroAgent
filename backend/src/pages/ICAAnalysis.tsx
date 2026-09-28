import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { ICATopomap } from '../components/ica/ICATopomap';
import { CircleDot, Play, RefreshCw, Sparkles, Filter, Activity, CheckCircle2 } from 'lucide-react';

export const ICAAnalysis: React.FC = () => {
  const {
    components,
    selectedComponent,
    selectedComponentId,
    setSelectedComponentId,
    runPipelineStage,
    isProcessing,
  } = useNeuro();

  const [filterType, setFilterType] = useState<'ALL' | 'REMOVE' | 'KEEP' | 'REVIEW'>('ALL');

  const filteredComponents = components.filter(c => {
    if (filterType === 'ALL') return true;
    return c.decision === filterType;
  });

  const handleRunICA = async () => {
    await runPipelineStage('ICA DECOMPOSITION (Extended Infomax 63 Components)');
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <CircleDot className="w-5 h-5 text-cyan-400" />
            <span>Independent Component Analysis (ICA)</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Extended Infomax blind source separation. Isolates electrooculographic (EOG), electromyographic (EMG), and neural generators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunICA}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-glow-cyan transition-all cursor-pointer"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>Re-Run ICA</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Total Decomposed</span>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">63 Components</div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">Rank Deficient (Average Reference -1)</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Artifacts Identified</span>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">
            {components.filter(c => c.decision === 'REMOVE').length} Components
          </div>
          <div className="text-[11px] text-red-400/80 font-mono mt-1">Ocular & Cardiac Sources</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Neural Sources (Keep)</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {components.filter(c => c.decision === 'KEEP').length} Components
          </div>
          <div className="text-[11px] text-emerald-400/80 font-mono mt-1">Alpha / Mu / Sensorimotor</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <span className="text-[10px] text-gray-400 font-mono uppercase">Flagged for Review</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {components.filter(c => c.decision === 'REVIEW').length} Components
          </div>
          <div className="text-[11px] text-amber-400/80 font-mono mt-1">Ambiguous Mixed Signals</div>
        </div>
      </div>

      {/* Main Grid: Component Selector List (Left) & Inspector (Right) */}
      <div className="grid grid-cols-12 gap-5">
        {/* Component Selector Grid */}
        <div className="col-span-5 p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/15">
            <span className="text-xs font-bold font-mono text-cyan-300 uppercase">
              Components ({filteredComponents.length})
            </span>

            {/* Filter buttons */}
            <div className="flex gap-1 text-[10px] font-mono">
              {(['ALL', 'REMOVE', 'KEEP', 'REVIEW'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    filterType === f
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[420px] p-1 mt-3">
            {filteredComponents.map(comp => {
              const isSelected = comp.component.toLowerCase() === selectedComponentId.toLowerCase();
              return (
                <button
                  key={comp.component}
                  onClick={() => setSelectedComponentId(comp.component)}
                  className={`p-2.5 rounded-xl font-mono text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-500 text-black border-cyan-300 font-bold shadow-glow-cyan'
                      : 'bg-white/5 hover:bg-white/10 border-cyan-500/15 text-gray-300'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{comp.component}</span>
                    <span
                      className={`text-[9px] px-1 rounded uppercase ${
                        comp.decision === 'REMOVE'
                          ? 'bg-red-500/30 text-red-300'
                          : comp.decision === 'KEEP'
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/30 text-amber-300'
                      }`}
                    >
                      {comp.decision}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 truncate">
                    {comp.iclabel_label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Component Topographic & Feature Details */}
        <div className="col-span-7 p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
            <div>
              <span className="text-[10px] font-mono text-gray-400 uppercase">Selected Source Generator</span>
              <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
                <span>{selectedComponent?.component}</span>
                <span className="text-xs font-normal text-cyan-300 font-mono">
                  (Confidence: {((selectedComponent?.iclabel_confidence || 0.94) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                selectedComponent?.decision === 'REMOVE'
                  ? 'bg-red-500/20 border border-red-500 text-red-400'
                  : selectedComponent?.decision === 'KEEP'
                  ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                  : 'bg-amber-500/20 border border-amber-500 text-amber-400'
              }`}
            >
              {selectedComponent?.decision}
            </div>
          </div>

          <div className="flex items-center justify-around py-3 bg-black/30 rounded-xl border border-cyan-500/10">
            <ICATopomap size={170} showColorbar={true} />

            <div className="text-xs font-mono space-y-2 text-gray-300">
              <div className="font-bold text-cyan-300">Spatial Localization</div>
              <div>Type: <span className="text-white">{selectedComponent?.iclabel_label}</span></div>
              <div>Dominant Frequency: <span className="text-white">{selectedComponent?.dominant_frequency || 1.2} Hz</span></div>
              <div>Explained Variance: <span className="text-white">{selectedComponent?.explained_variance || 2.41}%</span></div>
              <div>Signal Quality: <span className="text-white">{selectedComponent?.signal_quality || 'Artifacts Detected'}</span></div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-gray-300">
            <div className="font-bold text-cyan-300 mb-1">Reasoning Analysis</div>
            <p className="text-[11px] leading-relaxed text-gray-400 font-sans">
              {selectedComponent?.neuroagent_reason}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
