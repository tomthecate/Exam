/**
 * JSON Paper Validator and Parser
 */
const JsonValidator = {
  /**
   * Validate a question paper object against expected schema
   * @param {Object} paper 
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate(paper) {
    const errors = [];
    const warnings = [];

    if (!paper || typeof paper !== 'object') {
      return { valid: false, errors: ['File does not contain a valid JSON object.'], warnings };
    }

    if (!paper.paperId) errors.push('Missing field "paperId"');
    if (!paper.title) errors.push('Missing field "title"');
    if (!paper.questions || !Array.isArray(paper.questions)) {
      errors.push('Missing or invalid "questions" array.');
      return { valid: false, errors, warnings };
    }

    if (paper.questions.length === 0) {
      errors.push('"questions" array is empty. At least 1 question is required.');
    }

    // Derived fields are normalized from the actual question array.
    const durationMinutes = paper.questions.length * 2;
    if (!paper.totalMarks) {
      paper.totalMarks = paper.questions.length * 2;
    }

    // Schedule validation
    if (paper.schedule) {
      const s = paper.schedule;
      ['examDate', 'startTime', 'resultDate', 'resultTime'].forEach(field => {
        if (!s[field]) errors.push(`Schedule is missing "${field}".`);
      });

      if (s.examDate && !/^\d{4}-\d{2}-\d{2}$/.test(s.examDate)) {
        errors.push(`"examDate" (${s.examDate}) must use YYYY-MM-DD format.`);
      }
      if (s.resultDate && !/^\d{4}-\d{2}-\d{2}$/.test(s.resultDate)) {
        errors.push(`"resultDate" (${s.resultDate}) must use YYYY-MM-DD format.`);
      }
      ['startTime', 'resultTime'].forEach(field => {
        if (s[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s[field])) {
          errors.push(`"${field}" (${s[field]}) must use 24-hour HH:MM format.`);
        }
      });

      if (s.examDate && s.startTime && s.resultDate && s.resultTime) {
        const examStart = new Date(`${s.examDate}T${s.startTime}:00`);
        const examEnd = new Date(examStart.getTime() + durationMinutes * 60000);
        const resultStart = new Date(`${s.resultDate}T${s.resultTime}:00`);
        if (resultStart < examEnd) {
          errors.push(`Published result time must not be earlier than the calculated exam end (${examEnd.toLocaleString()}).`);
        }
      }
    } else {
      errors.push('Missing required "schedule" object.');
    }

    paper.questions.forEach((q, idx) => {
      const qNum = q.id ?? (idx + 1);
      if (!q.question) errors.push(`Question #${qNum}: Missing "question" text.`);
      if (!q.type) errors.push(`Question #${qNum}: Missing "type" (MCQ/MSQ/NAT).`);
      
      if (q.type === 'MCQ' || q.type === 'MSQ') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`Question #${qNum}: MCQ/MSQ questions must have an "options" array with at least 2 choices.`);
        } else {
          q.options.forEach((opt, oIdx) => {
            if (!opt.id || typeof opt.text === 'undefined') {
              errors.push(`Question #${qNum}, Option #${oIdx + 1}: Missing "id" or "text".`);
            }
          });
        }
      }

      if (typeof q.correctAnswer === 'undefined') {
        warnings.push(`Question #${qNum}: No "correctAnswer" provided. Automatic scoring will not work.`);
      }

      // Check LaTeX syntax warnings
      if (typeof q.question === 'string') {
        const dollarCount = (q.question.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
          warnings.push(`Question #${qNum}: Odd number of '$' symbols detected in question text. Check for unclosed LaTeX tags.`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Produce a template JSON object
   */
  getTemplate() {
    const pad = value => String(value).padStart(2, '0');
    const toDate = value => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    const toTime = value => `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    const start = new Date(Date.now() + 5 * 60000);
    start.setSeconds(0, 0);
    const result = new Date(start.getTime() + 2 * 60000); // template contains one question
    return {
      "paperId": "custom_mock_test_01",
      "title": "Sample GATE Mock Test",
      "subject": "General Aptitude / Engineering Mathematics",
      "totalMarks": 2,
      "schedule": {
        "examDate": toDate(start),
        "startTime": toTime(start),
        "resultDate": toDate(result),
        "resultTime": toTime(result)
      },
      "markingScheme": {
        "positiveMarks": 2,
        "negativeMarks": 0.66
      },
      "questions": [
        {
          "id": 1,
          "type": "MCQ",
          "marks": 2,
          "negativeMarks": 0.66,
          "question": "Evaluate the definite integral $\\int_{0}^{\\pi/2} \\sin^2(x)\\, dx$:",
          "options": [
            { "id": "a", "text": "$\\pi/4$" },
            { "id": "b", "text": "$\\pi/2$" },
            { "id": "c", "text": "$1$" },
            { "id": "d", "text": "$\\pi$" }
          ],
          "correctAnswer": "a",
          "solution": "Using the identity $\\sin^2(x) = \\frac{1 - \\cos(2x)}{2}$:\n$$\\int_{0}^{\\pi/2} \\frac{1 - \\cos(2x)}{2}\\, dx = \\left[ \\frac{x}{2} - \\frac{\\sin(2x)}{4} \\right]_0^{\\pi/2} = \\frac{\\pi}{4} - 0 = \\mathbf{\\frac{\\pi}{4}}$$"
        }
      ]
    };
  }
};

window.JsonValidator = JsonValidator;
