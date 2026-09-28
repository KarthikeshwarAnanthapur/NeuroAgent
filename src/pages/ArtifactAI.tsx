import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { Bot, Play, RefreshCw, BrainCircuit, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';

export const ArtifactAI: React.FC = () => {
  const { components, runPipelineStage, isProcessing } = useNeuro();

  const total = components.length;
  const removeCount = components.filter(c => c.decision === 'REMOVE').length;
  const keepCount = components.filter(c => c.decision === 'KEEP').length;
  const reviewCount = components.filter(c => c.decision === 'REVIEW').length;

  const handleRunAI = async () => {
    await runPipelineStage('AI ARTIFACT CLASSIFICATION (1D-CNN + NeuroAgent Engine)');
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span>NeuroAgent AI & 1D-CNN Classification</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Deep neural artifact detection combined with multi-evidence fusion (ICLabel, ALICE, PSD spectral metrics, and Agentic reasoning).
          </p>
        </div>

        <button
          onClick={handleRunAI}
          disabled={isProcessing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-glow-cyan transition-all cursor-pointer"
        >
          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          <span>Run AI Analysis</span>
        </button>
      </div>

      {/* Decision Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">Total Analyzed</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{total} Sources</div>
          <div className="text-[11px] text-cyan-400 font-mono mt-1">100% Window Coverage</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-red-500/30 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">REMOVE Decision</div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">{removeCount} Artifacts</div>
          <div className="text-[11px] text-red-400/80 font-mono mt-1">EOG Blinks & Muscle</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-emerald-500/30 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">KEEP Decision</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{keepCount} Clean</div>
          <div className="text-[11px] text-emerald-400/80 font-mono mt-1">Preserved Neural Waves</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-amber-500/30 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">REVIEW Decision</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{reviewCount} Pending</div>
          <div className="text-[11px] text-amber-400/80 font-mono mt-1">Borderline Uncertainty</div>
        </div>
      </div>

      {/* Architecture Clarity Panel: 1D-CNN vs Agent Decision Engine */}
      <div className="p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
        <h2 className="text-sm font-bold font-mono text-cyan-300 uppercase mb-3 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-cyan-400" />
          <span>NeuroAgent Multi-Layer Decision Hierarchy</span>
        </h2>

        <div className="grid grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-black/40 border border-cyan-500/15 space-y-1">
            <span className="text-[10px] text-cyan-400 uppercase font-bold">Layer 1: Trained 1D-CNN</span>
            <p className="text-[11px] text-gray-300 font-sans leading-relaxed">
              Trained on 366,287 windows (97.52% accuracy). Evaluates raw time-series morphology for sharp spike & slow wave contours.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-cyan-500/15 space-y-1">
            <span className="text-[10px] text-cyan-400 uppercase font-bold">Layer 2: Multi-Evidence Fusion</span>
            <p className="text-[11px] text-gray-300 font-sans leading-relaxed">
              Fuses spatial ICLabel probabilities, ALICE waveform kurtosis, and PSD delta/gamma band ratios into joint evidence scores.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-cyan-500/15 space-y-1">
            <span className="text-[10px] text-cyan-400 uppercase font-bold">Layer 3: Agentic Reasoning</span>
            <p className="text-[11px] text-gray-300 font-sans leading-relaxed">
              Generates explicit human-readable scientific rationale for each component with automated safety guardrails.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Classification Matrix */}
      <div className="p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
        <h2 className="text-sm font-bold font-mono text-cyan-300 uppercase mb-3">
          Component Classification Log
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-cyan-500/20 text-gray-400 text-[11px]">
                <th className="py-2.5 px-3">Component</th>
                <th className="py-2.5 px-3">ICLabel Type</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Artifact Score</th>
                <th className="py-2.5 px-3">Agent Decision</th>
                <th className="py-2.5 px-3">AI Reasoning Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {components.map(comp => (
                <tr key={comp.component} className="hover:bg-cyan-500/5 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-white">{comp.component}</td>
                  <td className="py-2.5 px-3 text-cyan-300 capitalize">{comp.iclabel_label}</td>
                  <td className="py-2.5 px-3">{(comp.iclabel_confidence * 100).toFixed(1)}%</td>
                  <td className="py-2.5 px-3">
                    <span className={`font-bold ${comp.artifact_score > 0.6 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {comp.artifact_score.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        comp.decision === 'REMOVE'
                          ? 'bg-red-500/20 border border-red-500 text-red-400'
                          : comp.decision === 'KEEP'
                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                          : 'bg-amber-500/20 border border-amber-500 text-amber-400'
                      }`}
                    >
                      {comp.decision}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-gray-400 max-w-md truncate font-sans">
                    {comp.neuroagent_reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
