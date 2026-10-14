// Resizable columns (columns.js): widths are clamped, remembered, and reset.
import { test, eq } from './harness.js';
import { COLUMNS, columnWidth, setColumnWidth, resizerHTML } from '../src/columns.js';

test('columns: a width is clamped to its limits, remembered, and resets to the default', () => {
  const saved = localStorage.getItem('sigma.columns'); // this browser's own widths, put back after
  const was = columnWidth('left');
  try {
    setColumnWidth('left', 320);
    eq([columnWidth('left'), getComputedStyle(document.documentElement).getPropertyValue('--left-w').trim()], [320, '320px']);
    eq(JSON.parse(localStorage.getItem('sigma.columns')).left, 320, 'remembered');
    setColumnWidth('left', 5000);
    eq(columnWidth('left'), COLUMNS.left.max, 'no wider than its maximum');
    setColumnWidth('left', 10);
    eq(columnWidth('left'), COLUMNS.left.min, 'no narrower than its minimum');
    setColumnWidth('left', null);
    eq([columnWidth('left'), document.documentElement.style.getPropertyValue('--left-w')], [COLUMNS.left.def, ''], 'back to the default');
    const h = new DOMParser().parseFromString(resizerHTML('right'), 'text/html').body.firstChild;
    eq([h.dataset.col, h.getAttribute('role'), h.getAttribute('aria-orientation')], ['right', 'separator', 'vertical']);
  } finally {
    setColumnWidth('left', was === COLUMNS.left.def ? null : was);
    if (saved === null) localStorage.removeItem('sigma.columns');
    else localStorage.setItem('sigma.columns', saved);
  }
});
