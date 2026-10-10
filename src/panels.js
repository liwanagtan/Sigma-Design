import {
  state, page, view, emit, commit, select, selectedNodes, getNode, getParent, siblingsOf, ancestors, isAncestor,
  uid, detach, insertNode, worldMatrix, setWorldMatrix, createNode, undo, redo, makePaint,
} from './store.js';
import { translate } from './geom.js';
import { icons, layerIcon } from './icons.js';
import {
  setTool, setProps, align, distribute, zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection, zoomAt,
  viewportSize, sortByZ, toggleVisible, toggleLocked, addAutoLayout, removeAutoLayout,
} from './commands.js';
import { isAutoLayout, getSizing } from './layout.js';
import { exportNodes, saveFile, openFile, newFile, openSample, pickImages } from './io.js';
import { showContextMenu } from './menu.js';
import { stopEditing } from './text.js';
import { toWorld } from './render.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MIXED = Symbol('mixed');

export const FONTS = ['Inter', 'Roboto', 'Space Grotesk', 'Playfair Display', 'JetBrains Mono', 'Arial', 'Georgia', 'Times New Roman', 'Courier New'];
const WEIGHTS = [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semi Bold'], [700, 'Bold'], [800, 'Extra Bold']];
const TYPE_LABEL = { frame: 'Frame', group: 'Group', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', text: 'Text', image: 'Image' };
const FRAME_PRESETS = [
  ['iPhone 16', 393, 852], ['iPhone 16 Pro Max', 440, 956], ['Android Compact', 412, 917], ['iPad mini', 744, 1133],
  ['Desktop', 1440, 1024], ['MacBook Air', 1280, 832], ['Slide 16:9', 1920, 1080], ['Instagram post', 1080, 1350],
];

// ---------- init ----------
export function initPanels() {
  initToolbar();
  initFileHeader();
  initPages();
  initLayers();
  initProps();
  initToast();
  window.addEventListener('sigma:rename', (e) => startRename(e.detail));
}

// ---------- toolbar ----------
const TOOLS = [
  ['move', 'Move', 'V'], ['hand', 'Hand tool', 'H'], '|',
  ['frame', 'Frame', 'F'], ['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'O'], ['line', 'Line', 'L'], '|',
  ['text', 'Text', 'T'], ['image', 'Place image', '⇧⌘K'],
];

function initToolbar() {
  const bar = $('#toolbar');
  bar.innerHTML = TOOLS.map((t) => t === '|'
    ? '<div class="tb-sep"></div>'
    : `<button class="tb-btn" data-tool="${t[0]}" data-tip="${t[1]}  ${t[2]}">${icons[t[0]]}</button>`).join('');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    if (b.dataset.tool === 'image') return pickImages();
    setTool(b.dataset.tool);
  });
}

export function renderToolbar() {
  for (const b of document.querySelectorAll('#toolbar [data-tool]')) b.classList.toggle('active', b.dataset.tool === state.tool);
}

// ---------- file header / main menu ----------
function initFileHeader() {
  $('#logo-btn').innerHTML = `${icons.logo}${icons.chevronDown}`;
  $('#logo-btn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sel = selectedNodes();
    showContextMenu(r.left, r.bottom + 4, [
      { label: 'New file', action: newFile },
      { label: 'Open file…', action: openFile },
      { label: 'Save file…', shortcut: '', action: saveFile },
      { label: 'Open sample file', action: openSample },
      '-',
      { label: 'Place image…', shortcut: '⇧⌘K', action: () => pickImages() },
      { label: sel.length ? 'Export selection as PNG' : 'Export page as PNG', shortcut: '⇧⌘E', action: () => exportNodes(sel.length ? sel : page().children, { format: 'png', scale: 2 }) },
      { label: sel.length ? 'Export selection as SVG' : 'Export page as SVG', action: () => exportNodes(sel.length ? sel : page().children, { format: 'svg' }) },
      '-',
      { label: 'Undo', shortcut: '⌘Z', action: undo },
      { label: 'Redo', shortcut: '⇧⌘Z', action: redo },
      '-',
      { label: 'Keyboard shortcuts', shortcut: '?', action: showShortcuts },
    ]);
  });
  const input = $('#file-name');
  input.addEventListener('change', () => {
    state.doc.name = input.value.trim() || 'Untitled';
    commit();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') input.blur();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) showShortcuts();
  });
}

export function renderFileHeader() {
  const input = $('#file-name');
  if (document.activeElement !== input) input.value = state.doc.name || 'Untitled';
  document.title = `${state.doc.name || 'Untitled'} – Sigma`;
}

