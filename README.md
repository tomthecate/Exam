# Mock GATE CBT Examination Platform

A modern, high-fidelity Computer-Based Test (CBT) mock examination web application designed after the official **GATE / TCS iON** examination portal. 

---

## Features

- **Standard GATE CBT Layout**:
  - Top navigation with paper title, candidate details, and live countdown timer.
  - Official question palette with status indicators:
    - ⬜ **Not Visited** (Gray)
    - 🟥 **Not Answered** (Red)
    - 🟩 **Answered** (Green)
    - 🟪 **Marked for Review** (Purple)
    - 🟪🟢 **Answered & Marked for Review** (Considered for evaluation)
  - Navigation buttons: `Save & Next`, `Clear Response`, `Mark for Review & Next`, `Previous`.
  - Built-in **GATE Official Virtual Scientific Calculator** (supports $\sin$, $\cos$, $\tan$, $\log$, $\ln$, $\sqrt{x}$, $x^y$, $n!$, $\pi$, $e$).
  - Full Question Paper overview and Examination Instructions modals.

- **Dynamic Duration & JSON Schedule**:
  - Duration is always **2 minutes per question**. For example, 20 questions provide 40 minutes and 35 questions provide 70 minutes.
  - The exam end is calculated from `schedule.examDate` + `schedule.startTime` + the derived duration; there is no configurable end-time override.
  - Exam start and published-result date/time are declared in each paper JSON using `examDate`, `startTime`, `resultDate`, and `resultTime`.
  - A candidate sees their detailed result immediately after manual submission or automatic timeout.
  - **Practice Mode (Anytime)** uses the same dynamic duration rule.
  - **Time Simulator** derives every simulated phase from the loaded paper rather than fixed clock times.

- **LaTeX Scientific Notation**:
  - Full math rendering powered by KaTeX ($...$ for inline, $$...$$ for display equations).
  - Fractions, square roots, Greek letters ($\sigma, \alpha, \beta, \theta$), superscripts, subscripts, matrices, and units.
  - Inline SVG diagram support for geometric figures, graphs, and Venn diagrams.

- **Past Exam Practice Sets**:
  - Students can choose from the available papers in `data/papers/index.json` before starting Practice Mode.
  - Each listed `.json` paper uses the same validation-friendly question format and LaTeX support.

- **Private Browser-Based Progress Tracking (GitHub Pages compatible)**:
  - Keeps up to 30 complete attempts per candidate in the browser, including answers, marks, timing, and detailed solutions.
  - Restores an unfinished test after an accidental refresh or browser restart.
  - Includes a **My Progress** dashboard with best score, average accuracy, recent trend, and past-attempt review.
  - Adds pace analysis and the slowest question to each performance report.
  - Supports JSON backup and restore so progress can be moved to another browser or protected before browser data is cleared.
  - No account or server is required. Data is private to the browser/device and is not synchronized automatically.

---

## How to Run the Website

### Option 1: Double-Click `index.html`
Simply open `index.html` in your favorite web browser (Chrome, Safari, Firefox, or Edge).

