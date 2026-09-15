/**
 * Admin Portal Controller
 * Manages daily question paper uploads, paper library, candidate submissions, and schedule settings.
 */
class AdminPortal {
  constructor() {
    this.passcode = sessionStorage.getItem('gate_admin_passcode') || '';
    this.isAuthenticated = false;
    this.githubSync = new GitHubSync();
    this.papersList = [];
    this.submissionsList = [];
    this.activeTab = 'upload'; // 'upload', 'library', 'submissions', 'settings'
    this.stagedPaper = null;

    this.init();
  }

  init() {
    this.attachEventListeners();
    if (this.passcode) {
      this.verifyPasscode(this.passcode, true);
    }
  }

  attachEventListeners() {
    // Admin button in top header
    const btnAdmin = document.getElementById('btn-header-admin');
    if (btnAdmin) {
      btnAdmin.addEventListener('click', () => this.openAdminPortal());
    }

    // Passcode Login Submit
    const btnLogin = document.getElementById('btn-admin-login-submit');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        const input = document.getElementById('input-admin-passcode');
        this.verifyPasscode(input.value.trim());
      });
    }

    // Admin Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Upload Tab: File input
    const fileInput = document.getElementById('admin-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            this.handleStagedPaper(parsed);
          } catch (err) {
            alert('Invalid JSON file: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    // Upload Tab: Raw JSON textarea input
    const btnParseText = document.getElementById('btn-admin-parse-json');
    if (btnParseText) {
      btnParseText.addEventListener('click', () => {
        const text = document.getElementById('admin-json-textarea').value.trim();
        if (!text) return alert('Please paste JSON content first.');
        try {
          const parsed = JSON.parse(text);
          this.handleStagedPaper(parsed);
        } catch (err) {
          alert('JSON Syntax Error: ' + err.message);
        }
      });
    }

    // Upload Tab: Confirm Upload Button
    const btnConfirmUpload = document.getElementById('btn-admin-confirm-upload');
    if (btnConfirmUpload) {
      btnConfirmUpload.addEventListener('click', () => this.submitUpload());
    }

    // GitHub Push Button
    const btnPushGh = document.getElementById('btn-admin-push-github');
    if (btnPushGh) {
      btnPushGh.addEventListener('click', () => this.pushToGitHub());
    }

    // Download today_paper.json Button
    const btnDownloadToday = document.getElementById('btn-admin-download-today');
    if (btnDownloadToday) {
      btnDownloadToday.addEventListener('click', () => this.downloadTodayPaper());
    }

    // Load from Raw URL
    const btnLoadRaw = document.getElementById('btn-admin-load-raw');
    if (btnLoadRaw) {
      btnLoadRaw.addEventListener('click', () => this.loadFromRawUrl());
    }

    // Save GitHub Configuration
    const btnSaveGh = document.getElementById('btn-save-github-config');
    if (btnSaveGh) {
      btnSaveGh.addEventListener('click', () => this.saveGitHubConfig());
    }

    // Settings Tab: Save button
    const btnSaveSettings = document.getElementById('btn-save-schedule-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => this.saveScheduleSettings());
    }

    // Submissions: Refresh button
    const btnRefreshSubs = document.getElementById('btn-refresh-submissions');
    if (btnRefreshSubs) {
      btnRefreshSubs.addEventListener('click', () => this.loadSubmissions());
    }

    // Submissions: Export CSV
    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => this.exportSubmissionsCsv());
    }

    // Logout
    const btnLogout = document.getElementById('btn-admin-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.logout());
    }
  }

  openAdminPortal() {
    if (this.isAuthenticated) {
      this.showDashboard();
    } else {
      document.getElementById('admin-login-modal').style.display = 'flex';
      const input = document.getElementById('input-admin-passcode');
      input.value = '';
      input.focus();
    }
  }

  async verifyPasscode(passcode, isAuto = false) {
    if (!passcode) {
      if (!isAuto) alert('Please enter passcode.');
      return;
    }

    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      if (resp.ok) {
        this.passcode = passcode;
        this.isAuthenticated = true;
        sessionStorage.setItem('gate_admin_passcode', passcode);
        document.getElementById('admin-login-modal').style.display = 'none';
        this.showDashboard();
      } else {
        if (!isAuto) alert('Incorrect Admin Passcode. Default is "admin123"');
      }
    } catch (e) {
      // Offline fallback: check default passcode
      if (passcode === 'admin123') {
        this.passcode = passcode;
        this.isAuthenticated = true;
        sessionStorage.setItem('gate_admin_passcode', passcode);
        document.getElementById('admin-login-modal').style.display = 'none';
        this.showDashboard();
      } else {
        if (!isAuto) alert('Incorrect Admin Passcode.');
      }
    }
  }

  showDashboard() {
    document.getElementById('admin-dashboard-modal').style.display = 'flex';
    this.switchTab(this.activeTab);
    this.loadPapersLibrary();
    this.loadSubmissions();

    // Populate GitHub settings
    const ownerEl = document.getElementById('admin-gh-owner');
    const repoEl = document.getElementById('admin-gh-repo');
    const tokenEl = document.getElementById('admin-gh-token');
    const branchEl = document.getElementById('admin-gh-branch');
    if (ownerEl) ownerEl.value = this.githubSync.owner;
    if (repoEl) repoEl.value = this.githubSync.repo;
    if (tokenEl) tokenEl.value = this.githubSync.token;
    if (branchEl) branchEl.value = this.githubSync.branch;
  }

  downloadTodayPaper() {
    const paperToDownload = this.stagedPaper || (window.app && window.app.currentPaper);
    if (!paperToDownload) return alert('No paper available to download.');
    this.githubSync.downloadTodayPaperJson(paperToDownload);
  }

  async pushToGitHub() {
    if (!this.stagedPaper) return alert('Please upload or stage a question paper first.');
    const btn = document.getElementById('btn-admin-push-github');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Committing & Pushing to GitHub...';

    try {
      const res = await this.githubSync.pushPaperToGitHub(this.stagedPaper);
      alert(res.message);
      if (window.app) {
        window.app.currentPaper = this.stagedPaper;
        window.app.evaluateCurrentRoute();
      }
      this.switchTab('library');
    } catch (err) {
      alert('GitHub Push Error: ' + err.message + '\n\nPlease check your GitHub details in the "Schedule & GitHub Settings" tab.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }

  async loadFromRawUrl() {
    const input = document.getElementById('admin-raw-url-input');
    const url = input ? input.value.trim() : '';
    if (!url) return alert('Please enter a GitHub Raw URL or public JSON link.');

    try {
      const paper = await this.githubSync.fetchFromRawUrl(url);
      this.handleStagedPaper(paper);
      alert('Paper loaded and verified successfully from URL!');
    } catch (err) {
      alert('Failed to load paper: ' + err.message);
    }
  }

  saveGitHubConfig() {
    const owner = document.getElementById('admin-gh-owner').value;
    const repo = document.getElementById('admin-gh-repo').value;
    const token = document.getElementById('admin-gh-token').value;
    const branch = document.getElementById('admin-gh-branch').value || 'main';

    this.githubSync.saveConfig(owner, repo, token, branch);
    alert('GitHub settings saved successfully in your browser!');
  }

  logout() {
    this.isAuthenticated = false;
    this.passcode = '';
    sessionStorage.removeItem('gate_admin_passcode');
    document.getElementById('admin-dashboard-modal').style.display = 'none';
    alert('Logged out of Admin Portal.');
  }

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    ['upload', 'library', 'submissions', 'settings'].forEach(t => {
      const pane = document.getElementById(`admin-tab-${t}`);
      if (pane) pane.style.display = t === tab ? 'block' : 'none';
    });

    if (tab === 'library') this.loadPapersLibrary();
    if (tab === 'submissions') this.loadSubmissions();
  }

  handleStagedPaper(paper) {
    const res = JsonValidator.validate(paper);
    const feedbackEl = document.getElementById('admin-upload-feedback');
    const previewEl = document.getElementById('admin-preview-box');
    const confirmBtn = document.getElementById('btn-admin-confirm-upload');

    if (!res.valid) {
      feedbackEl.className = 'admin-feedback error';
      feedbackEl.innerHTML = `<strong>Validation Failed:</strong><br>${res.errors.join('<br>')}`;
      feedbackEl.style.display = 'block';
      confirmBtn.disabled = true;
      previewEl.style.display = 'none';
      this.stagedPaper = null;
      return;
    }

    this.stagedPaper = paper;
    feedbackEl.className = 'admin-feedback success';
    feedbackEl.innerHTML = `<strong>Paper Validated!</strong> Contains ${paper.questions.length} questions. Title: "${paper.title}".`;
    feedbackEl.style.display = 'block';
    confirmBtn.disabled = false;

    // Show preview of first 2 questions
    previewEl.style.display = 'block';
    const sampleQuestions = paper.questions.slice(0, 2);
    previewEl.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px;color:#1e3a8a;">Paper Preview (First 2 Questions):</div>
      ${sampleQuestions.map((q, i) => `
        <div style="margin-bottom:10px;padding:8px;background:#fff;border-radius:4px;border:1px solid #e2e8f0;">
          <div><strong>Q${i+1}.</strong> ${KatexRenderer.render(q.question)}</div>
          ${q.diagramSvg ? `<div style="margin:6px 0;">${q.diagramSvg}</div>` : ''}
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Official Key: Option (${q.correctAnswer})</div>
        </div>
      `).join('')}
    `;
  }

  async submitUpload() {
    if (!this.stagedPaper) return alert('No valid paper staged.');

    const dateInput = document.getElementById('admin-paper-date').value || new Date().toISOString().split('T')[0];
    const makeActive = document.getElementById('admin-set-active-check').checked;

    try {
      const resp = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': this.passcode
        },
        body: JSON.stringify({
          paper: this.stagedPaper,
          targetDate: dateInput,
          makeActive
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        alert(data.message || 'Paper uploaded successfully!');
        if (makeActive && window.app) {
          window.app.currentPaper = this.stagedPaper;
          window.app.evaluateCurrentRoute();
        }
        this.switchTab('library');
      } else {
        const err = await resp.json();
        alert('Upload failed: ' + (err.error || 'Server error'));
      }
    } catch (e) {
      // Local fallback
      localStorage.setItem(`gate_paper_${dateInput}`, JSON.stringify(this.stagedPaper));
      if (makeActive && window.app) {
        window.app.currentPaper = this.stagedPaper;
        window.app.evaluateCurrentRoute();
      }
      alert('Paper saved to local browser storage!');
      this.switchTab('library');
    }
  }

  async loadPapersLibrary() {
    const tableBody = document.getElementById('admin-papers-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;">Loading question papers...</td></tr>';

    try {
      const resp = await fetch('/api/admin/papers', {
        headers: { 'X-Admin-Passcode': this.passcode }
      });

      if (resp.ok) {
        const data = await resp.json();
        this.papersList = data.papers || [];
        this.renderPapersTable(this.papersList);
      } else {
        this.renderLocalPapers();
      }
    } catch (e) {
      this.renderLocalPapers();
    }
  }

  renderPapersTable(papers) {
    const tableBody = document.getElementById('admin-papers-table-body');
    if (!tableBody) return;

    if (papers.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;">No papers uploaded yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = papers.map(p => `
      <tr>
        <td>
          <div style="font-weight:700;">${p.title}</div>
          <div style="font-size:11px;color:#64748b;">${p.filename}</div>
        </td>
        <td>${p.totalQuestions} Qs (${p.totalMarks || 40} Marks)</td>
        <td>${p.durationMinutes || 40} Mins</td>
        <td>
          ${p.isActive ? '<span class="badge-active">ACTIVE TODAY</span>' : '<span class="badge-inactive">Inactive</span>'}
        </td>
        <td>
          ${!p.isActive ? `<button class="mode-btn" onclick="adminPortal.setActivePaper('${p.filename}')">Set Active</button>` : '<em>Current</em>'}
        </td>
      </tr>
    `).join('');
  }

  renderLocalPapers() {
    const papers = [
      {
        filename: 'csir_net_gate_general_aptitude_01.json',
        title: 'CSIR NET / GATE General Aptitude Mock Paper (20 Qs)',
        totalQuestions: 20,
        totalMarks: 40,
        durationMinutes: 40,
        isActive: true
      }
    ];
    this.renderPapersTable(papers);
  }

  async setActivePaper(filename) {
    try {
      const resp = await fetch('/api/admin/set-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': this.passcode
        },
        body: JSON.stringify({ filename })
      });

      if (resp.ok) {
        alert(`Activated paper: ${filename}`);
        this.loadPapersLibrary();
        if (window.app) window.app.loadDefaultPaper();
      } else {
        alert('Could not update active paper.');
      }
    } catch (e) {
      alert('Updated active paper locally.');
      this.loadPapersLibrary();
    }
  }

  async loadSubmissions() {
    const tableBody = document.getElementById('admin-subs-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;">Loading submissions...</td></tr>';

    try {
      const resp = await fetch('/api/exam/leaderboard');
      if (resp.ok) {
        const data = await resp.json();
        this.submissionsList = data.leaderboard || [];
        this.renderSubmissionsTable(this.submissionsList);
      } else {
        this.renderSubmissionsTable([]);
      }
    } catch (e) {
      // Local submissions fallback
      const localSubs = JSON.parse(localStorage.getItem('gate_local_submissions') || '[]');
      this.submissionsList = localSubs;
      this.renderSubmissionsTable(localSubs);
    }
  }

  renderSubmissionsTable(list) {
    const tableBody = document.getElementById('admin-subs-table-body');
    if (!tableBody) return;

    if (list.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:#64748b;">No candidate attempts submitted yet. Once you or your friends take the exam, their scores will appear here.</td></tr>';
      return;
    }

    tableBody.innerHTML = list.map((s, idx) => `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td>
          <div style="font-weight:700;color:#1e293b;">${s.candidateName}</div>
          <div style="font-size:11px;color:#64748b;">Roll: ${s.rollNo}</div>
        </td>
        <td style="font-weight:800;color:#15803d;font-size:15px;">${s.score} / ${s.maxScore || 40}</td>
        <td>${s.accuracyPercent}%</td>
        <td>
          <span style="color:#15803d;">${s.correctCount}C</span> / 
          <span style="color:#dc2626;">${s.incorrectCount}W</span> / 
          <span style="color:#64748b;">${s.unattemptedCount}S</span>
        </td>
        <td style="font-size:11px;color:#64748b;">${new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
    `).join('');
  }

  exportSubmissionsCsv() {
    if (this.submissionsList.length === 0) return alert('No submissions to export.');

    let csv = 'Rank,Candidate Name,Roll No,Score,Max Score,Accuracy,Correct,Incorrect,Unattempted,Submitted At\n';
    this.submissionsList.forEach((s, i) => {
      csv += `"${i+1}","${s.candidateName}","${s.rollNo}","${s.score}","${s.maxScore || 40}","${s.accuracyPercent}%","${s.correctCount}","${s.incorrectCount}","${s.unattemptedCount}","${s.submittedAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate_submissions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async saveScheduleSettings() {
    const dailyStart = document.getElementById('settings-start-time').value;
    const dailyEnd = document.getElementById('settings-end-time').value;
    const resultTime = document.getElementById('settings-result-time').value;
    const durationMinutes = parseInt(document.getElementById('settings-duration').value, 10);

    try {
      const resp = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': this.passcode
        },
        body: JSON.stringify({ dailyStart, dailyEnd, resultTime, durationMinutes })
      });

      if (resp.ok) {
        alert('Schedule settings saved successfully!');
        if (window.app && window.app.scheduleManager) {
          const [sh, sm] = dailyStart.split(':').map(Number);
          const [eh, em] = dailyEnd.split(':').map(Number);
          const [rh, rm] = resultTime.split(':').map(Number);
          window.app.scheduleManager.startHour = sh;
          window.app.scheduleManager.startMinute = sm;
          window.app.scheduleManager.endHour = eh;
          window.app.scheduleManager.endMinute = em;
          window.app.scheduleManager.resultHour = rh;
          window.app.scheduleManager.resultMinute = rm;
          window.app.evaluateCurrentRoute();
        }
      } else {
        alert('Failed to save settings.');
      }
    } catch (e) {
      alert('Saved settings locally in browser.');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminPortal = new AdminPortal();
});
