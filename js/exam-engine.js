/**
 * Exam State & Logic Engine (TCS-iON / GATE standard)
 */
class ExamEngine {
  constructor(paperData) {
    this.paper = paperData;
    this.currentIndex = 0;
    // Dynamic duration rule: 2 minutes per question
    const questionCount = Array.isArray(paperData.questions) ? paperData.questions.length : 0;
    this.durationMinutes = questionCount * 2;
    this.durationSeconds = this.durationMinutes * 60;
    this.secondsRemaining = this.durationSeconds;
    this.timerInterval = null;
    this.isSubmitted = false;

    // Status definitions:
    // 'NOT_VISITED', 'NOT_ANSWERED', 'ANSWERED', 'MARKED_FOR_REVIEW', 'ANSWERED_AND_MARKED'
    this.questionStates = paperData.questions.map((q, idx) => ({
      id: q.id ?? (idx + 1),
      status: idx === 0 ? 'NOT_ANSWERED' : 'NOT_VISITED',
      userAnswer: null,
      timeSpent: 0
    }));

    this.onStateChangeCallbacks = [];
    this.onTimerTickCallbacks = [];
    this.onTimeExpiredCallbacks = [];
  }

  onStateChange(cb) { this.onStateChangeCallbacks.push(cb); }
  onTimerTick(cb) { this.onTimerTickCallbacks.push(cb); }
  onTimeExpired(cb) { this.onTimeExpiredCallbacks.push(cb); }

  emitStateChange() {
    this.onStateChangeCallbacks.forEach(cb => cb(this));
  }

  startTimer(customSeconds = null) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (customSeconds !== null) {
      this.secondsRemaining = customSeconds;
    }

