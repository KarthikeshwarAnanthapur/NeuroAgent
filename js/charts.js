/**
 * js/charts.js — Chart.js Chart Managers
 * =======================================
 * All charts use real data from the data adapter.
 * Placeholder states are shown when data is unavailable.
 */

'use strict';

// ─────────────────────────────────────────────────────────
// CHART.JS GLOBAL DEFAULTS
// ─────────────────────────────────────────────────────────

Chart.defaults.color          = '#7a9a7a';
Chart.defaults.borderColor    = 'rgba(0,255,136,0.08)';
Chart.defaults.font.family    = '"JetBrains Mono", monospace';
Chart.defaults.font.size      = 10;
Chart.defaults.animation.duration = 400;

const GREEN  = '#00ff88';
const RED    = '#ff3333';
const AMBER  = '#ffaa00';
const DIM    = 'rgba(0,255,136,0.25)';

function hexA(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const BAND_LABELS  = ['Delta\n1-4Hz','Theta\n4-8Hz','Alpha\n8-13Hz','Beta\n13-30Hz','Gamma\n30-40Hz'];
const BAND_COLORS  = ['#4488ff','#aa44ff','#00ff88','#ff8800','#ff3344'];

// ─────────────────────────────────────────────────────────
// DONUT — Component Summary
// ─────────────────────────────────────────────────────────

function createDonutChart(canvasId, keep, remove, review) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [`Keep ${keep}`, `Remove ${remove}`, `Review ${review}`],
      datasets: [{
        data: [keep, remove, review],
        backgroundColor: [hexA(GREEN,0.85), hexA(RED,0.85), hexA(AMBER,0.85)],
        borderColor:     ['#00ff88','#ff3333','#ffaa00'],
        borderWidth: 1.5,
        hoverBorderWidth: 2.5,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}  (${((ctx.parsed/(keep+remove+review))*100).toFixed(1)}%)`,
          },
        },
      },
      layout: { padding: 4 },
    },
  });
}

// ─────────────────────────────────────────────────────────
// ICA BAND POWER BAR — per component
// ─────────────────────────────────────────────────────────

function createBandBarChart(canvasId, psdData) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const vals = [psdData.delta, psdData.theta, psdData.alpha, psdData.beta, psdData.gamma];

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Delta','Theta','Alpha','Beta','Gamma'],
      datasets: [{
        label: 'Relative Power',
        data:  vals,
        backgroundColor: BAND_COLORS.map(c => hexA(c,0.65)),
        borderColor:     BAND_COLORS,
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(0,255,136,0.05)' }, ticks: { font: { size: 9 } } },
        y: {
          grid: { color: 'rgba(0,255,136,0.05)' },
          ticks: { callback: v => (v*100).toFixed(0)+'%', font: { size: 9 } },
          min: 0, max: 0.6,
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// COMPARISON BAND CHART — quality report (before vs after)
// ─────────────────────────────────────────────────────────

function createSpectrumComparisonChart(canvasId, bands) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const labels    = ['Delta\n1–4Hz','Theta\n4–8Hz','Alpha\n8–13Hz','Beta\n13–30Hz','Gamma\n30–40Hz'];
  const origVals  = [bands.delta.orig, bands.theta.orig, bands.alpha.orig, bands.beta.orig, bands.gamma.orig];
  const cleanVals = [bands.delta.clean, bands.theta.clean, bands.alpha.clean, bands.beta.clean, bands.gamma.clean];

  // Normalise to max for display
  const maxV = Math.max(...origVals, ...cleanVals) || 1;
  const norm = v => v / maxV;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Original',
          data:  origVals.map(norm),
          backgroundColor: hexA(RED,0.6),
          borderColor:     RED,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: 'Clean',
          data:  cleanVals.map(norm),
          backgroundColor: hexA(GREEN,0.6),
          borderColor:     GREEN,
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: { color: '#8aaa8a', boxWidth: 12, font: { size: 10 } },
        },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${(c.raw*100).toFixed(1)}% of max`,
          },
        },
      },
      scales: {
        x: { grid: { color:'rgba(0,255,136,0.05)' }, ticks: { font:{size:9} } },
        y: {
          grid: { color:'rgba(0,255,136,0.05)' },
          ticks: { callback: v => (v*100).toFixed(0)+'%', font:{size:9} },
          min: 0,
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// EEG SIGNAL CHART  (real data or placeholder)
// ─────────────────────────────────────────────────────────

function createEEGLineChart(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  // data: { times:[], channels:[], data:[[],[]], unit }
  // Show first two channels as Original (red) and Clean overlay
  if (!data || !data.available) {
    return _createUnavailableChart(ctx, 'EEG TIME SERIES — Python API required for FIF data');
  }

  const datasets = data.channels.slice(0,8).map((ch, i) => ({
    label:           ch,
    data:            data.times.map((t,j) => ({ x: t, y: data.data[i][j] })),
    borderColor:     `hsl(${140+i*15},80%,55%)`,
    borderWidth:     0.8,
    pointRadius:     0,
    tension:         0,
  }));

  return new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: 'linear',
          title: { display:true, text:'Time (s)', color:'#5a7a5a', font:{size:10} },
          grid: { color:'rgba(0,255,136,0.05)' },
        },
        y: {
          title: { display:true, text:`Amplitude (${data.unit||'µV'})`, color:'#5a7a5a', font:{size:10} },
          grid: { color:'rgba(0,255,136,0.05)' },
        },
      },
    },
  });
}

