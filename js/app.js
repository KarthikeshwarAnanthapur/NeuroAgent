'use strict';
// ================================================================
// NEUROAGENT — COMPLETE SPA APPLICATION
// Hash-based routing · 13 functional pages · Real data binding
// ================================================================

// ────────────────────────────────────────────────────────────────
// GLOBAL STATE
// ────────────────────────────────────────────────────────────────
const AppState = {
  data: {
    session:    null,
    components: null,
    quality:    null,
  },
  selectedIC:     null,
  humanDecisions: {},
  apiAvailable:   false,
  currentPage:    'overview',
};

function loadHumanDecisions() {
  try { AppState.humanDecisions = JSON.parse(localStorage.getItem('na_decisions') || '{}'); }
  catch { AppState.humanDecisions = {}; }
}
function saveHumanDecisions() {
  localStorage.setItem('na_decisions', JSON.stringify(AppState.humanDecisions));
}

// ────────────────────────────────────────────────────────────────
// CHART REGISTRY  — prevents canvas memory leaks on navigation
// ────────────────────────────────────────────────────────────────
const CR = {
  _charts: {},
  make(id, cfg) {
    if (this._charts[id]) { try { this._charts[id].destroy(); } catch (_) {} }
    const el = document.getElementById(id);
    if (!el) return null;
    const chart = new Chart(el, cfg);
    this._charts[id] = chart;
    return chart;
  },
  destroyAll() {
    Object.values(this._charts).forEach(c => { try { c.destroy(); } catch (_) {} });
    this._charts = {};
  },
};

// ────────────────────────────────────────────────────────────────
// UTILITY
// ────────────────────────────────────────────────────────────────
const fmtPct = (v, d = 2) => (v != null && v !== '') ? (parseFloat(v) * 100).toFixed(d) + '%' : '—';
const fmtNum = (v, d = 4) => (v != null && v !== '') ? parseFloat(v).toFixed(d) : '—';
const fmtVal = v => (v != null && v !== '') ? v : '—';

function decClass(d) {
  if (!d) return 'review';
  const m = { KEEP: 'keep', REMOVE: 'remove', REVIEW: 'review' };
  return m[String(d).toUpperCase()] || 'review';
}

function labelDisplay(raw) {
  if (!raw) return 'Unknown';
  const map = {
    'brain': 'Brain', 'eye blink': 'Eye Blink', 'muscle artifact': 'Muscle Artifact',
    'channel noise': 'Channel Noise', 'heart beat': 'Heart Beat',
    'line noise': 'Line Noise', 'other': 'Other',
  };
  return map[String(raw).toLowerCase()] || raw;
}

function getSelectedComp() {
  if (!AppState.selectedIC || !AppState.data.components) return null;
  return AppState.data.components.find(c => c.id === AppState.selectedIC) || null;
}

// ────────────────────────────────────────────────────────────────
// CHART HELPERS
// ────────────────────────────────────────────────────────────────
const G = '#10B981'; // Emerald — brain / keep / clean
const R = '#F59E0B'; // Amber   — artifact / before
const A = '#8B5CF6'; // Violet  — AI / review
const CY= '#00D4FF'; // Cyan    — primary accent
const TL= '#00C4AC'; // Teal    — secondary

const ga = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const GRID_COLOR = 'rgba(0,212,255,0.05)';
const TICK_STYLE = { color: '#4A7A9B', font: { size: 9, family: 'JetBrains Mono' } };
const BASE_OPTS  = {
  responsive: true, maintainAspectRatio: false,
  animation:  { duration: 400 },
  plugins:    { legend: { display: false } },
};

function makeAxis(label) {
  return {
    grid: { color: GRID_COLOR },
    ticks: { ...TICK_STYLE, maxTicksLimit: 6 },
    title: label ? { display: true, text: label, color: '#4A7A9B', font: { size: 9 } } : {},
  };
}

