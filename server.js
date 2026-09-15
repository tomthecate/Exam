/**
 * Zero-Dependency Node.js Server for Mock GATE Exam Platform
 * Provides static file serving, question paper management, and multi-user submission tracking.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin123';

const BASE_DIR = __dirname;
const PAPERS_DIR = path.join(BASE_DIR, 'data', 'papers');
const SUBMISSIONS_DIR = path.join(BASE_DIR, 'data', 'submissions');
const SETTINGS_FILE = path.join(BASE_DIR, 'data', 'settings.json');

// Ensure directories exist
if (!fs.existsSync(PAPERS_DIR)) fs.mkdirSync(PAPERS_DIR, { recursive: true });
if (!fs.existsSync(SUBMISSIONS_DIR)) fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

// Ensure default settings exist
if (!fs.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
    dailyStart: '21:00',
    dailyEnd: '21:40',
    resultTime: '21:50',
    durationMinutes: 40,
    activePaperFile: 'csir_net_gate_general_aptitude_01.json'
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf8');
}

// Copy sample paper to papers dir if missing
const defaultSamplePaper = path.join(BASE_DIR, 'data', 'sample_paper_csir_gate.json');
const targetSampleInPapers = path.join(PAPERS_DIR, 'csir_net_gate_general_aptitude_01.json');
if (fs.existsSync(defaultSamplePaper) && !fs.existsSync(targetSampleInPapers)) {
  fs.copyFileSync(defaultSamplePaper, targetSampleInPapers);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) {
    return {
      dailyStart: '21:00',
      dailyEnd: '21:40',
      resultTime: '21:50',
      durationMinutes: 40,
      activePaperFile: 'csir_net_gate_general_aptitude_01.json'
    };
  }
}

function saveSettings(newSettings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Passcode'
  });
  res.end(JSON.stringify(data));
}

function checkAdminAuth(req) {
  const passcode = req.headers['x-admin-passcode'];
  return passcode === ADMIN_PASSCODE;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Passcode'
    });
    return res.end();
  }

  // --- REST API ROUTES ---

  // 1. Check Server Status & Time
  if (req.method === 'GET' && pathname === '/api/status') {
    const settings = getSettings();
    return sendJson(res, 200, {
      status: 'online',
      serverTime: new Date().toISOString(),
      settings
    });
  }

  // 2. Get Active Question Paper for Today
  if (req.method === 'GET' && pathname === '/api/paper/today') {
    const settings = getSettings();
    const activeFile = path.join(PAPERS_DIR, settings.activePaperFile || 'csir_net_gate_general_aptitude_01.json');
    if (fs.existsSync(activeFile)) {
      try {
        const paper = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
        // Merge schedule settings
        paper.schedule = {
          dailyStart: settings.dailyStart || '21:00',
          dailyEnd: settings.dailyEnd || '21:40',
          resultTime: settings.resultTime || '21:50'
        };
        paper.durationMinutes = settings.durationMinutes || paper.durationMinutes || 40;
        return sendJson(res, 200, paper);
      } catch (err) {
        return sendJson(res, 500, { error: 'Failed to read active paper file.' });
      }
    } else {
      // Fallback to sample paper if active file not in papers dir
      if (fs.existsSync(defaultSamplePaper)) {
        const fallback = JSON.parse(fs.readFileSync(defaultSamplePaper, 'utf8'));
        return sendJson(res, 200, fallback);
      }
      return sendJson(res, 404, { error: 'No active question paper found.' });
    }
  }

  // 3. Admin: Verify Passcode
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    try {
      const body = await parseJsonBody(req);
      if (body.passcode === ADMIN_PASSCODE) {
        return sendJson(res, 200, { success: true, message: 'Authenticated successfully.' });
      } else {
        return sendJson(res, 401, { error: 'Invalid admin passcode.' });
      }
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid request.' });
    }
  }

  // 4. Admin: List All Uploaded Papers
  if (req.method === 'GET' && pathname === '/api/admin/papers') {
    if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized. Admin passcode required.' });

    const settings = getSettings();
    const files = fs.readdirSync(PAPERS_DIR).filter(f => f.endsWith('.json'));
    const papersList = files.map(file => {
      const filePath = path.join(PAPERS_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          paperId: data.paperId || file.replace('.json', ''),
          title: data.title || file,
          totalQuestions: data.questions ? data.questions.length : 0,
          totalMarks: data.totalMarks || 40,
          durationMinutes: data.durationMinutes || 40,
          uploadedAt: stats.mtime,
          isActive: file === settings.activePaperFile
        };
      } catch (e) {
        return { filename: file, error: 'Corrupted file', isActive: false };
      }
    });

    return sendJson(res, 200, { papers: papersList, settings });
  }

  // 5. Admin: Upload Question Paper
  if (req.method === 'POST' && pathname === '/api/admin/upload') {
    if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized. Admin passcode required.' });

    try {
      const body = await parseJsonBody(req);
      const paperData = body.paper;
      const targetDate = body.targetDate || new Date().toISOString().split('T')[0]; // e.g. "2026-09-15"
      const makeActive = body.makeActive !== false;

      if (!paperData || !paperData.questions || !Array.isArray(paperData.questions)) {
        return sendJson(res, 400, { error: 'Invalid paper data format. Missing questions array.' });
      }

      // Generate filename based on date or title
      const sanitizedTitle = (paperData.title || 'paper').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const filename = `${targetDate}_${sanitizedTitle.slice(0, 30)}.json`;
      const filePath = path.join(PAPERS_DIR, filename);

      fs.writeFileSync(filePath, JSON.stringify(paperData, null, 2), 'utf8');

      if (makeActive) {
        const settings = getSettings();
        settings.activePaperFile = filename;
        saveSettings(settings);
      }

      return sendJson(res, 200, {
        success: true,
        message: `Paper "${paperData.title}" uploaded and saved as ${filename}.`,
        filename,
        isActive: makeActive
      });
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to upload paper: ' + err.message });
    }
  }

  // 6. Admin: Set Active Paper
  if (req.method === 'POST' && pathname === '/api/admin/set-active') {
    if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized. Admin passcode required.' });

    try {
      const body = await parseJsonBody(req);
      const filename = body.filename;
      if (!filename || !fs.existsSync(path.join(PAPERS_DIR, filename))) {
        return sendJson(res, 404, { error: 'File not found in question papers library.' });
      }

      const settings = getSettings();
      settings.activePaperFile = filename;
      saveSettings(settings);

      return sendJson(res, 200, { success: true, message: `Active paper updated to ${filename}.` });
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid request.' });
    }
  }

  // 7. Admin: Update Schedule Settings
  if (req.method === 'POST' && pathname === '/api/admin/settings') {
    if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized. Admin passcode required.' });

    try {
      const body = await parseJsonBody(req);
      const settings = getSettings();
      if (body.dailyStart) settings.dailyStart = body.dailyStart;
      if (body.dailyEnd) settings.dailyEnd = body.dailyEnd;
      if (body.resultTime) settings.resultTime = body.resultTime;
      if (body.durationMinutes) settings.durationMinutes = parseInt(body.durationMinutes, 10);

      saveSettings(settings);
      return sendJson(res, 200, { success: true, settings });
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid settings update.' });
    }
  }

  // 8. Submit Candidate Exam Attempt
  if (req.method === 'POST' && pathname === '/api/exam/submit') {
    try {
      const submission = await parseJsonBody(req);
      if (!submission.candidateName) {
        return sendJson(res, 400, { error: 'Candidate name is required.' });
      }

      const safeName = submission.candidateName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}_${safeName}.json`;
      const filePath = path.join(SUBMISSIONS_DIR, filename);

      fs.writeFileSync(filePath, JSON.stringify(submission, null, 2), 'utf8');

      return sendJson(res, 200, {
        success: true,
        submissionId: filename,
        message: 'Exam submitted and recorded successfully.'
      });
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to record submission: ' + err.message });
    }
  }

  // 9. Get Submissions & Leaderboard
  if (req.method === 'GET' && pathname === '/api/exam/leaderboard') {
    const files = fs.readdirSync(SUBMISSIONS_DIR).filter(f => f.endsWith('.json'));
    const submissions = files.map(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, file), 'utf8'));
        return {
          candidateName: data.candidateName || 'Anonymous',
          rollNo: data.rollNo || '-',
          score: data.score ?? 0,
          maxScore: data.maxScore ?? 40,
          accuracyPercent: data.accuracyPercent ?? 0,
          correctCount: data.correctCount ?? 0,
          incorrectCount: data.incorrectCount ?? 0,
          unattemptedCount: data.unattemptedCount ?? 0,
          submittedAt: data.submittedAt || data.timestamp || fs.statSync(path.join(SUBMISSIONS_DIR, file)).mtime
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // Sort by score descending, then accuracy descending
    submissions.sort((a, b) => b.score - a.score || b.accuracyPercent - a.accuracyPercent);

    return sendJson(res, 200, {
      totalCandidates: submissions.length,
      leaderboard: submissions
    });
  }

  // --- STATIC FILE SERVING ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Find Local Network IP to share with friend
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log('====================================================');
  console.log('  MOCK GATE CBT EXAMINATION SERVER STARTED');
  console.log('====================================================');
  console.log(`  Local URL:        http://localhost:${PORT}`);
  console.log(`  Friend Wi-Fi URL: http://${localIp}:${PORT}`);
  console.log(`  Admin Passcode:   ${ADMIN_PASSCODE}`);
  console.log('====================================================');
});