// Before / After multi-channel split chart
function createMultiChannelChart(canvasId, data, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  if (!data || !data.available) {
    return _createUnavailableChart(ctx, 'Connect Python API');
  }

  const step   = Math.max(80, ...data.data.map(d => Math.max(...d.map(Math.abs)) || 1));
  const datasets = data.channels.slice(0,8).map((ch,i) => ({
    label:       ch,
    data:        data.times.map((t,j) => ({ x:t, y: data.data[i][j] + i*step })),
    borderColor: color,
    borderWidth: 0.7,
    pointRadius: 0,
    tension:     0,
  }));

  return new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      plugins: { legend: { display:false } },
      scales: {
        x: {
          type: 'linear',
          title: { display:true, text:'Time (s)', color:'#5a7a5a', font:{size:9} },
          grid: { color:'rgba(0,255,136,0.04)' },
        },
        y: {
          grid: { color:'rgba(0,255,136,0.04)' },
          ticks: { display:false },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// ICA WAVEFORM CHART
// ─────────────────────────────────────────────────────────

function createICAWaveformChart(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  if (!data || !data.available) {
    return _createUnavailableChart(ctx, 'Python API required');
  }

  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: data.component,
        data:  data.times.map((t,i) => ({ x:t, y:data.amplitude[i] })),
        borderColor:  GREEN,
        borderWidth:  1,
        pointRadius:  0,
        tension:      0,
        fill:         { target:'origin', above:hexA(GREEN,0.06), below:hexA(RED,0.06) },
      }],
    },
    options: {
      animation: false,
      plugins: { legend:{display:false} },
      scales: {
        x: {
          type:'linear',
          title:{ display:true, text:'Time (s)', color:'#5a7a5a', font:{size:9} },
          grid:{ color:'rgba(0,255,136,0.05)' },
        },
        y: {
          title:{ display:true, text:'Amplitude (AU)', color:'#5a7a5a', font:{size:9} },
          grid:{ color:'rgba(0,255,136,0.05)' },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// PSD LINE CHART  (per-component relative band powers as bars)
// ─────────────────────────────────────────────────────────

function createPSDChart(canvasId, psdData, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const vals  = [psdData.delta, psdData.theta, psdData.alpha, psdData.beta, psdData.gamma];
  const freqs = [2.5, 6, 10.5, 21.5, 35];   // band centres (Hz)

  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: label || 'PSD',
        data:  freqs.map((f,i) => ({ x:f, y:Math.log10(vals[i]*psdData.total+1e-14)*10 })),
        borderColor: GREEN,
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: GREEN,
        tension: 0.4,
        fill: { target:'origin', above:hexA(GREEN,0.1) },
      }],
    },
    options: {
      plugins: { legend:{display:false} },
      scales: {
        x: {
          type:'linear', min:0, max:40,
          title:{ display:true, text:'Frequency (Hz)', color:'#5a7a5a', font:{size:9} },
          grid:{ color:'rgba(0,255,136,0.05)' },
        },
        y: {
          title:{ display:true, text:'Power (dB)', color:'#5a7a5a', font:{size:9} },
          grid:{ color:'rgba(0,255,136,0.05)' },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// UNAVAILABLE PLACEHOLDER CHART
// ─────────────────────────────────────────────────────────

function _createUnavailableChart(ctx, msg) {
  return new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      plugins: {
        legend: { display:false },
        title: {
          display: true,
          text: ['⚠  DATA UNAVAILABLE', msg || ''],
          color: '#ffaa00',
          font: { size:11, family:'"JetBrains Mono",monospace' },
          padding: { top:30 },
        },
      },
      scales: {
        x: { display:false },
        y: { display:false },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────

window.Charts = {
  createDonutChart,
  createBandBarChart,
  createSpectrumComparisonChart,
  createEEGLineChart,
  createMultiChannelChart,
  createICAWaveformChart,
  createPSDChart,
};
