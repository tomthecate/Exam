/**
 * Main Application Orchestrator
 */
class GateMockApp {
  constructor() {
    this.currentPaper = null;
    this.examEngine = null;
    this.scheduleManager = new ScheduleManager();
    this.calculator = new GateCalculator('gate-calculator-container');
    this.leaderboardSync = new LeaderboardSync();
    this.currentResult = null;
    this.latestSubmission = null;
    this.activeFilter = 'ALL'; // 'ALL', 'CORRECT', 'INCORRECT', 'UNATTEMPTED'

    this.init();
  }

  async init() {
    // 1. Attach listeners FIRST so UI clicks and form submissions never fail or trigger page reloads
    this.attachEventListeners();
    // 2. Initialize candidate profile with multi-storage persistence
    this.initCandidateProfile();
    // 3. Tickers and score checking
    this.setupScheduleTicker();
    this.checkImportedFriendScore();
    // 4. Load paper
    await this.loadDefaultPaper();
    // 5. Evaluate route
    this.evaluateCurrentRoute();
  }

  checkImportedFriendScore() {
    const imported = this.leaderboardSync.checkUrlParams();
    if (imported) {
      setTimeout(() => {
        alert(`🎉 Friend's Score Imported!\n${imported.candidateName} scored ${imported.score}/${imported.maxScore || 40} (${imported.accuracyPercent}% accuracy).\nCheck the Leaderboard to see your rankings!`);
      }, 800);
    }
  }

