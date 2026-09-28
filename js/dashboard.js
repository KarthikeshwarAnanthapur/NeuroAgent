/**
 * js/dashboard.js — NeuroAgent Main Controller
 * =============================================
 * Orchestrates: data loading → state → UI rendering.
 * No data is invented. Unavailable data shows clear UI placeholders.
 */

'use strict';

// ─────────────────────────────────────────────────────────
// APPLICATION STATE
// ─────────────────────────────────────────────────────────

const State = {
  session:      null,
  components:   null,   // array of component objects
  quality:      null,
  selectedIC:   'IC9',  // default
  humanDecisions: {},   // { IC9: 'KEEP', ... }
  activeTab:    'preprocessed',
  charts: {
    donut:       null,
    bandBar:     null,
    spectrum:    null,
    eegSignal:   null,
    icaWaveform: null,
    icaPSD:      null,
    beforeEEG:   null,
    afterEEG:    null,
  },
  neuralBody:   null,
  pipelineStep: 8,   // NeuroAgent is the active stage (1-indexed)
};

// ─────────────────────────────────────────────────────────
// PIPELINE STAGE DEFINITIONS
// ─────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id:1,  label:'RAW EEG',      file:'S002R01.edf' },
  { id:2,  label:'PREPROCESS',   file:'S002R01_preprocessed_raw.fif' },
  { id:3,  label:'ICA',          file:'S002R01_ica.fif' },
  { id:4,  label:'ICLabel',      file:'S002R01_iclabel.csv' },
  { id:5,  label:'PSD',          file:'S002R01_psd.csv' },
  { id:6,  label:'ALICE',        file:'S002R01_alice.csv' },
  { id:7,  label:'FUSION',       file:'S002R01_fusion.csv' },
  { id:8,  label:'NEUROAGENT',   file:'S002R01_neuroagent.csv' },
  { id:9,  label:'HUMAN REVIEW', file:null },
  { id:10, label:'RECONSTRUCT',  file:'S002R01_reconstructed_raw.fif' },
  { id:11, label:'QUALITY CHK',  file:'S002R01_quality_report.csv' },
  { id:12, label:'CLEAN EEG',    file:'S002R01_reconstructed_raw.fif' },
];

// ─────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────

function fmtPct(v) { return (v*100).toFixed(2)+'%'; }
function fmtVal(v) { return v !== undefined && v !== null ? v : '—'; }

function decisionClass(d) {
  return { KEEP:'keep', REMOVE:'remove', REVIEW:'review' }[d] || 'review';
}

function labelFor(iclabelLabel) {
  // Map raw iclabel labels to display-friendly forms
  const map = {
    'brain':           'Brain',
    'eye blink':       'Eye Blink',
    'muscle artifact': 'Muscle',
    'channel noise':   'Channel Noise',
    'heart beat':      'Heart Beat',
    'line noise':      'Line Noise',
    'other':           'Other',
  };
  return map[iclabelLabel?.toLowerCase()] || iclabelLabel || 'Unknown';
}

// ─────────────────────────────────────────────────────────
// LIVE CLOCK
// ─────────────────────────────────────────────────────────

function startClock() {
  const el = document.getElementById('header-time');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
      + '\n' + now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  };
  tick();
  setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────
// PIPELINE BAR
// ─────────────────────────────────────────────────────────

