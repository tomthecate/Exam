/**
 * GATE Official Style Virtual Scientific Calculator
 */
class GateCalculator {
  constructor(containerId) {
    this.containerId = containerId;
    this.expression = '';
    this.memory = 0;
    this.isOpen = false;
    this.isDegree = true;
    this.init();
  }

  init() {
    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      el.className = 'gate-calc-window';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.el = el;
    this.render();
    this.attachEvents();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.el.style.display = this.isOpen ? 'flex' : 'none';
  }

  close() {
    this.isOpen = false;
    this.el.style.display = 'none';
  }

  render() {
    this.el.innerHTML = `
      <div class="calc-header">
        <span>GATE Virtual Calculator</span>
        <button id="calc-close-btn" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;">&times;</button>
      </div>
      <div id="calc-display" class="calc-display">0</div>
      <div class="calc-grid">
        <button class="calc-btn" data-val="deg">Deg</button>
        <button class="calc-btn" data-val="rad">Rad</button>
        <button class="calc-btn" data-val="(">(</button>
        <button class="calc-btn" data-val=")">)</button>
        <button class="calc-btn clear" data-val="C">C</button>

        <button class="calc-btn" data-val="sin">sin</button>
        <button class="calc-btn" data-val="cos">cos</button>
        <button class="calc-btn" data-val="tan">tan</button>
        <button class="calc-btn" data-val="pi">&pi;</button>
        <button class="calc-btn clear" data-val="del">&larr;</button>

        <button class="calc-btn" data-val="ln">ln</button>
        <button class="calc-btn" data-val="log">log</button>
        <button class="calc-btn" data-val="sqrt">&radic;</button>
        <button class="calc-btn" data-val="^">^</button>
        <button class="calc-btn op" data-val="/">/</button>

        <button class="calc-btn" data-val="7">7</button>
        <button class="calc-btn" data-val="8">8</button>
        <button class="calc-btn" data-val="9">9</button>
        <button class="calc-btn" data-val="fact">n!</button>
        <button class="calc-btn op" data-val="*">&times;</button>

        <button class="calc-btn" data-val="4">4</button>
        <button class="calc-btn" data-val="5">5</button>
        <button class="calc-btn" data-val="6">6</button>
        <button class="calc-btn" data-val="1/x">1/x</button>
        <button class="calc-btn op" data-val="-">-</button>

        <button class="calc-btn" data-val="1">1</button>
        <button class="calc-btn" data-val="2">2</button>
        <button class="calc-btn" data-val="3">3</button>
        <button class="calc-btn" data-val="e">e</button>
        <button class="calc-btn op" data-val="+">+</button>

        <button class="calc-btn" data-val="0">0</button>
        <button class="calc-btn" data-val=".">.</button>
        <button class="calc-btn" data-val="+/-">&plusmn;</button>
        <button class="calc-btn" data-val="%">%</button>
        <button class="calc-btn equals" data-val="=">=</button>
      </div>
    `;
  }

  attachEvents() {
    this.el.querySelector('#calc-close-btn').addEventListener('click', () => this.close());
    const display = this.el.querySelector('#calc-display');

    this.el.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.target.getAttribute('data-val');
        this.handleButton(val);
      });
    });

    // Make draggable
    let isDragging = false, startX, startY, origLeft, origTop;
    const header = this.el.querySelector('.calc-header');
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.el.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      this.el.style.left = `${origLeft + (e.clientX - startX)}px`;
      this.el.style.top = `${origTop + (e.clientY - startY)}px`;
      this.el.style.right = 'auto';
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  updateDisplay(val) {
    const d = this.el.querySelector('#calc-display');
    d.textContent = val || '0';
  }

  factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= Math.min(n, 170); i++) r *= i;
    return r;
  }

  handleButton(val) {
    const d = this.el.querySelector('#calc-display');
    if (val === 'C') {
      this.expression = '';
      this.updateDisplay('0');
      return;
    }
    if (val === 'del') {
      this.expression = this.expression.slice(0, -1);
      this.updateDisplay(this.expression || '0');
      return;
    }
    if (val === '=') {
      try {
        let expr = this.expression
          .replace(/pi/g, Math.PI)
          .replace(/e/g, Math.E)
          .replace(/\^/g, '**');

        // Evaluate safely
        // Replace functions
        expr = expr.replace(/sin\((.*?)\)/g, (m, arg) => `Math.sin(${this.isDegree ? `(${arg})*Math.PI/180` : arg})`);
        expr = expr.replace(/cos\((.*?)\)/g, (m, arg) => `Math.cos(${this.isDegree ? `(${arg})*Math.PI/180` : arg})`);
        expr = expr.replace(/tan\((.*?)\)/g, (m, arg) => `Math.tan(${this.isDegree ? `(${arg})*Math.PI/180` : arg})`);
        expr = expr.replace(/ln\((.*?)\)/g, 'Math.log($1)');
        expr = expr.replace(/log\((.*?)\)/g, 'Math.log10($1)');
        expr = expr.replace(/sqrt\((.*?)\)/g, 'Math.sqrt($1)');

        const res = Function(`'use strict'; return (${expr})`)();
        this.expression = String(res);
        this.updateDisplay(this.expression);
      } catch (err) {
        this.updateDisplay('Error');
        this.expression = '';
      }
      return;
    }

    if (['sin', 'cos', 'tan', 'ln', 'log', 'sqrt'].includes(val)) {
      this.expression += `${val}(`;
    } else if (val === 'pi') {
      this.expression += 'pi';
    } else if (val === 'deg') {
      this.isDegree = true;
      alert('Angle mode set to Degrees');
      return;
    } else if (val === 'rad') {
      this.isDegree = false;
      alert('Angle mode set to Radians');
      return;
    } else if (val === 'fact') {
      try {
        const num = parseFloat(this.expression);
        const f = this.factorial(num);
        this.expression = String(f);
      } catch (e) {
        this.expression = 'Error';
      }
    } else if (val === '1/x') {
      try {
        const num = parseFloat(this.expression);
        this.expression = String(1 / num);
      } catch (e) {
        this.expression = 'Error';
      }
    } else {
      this.expression += val;
    }
    this.updateDisplay(this.expression);
  }
}

window.GateCalculator = GateCalculator;