    this.timerInterval = setInterval(() => {
      if (this.secondsRemaining > 0) {
        this.secondsRemaining--;
        this.questionStates[this.currentIndex].timeSpent++;
        this.onTimerTickCallbacks.forEach(cb => cb(this.secondsRemaining));
      } else {
        clearInterval(this.timerInterval);
        this.onTimeExpiredCallbacks.forEach(cb => cb());
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getCurrentQuestion() {
    return this.paper.questions[this.currentIndex];
  }

  getCurrentState() {
    return this.questionStates[this.currentIndex];
  }

  selectOption(optId) {
    const qState = this.questionStates[this.currentIndex];
    const question = this.getCurrentQuestion();
    if (question.type === 'MSQ') {
      const selected = Array.isArray(qState.userAnswer) ? [...qState.userAnswer] : [];
      const existingIndex = selected.indexOf(optId);
      if (existingIndex >= 0) selected.splice(existingIndex, 1);
      else selected.push(optId);
      qState.userAnswer = selected;
    } else {
      qState.userAnswer = optId;
    }
    this.emitStateChange();
  }

  clearResponse() {
    const qState = this.questionStates[this.currentIndex];
    qState.userAnswer = null;
    qState.status = 'NOT_ANSWERED';
    this.emitStateChange();
  }

  saveAndNext() {
    const qState = this.questionStates[this.currentIndex];
    if (qState.userAnswer !== null && qState.userAnswer !== '') {
      qState.status = 'ANSWERED';
    } else {
      qState.status = 'NOT_ANSWERED';
    }

    this.nextQuestion();
  }

  markForReviewAndNext() {
    const qState = this.questionStates[this.currentIndex];
    if (qState.userAnswer !== null && qState.userAnswer !== '') {
      qState.status = 'ANSWERED_AND_MARKED';
    } else {
      qState.status = 'MARKED_FOR_REVIEW';
    }

    this.nextQuestion();
  }

  nextQuestion() {
    if (this.currentIndex < this.paper.questions.length - 1) {
      this.goToQuestion(this.currentIndex + 1);
    } else {
      this.emitStateChange();
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.goToQuestion(this.currentIndex - 1);
    }
  }

  goToQuestion(newIndex) {
    if (newIndex < 0 || newIndex >= this.paper.questions.length) return;

    // If current was NOT_VISITED, mark as NOT_ANSWERED
    const currentQ = this.questionStates[this.currentIndex];
    if (currentQ.status === 'NOT_VISITED') {
      currentQ.status = 'NOT_ANSWERED';
    }

    this.currentIndex = newIndex;

    // If newly visited question was NOT_VISITED, mark as NOT_ANSWERED
    const nextQ = this.questionStates[newIndex];
    if (nextQ.status === 'NOT_VISITED') {
      nextQ.status = 'NOT_ANSWERED';
    }

    this.emitStateChange();
  }

  getPaletteSummary() {
    let notVisited = 0;
    let notAnswered = 0;
    let answered = 0;
    let marked = 0;
    let answeredAndMarked = 0;

    this.questionStates.forEach(q => {
      switch (q.status) {
        case 'NOT_VISITED': notVisited++; break;
        case 'NOT_ANSWERED': notAnswered++; break;
        case 'ANSWERED': answered++; break;
        case 'MARKED_FOR_REVIEW': marked++; break;
        case 'ANSWERED_AND_MARKED': answeredAndMarked++; break;
      }
    });

    return {
      notVisited,
      notAnswered,
      answered,
      marked,
      answeredAndMarked,
      total: this.paper.questions.length
    };
  }

  /**
   * Evaluate the exam responses and compute marks
   */
  evaluate() {
    this.stopTimer();
    this.isSubmitted = true;

    let totalMarks = 0;
    let maxPossibleMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const breakdown = this.paper.questions.map((q, idx) => {
      const state = this.questionStates[idx];
      const posMarks = q.marks ?? (this.paper.markingScheme?.positiveMarks ?? 2);
      const negMarks = q.negativeMarks ?? (this.paper.markingScheme?.negativeMarks ?? 0.66);
      maxPossibleMarks += posMarks;

      // Note: In official GATE rules, "ANSWERED_AND_MARKED" is considered for evaluation!
      const isAttempted = (state.status === 'ANSWERED' || state.status === 'ANSWERED_AND_MARKED') && state.userAnswer !== null;

      let isCorrect = false;
      let marksEarned = 0;

      if (!isAttempted) {
        unattemptedCount++;
      } else {
        if (q.type === 'MCQ') {
          if (String(state.userAnswer).toLowerCase() === String(q.correctAnswer).toLowerCase()) {
            isCorrect = true;
            marksEarned = posMarks;
            correctCount++;
          } else {
            isCorrect = false;
            marksEarned = -negMarks;
            incorrectCount++;
          }
        } else if (q.type === 'MSQ') {
          // Multiple select
          const userArr = Array.isArray(state.userAnswer) ? [...state.userAnswer].sort() : [state.userAnswer];
          const correctArr = Array.isArray(q.correctAnswer) ? [...q.correctAnswer].sort() : [q.correctAnswer];
          if (JSON.stringify(userArr) === JSON.stringify(correctArr)) {
            isCorrect = true;
            marksEarned = posMarks;
            correctCount++;
          } else {
            // MSQ typically has 0 negative marks in GATE
            marksEarned = 0;
            incorrectCount++;
          }
        } else if (q.type === 'NAT') {
          // Numerical answer
          const val = parseFloat(state.userAnswer);
          if (typeof q.correctAnswer === 'object' && q.correctAnswer.min !== undefined) {
            if (val >= q.correctAnswer.min && val <= q.correctAnswer.max) {
              isCorrect = true;
              marksEarned = posMarks;
              correctCount++;
            } else {
              marksEarned = 0;
              incorrectCount++;
            }
          } else if (val === parseFloat(q.correctAnswer)) {
            isCorrect = true;
            marksEarned = posMarks;
            correctCount++;
          } else {
            marksEarned = 0;
            incorrectCount++;
          }
        }
      }

      totalMarks += marksEarned;

      return {
        id: q.id ?? (idx + 1),
        question: q.question,
        diagramSvg: q.diagramSvg,
        options: q.options,
        userAnswer: state.userAnswer,
        correctAnswer: q.correctAnswer,
        isAttempted,
        isCorrect,
        marksEarned: Number(marksEarned.toFixed(2)),
        solution: q.solution,
        status: state.status,
        timeSpent: state.timeSpent
      };
    });

    const attemptedCount = correctCount + incorrectCount;
    const accuracy = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0;
    const percentage = maxPossibleMarks > 0 ? (Math.max(0, totalMarks) / maxPossibleMarks) * 100 : 0;

    return {
      paperTitle: this.paper.title,
      totalQuestions: this.paper.questions.length,
      maxPossibleMarks,
      totalScore: Number(totalMarks.toFixed(2)),
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracyPercent: Number(accuracy.toFixed(1)),
      percentage: Number(percentage.toFixed(1)),
      breakdown
    };
  }
}

window.ExamEngine = ExamEngine;
