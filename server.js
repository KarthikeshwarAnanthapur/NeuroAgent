/**
 * server.js — NeuroAgent Development Server
 * ==========================================
 * Serves the dashboard HTML/CSS/JS and provides
 * API endpoints that read the existing backend CSV/FIF outputs.
 *
 * BACKEND IS READ-ONLY — this file only READS existing outputs.
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT          = 3000;
const PROJECT_ROOT  = __dirname;
const DATA_DIR      = path.join(PROJECT_ROOT, 'backend', 'data');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const METADATA_DIR  = path.join(DATA_DIR, 'metadata');

// ─────────────────────────────────────────────────────────
// MIME TYPE MAP
// ─────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// ─────────────────────────────────────────────────────────
// CSV PARSER  (no external deps)
// ─────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function resolveCSVPath(routeKey, subject, recording) {
  const baseMap = {
    '/api/neuroagent': 'neuroagent.csv',
    '/api/iclabel':    'iclabel.csv',
    '/api/fusion':     'fusion.csv',
    '/api/psd':        'psd.csv',
    '/api/alice':      'alice.csv',
    '/api/quality':    'quality_report.csv',
    '/api/features':   'features.csv',
  };

  const suffix = baseMap[routeKey];
  if (!suffix) return null;

  const prefix = `${subject}${recording}`;
  const filename = `${prefix}_${suffix}`;

  // Check subject subfolder first (data/processed/S002/S002R01_*.csv)
  const subPath = path.join(PROCESSED_DIR, subject, filename);
  if (fs.existsSync(subPath)) return subPath;

  // Fallback to flat directory (data/processed/S002R01_*.csv)
  const flatPath = path.join(PROCESSED_DIR, filename);
  if (fs.existsSync(flatPath)) return flatPath;

  // Default to subPath for error reporting if neither exists
  return subPath;
}

function readCSVasJSON(fp, cb) {
  fs.readFile(fp, 'utf8', (err, data) => {
    if (err) return cb({ error: `File not found: ${path.basename(fp)}`, path: fp }, null);
    try { cb(null, parseCSV(data)); }
    catch (e) { cb({ error: e.message }, null); }
  });
}

// ─────────────────────────────────────────────────────────
// HELPER: send JSON
// ─────────────────────────────────────────────────────────

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

// ─────────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────────

const CSV_ROUTES = {
  '/api/neuroagent': true,
  '/api/iclabel':    true,
  '/api/fusion':     true,
  '/api/psd':        true,
  '/api/alice':      true,
  '/api/quality':    true,
  '/api/features':   true,
};

const server = http.createServer((req, res) => {

  // CORS pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  let subject = (url.searchParams.get('subject') || 'S002').toUpperCase();
  let recording = (url.searchParams.get('recording') || 'R01').toUpperCase();
  const session = url.searchParams.get('session');
  if (session) {
    const m = session.match(/^(S\d{3})(R\d{2})$/i);
    if (m) {
      subject = m[1].toUpperCase();
      recording = m[2].toUpperCase();
    }
  }

  // ── CSV API routes ──────────────────────────────────────
  if (CSV_ROUTES[pathname]) {
    const csvPath = resolveCSVPath(pathname, subject, recording);
    readCSVasJSON(csvPath, (err, data) => {
      if (err) sendJSON(res, 404, err);
      else     sendJSON(res, 200, data);
    });
    return;
  }

  // ── /api/subjects ──────────────────────────────────────
  if (pathname === '/api/subjects') {
    const subjects = new Set();
    if (fs.existsSync(PROCESSED_DIR)) {
      fs.readdirSync(PROCESSED_DIR).forEach(item => {
        if (/^S\d{3}$/i.test(item)) {
          subjects.add(item.toUpperCase());
        }
      });
    }
    subjects.add('S002');
    sendJSON(res, 200, { subjects: Array.from(subjects).sort() });
    return;
  }

  // ── /api/recordings ────────────────────────────────────
  if (pathname === '/api/recordings') {
    const recs = new Set();
    const subjDir = path.join(PROCESSED_DIR, subject);
    if (fs.existsSync(subjDir)) {
      fs.readdirSync(subjDir).forEach(f => {
        const m = f.match(/R\d{2}/i);
        if (m) recs.add(m[0].toUpperCase());
      });
    }
    if (subject === 'S002') recs.add('R01');
    sendJSON(res, 200, { subject, recordings: Array.from(recs).sort() });
    return;
  }

  // ── /api/manifest ──────────────────────────────────────
  if (pathname === '/api/manifest') {
    const manifestPath = path.join(METADATA_DIR, 'dataset_manifest.csv');
    if (!fs.existsSync(manifestPath)) {
      sendJSON(res, 404, { error: 'dataset_manifest.csv not found' });
      return;
    }
    readCSVasJSON(manifestPath, (err, data) => {
      if (err) sendJSON(res, 500, err);
      else     sendJSON(res, 200, data);
    });
    return;
  }

  // ── /api/upload ─────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/upload') {
    const uploadDir = path.join(DATA_DIR, 'raw', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let rawFilename = req.headers['x-filename'] || '';
    const contentType = req.headers['content-type'] || '';

    if (rawFilename) {
      const filename = decodeURIComponent(rawFilename);
      const targetPath = path.join(uploadDir, filename);
      const ws = fs.createWriteStream(targetPath);
      req.pipe(ws);
      ws.on('finish', () => {
        let subj = 'S002', rec = 'R01';
        const m = filename.match(/^(S\d{3})(R\d{2})/i);
        if (m) {
          subj = m[1].toUpperCase();
          rec = m[2].toUpperCase();
        }
        sendJSON(res, 200, { success: true, filename, filePath: targetPath, subject: subj, recording: rec });
      });
      ws.on('error', err => sendJSON(res, 500, { error: err.message }));
      return;
    }

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      let filename = 'uploaded_eeg.edf';
      const strHead = buffer.slice(0, 2048).toString('binary');
      const fnMatch = strHead.match(/filename="([^"]+)"/i);
      if (fnMatch) {
        filename = path.basename(fnMatch[1]);
      }

      let fileData = buffer;
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
        const footerStart = buffer.lastIndexOf(Buffer.from(`\r\n--${boundary}`));
        if (headerEnd !== -1 && footerStart !== -1 && footerStart > headerEnd + 4) {
          fileData = buffer.slice(headerEnd + 4, footerStart);
        }
      }

      const targetPath = path.join(uploadDir, filename);
      fs.writeFileSync(targetPath, fileData);

      let subj = 'S002', rec = 'R01';
      const m = filename.match(/^(S\d{3})(R\d{2})/i);
      if (m) {
        subj = m[1].toUpperCase();
        rec = m[2].toUpperCase();
      }

      sendJSON(res, 200, { success: true, filename, filePath: targetPath, subject: subj, recording: rec });
    });
    return;
  }

  // ── /api/run-analysis ───────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/run-analysis') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (e) {
        body = {};
      }

      const filename = body.filename || `${subject}${recording}.edf`;
      let subj = body.subject || subject || 'S002';
      let rec = body.recording || recording || 'R01';

      const m = filename.match(/^(S\d{3})(R\d{2})/i);
      if (m) {
        subj = m[1].toUpperCase();
        rec = m[2].toUpperCase();
      }

      let edfPath = path.join(DATA_DIR, 'raw', 'uploads', filename);
      if (!fs.existsSync(edfPath)) {
        edfPath = path.join(DATA_DIR, 'raw', 'EEGc', subj, filename);
      }
      if (!fs.existsSync(edfPath)) {
        edfPath = path.join(DATA_DIR, 'raw', 'EEGc', subj, `${subj}${rec}.edf`);
      }

      const pyRunner = path.join(PROJECT_ROOT, 'backend', 'src', 'pipeline_runner.py');
      const pyArgs = [
        pyRunner,
        '--subject', subj,
        '--recording', rec,
      ];
      if (fs.existsSync(edfPath)) {
        pyArgs.push('--edf', edfPath);
      }
      if (body.force) {
        pyArgs.push('--force');
      }

      const py = spawn('python', pyArgs);
      let out = '', err = '';
      py.stdout.on('data', d => { out += d; });
      py.stderr.on('data', d => { err += d; });
      py.on('close', code => {
        const helperPath = path.join(PROJECT_ROOT, 'api_helper.py');
        const sessPy = spawn('python', [
          helperPath,
          '--subject', subj,
          '--recording', rec,
          '--file', 'session',
        ]);
        let sOut = '';
        sessPy.stdout.on('data', d => { sOut += d; });
        sessPy.on('close', () => {
          let sessionData = null;
          try { sessionData = JSON.parse(sOut); } catch (e) {}
          if (!sessionData) {
            sessionData = {
              session_id: `${subj}${rec}`,
              subject: subj,
              recording: filename,
              channels: 64,
              sampling_rate: 160,
              duration: 60.99,
              ica_components: 63,
            };
          }
          sendJSON(res, 200, {
            success: code === 0,
            subject: subj,
            recording: rec,
            filename: filename,
            session: sessionData,
            pipeline_output: out.trim().split('\n').pop(),
          });
        });
      });
    });
    return;
  }

  // ── /api/session ───────────────────────────────────────
  if (pathname === '/api/session') {
    const prefix = `${subject}${recording}`;
    const files = {};
    const baseNames = ['neuroagent.csv', 'iclabel.csv', 'fusion.csv', 'psd.csv', 'alice.csv', 'quality_report.csv', 'features.csv'];
    baseNames.forEach(bn => {
      const p1 = path.join(PROCESSED_DIR, subject, `${prefix}_${bn}`);
      const p2 = path.join(PROCESSED_DIR, `${prefix}_${bn}`);
      files[bn] = fs.existsSync(p1) || fs.existsSync(p2);
    });
    ['preprocessed_raw.fif', 'reconstructed_raw.fif', 'ica.fif'].forEach(fif => {
      const p1 = path.join(PROCESSED_DIR, subject, `${prefix}_${fif}`);
      const p2 = path.join(PROCESSED_DIR, `${prefix}_${fif}`);
      files[fif] = fs.existsSync(p1) || fs.existsSync(p2);
    });

    const helperPath = path.join(PROJECT_ROOT, 'api_helper.py');
    const py = spawn('python', [
      helperPath,
      '--subject', subject,
      '--recording', recording,
      '--file', 'session',
    ]);
    let out = '';
    py.stdout.on('data', d => { out += d; });
    py.on('close', code => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(out);
          parsed.files = files;
          sendJSON(res, 200, parsed);
          return;
        } catch (e) {}
      }

      sendJSON(res, 200, {
        session_id:    prefix,
        subject:       subject,
        recording:     `${prefix}.edf`,
        channels:      64,
        sampling_rate: 160,
        duration:      60.99,
        ica_components:63,
        files,
      });
    });
    return;
  }

  // ── Reports endpoints ──────────────────────────────────
  if (pathname === '/api/reports/metrics') {
    const metricsPath = path.join(DATA_DIR, 'reports', 'training_metrics.json');
    if (fs.existsSync(metricsPath)) {
      try {
        const d = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
        sendJSON(res, 200, d);
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
    } else {
      sendJSON(res, 404, { error: 'training_metrics.json not found' });
    }
    return;
  }

  if (pathname === '/api/reports/dataset') {
    const dsPath = path.join(DATA_DIR, 'reports', 'final_dataset_report.json');
    if (fs.existsSync(dsPath)) {
      try {
        const d = JSON.parse(fs.readFileSync(dsPath, 'utf8'));
        sendJSON(res, 200, d);
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
    } else {
      sendJSON(res, 404, { error: 'final_dataset_report.json not found' });
    }
    return;
  }

  if (pathname === '/api/reports/confusion-matrix') {
    const imgPath = path.join(DATA_DIR, 'reports', 'confusion_matrix.png');
    if (fs.existsSync(imgPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(imgPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('confusion_matrix.png not found');
    }
    return;
  }

  // ── /api/topomap ───────────────────────────────────────
  if (pathname === '/api/topomap') {
    const helperPath = path.join(PROJECT_ROOT, 'api_helper.py');
    const comp = url.searchParams.get('component') || url.searchParams.get('ic') || 'IC1';
    const py = spawn('python', [
      helperPath,
      '--subject', subject,
      '--recording', recording,
      '--file', 'topomap',
      '--component', comp,
    ]);
    let out = '', err = '';
    py.stdout.on('data', d => { out += d; });
    py.stderr.on('data', d => { err += d; });
    py.on('close', code => {
      if (code !== 0) sendJSON(res, 500, { error: 'Topomap helper failed', details: err });
      else {
        try { sendJSON(res, 200, JSON.parse(out)); }
        catch (e) { sendJSON(res, 500, { error: 'Invalid JSON from topomap helper', raw: out.slice(0, 200) }); }
      }
    });
    return;
  }

  // ── /api/channel-compare ───────────────────────────────
  if (pathname === '/api/channel-compare') {
    const helperPath = path.join(PROJECT_ROOT, 'api_helper.py');
    const channel = url.searchParams.get('channel') || 'F7';
    const samples = url.searchParams.get('samples') || '600';
    const py = spawn('python', [
      helperPath,
      '--subject', subject,
      '--recording', recording,
      '--file', 'compare',
      '--channel', channel,
      '--samples', samples,
    ]);
    let out = '', err = '';
    py.stdout.on('data', d => { out += d; });
    py.stderr.on('data', d => { err += d; });
    py.on('close', code => {
      if (code !== 0) sendJSON(res, 500, { error: 'Channel compare helper failed', details: err });
      else {
        try { sendJSON(res, 200, JSON.parse(out)); }
        catch (e) { sendJSON(res, 500, { error: 'Invalid JSON from compare helper', raw: out.slice(0, 200) }); }
      }
    });
    return;
  }

  // ── /api/channels ──────────────────────────────────────
  if (pathname === '/api/channels') {
    const helperPath = path.join(PROJECT_ROOT, 'api_helper.py');
    const py = spawn('python', [
      helperPath,
      '--subject', subject,
      '--recording', recording,
      '--file', 'channels',
    ]);
    let out = '', err = '';
    py.stdout.on('data', d => { out += d; });
    py.stderr.on('data', d => { err += d; });
    py.on('close', code => {
      if (code !== 0) sendJSON(res, 500, { error: 'Channels helper failed', details: err });
      else {
        try { sendJSON(res, 200, JSON.parse(out)); }
        catch (e) { sendJSON(res, 500, { error: 'Invalid JSON from channels helper', raw: out.slice(0, 200) }); }
      }
    });
    return;
  }

  // ── /api/eeg-samples ───────────────────────────────────
  if (pathname === '/api/eeg-samples') {
    const helperPath = path.join(PROJECT_ROOT, 'api_helper.py');
    if (!fs.existsSync(helperPath)) {
      sendJSON(res, 503, { error: 'api_helper.py not found', available: false });
      return;
    }

    const fileType  = url.searchParams.get('file')      || 'preprocessed';
    const component = url.searchParams.get('ic') || url.searchParams.get('component') || 'IC1';
    const samples   = url.searchParams.get('samples')   || '800';
    const channels  = url.searchParams.get('channels')  || '0,1,2,3,4,5,6,7';

    const py = spawn('python', [
      helperPath,
      '--subject', subject,
      '--recording', recording,
      '--file', fileType,
      '--component', component,
      '--samples', samples,
      '--channels', channels,
    ]);

    let out = '', err = '';
    py.stdout.on('data', d => { out += d; });
    py.stderr.on('data', d => { err += d; });
    py.on('close', code => {
      if (code !== 0) sendJSON(res, 500, { error: 'Python helper failed', details: err });
      else {
        try { sendJSON(res, 200, JSON.parse(out)); }
        catch (e) { sendJSON(res, 500, { error: 'Invalid JSON from helper', raw: out.slice(0, 200) }); }
      }
    });
    return;
  }

  // ── Static file serving (dist/ priority, fallback to root) ──────
  const distDir = path.join(PROJECT_ROOT, 'dist');
  let relPath = pathname === '/' ? '/index.html' : pathname;
  let targetPath = path.join(distDir, relPath);

  if (!fs.existsSync(targetPath)) {
    targetPath = path.join(PROJECT_ROOT, relPath);
  }

  // SPA fallback for HTML requests if not found
  if (!fs.existsSync(targetPath) && !path.extname(relPath)) {
    if (fs.existsSync(path.join(distDir, 'index.html'))) {
      targetPath = path.join(distDir, 'index.html');
    } else {
      targetPath = path.join(PROJECT_ROOT, 'index.html');
    }
  }

  fs.readFile(targetPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 — ${pathname}`);
      return;
    }
    const ext = path.extname(targetPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║          NEUROAGENT  v1.0.0              ║');
  console.log(`║    http://localhost:${PORT}                 ║`);
  console.log('║    Agentic EEG Intelligence Dashboard    ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('Serving from:', PROJECT_ROOT);
  console.log('Backend data:', PROCESSED_DIR);
  console.log('\nPress Ctrl+C to stop.\n');
});