function showShortcuts() {
  const rows = [
    ['Tools', [['Move', 'V'], ['Hand / pan', 'H or hold Space'], ['Frame', 'F'], ['Rectangle', 'R'], ['Ellipse', 'O'], ['Line', 'L'], ['Text', 'T'], ['Place image', '⇧⌘K']]],
    ['Canvas', [['Zoom in / out', '⌘+ / ⌘−  or ⌘-scroll / pinch'], ['Zoom to 100%', '⇧0'], ['Zoom to fit', '⇧1'], ['Zoom to selection', '⇧2'], ['Pan', 'Scroll / Space-drag']]],
    ['Selection', [['Select all', '⌘A'], ['Deep select', '⌘-click'], ['Select inside', 'Double-click / Enter'], ['Select parent', '⇧Enter'], ['Measure distance', 'Hold ⌥']]],
    ['Edit', [['Undo / Redo', '⌘Z / ⇧⌘Z'], ['Copy / Paste / Cut', '⌘C / ⌘V / ⌘X'], ['Duplicate', '⌘D or ⌥-drag'], ['Delete', '⌫'], ['Group / Ungroup', '⌘G / ⇧⌘G'], ['Frame selection', '⌥⌘G'], ['Add / remove auto layout', '⇧A / ⌥⇧A'], ['Reorder in auto layout', 'Drag or arrow keys'], ['Nudge', 'Arrows (⇧ = 10px)'], ['Bring forward / Send backward', '⌘] / ⌘['], ['To front / To back', '⌥⌘] / ⌥⌘['], ['Hide / Lock', '⇧⌘H / ⇧⌘L'], ['Rename', '⌘R'], ['Flip', '⇧H / ⇧V']]],
    ['Transform', [['Keep proportions', 'Hold ⇧ while resizing'], ['Resize from center', 'Hold ⌥ while resizing'], ['Snap rotation to 15°', 'Hold ⇧ while rotating'], ['Disable snapping', 'Hold ⌘ while dragging']]],
  ];
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal"><div class="modal-head">Keyboard shortcuts<button class="icon-btn" data-close>${icons.close}</button></div><div class="modal-body">` +
    rows.map(([title, items]) => `<div class="sc-group"><div class="sc-title">${title}</div>${items.map(([a, b]) => `<div class="sc-row"><span>${a}</span><kbd>${esc(b)}</kbd></div>`).join('')}</div>`).join('') +
    '</div></div>';
  const close = () => {
    wrap.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      close();
    }
  };
  wrap.addEventListener('click', (e) => (e.target === wrap || e.target.closest('[data-close]')) && close());
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(wrap);
}

// ---------- pages ----------
function initPages() {
  $('#add-page').innerHTML = icons.plus;
  $('#add-page').addEventListener('click', () => {
    const pg = { id: uid(), name: `Page ${state.doc.pages.length + 1}`, background: '#F5F5F5', children: [] };
    state.doc.pages.push(pg);
    switchPage(pg.id);
    commit();
  });
  const list = $('#pages-list');
  list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-page]');
    if (!row) return;
    if (e.target.closest('[data-del]')) {
      const pg = state.doc.pages.find((p) => p.id === row.dataset.page);
      if (pg && confirm(`Delete page “${pg.name}”?`)) {
        state.doc.pages = state.doc.pages.filter((p) => p !== pg);
        if (state.doc.currentPageId === pg.id) switchPage(state.doc.pages[0].id);
        commit();
      }
      return;
    }
    switchPage(row.dataset.page);
  });
  list.addEventListener('dblclick', (e) => {
    const row = e.target.closest('[data-page]');
    if (!row) return;
    const pg = state.doc.pages.find((p) => p.id === row.dataset.page);
    inlineRename(row.querySelector('.name'), pg.name, (name) => {
      pg.name = name;
      commit();
    });
  });
}

// Apply a half-edited properties field to the current selection before the selection changes.
export function commitFocusedField() {
  const a = document.activeElement;
  if (a && a !== document.body && $('#props').contains(a)) a.blur();
}

function switchPage(id) {
  if (state.editingTextId) stopEditing();
  commitFocusedField();
  state.doc.currentPageId = id;
  state.selection = [];
  state.hoverId = null;
  const fresh = !state.pageViews[id];
  emit('doc');
  if (fresh) requestAnimationFrame(() => zoomToFit());
}

export function renderPages() {
  const list = $('#pages-list');
  if (list.querySelector('input')) return;
  const many = state.doc.pages.length > 1;
  list.innerHTML = state.doc.pages.map((p) =>
    `<div class="page-row${p.id === page().id ? ' active' : ''}" data-page="${p.id}">` +
    `<span class="check">${p.id === page().id ? '✓' : ''}</span><span class="name">${esc(p.name)}</span>` +
    (many ? `<button class="icon-btn row-btn" data-del title="Delete page">${icons.close}</button>` : '') + '</div>').join('');
}

function inlineRename(span, value, done) {
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = value;
  span.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  const finish = (ok) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    input.remove();
    if (ok && v && v !== value) done(v);
    else emit('doc');
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
}

// ---------- layers ----------
let dragIds = null;

