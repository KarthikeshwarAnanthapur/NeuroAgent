import React, { useRef, useEffect } from 'react';
import { useNeuro } from '../../context/NeuroContext';

interface TopomapProps {
  size?: number;
  showColorbar?: boolean;
}

export const ICATopomap: React.FC<TopomapProps> = ({ size = 160, showColorbar = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { topomapData, selectedComponent } = useNeuro();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.42;

    ctx.clearRect(0, 0, W, H);

    // Is it an ocular component like IC9 or IC1?
    const isOcular = selectedComponent?.component === 'IC9' ||
                     selectedComponent?.component === 'IC1' ||
                     selectedComponent?.component === 'IC2' ||
                     (selectedComponent?.iclabel_label && selectedComponent.iclabel_label.toLowerCase().includes('blink'));

    // ── INTERPOLATED SCALP HEATMAP ───────────────────────────
    ctx.save();
    // Clip to head circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Fill background deep blue
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bgGrad.addColorStop(0, '#023859');
    bgGrad.addColorStop(1, '#001a33');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (isOcular) {
      // Prominent ocular dipole in frontal region (top center)
      const ocularY = cy - radius * 0.55;
      const dipoleGrad = ctx.createRadialGradient(cx, ocularY, 2, cx, ocularY, radius * 0.75);
      dipoleGrad.addColorStop(0, 'rgba(255, 30, 60, 1.0)'); // Dark red peak
      dipoleGrad.addColorStop(0.25, 'rgba(255, 120, 0, 0.95)'); // Orange
      dipoleGrad.addColorStop(0.5, 'rgba(255, 230, 20, 0.85)'); // Yellow
      dipoleGrad.addColorStop(0.7, 'rgba(0, 230, 180, 0.5)'); // Cyan/green
      dipoleGrad.addColorStop(1.0, 'rgba(0, 50, 150, 0)'); // Fades to blue

      ctx.fillStyle = dipoleGrad;
      ctx.beginPath();
      ctx.arc(cx, ocularY, radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Occipital / Central brain rhythm heatmap (e.g. Alpha rhythm in posterior)
      const occipitalY = cy + radius * 0.4;
      const alphaGrad = ctx.createRadialGradient(cx, occipitalY, 2, cx, occipitalY, radius * 0.65);
      alphaGrad.addColorStop(0, 'rgba(255, 60, 60, 0.9)');
      alphaGrad.addColorStop(0.35, 'rgba(255, 180, 0, 0.75)');
      alphaGrad.addColorStop(0.65, 'rgba(0, 212, 255, 0.5)');
      alphaGrad.addColorStop(1, 'rgba(0, 40, 100, 0)');

      ctx.fillStyle = alphaGrad;
      ctx.beginPath();
      ctx.arc(cx, occipitalY, radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw individual electrode sample weights if available from topomapData
    if (topomapData?.channels && topomapData.channels.length > 0) {
      topomapData.channels.forEach(ch => {
        // Project to canvas coordinate
        const ex = cx + (ch.x / 10) * radius;
        const ey = cy - (ch.y / 10) * radius;

        // Draw tiny electrode dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();

    // ── HEAD CONTOUR (Outer border, Nose, Ears) ──────────────
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(0, 212, 255, 0.5)';
    ctx.shadowBlur = 6;

    // Head circle outline
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Nose (triangle at top)
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - radius);
    ctx.lineTo(cx, cy - radius - 10);
    ctx.lineTo(cx + 7, cy - radius);
    ctx.stroke();

    // Left Ear
    ctx.beginPath();
    ctx.arc(cx - radius - 2, cy, 7, -Math.PI / 2, Math.PI / 2, true);
    ctx.stroke();

    // Right Ear
    ctx.beginPath();
    ctx.arc(cx + radius + 2, cy, 7, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

  }, [topomapData, selectedComponent, size]);

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Topomap Canvas */}
      <div className="relative" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Colorbar scale */}
      {showColorbar && (
        <div className="flex flex-col items-center justify-between h-[120px] text-[9px] font-mono text-gray-400 pl-1">
          <span className="text-red-400 font-bold">100</span>
          <div
            className="w-2.5 h-[80px] rounded-full my-1 border border-cyan-500/20"
            style={{
              background: 'linear-gradient(to bottom, #ff1a3c, #ffaa00, #00f5a0, #00b4d8, #001f54)',
            }}
          />
          <span className="text-gray-400">0</span>
          <span className="text-blue-400 font-bold">-100</span>
        </div>
      )}
    </div>
  );
};
