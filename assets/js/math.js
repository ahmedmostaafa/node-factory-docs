/* Renders \( \) and $$ $$ math with KaTeX auto-render once the CDN scripts are loaded. */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.renderMathInElement) return;
  renderMathInElement(document.body, {
    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }],
    throwOnError: false,
  });
});
