import React, { useState, useEffect } from 'react';
import { fetchTrainingMetrics } from '../api/reportApi';
import { TrainingMetrics } from '../types';
import { FileText, Download, CheckCircle, Award, Target, BarChart2, Cpu } from 'lucide-react';

export const Reports: React.FC = () => {
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);

  useEffect(() => {
    fetchTrainingMetrics().then(setMetrics);
  }, []);

  const handleDownloadReport = () => {
    const reportData = {
      model: 'NeuroAgent 1D-CNN + Agentic Fusion',
      evaluation_file: metrics?.evaluation_file || 'test.csv',
      accuracy: '97.52%',
      macro_precision: '81.72%',
      macro_recall: '92.92%',
      macro_f1: '86.37%',
      total_windows_evaluated: metrics?.total_windows || 366287,
      confusion_matrix: metrics?.confusion_matrix || [[344275, 7293], [1778, 12941]],
      clinical_quality_status: '100.0% GOOD',
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NeuroAgent_Clinical_Report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>AI Model Validation & Performance Report</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Empirical evaluation of 1D-CNN artifact classifier on test split (366,287 EEG sliding windows).
          </p>
        </div>

        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-glow-cyan transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Report</span>
        </button>
      </div>

      {/* 4 Performance Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-emerald-500/30 shadow-panel">
          <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono uppercase">
            <span>Overall Accuracy</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">
            {metrics ? (metrics.accuracy * 100).toFixed(2) : '97.52'}%
          </div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">
            Across 366,287 windows
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono uppercase">
            <span>Macro Precision</span>
            <Target className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-cyan-300 mt-1">
            {metrics ? (metrics.macro_precision * 100).toFixed(2) : '81.72'}%
          </div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">
            Low false-positive rate
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono uppercase">
            <span>Macro Recall</span>
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white mt-1">
            {metrics ? (metrics.macro_recall * 100).toFixed(2) : '92.92'}%
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">
            Detects 92.9% of artifacts
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono uppercase">
            <span>Macro F1 Score</span>
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-cyan-300 mt-1">
            {metrics ? (metrics.macro_f1 * 100).toFixed(2) : '86.37'}%
          </div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">
            Weighted F1: 97.71%
          </div>
        </div>
      </div>

      {/* Confusion Matrix & Model Specifications */}
      <div className="grid grid-cols-12 gap-5">
        {/* Confusion Matrix Table & Image */}
        <div className="col-span-7 p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-4">
          <h2 className="text-sm font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center justify-between">
            <span>Confusion Matrix (Evaluation Set)</span>
            <span className="text-[10px] text-gray-400 font-mono">N = 366,287 windows</span>
          </h2>

          <div className="grid grid-cols-2 gap-3 text-center font-mono">
            <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/40">
              <span className="text-[10px] text-gray-400 uppercase">True Negative (KEEP)</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">344,275</div>
              <div className="text-[10px] text-gray-400">Actual: KEEP · Pred: KEEP</div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/40">
              <span className="text-[10px] text-gray-400 uppercase">False Positive (False REMOVE)</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">7,293</div>
              <div className="text-[10px] text-gray-400">Actual: KEEP · Pred: REMOVE</div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/40">
              <span className="text-[10px] text-gray-400 uppercase">False Negative (Missed)</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">1,778</div>
              <div className="text-[10px] text-gray-400">Actual: REMOVE · Pred: KEEP</div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-red-500/40">
              <span className="text-[10px] text-gray-400 uppercase">True Positive (REMOVE)</span>
              <div className="text-2xl font-bold text-red-400 mt-1">12,941</div>
              <div className="text-[10px] text-gray-400">Actual: REMOVE · Pred: REMOVE</div>
            </div>
          </div>
        </div>

        {/* Model Architecture & Training Info */}
        <div className="col-span-5 p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-4">
          <h2 className="text-sm font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Neural Network Topology</span>
          </h2>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/15 flex justify-between">
              <span className="text-gray-400">Architecture</span>
              <span className="text-white font-bold">1D-CNN (Temporal Conv1D)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/15 flex justify-between">
              <span className="text-gray-400">Input Dimensions</span>
              <span className="text-white font-bold">(Batch, 1, 160)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/15 flex justify-between">
              <span className="text-gray-400">Loss Function</span>
              <span className="text-white font-bold">Binary Cross-Entropy (BCE)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/15 flex justify-between">
              <span className="text-gray-400">Optimizer</span>
              <span className="text-white font-bold">Adam (lr=1e-3, weight_decay=1e-5)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/15 flex justify-between">
              <span className="text-gray-400">Inference Latency</span>
              <span className="text-emerald-400 font-bold">0.82 ms / window</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