function chartBands(id, psd) {
  if (!psd) return;
  CR.make(id, {
    type: 'bar',
    data: {
      labels: ['δ Delta\n1–4 Hz', 'θ Theta\n4–8 Hz', 'α Alpha\n8–13 Hz', 'β Beta\n13–30 Hz', 'γ Gamma\n30–40 Hz'],
      datasets: [{
        data: [psd.delta, psd.theta, psd.alpha, psd.beta, psd.gamma],
        backgroundColor: [ga('#3B82F6',0.65), ga('#8B5CF6',0.65), ga(G,0.65), ga(CY,0.65), ga(R,0.65)],
        borderColor:     ['#3B82F6', '#8B5CF6', G, CY, R],
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { ...makeAxis(''), ticks: { ...TICK_STYLE, maxTicksLimit: 10 } },
        y: { ...makeAxis('Power'), min: 0, ticks: { ...TICK_STYLE, callback: v => (v * 100).toFixed(0) + '%' } },
      },
    },
  });
}

function chartSpectrum(id, bands) {
  if (!bands) return;
  const labels = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'];
  const orig  = [bands.delta?.orig  || 0, bands.theta?.orig  || 0, bands.alpha?.orig  || 0, bands.beta?.orig  || 0, bands.gamma?.orig  || 0];
  const clean = [bands.delta?.clean || 0, bands.theta?.clean || 0, bands.alpha?.clean || 0, bands.beta?.clean || 0, bands.gamma?.clean || 0];
  const maxV  = Math.max(...orig, ...clean, 1);
  CR.make(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Original', data: orig.map(v => v / maxV),  backgroundColor: ga(R, 0.55), borderColor: R, borderWidth: 1, borderRadius: 4 },
        { label: 'Clean',    data: clean.map(v => v / maxV), backgroundColor: ga(G, 0.55), borderColor: G, borderWidth: 1, borderRadius: 4 },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        legend: { display: true, labels: { color: '#4A7A9B', boxWidth: 10, font: { size: 9 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${(c.raw * 100).toFixed(1)}%` } },
      },
      scales: {
        x: makeAxis(''),
        y: { ...makeAxis('Relative Power'), min: 0, ticks: { ...TICK_STYLE, callback: v => (v * 100).toFixed(0) + '%' } },
      },
    },
  });
}

async function chartEEGWaveform(id, fileType, icId, channelStr) {
  // Show loading state
  const wrap = document.getElementById(id + '_wrap');
  const loadEl = document.getElementById('eeg-loading');
  if (loadEl) loadEl.style.display = 'flex';

  const data = await DataAdapter.getEEGSamples(fileType, icId || 'IC1', 900, channelStr || '0,1,2,3,4,5,6,7');

  if (loadEl) loadEl.style.display = 'none';

  if (!data || !data.available) {
    if (wrap) {
      wrap.innerHTML = unavailableHTML(id, fileType, icId, channelStr);
    }
    updateAPIStatus(false);
    return false;
  }

  updateAPIStatus(true);
  const colors = [CY, G, '#3B82F6', A, TL, '#F472B6', '#60A5FA', '#34D399'];
  CR.make(id, {
    type: 'line',
    data: {
      datasets: data.channels.slice(0, 8).map((ch, i) => ({
        label:       ch,
        data:        data.times.map((t, j) => ({ x: t, y: data.data[i][j] })),
        borderColor: colors[i % colors.length],
        borderWidth: 0.85, pointRadius: 0, tension: 0,
      })),
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        legend:  { display: true, position: 'top', labels: { color: '#4A7A9B', boxWidth: 10, font: { size: 9 } } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { type: 'linear', ...makeAxis('Time (s)') },
        y: { ...makeAxis(`Amplitude (${data.unit || 'µV'})`) },
      },
    },
  });
  return true;
}

function unavailableHTML(id, fileType, icId, channelStr) {
  return `
    <div class="data-unavailable full">
      <div class="ua-icon">○</div>
      <div class="ua-title">EEG DATA</div>
      <div class="ua-status">Python API unavailable</div>
      <div class="ua-hint">The server is running but <code>api_helper.py</code> needs MNE-Python to stream .fif data.</div>
      <button class="ua-retry" onclick="chartEEGWaveform('${id}','${fileType}','${icId}','${channelStr}')">Retry Connection</button>
    </div>`;
}

async function chartMultiChannel(id, fileType, icId, color) {
  const wrap = document.getElementById(id + '_wrap');
  const data = await DataAdapter.getEEGSamples(fileType, icId || 'IC1', 500, '0,1,2,3,4,5,6,7');
  if (!data || !data.available) {
    if (wrap) wrap.innerHTML = `<div class="data-unavailable compact"><span class="ua-dot offline"></span>Python API unavailable — FIF streaming requires MNE-Python</div>`;
    return;
  }
  const step = Math.max(60, ...data.data.map(d => Math.max(...d.map(Math.abs)) || 1));
  CR.make(id, {
    type: 'line',
    data: {
      datasets: data.channels.slice(0, 8).map((ch, i) => ({
        label: ch, pointRadius: 0, borderWidth: 0.8, tension: 0, borderColor: color,
        data: data.times.map((t, j) => ({ x: t, y: data.data[i][j] + i * step })),
      })),
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { type: 'linear', ...makeAxis('Time (s)') },
        y: { display: false },
      },
    },
  });
}

async function chartComponentWave(id, icId) {
  const wrap = document.getElementById(id + '_wrap') || document.getElementById(id)?.parentElement;
  const data = await DataAdapter.getEEGSamples('ica', icId, 500, '0');
  if (!data || !data.available) {
    if (wrap) wrap.innerHTML = `<div class="data-unavailable compact"><span class="ua-dot offline"></span>Waveform unavailable — Python API required</div>`;
    return;
  }
  CR.make(id, {
    type: 'line',
    data: {
      datasets: [{
        data:        data.times.map((t, i) => ({ x: t, y: data.amplitude ? data.amplitude[i] : (data.data?.[0]?.[i] || 0) })),
        borderColor: CY, borderWidth: 1, pointRadius: 0, tension: 0,
        fill:        { target: 'origin', above: ga(CY, 0.07), below: ga(A, 0.05) },
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { type: 'linear', ...makeAxis('Time (s)') },
        y: { ...makeAxis('Amplitude') },
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────
// STATUS UPDATES
// ────────────────────────────────────────────────────────────────
function updateAPIStatus(ok) {
  AppState.apiAvailable = ok;
  const el = document.getElementById('api-status');
  if (!el) return;
  el.className = ok ? 'api-status online' : 'api-status offline';
  el.title     = ok ? 'Python API Connected — FIF streaming active' : 'Python API offline — CSV data available';
  el.innerHTML = `<span class="api-dot"></span><span class="api-label">${ok ? 'API ●' : 'API'}</span>`;
}

function updateSidebarStatus(session) {
  const set = (id, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `ss-item ${ok ? 'online' : ''}`;
    el.querySelector('.ss-dot').style.background = ok ? 'var(--green)' : ok === false ? 'var(--red)' : 'var(--text-muted)';
  };
  set('st-backend', true);
  set('st-eeg',     !!session);
  set('st-models',  !!AppState.data.components?.length);
  set('st-api',     AppState.apiAvailable);
}

// ────────────────────────────────────────────────────────────────
// TOAST
// ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 2800);
}

// ────────────────────────────────────────────────────────────────
// PIPELINE BAR RENDERER
// ────────────────────────────────────────────────────────────────
function renderPipeline(activeN = 8, files = {}) {
  const stages = [
    { n: 1,  label: 'RAW EEG',      file: null },
    { n: 2,  label: 'PREPROCESS',   file: 'S002R01_preprocessed_raw.fif' },
    { n: 3,  label: 'ICA',          file: 'S002R01_ica.fif' },
    { n: 4,  label: 'ICLabel',      file: 'S002R01_iclabel.csv' },
    { n: 5,  label: 'PSD',          file: 'S002R01_psd.csv' },
    { n: 6,  label: 'ALICE',        file: 'S002R01_alice.csv' },
    { n: 7,  label: 'FUSION',       file: 'S002R01_fusion.csv' },
    { n: 8,  label: 'NEUROAGENT',   file: 'S002R01_neuroagent.csv' },
    { n: 9,  label: 'HUMAN REVIEW', file: null },
    { n: 10, label: 'RECONSTRUCT',  file: 'S002R01_reconstructed_raw.fif' },
    { n: 11, label: 'QUALITY CHK',  file: 'S002R01_quality_report.csv' },
    { n: 12, label: 'CLEAN EEG',    file: null },
  ];
  return `<div class="pipeline-bar">` + stages.map((s, i) => {
    let cls  = 'pending', icon = `<span style="font-size:.52rem;color:var(--text-muted)">${String(s.n).padStart(2,'0')}</span>`;
    if (s.n < activeN) {
      const ok = !s.file || files[s.file] !== false;
      cls  = ok ? 'done' : 'error';
      icon = ok ? '✓' : '✗';
    } else if (s.n === activeN) {
      cls  = 'active'; icon = '●';
    }
    return `<div class="pipe-step ${cls}" title="${s.label}">
      <span class="pipe-icon">${icon}</span>
      <span class="pipe-label">${s.label}</span>
    </div>${i < stages.length - 1 ? '<div class="pipe-arrow">›</div>' : ''}`;
  }).join('') + `</div>`;
}

// ────────────────────────────────────────────────────────────────
// SHARED RENDERERS
// ────────────────────────────────────────────────────────────────
function badge(d, small = false) {
  const cls = decClass(d);
  return `<span class="badge badge-${cls}${small ? ' badge-sm' : ''}">${d || 'REVIEW'}</span>`;
}

function evBar(label, val) {
  const pct = Math.min(100, (val || 0) * 100);
  const cls  = pct > 60 ? 'bar-high' : pct > 35 ? 'bar-mid' : 'bar-low';
  return `<div class="ev-row">
    <span class="ev-lbl">${label}</span>
    <div class="ev-track"><div class="ev-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div>
    <span class="ev-val">${(val || 0).toFixed(2)}</span>
  </div>`;
}

function sessionCard(s) {
  if (!s) return `<div class="info-card"><div class="info-card-title">SESSION</div><div class="empty-state">Loading…</div></div>`;
  return `<div class="info-card">
    <div class="info-card-title">SESSION</div>
    <div class="info-list">
      <div class="info-row"><span>Session ID</span><code>${s.sessionId}</code></div>
      <div class="info-row"><span>Recording</span><code>${s.recording}</code></div>
      <div class="info-row"><span>Channels</span><code>${s.channels}</code></div>
      <div class="info-row"><span>Sample Rate</span><code>${s.samplingRate} Hz</code></div>
      <div class="info-row"><span>Duration</span><code>${s.duration} s</code></div>
      <div class="info-row"><span>ICA Components</span><code>${s.icaComponents}</code></div>
    </div>
  </div>`;
}

function decisionTrioCards(q, comps) {
  if (!comps || !comps.length) return `<div class="empty-state">No component data available.</div>`;

  const kept    = comps.filter(c => c.naDecision === 'KEEP');
  const removed = comps.filter(c => c.naDecision === 'REMOVE');
  const review  = comps.filter(c => c.naDecision === 'REVIEW');

  // Component ID chip — clicking sets selected IC and navigates to ICA
  const chip = (c, cls) =>
    `<button class="dec-chip dec-chip--${cls}" onclick="AppState.selectedIC='${c.id}';navigate('ica')" title="${labelDisplay(c.iclabelLabel)} | Confidence: ${fmtPct(c.confidence)}">${c.id}</button>`;

  // Compact scrollable chip grid (for KEEP / REVIEW)
  const chipGrid = (list, cls, limit = 40) =>
    `<div class="dec-chip-grid">${list.slice(0, limit).map(c => chip(c, cls)).join('')}${list.length > limit ? `<span class="dec-chip-more">+${list.length - limit} more</span>` : ''}</div>`;

  // Mini detail card for each REMOVE component
  const removeDetailCard = c =>
    `<div class="dec-remove-card" onclick="AppState.selectedIC='${c.id}';navigate('ica')" title="Open in ICA Explorer">
      <div class="dec-rc-head">
        <code class="dec-rc-id">${c.id}</code>
        <span class="dec-rc-label">${labelDisplay(c.iclabelLabel)}</span>
      </div>
      <div class="dec-rc-scores">
        <div class="dec-rc-score">
          <span class="dec-rc-sk">CONFIDENCE</span>
          <span class="dec-rc-sv">${fmtPct(c.confidence)}</span>
        </div>
        <div class="dec-rc-score">
          <span class="dec-rc-sk">ARTIFACT</span>
          <span class="dec-rc-sv warn">${c.artifactScore.toFixed(3)}</span>
        </div>
        <div class="dec-rc-score">
          <span class="dec-rc-sk">BRAIN</span>
          <span class="dec-rc-sv good">${c.brainScore.toFixed(3)}</span>
        </div>
      </div>
      <div class="dec-rc-reason">${c.reason || 'Artifact detected by NeuroAgent'}</div>
      <div class="dec-rc-open">↗ Open in ICA Explorer</div>
    </div>`;

  // KEEP card
  const keepCard = `
    <div class="dec-card dec-card--keep">
      <div class="dec-card__header">
        <span class="dec-card__dot dec-card__dot--keep"></span>
        <span class="dec-card__title">KEEP</span>
      </div>
      <div class="dec-card__count">${kept.length}</div>
      <div class="dec-card__subtitle">COMPONENTS TO KEEP</div>
      <div class="dec-card__divider"></div>
      <div class="dec-card__body dec-card__body--scroll">
        ${kept.length ? chipGrid(kept, 'keep') : '<span class="dec-empty">No components</span>'}
      </div>
      <button class="dec-card__footer-btn" onclick="navigate('ica');setTimeout(()=>document.querySelector('.filter-btn[data-filter=keep]')?.click(),100)">
        VIEW ALL ${kept.length} IN ICA EXPLORER
      </button>
    </div>`;

  // REMOVE card (most prominent — amber glow)
  const removeCard = `
    <div class="dec-card dec-card--remove">
      <div class="dec-card__header">
        <span class="dec-card__dot dec-card__dot--remove"></span>
        <span class="dec-card__title">REMOVE</span>
      </div>
      <div class="dec-card__count dec-card__count--remove">${removed.length}</div>
      <div class="dec-card__subtitle dec-card__subtitle--remove">COMPONENTS TO REMOVE</div>
      <div class="dec-card__divider dec-card__divider--remove"></div>
      <div class="dec-card__body dec-card__body--remove">
        ${removed.length
          ? removed.map(removeDetailCard).join('')
          : '<div class="dec-empty dec-empty--good">✓ No artifacts flagged for removal</div>'}
      </div>
      ${removed.length ? `<button class="dec-card__footer-btn dec-card__footer-btn--remove" onclick="navigate('reconstruction')">VIEW RECONSTRUCTION →</button>` : ''}
    </div>`;

  // REVIEW card
  const reviewCard = `
    <div class="dec-card dec-card--review">
      <div class="dec-card__header">
        <span class="dec-card__dot dec-card__dot--review"></span>
        <span class="dec-card__title">REVIEW</span>
      </div>
      <div class="dec-card__count">${review.length}</div>
      <div class="dec-card__subtitle">COMPONENTS FOR REVIEW</div>
      <div class="dec-card__divider"></div>
      <div class="dec-card__body dec-card__body--scroll">
        ${review.length ? chipGrid(review, 'review') : '<span class="dec-empty">No components for review</span>'}
      </div>
      <button class="dec-card__footer-btn" onclick="navigate('human-review')">
        OPEN HUMAN REVIEW →
      </button>
    </div>`;

  return `<div class="decision-trio">${keepCard}${removeCard}${reviewCard}</div>`;
}

function qualityCard(q) {
  const isGood = (q?.overallQuality || '').toUpperCase() === 'GOOD';
  return `<div class="info-card quality-card">
    <div class="info-card-title">QUALITY STATUS</div>
    <div class="quality-status-display">
      <div class="qs-badge ${isGood ? 'good' : 'warn'}">${q?.overallQuality || '—'}</div>
      <div class="qs-details">
        <div>Removed: <strong>${q?.componentsRemoved ?? '—'}</strong> components</div>
        <div>Kept: <strong>${q?.componentsKept ?? '—'}</strong> components</div>
      </div>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────
// COMPONENT TABLE
// ────────────────────────────────────────────────────────────────
let _sortKey = 'id', _sortDir = 1;

function compRow(c) {
  const dec   = c.naDecision || c.decision;
  const human = AppState.humanDecisions[c.id]?.decision;
  const sel   = c.id === AppState.selectedIC ? 'row-selected' : '';
  return `<tr class="comp-row ${decClass(dec)} ${sel}" data-ic="${c.id}" tabindex="0">
    <td><code class="ic-code">${c.id}</code></td>
    <td>${labelDisplay(c.iclabelLabel)}</td>
    <td>${fmtPct(c.confidence)}</td>
    <td class="${c.artifactScore > 0.5 ? 'val-warn' : ''}"><span class="mono">${c.artifactScore.toFixed(3)}</span></td>
    <td class="${c.brainScore > 0.5 ? 'val-good' : ''}"><span class="mono">${c.brainScore.toFixed(3)}</span></td>
    <td>${badge(dec, true)}</td>
    <td>${human ? `<span class="human-override ${decClass(human)}">H:${human}</span>` : '<span class="no-human">—</span>'}</td>
  </tr>`;
}

function compTable(comps, extraTbodyId = 'comp-table-body') {
  if (!comps) return `<div class="empty-state">No component data available.</div>`;
  return `<div class="comp-table-wrap panel">
    <div class="table-toolbar panel-header">
      <div class="table-search">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="comp-search" class="table-search-input" placeholder="Search…" type="text">
      </div>
      <div class="table-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="keep">KEEP</button>
        <button class="filter-btn" data-filter="remove">REMOVE</button>
        <button class="filter-btn" data-filter="review">REVIEW</button>
      </div>
      <span class="table-count" id="table-count">${comps.length} components</span>
    </div>
    <div class="table-scroll">
      <table class="comp-table">
        <thead>
          <tr>
            <th data-sort="id">IC <span class="sort-icon">↕</span></th>
            <th data-sort="iclabelLabel">ICLabel <span class="sort-icon">↕</span></th>
            <th data-sort="confidence">Confidence <span class="sort-icon">↕</span></th>
            <th data-sort="artifactScore">Artifact Score <span class="sort-icon">↕</span></th>
            <th data-sort="brainScore">Brain Score <span class="sort-icon">↕</span></th>
            <th data-sort="naDecision">Decision <span class="sort-icon">↕</span></th>
            <th>Human</th>
          </tr>
        </thead>
        <tbody id="${extraTbodyId}">${comps.map(compRow).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

function initTable(onSelect) {
  const tbody = document.getElementById('comp-table-body');
  if (!tbody) return;

  // Row click
  const handleRowClick = row => {
    AppState.selectedIC = row.dataset.ic;
    tbody.querySelectorAll('.comp-row').forEach(r => r.classList.remove('row-selected'));
    row.classList.add('row-selected');
    onSelect?.(AppState.selectedIC);
  };

  tbody.addEventListener('click', e => {
    const row = e.target.closest('.comp-row');
    if (row) handleRowClick(row);
  });
  tbody.addEventListener('keydown', e => {
    const row = e.target.closest('.comp-row');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleRowClick(row); }
  });

  // Search
  document.getElementById('comp-search')?.addEventListener('input', e => filterTable(e.target.value, getDecFilter()));

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTable(document.getElementById('comp-search')?.value || '', btn.dataset.filter);
    });
  });

  // Sort columns
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => sortTable(th.dataset.sort, onSelect));
  });
}

function getDecFilter() {
  return document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
}

function filterTable(search, decFilter) {
  const comps = AppState.data.components || [];
  const s     = search.toLowerCase().trim();
  const filtered = comps.filter(c => {
    const dec = (c.naDecision || c.decision || '').toLowerCase();
    const matchD = !decFilter || decFilter === 'all' || dec === decFilter;
    const matchS = !s || c.id.toLowerCase().includes(s) || labelDisplay(c.iclabelLabel).toLowerCase().includes(s);
    return matchD && matchS;
  });
  const tbody = document.getElementById('comp-table-body');
  if (tbody) tbody.innerHTML = filtered.map(compRow).join('');
  const cnt = document.getElementById('table-count');
  if (cnt) cnt.textContent = `${filtered.length} components`;
}

function sortTable(key, onSelect) {
  if (_sortKey === key) _sortDir *= -1;
  else { _sortKey = key; _sortDir = 1; }
  const sorted = [...(AppState.data.components || [])].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'id') { av = parseInt(av.replace('IC', '')); bv = parseInt(bv.replace('IC', '')); }
    if (typeof av === 'string') return _sortDir * av.localeCompare(bv);
    return _sortDir * (av - bv);
  });
  const tbody = document.getElementById('comp-table-body');
  if (tbody) {
    tbody.innerHTML = sorted.map(compRow).join('');
    initTable(onSelect);
  }
}

// ────────────────────────────────────────────────────────────────
// COMPONENT EXPLORER
// ────────────────────────────────────────────────────────────────
function explorerHTML(icId) {
  const comp = AppState.data.components?.find(c => c.id === icId);
  if (!comp) return `<div class="explorer-empty"><p>Select a component from the table to inspect its details.</p></div>`;

  const dec    = AppState.humanDecisions[icId]?.decision || comp.naDecision;
  const comment = AppState.humanDecisions[icId]?.comment || '';

  return `<div class="explorer-content" id="explorer-content">
    <div class="explorer-header">
      <div>
        <span class="explorer-id">${comp.id}</span>
        <span class="explorer-label">${labelDisplay(comp.iclabelLabel)}</span>
      </div>
      ${badge(dec)}
    </div>

    <div class="explorer-scores">
      <div class="score-pair"><span class="score-lbl">Confidence</span><span class="score-val">${fmtPct(comp.confidence)}</span></div>
      <div class="score-pair"><span class="score-lbl">Artifact Score</span><span class="score-val ${comp.artifactScore > 0.5 ? 'val-warn' : ''}">${comp.artifactScore.toFixed(4)}</span></div>
      <div class="score-pair"><span class="score-lbl">Brain Score</span><span class="score-val ${comp.brainScore > 0.5 ? 'val-good' : ''}">${comp.brainScore.toFixed(4)}</span></div>
    </div>

    <div class="ev-section">
      <div class="section-label">EVIDENCE</div>
      ${evBar('ICLabel', comp.iclabelArtScore)}
      ${evBar('PSD',     comp.psdArtScore)}
      ${evBar('ALICE',   comp.aliceArtScore)}
      ${evBar('Fusion',  comp.fusionScore)}
    </div>

    ${comp.reason ? `<div class="reason-box">${comp.reason}</div>` : ''}

    <div class="band-section">
      <div class="section-label">FREQUENCY BANDS</div>
      <canvas id="explorer-band" height="85"></canvas>
    </div>

    <div class="waveform-section">
      <div class="section-label">COMPONENT WAVEFORM</div>
      <div id="explorer-wave_wrap"><canvas id="explorer-wave" height="75"></canvas></div>
    </div>

    <div class="human-decision-section">
      <div class="section-label">HUMAN DECISION</div>
      <div class="human-btns">
        <button class="hbtn keep   ${dec === 'KEEP'   ? 'active' : ''}" data-d="KEEP">✓ KEEP</button>
        <button class="hbtn remove ${dec === 'REMOVE' ? 'active' : ''}" data-d="REMOVE">✗ REMOVE</button>
        <button class="hbtn review ${dec === 'REVIEW' ? 'active' : ''}" data-d="REVIEW">? REVIEW</button>
      </div>
      <textarea id="ex-comment" class="human-comment" rows="2" placeholder="Optional comment…">${comment}</textarea>
      <button class="save-btn" id="ex-save">SAVE DECISION</button>
    </div>
  </div>`;
}

function initExplorer(icId) {
  const el = document.getElementById('explorer-panel');
  if (!el) return;
  el.innerHTML = explorerHTML(icId);

  const comp = AppState.data.components?.find(c => c.id === icId);
  if (comp) {
    setTimeout(() => {
      chartBands('explorer-band', comp.psd);
      chartComponentWave('explorer-wave', icId);
    }, 50);
  }

  el.querySelectorAll('.hbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.d;
      if (!AppState.humanDecisions[icId]) AppState.humanDecisions[icId] = {};
      AppState.humanDecisions[icId].decision = d;
      el.querySelectorAll('.hbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`${icId}: ${d}`, d === 'KEEP' ? 'success' : d === 'REMOVE' ? 'error' : 'warn');
      const b = el.querySelector('.badge');
      if (b) { b.className = `badge badge-${decClass(d)}`; b.textContent = d; }
    });
  });

  el.querySelector('#ex-save')?.addEventListener('click', () => {
    const comment = el.querySelector('#ex-comment')?.value || '';
    const h = AppState.humanDecisions[icId];
    if (!h?.decision) { showToast('Select a decision first', 'warn'); return; }
    h.comment = comment;
    saveHumanDecisions();
    showToast(`Saved: ${icId} → ${h.decision}`, 'success');
    const row = document.querySelector(`.comp-row[data-ic="${icId}"] td:last-child`);
    if (row) row.innerHTML = `<span class="human-override ${decClass(h.decision)}">H:${h.decision}</span>`;
  });
}

// ────────────────────────────────────────────────────────────────
// PAGE RENDERERS  (one function per route)
// ────────────────────────────────────────────────────────────────

// ── OVERVIEW ──────────────────────────────────────────────────
function pgOverview() {
  const s     = AppState.data.session;
  const q     = AppState.data.quality;
  const comps = AppState.data.components;
  const files = s?.files || {};
  const comp  = getSelectedComp() || comps?.[0];
  const selOpts = (comps || []).map(c =>
    `<option value="${c.id}" ${c.id === AppState.selectedIC ? 'selected' : ''}>${c.id} — ${labelDisplay(c.iclabelLabel)}</option>`
  ).join('');

  // Frequency band mini-cards
  const bandDefs = [
    { key: 'delta', symbol: 'δ', name: 'DELTA', range: '1–4 Hz',   cls: 'band-delta' },
    { key: 'theta', symbol: 'θ', name: 'THETA', range: '4–8 Hz',   cls: 'band-theta' },
    { key: 'alpha', symbol: 'α', name: 'ALPHA', range: '8–13 Hz',  cls: 'band-alpha' },
    { key: 'beta',  symbol: 'β', name: 'BETA',  range: '13–30 Hz', cls: 'band-beta'  },
    { key: 'gamma', symbol: 'γ', name: 'GAMMA', range: '30–40 Hz', cls: 'band-gamma' },
  ];
  const bandCards = comp ? `<div class="band-cards">` + bandDefs.map(b => {
    const val = comp.psd?.[b.key] || 0;
    const pct = Math.round(val * 100);
    return `<div class="band-card ${b.cls}">
      <div class="band-card__greek">${b.symbol}</div>
      <div class="band-card__name">${b.name}</div>
      <div class="band-card__range">${b.range}</div>
      <div class="band-card__bar-wrap"><div class="band-card__bar" style="width:${Math.min(100,pct)}%"></div></div>
      <div class="band-card__val">${pct || '—'}${pct ? '%' : ''}</div>
    </div>`;
  }).join('') + `</div>` : '';

  return `<div class="page">

    ${renderPipeline(8, files)}

    <div class="top-info-row top-info-row--2col">
      ${sessionCard(s)}
      ${qualityCard(q)}
    </div>

    ${decisionTrioCards(q, comps)}

    <div class="panel eeg-main-panel">
      <div class="panel-header">
        EEG SIGNAL VIEWER
        <div class="eeg-controls">
          <div class="tab-group">
            <button class="tab active" data-ft="preprocessed">PREPROCESSED</button>
            <button class="tab" data-ft="ica">ICA COMPONENT</button>
            <button class="tab" data-ft="reconstructed">CLEAN</button>
          </div>
          <select id="eeg-ic-sel" class="ctrl-sel">${selOpts}</select>
        </div>
        <div id="api-status" class="api-status offline"><span class="api-dot"></span><span class="api-label">API</span></div>
      </div>
      <div class="eeg-chart-outer" id="eeg-signal_wrap" style="position:relative; min-height:200px;">
        <div class="chart-loading-state" id="eeg-loading" style="display:flex;">
          <div class="spinner"></div><span>Loading EEG data…</span>
        </div>
        <canvas id="eeg-signal" height="200"></canvas>
      </div>
    </div>

    ${bandCards}

    <div class="bottom-row">
      <div class="panel before-after-panel">
        <div class="panel-header">BEFORE / AFTER ARTIFACT REMOVAL</div>
        <div class="ba-split">
          <div class="ba-col"><div class="ba-lbl red">Before — Preprocessed</div>
            <div id="before-chart_wrap"><canvas id="before-chart" height="120"></canvas></div>
          </div>
          <div class="ba-sep"></div>
          <div class="ba-col"><div class="ba-lbl green">After — Reconstructed</div>
            <div id="after-chart_wrap"><canvas id="after-chart" height="120"></canvas></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">FREQUENCY SPECTRUM</div>
        <div class="chart-legend-row" style="padding-top:6px;">
          <span class="leg-dot red"></span>Original &nbsp;
          <span class="leg-dot green"></span>Clean
        </div>
        <div style="padding:6px 12px 12px;"><canvas id="spectrum-mini" height="150"></canvas></div>
      </div>
    </div>

  </div>`;
}

async function pgOverviewInit() {
  // EEG tabs
  document.querySelectorAll('.eeg-main-panel .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eeg-main-panel .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ic = document.getElementById('eeg-ic-sel')?.value || AppState.selectedIC || 'IC1';
      chartEEGWaveform('eeg-signal', btn.dataset.ft, ic);
    });
  });
  document.getElementById('eeg-ic-sel')?.addEventListener('change', e => {
    AppState.selectedIC = e.target.value;
    const ft = document.querySelector('.eeg-main-panel .tab.active')?.dataset.ft || 'preprocessed';
    chartEEGWaveform('eeg-signal', ft, e.target.value);
  });

  // Spectrum
  if (AppState.data.quality?.bands) chartSpectrum('spectrum-mini', AppState.data.quality.bands);

  // EEG main
  const ic = AppState.selectedIC || 'IC1';
  await chartEEGWaveform('eeg-signal', 'preprocessed', ic);

  // Before / after
  await Promise.all([
    chartMultiChannel('before-chart', 'preprocessed',  ic, R),
    chartMultiChannel('after-chart',  'reconstructed', ic, G),
  ]);
}

// ── UPLOAD ────────────────────────────────────────────────────
function pgUpload() {
  const s = AppState.data.session;
  return `<div class="page">
    <div class="page-title">EEG UPLOAD</div>
    <div class="content-center">
      <div class="panel upload-panel">
        <div class="panel-header">ADD NEW SESSION</div>
        <div class="panel-body upload-body">
          <div class="upload-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="1.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <h3>Add New EEG Recording</h3>
          <p>Place your EEG file in the dataset folder then re-run the backend pipeline. The frontend reads processed output files and does not modify the processing algorithms.</p>
          <div class="upload-path-box"><code>backend/data/raw/EEGc/&lt;SubjectID&gt;/&lt;recording.edf&gt;</code></div>
          <div class="upload-formats"><span>.edf</span><span>.bdf</span><span>.set</span><span>.fif</span></div>
          <div class="info-box warn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            The EEG pipeline runs on the Python backend. The frontend is read-only and consumes processed CSV and FIF outputs.
          </div>
          <div class="current-session-info">
            <div class="csi-title">ACTIVE SESSION</div>
            <div class="info-row"><span>Session ID</span><code>${s?.sessionId || '—'}</code></div>
            <div class="info-row"><span>Recording</span><code>${s?.recording || '—'}</code></div>
            <div class="info-row"><span>Status</span>${badge('KEEP')} </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── PREPROCESSING ─────────────────────────────────────────────
function pgPreprocessing() {
  const s = AppState.data.session;
  const steps = [
    'Load raw EEG recording (.edf / .bdf)',
    'Set standard 10-20 electrode montage',
    'Apply notch filter (50 / 60 Hz power line)',
    'Bandpass filter (1–40 Hz)',
    'Reference to common average',
    'Detect and interpolate bad channels',
    'Reject highly corrupted epochs',
    'Fit Independent Component Analysis (FastICA)',
    'Export preprocessed FIF file',
  ];
  const statusFile = (f) => s?.files?.[f] !== false
    ? `<span class="badge badge-keep badge-sm">READY</span>`
    : `<span class="badge badge-remove badge-sm">MISSING</span>`;

  return `<div class="page">
    <div class="page-title">PREPROCESSING</div>
    <div class="two-col">
      <div class="col-wide">
        <div class="panel">
          <div class="panel-header">PIPELINE STEPS</div>
          <div class="panel-body">
            ${steps.map((st, i) => `
              <div class="pipeline-step-item done">
                <span class="step-icon">✓</span>
                <span class="step-n">${String(i + 1).padStart(2, '0')}</span>
                <span>${st}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="col-right">
        <div class="panel">
          <div class="panel-header">SESSION PARAMETERS</div>
          <div class="panel-body">
            ${s ? `<div class="info-list">
              <div class="info-row"><span>Session ID</span><code>${s.sessionId}</code></div>
              <div class="info-row"><span>Recording</span><code>${s.recording}</code></div>
              <div class="info-row"><span>Channels</span><code>${s.channels}</code></div>
              <div class="info-row"><span>Sampling Rate</span><code>${s.samplingRate} Hz</code></div>
              <div class="info-row"><span>Duration</span><code>${s.duration} s</code></div>
              <div class="info-row"><span>ICA Components</span><code>${s.icaComponents}</code></div>
              <div class="info-row"><span>Preprocessed FIF</span>${statusFile('S002R01_preprocessed_raw.fif')}</div>
              <div class="info-row"><span>ICA FIF</span>${statusFile('S002R01_ica.fif')}</div>
            </div>` : '<div class="empty-state">Session data not loaded</div>'}
          </div>
        </div>
        <div class="panel mt">
          <div class="panel-header">FILTER SETTINGS</div>
          <div class="panel-body">
            <div class="info-list">
              <div class="info-row"><span>High-pass cutoff</span><code>1 Hz</code></div>
              <div class="info-row"><span>Low-pass cutoff</span><code>40 Hz</code></div>
              <div class="info-row"><span>Notch filter</span><code>50 / 60 Hz</code></div>
              <div class="info-row"><span>ICA algorithm</span><code>FastICA</code></div>
              <div class="info-row"><span>Max components</span><code>${s?.icaComponents || 63}</code></div>
            </div>
            <div class="info-box info mt">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Parameters are set in the backend preprocessing script. This view is read-only.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── ICA ANALYSIS ──────────────────────────────────────────────
function pgICA() {
  return `<div class="page ica-page">
    <div class="page-title">ICA ANALYSIS</div>
    <div class="ica-layout">
      <div class="ica-table-col">${compTable(AppState.data.components)}</div>
      <div class="panel ica-explorer-col" id="explorer-panel" style="min-height:400px;">
        ${explorerHTML(AppState.selectedIC)}
      </div>
    </div>
  </div>`;
}

function pgICAInit() {
  initTable(id => initExplorer(id));
  if (AppState.selectedIC) {
    setTimeout(() => {
      const comp = AppState.data.components?.find(c => c.id === AppState.selectedIC);
      if (comp) {
        chartBands('explorer-band', comp.psd);
        chartComponentWave('explorer-wave', AppState.selectedIC);
      }
    }, 80);
    initExplorer(AppState.selectedIC);
  }
}

// ── ICLabel ────────────────────────────────────────────────────
function pgICLabel() {
  const comps = AppState.data.components || [];
  const labelCounts = {};
  comps.forEach(c => { const l = labelDisplay(c.iclabelLabel); labelCounts[l] = (labelCounts[l] || 0) + 1; });

  return `<div class="page">
    <div class="page-title">ICLabel CLASSIFICATION</div>
    <div class="two-col">
      <div class="col-wide">${compTable(comps)}</div>
      <div class="col-right">
        <div class="panel">
          <div class="panel-header">LABEL DISTRIBUTION</div>
          <div class="panel-body">
            ${Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).map(([l, n]) => `
              <div class="label-dist-row">
                <span class="label-name">${l}</span>
                <div class="label-bar-wrap"><div class="label-bar" style="width:${Math.round(n / comps.length * 100)}%"></div></div>
                <span class="label-count">${n}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="panel mt">
          <div class="panel-header">ABOUT ICLabel</div>
          <div class="panel-body">
            <p class="text-secondary">ICLabel is a deep-learning classifier for ICA components. It assigns labels including Brain, Eye Blink, Muscle Artifact, Channel Noise, Heart Beat, Line Noise, or Other, along with a confidence score.</p>
            <div class="info-row mt"><span>Source file</span><code>S002R01_iclabel.csv</code></div>
            <div class="info-row"><span>Components</span><code>${comps.length}</code></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function pgICLabelInit() { initTable(null); }

// ── PSD ANALYSIS ──────────────────────────────────────────────
function pgPSD() {
  const comps = AppState.data.components || [];
  const comp  = getSelectedComp() || comps[0];
  const opts  = comps.map(c => `<option value="${c.id}" ${c.id === (comp?.id || '') ? 'selected' : ''}>${c.id} — ${labelDisplay(c.iclabelLabel)}</option>`).join('');

  return `<div class="page">
    <div class="page-title">PSD ANALYSIS</div>
    <div class="psd-layout">
      <div class="psd-left">
        <div class="panel">
          <div class="panel-header">
            BAND POWER — COMPONENT
            <select id="psd-ic-sel" class="ctrl-sel">${opts}</select>
          </div>
          <div class="panel-body"><canvas id="psd-band-chart" height="210"></canvas></div>
        </div>
        <div class="panel mt">
          <div class="panel-header">FREQUENCY SPECTRUM COMPARISON (Session Level)</div>
          <div class="chart-legend-row"><span class="leg-dot red"></span>Original<span class="leg-dot green ml"></span>Clean</div>
          <div class="panel-body"><canvas id="psd-spectrum-chart" height="180"></canvas></div>
        </div>
      </div>
      <div class="psd-right">
        ${comp ? `<div class="panel" id="psd-detail-card">
          <div class="panel-header">${comp.id} — DETAILS</div>
          <div class="panel-body">
            <div class="info-list">
              <div class="info-row"><span>ICLabel</span><span>${labelDisplay(comp.iclabelLabel)}</span></div>
              <div class="info-row"><span>Confidence</span><span>${fmtPct(comp.confidence)}</span></div>
              <div class="info-row"><span>PSD Artifact Score</span><span class="${comp.psdArtScore > 0.5 ? 'val-warn' : ''}">${comp.psdArtScore.toFixed(4)}</span></div>
              <div class="info-row mt"><span>Delta (1–4 Hz)</span><code>${fmtPct(comp.psd.delta)}</code></div>
              <div class="info-row"><span>Theta (4–8 Hz)</span><code>${fmtPct(comp.psd.theta)}</code></div>
              <div class="info-row"><span>Alpha (8–13 Hz)</span><code>${fmtPct(comp.psd.alpha)}</code></div>
              <div class="info-row"><span>Beta (13–30 Hz)</span><code>${fmtPct(comp.psd.beta)}</code></div>
              <div class="info-row"><span>Gamma (30–40 Hz)</span><code>${fmtPct(comp.psd.gamma)}</code></div>
              <div class="info-row mt"><span>Source</span><code>S002R01_psd.csv</code></div>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

function pgPSDInit() {
  const comp = getSelectedComp() || AppState.data.components?.[0];
  if (comp) chartBands('psd-band-chart', comp.psd);
  if (AppState.data.quality?.bands) chartSpectrum('psd-spectrum-chart', AppState.data.quality.bands);

  document.getElementById('psd-ic-sel')?.addEventListener('change', e => {
    AppState.selectedIC = e.target.value;
    const c = AppState.data.components?.find(x => x.id === e.target.value);
    if (c) {
      chartBands('psd-band-chart', c.psd);
      // Update detail card
      const card = document.getElementById('psd-detail-card');
      if (card) {
        card.querySelector('.panel-header').textContent = `${c.id} — DETAILS`;
        ['delta','theta','alpha','beta','gamma'].forEach(b => {
          const el = card.querySelector(`[data-band="${b}"]`);
          if (el) el.textContent = fmtPct(c.psd[b]);
        });
      }
    }
  });
}

// ── ALICE ─────────────────────────────────────────────────────
function pgALICE() {
  const comps = AppState.data.components || [];
  const comp  = getSelectedComp() || comps[0];
  const opts  = comps.map(c => `<option value="${c.id}" ${c.id === (comp?.id || '') ? 'selected' : ''}>${c.id}</option>`).join('');

  return `<div class="page">
    <div class="page-title">ALICE — TEMPORAL FEATURE ANALYSIS</div>
    <div class="two-col">
      <div class="col-wide">
        <div class="panel">
          <div class="panel-header">
            TEMPORAL FEATURES
            <select id="alice-ic-sel" class="ctrl-sel">${opts}</select>
          </div>
          <div class="panel-body">
            ${comp ? `
              <div class="alice-features">
                ${[
                  { l: 'RMS',          v: comp.alice.rms,       bar: Math.min(100, comp.alice.rms * 1e6 * 5) },
                  { l: 'Kurtosis',     v: comp.alice.kurtosis,  bar: Math.min(100, Math.abs(comp.alice.kurtosis) * 8), warn: Math.abs(comp.alice.kurtosis) > 5 },
                  { l: 'Variance',     v: comp.alice.variance,  bar: Math.min(100, comp.alice.variance * 1e10) },
                  { l: 'Peak-to-Peak', v: comp.alice.pkToPk,    bar: Math.min(100, comp.alice.pkToPk * 1e5) },
                ].map(f => `<div class="feature-row">
                  <span class="feature-lbl">${f.l}</span>
                  <span class="feature-val mono ${f.warn ? 'val-warn' : ''}">${typeof f.v === 'number' ? f.v.toFixed(6) : '—'}</span>
                  <div class="feature-bar-wrap"><div class="feature-bar ${f.warn ? 'bar-high' : ''}" style="width:${f.bar || 0}%"></div></div>
                </div>`).join('')}
              </div>
              <div class="info-list mt">
                <div class="info-row"><span>ALICE Decision</span>${badge(comp.alice.decision, true)}</div>
                <div class="info-row"><span>ALICE Artifact Score</span><span class="mono">${comp.aliceArtScore.toFixed(4)}</span></div>
              </div>
              <div class="ev-section mt">
                <div class="section-label">EVIDENCE COMPARISON</div>
                ${evBar('ALICE Artifact',  comp.aliceArtScore)}
                ${evBar('PSD Artifact',    comp.psdArtScore)}
                ${evBar('ICLabel Artifact',comp.iclabelArtScore)}
              </div>
            ` : '<div class="empty-state">No component selected</div>'}
          </div>
        </div>
      </div>
      <div class="col-right">
        <div class="panel">
          <div class="panel-header">ABOUT ALICE</div>
          <div class="panel-body">
            <p class="text-secondary">ALICE (Artifact Level Inspection via Coefficient Examination) extracts temporal statistical features from ICA components — kurtosis, variance, peak-to-peak amplitude, and RMS — to identify artifact components independent of frequency-domain analysis.</p>
            <div class="info-row mt"><span>Source</span><code>S002R01_alice.csv</code></div>
            <div class="info-row"><span>Components</span><code>${comps.length}</code></div>
          </div>
        </div>
        ${comp ? `<div class="panel mt">
          <div class="panel-header">BAND POWER — ${comp.id}</div>
          <div class="panel-body"><canvas id="alice-band-chart" height="150"></canvas></div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

function pgALICEInit() {
  const comp = getSelectedComp() || AppState.data.components?.[0];
  if (comp) chartBands('alice-band-chart', comp.psd);
  document.getElementById('alice-ic-sel')?.addEventListener('change', e => {
    AppState.selectedIC = e.target.value;
    navigate('alice');
  });
}

// ── EVIDENCE FUSION ───────────────────────────────────────────
function pgFusion() {
  const comps = AppState.data.components || [];
  return `<div class="page">
    <div class="page-title">EVIDENCE FUSION</div>
    <div class="panel">
      <div class="panel-header">ALL COMPONENTS — FUSED EVIDENCE SCORES</div>
      <div class="table-scroll" style="max-height:75vh;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Component</th><th>ICLabel</th><th>ICLabel Art.</th>
              <th>PSD Art.</th><th>ALICE Art.</th>
              <th>Fusion Score</th><th>Brain Score</th><th>Decision</th>
            </tr>
          </thead>
          <tbody>
            ${comps.map(c => `
              <tr class="comp-row ${decClass(c.naDecision)} ${c.id === AppState.selectedIC ? 'row-selected' : ''}" data-ic="${c.id}">
                <td><code class="ic-code">${c.id}</code></td>
                <td>${labelDisplay(c.iclabelLabel)}</td>
                <td>${c.iclabelArtScore.toFixed(3)}</td>
                <td>${c.psdArtScore.toFixed(3)}</td>
                <td>${c.aliceArtScore.toFixed(3)}</td>
                <td class="mono ${c.fusionScore > 0.5 ? 'val-warn' : ''}">${c.fusionScore.toFixed(4)}</td>
                <td class="mono ${c.brainScore  > 0.5 ? 'val-good' : ''}">${c.brainScore.toFixed(4)}</td>
                <td>${badge(c.naDecision, true)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}
function pgFusionInit() {
  document.querySelectorAll('.data-table .comp-row').forEach(row => {
    row.addEventListener('click', () => {
      AppState.selectedIC = row.dataset.ic;
      document.querySelectorAll('.data-table .comp-row').forEach(r => r.classList.remove('row-selected'));
      row.classList.add('row-selected');
    });
  });
}

// ── NEUROAGENT DECISIONS ──────────────────────────────────────
function pgNeuroAgent() {
  const comp  = getSelectedComp();
  const comps = AppState.data.components;
  return `<div class="page neuroagent-page">
    <div class="page-title">NEUROAGENT DECISIONS</div>
    <div class="na-layout">
      <div class="na-table-col">${compTable(comps)}</div>
      <div class="na-detail-col">
        ${comp ? `<div class="panel">
          <div class="panel-header">${comp.id} — NEUROAGENT DETAIL</div>
          <div class="panel-body">
            <div class="na-decision-display">
              <div class="na-badge ${decClass(comp.naDecision)}">${comp.naDecision}</div>
            </div>
            <div class="info-list mt">
              <div class="info-row"><span>Classification</span><span>${labelDisplay(comp.iclabelLabel)}</span></div>
              <div class="info-row"><span>Confidence</span><span>${fmtPct(comp.confidence)}</span></div>
              <div class="info-row"><span>Artifact Score</span><span class="${comp.artifactScore > 0.5 ? 'val-warn' : ''}">${comp.artifactScore.toFixed(4)}</span></div>
              <div class="info-row"><span>Brain Score</span><span class="${comp.brainScore > 0.5 ? 'val-good' : ''}">${comp.brainScore.toFixed(4)}</span></div>
            </div>
            <div class="ev-section mt">
              <div class="section-label">EVIDENCE CONTRIBUTIONS</div>
              ${evBar('ICLabel Artifact', comp.iclabelArtScore)}
              ${evBar('PSD Artifact',     comp.psdArtScore)}
              ${evBar('ALICE Artifact',   comp.aliceArtScore)}
              ${evBar('Fusion Score',     comp.fusionScore)}
              ${evBar('Brain Score',      comp.brainScore)}
            </div>
            ${comp.reason ? `<div class="reason-box mt"><div class="section-label">REASONING</div><p class="reason-text mt">${comp.reason}</p></div>` : ''}
          </div>
        </div>` : `<div class="panel"><div class="panel-body empty-state">Click a component row to see its NeuroAgent decision details.</div></div>`}
      </div>
    </div>
  </div>`;
}
function pgNeuroAgentInit() {
  initTable(id => navigate('neuroagent'));
}

// ── HUMAN REVIEW ──────────────────────────────────────────────
function pgHumanReview() {
  const comp  = getSelectedComp();
  const comps = AppState.data.components || [];
  return `<div class="page">
    <div class="page-title">HUMAN REVIEW</div>
    <div class="review-layout">
      <div class="review-list-col">
        <div class="panel panel-list">
          <div class="panel-header">ALL COMPONENTS</div>
          <div class="review-comp-list">
            ${comps.map(c => {
              const human = AppState.humanDecisions[c.id]?.decision;
              const dec   = c.naDecision || c.decision;
              return `<div class="review-row ${decClass(dec)} ${c.id === AppState.selectedIC ? 'selected' : ''}" data-ic="${c.id}">
                <span class="rr-dot ${decClass(dec)}"></span>
                <span class="rr-id">${c.id}</span>
                <span class="rr-label">${labelDisplay(c.iclabelLabel)}</span>
                ${badge(dec, true)}
                ${human ? `<span class="human-override ${decClass(human)}">H</span>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="review-detail-col">
        ${comp ? `<div class="panel">
          <div class="panel-header">${comp.id} — HUMAN REVIEW</div>
          <div class="panel-body">
            <div class="review-header-info">
              <div><span class="review-id">${comp.id}</span><span class="review-label">${labelDisplay(comp.iclabelLabel)}</span></div>
              <div><span class="text-secondary" style="font-size:.56rem">NeuroAgent: </span>${badge(comp.naDecision)}</div>
            </div>
            <div class="review-scores">
              <div class="info-row"><span>Confidence</span><code>${fmtPct(comp.confidence)}</code></div>
              <div class="info-row"><span>Artifact Score</span><code class="${comp.artifactScore > 0.5 ? 'val-warn' : ''}">${comp.artifactScore.toFixed(4)}</code></div>
              <div class="info-row"><span>Brain Score</span><code class="${comp.brainScore > 0.5 ? 'val-good' : ''}">${comp.brainScore.toFixed(4)}</code></div>
            </div>
            <div class="ev-section mt">
              <div class="section-label">EVIDENCE</div>
              ${evBar('ICLabel', comp.iclabelArtScore)}
              ${evBar('PSD',     comp.psdArtScore)}
              ${evBar('ALICE',   comp.aliceArtScore)}
              ${evBar('Fusion',  comp.fusionScore)}
            </div>
            ${comp.reason ? `<div class="reason-box mt">${comp.reason}</div>` : ''}
            <div class="band-section mt"><div class="section-label">FREQUENCY BANDS</div><canvas id="review-band" height="90"></canvas></div>
            <div class="waveform-section mt"><div class="section-label">COMPONENT WAVEFORM</div>
              <div id="review-wave_wrap"><canvas id="review-wave" height="80"></canvas></div>
            </div>
            <div class="human-decision-section">
              <div class="section-label">YOUR DECISION</div>
              <div class="human-btns">
                <button class="hbtn keep   ${AppState.humanDecisions[comp.id]?.decision === 'KEEP'   ? 'active' : ''}" data-d="KEEP">✓ KEEP</button>
                <button class="hbtn remove ${AppState.humanDecisions[comp.id]?.decision === 'REMOVE' ? 'active' : ''}" data-d="REMOVE">✗ REMOVE</button>
                <button class="hbtn review ${AppState.humanDecisions[comp.id]?.decision === 'REVIEW' ? 'active' : ''}" data-d="REVIEW">? REVIEW</button>
              </div>
              <textarea id="review-comment" class="human-comment" rows="2" placeholder="Add a comment…">${AppState.humanDecisions[comp.id]?.comment || ''}</textarea>
              <button class="save-btn" id="save-review">SAVE DECISION</button>
            </div>
          </div>
        </div>` : `<div class="panel"><div class="panel-body empty-state">Select a component from the list to review.</div></div>`}
      </div>
    </div>
  </div>`;
}

function pgHumanReviewInit() {
  document.querySelectorAll('.review-row').forEach(row => {
    row.addEventListener('click', () => { AppState.selectedIC = row.dataset.ic; navigate('human-review'); });
  });
  const comp = getSelectedComp();
  if (!comp) return;
  setTimeout(() => {
    chartBands('review-band', comp.psd);
    chartComponentWave('review-wave', comp.id);
  }, 50);
  document.querySelectorAll('.human-btns .hbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.d;
      if (!AppState.humanDecisions[comp.id]) AppState.humanDecisions[comp.id] = {};
      AppState.humanDecisions[comp.id].decision = d;
      document.querySelectorAll('.human-btns .hbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`${comp.id}: ${d}`, d === 'KEEP' ? 'success' : d === 'REMOVE' ? 'error' : 'warn');
    });
  });
  document.getElementById('save-review')?.addEventListener('click', () => {
    const comment = document.getElementById('review-comment')?.value || '';
    const h = AppState.humanDecisions[comp.id];
    if (!h?.decision) { showToast('Select a decision first', 'warn'); return; }
    h.comment = comment;
    saveHumanDecisions();
    showToast(`Saved: ${comp.id} → ${h.decision}`, 'success');
  });
}

// ── RECONSTRUCTION ────────────────────────────────────────────
function pgReconstruction() {
  const q    = AppState.data.quality;
  const s    = AppState.data.session;
  const comps= AppState.data.components || [];
  const removed = comps.filter(c =>
    (AppState.humanDecisions[c.id]?.decision || c.naDecision) === 'REMOVE'
  );
  const ready = s?.files?.['S002R01_reconstructed_raw.fif'] !== false;

  return `<div class="page">
    <div class="page-title">RECONSTRUCTION</div>
    <div class="recon-layout">
      <div class="recon-left">
        <div class="panel">
          <div class="panel-header">RECONSTRUCTION STATUS</div>
          <div class="panel-body">
            <div class="recon-status ${ready ? 'ok' : 'missing'}">
              <span class="recon-icon">${ready ? '✓' : '○'}</span>
              <span>${ready ? 'RECONSTRUCTION COMPLETE' : 'RECONSTRUCTED FILE NOT FOUND'}</span>
            </div>
            <div class="info-list mt">
              <div class="info-row"><span>Components Removed</span><code>${q?.componentsRemoved ?? removed.length}</code></div>
              <div class="info-row"><span>Components Kept</span><code>${q?.componentsKept ?? (comps.length - removed.length)}</code></div>
              <div class="info-row"><span>Output File</span><code>S002R01_reconstructed_raw.fif</code></div>
              <div class="info-row"><span>File Status</span><span class="badge ${ready ? 'badge-keep' : 'badge-review'} badge-sm">${ready ? 'READY' : 'MISSING'}</span></div>
            </div>
            ${removed.length ? `
              <div class="section-label mt">REMOVED COMPONENTS</div>
              <div class="removed-list">
                ${removed.map(c => `<span class="removed-chip">${c.id}<span class="chip-label"> ${labelDisplay(c.iclabelLabel)}</span></span>`).join('')}
              </div>` : ''}
          </div>
        </div>
        <div class="panel mt">
          <div class="panel-header">BEFORE / AFTER WAVEFORMS</div>
          <div class="ba-split">
            <div class="ba-col"><div class="ba-lbl red">Preprocessed (Before)</div>
              <div id="recon-before_wrap"><canvas id="recon-before" height="110"></canvas></div>
            </div>
            <div class="ba-sep"></div>
            <div class="ba-col"><div class="ba-lbl green">Reconstructed (After)</div>
              <div id="recon-after_wrap"><canvas id="recon-after" height="110"></canvas></div>
            </div>
          </div>
        </div>
      </div>
      <div class="recon-right">
        <div class="panel">
          <div class="panel-header">QUALITY OVERVIEW</div>
          <div class="panel-body">
            ${q ? `<div class="info-list">
              <div class="info-row"><span>Overall Quality</span><span class="badge ${q.overallQuality === 'GOOD' ? 'badge-keep' : 'badge-review'} badge-sm">${q.overallQuality}</span></div>
              <div class="info-row"><span>RMS (Original)</span><code>${q.originalRms} µV</code></div>
              <div class="info-row"><span>RMS (Clean)</span><code>${q.cleanRms} µV</code></div>
              <div class="info-row"><span>P2P (Original)</span><code>${q.originalPeakToPeak} µV</code></div>
              <div class="info-row"><span>P2P (Clean)</span><code>${q.cleanPeakToPeak} µV</code></div>
            </div>` : '<div class="empty-state">Quality data not available</div>'}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

async function pgReconstructionInit() {
  const ic = AppState.selectedIC || 'IC1';
  await Promise.all([
    chartMultiChannel('recon-before', 'preprocessed',  ic, R),
    chartMultiChannel('recon-after',  'reconstructed', ic, G),
  ]);
}

// ── QUALITY CHECK ─────────────────────────────────────────────
function pgQuality() {
  const q = AppState.data.quality;
  const pct = (clean, orig) => {
    const c = parseFloat(clean), o = parseFloat(orig);
    if (isNaN(c) || isNaN(o) || o === 0) return '—';
    const p = ((c - o) / o * 100).toFixed(1);
    return `<span class="${parseFloat(p) < 0 ? 'val-good' : 'val-warn'}">${p > 0 ? '+' : ''}${p}%</span>`;
  };
  const isGood = (q?.overallQuality || '').toUpperCase() === 'GOOD';

  return `<div class="page quality-page">
    <div class="page-title">QUALITY CHECK</div>
    <div class="quality-layout">
      <div class="quality-left">
        <div class="panel">
          <div class="panel-header">SIGNAL QUALITY METRICS</div>
          <div class="panel-body">
            <table class="quality-table">
              <thead><tr><th>Metric</th><th>Original</th><th>Clean</th><th>Change</th></tr></thead>
              <tbody>
                <tr><td>RMS (µV)</td><td><code>${q?.originalRms || '—'}</code></td><td><code class="val-good">${q?.cleanRms || '—'}</code></td><td>${pct(q?.cleanRms, q?.originalRms)}</td></tr>
                <tr><td>Variance (µV²)</td><td><code>${q?.originalVariance || '—'}</code></td><td><code>${q?.cleanVariance || '—'}</code></td><td>—</td></tr>
                <tr><td>Peak-to-Peak (µV)</td><td><code>${q?.originalPeakToPeak || '—'}</code></td><td><code class="val-good">${q?.cleanPeakToPeak || '—'}</code></td><td>—</td></tr>
                <tr class="snr-row"><td>SNR (dB) <span class="na-tooltip" title="SNR not provided by quality_report.csv">?</span></td><td>—</td><td>—</td><td>—</td></tr>
              </tbody>
            </table>
            <div class="info-row mt"><span>Data Source</span><code>S002R01_quality_report.csv</code></div>
          </div>
        </div>
        <div class="panel mt">
          <div class="panel-header">FREQUENCY SPECTRUM COMPARISON</div>
          <div class="chart-legend-row"><span class="leg-dot red"></span>Original<span class="leg-dot green ml"></span>Clean</div>
          <div class="panel-body"><canvas id="quality-spectrum" height="200"></canvas></div>
        </div>
      </div>
      <div class="quality-right">
        <div class="panel">
          <div class="panel-header">OVERALL ASSESSMENT</div>
          <div class="panel-body quality-assessment">
            <div class="quality-badge-large ${isGood ? 'good' : 'warn'}">
              <div class="qbl-ring"><div class="qbl-inner">${q?.overallQuality || '—'}</div></div>
            </div>
            <div class="quality-summary">
              <div class="qs-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Artifacts Removed: <strong>${q?.componentsRemoved ?? '—'}</strong>
              </div>
              <div class="qs-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Brain Signals Kept: <strong>${q?.componentsKept ?? '—'}</strong>
              </div>
            </div>
          </div>
        </div>
        <div class="panel mt">
          <div class="panel-header">BAND-LEVEL CHANGES</div>
          <div class="panel-body">
            ${q?.bands ? ['delta','theta','alpha','beta','gamma'].map(b => {
              const bd = q.bands[b];
              if (!bd || (!bd.orig && !bd.clean)) return `<div class="info-row"><span>${b.charAt(0).toUpperCase()+b.slice(1)}</span><span class="text-secondary">—</span></div>`;
              const p  = bd.orig ? ((bd.clean - bd.orig) / bd.orig * 100).toFixed(1) : '—';
              const cls= isNaN(p) ? '' : parseFloat(p) < 0 ? 'val-good' : 'val-warn';
              return `<div class="info-row"><span>${b.charAt(0).toUpperCase()+b.slice(1)}</span><span class="mono ${cls}">${isNaN(p)?'—':(parseFloat(p)>0?'+':'')+p+'%'}</span></div>`;
            }).join('') : '<div class="empty-state">Band data not available</div>'}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function pgQualityInit() {
  if (AppState.data.quality?.bands) chartSpectrum('quality-spectrum', AppState.data.quality.bands);
}

// ── FINAL REPORT ──────────────────────────────────────────────
function pgReport() {
  const q     = AppState.data.quality;
  const s     = AppState.data.session;
  const comps = AppState.data.components || [];
  const hCount= Object.keys(AppState.humanDecisions).length;

  const kept   = comps.filter(c => c.naDecision === 'KEEP').length;
  const removed= comps.filter(c => c.naDecision === 'REMOVE').length;
  const review = comps.filter(c => c.naDecision === 'REVIEW').length;

  const labelDist = {};
  comps.forEach(c => { const l = labelDisplay(c.iclabelLabel); labelDist[l] = (labelDist[l] || 0) + 1; });

  return `<div class="page report-page">
    <div class="page-title">
      FINAL REPORT
      <div class="report-actions">
        <button class="btn-export" id="export-json">↓ JSON</button>
        <button class="btn-export" id="export-csv">↓ CSV</button>
      </div>
    </div>
    <div class="report-grid">

      <div class="panel">
        <div class="panel-header">SESSION INFORMATION</div>
        <div class="panel-body">
          <div class="info-list">
            <div class="info-row"><span>Session ID</span><code>${s?.sessionId || '—'}</code></div>
            <div class="info-row"><span>Recording</span><code>${s?.recording || '—'}</code></div>
            <div class="info-row"><span>Channels</span><code>${s?.channels || '—'}</code></div>
            <div class="info-row"><span>Sampling Rate</span><code>${s?.samplingRate || '—'} Hz</code></div>
            <div class="info-row"><span>Duration</span><code>${s?.duration || '—'} s</code></div>
            <div class="info-row"><span>ICA Components</span><code>${s?.icaComponents || '—'}</code></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">NEUROAGENT DECISIONS</div>
        <div class="panel-body">
          <div class="comp-summary">
            <div class="comp-stat keep"><span class="comp-n">${kept}</span><span class="comp-l">KEEP</span></div>
            <div class="comp-stat remove"><span class="comp-n">${removed}</span><span class="comp-l">REMOVE</span></div>
            <div class="comp-stat review"><span class="comp-n">${review}</span><span class="comp-l">REVIEW</span></div>
          </div>
          <div class="info-row mt"><span>Human Overrides</span><code>${hCount}</code></div>
          <div class="section-label mt">ICLabel Distribution</div>
          ${Object.entries(labelDist).sort((a,b)=>b[1]-a[1]).map(([l,n])=>`<div class="info-row"><span>${l}</span><code>${n}</code></div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">QUALITY METRICS</div>
        <div class="panel-body">
          ${q ? `<div class="info-list">
            <div class="info-row"><span>Overall Quality</span><span class="badge ${q.overallQuality==='GOOD'?'badge-keep':'badge-review'} badge-sm">${q.overallQuality}</span></div>
            <div class="info-row"><span>RMS Original</span><code>${q.originalRms} µV</code></div>
            <div class="info-row"><span>RMS Clean</span><code>${q.cleanRms} µV</code></div>
            <div class="info-row"><span>P2P Original</span><code>${q.originalPeakToPeak} µV</code></div>
            <div class="info-row"><span>P2P Clean</span><code>${q.cleanPeakToPeak} µV</code></div>
            <div class="info-row"><span>Removed</span><code>${q.componentsRemoved}</code></div>
          </div>` : '<div class="empty-state">Quality data unavailable</div>'}
        </div>
      </div>

      <div class="panel span-2">
        <div class="panel-header">REMOVED COMPONENTS (NeuroAgent)</div>
        <div class="table-scroll" style="max-height:200px;">
          <table class="data-table">
            <thead><tr><th>Component</th><th>ICLabel</th><th>Confidence</th><th>Artifact Score</th><th>Reasoning</th></tr></thead>
            <tbody>
              ${comps.filter(c=>c.naDecision==='REMOVE').length
                ? comps.filter(c=>c.naDecision==='REMOVE').map(c=>`<tr>
                    <td><code>${c.id}</code></td>
                    <td>${labelDisplay(c.iclabelLabel)}</td>
                    <td>${fmtPct(c.confidence)}</td>
                    <td>${c.artifactScore.toFixed(4)}</td>
                    <td class="reason-small">${c.reason || '—'}</td>
                  </tr>`).join('')
                : '<tr><td colspan="5" class="empty-state">No components removed</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel span-2">
        <div class="panel-header">HUMAN REVIEW DECISIONS</div>
        <div class="table-scroll" style="max-height:200px;">
          ${hCount ? `<table class="data-table">
            <thead><tr><th>Component</th><th>ICLabel</th><th>NeuroAgent</th><th>Human Decision</th><th>Comment</th></tr></thead>
            <tbody>
              ${Object.entries(AppState.humanDecisions).map(([ic,d])=>{
                const c = comps.find(x=>x.id===ic);
                return `<tr>
                  <td><code>${ic}</code></td>
                  <td>${c ? labelDisplay(c.iclabelLabel) : '—'}</td>
                  <td>${badge(c?.naDecision, true)}</td>
                  <td>${badge(d.decision, true)}</td>
                  <td class="reason-small">${d.comment || '—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>` : '<div class="empty-state">No human decisions recorded. Use Human Review to add decisions.</div>'}
        </div>
      </div>

    </div>
  </div>`;
}

function pgReportInit() {
  document.getElementById('export-json')?.addEventListener('click', () => {
    const report = {
      meta: { generated: new Date().toISOString(), version: '1.0', session: 'S002R01' },
      session: AppState.data.session,
      quality: AppState.data.quality,
      decisions: {
        keep:   AppState.data.components?.filter(c=>c.naDecision==='KEEP').length,
        remove: AppState.data.components?.filter(c=>c.naDecision==='REMOVE').length,
        review: AppState.data.components?.filter(c=>c.naDecision==='REVIEW').length,
      },
      human_decisions: AppState.humanDecisions,
      components: AppState.data.components?.map(c => ({
        id: c.id, label: labelDisplay(c.iclabelLabel),
        confidence: c.confidence, artifactScore: c.artifactScore,
        brainScore: c.brainScore, naDecision: c.naDecision,
        humanDecision: AppState.humanDecisions[c.id]?.decision || null,
        reason: c.reason,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    dlBlob(blob, 'neuroagent_report_S002R01.json');
    showToast('Report exported as JSON', 'success');
  });

  document.getElementById('export-csv')?.addEventListener('click', () => {
    const hdr  = ['Component','ICLabel','Confidence','ArtifactScore','BrainScore','NADecision','HumanDecision','Comment'];
    const rows = (AppState.data.components || []).map(c => {
      const h = AppState.humanDecisions[c.id];
      return [c.id, labelDisplay(c.iclabelLabel), c.confidence.toFixed(4),
              c.artifactScore.toFixed(4), c.brainScore.toFixed(4),
              c.naDecision, h?.decision || '', h?.comment || ''].join(',');
    });
    const blob = new Blob([[hdr.join(','), ...rows].join('\n')], { type: 'text/csv' });
    dlBlob(blob, 'neuroagent_components_S002R01.csv');
    showToast('Components exported as CSV', 'success');
  });
}

function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────────
// ROUTER
// ────────────────────────────────────────────────────────────────
const ROUTES = {
  overview:       { title: 'Overview',        render: pgOverview,       init: pgOverviewInit },
  upload:         { title: 'EEG Upload',      render: pgUpload,         init: null },
  preprocessing:  { title: 'Preprocessing',   render: pgPreprocessing,  init: null },
  ica:            { title: 'ICA Analysis',    render: pgICA,            init: pgICAInit },
  iclabel:        { title: 'ICLabel',         render: pgICLabel,        init: pgICLabelInit },
  psd:            { title: 'PSD Analysis',    render: pgPSD,            init: pgPSDInit },
  alice:          { title: 'ALICE',           render: pgALICE,          init: pgALICEInit },
  fusion:         { title: 'Evidence Fusion', render: pgFusion,         init: pgFusionInit },
  neuroagent:     { title: 'NeuroAgent',      render: pgNeuroAgent,     init: pgNeuroAgentInit },
  'human-review': { title: 'Human Review',    render: pgHumanReview,    init: pgHumanReviewInit },
  reconstruction: { title: 'Reconstruction',  render: pgReconstruction, init: pgReconstructionInit },
  quality:        { title: 'Quality Check',   render: pgQuality,        init: pgQualityInit },
  report:         { title: 'Final Report',    render: pgReport,         init: pgReportInit },
};

function navigate(route) {
  if (!ROUTES[route]) route = 'overview';
  AppState.currentPage = route;

  // Push history without creating back-loop on same route
  if (window.location.hash.slice(1) !== route) {
    history.pushState(null, '', `#${route}`);
  }

  // Sidebar active state
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  // Header breadcrumb
  const lbl = document.getElementById('current-page-label');
  if (lbl) lbl.textContent = ROUTES[route].title;

  // Destroy existing charts
  CR.destroyAll();

  // Render into container
  const container = document.getElementById('page-container');
  if (!container) return;
  container.innerHTML = '';

  requestAnimationFrame(() => {
    container.innerHTML = ROUTES[route].render();
    setTimeout(() => { ROUTES[route].init?.(); }, 30);
  });
}

window.addEventListener('popstate', () => navigate(window.location.hash.slice(1) || 'overview'));

// Expose for inline onclick handlers
window.navigate          = navigate;
window.chartEEGWaveform  = chartEEGWaveform;

// ────────────────────────────────────────────────────────────────
// SIDEBAR BINDING
// ────────────────────────────────────────────────────────────────
function bindSidebar() {
  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route));
  });
}

// ────────────────────────────────────────────────────────────────
// CLOCK
// ────────────────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('header-clock');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

// ────────────────────────────────────────────────────────────────
// HEADER STATUS UPDATE
// ────────────────────────────────────────────────────────────────
function updateHeader(session) {
  const el = document.getElementById('hdr-session-val');
  if (el && session) el.textContent = session.sessionId;

  // EEG chip
  const eegChip = document.getElementById('hdr-eeg-chip');
  if (eegChip) {
    eegChip.querySelector('.hdr-chip-v').innerHTML = session
      ? `<span class="pulse-dot"></span> LOADED`
      : '○ NO DATA';
  }

  updateAPIStatus(false);

  // Async API check
  DataAdapter.getEEGSamples('ica', 'IC1', 5, '0').then(d => {
    updateAPIStatus(d?.available === true);
    updateSidebarStatus(session);
  });

  updateSidebarStatus(session);
}

// ────────────────────────────────────────────────────────────────
// BOOT
// ────────────────────────────────────────────────────────────────
async function boot() {
  console.log('[NeuroAgent] Booting…');
  loadHumanDecisions();
  startClock();
  bindSidebar();

  // Load all data in parallel
  const [session, components, quality] = await Promise.all([
    DataAdapter.getSession(),
    DataAdapter.getComponents(),
    DataAdapter.getQualityReport(),
  ]);

  AppState.data.session    = session;
  AppState.data.components = components;
  AppState.data.quality    = quality;

  // Default selected IC
  if (components?.length) {
    AppState.selectedIC = components.find(c => c.id === 'IC9')?.id || components[0].id;
  }

  updateHeader(session);

  console.log('[NeuroAgent] Loaded:', {
    session:    session?.sessionId,
    components: components?.length,
    quality:    quality?.overallQuality,
  });

  // Navigate to initial route
  const init = window.location.hash.slice(1) || 'overview';
  navigate(init);
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