function initLayers() {
  const list = $('#layers-list');
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.layer-row');
    if (!row || e.target.closest('input')) return;
    const n = getNode(row.dataset.id);
    if (!n) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'vis') return toggleVisible([n]);
    if (act === 'lock') return toggleLocked([n]);
    if (e.target.closest('.chev')) {
      state.collapsed.has(n.id) ? state.collapsed.delete(n.id) : state.collapsed.add(n.id);
      return emit('selection');
    }
    if (state.editingTextId) stopEditing();
    commitFocusedField();
    if (e.metaKey || e.ctrlKey) select([n.id], { toggle: true });
    else if (e.shiftKey) select([n.id], { add: true });
    else select([n.id]);
  });
  list.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.layer-row');
    if (row && e.target.closest('.name')) startRename(row.dataset.id);
  });
  list.addEventListener('pointerover', (e) => {
    const id = e.target.closest('.layer-row')?.dataset.id || null;
    if (id !== state.hoverId) {
      state.hoverId = id;
      emit('overlay');
    }
  });
  list.addEventListener('pointerleave', () => {
    state.hoverId = null;
    emit('overlay');
  });

  // Drag & drop reordering
  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.layer-row');
    if (!row) return;
    const id = row.dataset.id;
    if (!state.selection.includes(id)) select([id]);
    dragIds = [...state.selection];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'layers');
  });
  const clearMarks = () => list.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach((r) => r.classList.remove('drop-before', 'drop-after', 'drop-inside'));
  const dropPos = (e, row) => {
    const n = getNode(row.dataset.id);
    const r = row.getBoundingClientRect();
    const t = (e.clientY - r.top) / r.height;
    if (n?.children && t > 0.25 && t < 0.75) return 'inside';
    return t < 0.5 ? 'before' : 'after';
  };
  list.addEventListener('dragover', (e) => {
    const row = e.target.closest('.layer-row');
    if (!dragIds || !row) return;
    const target = getNode(row.dataset.id);
    if (dragIds.some((id) => id === target.id || isAncestor(getNode(id), target))) return;
    e.preventDefault();
    clearMarks();
    row.classList.add(`drop-${dropPos(e, row)}`);
  });
  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget)) clearMarks();
  });
  list.addEventListener('drop', (e) => {
    e.preventDefault();
    clearMarks();
    const row = e.target.closest('.layer-row');
    if (!dragIds || !row) return;
    const target = getNode(row.dataset.id);
    const pos = dropPos(e, row);
    const nodes = sortByZ(dragIds.map(getNode).filter(Boolean)).filter((n) => n !== target && !isAncestor(n, target));
    dragIds = null;
    if (!nodes.length) return;
    const parent = pos === 'inside' ? target : getParent(target.id);
    const seq = pos === 'before' ? [...nodes].reverse() : nodes;
    for (const n of seq) {
      const M = worldMatrix(n);
      detach(n);
      const list2 = parent ? parent.children : page().children;
      let at = list2.length;
      if (pos === 'before') at = list2.indexOf(target) + 1;
      if (pos === 'after') at = list2.indexOf(target);
      insertNode(n, parent, at);
      setWorldMatrix(n, M);
    }
    if (pos === 'inside') state.collapsed.delete(target.id);
    select(nodes.map((n) => n.id));
    commit();
  });
  list.addEventListener('dragend', () => {
    dragIds = null;
    clearMarks();
  });
}

