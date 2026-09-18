/**
 * Durable, versioned browser storage for GitHub Pages deployments.
 * All data stays in the current browser unless the user exports a backup.
 */
class ExamStorage {
  constructor() {
    this.storageKey = 'gate_exam_data_v1';
    this.maxAttempts = 30;
  }

  emptyStore() {
    return { version: 1, attempts: [], drafts: {}, updatedAt: new Date().toISOString() };
  }

  read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.attempts)) return this.emptyStore();
      parsed.drafts = parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {};
      return parsed;
    } catch (error) {
      console.warn('Exam history could not be read.', error);
      return this.emptyStore();
    }
  }

  write(store) {
    store.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(store));
      return true;
    } catch (error) {
      // Full result breakdowns can be sizeable. Preserve the newest records if
      // this browser has an unusually small storage quota.
      if (store.attempts.length > 5) {
        store.attempts = store.attempts.slice(0, Math.max(5, Math.floor(store.attempts.length * 0.75)));
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(store));
          return true;
        } catch (retryError) {}
      }
      console.warn('Exam history could not be saved.', error);
      return false;
    }
  }

  candidateKey(candidate) {
    return String(candidate?.rollNo || candidate?.name || 'candidate').trim().toLowerCase();
  }

  draftKey(paperId, candidate) {
    return `${String(paperId || 'paper')}::${this.candidateKey(candidate)}`;
  }

  saveAttempt({ result, candidate, paper, mode, startedAt, submittedAt }) {
    const store = this.read();
    const timestamp = submittedAt || new Date().toISOString();
    const attempt = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      candidate: {
        name: candidate?.name || 'Candidate',
        rollNo: candidate?.rollNo || 'GATE-01'
      },
      paperId: paper?.paperId || 'paper_01',
      paperTitle: result.paperTitle || paper?.title || 'Mock Examination',
      mode: mode || 'PRACTICE',
      startedAt: startedAt || timestamp,
      submittedAt: timestamp,
      result
    };

    store.attempts.push(attempt);
    store.attempts = store.attempts
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, this.maxAttempts);
    return this.write(store) ? attempt : null;
  }

  getAttempts(candidate = null) {
    const attempts = this.read().attempts;
    if (!candidate) return attempts;
    const key = this.candidateKey(candidate);
    return attempts.filter(item => this.candidateKey(item.candidate) === key);
  }

  getAttempt(id) {
    return this.read().attempts.find(item => item.id === id) || null;
  }

  saveDraft({ paperId, paperTitle, candidate, mode, engine, startedAt }) {
    if (!engine || engine.isSubmitted) return false;
    const store = this.read();
    const key = this.draftKey(paperId, candidate);
    store.drafts[key] = {
      paperId,
      paperTitle,
      candidateKey: this.candidateKey(candidate),
      mode,
      startedAt,
      savedAt: new Date().toISOString(),
      currentIndex: engine.currentIndex,
      secondsRemaining: engine.secondsRemaining,
      questionStates: engine.questionStates
    };
    return this.write(store);
  }

  getDraft(paperId, candidate) {
    return this.read().drafts[this.draftKey(paperId, candidate)] || null;
  }

  clearDraft(paperId, candidate) {
    const store = this.read();
    delete store.drafts[this.draftKey(paperId, candidate)];
    this.write(store);
  }

  deleteAttempt(id) {
    const store = this.read();
    store.attempts = store.attempts.filter(item => item.id !== id);
    return this.write(store);
  }

  getAnalysis(candidate) {
    const attempts = this.getAttempts(candidate);
    if (!attempts.length) return null;
    const chronological = [...attempts].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const latest = chronological[chronological.length - 1];
    const best = attempts.reduce((winner, item) =>
      item.result.percentage > winner.result.percentage ? item : winner, attempts[0]);
    const averageAccuracy = attempts.reduce((sum, item) => sum + Number(item.result.accuracyPercent || 0), 0) / attempts.length;
    const recent = chronological.slice(-5);
    const firstRecent = recent[0]?.result.percentage || 0;
    const latestRecent = recent[recent.length - 1]?.result.percentage || 0;
    const totalSeconds = latest.result.breakdown?.reduce((sum, q) => sum + Number(q.timeSpent || 0), 0) || 0;
    const attempted = (latest.result.correctCount || 0) + (latest.result.incorrectCount || 0);

    return {
      count: attempts.length,
      latest,
      best,
      averageAccuracy: Number(averageAccuracy.toFixed(1)),
      recentChange: Number((latestRecent - firstRecent).toFixed(1)),
      averageSecondsPerAttemptedQuestion: attempted ? Math.round(totalSeconds / attempted) : 0
    };
  }

  exportBackup() {
    return JSON.stringify({
      app: 'GATE CBT Mock Examination Portal',
      exportedAt: new Date().toISOString(),
      data: this.read()
    }, null, 2);
  }

  importBackup(raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || parsed.app !== 'GATE CBT Mock Examination Portal' || !parsed.data) {
      throw new Error('This is not a valid exam progress backup.');
    }
    if (parsed.data.version !== 1 || !Array.isArray(parsed.data.attempts)) {
      throw new Error('This backup version is not supported.');
    }
    parsed.data.attempts = parsed.data.attempts.slice(0, this.maxAttempts);
    parsed.data.drafts = parsed.data.drafts || {};
    return this.write(parsed.data);
  }

  clearAll() {
    localStorage.removeItem(this.storageKey);
  }
}

window.ExamStorage = ExamStorage;