### Option 2: Run a Local Static Server
In your terminal, navigate to the folder and run:
```bash
python3 -m http.server 8080
```
Then open: [http://localhost:8080](http://localhost:8080) in your browser.

---

## Question Paper JSON Specification & Format

You can upload your own question papers using the **"Upload JSON"** button in the portal. Here is the exact JSON structure:

```json
{
  "paperId": "csir_net_gate_general_aptitude_01",
  "title": "CSIR NET / GATE General Aptitude Mock Paper",
  "subject": "General Aptitude (Part A / Paper 1)",
  "totalQuestions": 20,
  "totalMarks": 40,
  "schedule": {
    "examDate": "2026-09-18",
    "startTime": "21:00",
    "resultDate": "2026-09-18",
    "resultTime": "21:40"
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
      "question": "A and B have in their collection, coins of Re. 1, Rs. 2, Rs. 5 and Rs. 10 in the ratio $3:2:2:1$ and $4:3:2:1$, respectively. The total number of coins with each of them is equal. If the value of coins with A is Rs. 270/-, what is the value of the coins (in Rs) with B?",
      "diagramSvg": "<svg ...>...</svg>",
      "options": [
        { "id": "a", "text": "213" },
        { "id": "b", "text": "240" },
        { "id": "c", "text": "275" },
        { "id": "d", "text": "282" }
      ],
      "correctAnswer": "b",
      "solution": "**Given:**\\nRatio with A = $3:2:2:1$\\n$$\\frac{27x}{8} = 270 \\implies x = 80$$\\nTotal value for B = $32 + 48 + 80 + 80 = \\mathbf{240}$."
    }
  ]
}
```

---

## LaTeX Syntax Guide for Questions & Solutions

| Math Notation | LaTeX Syntax | In JSON String (Escaped) |
|---|---|---|
| Inline Formula | `$x_1, x_2, \dots, x_n$` | `"$x_1, x_2, \\dots, x_n$"` |
| Display Block Equation | `$$\frac{a}{b}$$` | `"$$\\frac{a}{b}$$"` |
| Greek Letters ($\sigma, \alpha, \beta, \theta, \pi$) | `$\sigma, \alpha, \beta, \theta, \pi$` | `"$\\sigma, \\alpha, \\beta, \\theta, \\pi$"` |
| Square Root ($\sqrt{2}, \sqrt[3]{x}$) | `$\sqrt{2}$`, `$\sqrt[3]{x}$` | `"$\\sqrt{2}$"`, `"$\\sqrt[3]{x}$"` |
| Fraction ($\frac{3}{8}$) | `$\frac{3}{8}$` | `"$\\frac{3}{8}$"` |
| Exponents & Subscripts ($x^2, a_i$) | `$x^2, a_i$` | `"$x^2, a_i$"` |
| Degree Symbol ($30^\circ$) | `$30^\circ$` | `"$30^\\circ$"` |
| Multiplication / Division ($\times, \div$) | `$\times, \div$` | `"$\\times, \\div$"` |
| Percent & Units | `$20\%$`, `$\text{ hrs}$` | `"$20\\%$"`, `"$\\text{ hrs}$"` |
| Binomial Coefficient ($\binom{n}{k}$) | `$\binom{n}{k}$` | `"$\\binom{n}{k}$"` |
| Summation / Integrals | `$\sum_{i=1}^n x_i$`, `$\int_0^1 x dx$` | `"$\\sum_{i=1}^n x_i$"`, `"$\\int_0^1 x dx$"` |

> [!TIP]
> In JSON strings, always use double backslashes `\\` for LaTeX commands (e.g. `\\sigma`, `\\sqrt{2}`, `\\frac{a}{b}`).

---

## Supported Question Types

1. **MCQ (Multiple Choice Questions)**:
   - Single correct option (`"correctAnswer": "b"`).
   - Standard negative marking applies (e.g. `-0.66`).

2. **MSQ (Multiple Select Questions)**:
   - One or more correct options (`"correctAnswer": ["a", "c"]`).
   - Checkboxes are rendered.
   - Typically no negative marking.

3. **NAT (Numerical Answer Type)**:
   - Exact number (`"correctAnswer": 12.0`) or range (`"correctAnswer": { "min": 11.9, "max": 12.1 }`).
   - Numerical input field is rendered.

---

## Included Sample Question Paper

The platform comes pre-loaded with selectable CSIR NET / GATE General Aptitude practice sets containing questions, diagrams, options, and step-by-step solutions:
- **Questions 1 to 20** covering ratios, relative speed, probability, standard deviation, logical window puzzle, geometric perimeter, 3D sphere stacking, GDP data interpretation, Venn diagrams, sibling probabilities, and self-referential reasoning.
- Inline SVGs included for all diagram questions (Q8, Q10, Q12, Q13).
- Step-by-step LaTeX solutions for all 20 questions.