  getSavedCandidate() {
    // 1. Current in-memory candidate
    if (this.candidate && this.candidate.name && this.candidate.name.trim() && this.candidate.name !== 'Candidate') {
      return this.candidate;
    }
    if (window._gate_candidate && window._gate_candidate.name && window._gate_candidate.name.trim() && window._gate_candidate.name !== 'Candidate') {
      return window._gate_candidate;
    }

    // 2. LocalStorage
    try {
      const ls = localStorage.getItem('gate_candidate');
      if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed && parsed.name && parsed.name.trim() && parsed.name !== 'Candidate') {
          return parsed;
        }
      }
    } catch (e) {}

    // 3. SessionStorage
    try {
      const ss = sessionStorage.getItem('gate_candidate');
      if (ss) {
        const parsed = JSON.parse(ss);
        if (parsed && parsed.name && parsed.name.trim() && parsed.name !== 'Candidate') {
          return parsed;
        }
      }
    } catch (e) {}

    // 4. Document Cookie
    try {
      const match = document.cookie.match(/(?:^|;\s*)gate_candidate=([^;]+)/);
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (parsed && parsed.name && parsed.name.trim() && parsed.name !== 'Candidate') {
          return parsed;
        }
      }
    } catch (e) {}

    return null;
  }

  initCandidateProfile() {
    const saved = this.getSavedCandidate();
    if (saved) {
      this.candidate = saved;
      window._gate_candidate = saved;
      this.updateCandidateHeader();
      const modal = document.getElementById('candidate-login-modal');
      if (modal) modal.style.display = 'none';
      return;
    }

    // Default candidate state if not yet set
    this.candidate = {
      name: 'Candidate',
      rollNo: `GATE-${Math.floor(1000 + Math.random() * 9000)}`
    };
    this.updateCandidateHeader();

    // Check server if running with backend
    try {
      fetch('/api/candidate')
        .then(r => r.ok ? r.json() : null)
        .then(serverCand => {
          if (serverCand && serverCand.name && serverCand.name.trim() && serverCand.name !== 'Candidate') {
            this.setCandidate(serverCand.name, serverCand.rollNo);
            const modal = document.getElementById('candidate-login-modal');
            if (modal) modal.style.display = 'none';
          }
        })
        .catch(() => {});
    } catch (e) {}

    // Prompt candidate details on first visit if not saved
    setTimeout(() => {
      if (this.candidate && this.candidate.name && this.candidate.name.trim() && this.candidate.name !== 'Candidate') {
        return;
      }
      const modal = document.getElementById('candidate-login-modal');
      if (modal) {
        modal.style.display = 'flex';
        const inputName = document.getElementById('input-candidate-name');
        if (inputName) inputName.focus();
      }
    }, 400);
  }

  updateCandidateHeader() {
    if (!this.candidate) return;

    // Header candidate display
    const nameEl = document.querySelector('.candidate-name');
    const rollEl = document.querySelector('.candidate-id');
    const avatarEl = document.querySelector('.candidate-avatar');
    if (nameEl) nameEl.textContent = this.candidate.name;
    if (rollEl) rollEl.textContent = this.candidate.rollNo;
    if (avatarEl) avatarEl.textContent = (this.candidate.name[0] || 'C').toUpperCase();

    // Exam palette sidebar candidate display
    const examNameEl = document.getElementById('exam-cand-name');
    const examRollEl = document.getElementById('exam-cand-roll');
    const examAvatarEl = document.getElementById('exam-cand-avatar');
    const examSubjectEl = document.getElementById('exam-cand-subject');

    if (examNameEl) examNameEl.textContent = this.candidate.name;
    if (examRollEl) examRollEl.textContent = `Roll: ${this.candidate.rollNo}`;
    if (examAvatarEl) examAvatarEl.textContent = (this.candidate.name[0] || 'C').toUpperCase();
    if (examSubjectEl && this.currentPaper) examSubjectEl.textContent = this.currentPaper.title || 'General Aptitude';

    // Candidate modal inputs prefill
    const inputName = document.getElementById('input-candidate-name');
    const inputRoll = document.getElementById('input-candidate-roll');
    if (inputName && this.candidate.name && this.candidate.name !== 'Candidate') {
      inputName.value = this.candidate.name;
    }
    if (inputRoll && this.candidate.rollNo) {
      inputRoll.value = this.candidate.rollNo;
    }
  }

  setCandidate(name, rollNo) {
    const cleanName = (name || 'Candidate').trim();
    const cleanRoll = (rollNo || (this.candidate && this.candidate.rollNo) || `GATE-${Math.floor(1000 + Math.random() * 9000)}`).trim();

    this.candidate = {
      name: cleanName,
      rollNo: cleanRoll
    };
    window._gate_candidate = this.candidate;

    // 1. LocalStorage
    try {
      localStorage.setItem('gate_candidate', JSON.stringify(this.candidate));
    } catch (e) {
      console.warn('Could not save candidate to localStorage', e);
    }

    // 2. SessionStorage
    try {
      sessionStorage.setItem('gate_candidate', JSON.stringify(this.candidate));
    } catch (e) {}

    // 3. Document Cookie (30-day expiry)
    try {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `gate_candidate=${encodeURIComponent(JSON.stringify(this.candidate))}; expires=${expires}; path=/; SameSite=Lax`;
    } catch (e) {}

    // 4. Server API sync
    try {
      fetch('/api/candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.candidate)
      }).catch(() => {});
    } catch (e) {}

    this.updateCandidateHeader();
  }

  saveCandidateFromModal() {
    const nameInput = document.getElementById('input-candidate-name');
    const rollInput = document.getElementById('input-candidate-roll');
    const name = (nameInput ? nameInput.value : '').trim();
    const roll = (rollInput ? rollInput.value : '').trim();

    if (!name) {
      alert('Please enter your name.');
      if (nameInput) nameInput.focus();
      return false;
    }

    this.setCandidate(name, roll);

    const modal = document.getElementById('candidate-login-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    return false;
  }

  async loadDefaultPaper() {
    // 1. Try loading ./data/today_paper.json (active paper for GitHub Pages)
    try {
      const resp = await fetch('./data/today_paper.json');
      if (resp.ok) {
        this.currentPaper = await resp.json();
        this.applyPaperSchedule(this.currentPaper);
        document.getElementById('paper-header-title').textContent = this.currentPaper.title;
        this.updateCandidateHeader();
        return;
      }
    } catch (e) {}

    // 2. Try loading ./data/sample_paper_csir_gate.json
    try {
      const resp = await fetch('./data/sample_paper_csir_gate.json');
      if (resp.ok) {
        this.currentPaper = await resp.json();
        this.applyPaperSchedule(this.currentPaper);
        document.getElementById('paper-header-title').textContent = this.currentPaper.title;
        this.updateCandidateHeader();
        return;
      }
    } catch (e) {}

    // 3. Fallback to client-side data object
    if (window.SAMPLE_PAPER_DATA) {
      this.currentPaper = window.SAMPLE_PAPER_DATA;
      this.applyPaperSchedule(this.currentPaper);
      document.getElementById('paper-header-title').textContent = this.currentPaper.title;
      this.updateCandidateHeader();
      return;
    }

    this.currentPaper = JsonValidator.getTemplate();
    this.updateCandidateHeader();
  }

  applyPaperSchedule(paper) {
    if (paper && paper.schedule) {
      const [sh, sm] = (paper.schedule.dailyStart || '21:00').split(':').map(Number);
      const [eh, em] = (paper.schedule.dailyEnd || '21:40').split(':').map(Number);
      const [rh, rm] = (paper.schedule.resultTime || '21:50').split(':').map(Number);
      this.scheduleManager.startHour = sh;
      this.scheduleManager.startMinute = sm;
      this.scheduleManager.endHour = eh;
      this.scheduleManager.endMinute = em;
      this.scheduleManager.resultHour = rh;
      this.scheduleManager.resultMinute = rm;
    }
    if (paper && paper.durationMinutes) {
      this.scheduleManager.durationMinutes = paper.durationMinutes;
    }
  }

  setupScheduleTicker() {
    // Check schedule state every second
    setInterval(() => {
      const state = this.scheduleManager.getCurrentState();
      this.updateScheduleClockDisplay(state);

      // In scheduled mode, trigger state transitions if on lobby or waiting
      const currentView = this.getActiveView();
      if (state.mode === 'SCHEDULED') {
        if (currentView === 'lobby' && state.phase === 'EXAM_LIVE' && !this.examEngine) {
          this.startExam(state.remainingSeconds);
        } else if (currentView === 'exam' && state.phase === 'WAITING_FOR_RESULTS') {
          this.autoSubmitScheduledExam();
        } else if (currentView === 'waiting-results' && state.phase === 'RESULTS_DECLARED') {
          this.showResultsView();
        }
      }
    }, 1000);
  }

  updateScheduleClockDisplay(state) {
    const clockEl = document.getElementById('current-time-display');
    if (clockEl) {
      const d = state.effectiveDate;
      clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    // Update lobby countdown if lobby is visible
    const lobbyCountdown = document.getElementById('lobby-countdown');
    if (lobbyCountdown && state.remainingSeconds !== undefined) {
      lobbyCountdown.textContent = this.scheduleManager.formatTime(state.remainingSeconds);
    }

    // Update waiting for results countdown
    const waitCountdown = document.getElementById('waiting-results-countdown');
    if (waitCountdown && state.remainingSeconds !== undefined) {
      waitCountdown.textContent = this.scheduleManager.formatTime(state.remainingSeconds);
    }
  }

  getActiveView() {
    if (document.getElementById('view-lobby').style.display !== 'none') return 'lobby';
    if (document.getElementById('view-exam').style.display !== 'none') return 'exam';
    if (document.getElementById('view-waiting-results').style.display !== 'none') return 'waiting-results';
    if (document.getElementById('view-results').style.display !== 'none') return 'results';
    return 'lobby';
  }

  switchView(viewName) {
    ['view-lobby', 'view-exam', 'view-waiting-results', 'view-results'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.style.display = viewName === 'exam' ? 'flex' : 'block';
    }

    // Header buttons visibility
    const examActions = document.getElementById('header-exam-actions');
    if (examActions) {
      examActions.style.display = viewName === 'exam' ? 'flex' : 'none';
    }
  }

  evaluateCurrentRoute() {
    const state = this.scheduleManager.getCurrentState();
    if (this.scheduleManager.mode === 'PRACTICE') {
      this.switchView('lobby');
      this.renderLobby();
      return;
    }

    switch (state.phase) {
      case 'PRE_EXAM_LOBBY':
        this.switchView('lobby');
        this.renderLobby();
        break;
      case 'EXAM_LIVE':
        if (!this.examEngine || !this.examEngine.isSubmitted) {
          this.startExam(state.remainingSeconds);
        } else {
          this.switchView('waiting-results');
        }
        break;
      case 'WAITING_FOR_RESULTS':
        this.switchView('waiting-results');
        break;
      case 'RESULTS_DECLARED':
        if (this.currentResult) {
          this.showResultsView();
        } else {
          this.switchView('lobby');
          this.renderLobby();
        }
        break;
      default:
        this.switchView('lobby');
        this.renderLobby();
    }
  }

  renderLobby() {
    const state = this.scheduleManager.getCurrentState();
    const titleEl = document.getElementById('lobby-paper-title');
    if (titleEl && this.currentPaper) {
      titleEl.textContent = this.currentPaper.title;
    }
    const qCountEl = document.getElementById('lobby-q-count');
    if (qCountEl && this.currentPaper) {
      qCountEl.textContent = this.currentPaper.questions.length;
    }
    const timeEl = document.getElementById('lobby-duration');
    if (timeEl && this.currentPaper) {
      timeEl.textContent = `${this.currentPaper.durationMinutes || 40} Mins`;
    }
    const marksEl = document.getElementById('lobby-total-marks');
    if (marksEl && this.currentPaper) {
      marksEl.textContent = `${this.currentPaper.totalMarks || 40} Marks`;
    }

    const startBtn = document.getElementById('btn-start-lobby-exam');
    if (startBtn) {
      if (this.scheduleManager.mode === 'PRACTICE') {
        startBtn.textContent = 'Start 40-Minute Practice Test Now';
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
      } else {
        if (state.phase === 'EXAM_LIVE') {
          startBtn.textContent = 'Enter Live Exam Room';
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
        } else {
          startBtn.textContent = 'Exam Starts at 9:00 PM (Locked)';
          startBtn.disabled = true;
          startBtn.style.opacity = '0.6';
        }
      }
    }
  }

  startExam(secondsOverride = null) {
    if (!this.currentPaper) return;

    this.examEngine = new ExamEngine(this.currentPaper);
    this.switchView('exam');

    // Subscribe to engine events
    this.examEngine.onStateChange(() => {
      this.renderQuestion();
      this.renderPalette();
    });

    this.examEngine.onTimerTick((remainingSecs) => {
      this.renderTimer(remainingSecs);
    });

    this.examEngine.onTimeExpired(() => {
      alert('Time is up! Submitting your exam automatically.');
      this.submitExam();
    });

    const duration = secondsOverride !== null 
      ? secondsOverride 
      : (this.currentPaper.durationMinutes || 40) * 60;

    this.examEngine.startTimer(duration);
    this.renderQuestion();
    this.renderPalette();
  }

  renderTimer(seconds) {
    const timerEl = document.getElementById('exam-timer');
    if (!timerEl) return;
    timerEl.textContent = this.scheduleManager.formatTime(seconds);
    if (seconds < 300) {
      timerEl.classList.add('warning');
    } else {
      timerEl.classList.remove('warning');
    }
  }

  renderQuestion() {
    const q = this.examEngine.getCurrentQuestion();
    const qState = this.examEngine.getCurrentState();
    const index = this.examEngine.currentIndex;

    // Header info
    document.getElementById('q-number-label').textContent = `Question ${index + 1} of ${this.examEngine.paper.questions.length}`;
    document.getElementById('q-type-label').textContent = `Type: ${q.type || 'MCQ'}`;
    document.getElementById('q-marks-pos').textContent = `+${q.marks ?? 2}`;
    document.getElementById('q-marks-neg').textContent = `-${q.negativeMarks ?? 0.66}`;

    // Question body
    const qTextEl = document.getElementById('q-body-text');
    qTextEl.innerHTML = KatexRenderer.render(q.question);

    // Diagram SVG
    const diagramContainer = document.getElementById('q-diagram-container');
    if (q.diagramSvg) {
      diagramContainer.innerHTML = q.diagramSvg;
      diagramContainer.style.display = 'block';
    } else {
      diagramContainer.innerHTML = '';
      diagramContainer.style.display = 'none';
    }

    // Options
    const optionsContainer = document.getElementById('q-options-container');
    optionsContainer.innerHTML = '';

    if (q.type === 'MCQ' || q.type === 'MSQ') {
      (q.options || []).forEach(opt => {
        const isSelected = qState.userAnswer === opt.id;
        const optDiv = document.createElement('div');
        optDiv.className = `option-item ${isSelected ? 'selected' : ''}`;
        optDiv.innerHTML = `
          <input type="${q.type === 'MCQ' ? 'radio' : 'checkbox'}" 
                 name="question-option" 
                 class="option-radio" 
                 ${isSelected ? 'checked' : ''}>
          <span class="option-label">(${opt.id})</span>
          <div class="option-text">${KatexRenderer.render(opt.text)}</div>
        `;
        optDiv.addEventListener('click', () => {
          this.examEngine.selectOption(opt.id);
        });
        optionsContainer.appendChild(optDiv);
      });
    } else if (q.type === 'NAT') {
      // Numerical input
      const natDiv = document.createElement('div');
      natDiv.style.marginTop = '16px';
      natDiv.innerHTML = `
        <label style="display:block;font-weight:600;margin-bottom:6px;">Enter Numerical Answer:</label>
        <input type="number" step="any" id="nat-answer-input" 
               value="${qState.userAnswer || ''}" 
               style="font-size:18px;padding:8px 12px;border:2px solid #3b82f6;border-radius:6px;width:240px;" />
      `;
      const input = natDiv.querySelector('#nat-answer-input');
      input.addEventListener('input', (e) => {
        this.examEngine.selectOption(e.target.value);
      });
      optionsContainer.appendChild(natDiv);
    }
  }

  renderPalette() {
    const summary = this.examEngine.getPaletteSummary();
    document.getElementById('count-answered').textContent = summary.answered;
    document.getElementById('count-not-answered').textContent = summary.notAnswered;
    document.getElementById('count-not-visited').textContent = summary.notVisited;
    document.getElementById('count-marked').textContent = summary.marked;
    document.getElementById('count-marked-answered').textContent = summary.answeredAndMarked;

    const gridEl = document.getElementById('palette-grid');
    gridEl.innerHTML = '';

    this.examEngine.questionStates.forEach((st, idx) => {
      const btn = document.createElement('button');
      btn.className = `grid-btn status-${st.status.toLowerCase().replace(/_/g, '-')}`;
      if (idx === this.examEngine.currentIndex) {
        btn.classList.add('current');
      }
      btn.textContent = idx + 1;
      btn.addEventListener('click', () => {
        this.examEngine.goToQuestion(idx);
      });
      gridEl.appendChild(btn);
    });
  }

  showSubmitModal() {
    const summary = this.examEngine.getPaletteSummary();
    const modal = document.getElementById('submit-confirm-modal');
    modal.querySelector('#modal-summary-answered').textContent = summary.answered;
    modal.querySelector('#modal-summary-not-answered').textContent = summary.notAnswered;
    modal.querySelector('#modal-summary-marked').textContent = summary.marked + summary.answeredAndMarked;
    modal.querySelector('#modal-summary-not-visited').textContent = summary.notVisited;
    modal.style.display = 'flex';
  }

  async submitExam() {
    if (!this.examEngine) return;
    this.currentResult = this.examEngine.evaluate();

    // Record submission for candidate & friend leaderboard
    await this.recordSubmission(this.currentResult);

    const state = this.scheduleManager.getCurrentState();
    if (this.scheduleManager.mode === 'SCHEDULED' && state.phase === 'WAITING_FOR_RESULTS') {
      this.switchView('waiting-results');
    } else {
      this.showResultsView();
    }
  }

  async recordSubmission(res) {
    const submission = {
      candidateName: this.candidate ? this.candidate.name : 'Candidate',
      rollNo: this.candidate ? this.candidate.rollNo : 'GATE-01',
      paperId: this.currentPaper ? (this.currentPaper.paperId || 'paper_01') : 'paper_01',
      score: res.totalScore,
      maxScore: res.maxPossibleMarks,
      accuracyPercent: res.accuracyPercent,
      correctCount: res.correctCount,
      incorrectCount: res.incorrectCount,
      unattemptedCount: res.unattemptedCount,
      submittedAt: new Date().toISOString()
    };

    // 1. Post to backend server if running
    try {
      await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });
    } catch (e) {
      // Backend not running (e.g. GitHub Pages or file://)
    }

    // 2. Save to local storage submissions (for Admin Portal & local persistence)
    try {
      const localSubs = JSON.parse(localStorage.getItem('gate_local_submissions') || '[]');
      const existingIdx = localSubs.findIndex(item => 
        item.candidateName.toLowerCase() === submission.candidateName.toLowerCase() && 
        item.paperId === submission.paperId
      );
      if (existingIdx >= 0) {
        localSubs[existingIdx] = submission;
      } else {
        localSubs.push(submission);
      }
      localStorage.setItem('gate_local_submissions', JSON.stringify(localSubs));
    } catch (e) {
      console.warn('Could not save to gate_local_submissions', e);
    }

    // 3. Save locally and to cloud via LeaderboardSync
    this.leaderboardSync.saveSubmission(submission);
    this.latestSubmission = submission;
  }

  async openLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    const tableBody = document.getElementById('leaderboard-table-body');
    if (!modal || !tableBody) return;

    modal.style.display = 'flex';
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;">Loading score rankings...</td></tr>';

    let list = [];

    // 1. Try server leaderboard
    try {
      const resp = await fetch('/api/exam/leaderboard');
      if (resp.ok) {
        const data = await resp.json();
        list = data.leaderboard || [];
      }
    } catch (e) {}

    // 2. Fall back / merge with cloud sync
    if (!list || list.length === 0) {
      list = await this.leaderboardSync.fetchFromCloud();
    }

    // 3. Merge with local submissions
    const localList = this.leaderboardSync.getLeaderboard();
    const localSubs = JSON.parse(localStorage.getItem('gate_local_submissions') || '[]');

    const mergedMap = new Map();
    [...(list || []), ...localList, ...localSubs].forEach(item => {
      if (!item || !item.candidateName) return;
      const key = `${item.candidateName.toLowerCase()}_${item.paperId || 'default'}`;
      if (!mergedMap.has(key) || mergedMap.get(key).score < item.score) {
        mergedMap.set(key, item);
      }
    });

    const mergedList = Array.from(mergedMap.values());
    mergedList.sort((a, b) => b.score - a.score || b.accuracyPercent - a.accuracyPercent);

    if (mergedList.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#64748b;">No submissions recorded yet today. Take the exam to see your score on the leaderboard!</td></tr>';
      return;
    }

    tableBody.innerHTML = mergedList.map((s, idx) => {
      const isMe = this.candidate && s.candidateName.toLowerCase() === this.candidate.name.toLowerCase();
      return `
        <tr class="${idx === 0 ? 'leaderboard-rank-1' : (idx === 1 ? 'leaderboard-rank-2' : (idx === 2 ? 'leaderboard-rank-3' : ''))}">
          <td><strong>${idx === 0 ? '🥇 #1' : (idx === 1 ? '🥈 #2' : (idx === 2 ? '🥉 #3' : `#${idx + 1}`))}</strong></td>
          <td>
            <div style="font-weight:700;">${s.candidateName} ${isMe ? '<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;margin-left:4px;">YOU</span>' : ''}</div>
            <div style="font-size:11px;color:#64748b;">Roll: ${s.rollNo}</div>
          </td>
          <td style="font-weight:800;color:#15803d;font-size:15px;">${s.score} / ${s.maxScore || 40}</td>
          <td><strong>${s.accuracyPercent}%</strong></td>
          <td style="font-size:12px;color:#64748b;">${new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>
      `;
    }).join('');
  }

  autoSubmitScheduledExam() {
    if (this.examEngine && !this.examEngine.isSubmitted) {
      this.currentResult = this.examEngine.evaluate();
      this.switchView('waiting-results');
    }
  }

  showResultsView() {
    if (!this.currentResult) {
      alert('No exam results available to display.');
      return;
    }

    this.switchView('results');
    const res = this.currentResult;

    document.getElementById('res-score').textContent = res.totalScore;
    document.getElementById('res-max-score').textContent = res.maxPossibleMarks;
    document.getElementById('res-correct').textContent = res.correctCount;
    document.getElementById('res-incorrect').textContent = res.incorrectCount;
    document.getElementById('res-unattempted').textContent = res.unattemptedCount;
    document.getElementById('res-accuracy').textContent = `${res.accuracyPercent}%`;

    // Candidate details in Results header card
    const nameEl = document.getElementById('res-candidate-name');
    const rollEl = document.getElementById('res-candidate-roll');
    const dateEl = document.getElementById('res-candidate-date');
    const titleEl = document.getElementById('res-paper-title');

    if (nameEl && this.candidate) nameEl.textContent = this.candidate.name;
    if (rollEl && this.candidate) rollEl.textContent = this.candidate.rollNo;
    if (dateEl) dateEl.textContent = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    if (titleEl && this.currentPaper) titleEl.textContent = this.currentPaper.title;

    this.renderSolutionList();
  }

  renderSolutionList() {
    const container = document.getElementById('solutions-container');
    container.innerHTML = '';

    const list = this.currentResult.breakdown.filter(item => {
      if (this.activeFilter === 'CORRECT') return item.isCorrect;
      if (this.activeFilter === 'INCORRECT') return item.isAttempted && !item.isCorrect;
      if (this.activeFilter === 'UNATTEMPTED') return !item.isAttempted;
      return true;
    });

    list.forEach((item, idx) => {
      const card = document.createElement('div');
      let statusClass = 'is-unattempted';
      let tagText = 'Unattempted (0 Marks)';
      let tagClass = 'tag-unattempted';

      if (item.isAttempted) {
        if (item.isCorrect) {
          statusClass = 'is-correct';
          tagText = `Correct (+${item.marksEarned})`;
          tagClass = 'tag-correct';
        } else {
          statusClass = 'is-incorrect';
          tagText = `Incorrect (${item.marksEarned})`;
          tagClass = 'tag-incorrect';
        }
      }

      card.className = `solution-card ${statusClass}`;
      card.innerHTML = `
        <div class="solution-header">
          <span style="font-weight:700;font-size:15px;">Question ${item.id}</span>
          <span class="solution-tag ${tagClass}">${tagText}</span>
        </div>
        <div class="question-text" style="font-size:15px;margin-bottom:12px;">
          ${KatexRenderer.render(item.question)}
        </div>
        ${item.diagramSvg ? `<div style="margin:10px 0;">${item.diagramSvg}</div>` : ''}
        
        <div style="font-size:13px;background:#f1f5f9;padding:10px;border-radius:6px;margin-bottom:12px;">
          <div><strong>Your Answer:</strong> ${item.userAnswer ? `Option (${item.userAnswer})` : 'Not Attempted'}</div>
          <div><strong>Official Answer Key:</strong> <span style="color:#15803d;font-weight:700;">Option (${item.correctAnswer})</span></div>
        </div>

        <div class="solution-box">
          <div class="solution-title">Step-by-Step Mathematical Solution</div>
          <div class="solution-content">${KatexRenderer.render(item.solution || 'No detailed solution provided.')}</div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  attachEventListeners() {
    // Top Bar Calculator
    const btnCalc = document.getElementById('btn-calculator');
    if (btnCalc) {
      btnCalc.addEventListener('click', () => {
        this.calculator.toggle();
      });
    }

    // Top Bar Question Paper view
    const btnPaper = document.getElementById('btn-view-paper');
    if (btnPaper) {
      btnPaper.addEventListener('click', () => {
        this.showFullPaperModal();
      });
    }

    // Instructions button
    const btnInst = document.getElementById('btn-instructions');
    if (btnInst) {
      btnInst.addEventListener('click', () => {
        const modal = document.getElementById('instructions-modal');
        if (modal) modal.style.display = 'flex';
      });
    }

    // Upload JSON Paper button (safe guard if button exists)
    const btnUpload = document.getElementById('btn-upload-json');
    if (btnUpload) {
      btnUpload.addEventListener('click', () => {
        const modal = document.getElementById('upload-modal');
        if (modal) modal.style.display = 'flex';
      });
    }

    // Leaderboard button in header
    const btnHeaderLead = document.getElementById('btn-header-leaderboard');
    if (btnHeaderLead) {
      btnHeaderLead.addEventListener('click', () => this.openLeaderboardModal());
    }

    // Leaderboard button in results view
    const btnResLead = document.getElementById('btn-results-leaderboard');
    if (btnResLead) {
      btnResLead.addEventListener('click', () => this.openLeaderboardModal());
    }

    // Share Score Link button in results view
    const btnShare = document.getElementById('btn-results-copy-share');
    if (btnShare) {
      btnShare.addEventListener('click', () => {
        if (!this.latestSubmission) return alert('No exam attempt to share.');
        const url = this.leaderboardSync.generateShareUrl(this.latestSubmission);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            alert('🎉 Result link copied to clipboard!\n\nSend this link to your friend on WhatsApp. When they open it, your score will be added to their leaderboard!');
          }).catch(() => {
            prompt('Copy your result link below and send to your friend:', url);
          });
        } else {
          prompt('Copy your result link below and send to your friend:', url);
        }
      });
    }

    // Import Friend Score in Leaderboard modal
    const btnImportCode = document.getElementById('btn-import-friend-code');
    if (btnImportCode) {
      btnImportCode.addEventListener('click', () => {
        const input = document.getElementById('input-friend-code');
        if (!input) return;
        const val = input.value.trim();
        if (!val) return alert('Please enter or paste a score link or code.');

        let code = val;
        if (val.includes('score=')) {
          try {
            const urlObj = new URL(val);
            code = urlObj.searchParams.get('score') || val;
          } catch(e) {
            const match = val.match(/score=([^&]+)/);
            if (match) code = decodeURIComponent(match[1]);
          }
        }

        const res = this.leaderboardSync.importScoreCode(code);
        if (res.success) {
          alert(`🎉 Success! Added ${res.submission.candidateName}'s score to your leaderboard.`);
          input.value = '';
          this.openLeaderboardModal();
        } else {
          alert('Invalid score code: ' + res.error);
        }
      });
    }

    // Candidate profile click (header)
    const openCandidateModal = () => {
      const modal = document.getElementById('candidate-login-modal');
      if (modal) {
        const nameInput = document.getElementById('input-candidate-name');
        const rollInput = document.getElementById('input-candidate-roll');
        if (nameInput && this.candidate && this.candidate.name && this.candidate.name !== 'Candidate') {
          nameInput.value = this.candidate.name;
        }
        if (rollInput && this.candidate && this.candidate.rollNo) {
          rollInput.value = this.candidate.rollNo;
        }
        modal.style.display = 'flex';
        setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
      }
    };

    const candProf = document.querySelector('.candidate-profile');
    if (candProf) {
      candProf.style.cursor = 'pointer';
      candProf.title = 'Click to change candidate name';
      candProf.addEventListener('click', openCandidateModal);
    }

    // Candidate box inside exam palette click
    const paletteCandBox = document.querySelector('.palette-candidate-box');
    if (paletteCandBox) {
      paletteCandBox.style.cursor = 'pointer';
      paletteCandBox.title = 'Click to edit candidate details';
      paletteCandBox.addEventListener('click', openCandidateModal);
    }

    // Candidate form submit (handles Enter key & button click)
    const candForm = document.getElementById('candidate-login-form');
    if (candForm) {
      candForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCandidateFromModal();
      });
    }

    const btnCandSubmit = document.getElementById('btn-candidate-login-submit');
    if (btnCandSubmit) {
      btnCandSubmit.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveCandidateFromModal();
      });
    }

    // Candidate modal close & cancel buttons
    const btnCandClose = document.getElementById('btn-candidate-modal-close');
    if (btnCandClose) {
      btnCandClose.addEventListener('click', () => {
        const modal = document.getElementById('candidate-login-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    const btnCandCancel = document.getElementById('btn-candidate-modal-cancel');
    if (btnCandCancel) {
      btnCandCancel.addEventListener('click', () => {
        const modal = document.getElementById('candidate-login-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Start Exam from Lobby
    const btnStartExam = document.getElementById('btn-start-lobby-exam');
    if (btnStartExam) {
      btnStartExam.addEventListener('click', () => {
        const state = this.scheduleManager.getCurrentState();
        if (this.scheduleManager.mode === 'PRACTICE' || state.phase === 'EXAM_LIVE') {
          this.startExam();
        }
      });
    }

    // Action buttons inside exam
    const btnSaveNext = document.getElementById('btn-save-next');
    if (btnSaveNext) {
      btnSaveNext.addEventListener('click', () => {
        if (this.examEngine) this.examEngine.saveAndNext();
      });
    }

    const btnMarkReview = document.getElementById('btn-mark-review');
    if (btnMarkReview) {
      btnMarkReview.addEventListener('click', () => {
        if (this.examEngine) this.examEngine.markForReviewAndNext();
      });
    }

    const btnClearResp = document.getElementById('btn-clear-response');
    if (btnClearResp) {
      btnClearResp.addEventListener('click', () => {
        if (this.examEngine) this.examEngine.clearResponse();
      });
    }

    const btnPrevQ = document.getElementById('btn-prev-q');
    if (btnPrevQ) {
      btnPrevQ.addEventListener('click', () => {
        if (this.examEngine) this.examEngine.prevQuestion();
      });
    }

    const btnSubmitExam = document.getElementById('btn-submit-exam');
    if (btnSubmitExam) {
      btnSubmitExam.addEventListener('click', () => {
        this.showSubmitModal();
      });
    }

    // Submit confirmation modal actions
    const btnConfirmSubmit = document.getElementById('modal-btn-confirm-submit');
    if (btnConfirmSubmit) {
      btnConfirmSubmit.addEventListener('click', () => {
        const modal = document.getElementById('submit-confirm-modal');
        if (modal) modal.style.display = 'none';
        this.submitExam();
      });
    }

    const btnCancelSubmit = document.getElementById('modal-btn-cancel-submit');
    if (btnCancelSubmit) {
      btnCancelSubmit.addEventListener('click', () => {
        const modal = document.getElementById('submit-confirm-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Mode Switcher buttons
    const btnModeSched = document.getElementById('btn-mode-scheduled');
    if (btnModeSched) {
      btnModeSched.addEventListener('click', () => {
        this.scheduleManager.setMode('SCHEDULED');
        this.updateModeBanner();
        this.evaluateCurrentRoute();
      });
    }

    const btnModePrac = document.getElementById('btn-mode-practice');
    if (btnModePrac) {
      btnModePrac.addEventListener('click', () => {
        this.scheduleManager.setMode('PRACTICE');
        this.updateModeBanner();
        this.evaluateCurrentRoute();
      });
    }

    // Time simulator dropdown
    const selectWarp = document.getElementById('select-time-warp');
    if (selectWarp) {
      selectWarp.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'real') {
          this.scheduleManager.resetRealTime();
        } else if (val === 'pre_exam') {
          this.scheduleManager.simulateTime(20, 58, 0); // 8:58 PM
        } else if (val === 'exam_start') {
          this.scheduleManager.simulateTime(21, 0, 0);  // 9:00 PM
        } else if (val === 'exam_ending') {
          this.scheduleManager.simulateTime(21, 39, 30); // 9:39:30 PM
        } else if (val === 'waiting_results') {
          this.scheduleManager.simulateTime(21, 45, 0); // 9:45 PM
        } else if (val === 'results_out') {
          this.scheduleManager.simulateTime(21, 50, 0); // 9:50 PM
        }
        this.evaluateCurrentRoute();
      });
    }

    // Results filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.activeFilter = e.target.getAttribute('data-filter');
        this.renderSolutionList();
      });
    });

    // Back to Home from results
    const btnResHome = document.getElementById('btn-results-home');
    if (btnResHome) {
      btnResHome.addEventListener('click', () => {
        this.currentResult = null;
        this.examEngine = null;
        this.evaluateCurrentRoute();
      });
    }

    // Retake in practice mode
    const btnResRetake = document.getElementById('btn-results-retake');
    if (btnResRetake) {
      btnResRetake.addEventListener('click', () => {
        this.scheduleManager.setMode('PRACTICE');
        this.updateModeBanner();
        this.startExam();
      });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
      });
    });

    // JSON file upload handler
    const fileInput = document.getElementById('json-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            this.handleUploadedJson(parsed);
          } catch (err) {
            alert('Error parsing JSON file: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    // Download template JSON button
    const btnDownloadTpl = document.getElementById('btn-download-template');
    if (btnDownloadTpl) {
      btnDownloadTpl.addEventListener('click', () => {
        const template = JsonValidator.getTemplate();
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gate_question_paper_template.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  handleUploadedJson(paper) {
    const validation = JsonValidator.validate(paper);
    const feedbackBox = document.getElementById('upload-validation-feedback');
    if (!validation.valid) {
      feedbackBox.innerHTML = `<div style="color:#b91c1c;"><strong>Errors:</strong><br>${validation.errors.join('<br>')}</div>`;
      feedbackBox.style.display = 'block';
      return;
    }

    feedbackBox.innerHTML = `<div style="color:#15803d;"><strong>Valid Paper!</strong> ${paper.questions.length} questions loaded successfully.</div>`;
    feedbackBox.style.display = 'block';

    this.currentPaper = paper;
    document.getElementById('paper-header-title').textContent = paper.title;
    setTimeout(() => {
      document.getElementById('upload-modal').style.display = 'none';
      this.evaluateCurrentRoute();
      alert(`Question paper "${paper.title}" loaded successfully!`);
    }, 1000);
  }

  updateModeBanner() {
    const isPractice = this.scheduleManager.mode === 'PRACTICE';
    const badge = document.getElementById('active-mode-badge');
    if (isPractice) {
      badge.textContent = 'Practice Mode (Anytime)';
      badge.className = 'mode-badge practice';
    } else {
      badge.textContent = 'Scheduled Mode (Daily 9:00 PM - 9:40 PM)';
      badge.className = 'mode-badge scheduled';
    }
  }

  showFullPaperModal() {
    if (!this.currentPaper) return;
    const modal = document.getElementById('full-paper-modal');
    const container = modal.querySelector('#full-paper-content');
    container.innerHTML = '';

    this.currentPaper.questions.forEach((q, idx) => {
      const qBox = document.createElement('div');
      qBox.style.padding = '12px 0';
      qBox.style.borderBottom = '1px solid #e2e8f0';
      qBox.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px;">Q${idx + 1}. [Marks: +${q.marks ?? 2}, -${q.negativeMarks ?? 0.66}]</div>
        <div style="margin-bottom:8px;">${KatexRenderer.render(q.question)}</div>
        ${q.diagramSvg ? `<div style="margin:8px 0;">${q.diagramSvg}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;color:#334155;">
          ${(q.options || []).map(o => `<div><strong>(${o.id})</strong> ${KatexRenderer.render(o.text)}</div>`).join('')}
        </div>
      `;
      container.appendChild(qBox);
    });

    modal.style.display = 'flex';
  }
}

// Bootstrap when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GateMockApp();
});
