// Resizable columns: drag the edge of a side column (the editor's panels, the files home's sidebar, the token
// and icon screens' side columns) to the width you like. Widths are CSS variables on the page (each column's
// CSS falls back to its default), remembered per person in this browser.
//
// A handle is markup, so screens that re-render keep theirs: an absolutely placed element in the column's row,
// at the column's edge, `<div class="col-resizer" data-col="left"></div>` (resizerHTML). Dragging, the arrow keys
// and a double-click (back to the default) are handled here for every handle, whenever it was rendered.

const KEY = 'sigma.columns';
// The columns: the CSS variable, default, limits, and which edge the handle is on (right: dragging right widens).
export const COLUMNS = {
  left: { cssVar: '--left-w', def: 240, min: 200, max: 480, edge: 'right', label: 'Resize the layers panel' },
  right: { cssVar: '--right-w', def: 240, min: 220, max: 520, edge: 'left', label: 'Resize the properties panel' },
  'home-side': { cssVar: '--home-side-w', def: 240, min: 180, max: 400, edge: 'right', label: 'Resize the sidebar' },
  'vars-side': { cssVar: '--vars-side-w', def: 200, min: 150, max: 420, edge: 'right', label: 'Resize the collections column' },
  'vars-inspector': { cssVar: '--vars-inspector-w', def: 280, min: 220, max: 520, edge: 'left', label: 'Resize the token details' },
  'icons-groups': { cssVar: '--icons-groups-w', def: 200, min: 150, max: 400, edge: 'right', label: 'Resize the groups column' },
  'icons-inspector': { cssVar: '--icons-inspector-w', def: 260, min: 220, max: 520, edge: 'left', label: 'Resize the icon details' },
};
const MIN_MIDDLE = 320; // the canvas (or the main column) keeps at least this much

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function save(widths) {
  try {
    if (Object.keys(widths).length) localStorage.setItem(KEY, JSON.stringify(widths));
    else localStorage.removeItem(KEY);
  } catch {
    // no storage: the width lasts until the page reloads
  }
}

const widths = load();
const root = () => document.documentElement;
const clamp = (c, w) => Math.round(Math.max(c.min, Math.min(c.max, w)));

/** A column's width now (its saved width, or its default). */
export const columnWidth = (key) => widths[key] ?? COLUMNS[key].def;

/** Set a column's width (null: back to its default), and remember it. */
export function setColumnWidth(key, w) {
  const c = COLUMNS[key];
  if (!c) return;
  if (w === null || clamp(c, w) === c.def) {
    delete widths[key];
    root().style.removeProperty(c.cssVar);
  } else {
    widths[key] = clamp(c, w);
    root().style.setProperty(c.cssVar, `${widths[key]}px`);
  }
  save(widths);
  for (const h of document.querySelectorAll(`.col-resizer[data-col="${key}"]`)) h.setAttribute('aria-valuenow', String(columnWidth(key)));
  window.dispatchEvent(new Event('resize')); // the canvas and anything else sized to the window lays out again
}

/** The handle for a column, as markup. */
export function resizerHTML(key) {
  const c = COLUMNS[key];
  return `<div class="col-resizer" data-col="${key}" role="separator" aria-orientation="vertical" tabindex="0" aria-label="${c.label}"` +
    ` aria-valuemin="${c.min}" aria-valuemax="${c.max}" aria-valuenow="${columnWidth(key)}" title="Drag to resize · double-click to reset"></div>`;
}

// The widest a column can be without squeezing the space between it and the other side of its row.
function room(handle, key) {
  const c = COLUMNS[key];
  const row = handle.parentElement?.getBoundingClientRect();
  if (!row) return c.max;
  // Everything else in the row that isn't the middle: the other side's columns, measured as they are.
  const others = [...handle.parentElement.querySelectorAll('.col-resizer')].filter((h) => h !== handle)
    .reduce((n, h) => n + columnWidth(h.dataset.col), 0);
  const rail = key === 'left' ? parseFloat(getComputedStyle(root()).getPropertyValue('--rail-w')) || 0 : 0;
  return Math.max(c.min, Math.min(c.max, row.width - others - rail - MIN_MIDDLE));
}

function init() {
  for (const [key, w] of Object.entries(widths)) {
    if (COLUMNS[key]) root().style.setProperty(COLUMNS[key].cssVar, `${clamp(COLUMNS[key], w)}px`);
    else delete widths[key];
  }
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest?.('.col-resizer');
    if (!h || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const key = h.dataset.col;
    drag = { h, key, x: e.clientX, from: columnWidth(key), max: room(h, key), id: e.pointerId };
    h.setPointerCapture?.(e.pointerId);
    h.classList.add('dragging');
    document.body.classList.add('col-resizing');
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const w = drag.from + (COLUMNS[drag.key].edge === 'right' ? dx : -dx);
    setColumnWidth(drag.key, Math.min(w, drag.max));
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.h.classList.remove('dragging');
    document.body.classList.remove('col-resizing');
    drag = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  document.addEventListener('dblclick', (e) => {
    const h = e.target.closest?.('.col-resizer');
    if (h) setColumnWidth(h.dataset.col, null);
  });
  document.addEventListener('keydown', (e) => {
    const h = e.target.closest?.('.col-resizer');
    if (!h || !['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation(); // the editor's arrow keys nudge layers; not while a handle has focus
    const key = h.dataset.col;
    if (e.key === 'Home') return setColumnWidth(key, null);
    const step = (e.shiftKey ? 48 : 16) * (e.key === 'ArrowRight' ? 1 : -1) * (COLUMNS[key].edge === 'right' ? 1 : -1);
    setColumnWidth(key, Math.min(columnWidth(key) + step, room(h, key)));
  }, true);
}

if (typeof document !== 'undefined') init();
