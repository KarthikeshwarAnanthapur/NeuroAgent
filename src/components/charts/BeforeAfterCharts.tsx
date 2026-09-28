import React, { useRef, useEffect } from 'react';
import { useNeuro } from '../../context/NeuroContext';
import { Waves, Sparkles, BarChart2 } from 'lucide-react';

export const BeforeAfterCharts: React.FC = () => {
  const { comparisonData, selectedChannel } = useNeuro();

  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);
  const psdCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw Before Cleaning Waveform (Purple)
  useEffect(() => {
    const canvas = beforeCanvasRef.current;
    if (!canvas || !comparisonData?.times || !comparisonData?.before_eeg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 36;
    const pRight = 10;
    const pTop = 10;
    const pBottom = 22;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    // Y Axis ticks: 100, 50, 0, -50, -100
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    [-100, -50, 0, 50, 100].forEach(val => {
      const y = pTop + ((100 - val) / 200) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();
      ctx.fillText(`${val}`, pLeft - 4, y + 3);
    });

    // Zero baseline
    ctx.strokeStyle = 'rgba(176, 87, 245, 0.25)';
    const zeroY = pTop + 0.5 * plotH;
    ctx.beginPath();
    ctx.moveTo(pLeft, zeroY);
    ctx.lineTo(W - pRight, zeroY);
    ctx.stroke();

    // X Axis ticks: 0, 10, 20, 30, 40, 50, 60
    ctx.textAlign = 'center';
    for (let sec = 0; sec <= 60; sec += 10) {
      const x = pLeft + (sec / 60) * plotW;
      ctx.fillText(`${sec}`, x, H - 4);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(10, pTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude (µV)', 0, 0);
    ctx.restore();

    // X Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Time (s)', pLeft + plotW / 2, H - 4);

    // Plot Purple Waveform
    const data = comparisonData.before_eeg;
    ctx.strokeStyle = '#b057f5';
    ctx.lineWidth = 1.3;
    ctx.shadowColor = '#b057f5';
    ctx.shadowBlur = 4;

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pLeft + (i / (data.length - 1)) * plotW;
      const val = Math.max(-100, Math.min(100, data[i]));
      const y = pTop + ((100 - val) / 200) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [comparisonData]);

  // Draw After Cleaning Waveform (Mint / Cyan)
  useEffect(() => {
    const canvas = afterCanvasRef.current;
    if (!canvas || !comparisonData?.times || !comparisonData?.after_eeg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 36;
    const pRight = 10;
    const pTop = 10;
    const pBottom = 22;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    // Y Axis ticks
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    [-100, -50, 0, 50, 100].forEach(val => {
      const y = pTop + ((100 - val) / 200) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();
      ctx.fillText(`${val}`, pLeft - 4, y + 3);
    });

    // Zero baseline
    ctx.strokeStyle = 'rgba(0, 245, 160, 0.25)';
    const zeroY = pTop + 0.5 * plotH;
    ctx.beginPath();
    ctx.moveTo(pLeft, zeroY);
    ctx.lineTo(W - pRight, zeroY);
    ctx.stroke();

    // X Axis ticks: 0, 10, 20, 30, 40, 50, 60
    ctx.textAlign = 'center';
    for (let sec = 0; sec <= 60; sec += 10) {
      const x = pLeft + (sec / 60) * plotW;
      ctx.fillText(`${sec}`, x, H - 4);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(10, pTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude (µV)', 0, 0);
    ctx.restore();

    // X Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Time (s)', pLeft + plotW / 2, H - 4);

    // Plot Mint/Cyan Waveform
    const data = comparisonData.after_eeg;
    ctx.strokeStyle = '#00f5a0';
    ctx.lineWidth = 1.3;
    ctx.shadowColor = '#00f5a0';
    ctx.shadowBlur = 4;

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pLeft + (i / (data.length - 1)) * plotW;
      const val = Math.max(-100, Math.min(100, data[i]));
      const y = pTop + ((100 - val) / 200) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [comparisonData]);

  // Draw PSD Comparison Plot (Log Power vs Frequency)
  useEffect(() => {
    const canvas = psdCanvasRef.current;
    if (!canvas || !comparisonData?.psd_freqs) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 42;
    const pRight = 10;
    const pTop = 12;
    const pBottom = 22;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    // Log Y Axis: 10^-1 to 10^3 (range: -1 to 3 => 4 decades)
    const logMin = -1;
    const logMax = 3;

    ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    const decades = [
      { log: 3, label: '10³' },
      { log: 2, label: '10²' },
      { log: 1, label: '10¹' },
      { log: 0, label: '10⁰' },
      { log: -1, label: '10⁻¹' },
    ];

    decades.forEach(d => {
      const y = pTop + ((logMax - d.log) / (logMax - logMin)) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();
      ctx.fillText(d.label, pLeft - 4, y + 3);
    });

    // X Axis: 0, 10, 20, 30, 40, 50 Hz
    ctx.textAlign = 'center';
    for (let f = 0; f <= 50; f += 10) {
      const x = pLeft + (f / 50) * plotW;
      ctx.fillText(`${f}`, x, H - 4);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(10, pTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Power (µV²/Hz)', 0, 0);
    ctx.restore();

    // X Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Frequency (Hz)', pLeft + plotW / 2, H - 4);

    const freqs = comparisonData.psd_freqs;
    const rawP = comparisonData.psd_raw;
    const cleanP = comparisonData.psd_clean;

    // Helper for log Y coordinate
    const getLogY = (val: number) => {
      const logV = Math.log10(Math.max(0.1, val));
      const clamped = Math.max(logMin, Math.min(logMax, logV));
      return pTop + ((logMax - clamped) / (logMax - logMin)) * plotH;
    };

    // Plot Before Curve (Purple)
    ctx.strokeStyle = '#b057f5';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < freqs.length; i++) {
      const x = pLeft + (freqs[i] / 50) * plotW;
      const y = getLogY(rawP[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot After Curve (Cyan)
    ctx.strokeStyle = '#00f5a0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < freqs.length; i++) {
      const x = pLeft + (freqs[i] / 50) * plotW;
      const y = getLogY(cleanP[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [comparisonData]);

  return (
    <div className="grid grid-cols-3 gap-4 w-full select-none">
      {/* PANEL 1: Before Cleaning */}
      <div className="p-3.5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <Waves className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-bold text-gray-200">
              Before Cleaning <span className="text-gray-400 font-mono text-[11px] font-normal">(Selected Channel: {selectedChannel})</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium">
            <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
              Raw EEG
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/40 text-gray-400 border border-white/5">
              With Artifacts
            </span>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="w-full h-[125px]">
          <canvas
            ref={beforeCanvasRef}
            width={480 * 2}
            height={125 * 2}
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* PANEL 2: After Cleaning */}
      <div className="p-3.5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-gray-200">
              After Cleaning <span className="text-gray-400 font-mono text-[11px] font-normal">(Selected Channel: {selectedChannel})</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium">
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
              Cleaned EEG
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/40 text-gray-400 border border-white/5">
              Artifacts Removed
            </span>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="w-full h-[125px]">
          <canvas
            ref={afterCanvasRef}
            width={480 * 2}
            height={125 * 2}
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* PANEL 3: Power Spectral Density */}
      <div className="p-3.5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-gray-200">
              Power Spectral Density <span className="text-gray-400 font-mono text-[11px] font-normal">({selectedChannel})</span>
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-purple-400 rounded-full inline-block" />
              <span className="text-gray-300">Before Cleaning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 rounded-full inline-block" />
              <span className="text-gray-300">After Cleaning</span>
            </div>
          </div>
        </div>

        {/* PSD Canvas */}
        <div className="w-full h-[125px]">
          <canvas
            ref={psdCanvasRef}
            width={480 * 2}
            height={125 * 2}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};
