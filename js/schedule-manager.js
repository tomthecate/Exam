/**
 * Flexible Exam Schedule Engine
 * Supports explicit exam date, exam start time, dynamic duration (2 mins/question),
 * and explicit date & time of result release.
 */
class ScheduleManager {
  constructor(options = {}) {
    this.examDate = options.examDate ?? null;
    this.startTime = options.startTime ?? null;
    this.resultDate = options.resultDate ?? null;
    this.resultTime = options.resultTime ?? null;

    // Always derived from the loaded paper: 2 minutes per question.
    this.durationMinutes = 0;

    this.mode = 'SCHEDULED'; // 'SCHEDULED' or 'PRACTICE'
    this.simulatedTimeOffset = 0; // in milliseconds
    this.listeners = [];
  }

  setMode(mode) {
    this.mode = mode;
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    const state = this.getCurrentState();
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Set schedule and duration from paper data object
   * @param {Object} paper
   */
  setScheduleFromPaper(paper) {
    if (!paper) return;

    // Rule 1: Dynamic duration = 2 minutes per question
    const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
    this.durationMinutes = qCount * 2;

    if (paper.schedule) {
      const s = paper.schedule;
      this.examDate = s.examDate || null;
      this.startTime = s.startTime || null;
      this.resultDate = s.resultDate || null;
      this.resultTime = s.resultTime || null;
    }

    this.notify();
  }

  /**
   * Helper to parse date and time string into a Date object
   */
  parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return new Date(NaN);
    const now = this.getEffectiveDate();
    let y = now.getFullYear();
    let m = now.getMonth();
    let d = now.getDate();

    if (dateStr) {
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      }
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3) {
        y = parts[0];
        m = parts[1] - 1;
        d = parts[2];
      }
    }

    let h = 0;
    let min = 0;
    let s = 0;
    const tParts = timeStr.split(':').map(Number);
    h = tParts[0] || 0;
    min = tParts[1] || 0;
    s = tParts[2] || 0;

    return new Date(y, m, d, h, min, s);
  }

  getExamStartTime() {
    return this.parseDateTime(this.examDate, this.startTime);
  }

  getExamEndTime() {
    const start = this.getExamStartTime();
    // The end can never be overridden: every question contributes 2 minutes.
    return new Date(start.getTime() + (this.durationMinutes * 60 * 1000));
  }

  getResultTime() {
    const end = this.getExamEndTime();
    if (!this.resultDate || !this.resultTime) return end;
    return this.parseDateTime(this.resultDate, this.resultTime);
  }

  /**
   * Get current time (either real local time or simulated)
   */
  getEffectiveDate() {
    return new Date(Date.now() + this.simulatedTimeOffset);
  }

  /**
   * Set simulated clock time to specific phase relative to exam schedule
   * @param {string} phase 'real' | 'pre_exam' | 'exam_start' | 'exam_ending' | 'waiting_results' | 'results_out'
   */
  simulatePhase(phase) {
    if (phase === 'real') {
      this.resetRealTime();
      return;
    }

    const start = this.getExamStartTime();
    const end = this.getExamEndTime();
    const res = this.getResultTime();
    let targetTime = null;

    switch (phase) {
      case 'pre_exam':
        targetTime = new Date(start.getTime() - 2 * 60 * 1000); // 2 mins before start
        break;
      case 'exam_start':
        targetTime = new Date(start.getTime() + 10 * 1000); // 10s into exam
        break;
      case 'exam_ending':
        targetTime = new Date(end.getTime() - 45 * 1000); // 45s before end
        break;
      case 'waiting_results':
        targetTime = new Date(res.getTime() - 2 * 60 * 1000); // 2 mins before results
        if (targetTime.getTime() <= end.getTime()) {
          targetTime = new Date(end.getTime() + 30 * 1000);
        }
        break;
      case 'results_out':
        targetTime = new Date(res.getTime() + 10 * 1000); // 10s after results
        break;
      default:
        this.resetRealTime();
        return;
    }

    if (targetTime) {
      this.simulatedTimeOffset = targetTime.getTime() - Date.now();
      this.notify();
    }
  }

  /**
   * Legacy simulate clock time
   */
  simulateTime(hours, minutes, seconds = 0) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
    this.simulatedTimeOffset = target.getTime() - Date.now();
    this.notify();
  }

  resetRealTime() {
    this.simulatedTimeOffset = 0;
    this.notify();
  }

  /**
   * Evaluate state for configured schedule
   */
  getCurrentState() {
    if (this.mode === 'PRACTICE') {
      return {
        mode: 'PRACTICE',
        phase: 'PRACTICE_ACTIVE',
        effectiveDate: this.getEffectiveDate(),
        durationMinutes: this.durationMinutes,
        totalSeconds: this.durationMinutes * 60
      };
    }

    const now = this.getEffectiveDate();
    const examStartTime = this.getExamStartTime();
    const examEndTime = this.getExamEndTime();
    const resultTime = this.getResultTime();

    const nowMs = now.getTime();
    const startMs = examStartTime.getTime();
    const endMs = examEndTime.getTime();
    const resMs = resultTime.getTime();

    const formatDateStr = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const formatTimeStr = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    if (nowMs < startMs) {
      // Pre-exam lobby
      const remainingSeconds = Math.max(0, Math.floor((startMs - nowMs) / 1000));
      return {
        mode: 'SCHEDULED',
        phase: 'PRE_EXAM_LOBBY',
        effectiveDate: now,
        examStartTime,
        examEndTime,
        resultTime,
        targetTime: examStartTime,
        remainingSeconds,
        durationMinutes: this.durationMinutes,
        totalSeconds: this.durationMinutes * 60,
        title: `Exam starts on ${formatDateStr(examStartTime)} at ${formatTimeStr(examStartTime)}`
      };
    } else if (nowMs >= startMs && nowMs < endMs) {
      // Exam Live
      const remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
      return {
        mode: 'SCHEDULED',
        phase: 'EXAM_LIVE',
        effectiveDate: now,
        examStartTime,
        examEndTime,
        resultTime,
        targetTime: examEndTime,
        remainingSeconds,
        durationMinutes: this.durationMinutes,
        totalSeconds: this.durationMinutes * 60,
        title: 'GATE Mock Exam is LIVE'
      };
    } else if (nowMs >= endMs && nowMs < resMs) {
      // Waiting for results
      const remainingSeconds = Math.max(0, Math.floor((resMs - nowMs) / 1000));
      return {
        mode: 'SCHEDULED',
        phase: 'WAITING_FOR_RESULTS',
        effectiveDate: now,
        examStartTime,
        examEndTime,
        resultTime,
        targetTime: resultTime,
        remainingSeconds,
        durationMinutes: this.durationMinutes,
        totalSeconds: this.durationMinutes * 60,
        title: `Results will be declared on ${formatDateStr(resultTime)} at ${formatTimeStr(resultTime)}`
      };
    } else {
      // Results declared
      return {
        mode: 'SCHEDULED',
        phase: 'RESULTS_DECLARED',
        effectiveDate: now,
        examStartTime,
        examEndTime,
        resultTime,
        durationMinutes: this.durationMinutes,
        totalSeconds: this.durationMinutes * 60,
        title: 'Results & Detailed Solutions Available'
      };
    }
  }

  formatTime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) {
      return `${days}d ${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

window.ScheduleManager = ScheduleManager;