function startRename(id) {
  const n = getNode(id);
  if (!n) return;
  for (const a of ancestors(n)) state.collapsed.delete(a.id);
  renderLayers(true);
  const row = $(`#layers-list .layer-row[data-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'nearest' });
  inlineRename(row.querySelector('.name'), n.name, (name) => {
    n.name = name;
    n.autoName = false;
    commit();
  });
}

export function renderLayers(force = false) {
  const list = $('#layers-list');
  if (!force && list.querySelector('input')) return;
  const sel = new Set(state.selection);
  const rows = [];
  const walkRows = (nodes, depth, inSelected) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const kids = n.children?.length;
      const open = kids && !state.collapsed.has(n.id);
      const cls = ['layer-row', n.type];
      if (sel.has(n.id)) cls.push('selected');
      else if (inSelected) cls.push('in-selected');
      if (!n.visible) cls.push('is-hidden');
      if (n.locked) cls.push('is-locked');
      if (state.hoverId === n.id) cls.push('hover');
      rows.push(
        `<div class="${cls.join(' ')}" data-id="${n.id}" draggable="true" style="--depth:${depth}">` +
        `<span class="chev">${kids ? (open ? icons.chevronDown : icons.chevronRight) : ''}</span>` +
        `<span class="licon">${layerIcon(n)}</span><span class="name">${esc(n.name)}</span>` +
        `<span class="row-actions"><button class="icon-btn" data-act="lock" title="Lock">${n.locked ? icons.lock : icons.unlock}</button>` +
        `<button class="icon-btn" data-act="vis" title="Show/hide">${n.visible ? icons.eye : icons.eyeOff}</button></span></div>`,
      );
      if (open) walkRows(n.children, depth + 1, inSelected || sel.has(n.id));
    }
  };
  walkRows(page().children, 0, false);
  list.innerHTML = rows.join('') || '<div class="empty-hint">Use the toolbar below to add frames, shapes and text.</div>';
  const first = list.querySelector('.layer-row.selected');
  if (first && lastScrolledSelection !== state.selection.join()) {
    lastScrolledSelection = state.selection.join();
    first.scrollIntoView({ block: 'nearest' });
  }
}
let lastScrolledSelection = '';

export function highlightLayerHover() {
  for (const r of document.querySelectorAll('#layers-list .layer-row')) r.classList.toggle('hover', r.dataset.id === state.hoverId);
}

// ---------- properties ----------
const pct = (key) => ({
  get: (n) => Math.round((n[key] ?? 1) * 100),
  set: (v) => ({ [key]: Math.min(100, Math.max(0, v)) / 100 }),
  suffix: '%',
});
const num = (key, min = -Infinity) => ({ get: (n) => n[key], set: (v) => ({ [key]: Math.max(min, v) }) });

const FIELDS = {
  x: num('x'), y: num('y'), w: num('w', 0.01), h: num('h', 0.01),
  rotation: { get: (n) => -(n.rotation || 0), set: (v) => ({ rotation: -(((v + 180) % 360 + 360) % 360 - 180) }), suffix: '°' },
  radius: num('radius', 0),
  opacity: pct('opacity'),
  strokeWidth: num('strokeWidth', 0),
  fontSize: num('fontSize', 1),
  lineHeight: { get: (n) => n.lineHeight ?? 'Auto', set: (v) => ({ lineHeight: v }), suffix: '%', auto: /^\s*(auto)?\s*$/i, autoValue: { lineHeight: null } },
  letterSpacing: num('letterSpacing'),
  // Auto layout
  gap: {
    get: (n) => (n.layout ? (n.layout.spacing === 'auto' ? 'Auto' : n.layout.gap) : 0),
    set: (v) => ({ 'layout.gap': Math.max(0, v), 'layout.spacing': 'packed' }),
    auto: /^\s*auto\s*$/i, autoValue: { 'layout.spacing': 'auto' },
  },
  padH: {
    get: (n) => (n.layout ? (n.layout.pl === n.layout.pr ? n.layout.pl : 'Mixed') : 0),
    set: (v) => ({ 'layout.pl': Math.max(0, v), 'layout.pr': Math.max(0, v) }),
  },
  padV: {
    get: (n) => (n.layout ? (n.layout.pt === n.layout.pb ? n.layout.pt : 'Mixed') : 0),
    set: (v) => ({ 'layout.pt': Math.max(0, v), 'layout.pb': Math.max(0, v) }),
  },
};

function common(nodes, get) {
  let v;
  for (let i = 0; i < nodes.length; i++) {
    const x = get(nodes[i]);
    if (i === 0) v = x;
    else if (x !== v) return MIXED;
  }
  return v;
}

const fmtNum = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : v);

function evalNum(str) {
  const s = String(str).replace(/[%°px\s]/g, '').replace(/,/g, '.');
  if (!s || !/^[-+*/().\d]+$/.test(s)) return null;
  try {
    const v = Function(`"use strict";return (${s})`)();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function normHex(str) {
  let h = String(str).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{1,2}$/i.test(h)) h = h.padStart(2, h[0]).repeat(3);
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toUpperCase()}` : null;
}

function numField(key, label, nodes, { icon } = {}) {
  const f = FIELDS[key];
  const v = common(nodes, f.get);
  const shown = v === MIXED ? '' : fmtNum(v);
  return `<label class="field"><span class="field-label" data-scrub="${key}">${icon || label}</span>` +
    `<input data-key="${key}" value="${esc(shown)}"${v === MIXED ? ' placeholder="Mixed"' : ''} spellcheck="false"></label>`;
}

// ---------- paints (multiple fills / strokes) ----------
const PAINT_KINDS = { fills: 'fill', strokes: 'stroke' };
const canHavePaint = (n, kind) => (kind === 'fills' ? !['line', 'group'].includes(n.type) : !['group', 'text'].includes(n.type));
const defaultPaintColor = (n, kind) =>
  kind === 'strokes' ? '#000000' : n.type === 'text' ? '#000000' : n.type === 'frame' ? '#FFFFFF' : '#D9D9D9';

function samePaints(nodes, kind) {
  const first = JSON.stringify(nodes[0]?.[kind] || []);
  return nodes.every((n) => JSON.stringify(n[kind] || []) === first);
}

// Rows are listed top paint first, like Figma; ids refer to the underlying (bottom-up) index.
function paintRows(kind, nodes) {
  if (!samePaints(nodes, kind)) {
    return `<div class="mixed-paints">Click + to replace mixed ${PAINT_KINDS[kind]}s</div>`;
  }
  const list = nodes[0][kind] || [];
  return list.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => {
    const id = `${kind}:${i}`;
    const hidden = p.visible === false;
    return `<div class="color-row paint-row${hidden ? ' is-hidden' : ''}">` +
      `<label class="swatch" style="--c:${p.color}"><input type="color" data-paint-color="${id}" value="${p.color.toLowerCase()}"></label>` +
      `<input class="hex" data-paint-hex="${id}" value="${esc(p.color.replace('#', ''))}" spellcheck="false">` +
      `<input class="op" data-paint-op="${id}" value="${Math.round(p.opacity * 100)}"><span class="op-suffix">%</span>` +
      `<button class="icon-btn" data-paint-act="toggle" data-paint="${id}" title="${hidden ? 'Show' : 'Hide'} ${PAINT_KINDS[kind]}">${hidden ? icons.eyeOff : icons.eye}</button>` +
      `<button class="icon-btn" data-paint-act="remove" data-paint="${id}" title="Remove ${PAINT_KINDS[kind]}">${icons.minus}</button></div>`;
  }).join('');
}

