/**
 * Zero-Dependency Node.js Server for Mock GATE Exam Platform
 * Provides static file serving, question paper management, and multi-user submission tracking.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const PAPERS_DIR = path.join(BASE_DIR, 'data', 'papers');
const SUBMISSIONS_DIR = path.join(BASE_DIR, 'data', 'submissions');
const SETTINGS_FILE = path.join(BASE_DIR, 'data', 'settings.json');
const PARTICIPANTS_FILE = path.join(BASE_DIR, 'data', 'participants.json');

// Ensure directories exist
if (!fs.existsSync(PAPERS_DIR)) fs.mkdirSync(PAPERS_DIR, { recursive: true });
if (!fs.existsSync(SUBMISSIONS_DIR)) fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
if (!fs.existsSync(PARTICIPANTS_FILE)) fs.writeFileSync(PARTICIPANTS_FILE, '[]', 'utf8');

// Ensure default settings exist
if (!fs.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
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
      activePaperFile: 'csir_net_gate_general_aptitude_01.json'
    };
  }
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
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
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
        // Dynamic duration rule: 2 minutes per question
        const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
        paper.totalQuestions = qCount;
        if (!paper.totalMarks) paper.totalMarks = qCount * 2;

        const ps = paper.schedule || {};
        if (!ps.examDate || !ps.startTime || !ps.resultDate || !ps.resultTime) {
          return sendJson(res, 422, { error: 'Paper JSON must include schedule.examDate, startTime, resultDate, and resultTime.' });
        }
        return sendJson(res, 200, paper);
      } catch (err) {
        return sendJson(res, 500, { error: 'Failed to read active paper file.' });
      }
    } else {
      // Fallback to sample paper if active file not in papers dir
      if (fs.existsSync(defaultSamplePaper)) {
        const fallback = JSON.parse(fs.readFileSync(defaultSamplePaper, 'utf8'));
        const qCount = Array.isArray(fallback.questions) ? fallback.questions.length : 0;
        fallback.totalQuestions = qCount;
        return sendJson(res, 200, fallback);
      }
      return sendJson(res, 404, { error: 'No active question paper found.' });
    }
  }

  // 3. Submit Candidate Exam Attempt
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

  // 4. Register every candidate who uses the app, even before they finish an exam.
  if (req.method === 'POST' && pathname === '/api/exam/participant') {
    try {
      const body = await parseJsonBody(req);
      if (!body.candidateName) return sendJson(res, 400, { error: 'Candidate name is required.' });

      const participants = JSON.parse(fs.readFileSync(PARTICIPANTS_FILE, 'utf8'));
      const rollNo = body.rollNo || '-';
      const key = `${body.candidateName.toLowerCase()}_${rollNo.toLowerCase()}`;
      const index = participants.findIndex(item => `${String(item.candidateName || '').toLowerCase()}_${String(item.rollNo || '').toLowerCase()}` === key);
      const participant = {
        candidateName: body.candidateName,
        rollNo,
        registeredAt: body.registeredAt || new Date().toISOString()
      };
      if (index >= 0) participants[index] = { ...participants[index], ...participant };
      else participants.push(participant);
      fs.writeFileSync(PARTICIPANTS_FILE, JSON.stringify(participants, null, 2), 'utf8');
      return sendJson(res, 200, { success: true, participant });
    } catch (error) {
      return sendJson(res, 500, { error: 'Failed to register participant: ' + error.message });
    }
  }

  // 5. Get all registered participants and completed attempts for the leaderboard.
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

    let participants = [];
    try {
      participants = JSON.parse(fs.readFileSync(PARTICIPANTS_FILE, 'utf8'));
    } catch (error) {}

    const participantMap = new Map();
    participants.forEach(participant => {
      const key = `${String(participant.candidateName || '').toLowerCase()}_${String(participant.rollNo || '').toLowerCase()}`;
      participantMap.set(key, participant);
    });
    submissions.forEach(submission => {
      const key = `${submission.candidateName.toLowerCase()}_${String(submission.rollNo || '').toLowerCase()}`;
      const existing = participantMap.get(key);
      if (!existing || !Number.isFinite(Number(existing.score)) || Number(submission.score) > Number(existing.score)) {
        participantMap.set(key, submission);
      }
    });

    const leaderboard = Array.from(participantMap.values()).sort((a, b) => {
      const aHasScore = Number.isFinite(Number(a.score));
      const bHasScore = Number.isFinite(Number(b.score));
      if (aHasScore !== bHasScore) return aHasScore ? -1 : 1;
      if (!aHasScore) return String(a.candidateName).localeCompare(String(b.candidateName));
      return Number(b.score) - Number(a.score) || Number(b.accuracyPercent || 0) - Number(a.accuracyPercent || 0);
    });

    return sendJson(res, 200, {
      totalCandidates: leaderboard.length,
      leaderboard
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
  console.log('====================================================');
});
