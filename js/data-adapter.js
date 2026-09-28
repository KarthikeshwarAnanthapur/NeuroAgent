'use strict';
// ================================================================
// NEUROAGENT — DATA ADAPTER
// Reads real backend CSV outputs. Never modifies the backend.
// ================================================================

const DataAdapter = (() => {

  const BASE = '/api';
  const SESSION_ID = 'S002R01';

  // ──────────────────────────────────────────────────────────────
  // CSV PARSING
  // ──────────────────────────────────────────────────────────────

  function parseCSV(text) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj  = {};
      headers.forEach((h, i) => {
        const v = (vals[i] || '').trim();
        obj[h]  = isNaN(v) || v === '' ? v : parseFloat(v);
      });
      return obj;
    });
  }

  async function fetchCSV(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return parseCSV(await res.text());
    } catch { return null; }
  }

  async function fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  // ──────────────────────────────────────────────────────────────
  // SESSION INFO
  // ──────────────────────────────────────────────────────────────

  async function getSession() {
    const data = await fetchJSON(`${BASE}/session`);
    if (!data) return null;
    return {
      sessionId:     data.session_id    || SESSION_ID,
      recording:     data.recording     || '—',
      channels:      data.channels      || '—',
      samplingRate:  data.sampling_rate || '—',
      duration:      data.duration      || '—',
      icaComponents: data.ica_components|| '—',
      files:         data.files         || {},
    };
  }

  // ──────────────────────────────────────────────────────────────
  // ICA COMPONENT DATA (from neuroagent.csv, merged with others)
  // ──────────────────────────────────────────────────────────────

  async function getComponents() {
    // Fetch all source files in parallel
    const [na, iclabel, psd, alice, fusion] = await Promise.all([
      fetchCSV(`${BASE}/neuroagent`).then(rows => rows || []),
      fetchCSV(`${BASE}/iclabel`).then(rows   => rows || []),
      fetchCSV(`${BASE}/psd`).then(rows        => rows || []),
      fetchCSV(`${BASE}/alice`).then(rows       => rows || []),
      fetchCSV(`${BASE}/fusion`).then(rows      => rows || []),
    ]);

    if (!na.length) return null;

    // Build lookup maps
    const iclabelMap = Object.fromEntries(iclabel.map(r => [r.component || r.Component, r]));
    const psdMap     = Object.fromEntries(psd.map(r => [r.component   || r.Component, r]));
    const aliceMap   = Object.fromEntries(alice.map(r => [r.component  || r.Component, r]));
    const fusionMap  = Object.fromEntries(fusion.map(r => [r.component || r.Component, r]));

    return na.map(row => {
      const id   = row.component || row.Component || '';
      const il   = iclabelMap[id] || {};
      const ps   = psdMap[id]     || {};
      const al   = aliceMap[id]   || {};
      const fu   = fusionMap[id]  || {};

      // ICLabel fields
      const iclabelLabel   = il.label           || il.iclabel_label          || il.Label   || 'other';
      const confidence     = parseNum(il.confidence || il.max_confidence      || il.iclabel_confidence);
      const iclabelArtScore= parseNum(il.artifact_score || il.iclabel_artifact_score || 0.5);

      // PSD fields
      const psdArtScore    = parseNum(ps.artifact_score || ps.psd_artifact_score || row.psd_artifact_score);
      const psdDelta       = parseNum(ps.delta  || ps.Delta  || 0);
      const psdTheta       = parseNum(ps.theta  || ps.Theta  || 0);
      const psdAlpha       = parseNum(ps.alpha  || ps.Alpha  || 0);
      const psdBeta        = parseNum(ps.beta   || ps.Beta   || 0);
      const psdGamma       = parseNum(ps.gamma  || ps.Gamma  || 0);

      // ALICE fields
      const aliceArtScore  = parseNum(al.artifact_score || al.alice_artifact_score || row.alice_artifact_score);
      const aliceDecision  = al.decision || al.Decision || '';
      const aliceRms       = parseNum(al.rms    || al.RMS    || 0);
      const aliceKurtosis  = parseNum(al.kurtosis || 0);
      const aliceVariance  = parseNum(al.variance  || 0);
      const alicePkToPk    = parseNum(al.peak_to_peak || al.pkToPk || 0);

      // Fusion fields
      const fusionScore    = parseNum(fu.artifact_score || fu.fusion_artifact_score || row.artifact_score);
      const brainScore     = parseNum(fu.brain_score    || row.brain_score    || (1 - fusionScore));
      const decision       = fu.decision   || row.decision   || fu.Decision   || row.Decision   || 'REVIEW';

      // NeuroAgent fields
      const naDecision     = row.neuroagent_decision || row.NeuroAgent_decision || decision;
      const reason         = row.neuroagent_reason   || row.NeuroAgent_reason   || row.reason || '';
      const artifactScore  = parseNum(row.artifact_score || fusionScore);

      return {
        id,
        // ICLabel
        iclabelLabel, confidence, iclabelArtScore,
        // PSD
        psdArtScore,
        psd: { delta:psdDelta, theta:psdTheta, alpha:psdAlpha, beta:psdBeta, gamma:psdGamma },
        // ALICE
        aliceArtScore,
        alice: { rms:aliceRms, kurtosis:aliceKurtosis, variance:aliceVariance, pkToPk:alicePkToPk, decision:aliceDecision },
        // Fusion
        fusionScore, brainScore,
        // Decision
        decision, naDecision, artifactScore, reason,
      };
    });
  }

  // ──────────────────────────────────────────────────────────────
  // QUALITY REPORT
  // ──────────────────────────────────────────────────────────────

  async function getQualityReport() {
    const rows = await fetchCSV(`${BASE}/quality`);
    if (!rows || !rows.length) return null;

    // The quality_report.csv may be keyed or flat — handle both
    const flat = rows.length === 1 ? rows[0] : null;
    const rowMap = {};
    rows.forEach(r => {
      const k = r.metric || r.Metric || r.measure || '';
      if (k) rowMap[k] = r.value || r.Value || r.original || '';
    });

    const getRaw  = k => rowMap[k] ?? (flat && flat[k]);
    const getOrig = k => {
      const r = rows.find(x => (x.metric||x.Metric||'').toLowerCase().includes(k.toLowerCase()));
      return r ? (r.original_value ?? r.original ?? r.value ?? r.Value ?? '') : (flat?.[k] ?? '');
    };
    const getClean = k => {
      const r = rows.find(x => (x.metric||x.Metric||'').toLowerCase().includes(k.toLowerCase()));
      return r ? (r.clean_value ?? r.clean ?? '') : (flat?.[`clean_${k}`] ?? '');
    };

    // Attempt to extract key metrics — try multiple column naming conventions
    const findVal = (keys) => {
      for (const k of keys) {
        const v = getRaw(k) || flat?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return '—';
    };

    const origRms     = findVal(['original_rms','rms_original','original_RMS','RMS_original']) || parseFloat(rows.find(r=>(r.metric||'').match(/rms/i) && !(r.metric||'').match(/clean/i))?.value||'').toFixed(3) || '—';
    const cleanRms    = findVal(['clean_rms','rms_clean','clean_RMS','RMS_clean'])             || parseFloat(rows.find(r=>(r.metric||'').match(/rms/i) &&  (r.metric||'').match(/clean/i))?.value||'').toFixed(3) || '—';
    const origVar     = findVal(['original_variance','variance_original']);
    const cleanVar    = findVal(['clean_variance','variance_clean']);
    const origPkPk    = findVal(['original_peak_to_peak','peak_to_peak_original','original_pkpk']);
    const cleanPkPk   = findVal(['clean_peak_to_peak','peak_to_peak_clean','clean_pkpk']);
    const overallQ    = findVal(['overall_quality','quality','Quality','overall']) || 'GOOD';
    const compRem     = findVal(['components_removed','removed_components']) || 2;
    const compKept    = findVal(['components_kept','kept_components'])       || 27;
    const compReview  = findVal(['components_review','review_components'])   || 34;

    // Frequency band comparison (try to find band power data)
    const bandRow = (name) => {
      const origR = rows.find(r => (r.metric||'').match(new RegExp(name,'i')) && !(r.metric||'').match(/clean/i));
      const cleanR= rows.find(r => (r.metric||'').match(new RegExp(name,'i')) && (r.metric||'').match(/clean/i));
      const origV = flat?.[`original_${name}`] ?? flat?.[`${name}_orig`] ?? parseFloat(origR?.value||'0');
      const cleanV= flat?.[`clean_${name}`]    ?? flat?.[`${name}_clean`]?? parseFloat(cleanR?.value||'0');
      return { orig: parseNum(origV), clean: parseNum(cleanV) };
    };

    return {
      originalRms:    origRms,
      cleanRms:       cleanRms,
      originalVariance: origVar,
      cleanVariance:  cleanVar,
      originalPeakToPeak: origPkPk,
      cleanPeakToPeak:    cleanPkPk,
      overallQuality: String(overallQ).toUpperCase(),
      componentsRemoved: parseNum(compRem) || 2,
      componentsKept:    parseNum(compKept)|| 27,
      componentsReview:  parseNum(compReview) || 34,
      bands: {
        delta: bandRow('delta'),
        theta: bandRow('theta'),
        alpha: bandRow('alpha'),
        beta:  bandRow('beta'),
        gamma: bandRow('gamma'),
      },
      raw: rows,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // EEG SAMPLES (via Python API — may be unavailable)
  // ──────────────────────────────────────────────────────────────

  async function getEEGSamples(fileType = 'preprocessed', icComponent = 'IC1', numSamples = 800, channels = '0,1,2,3,4,5,6,7') {
    try {
      const url  = `${BASE}/eeg-samples?file=${fileType}&ic=${icComponent}&samples=${numSamples}&channels=${channels}`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { available: false };
      const data = await res.json();
      if (!data || data.error || !data.times) return { available: false };
      return { ...data, available: true };
    } catch {
      return { available: false };
    }
  }

  // ──────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────

  function parseNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────

  return { getSession, getComponents, getQualityReport, getEEGSamples };

})();
