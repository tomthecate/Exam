/**
 * Main Application Orchestrator
 */
class GateMockApp {
  constructor() {
    this.currentPaper = null;
    this.scheduledPaper = null;
    this.practicePapers = [];
    this.examEngine = null;
    this.scheduleManager = new ScheduleManager();
    this.calculator = new GateCalculator('gate-calculator-container');
    this.leaderboardSync = new LeaderboardSync();
    this.examStorage = new ExamStorage();
    this.currentResult = null;
    this.latestSubmission = null;
    this.currentAttempt = null;
    this.examStartedAt = null;
    this.lastDraftSaveSecond = null;
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
    this.scheduledPaper = this.currentPaper;
    await this.loadPracticePapers();
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
      this.registerParticipant();
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

    this.registerParticipant();

    this.updateCandidateHeader();
  }

  registerParticipant() {
    if (!this.candidate || !this.candidate.name || this.candidate.name === 'Candidate') return;
    const participant = {
      candidateName: this.candidate.name,
      rollNo: this.candidate.rollNo || '-',
      registeredAt: new Date().toISOString()
    };

    try {
      const participants = JSON.parse(localStorage.getItem('gate_registered_participants') || '[]');
      const key = `${participant.candidateName.toLowerCase()}_${participant.rollNo.toLowerCase()}`;
      const existingIndex = participants.findIndex(item => `${String(item.candidateName || '').toLowerCase()}_${String(item.rollNo || '').toLowerCase()}` === key);
      if (existingIndex >= 0) participants[existingIndex] = { ...participants[existingIndex], ...participant };
      else participants.push(participant);
      localStorage.setItem('gate_registered_participants', JSON.stringify(participants));
    } catch (error) {}

    try {
      fetch('/api/exam/participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(participant)
      }).catch(() => {});
    } catch (error) {}
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
    this.applyPaperSchedule(this.currentPaper);
    this.updateCandidateHeader();
  }

  async loadPracticePapers() {
    const papers = [];
    if (this.scheduledPaper) papers.push(this.scheduledPaper);

    try {
      const response = await fetch('./data/papers/index.json');
      if (response.ok) {
        const manifest = await response.json();
        const entries = Array.isArray(manifest) ? manifest : (manifest.papers || []);
        const loaded = await Promise.all(entries.map(async entry => {
          const file = typeof entry === 'string' ? entry : entry.file;
          if (!file) return null;
          try {
            const paperResponse = await fetch(`./data/papers/${file}`);
            return paperResponse.ok ? paperResponse.json() : null;
          } catch (error) {
            return null;
          }
        }));
        papers.push(...loaded.filter(Boolean));
      }
    } catch (error) {
      // The active paper remains available if the static manifest cannot be read.
    }

    const unique = new Map();
    papers.forEach(paper => {
      if (paper && Array.isArray(paper.questions)) {
        unique.set(paper.paperId || paper.title, paper);
      }
    });
    this.practicePapers = Array.from(unique.values());
    this.renderPracticePaperOptions();
  }

  renderPracticePaperOptions() {
    const select = document.getElementById('select-practice-paper');
    if (!select) return;
    select.innerHTML = this.practicePapers.map(paper => {
      const count = paper.questions.length;
      const selected = this.currentPaper && (paper.paperId || paper.title) === (this.currentPaper.paperId || this.currentPaper.title);
      return `<option value="${this.escapeHtml(paper.paperId || paper.title)}" ${selected ? 'selected' : ''}>${this.escapeHtml(paper.title)} (${count} questions)</option>`;
    }).join('');
  }

  selectPracticePaper(paperId) {
    const paper = this.practicePapers.find(item => (item.paperId || item.title) === paperId);
    if (!paper) return;
    this.currentPaper = paper;
    this.applyPaperSchedule(paper);
    document.getElementById('paper-header-title').textContent = paper.title;
    this.updateCandidateHeader();
    this.renderLobby();
  }

  applyPaperSchedule(paper) {
    if (!paper) return;
    this.scheduleManager.setScheduleFromPaper(paper);
    this.updatePaperSummary();
    this.updateModeBanner();
  }

  formatScheduleDate(date) {
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  updatePaperSummary() {
    if (!this.currentPaper) return;
    const count = this.currentPaper.questions.length;
    const duration = count * 2;
    const marks = this.currentPaper.totalMarks || this.currentPaper.questions.reduce((sum, q) => sum + Number(q.marks ?? 2), 0);
    const summary = document.querySelector('.paper-sub');
    if (summary) summary.textContent = `${duration} Minutes • ${count} Questions • ${marks} Marks`;
    const timer = document.getElementById('exam-timer');
    if (timer) timer.textContent = this.scheduleManager.formatTime(duration * 60);

    const start = this.scheduleManager.getExamStartTime();
    const end = this.scheduleManager.getExamEndTime();
    const result = this.scheduleManager.getResultTime();
    const countdownLabel = document.getElementById('lobby-countdown-label');
    if (countdownLabel) countdownLabel.textContent = `Exam starts ${this.formatScheduleDate(start)}`;
    const scheduleGuideline = document.getElementById('guideline-exam-schedule');
    if (scheduleGuideline) scheduleGuideline.textContent = `Scheduled exam: ${this.formatScheduleDate(start)} to ${this.formatScheduleDate(end)}.`;
    const resultGuideline = document.getElementById('guideline-result-schedule');
    if (resultGuideline) resultGuideline.textContent = `Your result appears immediately after submission. Published result time in this paper: ${this.formatScheduleDate(result)}.`;
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
        } else if (currentView === 'exam' && state.phase !== 'EXAM_LIVE') {
          this.autoSubmitScheduledExam();
        } else if (currentView === 'waiting-results' && this.currentResult) {
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

    document.body.classList.toggle('exam-active', viewName === 'exam');
    document.body.dataset.activeView = viewName;

    if (viewName !== 'exam') {
      this.closeQuestionPalette();
      this.calculator.close();
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
          this.showResultsView();
        }
        break;
      case 'WAITING_FOR_RESULTS':
        if (this.currentResult) this.showResultsView();
        else {
          this.switchView('lobby');
          this.renderLobby();
        }
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
    const isPractice = this.scheduleManager.mode === 'PRACTICE';
    const practicePicker = document.getElementById('practice-paper-picker');
    if (practicePicker) practicePicker.hidden = !isPractice;
    if (isPractice) this.renderPracticePaperOptions();
    const countdownBox = document.getElementById('lobby-schedule-countdown');
    if (countdownBox) countdownBox.style.display = isPractice ? 'none' : 'inline-flex';
    if (isPractice) {
      const scheduleGuideline = document.getElementById('guideline-exam-schedule');
      const resultGuideline = document.getElementById('guideline-result-schedule');
      if (scheduleGuideline) scheduleGuideline.textContent = `Selected practice set: ${this.currentPaper.title}.`;
      if (resultGuideline) resultGuideline.textContent = 'Practice results and detailed solutions appear immediately after submission.';
    }
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
      timeEl.textContent = `${this.currentPaper.questions.length * 2} Mins`;
    }
    const marksEl = document.getElementById('lobby-total-marks');
    if (marksEl && this.currentPaper) {
      marksEl.textContent = `${this.currentPaper.totalMarks || 40} Marks`;
    }

    const startBtn = document.getElementById('btn-start-lobby-exam');
    if (startBtn) {
      if (isPractice) {
        startBtn.textContent = `Start ${this.currentPaper.questions.length * 2}-Minute Practice Test Now`;
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
      } else {
        if (state.phase === 'EXAM_LIVE') {
          startBtn.textContent = 'Enter Live Exam Room';
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
        } else if (state.phase === 'PRE_EXAM_LOBBY') {
          startBtn.textContent = `Exam Starts ${this.formatScheduleDate(state.examStartTime)} (Locked)`;
          startBtn.disabled = true;
          startBtn.style.opacity = '0.6';
        } else {
          startBtn.textContent = 'Scheduled Exam Window Has Ended';
          startBtn.disabled = true;
          startBtn.style.opacity = '0.6';
        }
      }
    }
  }

  startExam(secondsOverride = null) {
    if (!this.currentPaper) return;

    this.examEngine = new ExamEngine(this.currentPaper);
    this.examStartedAt = new Date().toISOString();
    this.switchView('exam');

    const paperId = this.currentPaper.paperId || 'paper_01';
    const draft = this.examStorage.getDraft(paperId, this.candidate);
    let resumeDraft = false;
    if (draft && Array.isArray(draft.questionStates) && draft.questionStates.length === this.currentPaper.questions.length) {
      resumeDraft = window.confirm(`Resume your unfinished attempt from ${new Date(draft.savedAt).toLocaleString()}?\n\nChoose Cancel to start a fresh attempt.`);
      if (resumeDraft) {
        this.examEngine.questionStates = draft.questionStates;
        this.examEngine.currentIndex = Math.min(Math.max(Number(draft.currentIndex) || 0, 0), this.currentPaper.questions.length - 1);
        this.examStartedAt = draft.startedAt || this.examStartedAt;
      } else {
        this.examStorage.clearDraft(paperId, this.candidate);
      }
    }

    // Subscribe to engine events
    this.examEngine.onStateChange(() => {
      this.renderQuestion();
      this.renderPalette();
      this.saveExamDraft();
    });

    this.examEngine.onTimerTick((remainingSecs) => {
      this.renderTimer(remainingSecs);
      if (remainingSecs % 5 === 0) this.saveExamDraft();
    });

    this.examEngine.onTimeExpired(() => {
      alert('Time is up! Submitting your exam automatically.');
      this.submitExam();
    });

    let duration = secondsOverride !== null
      ? secondsOverride 
      : this.currentPaper.questions.length * 2 * 60;

    if (resumeDraft) {
      duration = this.scheduleManager.mode === 'SCHEDULED'
        ? Math.min(Number(draft.secondsRemaining) || duration, duration)
        : Number(draft.secondsRemaining) || duration;
    }

    this.examEngine.startTimer(duration);
    this.renderQuestion();
    this.renderPalette();
  }

  saveExamDraft() {
    if (!this.examEngine || this.examEngine.isSubmitted || !this.currentPaper) return;
    this.examStorage.saveDraft({
      paperId: this.currentPaper.paperId || 'paper_01',
      paperTitle: this.currentPaper.title,
      candidate: this.candidate,
      mode: this.scheduleManager.mode,
      engine: this.examEngine,
      startedAt: this.examStartedAt
    });
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
        const isSelected = q.type === 'MSQ'
          ? Array.isArray(qState.userAnswer) && qState.userAnswer.includes(opt.id)
          : qState.userAnswer === opt.id;
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
      btn.type = 'button';
      btn.setAttribute('aria-label', `Question ${idx + 1}: ${st.status.toLowerCase().replace(/_/g, ' ')}`);
      if (idx === this.examEngine.currentIndex) {
        btn.classList.add('current');
        btn.setAttribute('aria-current', 'true');
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
    if (!this.examEngine || this.examEngine.isSubmitted) return;
    this.currentResult = this.examEngine.evaluate();

    // Local persistence happens synchronously at the start of recordSubmission.
    // Do not make the candidate wait for an optional server request to finish.
    const recording = this.recordSubmission(this.currentResult);
    this.showResultsView();
    await recording;
  }

  async recordSubmission(res) {
    const submittedAt = new Date().toISOString();
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
      submittedAt
    };

    this.currentAttempt = this.examStorage.saveAttempt({
      result: res,
      candidate: this.candidate,
      paper: this.currentPaper,
      mode: this.scheduleManager.mode,
      startedAt: this.examStartedAt,
      submittedAt
    });
    this.examStorage.clearDraft(submission.paperId, this.candidate);

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

    // 2. Save to local storage submissions for local persistence.
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
    let registeredParticipants = [];
    try {
      registeredParticipants = JSON.parse(localStorage.getItem('gate_registered_participants') || '[]');
    } catch (error) {}

    [...(list || []), ...localList, ...localSubs, ...registeredParticipants].forEach(item => {
      if (!item || !item.candidateName) return;
      const key = `${item.candidateName.toLowerCase()}_${(item.rollNo || '').toLowerCase()}`;
      const previous = mergedMap.get(key);
      const itemHasScore = Number.isFinite(Number(item.score));
      const previousHasScore = previous && Number.isFinite(Number(previous.score));
      if (!previous || (itemHasScore && !previousHasScore) || (itemHasScore && Number(item.score) > Number(previous.score))) {
        mergedMap.set(key, item);
      }
    });

    const mergedList = Array.from(mergedMap.values());
    mergedList.sort((a, b) => {
      const aHasScore = Number.isFinite(Number(a.score));
      const bHasScore = Number.isFinite(Number(b.score));
      if (aHasScore !== bHasScore) return aHasScore ? -1 : 1;
      if (!aHasScore) return a.candidateName.localeCompare(b.candidateName);
      return Number(b.score) - Number(a.score) || Number(b.accuracyPercent || 0) - Number(a.accuracyPercent || 0);
    });

    if (mergedList.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#64748b;">No submissions recorded yet today. Take the exam to see your score on the leaderboard!</td></tr>';
      return;
    }

    let rank = 0;
    tableBody.innerHTML = mergedList.map(s => {
      const isMe = this.candidate && s.candidateName.toLowerCase() === this.candidate.name.toLowerCase();
      const hasScore = Number.isFinite(Number(s.score));
      if (hasScore) rank += 1;
      const rankLabel = hasScore ? (rank === 1 ? '🥇 #1' : (rank === 2 ? '🥈 #2' : (rank === 3 ? '🥉 #3' : `#${rank}`))) : '—';
      return `
        <tr class="${rank === 1 && hasScore ? 'leaderboard-rank-1' : (rank === 2 && hasScore ? 'leaderboard-rank-2' : (rank === 3 && hasScore ? 'leaderboard-rank-3' : ''))}">
          <td><strong>${rankLabel}</strong></td>
          <td>
            <div style="font-weight:700;">${this.escapeHtml(s.candidateName)} ${isMe ? '<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;margin-left:4px;">YOU</span>' : ''}</div>
            <div style="font-size:11px;color:#64748b;">Roll: ${this.escapeHtml(s.rollNo || '-')}</div>
          </td>
          <td style="font-weight:800;color:${hasScore ? '#15803d' : '#64748b'};font-size:15px;">${hasScore ? `${s.score} / ${s.maxScore || 40}` : '—'}</td>
          <td><strong>${hasScore ? `${s.accuracyPercent || 0}%` : '—'}</strong></td>
          <td style="font-size:12px;color:#64748b;">${hasScore ? 'Completed' : 'Registered'}</td>
        </tr>
      `;
    }).join('');
  }

  async autoSubmitScheduledExam() {
    if (this.examEngine && !this.examEngine.isSubmitted) {
      this.currentResult = this.examEngine.evaluate();
      const recording = this.recordSubmission(this.currentResult);
      this.showResultsView();
      await recording;
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

    const resultCandidate = this.currentAttempt?.candidate || this.candidate;
    if (nameEl && resultCandidate) nameEl.textContent = resultCandidate.name;
    if (rollEl && resultCandidate) rollEl.textContent = resultCandidate.rollNo;
    const resultDate = this.currentAttempt?.submittedAt || new Date().toISOString();
    if (dateEl) dateEl.textContent = new Date(resultDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    if (titleEl) titleEl.textContent = this.currentAttempt?.paperTitle || this.currentResult.paperTitle || this.currentPaper?.title || 'Mock Examination';

    document.querySelectorAll('.filter-btn').forEach(button => {
      const filter = button.dataset.filter;
      const count = filter === 'ALL' ? res.totalQuestions
        : filter === 'CORRECT' ? res.correctCount
          : filter === 'INCORRECT' ? res.incorrectCount
            : res.unattemptedCount;
      const label = filter === 'ALL' ? 'All' : filter[0] + filter.slice(1).toLowerCase();
      button.textContent = `${label} (${count})`;
    });

    this.renderSolutionList();
    this.renderResultInsights();
  }

  renderResultInsights() {
    const container = document.getElementById('result-insights');
    if (!container || !this.currentResult) return;
    const breakdown = this.currentResult.breakdown || [];
    const totalSeconds = breakdown.reduce((sum, item) => sum + Number(item.timeSpent || 0), 0);
    const attempted = this.currentResult.correctCount + this.currentResult.incorrectCount;
    const avgSeconds = attempted ? Math.round(totalSeconds / attempted) : 0;
    const slowest = [...breakdown].sort((a, b) => Number(b.timeSpent || 0) - Number(a.timeSpent || 0))[0];
    const analysis = this.examStorage.getAnalysis(this.candidate);
    const change = analysis?.recentChange || 0;
    const trendText = analysis && analysis.count > 1
      ? `${change >= 0 ? '+' : ''}${change}% over recent attempts`
      : 'Complete another attempt to see a trend';

    container.innerHTML = `
      <div class="insight-card">Average pace<strong>${avgSeconds ? `${avgSeconds}s / attempted question` : 'No attempted questions'}</strong></div>
      <div class="insight-card">Most time spent<strong>${slowest ? `Question ${this.escapeHtml(slowest.id)} (${Number(slowest.timeSpent || 0)}s)` : 'Not available'}</strong></div>
      <div class="insight-card">Score trend<strong>${trendText}</strong></div>
    `;
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  openProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (!modal) return;
    this.renderProgressDashboard();
    modal.style.display = 'flex';
  }

  renderProgressDashboard() {
    const summary = document.getElementById('progress-summary');
    const list = document.getElementById('progress-attempts');
    if (!summary || !list) return;
    const attempts = this.examStorage.getAttempts(this.candidate);
    const analysis = this.examStorage.getAnalysis(this.candidate);

    if (!analysis) {
      summary.innerHTML = '';
      list.innerHTML = '<div style="padding:28px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:8px;">No saved attempts yet. Finish a practice test and your detailed result will appear here.</div>';
      return;
    }

    summary.innerHTML = `
      <div class="progress-summary-card"><strong>${analysis.count}</strong><span>Attempts</span></div>
      <div class="progress-summary-card"><strong>${analysis.best.result.percentage}%</strong><span>Best score</span></div>
      <div class="progress-summary-card"><strong>${analysis.averageAccuracy}%</strong><span>Avg accuracy</span></div>
      <div class="progress-summary-card"><strong>${analysis.recentChange >= 0 ? '+' : ''}${analysis.recentChange}%</strong><span>Recent trend</span></div>
    `;

    list.innerHTML = attempts.map(attempt => `
      <div class="progress-attempt-row">
        <div>
          <div class="progress-attempt-title">${this.escapeHtml(attempt.paperTitle)}</div>
          <div class="progress-attempt-meta">${new Date(attempt.submittedAt).toLocaleString()} &bull; ${this.escapeHtml(attempt.mode || 'PRACTICE')}</div>
        </div>
        <div class="progress-metric"><strong>${attempt.result.totalScore} / ${attempt.result.maxPossibleMarks}</strong>Score</div>
        <div class="progress-metric"><strong>${attempt.result.accuracyPercent}%</strong>Accuracy</div>
        <div class="progress-metric"><strong>${attempt.result.correctCount}/${attempt.result.totalQuestions}</strong>Correct</div>
        <div class="progress-row-actions">
          <button class="mode-btn progress-review-btn" data-attempt-id="${this.escapeHtml(attempt.id)}">Review</button>
          <button class="mode-btn danger-button progress-delete-btn" data-attempt-id="${this.escapeHtml(attempt.id)}" title="Delete this attempt">&times;</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.progress-review-btn').forEach(button => {
      button.addEventListener('click', () => this.reviewSavedAttempt(button.dataset.attemptId));
    });
    list.querySelectorAll('.progress-delete-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (!window.confirm('Delete this saved attempt? This cannot be undone unless you exported a backup.')) return;
        this.examStorage.deleteAttempt(button.dataset.attemptId);
        this.renderProgressDashboard();
      });
    });
  }

  reviewSavedAttempt(id) {
    const attempt = this.examStorage.getAttempt(id);
    if (!attempt) return alert('That saved attempt could not be found.');
    this.currentAttempt = attempt;
    this.currentResult = attempt.result;
    this.latestSubmission = {
      candidateName: attempt.candidate.name,
      rollNo: attempt.candidate.rollNo,
      paperId: attempt.paperId,
      score: attempt.result.totalScore,
      maxScore: attempt.result.maxPossibleMarks,
      accuracyPercent: attempt.result.accuracyPercent,
      correctCount: attempt.result.correctCount,
      incorrectCount: attempt.result.incorrectCount,
      unattemptedCount: attempt.result.unattemptedCount,
      submittedAt: attempt.submittedAt
    };
    document.getElementById('progress-modal').style.display = 'none';
    this.showResultsView();
  }

  downloadProgressBackup() {
    const blob = new Blob([this.examStorage.exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gate-exam-progress-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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

    const floatingCalc = document.getElementById('btn-floating-calculator');
    if (floatingCalc) {
      floatingCalc.addEventListener('click', () => this.calculator.toggle());
    }

    const paletteToggle = document.getElementById('btn-palette-toggle');
    const paletteClose = document.getElementById('btn-palette-close');
    const paletteScrim = document.getElementById('palette-scrim');
    if (paletteToggle) paletteToggle.addEventListener('click', () => this.toggleQuestionPalette());
    if (paletteClose) paletteClose.addEventListener('click', () => this.closeQuestionPalette(true));
    if (paletteScrim) paletteScrim.addEventListener('click', () => this.closeQuestionPalette(true));

    const paletteGrid = document.getElementById('palette-grid');
    if (paletteGrid) {
      paletteGrid.addEventListener('click', (event) => {
        if (event.target.closest('.grid-btn') && window.matchMedia('(max-width: 1060px)').matches) {
          this.closeQuestionPalette();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.getElementById('view-exam')?.classList.contains('palette-open')) {
        this.closeQuestionPalette(true);
      }
    });

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

    const btnHeaderProgress = document.getElementById('btn-header-progress');
    if (btnHeaderProgress) {
      btnHeaderProgress.addEventListener('click', () => this.openProgressModal());
    }

    const btnExportProgress = document.getElementById('btn-export-progress');
    if (btnExportProgress) {
      btnExportProgress.addEventListener('click', () => this.downloadProgressBackup());
    }

    const btnImportProgress = document.getElementById('btn-import-progress');
    const progressImportInput = document.getElementById('progress-import-input');
    if (btnImportProgress && progressImportInput) {
      btnImportProgress.addEventListener('click', () => progressImportInput.click());
      progressImportInput.addEventListener('change', () => {
        const file = progressImportInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            this.examStorage.importBackup(reader.result);
            this.renderProgressDashboard();
            alert('Progress backup imported successfully.');
          } catch (error) {
            alert(error.message || 'The backup could not be imported.');
          } finally {
            progressImportInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    const btnClearProgress = document.getElementById('btn-clear-progress');
    if (btnClearProgress) {
      btnClearProgress.addEventListener('click', () => {
        if (!window.confirm('Clear every saved attempt and unfinished exam in this browser? Export a backup first if you may need it later.')) return;
        this.examStorage.clearAll();
        this.currentAttempt = null;
        this.renderProgressDashboard();
      });
    }

    window.addEventListener('pagehide', () => this.saveExamDraft());

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
      candProf.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCandidateModal();
        }
      });
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
        if (this.scheduledPaper) {
          this.currentPaper = this.scheduledPaper;
          this.applyPaperSchedule(this.currentPaper);
          document.getElementById('paper-header-title').textContent = this.currentPaper.title;
        }
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

    const practicePaperSelect = document.getElementById('select-practice-paper');
    if (practicePaperSelect) {
      practicePaperSelect.addEventListener('change', event => this.selectPracticePaper(event.target.value));
    }

    // Time simulator dropdown
    const selectWarp = document.getElementById('select-time-warp');
    if (selectWarp) {
      selectWarp.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'real') {
          this.scheduleManager.resetRealTime();
        } else {
          this.scheduleManager.simulatePhase(val);
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

  toggleQuestionPalette() {
    const examView = document.getElementById('view-exam');
    if (!examView) return;
    const shouldOpen = !examView.classList.contains('palette-open');
    examView.classList.toggle('palette-open', shouldOpen);
    const trigger = document.getElementById('btn-palette-toggle');
    if (trigger) trigger.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) {
      const closeButton = document.getElementById('btn-palette-close');
      if (closeButton) closeButton.focus({ preventScroll: true });
    }
  }

  closeQuestionPalette(returnFocus = false) {
    const examView = document.getElementById('view-exam');
    if (examView) examView.classList.remove('palette-open');
    const trigger = document.getElementById('btn-palette-toggle');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus({ preventScroll: true });
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
    this.applyPaperSchedule(this.currentPaper);
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
      if (!this.currentPaper || !this.currentPaper.schedule) {
        badge.textContent = 'Scheduled Mode';
      } else {
        const start = this.scheduleManager.getExamStartTime();
        const end = this.scheduleManager.getExamEndTime();
        badge.textContent = `Scheduled: ${this.formatScheduleDate(start)} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      }
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
