/**
 * KaTeX Mathematical Notation Renderer
 * Automatically parses LaTeX in text strings ($...$ for inline, $$...$$ for display)
 */
const KatexRenderer = {
  isAvailable() {
    return typeof window.katex !== 'undefined';
  },

  /**
   * Render LaTeX contained in string to an HTML string
   * @param {string} text - Text containing LaTeX expressions ($...$ or $$...$$)
   * @returns {string} Safe HTML with rendered KaTeX spans
   */
  render(text) {
    if (!text) return '';

    // If KaTeX is not loaded, format with fallback
    if (!this.isAvailable()) {
      return this.fallbackRender(text);
    }

    try {
      // 1. First replace display math $$...$$
      let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, equation) => {
        try {
          return window.katex.renderToString(equation.trim(), {
            displayMode: true,
            throwOnError: false
          });
        } catch (e) {
          return `<div class="katex-error">${match}</div>`;
        }
      });

      // 2. Next replace inline math $...$
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, equation) => {
        try {
          return window.katex.renderToString(equation.trim(), {
            displayMode: false,
            throwOnError: false
          });
        } catch (e) {
          return `<span class="katex-error">${match}</span>`;
        }
      });

      // 3. Format basic markdown like bold **text** and line breaks
      processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/\n/g, '<br>');

      return processed;
    } catch (err) {
      console.error('KaTeX rendering error:', err);
      return this.fallbackRender(text);
    }
  },

  /**
   * Fallback renderer for offline or while CDN loads
   */
  fallbackRender(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Format display math
    escaped = escaped.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-block" style="font-family:serif;font-style:italic;text-align:center;padding:8px;background:#f8fafc;border-radius:4px;margin:8px 0;">$1</div>');
    // Format inline math
    escaped = escaped.replace(/\$([^\$\n]+?)\$/g, '<span class="math-inline" style="font-family:serif;font-style:italic;font-weight:600;padding:0 2px;">$1</span>');
    // Bold
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }
};

window.KatexRenderer = KatexRenderer;