function addPaintButton(kind) {
  return `<button class="icon-btn" data-action="add-${kind}" title="Add ${PAINT_KINDS[kind]}">${icons.plus}</button>`;
}

// Apply fn to paint `id` ("fills:2") on every selected node.
function updatePaint(id, fn, { live = false } = {}) {
  const [kind, i] = id.split(':');
  for (const n of selectedNodes()) {
    const p = n[kind]?.[+i];
    if (p) fn(p, n[kind], +i);
  }
  if (live) emit('doc');
  else commit();
}

function addPaint(kind) {
  const nodes = selectedNodes().filter((n) => canHavePaint(n, kind));
  if (!nodes.length) return;
  const replace = !samePaints(nodes, kind);
  for (const n of nodes) {
    const list = replace ? [] : (n[kind] || []);
    // The first paint gets the layer's default color; extra ones start as a translucent black overlay.
    list.push(list.length ? makePaint('#000000', 0.2) : makePaint(defaultPaintColor(n, kind)));
    n[kind] = list;
  }
  commit();
}

function section(title, body, action = '') {
  return `<div class="section"><div class="section-title"><span>${title}</span>${action}</div>${body}</div>`;
}

function buildProps() {
  const nodes = selectedNodes();
  if (!nodes.length) {
    let html = '';
    if (state.tool === 'frame') {
      html += section('Frame', `<div class="presets">${FRAME_PRESETS.map(([name, w, h], i) =>
        `<button class="preset" data-preset="${i}"><span>${name}</span><span class="muted">${w}×${h}</span></button>`).join('')}</div>`);
    }
    html += section('Page', `<div class="color-row"><label class="swatch" style="--c:${page().background}"><input type="color" data-page-bg value="${page().background.toLowerCase()}"></label>` +
      `<input class="hex" data-page-hex value="${page().background.replace('#', '')}" spellcheck="false"></div>`);
    html += section('Export', `<div class="export-row">${exportControls()}</div><button class="btn wide" data-action="export-page">Export ${esc(page().name)}</button>`);
    return html;
  }
  const types = new Set(nodes.map((n) => n.type));
  const single = nodes.length === 1 ? nodes[0] : null;
  const has = (pred) => nodes.every(pred);
  let html = '';

  // Alignment
  const alignBtns = [['left', 'alignLeft'], ['hcenter', 'alignHCenter'], ['right', 'alignRight'], ['top', 'alignTop'], ['vcenter', 'alignVCenter'], ['bottom', 'alignBottom']];
  const canAlign = nodes.length > 1 || (single && getParent(single.id));
  html += `<div class="section align-bar">${alignBtns.map(([k, i]) => `<button class="icon-btn" data-align="${k}" ${canAlign ? '' : 'disabled'} title="Align ${k}">${icons[i]}</button>`).join('')}` +
    `<button class="icon-btn" data-distribute="x" ${nodes.length > 2 ? '' : 'disabled'} title="Distribute horizontal spacing">${icons.distH}</button>` +
    `<button class="icon-btn" data-distribute="y" ${nodes.length > 2 ? '' : 'disabled'} title="Distribute vertical spacing">${icons.distV}</button></div>`;

  // Layout
  const title = types.size === 1 ? TYPE_LABEL[[...types][0]] : 'Mixed';
  const showH = !(types.has('line') && types.size === 1);
  const lockAspect = common(nodes, (n) => !!n.lockAspect);
  let layout = `<div class="grid2">${numField('x', 'X', nodes)}${numField('y', 'Y', nodes)}</div>`;
  layout += `<div class="grid2 wh-row">${numField('w', 'W', nodes)}${showH ? numField('h', 'H', nodes) : '<span></span>'}` +
    `<button class="icon-btn lock-aspect${lockAspect === true ? ' on' : ''}" data-action="lock-aspect" title="${lockAspect === true ? 'Unlock' : 'Lock'} aspect ratio">${lockAspect === true ? icons.linkOn : icons.link}</button></div>`;

  // Resizing: Fixed / Hug contents / Fill container
  const canHug = nodes.every((n) => isAutoLayout(n) || n.type === 'text');
  const canFill = nodes.every((n) => isAutoLayout(getParent(n.id)) && !n.absolute && n.type !== 'group');
  if (canHug || canFill) {
    const sizingSelect = (axis) => {
      const cur = common(nodes, (n) => getSizing(n, axis));
      return `<select class="select" data-sizing="${axis}" title="${axis === 'w' ? 'Horizontal' : 'Vertical'} resizing">` +
        (cur === MIXED ? '<option selected disabled>Mixed</option>' : '') +
        `<option value="fixed" ${cur === 'fixed' ? 'selected' : ''}>Fixed</option>` +
        (canHug ? `<option value="hug" ${cur === 'hug' ? 'selected' : ''}>Hug</option>` : '') +
        (canFill ? `<option value="fill" ${cur === 'fill' ? 'selected' : ''}>Fill</option>` : '') + '</select>';
    };
    layout += `<div class="grid2">${sizingSelect('w')}${showH ? sizingSelect('h') : '<span></span>'}</div>`;
  }
  const hasRadius = has((n) => ['rect', 'frame', 'image'].includes(n.type));
  layout += `<div class="grid2">${numField('rotation', '', nodes, { icon: icons.rotation })}${hasRadius ? numField('radius', '', nodes, { icon: icons.radius }) : ''}</div>`;
  if (types.size === 1 && types.has('frame')) {
    const clip = common(nodes, (n) => !!n.clip);
    layout += `<label class="check-row"><input type="checkbox" data-bool="clip" ${clip === true ? 'checked' : ''}> Clip content</label>`;
  }
  if (nodes.every((n) => isAutoLayout(getParent(n.id)))) {
    const abs = common(nodes, (n) => !!n.absolute);
    layout += `<label class="check-row" title="Ignore auto layout and position freely"><input type="checkbox" data-bool="absolute" ${abs === true ? 'checked' : ''}> Absolute position</label>`;
  }
  html += section(title, layout);
  html += autoLayoutSection(nodes);

  // Layer
  html += section('Layer', `<div class="grid2">${numField('opacity', '', nodes, { icon: '<span class="op-icon"></span>' })}<span></span></div>`);

  // Text
  if (types.size === 1 && types.has('text')) {
    const fam = common(nodes, (n) => n.fontFamily);
    const wt = common(nodes, (n) => n.fontWeight);
    const ta = common(nodes, (n) => n.textAlign);
    const ar = common(nodes, (n) => n.autoResize);
    let t = `<select class="select wide" data-select="fontFamily">${fam === MIXED ? '<option selected disabled>Mixed</option>' : ''}${FONTS.map((f) => `<option ${f === fam ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
    t += `<div class="grid2"><select class="select" data-select="fontWeight">${wt === MIXED ? '<option selected disabled>Mixed</option>' : ''}${WEIGHTS.map(([w, l]) => `<option value="${w}" ${w === wt ? 'selected' : ''}>${l}</option>`).join('')}</select>${numField('fontSize', '', nodes, { icon: '<span class="mini">Aa</span>' })}</div>`;
    t += `<div class="grid2">${numField('lineHeight', '', nodes, { icon: '<span class="mini">LH</span>' })}${numField('letterSpacing', '', nodes, { icon: '<span class="mini">|A|</span>' })}</div>`;
    t += `<div class="grid2"><div class="seg">${[['left', 'textLeft'], ['center', 'textCenter'], ['right', 'textRight']].map(([k, i]) => `<button class="icon-btn${ta === k ? ' on' : ''}" data-text-align="${k}" title="Align ${k}">${icons[i]}</button>`).join('')}</div>` +
      `<div class="seg">${[['width', 'autoWidth', 'Auto width'], ['height', 'autoHeight', 'Auto height'], ['fixed', 'fixedSize', 'Fixed size']].map(([k, i, tip]) => `<button class="icon-btn${ar === k ? ' on' : ''}" data-auto-resize="${k}" title="${tip}">${icons[i]}</button>`).join('')}</div></div>`;
    html += section('Text', t);
  }

  // Fill
  const fillNodes = nodes.filter((n) => canHavePaint(n, 'fills'));
  if (fillNodes.length) {
    html += section(types.has('image') && types.size === 1 ? 'Fill (behind image)' : 'Fill', paintRows('fills', fillNodes), addPaintButton('fills'));
  }

  // Stroke
  const paintableStroke = nodes.filter((n) => canHavePaint(n, 'strokes'));
  if (paintableStroke.length && !types.has('text')) {
    const strokeNodes = paintableStroke.filter((n) => n.strokes?.length);
    let body = paintRows('strokes', paintableStroke);
    if (strokeNodes.length) {
      const shapeNodes = strokeNodes.filter((n) => n.type !== 'line');
      const align = common(shapeNodes, (n) => n.strokeAlign || 'inside');
      const alignSelect = shapeNodes.length
        ? `<select class="select" data-select="strokeAlign" title="Stroke position">${align === MIXED ? '<option selected disabled>Mixed</option>' : ''}` +
          ['inside', 'center', 'outside'].map((a) => `<option value="${a}" ${align === a ? 'selected' : ''}>${a[0].toUpperCase() + a.slice(1)}</option>`).join('') + '</select>'
        : '';
      const capSelect = types.size === 1 && types.has('line')
        ? `<select class="select" data-select="cap">${['butt', 'round', 'square'].map((c) => `<option ${common(nodes, (n) => n.cap || 'butt') === c ? 'selected' : ''} value="${c}">${c[0].toUpperCase() + c.slice(1)} cap</option>`).join('')}</select>`
        : '';
      body +=
        `<div class="grid2">${alignSelect || capSelect || '<span></span>'}${numField('strokeWidth', '', strokeNodes, { icon: '<span class="mini">≡</span>' })}</div>`;
    }
    html += section('Stroke', body, addPaintButton('strokes'));
  }

  // Export
  html += section('Export', `<div class="export-row">${exportControls()}</div><button class="btn wide" data-action="export">Export ${single ? esc(single.name) : `${nodes.length} layers`}</button>`);
  return html;
}

function autoLayoutSection(nodes) {
  if (!nodes.every(isAutoLayout)) {
    return section('Auto layout', '', `<button class="icon-btn" data-action="add-al" title="Add auto layout  ⇧A">${icons.plus}</button>`);
  }
  const mode = common(nodes, (n) => n.layout.mode);
  const alignP = common(nodes, (n) => n.layout.alignP);
  const alignC = common(nodes, (n) => n.layout.alignC);
  const spacing = common(nodes, (n) => n.layout.spacing);
  const horiz = mode === 'horizontal';
  const dir = [['vertical', 'alVertical', 'Vertical layout'], ['horizontal', 'alHorizontal', 'Horizontal layout']]
    .map(([m, i, tip]) => `<button class="icon-btn${mode === m ? ' on' : ''}" data-al-mode="${m}" title="${tip}">${icons[i]}</button>`).join('');
  const POS = ['start', 'center', 'end'];
  let cells = '';
  for (const r of POS) {
    for (const c of POS) {
      const p = horiz ? c : r, q = horiz ? r : c; // primary / counter position of this cell
      const on = mode !== MIXED && alignC === q && (spacing === 'auto' || alignP === p);
      cells += `<button class="al-cell${on ? ' on' : ''}" data-al-align="${r},${c}" title="Align ${r === 'center' ? 'middle' : r === 'start' ? 'top' : 'bottom'} ${c === 'start' ? 'left' : c === 'end' ? 'right' : 'center'}"><span></span></button>`;
    }
  }
  const body = `<div class="grid2"><div class="seg">${dir}</div>${numField('gap', '', nodes, { icon: horiz ? icons.gapH : icons.gapV })}</div>` +
    `<div class="al-mid"><div class="al-grid${mode === MIXED ? '' : ` ${mode}`}${spacing === 'auto' ? ' between' : ''}">${cells}</div>` +
    `<div class="al-fields">${numField('padH', '', nodes, { icon: icons.padH })}${numField('padV', '', nodes, { icon: icons.padV })}</div></div>`;
  return section('Auto layout', body, `<button class="icon-btn" data-action="remove-al" title="Remove auto layout  ⌥⇧A">${icons.minus}</button>`);
}

let exportScale = 2, exportFormat = 'png';
function exportControls() {
  return `<select class="select" data-export-scale>${[0.5, 1, 2, 3, 4].map((s) => `<option value="${s}" ${s === exportScale ? 'selected' : ''}>${s}x</option>`).join('')}</select>` +
    `<select class="select" data-export-format>${['png', 'jpg', 'svg'].map((f) => `<option value="${f}" ${f === exportFormat ? 'selected' : ''}>${f.toUpperCase()}</option>`).join('')}</select>`;
}

let lastPropsSig = '';

export function renderProps() {
  const panel = $('#props');
  const active = document.activeElement;
  const sig = `${page().id}|${state.selection.join()}|${state.tool}`;
  const sameTarget = sig === lastPropsSig;
  lastPropsSig = sig;
  if (sameTarget && panel.contains(active) && active.tagName !== 'BUTTON') {
    // Don't clobber the field being edited; refresh the others in place.
    const tmp = document.createElement('div');
    tmp.innerHTML = buildProps();
    for (const el of panel.querySelectorAll('input:not([type=color]):not([type=checkbox])')) {
      if (el === active) continue;
      const attr = ['data-key', 'data-paint-hex', 'data-paint-op', 'data-page-hex'].find((a) => el.hasAttribute(a));
      if (!attr) continue;
      const twin = tmp.querySelector(`[${attr}${el.getAttribute(attr) ? `="${el.getAttribute(attr)}"` : ''}]`);
      if (twin) el.value = twin.value;
    }
    return;
  }
  const scroll = panel.scrollTop;
  panel.innerHTML = buildProps();
  panel.scrollTop = scroll;
}

function initProps() {
  const panel = $('#props');

  const applyField = (key, raw) => {
    const f = FIELDS[key];
    if (!f) return;
    if (f.auto?.test(raw)) return setProps(f.autoValue);
    const v = evalNum(raw);
    if (v === null) return emit('selection');
    setProps(f.set(v));
  };

  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.key) return applyField(t.dataset.key, t.value);
    if (t.dataset.paintHex) {
      const hex = normHex(t.value);
      return hex ? updatePaint(t.dataset.paintHex, (p) => void (p.color = hex)) : emit('selection');
    }
    if (t.dataset.paintOp) {
      const v = evalNum(t.value);
      if (v === null) return emit('selection');
      return updatePaint(t.dataset.paintOp, (p) => void (p.opacity = Math.min(100, Math.max(0, v)) / 100));
    }
    if (t.dataset.paintColor) return updatePaint(t.dataset.paintColor, (p) => void (p.color = t.value.toUpperCase()));
    if (t.dataset.bool) return setProps({ [t.dataset.bool]: t.checked });
    if (t.dataset.sizing) return setProps({ [t.dataset.sizing === 'w' ? 'sizingH' : 'sizingV']: t.value });
    if (t.dataset.select) {
      const v = t.dataset.select === 'fontWeight' ? +t.value : t.value;
      return setProps({ [t.dataset.select]: v });
    }
    if (t.hasAttribute('data-page-bg') || t.hasAttribute('data-page-hex')) {
      const hex = normHex(t.value);
      if (hex) {
        page().background = hex;
        commit();
      } else emit('selection');
      return;
    }
    if (t.hasAttribute('data-export-scale')) exportScale = +t.value;
    if (t.hasAttribute('data-export-format')) exportFormat = t.value;
  });
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.paintColor) {
      updatePaint(t.dataset.paintColor, (p) => void (p.color = t.value.toUpperCase()), { live: true });
      t.parentElement.style.setProperty('--c', t.value);
    }
    if (t.hasAttribute('data-page-bg')) {
      page().background = t.value.toUpperCase();
      emit('view');
    }
  });
  panel.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.tagName !== 'INPUT') return;
    if (e.key === 'Enter') {
      t.blur();
    } else if (e.key === 'Escape') {
      emit('selection');
      t.blur();
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && t.dataset.key) {
      e.preventDefault();
      const cur = evalNum(t.value) ?? 0;
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      t.value = fmtNum(cur + step);
      applyField(t.dataset.key, t.value);
    }
  });
  panel.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'color') e.target.select();
  });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const nodes = selectedNodes();
    if (b.dataset.align) return align(b.dataset.align);
    if (b.dataset.distribute) return distribute(b.dataset.distribute);
    if (b.dataset.textAlign) return setProps({ textAlign: b.dataset.textAlign });
    if (b.dataset.autoResize) return setProps({ autoResize: b.dataset.autoResize });
    if (b.dataset.paintAct === 'toggle') return updatePaint(b.dataset.paint, (p) => void (p.visible = p.visible === false));
    if (b.dataset.paintAct === 'remove') return updatePaint(b.dataset.paint, (p, list, i) => void list.splice(i, 1));
    if (b.dataset.alMode) return setProps({ 'layout.mode': b.dataset.alMode });
    if (b.dataset.alAlign) {
      const [r, c] = b.dataset.alAlign.split(',');
      for (const n of nodes) {
        if (!n.layout) continue;
        const horiz = n.layout.mode === 'horizontal';
        n.layout.alignP = horiz ? c : r;
        n.layout.alignC = horiz ? r : c;
      }
      return commit();
    }
    if (b.dataset.preset) {
      const [name, w, h] = FRAME_PRESETS[+b.dataset.preset];
      const { width, height } = viewportSize();
      const c = toWorld({ x: width / 2, y: height / 2 });
      const n = createNode('frame', { name, w, h });
      insertNode(n, null);
      setWorldMatrix(n, translate(Math.round(c.x - w / 2), Math.round(c.y - h / 2)));
      setTool('move');
      select([n.id]);
      commit();
      zoomToSelection();
      return;
    }
    switch (b.dataset.action) {
      case 'add-al':
        return addAutoLayout();
      case 'remove-al':
        return removeAutoLayout();
      case 'lock-aspect': {
        const on = !nodes.every((n) => n.lockAspect);
        for (const n of nodes) n.lockAspect = on;
        return commit();
      }
      case 'add-fills':
        return addPaint('fills');
      case 'add-strokes':
        return addPaint('strokes');
      case 'export':
        return exportNodes(nodes, { format: exportFormat, scale: exportScale });
      case 'export-page':
        return exportNodes(page().children, { format: exportFormat, scale: exportScale });
    }
  });

  // Scrubbable labels
  panel.addEventListener('pointerdown', (e) => {
    const lbl = e.target.closest('[data-scrub]');
    if (!lbl) return;
    e.preventDefault();
    const key = lbl.dataset.scrub;
    const f = FIELDS[key];
    const nodes = selectedNodes();
    if (!nodes.length) return;
    const start = e.clientX;
    let base = f.get(nodes[0]);
    if (typeof base !== 'number') base = key === 'lineHeight' ? 120 : 0;
    document.body.classList.add('scrubbing');
    let moved = false;
    const move = (ev) => {
      moved = true;
      const step = ev.shiftKey ? 10 : 1;
      const v = Math.round(base + (ev.clientX - start) * step);
      setProps(f.set(v), { live: true, nodes });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('scrubbing');
      if (moved) commit();
      else lbl.parentElement.querySelector('input')?.focus();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // Zoom menu
  $('#zoom-btn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = () => {
      const { width, height } = viewportSize();
      return { x: width / 2, y: height / 2 };
    };
    showContextMenu(r.left - 120, r.bottom + 4, [
      { label: 'Zoom in', shortcut: '⌘+', action: zoomIn },
      { label: 'Zoom out', shortcut: '⌘−', action: zoomOut },
      { label: 'Zoom to fit', shortcut: '⇧1', action: zoomToFit },
      { label: 'Zoom to selection', shortcut: '⇧2', action: zoomToSelection },
      '-',
      { label: 'Zoom to 50%', action: () => zoomAt(0.5 / view().zoom, c()) },
      { label: 'Zoom to 100%', shortcut: '⇧0', action: zoomTo100 },
      { label: 'Zoom to 200%', action: () => zoomAt(2 / view().zoom, c()) },
    ]);
  });
}

export function renderZoomLabel() {
  $('#zoom-btn').innerHTML = `${Math.round(view().zoom * 100)}%${icons.chevronDown}`;
}

// ---------- toast ----------
function initToast() {
  let timer;
  window.addEventListener('sigma:toast', (e) => {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = e.detail;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 3200);
  });
}
