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

- **Exam Duration & Daily Timing**:
  - **40 Minutes** allocated for **20 Questions** (40 Total Marks).
  - **Daily Schedule Mode**:
    - **Before 9:00 PM**: Pre-exam waiting lobby with real-time countdown to 9:00 PM.
    - **9:00 PM to 9:40 PM**: Live exam window. Timer counts down 40 minutes; automatic submission triggers at 9:40 PM sharp.
    - **9:40 PM to 9:50 PM**: Evaluation lobby. System records responses and prepares analysis.
    - **9:50 PM Onwards**: Results & detailed solutions published.
  - **Practice Mode (Anytime)**: Allows taking an immediate 40-minute mock test at any time of day.
  - **Time Simulator**: Quickly test each phase (8:58 PM lobby, 9:00 PM start, 9:39 PM final minute, 9:45 PM waiting, 9:50 PM results).

- **LaTeX Scientific Notation**:
  - Full math rendering powered by KaTeX ($...$ for inline, $$...$$ for display equations).
  - Fractions, square roots, Greek letters ($\sigma, \alpha, \beta, \theta$), superscripts, subscripts, matrices, and units.
  - Inline SVG diagram support for geometric figures, graphs, and Venn diagrams.

- **Question Paper Upload & Management**:
  - Upload any custom `.json` question paper.
  - Built-in schema validator with real-time syntax checking and LaTeX preview.
  - One-click template download.

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

The platform comes pre-loaded with the **CSIR NET / GATE General Aptitude Paper** containing all **20 questions**, diagrams, options, and step-by-step solutions extracted directly from your uploaded PDF:
- **Questions 1 to 20** covering ratios, relative speed, probability, standard deviation, logical window puzzle, geometric perimeter, 3D sphere stacking, GDP data interpretation, Venn diagrams, sibling probabilities, and self-referential reasoning.
- Inline SVGs included for all diagram questions (Q8, Q10, Q12, Q13).
- Step-by-step LaTeX solutions for all 20 questions.
