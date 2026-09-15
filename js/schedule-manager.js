/**
 * Daily Schedule Engine (9:00 PM - 9:40 PM Exam, 9:50 PM Results)
 */
class ScheduleManager {
  constructor(options = {}) {
    this.startHour = options.startHour ?? 21; // 21:00 (9:00 PM)
    this.startMinute = options.startMinute ?? 0;
    this.endHour = options.endHour ?? 21;   // 21:40 (9:40 PM)
    this.endMinute = options.endMinute ?? 40;
    this.resultHour = options.resultHour ?? 21; // 21:50 (9:50 PM)
    this.resultMinute = options.resultMinute ?? 50;

    this.mode = 'SCHEDULED'; // 'SCHEDULED' or 'PRACTICE'
    this.simulatedTimeOffset = 0; // in milliseconds (for testing time warp)
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
   * Get current time (either real local time or simulated)
   */
  getEffectiveDate() {
    return new Date(Date.now() + this.simulatedTimeOffset);
  }

  /**
   * Set simulated clock time (for instant testing)
   * @param {number} hours 
   * @param {number} minutes 
   * @param {number} seconds 
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
   * Evaluate state for today's schedule
   */
  getCurrentState() {
    if (this.mode === 'PRACTICE') {
      return {
        mode: 'PRACTICE',
        phase: 'PRACTICE_ACTIVE',
        effectiveDate: this.getEffectiveDate()
      };
    }

    const now = this.getEffectiveDate();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();

    const examStartTime = new Date(year, month, date, this.startHour, this.startMinute, 0);
    const examEndTime = new Date(year, month, date, this.endHour, this.endMinute, 0);
    const resultTime = new Date(year, month, date, this.resultHour, this.resultMinute, 0);

    const nowMs = now.getTime();
    const startMs = examStartTime.getTime();
    const endMs = examEndTime.getTime();
    const resMs = resultTime.getTime();

    if (nowMs < startMs) {
      // Lobby before 9:00 PM
      const remainingSeconds = Math.max(0, Math.floor((startMs - nowMs) / 1000));
      return {
        mode: 'SCHEDULED',
        phase: 'PRE_EXAM_LOBBY',
        effectiveDate: now,
        targetTime: examStartTime,
        remainingSeconds,
        title: 'Exam starts at 9:00 PM'
      };
    } else if (nowMs >= startMs && nowMs < endMs) {
      // Exam Live: 9:00 PM to 9:40 PM
      const remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
      return {
        mode: 'SCHEDULED',
        phase: 'EXAM_LIVE',
        effectiveDate: now,
        targetTime: examEndTime,
        remainingSeconds,
        totalSeconds: 40 * 60,
        title: 'GATE Mock Exam is LIVE'
      };
    } else if (nowMs >= endMs && nowMs < resMs) {
      // Window: 9:40 PM to 9:50 PM
      const remainingSeconds = Math.max(0, Math.floor((resMs - nowMs) / 1000));
      return {
        mode: 'SCHEDULED',
        phase: 'WAITING_FOR_RESULTS',
        effectiveDate: now,
        targetTime: resultTime,
        remainingSeconds,
        title: 'Results will be declared at 9:50 PM'
      };
    } else {
      // 9:50 PM onwards
      return {
        mode: 'SCHEDULED',
        phase: 'RESULTS_DECLARED',
        effectiveDate: now,
        title: 'Results & Detailed Solutions Available'
      };
    }
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

window.ScheduleManager = ScheduleManager;