function renderPipeline(files) {
  const bar = document.getElementById('pipeline-bar');
  if (!bar) return;

  bar.innerHTML = PIPELINE_STAGES.map(s => {
    let status, cls;
    if (s.id < State.pipelineStep) {
      // Completed — check if file actually exists
      const exists = s.file ? files[s.file] !== false : true;
      status = exists ? '✓' : '✗';
      cls    = exists ? 'done' : 'error';
    } else if (s.id === State.pipelineStep) {
      status = '●'; cls = 'active';
    } else {
      status = '…'; cls = 'pending';
    }

    return `
      <div class="pipe-stage ${cls}" title="${s.label}">
        <span class="pipe-num">${String(s.id).padStart(2,'0')}</span>
        <span class="pipe-status">${status}</span>
        <span class="pipe-label">${s.label}</span>
      </div>
      ${s.id < 12 ? '<div class="pipe-arrow">›</div>' : ''}
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// SESSION PANEL
// ─────────────────────────────────────────────────────────

function renderSession(session) {
  if (!session) return;
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=fmtVal(v); };

  set('sess-id',       session.sessionId);
  set('sess-rec',      session.recording);
  set('sess-channels', session.channels);
  set('sess-sfreq',    session.samplingRate + ' Hz');
  set('sess-dur',      session.duration + ' s');
  set('sess-ica',      session.icaComponents);

  // Header status badges
  document.getElementById('hdr-session-val')?.textContent &&
    (document.getElementById('hdr-session-val').textContent = session.sessionId);
}

// ─────────────────────────────────────────────────────────
// COMPONENT SUMMARY  (KEEP / REMOVE / REVIEW counts + donut)
// ─────────────────────────────────────────────────────────

function renderSummary(quality, components) {
  const kept   = quality?.componentsKept    ?? components?.filter(c=>c.naDecision==='KEEP').length   ?? 0;
  const removed= quality?.componentsRemoved ?? components?.filter(c=>c.naDecision==='REMOVE').length ?? 0;
  const review = quality?.componentsReview  ?? components?.filter(c=>c.naDecision==='REVIEW').length ?? 0;
  const total  = kept + removed + review;

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('sum-keep',   kept);
  set('sum-remove', removed);
  set('sum-review', review);
  set('sum-total',  total);
  set('sum-keep-pct',   `(${((kept/total)*100).toFixed(1)}%)`);
  set('sum-remove-pct', `(${((removed/total)*100).toFixed(1)}%)`);
  set('sum-review-pct', `(${((review/total)*100).toFixed(1)}%)`);

  // Destroy old donut
  if (State.charts.donut) { State.charts.donut.destroy(); State.charts.donut=null; }
  State.charts.donut = Charts.createDonutChart('donut-chart', kept, removed, review);
}

// ─────────────────────────────────────────────────────────
// COMPONENT LIST
// ─────────────────────────────────────────────────────────

function renderComponentList(components) {
  const list = document.getElementById('component-list');
  if (!list || !components) return;

  // Also populate the selector dropdown
  const sel = document.getElementById('ic-selector');
  if (sel) {
    sel.innerHTML = components.map(c =>
      `<option value="${c.id}" ${c.id===State.selectedIC?'selected':''}>${c.id}</option>`
    ).join('');
    sel.addEventListener('change', e => selectIC(e.target.value));
  }

  list.innerHTML = components.map(c => {
    const dec = c.naDecision || c.decision;
    const human = State.humanDecisions[c.id];
    const finalDec = human || dec;
    const cls = decisionClass(finalDec);
    const sel = c.id === State.selectedIC ? 'selected' : '';

    return `
      <div class="ic-row ${cls} ${sel}" data-ic="${c.id}" role="button" tabindex="0"
           aria-label="${c.id} ${labelFor(c.iclabelLabel)} ${finalDec}">
        <span class="ic-indicator ${cls}"></span>
        <span class="ic-id">${c.id}</span>
        <span class="ic-label">${labelFor(c.iclabelLabel)}</span>
        <span class="ic-decision-badge ${cls}">${finalDec}</span>
        ${human ? '<span class="ic-human-flag" title="Human override">H</span>' : ''}
      </div>
    `;
  }).join('');

  // Click to select
  list.querySelectorAll('.ic-row').forEach(row => {
    row.addEventListener('click',  () => selectIC(row.dataset.ic));
    row.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') selectIC(row.dataset.ic); });
  });
}

// ─────────────────────────────────────────────────────────
// IC DETAIL PANEL
// ─────────────────────────────────────────────────────────

function renderICDetail(comp) {
  if (!comp) return;
  const dec = State.humanDecisions[comp.id] || comp.naDecision;

  document.getElementById('ic-detail-title')?.textContent &&
    (document.getElementById('ic-detail-title').textContent = comp.id + ' DETAILS');
  document.getElementById('ica-panel-ic-label')?.textContent &&
    (document.getElementById('ica-panel-ic-label').textContent = comp.id);

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=fmtVal(v); };
  set('detail-id',         comp.id);
  set('detail-label',      labelFor(comp.iclabelLabel));
  set('detail-confidence', fmtPct(comp.confidence));
  set('detail-artifact',   comp.artifactScore.toFixed(4));
  set('detail-brain',      comp.brainScore.toFixed(4));

  const decBadge = document.getElementById('detail-decision');
  if (decBadge) {
    decBadge.textContent  = dec;
    decBadge.className    = 'decision-badge ' + decisionClass(dec);
  }

  // Reason tooltip
  const reason = document.getElementById('detail-reason');
  if (reason) reason.textContent = comp.reason || '';

  // Evidence bars
  const bars = [
    { id:'ev-iclabel', val: comp.iclabelArtScore },
    { id:'ev-psd',     val: comp.psdArtScore     },
    { id:'ev-alice',   val: comp.aliceArtScore    },
    { id:'ev-fusion',  val: comp.fusionScore      },
  ];
  bars.forEach(b => {
    const bar   = document.getElementById(b.id+'-bar');
    const label = document.getElementById(b.id+'-val');
    if (bar)   bar.style.width = Math.min(100, b.val*100)+'%';
    if (label) label.textContent = b.val.toFixed(2);
  });

  // Neural body color
  if (State.neuralBody) State.neuralBody.setDecision(dec);

  // Human decision button active states
  const hDec = State.humanDecisions[comp.id];
  document.getElementById('btn-keep')?.classList.toggle('active',   hDec === 'KEEP');
  document.getElementById('btn-remove')?.classList.toggle('active', hDec === 'REMOVE');
}

// ─────────────────────────────────────────────────────────
// CHARTS FOR SELECTED IC
// ─────────────────────────────────────────────────────────

function renderICCharts(comp) {
  if (!comp) return;

  // Band bar chart (real PSD data)
  if (State.charts.bandBar) { State.charts.bandBar.destroy(); State.charts.bandBar=null; }
  State.charts.bandBar = Charts.createBandBarChart('ica-band-chart', comp.psd);

  // PSD line chart (approximated from band data)
  if (State.charts.icaPSD) { State.charts.icaPSD.destroy(); State.charts.icaPSD=null; }
  State.charts.icaPSD = Charts.createPSDChart('ica-psd-chart', comp.psd, comp.id);

  // ICA waveform — try Python API
  loadICAWaveform(comp.id);
}

async function loadICAWaveform(compId) {
  const data = await DataAdapter.getEEGSamples('ica', compId, 600, '0');
  if (State.charts.icaWaveform) { State.charts.icaWaveform.destroy(); State.charts.icaWaveform=null; }
  State.charts.icaWaveform = Charts.createICAWaveformChart('ica-waveform-chart', data);
}

// ─────────────────────────────────────────────────────────
// QUALITY PANEL
// ─────────────────────────────────────────────────────────

function renderQuality(quality) {
  if (!quality) return;

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };

  set('q-orig-rms',   quality.originalRms);
  set('q-clean-rms',  quality.cleanRms);
  set('q-orig-var',   quality.originalVariance);
  set('q-clean-var',  quality.cleanVariance);
  set('q-orig-ptp',   quality.originalPeakToPeak);
  set('q-clean-ptp',  quality.cleanPeakToPeak);
  set('q-orig-snr',   '—');    // Not provided by backend
  set('q-clean-snr',  '—');

  const badge = document.getElementById('quality-badge');
  if (badge) {
    const good = quality.overallQuality === 'GOOD';
    badge.className   = 'quality-signal-badge ' + (good ? 'good' : 'warn');
    badge.innerHTML   = `
      <div class="qbadge-ring">
        <div class="qbadge-inner">
          <span class="qbadge-text">${quality.overallQuality}</span>
        </div>
      </div>
      <div class="qbadge-sub">
        <span>Artifacts Removed</span>
        <span>Brain Signals Preserved</span>
      </div>
    `;
  }

  // Spectrum comparison chart (real quality report band data)
  if (State.charts.spectrum) { State.charts.spectrum.destroy(); State.charts.spectrum=null; }
  State.charts.spectrum = Charts.createSpectrumComparisonChart('spectrum-chart', quality.bands);
}

// ─────────────────────────────────────────────────────────
// EEG SIGNAL TAB
// ─────────────────────────────────────────────────────────

async function loadEEGTab(tabName) {
  State.activeTab = tabName;

  // Update tab UI
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tabName));

  const comp = State.selectedIC;

  if (tabName === 'ica') {
    const data = await DataAdapter.getEEGSamples('ica', comp, 800, '0');
    if (State.charts.eegSignal) { State.charts.eegSignal.destroy(); State.charts.eegSignal=null; }
    State.charts.eegSignal = Charts.createICAWaveformChart('eeg-signal-chart', data);
  } else {
    const fileMap = { raw:'preprocessed', preprocessed:'preprocessed', clean:'reconstructed' };
    const f = fileMap[tabName] || 'preprocessed';
    const data = await DataAdapter.getEEGSamples(f, comp, 800, '0,1,2,3,4,5,6,7');
    if (State.charts.eegSignal) { State.charts.eegSignal.destroy(); State.charts.eegSignal=null; }
    State.charts.eegSignal = Charts.createEEGLineChart('eeg-signal-chart', data);
  }
}

// ─────────────────────────────────────────────────────────
// MULTI-CHANNEL BEFORE/AFTER
// ─────────────────────────────────────────────────────────

async function loadMultiChannel() {
  const [beforeData, afterData] = await Promise.all([
    DataAdapter.getEEGSamples('preprocessed',  State.selectedIC, 600, '0,1,2,3,4,5,6,7'),
    DataAdapter.getEEGSamples('reconstructed', State.selectedIC, 600, '0,1,2,3,4,5,6,7'),
  ]);

  if (State.charts.beforeEEG) { State.charts.beforeEEG.destroy(); State.charts.beforeEEG=null; }
  if (State.charts.afterEEG)  { State.charts.afterEEG.destroy();  State.charts.afterEEG=null; }

  State.charts.beforeEEG = Charts.createMultiChannelChart('before-chart', beforeData, '#ff3333');
  State.charts.afterEEG  = Charts.createMultiChannelChart('after-chart',  afterData,  '#00ff88');
}

// ─────────────────────────────────────────────────────────
// SELECT IC
// ─────────────────────────────────────────────────────────

function selectIC(icId) {
  State.selectedIC = icId;

  // Update list highlight
  document.querySelectorAll('.ic-row').forEach(r => {
    r.classList.toggle('selected', r.dataset.ic === icId);
  });

  // Scroll to selected
  const sel = document.querySelector(`.ic-row[data-ic="${icId}"]`);
  if (sel) sel.scrollIntoView({ block:'nearest', behavior:'smooth' });

  // Update dropdown
  const selector = document.getElementById('ic-selector');
  if (selector) selector.value = icId;

  const comp = State.components?.find(c => c.id === icId);
  if (comp) {
    renderICDetail(comp);
    renderICCharts(comp);
    document.getElementById('ica-panel-ic-label')?.textContent &&
      (document.getElementById('ica-panel-ic-label').textContent = icId);
  }

  // Reload EEG tab for new component if ICA tab
  if (State.activeTab === 'ica') loadEEGTab('ica');
}

// ─────────────────────────────────────────────────────────
// HUMAN DECISION
// ─────────────────────────────────────────────────────────

function applyHumanDecision(decision) {
  const ic = State.selectedIC;
  State.humanDecisions[ic] = decision;

  // Update buttons
  document.getElementById('btn-keep')?.classList.toggle('active',   decision==='KEEP');
  document.getElementById('btn-remove')?.classList.toggle('active', decision==='REMOVE');

  // Refresh detail panel badge
  const decBadge = document.getElementById('detail-decision');
  if (decBadge) {
    decBadge.textContent = decision;
    decBadge.className   = 'decision-badge ' + decisionClass(decision);
  }

  // Update neural body
  if (State.neuralBody) State.neuralBody.setDecision(decision);

  // Refresh list row
  const row = document.querySelector(`.ic-row[data-ic="${ic}"]`);
  if (row) {
    row.className = `ic-row ${decisionClass(decision)} selected`;
    const badge   = row.querySelector('.ic-decision-badge');
    if (badge) { badge.textContent = decision; badge.className = `ic-decision-badge ${decisionClass(decision)}`; }

    let flag = row.querySelector('.ic-human-flag');
    if (!flag) {
      flag = document.createElement('span');
      flag.className = 'ic-human-flag'; flag.title = 'Human override'; flag.textContent = 'H';
      row.appendChild(flag);
    }
  }

  showToast(`Decision saved: ${ic} → ${decision}`, decision==='KEEP'?'success':decision==='REMOVE'?'error':'warn');
}

// ─────────────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────

function showToast(msg, type='success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(),400); }, 3000);
}

// ─────────────────────────────────────────────────────────
// SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────

function initSidebar() {
  document.querySelectorAll('.sidebar-nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav-link').forEach(l=>l.classList.remove('active'));
      link.classList.add('active');
      const target = link.dataset.section;
      if (target) {
        document.getElementById(target)?.scrollIntoView({ behavior:'smooth', block:'start' });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────
// BODY VIEW BUTTONS
// ─────────────────────────────────────────────────────────

function initBodyViews() {
  document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn[data-view]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      if (State.neuralBody) State.neuralBody.setView(btn.dataset.view);
    });
  });
}

// ─────────────────────────────────────────────────────────
// FILTER COMPONENT LIST
// ─────────────────────────────────────────────────────────

function initFilter() {
  const sel = document.getElementById('filter-all');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const v = sel.value;
    document.querySelectorAll('.ic-row').forEach(r => {
      const cls = r.classList;
      if (v === 'all') { r.style.display=''; return; }
      r.style.display = cls.contains(v.toLowerCase()) ? '' : 'none';
    });
  });
}

// ─────────────────────────────────────────────────────────
// EEG TAB BUTTONS
// ─────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => loadEEGTab(btn.dataset.tab));
  });
}

// ─────────────────────────────────────────────────────────
// HUMAN REVIEW BUTTONS
// ─────────────────────────────────────────────────────────

function initDecisionButtons() {
  document.getElementById('btn-keep')?.addEventListener('click',   () => applyHumanDecision('KEEP'));
  document.getElementById('btn-remove')?.addEventListener('click', () => applyHumanDecision('REMOVE'));
  document.getElementById('btn-save')?.addEventListener('click',   () => {
    const comment = document.getElementById('review-comment')?.value || '';
    const ic = State.selectedIC;
    const dec = State.humanDecisions[ic];
    showToast(dec ? `Saved: ${ic} = ${dec}${comment?' (commented)':''}` : `No decision selected for ${ic}`, dec?'success':'warn');
  });
}

// ─────────────────────────────────────────────────────────
// SYSTEM STATUS INDICATORS
// ─────────────────────────────────────────────────────────

function updateSystemStatus(session, quality) {
  const setStatus = (id, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('online', ok);
    el.classList.toggle('offline', !ok);
  };
  setStatus('status-backend',   !!session);
  setStatus('status-eeg',       !!(session?.files?.['S002R01_preprocessed_raw.fif']));
  setStatus('status-models',    !!(session?.files?.['S002R01_iclabel.csv']));
  setStatus('status-modules',   !!(session?.files?.['S002R01_neuroagent.csv']));
}

// ─────────────────────────────────────────────────────────
// MAIN BOOT
// ─────────────────────────────────────────────────────────

async function boot() {
  console.log('[NeuroAgent] Booting dashboard...');

  // 1. Start clock
  startClock();
  initSidebar();
  initBodyViews();
  initFilter();
  initTabs();
  initDecisionButtons();

  // 2. Init neural body canvas
  State.neuralBody = new NeuralBodyRenderer('neural-body-canvas');

  // 3. Load all data in parallel
  const [session, components, quality] = await Promise.all([
    DataAdapter.getSession(),
    DataAdapter.getComponents(),
    DataAdapter.getQualityReport(),
  ]);

  State.session    = session;
  State.components = components;
  State.quality    = quality;

  console.log('[NeuroAgent] Data loaded:', { session, components: components?.length, quality });

  // 4. Render all panels
  if (session)    { renderSession(session);  renderPipeline(session.files || {}); }
  if (components) { renderComponentList(components); renderSummary(quality, components); }
  if (quality)    { renderQuality(quality); }

  updateSystemStatus(session, quality);

  // 5. Select default IC (IC9 to match reference, or first component)
  const defaultIC = components?.find(c=>c.id==='IC9') ? 'IC9' : components?.[0]?.id;
  if (defaultIC) selectIC(defaultIC);

  // 6. Load EEG charts (may show placeholder if Python API not running)
  await loadEEGTab('preprocessed');
  await loadMultiChannel();

  showToast('NeuroAgent dashboard loaded — S002R01', 'success');
}

// Boot when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

window.NeuroAgentDashboard = { State, selectIC, applyHumanDecision, loadEEGTab, showToast };
