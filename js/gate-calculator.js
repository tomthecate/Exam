/**
 * Official TCS iON Style GATE Virtual Scientific Calculator
 * Matches official GATE CBT layout, post-fix function evaluation, and color styling.
 */
class GateCalculator {
  constructor(containerId) {
    this.containerId = containerId;
    this.currentValue = '0';
    this.previousValue = null;
    this.pendingOp = null;
    this.equationStr = '';
    this.newNumber = true;
    this.memory = 0;
    this.isDegree = true;
    this.isOpen = false;
    this.init();
  }

  init() {
    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      document.body.appendChild(el);
    }
    el.classList.add('gate-calc-window');
    el.style.display = 'none';
    this.el = el;
    this.isMinimized = false;
    this.render();
    this.attachEvents();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.el.style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) {
      this.ensureInViewport();
    }
  }

  open() {
    this.isOpen = true;
    this.el.style.display = 'flex';
    this.ensureInViewport();
  }

  close() {
    this.isOpen = false;
    this.el.style.display = 'none';
  }

  ensureInViewport() {
    const rect = this.el.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    if (!rect.width || !rect.height || rect.left < 5 || rect.right > winWidth - 5 || rect.top < 40 || rect.bottom > winHeight - 5) {
      this.el.style.top = '70px';
      this.el.style.right = '24px';
      this.el.style.left = 'auto';
    }
  }

  render() {
    this.el.innerHTML = `
      <div class="calc-header" id="gate-calc-drag-handle">
        <div class="calc-header-title">
          <span class="calc-header-icon">&#129534;</span>
          <span class="calc-title-text">GATE Virtual Scientific Calculator</span>
        </div>
        <div class="calc-header-controls">
          <button type="button" id="calc-min-btn" class="calc-ctrl-btn" title="Minimize / Restore">&#8211;</button>
          <button type="button" id="calc-close-btn" class="calc-ctrl-btn calc-close-btn" title="Close Calculator">&times;</button>
        </div>
      </div>

      <div class="calc-main-body">
        <div class="calc-screen-box">
          <div class="calc-display-status">
            <span id="calc-mem-indicator" class="calc-status-indicator mem-hidden">M</span>
            <span id="calc-mode-indicator" class="calc-status-indicator">Deg</span>
          </div>
          <div id="calc-equation" class="calc-equation-line">&nbsp;</div>
          <div id="calc-result" class="calc-result-line">0</div>
        </div>

        <div class="calc-toolbar-row">
          <div class="calc-angle-selector">
            <label class="calc-radio-label">
              <input type="radio" name="calc-angle" value="deg" checked id="calc-radio-deg">
              <span>Deg</span>
            </label>
            <label class="calc-radio-label">
              <input type="radio" name="calc-angle" value="rad" id="calc-radio-rad">
              <span>Rad</span>
            </label>
          </div>
          <div class="calc-memory-group">
            <button type="button" class="calc-btn calc-btn-mem" data-action="mc" title="Memory Clear">MC</button>
            <button type="button" class="calc-btn calc-btn-mem" data-action="mr" title="Memory Recall">MR</button>
            <button type="button" class="calc-btn calc-btn-mem" data-action="ms" title="Memory Store">MS</button>
            <button type="button" class="calc-btn calc-btn-mem" data-action="m+" title="Memory Add">M+</button>
            <button type="button" class="calc-btn calc-btn-mem" data-action="m-" title="Memory Subtract">M-</button>
          </div>
        </div>

        <div class="calc-panels-container">
          <!-- Left Panel: Scientific Functions (5 columns x 6 rows) -->
          <div class="calc-scientific-panel">
            <!-- Row 1 -->
            <button type="button" class="calc-btn calc-btn-op" data-action="mod" title="Modulo">mod</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="sinh">sinh</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="cosh">cosh</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="tanh">tanh</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="exp-notation" title="Scientific Notation">Exp</button>
            <!-- Row 2 -->
            <button type="button" class="calc-btn calc-btn-fn" data-action="abs" title="Absolute Value">|x|</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="asinh">sinh<sup>-1</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="acosh">cosh<sup>-1</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="atanh">tanh<sup>-1</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="log2">log<sub>2</sub>x</button>
            <!-- Row 3 -->
            <button type="button" class="calc-btn calc-btn-fn" data-action="pi">&pi;</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="sin">sin</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="cos">cos</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="tan">tan</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="ln">ln</button>
            <!-- Row 4 -->
            <button type="button" class="calc-btn calc-btn-fn" data-action="euler">e</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="asin">sin<sup>-1</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="acos">cos<sup>-1</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="atan">tan<sup>-1</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="log">log</button>
            <!-- Row 5 -->
            <button type="button" class="calc-btn calc-btn-fn" data-action="factorial">n!</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="pow-xy">x<sup>y</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="cube">x<sup>3</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="square">x<sup>2</sup></button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="pow10">10<sup>x</sup></button>
            <!-- Row 6 -->
            <button type="button" class="calc-btn calc-btn-fn" data-action="reciprocal">1/x</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="yroot"><sup>y</sup>&radic;x</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="cbrt"><sup>3</sup>&radic;x</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="sqrt">&radic;</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action="exp-e">e<sup>x</sup></button>
          </div>

          <!-- Vertical separator line -->
          <div class="calc-panel-separator"></div>

          <!-- Right Panel: Numeric Keypad (4 columns x 6 rows) -->
          <div class="calc-numeric-panel">
            <!-- Row 1: ( ) Backspace Clear -->
            <button type="button" class="calc-btn calc-btn-fn" data-action="(">(</button>
            <button type="button" class="calc-btn calc-btn-fn" data-action=")">)</button>
            <button type="button" class="calc-btn calc-btn-mem" data-action="backspace" title="Backspace">&larr;</button>
            <button type="button" class="calc-btn calc-btn-mem" data-action="clear" title="Clear">C</button>
            <!-- Row 2: 7 8 9 ÷ -->
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="7">7</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="8">8</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="9">9</button>
            <button type="button" class="calc-btn calc-btn-op" data-action="op" data-val="/">&divide;</button>
            <!-- Row 3: 4 5 6 × -->
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="4">4</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="5">5</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="6">6</button>
            <button type="button" class="calc-btn calc-btn-op" data-action="op" data-val="*">&times;</button>
            <!-- Row 4: 1 2 3 − -->
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="1">1</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="2">2</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="3">3</button>
            <button type="button" class="calc-btn calc-btn-op" data-action="op" data-val="-">&minus;</button>
            <!-- Row 5: 0 . +/- + -->
            <button type="button" class="calc-btn calc-btn-num" data-action="digit" data-val="0">0</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="decimal">.</button>
            <button type="button" class="calc-btn calc-btn-num" data-action="negate">+/-</button>
            <button type="button" class="calc-btn calc-btn-op" data-action="op" data-val="+">+</button>
            <!-- Row 6: = (spanning 4 columns) -->
            <button type="button" class="calc-btn calc-btn-eq calc-btn-eq-full" data-action="equals">=</button>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const closeBtn = this.el.querySelector('#calc-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    const minBtn = this.el.querySelector('#calc-min-btn');
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      });
    }

    const dragHandle = this.el.querySelector('#gate-calc-drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('dblclick', (e) => {
        if (e.target && e.target.closest('.calc-ctrl-btn')) return;
        this.toggleMinimize();
      });
    }

    // Angle mode radio listener
    const radDeg = this.el.querySelector('#calc-radio-deg');
    const radRad = this.el.querySelector('#calc-radio-rad');
    if (radDeg) {
      radDeg.addEventListener('change', () => {
        this.isDegree = true;
        this.updateIndicators();
      });
    }
    if (radRad) {
      radRad.addEventListener('change', () => {
        this.isDegree = false;
        this.updateIndicators();
      });
    }

    // Button click delegation
    this.el.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const action = target.getAttribute('data-action');
        const val = target.getAttribute('data-val');
        this.handleAction(action, val);
      });
    });

    // Make window smoothly draggable
    this.setupDraggable();

    // Escape key listener to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const minBtn = this.el.querySelector('#calc-min-btn');
    if (this.isMinimized) {
      this.el.classList.add('calc-minimized');
      if (minBtn) {
        minBtn.innerHTML = '&#9633;';
        minBtn.title = 'Restore Calculator';
      }
    } else {
      this.el.classList.remove('calc-minimized');
      if (minBtn) {
        minBtn.innerHTML = '&#8211;';
        minBtn.title = 'Minimize Calculator';
      }
    }
  }

  setupDraggable() {
    const handle = this.el.querySelector('#gate-calc-drag-handle');
    if (!handle) return;
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    const startDrag = (clientX, clientY, target) => {
      if (target && target.closest('.calc-ctrl-btn')) return false;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      const rect = this.el.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      this.el.classList.add('calc-dragging');
      return true;
    };

    const moveDrag = (clientX, clientY) => {
      if (!isDragging) return;
      let newLeft = origLeft + (clientX - startX);
      let newTop = origTop + (clientY - startY);

      // Clamping to keep calculator visible within viewport
      const maxLeft = Math.max(0, window.innerWidth - this.el.offsetWidth - 5);
      const maxTop = Math.max(0, window.innerHeight - this.el.offsetHeight - 5);

      newLeft = Math.max(5, Math.min(newLeft, maxLeft));
      newTop = Math.max(5, Math.min(newTop, maxTop));

      this.el.style.left = `${newLeft}px`;
      this.el.style.top = `${newTop}px`;
      this.el.style.right = 'auto';
    };

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      this.el.classList.remove('calc-dragging');
    };

    // Mouse events
    handle.addEventListener('mousedown', (e) => {
      if (startDrag(e.clientX, e.clientY, e.target)) {
        const onMouseMove = (ev) => moveDrag(ev.clientX, ev.clientY);
        const onMouseUp = () => {
          stopDrag();
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      }
    });

    // Touch events
    handle.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (startDrag(touch.clientX, touch.clientY, e.target)) {
          const onTouchMove = (ev) => {
            if (ev.touches.length === 1) {
              moveDrag(ev.touches[0].clientX, ev.touches[0].clientY);
              ev.preventDefault();
            }
          };
          const onTouchEnd = () => {
            stopDrag();
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
          };
          document.addEventListener('touchmove', onTouchMove, { passive: false });
          document.addEventListener('touchend', onTouchEnd);
        }
      }
    }, { passive: true });
  }

  updateDisplay() {
    const resultEl = this.el.querySelector('#calc-result');
    const eqEl = this.el.querySelector('#calc-equation');
    if (resultEl) resultEl.textContent = this.currentValue;
    if (eqEl) eqEl.textContent = this.equationStr || '\u00A0';
  }

  updateIndicators() {
    const memEl = this.el.querySelector('#calc-mem-indicator');
    const modeEl = this.el.querySelector('#calc-mode-indicator');
    if (memEl) {
      if (this.memory !== 0) {
        memEl.classList.remove('mem-hidden');
      } else {
        memEl.classList.add('mem-hidden');
      }
    }
    if (modeEl) {
      modeEl.textContent = this.isDegree ? 'Deg' : 'Rad';
    }
  }

  formatNumber(num) {
    if (isNaN(num)) return 'Error';
    if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';
    // Clean rounding to avoid IEEE 754 precision issues like 0.30000000000000004
    const rounded = Number(num.toPrecision(12));
    if (Number.isInteger(rounded)) return String(rounded);
    return String(parseFloat(rounded.toFixed(10)));
  }

  handleAction(action, val) {
    switch (action) {
      case 'digit':
        this.inputDigit(val);
        break;

      case 'decimal':
        this.inputDecimal();
        break;

      case 'backspace':
        this.backspace();
        break;

      case 'clear':
        this.clear();
        break;

      case 'negate':
        this.negate();
        break;

      case 'op':
        this.applyBinaryOp(val);
        break;

      case 'mod':
        this.applyBinaryOp('%');
        break;

      case 'pow-xy':
        this.applyBinaryOp('^');
        break;

      case 'logyx':
        this.applyBinaryOp('log_y');
        break;

      case 'yroot':
        this.applyBinaryOp('yroot');
        break;

      case 'percent':
        this.applyPercent();
        break;

      case 'equals':
        this.evaluateEquals();
        break;

      // Constants
      case 'pi':
        this.currentValue = this.formatNumber(Math.PI);
        this.newNumber = true;
        this.updateDisplay();
        break;

      case 'euler':
        this.currentValue = this.formatNumber(Math.E);
        this.newNumber = true;
        this.updateDisplay();
        break;

      case 'exp-notation':
        if (!this.currentValue.includes('e')) {
          this.currentValue += 'e+0';
          this.newNumber = false;
          this.updateDisplay();
        }
        break;

      // Memory Functions
      case 'mc':
        this.memory = 0;
        this.updateIndicators();
        break;

      case 'mr':
        this.currentValue = this.formatNumber(this.memory);
        this.newNumber = true;
        this.updateDisplay();
        break;

      case 'ms':
        this.memory = parseFloat(this.currentValue) || 0;
        this.newNumber = true;
        this.updateIndicators();
        break;

      case 'm+':
        this.memory += parseFloat(this.currentValue) || 0;
        this.newNumber = true;
        this.updateIndicators();
        break;

      case 'm-':
        this.memory -= parseFloat(this.currentValue) || 0;
        this.newNumber = true;
        this.updateIndicators();
        break;

      // Parentheses
      case '(':
      case ')':
        this.handleParenthesis(action);
        break;

      // Post-fix Unary Functions
      default:
        this.applyUnaryFunction(action);
        break;
    }
  }

  inputDigit(d) {
    if (this.newNumber || this.currentValue === '0' || this.currentValue === 'Error') {
      this.currentValue = d;
      this.newNumber = false;
    } else {
      if (this.currentValue.length < 16) {
        this.currentValue += d;
      }
    }
    this.updateDisplay();
  }

  inputDecimal() {
    if (this.newNumber || this.currentValue === 'Error') {
      this.currentValue = '0.';
      this.newNumber = false;
    } else if (!this.currentValue.includes('.')) {
      this.currentValue += '.';
    }
    this.updateDisplay();
  }

  backspace() {
    if (this.newNumber || this.currentValue === 'Error') {
      this.currentValue = '0';
      this.newNumber = true;
    } else {
      this.currentValue = this.currentValue.slice(0, -1);
      if (this.currentValue === '' || this.currentValue === '-') {
        this.currentValue = '0';
        this.newNumber = true;
      }
    }
    this.updateDisplay();
  }

  clear() {
    this.currentValue = '0';
    this.previousValue = null;
    this.pendingOp = null;
    this.equationStr = '';
    this.newNumber = true;
    this.updateDisplay();
  }

  negate() {
    if (this.currentValue === '0' || this.currentValue === 'Error') return;
    if (this.currentValue.startsWith('-')) {
      this.currentValue = this.currentValue.substring(1);
    } else {
      this.currentValue = '-' + this.currentValue;
    }
    this.updateDisplay();
  }

  applyPercent() {
    const v = parseFloat(this.currentValue);
    if (isNaN(v)) return;
    this.currentValue = this.formatNumber(v / 100);
    this.newNumber = true;
    this.updateDisplay();
  }

  applyBinaryOp(op) {
    const current = parseFloat(this.currentValue);
    if (isNaN(current)) return;

    if (this.previousValue !== null && this.pendingOp && !this.newNumber) {
      const res = this.calculateBinary(this.previousValue, current, this.pendingOp);
      this.currentValue = this.formatNumber(res);
      this.previousValue = res;
    } else {
      this.previousValue = current;
    }

    this.pendingOp = op;
    const symbolMap = { '/': '\u00F7', '*': '\u00D7', '-': '\u2212', '+': '+', '%': 'mod', '^': '^', 'log_y': 'logy', 'yroot': 'yroot' };
    this.equationStr = `${this.formatNumber(this.previousValue)} ${symbolMap[op] || op}`;
    this.newNumber = true;
    this.updateDisplay();
  }

  evaluateEquals() {
    if (this.previousValue === null || !this.pendingOp) return;
    const current = parseFloat(this.currentValue);
    if (isNaN(current)) return;

    const res = this.calculateBinary(this.previousValue, current, this.pendingOp);
    this.equationStr = `${this.equationStr} ${this.formatNumber(current)} =`;
    this.currentValue = this.formatNumber(res);
    this.previousValue = null;
    this.pendingOp = null;
    this.newNumber = true;
    this.updateDisplay();
  }

  calculateBinary(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0) return NaN;
        return a / b;
      case '%':
        if (b === 0) return NaN;
        return a % b;
      case '^':
        return Math.pow(a, b);
      case 'log_y':
        if (a <= 0 || a === 1 || b <= 0) return NaN;
        return Math.log(b) / Math.log(a);
      case 'yroot':
        if (a === 0) return NaN;
        return Math.pow(b, 1 / a);
      default:
        return b;
    }
  }

  applyUnaryFunction(fn) {
    let x = parseFloat(this.currentValue);
    if (isNaN(x)) return;

    let res;
    const toRad = deg => (deg * Math.PI) / 180;
    const toDeg = rad => (rad * 180) / Math.PI;

    switch (fn) {
      case 'sin':
        res = Math.sin(this.isDegree ? toRad(x) : x);
        if (this.isDegree && x % 180 === 0) res = 0;
        break;
      case 'cos':
        res = Math.cos(this.isDegree ? toRad(x) : x);
        if (this.isDegree && (x - 90) % 180 === 0) res = 0;
        break;
      case 'tan':
        if (this.isDegree && (x - 90) % 180 === 0) {
          res = NaN;
        } else {
          res = Math.tan(this.isDegree ? toRad(x) : x);
        }
        break;

      case 'asin':
        if (x < -1 || x > 1) { res = NaN; }
        else { res = Math.asin(x); if (this.isDegree) res = toDeg(res); }
        break;
      case 'acos':
        if (x < -1 || x > 1) { res = NaN; }
        else { res = Math.acos(x); if (this.isDegree) res = toDeg(res); }
        break;
      case 'atan':
        res = Math.atan(x);
        if (this.isDegree) res = toDeg(res);
        break;

      case 'sinh':
        res = Math.sinh(x);
        break;
      case 'cosh':
        res = Math.cosh(x);
        break;
      case 'tanh':
        res = Math.tanh(x);
        break;
      case 'asinh':
        res = Math.asinh(x);
        break;
      case 'acosh':
        res = x >= 1 ? Math.acosh(x) : NaN;
        break;
      case 'atanh':
        res = (x > -1 && x < 1) ? Math.atanh(x) : NaN;
        break;

      case 'ln':
        res = x > 0 ? Math.log(x) : NaN;
        break;
      case 'log':
        res = x > 0 ? Math.log10(x) : NaN;
        break;
      case 'log2':
        res = x > 0 ? Math.log2(x) : NaN;
        break;

      case 'sqrt':
        res = x >= 0 ? Math.sqrt(x) : NaN;
        break;
      case 'cbrt':
        res = Math.cbrt(x);
        break;
      case 'square':
        res = Math.pow(x, 2);
        break;
      case 'cube':
        res = Math.pow(x, 3);
        break;
      case 'exp-e':
        res = Math.exp(x);
        break;
      case 'pow10':
        res = Math.pow(10, x);
        break;
      case 'reciprocal':
        res = x !== 0 ? 1 / x : NaN;
        break;
      case 'abs':
        res = Math.abs(x);
        break;
      case 'factorial':
        res = this.calcFactorial(x);
        break;

      default:
        return;
    }

    const formatted = this.formatNumber(res);
    this.equationStr = `${fn}(${this.currentValue})`;
    this.currentValue = formatted;
    this.newNumber = true;
    this.updateDisplay();
  }

  calcFactorial(n) {
    if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  handleParenthesis(p) {
    if (p === '(') {
      this.equationStr += ' (';
      this.updateDisplay();
    } else {
      this.equationStr += ' )';
      this.updateDisplay();
    }
  }
}

window.GateCalculator = GateCalculator;
