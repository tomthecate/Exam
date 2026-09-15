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
    return {
      "paperId": "custom_mock_test_01",
      "title": "Sample GATE Mock Test",
      "subject": "General Aptitude / Engineering Mathematics",
      "durationMinutes": 40,
      "totalQuestions": 20,
      "totalMarks": 40,
      "schedule": {
        "dailyStart": "21:00",
        "dailyEnd": "21:40",
        "resultTime": "21:50"
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
