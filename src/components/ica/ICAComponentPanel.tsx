import React, { useState, useEffect, useRef } from 'react';
import { useNeuro } from '../../context/NeuroContext';
import { ICATopomap } from './ICATopomap';
import { fetchICAWaveform } from '../../api/analysisApi';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Trash2,
  CheckCircle,
  HelpCircle,
  Clock,
  Eye,
  PieChart,
  Radio,
} from 'lucide-react';

export const ICAComponentPanel: React.FC = () => {
  const {
    components,
    selectedComponent,
    selectedComponentId,
    setSelectedComponentId,
    nextComponent,
    prevComponent,
    setHumanDecision,
    subject,
    recording,
  } = useNeuro();

  const [activeTab, setActiveTab] = useState<'signal' | 'topomap' | 'psd' | 'features'>('signal');
  const [waveformData, setWaveformData] = useState<{ times: number[]; amplitude: number[] } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load component waveform
  useEffect(() => {
    let isCurrent = true;
    fetchICAWaveform(selectedComponentId, 250, subject, recording).then(data => {
      if (isCurrent && data) {
        setWaveformData({ times: data.times, amplitude: data.amplitude });
      }
    });
    return () => { isCurrent = false; };
  }, [selectedComponentId, subject, recording]);

  // Render Component Waveform onto Canvas
  useEffect(() => {
    if (activeTab !== 'signal' || !canvasRef.current || !waveformData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Padding
    const pLeft = 40;
    const pRight = 15;
    const pTop = 15;
    const pBottom = 25;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
    ctx.lineWidth = 1;

    // Y grid: -100, -50, 0, 50, 100
    const yTicks = [100, 50, 0, -50, -100];
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    yTicks.forEach(val => {
      const y = pTop + ((100 - val) / 200) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();
      ctx.fillText(`${val}`, pLeft - 6, y + 3);
    });

    // Zero line
    const zeroY = pTop + 0.5 * plotH;
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(pLeft, zeroY);
    ctx.lineTo(W - pRight, zeroY);
    ctx.stroke();

    // X grid & ticks: 0, 2, 4, 6, 8, 10
    ctx.textAlign = 'center';
    for (let sec = 0; sec <= 10; sec += 2) {
      const x = pLeft + (sec / 10) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, pTop);
      ctx.lineTo(x, H - pBottom);
      ctx.stroke();
      ctx.fillText(`${sec}`, x, H - pBottom + 14);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(12, pTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude (µV)', 0, 0);
    ctx.restore();

    // X Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('Time (s)', pLeft + plotW / 2, H - 4);

    // Draw component waveform line
    const amps = waveformData.amplitude;
    const n = amps.length;
    if (n < 2) return;

    // Color based on decision: REMOVE = red, KEEP = cyan/green, REVIEW = amber
    const dec = selectedComponent?.decision || 'REMOVE';
    const strokeColor = dec === 'REMOVE' ? '#ff3b5c' : (dec === 'REVIEW' ? '#f59e0b' : '#00f5a0');

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = pLeft + (i / (n - 1)) * plotW;
      // Clamp between -100 and +100
      const amp = Math.max(-100, Math.min(100, amps[i]));
      const y = pTop + ((100 - amp) / 200) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [waveformData, activeTab, selectedComponent]);

  if (!selectedComponent) return null;

  const currentDec = selectedComponent.decision;
  const isRemove = currentDec === 'REMOVE';
  const isKeep = currentDec === 'KEEP';
  const isReview = currentDec === 'REVIEW';

  const confidencePct = (selectedComponent.iclabel_confidence * 100).toFixed(1);

  return (
    <div className="h-full flex flex-col justify-between p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel select-none">
      {/* Top Bar: Title & Component Selector */}
      <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h2 className="text-xs font-bold font-mono tracking-widest text-cyan-300 uppercase">
            AI Component Analysis
          </h2>
        </div>

        {/* Component Selector Dropdown & Nav */}
        <div className="flex items-center gap-2">
          <select
            value={selectedComponentId}
            onChange={e => setSelectedComponentId(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-black/60 border border-cyan-500/30 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            {components.map(c => (
              <option key={c.component} value={c.component} className="bg-[#070e1b] text-white">
                Component {c.component}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-0.5">
            <button
              onClick={prevComponent}
              className="p-1 rounded bg-white/5 hover:bg-white/10 border border-cyan-500/20 text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Previous component"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={nextComponent}
              className="p-1 rounded bg-white/5 hover:bg-white/10 border border-cyan-500/20 text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Next component"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Component Header: ID + Decision Badge + Confidence */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold font-mono text-white tracking-wider flex items-center gap-1.5">
            <span className="text-cyan-400 font-normal">⚡</span>
            <span>{selectedComponent.component}</span>
          </div>

          {/* Decision Badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 uppercase tracking-wide transition-all ${
              isRemove
                ? 'bg-red-500/20 border border-red-500/60 text-red-400 shadow-glow-red'
                : isKeep
                ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 shadow-glow-green'
                : 'bg-amber-500/20 border border-amber-500/60 text-amber-400 shadow-glow-amber'
            }`}
          >
            <span>♦</span>
            <span>{currentDec}</span>
          </div>
        </div>

        {/* Confidence metric */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-gray-400">Confidence</span>
          <span className="text-base font-bold text-cyan-300 glow-cyan-text">
            {confidencePct}%
          </span>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 border-b border-cyan-500/15 pb-2">
        {(['signal', 'topomap', 'psd', 'features'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'signal'
              ? 'Component Signal'
              : tab === 'topomap'
              ? 'Topographic Map'
              : tab === 'psd'
              ? 'PSD'
              : 'Features'}
          </button>
        ))}
      </div>

      {/* Tab Visual Content Area */}
      <div className="flex-1 my-3 min-h-[175px] flex items-center justify-between gap-4">
        {activeTab === 'signal' && (
          <div className="w-full h-full flex items-center justify-between gap-3">
            {/* Waveform Chart Canvas */}
            <div className="flex-1 h-[175px] relative">
              <canvas
                ref={canvasRef}
                width={360 * 2}
                height={175 * 2}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Circular 2D Topographic map thumbnail on the right */}
            <div className="shrink-0 flex flex-col items-center">
              <ICATopomap size={140} showColorbar={true} />
            </div>
          </div>
        )}

        {activeTab === 'topomap' && (
          <div className="w-full h-full flex items-center justify-center gap-8 py-2">
            <ICATopomap size={180} showColorbar={true} />
            <div className="text-xs font-mono space-y-1.5 text-gray-300">
              <div className="font-bold text-cyan-300">Spatial Topography</div>
              <div className="text-[11px] text-gray-400">Frontal Dipole: Eye Blink / EOG</div>
              <div className="text-[11px] text-gray-400">Peak Voltage: +100 µV</div>
              <div className="text-[11px] text-gray-400">Troff Voltage: -48.8 µV</div>
              <div className="text-[11px] text-gray-400">Channels Mapped: 64 Channels</div>
            </div>
          </div>
        )}

        {activeTab === 'psd' && (
          <div className="w-full h-full flex flex-col justify-center px-4 space-y-3 font-mono text-xs">
            <div className="text-xs font-bold text-cyan-300">Frequency Band Breakdown</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded bg-black/40 border border-cyan-500/20">
                <div className="text-[10px] text-gray-400">Delta (1-4Hz)</div>
                <div className="text-red-400 font-bold">
                  {((selectedComponent.delta_relative || 0.85) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-cyan-500/20">
                <div className="text-[10px] text-gray-400">Theta (4-8Hz)</div>
                <div className="text-amber-400 font-bold">
                  {((selectedComponent.theta_relative || 0.10) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-cyan-500/20">
                <div className="text-[10px] text-gray-400">Alpha (8-13Hz)</div>
                <div className="text-cyan-400 font-bold">
                  {((selectedComponent.alpha_relative || 0.02) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-cyan-500/20">
                <div className="text-[10px] text-gray-400">Beta (13-30Hz)</div>
                <div className="text-blue-400 font-bold">
                  {((selectedComponent.beta_relative || 0.02) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-cyan-500/20">
                <div className="text-[10px] text-gray-400">Gamma (30-50Hz)</div>
                <div className="text-purple-400 font-bold">
                  {((selectedComponent.gamma_relative || 0.01) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="w-full h-full grid grid-cols-4 gap-2 font-mono text-xs items-center px-2">
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/20">
              <div className="text-[10px] text-gray-400">Kurtosis</div>
              <div className="font-bold text-white">12.45</div>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/20">
              <div className="text-[10px] text-gray-400">Peak-to-Peak</div>
              <div className="font-bold text-white">11.72 AU</div>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/20">
              <div className="text-[10px] text-gray-400">1D-CNN Score</div>
              <div className="font-bold text-red-400">0.965</div>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/20">
              <div className="text-[10px] text-gray-400">ALICE Score</div>
              <div className="font-bold text-amber-400">0.400</div>
            </div>
          </div>
        )}
      </div>

      {/* Component Information 4-Metric Grid */}
      <div className="grid grid-cols-4 gap-2 py-2.5 px-3 rounded-xl bg-black/30 border border-cyan-500/15 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isRemove ? 'bg-red-500 shadow-[0_0_8px_#ff3b5c]' : 'bg-emerald-500'
            }`}
          />
          <div>
            <div className="text-[9.5px] text-gray-400 uppercase">Signal Quality</div>
            <div className="font-bold text-white truncate">{selectedComponent.signal_quality || 'Artifacts Detected'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <div>
            <div className="text-[9.5px] text-gray-400 uppercase">Dominant Frequency</div>
            <div className="font-bold text-white">{selectedComponent.dominant_frequency || 1.2} Hz</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <div>
            <div className="text-[9.5px] text-gray-400 uppercase">Component Type</div>
            <div className="font-bold text-white truncate">{selectedComponent.iclabel_label || 'Eye Blink (EOG)'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PieChart className="w-3.5 h-3.5 text-cyan-400" />
          <div>
            <div className="text-[9.5px] text-gray-400 uppercase">Explained Variance</div>
            <div className="font-bold text-white">{selectedComponent.explained_variance || 2.41}%</div>
          </div>
        </div>
      </div>

      {/* AI Explanation Box */}
      <div className="mt-3 p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-2.5 text-xs">
        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-cyan-300 mr-1.5">AI Explanation:</span>
          <span className="text-gray-300 leading-relaxed font-sans text-[11.5px]">
            {selectedComponent.neuroagent_reason ||
              'This component shows strong low-frequency activity typical of eye blinks with frontal topography. High-amplitude slow waves are characteristic of ocular artifacts.'}
          </span>
        </div>
      </div>

      {/* Human Review Controls */}
      <div className="flex items-center gap-2.5 mt-3 pt-2 border-t border-cyan-500/15">
        <button
          onClick={() => setHumanDecision(selectedComponent.component, 'REMOVE')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            isRemove
              ? 'bg-red-500 text-white shadow-glow-red border border-red-400'
              : 'bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-500/30'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove Component</span>
        </button>

        <button
          onClick={() => setHumanDecision(selectedComponent.component, 'KEEP')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            isKeep
              ? 'bg-emerald-500 text-black shadow-glow-green border border-emerald-400'
              : 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Keep</span>
        </button>

        <button
          onClick={() => setHumanDecision(selectedComponent.component, 'REVIEW')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            isReview
              ? 'bg-amber-500 text-black shadow-glow-amber border border-amber-400'
              : 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 border border-amber-500/30'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Review</span>
        </button>
      </div>
    </div>
  );
};
