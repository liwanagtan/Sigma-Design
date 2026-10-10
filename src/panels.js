import {
  state, page, view, emit, commit, select, selectedNodes, getNode, getParent, siblingsOf, ancestors, isAncestor,
  uid, detach, insertNode, worldMatrix, setWorldMatrix, createNode, undo, redo, makePaint, isFrameLike, editNode, worldBounds,
} from './store.js';
import { translate } from './geom.js';
import { icons, layerIcon } from './icons.js';
import {
  setTool, setProps, align, distribute, zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection, zoomAt,
  viewportSize, sortByZ, toggleVisible, toggleLocked, addAutoLayout, removeAutoLayout,
  placeInstance, duplicateSelection, detachSelection, goToMainComponent, resetSelectionOverrides, addVariant,
} from './commands.js';
import { isAutoLayout, getSizing } from './layout.js';
import {
  isInsideInstance, owningInstance, canPlaceInside, listComponents, instancesOf, mainComponentOf, overrideCount,
  containingComponent, propsOf, PROP_TYPES, PROP_TARGET, addComponentProp, removeComponentProp, bindLayerProp,
  setInstanceProp, isVariant, variantDefs, parseVariantName, switchVariant, renameVariantProperty, setVariantValue,
  addVariantProperty, displayName,
} from './components.js';
import { exportNodes, saveFile, pickImages } from './io.js';
import { createFile, openFile, goHome, pickFilesToImport } from './files.js';
import { sampleDocument } from './sample.js';
import {
  collections, findVariable, typeForPath, previewValue, bindVariable, unbindVariable, shiftPaintBindings, createCollection,
  createVariable, VAR_TYPES, multiModeCollections, inheritedMode, splitColor,
} from './variables.js';
import { openVariablesEditor } from './variables-ui.js';
import { showContextMenu } from './menu.js';
import { stopEditing } from './text.js';
import { toWorld, nodeWorldSVG } from './render.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MIXED = Symbol('mixed');

import { FONTS, WEIGHTS } from './fonts.js';
const TYPE_LABEL = {
  frame: 'Frame', group: 'Group', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', text: 'Text', image: 'Image',
  component: 'Component', componentSet: 'Component set', instance: 'Instance',
};
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
  initAssets();
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
      { label: 'Back to files', action: goHome },
      '-',
      { label: 'New design file', action: async () => openFile(await createFile(sampleDocument({ blank: true }))) },
      { label: 'Import file…', action: async () => {
        const [id] = await pickFilesToImport();
        if (id) openFile(id);
      } },
      { label: 'Open sample file', action: async () => openFile(await createFile(sampleDocument())) },
      { label: 'Download a copy (.sigma.json)', action: saveFile },
      '-',
      { label: 'Place image…', shortcut: '⇧⌘K', action: () => pickImages() },
      { label: sel.length ? 'Export selection as PNG' : 'Export page as PNG', shortcut: '⇧⌘E', action: () => exportNodes(sel.length ? sel : page().children, { format: 'png', scale: 2 }) },
      { label: sel.length ? 'Export selection as SVG' : 'Export page as SVG', action: () => exportNodes(sel.length ? sel : page().children, { format: 'svg' }) },
      '-',
      { label: 'Undo', shortcut: '⌘Z', action: undo },
      { label: 'Redo', shortcut: '⇧⌘Z', action: redo },
      '-',
      { label: 'Local design tokens…', action: () => openVariablesEditor() },
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
    if (e.key === '?' && state.screen === 'editor' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) showShortcuts();
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
    ['Edit', [['Undo / Redo', '⌘Z / ⇧⌘Z'], ['Copy / Paste / Cut', '⌘C / ⌘V / ⌘X'], ['Duplicate', '⌘D or ⌥-drag'], ['Delete', '⌫'], ['Group / Ungroup', '⌘G / ⇧⌘G'], ['Frame selection', '⌥⌘G'], ['Add / remove auto layout', '⇧A / ⌥⇧A'], ['Create component', '⌥⌘K'], ['Detach instance', '⌥⌘B'], ['Reorder in auto layout', 'Drag or arrow keys'], ['Nudge', 'Arrows (⇧ = 10px)'], ['Bring forward / Send backward', '⌘] / ⌘['], ['To front / To back', '⌥⌘] / ⌥⌘['], ['Hide / Lock', '⇧⌘H / ⇧⌘L'], ['Rename', '⌘R'], ['Flip', '⇧H / ⇧V']]],
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
    const pos = dropPos(e, row);
    const dest = pos === 'inside' ? target : getParent(target.id);
    if (!dragIds.every((id) => !isInsideInstance(getNode(id)) && canPlaceInside(getNode(id), dest))) return;
    e.preventDefault();
    clearMarks();
    row.classList.add(`drop-${pos}`);
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
    const parent = pos === 'inside' ? target : getParent(target.id);
    const nodes = sortByZ(dragIds.map(getNode).filter(Boolean))
      .filter((n) => n !== target && !isAncestor(n, target) && !isInsideInstance(n) && canPlaceInside(n, parent));
    dragIds = null;
    if (!nodes.length) return;
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
    editNode(n, ['name'], () => {
      n.name = name;
      n.autoName = false;
    });
    commit();
  });
}

export function renderLayers(force = false) {
  const list = $('#layers-list');
  if (!force && list.querySelector('input')) return;
  const sel = new Set(state.selection);
  const rows = [];
  const walkRows = (nodes, depth, inSelected, inInstance) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const kids = n.children?.length;
      const open = kids && !state.collapsed.has(n.id);
      const cls = ['layer-row', n.type];
      if (inInstance) cls.push('in-instance');
      if (n.type === 'component' || n.type === 'instance' || n.type === 'componentSet') cls.push('componentish');
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
      if (open) walkRows(n.children, depth + 1, inSelected || sel.has(n.id), inInstance || n.type === 'instance');
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

// Fields that can be bound to number variables, and the property path they bind.
const FIELD_BIND = {
  w: 'w', h: 'h', radius: 'radius', opacity: 'opacity', strokeWidth: 'strokeWidth', fontSize: 'fontSize',
  lineHeight: 'lineHeight', letterSpacing: 'letterSpacing', gap: 'layout.gap',
};

function numField(key, label, nodes, { icon } = {}) {
  const f = FIELDS[key];
  const path = FIELD_BIND[key];
  const bound = path ? boundVar(nodes, path) : null;
  const head = `<label class="field${path ? ' bindable' : ''}"><span class="field-label" data-scrub="${key}">${icon || label}</span>`;
  if (bound && bound !== MIXED) return `${head}${varChip(path, bound)}</label>`;
  const v = common(nodes, f.get);
  const shown = v === MIXED ? '' : fmtNum(v);
  return `${head}<input data-key="${key}" value="${esc(shown)}"${v === MIXED ? ' placeholder="Mixed"' : ''} spellcheck="false">` +
    (path ? varButton(path) : '') + '</label>';
}

// ---------- variable modes ----------
// One picker per collection that has several modes: "Auto" inherits, or pin a specific mode.
// nodes = null edits the current page.
function modeRows(nodes) {
  const cols = multiModeCollections();
  if (!cols.length) return '';
  return cols.map((col) => {
    let current, inherited;
    if (nodes) {
      current = common(nodes, (n) => n.modes?.[col.id] || '');
      inherited = inheritedMode(nodes[0], col, ancestors, () => page());
    } else {
      current = page().modes?.[col.id] || '';
      inherited = null;
    }
    // "Auto" inherits; for an extended collection that nothing applies, it means "not applied".
    const inheritedName = col.modes.find((m) => m.id === (inherited || col.defaultModeId))?.name || '';
    const autoLabel = col.extends && !inherited ? 'Not applied' : `Auto (${inheritedName})`;
    return `<label class="bind-row mode-row" title="Token mode for ${esc(col.name)}"><span>${esc(col.name)}</span>` +
      `<select class="select" data-mode-col="${col.id}" data-mode-target="${nodes ? 'layers' : 'page'}">` +
      (current === MIXED ? '<option selected disabled>Mixed</option>' : '') +
      `<option value="" ${current === '' ? 'selected' : ''}>${esc(autoLabel)}</option>` +
      col.modes.map((m) => `<option value="${m.id}" ${current === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('') +
      '</select></label>';
  }).join('');
}

function setMode(target, colId, modeId) {
  const apply = (obj) => {
    const modes = { ...(obj.modes || {}) };
    if (modeId) modes[colId] = modeId;
    else delete modes[colId];
    if (Object.keys(modes).length) obj.modes = modes;
    else delete obj.modes;
  };
  if (target === 'page') apply(page());
  else for (const n of selectedNodes()) editNode(n, ['modes'], () => apply(n));
  commit();
}

// ---------- variable bindings ----------
const VAR_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M6 1l4.3 2.5v5L6 11 1.7 8.5v-5z"/><circle cx="6" cy="6" r="1.4"/></svg>';

// The variable all `nodes` bind at `path`: a variable, MIXED, or null when unbound.
function boundVar(nodes, path) {
  const ids = new Set(nodes.map((n) => n.bindings?.[path] || null));
  if (ids.size !== 1) return MIXED;
  const id = [...ids][0];
  return id ? findVariable(id)?.variable || { id, name: 'Missing token' } : null;
}

const varChip = (path, v) =>
  `<button class="var-chip" data-var-menu="${path}" title="${esc(v.name)} — click to change or detach">${VAR_ICON}<span>${esc(v.name.split('/').pop())}</span></button>`;
const varButton = (path) => `<button class="icon-btn var-btn" data-var-menu="${path}" title="Apply design token">${VAR_ICON}</button>`;
const varControl = (nodes, path) => {
  const b = boundVar(nodes, path);
  return b && b !== MIXED ? varChip(path, b) : varButton(path);
};

function readPath(node, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), node);
}

function previewText(v) {
  const val = previewValue(v.id);
  if (v.type === 'boolean') return val ? 'True' : 'False';
  if (v.type === 'typography') return val ? `${val.fontFamily} ${val.fontSize}` : '';
  if (v.type === 'color') {
    const { hex, alpha } = splitColor(val);
    return alpha < 1 ? `${hex} ${Math.round(alpha * 100)}%` : hex;
  }
  if (v.type === 'string') return String(val ?? '').slice(0, 14);
  return String(val ?? '');
}

function variableMenu(btn, path) {
  const nodes = selectedNodes();
  const type = typeForPath(path);
  if (!type || !nodes.length) return;
  const current = boundVar(nodes, path);
  const items = [];
  for (const col of collections()) {
    const vars = col.variables.filter((v) => v.type === type);
    if (!vars.length) continue;
    if (items.length) items.push('-');
    items.push({ label: col.name, disabled: true });
    for (const v of vars) {
      items.push({
        label: v.name, shortcut: previewText(v), checked: current && current !== MIXED && current.id === v.id,
        action: () => applyVariable(nodes, path, v.id),
      });
    }
  }
  if (!items.length) items.push({ label: `No ${VAR_TYPES[type].toLowerCase()} tokens yet`, disabled: true });
  items.push('-', { label: 'Create token from this value', action: () => variableFromValue(nodes, path, type) });
  if (current) items.push({ label: 'Detach token', action: () => applyVariable(nodes, path, null) });
  items.push({ label: 'Open local design tokens…', action: () => openVariablesEditor() });
  const r = btn.getBoundingClientRect();
  showContextMenu(Math.max(8, r.right - 220), r.bottom + 4, items);
}

function applyVariable(nodes, path, varId) {
  for (const n of nodes) {
    editNode(n, ['bindings'], () => (varId ? bindVariable(n, path, varId) : unbindVariable(n, path)));
  }
  commit();
}

function variableFromValue(nodes, path, type) {
  const col = collections()[0] || createCollection('Tokens');
  let value = readPath(nodes[0], path);
  if (type === 'typography') {
    const n = nodes[0];
    value = { fontFamily: n.fontFamily, fontWeight: n.fontWeight, fontSize: n.fontSize, lineHeight: n.lineHeight ?? null, letterSpacing: n.letterSpacing || 0 };
  }
  if (type === 'color') {
    // Keep the paint's opacity in the new token.
    const [kind, i] = path.split('.');
    const p = nodes[0][kind]?.[+i];
    if (p && p.opacity < 1) value = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0').toUpperCase();
  }
  if (path === 'opacity') value = Math.round((value ?? 1) * 100);
  if (type === 'number') value = Number(value) || 0;
  if (type === 'boolean') value = value !== false;
  if (type === 'string') value = String(value ?? '');
  const name = type === 'color' ? 'color' : type === 'typography' ? 'text/style' : path.split('.').pop();
  const v = createVariable(col, type, name);
  for (const m of col.modes) v.valuesByMode[m.id] = value;
  applyVariable(nodes, path, v.id);
}

// ---------- paints (multiple fills / strokes) ----------
const PAINT_KINDS = { fills: 'fill', strokes: 'stroke' };
const canHavePaint = (n, kind) => (kind === 'fills' ? !['line', 'group'].includes(n.type) : !['group', 'text'].includes(n.type));
const defaultPaintColor = (n, kind) =>
  kind === 'strokes' ? '#000000' : n.type === 'text' ? '#000000' : isFrameLike(n) ? '#FFFFFF' : '#D9D9D9';

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
    const path = `${kind}.${i}.color`;
    const bound = boundVar(nodes, path);
    return `<div class="color-row paint-row${hidden ? ' is-hidden' : ''}">` +
      `<label class="swatch" style="--c:${p.color}"><input type="color" data-paint-color="${id}" value="${p.color.toLowerCase()}"></label>` +
      (bound && bound !== MIXED
        ? `<span class="hex">${varChip(path, bound)}</span>`
        : `<input class="hex" data-paint-hex="${id}" value="${esc(p.color.replace('#', ''))}" spellcheck="false">${varButton(path)}`) +
      `<input class="op" data-paint-op="${id}" value="${Math.round(p.opacity * 100)}"><span class="op-suffix">%</span>` +
      `<button class="icon-btn" data-paint-act="toggle" data-paint="${id}" title="${hidden ? 'Show' : 'Hide'} ${PAINT_KINDS[kind]}">${hidden ? icons.eyeOff : icons.eye}</button>` +
      `<button class="icon-btn" data-paint-act="remove" data-paint="${id}" title="Remove ${PAINT_KINDS[kind]}">${icons.minus}</button></div>`;
  }).join('');
}

function addPaintButton(kind) {
  return `<button class="icon-btn" data-action="add-${kind}" title="Add ${PAINT_KINDS[kind]}">${icons.plus}</button>`;
}

// Apply fn to paint `id` ("fills:2") on every selected node.
// Apply fn to paint `id` ("fills:2") on every selected node; `field` is the paint property being edited.
function updatePaint(id, field, fn, { live = false } = {}) {
  const [kind, i] = id.split(':');
  for (const n of selectedNodes()) {
    if (!n[kind]?.[+i]) continue;
    editNode(n, [`${kind}.${i}.${field}`], () => fn(n[kind][+i]));
  }
  if (live) emit('doc');
  else commit();
}

function removePaint(id) {
  const [kind, i] = id.split(':');
  for (const n of selectedNodes()) {
    if (!n[kind]?.[+i]) continue;
    editNode(n, [`${kind}.${i}`], () => n[kind].splice(+i, 1));
    // Bindings of later paints move down one slot.
    if (n.bindings) editNode(n, ['bindings'], () => shiftPaintBindings(n, kind, +i));
  }
  commit();
}

function addPaint(kind) {
  const nodes = selectedNodes().filter((n) => canHavePaint(n, kind));
  if (!nodes.length) return;
  const replace = !samePaints(nodes, kind);
  for (const n of nodes) {
    editNode(n, [kind], () => {
      const list = replace ? [] : (n[kind] || []);
      // The first paint gets the layer's default color; extra ones start as a translucent black overlay.
      list.push(list.length ? makePaint('#000000', 0.2) : makePaint(defaultPaintColor(n, kind)));
      n[kind] = list;
    });
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
    const vcount = collections().reduce((n, c) => n + c.variables.length, 0);
    html += section('Local design tokens', `<div class="muted">${vcount ? `${vcount} token${vcount === 1 ? '' : 's'} in ${collections().length} collection${collections().length === 1 ? '' : 's'}` : 'Reusable colors, numbers, text and booleans, kept in this file.'}</div>` +
      '<button class="btn wide" data-action="open-variables">Open local tokens</button>');
    html += section('Page', modeRows(null) + `<div class="color-row"><label class="swatch" style="--c:${page().background}"><input type="color" data-page-bg value="${page().background.toLowerCase()}"></label>` +
      `<input class="hex" data-page-hex value="${page().background.replace('#', '')}" spellcheck="false"></div>`);
    html += section('Export', `<div class="export-row">${exportControls()}</div><button class="btn wide" data-action="export-page">Export ${esc(page().name)}</button>`);
    return html;
  }
  const types = new Set(nodes.map((n) => n.type));
  const single = nodes.length === 1 ? nodes[0] : null;
  const has = (pred) => nodes.every(pred);
  // Layers inside an instance take their geometry from the main component.
  const lockedGeometry = nodes.some(isInsideInstance);
  let html = componentSection(nodes);

  // Alignment
  const alignBtns = [['left', 'alignLeft'], ['hcenter', 'alignHCenter'], ['right', 'alignRight'], ['top', 'alignTop'], ['vcenter', 'alignVCenter'], ['bottom', 'alignBottom']];
  const canAlign = !lockedGeometry && (nodes.length > 1 || (single && getParent(single.id)));
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
  const hasRadius = has((n) => isFrameLike(n) || ['rect', 'image'].includes(n.type));
  layout += `<div class="grid2">${numField('rotation', '', nodes, { icon: icons.rotation })}${hasRadius ? numField('radius', '', nodes, { icon: icons.radius }) : ''}</div>`;
  if (nodes.every(isFrameLike)) {
    const clip = common(nodes, (n) => !!n.clip);
    layout += `<label class="check-row"><input type="checkbox" data-bool="clip" ${clip === true ? 'checked' : ''}> Clip content</label>`;
  }
  if (nodes.every((n) => isAutoLayout(getParent(n.id)))) {
    const abs = common(nodes, (n) => !!n.absolute);
    layout += `<label class="check-row" title="Ignore auto layout and position freely"><input type="checkbox" data-bool="absolute" ${abs === true ? 'checked' : ''}> Absolute position</label>`;
  }
  html += section(title, lockedGeometry ? `<fieldset class="readonly" disabled title="Comes from the main component">${layout}</fieldset>` : layout);
  if (!lockedGeometry) html += autoLayoutSection(nodes);

  // Layer
  html += section('Layer', `<div class="grid2">${numField('opacity', '', nodes, { icon: '<span class="op-icon"></span>' })}` +
    `<div class="bind-inline"><span class="muted">Visibility</span>${varControl(nodes, 'visible')}</div></div>` + modeRows(nodes));

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
    t += `<div class="bind-inline wide"><span class="muted">Text style</span>${varControl(nodes, 'typography')}</div>`;
    t += `<div class="bind-inline wide"><span class="muted">Text content</span>${varControl(nodes, 'text')}</div>`;
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
  // Instances get their auto layout from the main component; its values can be overridden, not added or removed.
  const fromMain = nodes.some((n) => n.type === 'instance');
  if (fromMain && !nodes.every(isAutoLayout)) return '';
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
  return section('Auto layout', body, fromMain ? '' : `<button class="icon-btn" data-action="remove-al" title="Remove auto layout  ⌥⇧A">${icons.minus}</button>`);
}

// ---------- components ----------
function componentSection(nodes) {
  const single = nodes.length === 1 ? nodes[0] : null;
  if (single?.type === 'componentSet') return variantsSection(single) + propertiesSection(single);
  if (single?.type === 'component') {
    const count = instancesOf(single.id).length;
    return (isVariant(single) ? variantValuesSection(single) : '') + section(isVariant(single) ? 'Variant' : 'Main component',
      `<textarea class="desc" data-desc rows="2" placeholder="Add a description…" spellcheck="false">${esc(single.description || '')}</textarea>` +
      `<div class="muted">${count} instance${count === 1 ? '' : 's'} in this file</div>`,
      `<button class="icon-btn" data-action="add-instance" title="Create an instance next to it">${icons.plus}</button>`) +
      propertiesSection(single);
  }
  if (single?.type === 'instance' && !isInsideInstance(single)) {
    const main = mainComponentOf(single);
    const n = overrideCount(single);
    const body = (main
      ? `<button class="link-row" data-action="go-main" title="Go to main component"><span class="licon purple">${layerIcon(main)}</span><span class="link-name">${esc(displayName(main))}</span><span class="muted">Go to main ›</span></button>`
      : '<div class="warn">The main component is missing. Detach the instance to keep editing it freely.</div>') +
      instanceControls(single, main) +
      `<div class="btn-row"><button class="btn" data-action="reset-overrides" ${n ? '' : 'disabled'}>Reset ${n ? `${n} ` : ''}override${n === 1 ? '' : 's'}</button>` +
      '<button class="btn" data-action="detach" title="⌥⌘B">Detach</button></div>';
    return section('Instance', body);
  }
  if (nodes.length && nodes.every(isInsideInstance)) {
    const owner = owningInstance(nodes[0]);
    const n = single ? overrideCount(owner, single.pathKey) : 0;
    return section('Instance layer',
      `<div class="muted">Part of “${esc(owner.name)}”. Appearance and text can be overridden here; size and position come from the main component.</div>` +
      (single?.type === 'instance' ? instanceControls(single, mainComponentOf(single)) : '') +
      (single ? `<button class="btn wide" data-action="reset-overrides" ${n ? '' : 'disabled'}>Reset overrides</button>` : ''));
  }
  if (single && containingComponent(single)) return bindingSection(single, containingComponent(single));
  return '';
}

function componentOptions(selectedId, { exclude } = {}) {
  return listComponents()
    .filter(({ node }) => !exclude || !exclude(node))
    .map(({ node }) => {
      const label = isVariant(node) ? `${getParent(node.id).name} / ${node.name}` : node.name;
      return `<option value="${node.id}" ${node.id === selectedId ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
}

// Property definitions on a main component (or its component set).
function propertiesSection(comp) {
  const defs = Object.entries(propsOf(comp));
  const rows = defs.map(([pid, def]) => {
    let value;
    if (def.type === 'boolean') value = `<label class="prop-toggle"><input type="checkbox" data-prop-default="${pid}" ${def.default ? 'checked' : ''}> Default</label>`;
    else if (def.type === 'text') value = `<input class="prop-input" data-prop-default="${pid}" value="${esc(def.default ?? '')}" spellcheck="false" placeholder="Default text">`;
    else value = `<select class="select" data-prop-default="${pid}">${componentOptions(def.default, { exclude: (c) => c.id === comp.id })}</select>`;
    return `<div class="prop-def"><div class="prop-head"><input class="prop-name" data-prop-name="${pid}" value="${esc(def.name)}" spellcheck="false">` +
      `<span class="prop-type">${PROP_TYPES[def.type]}</span>` +
      `<button class="icon-btn" data-remove-prop="${pid}" title="Remove property">${icons.minus}</button></div>${value}</div>`;
  }).join('');
  return section('Properties', rows || '<div class="muted">Add properties to let instances toggle layers, change text or swap nested instances.</div>',
    `<button class="icon-btn" data-action="add-prop" title="Add a component property">${icons.plus}</button>`);
}

// Bind a layer inside a main component to the component's properties.
function bindingSection(layer, comp) {
  const defs = Object.entries(propsOf(comp));
  const row = (target, type, label) => {
    const current = layer.propRefs?.[target] || '';
    const opts = defs.filter(([, d]) => d.type === type)
      .map(([pid, d]) => `<option value="${pid}" ${pid === current ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    return `<label class="bind-row"><span>${label}</span><select class="select" data-bind="${target}" data-bind-type="${type}">` +
      `<option value="">Not linked</option>${opts}<option value="__new__">+ Create ${PROP_TYPES[type].toLowerCase()} property</option></select></label>`;
  };
  let body = row('visible', 'boolean', 'Show layer');
  if (layer.type === 'text') body += row('text', 'text', 'Text');
  if (layer.type === 'instance') body += row('componentId', 'instance', 'Instance');
  return section('Component properties', body);
}

// Variant property definitions of a component set: rename properties, add properties and variants.
function variantsSection(set) {
  const defs = Object.entries(variantDefs(set));
  const rows = defs.map(([prop, values]) =>
    `<div class="prop-def"><div class="prop-head"><input class="prop-name" data-vprop-rename="${esc(prop)}" value="${esc(prop)}" spellcheck="false">` +
    `<span class="prop-type">Variant</span></div><div class="chips">${values.map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</div></div>`).join('');
  return section('Variants', (rows || '<div class="muted">No variant properties yet.</div>') +
    '<button class="btn wide" data-action="add-variant">Add variant</button>',
    `<button class="icon-btn" data-action="add-variant-prop" title="Add a variant property">${icons.plus}</button>`);
}

// The selected variant's own property values (editing one renames the variant).
function variantValuesSection(variant) {
  const props = parseVariantName(variant.name);
  return section('Variant properties', Object.entries(props).map(([k, v]) =>
    `<label class="bind-row"><span>${esc(k)}</span><input class="prop-input" data-variant-value="${esc(k)}" value="${esc(v)}" spellcheck="false"></label>`).join(''));
}

// Property values and component swap for an instance.
function instanceControls(inst, main) {
  if (!main) return '';
  let variantRows = '';
  if (isVariant(main)) {
    const current = parseVariantName(main.name);
    variantRows = Object.entries(variantDefs(getParent(main.id))).map(([prop, values]) =>
      `<label class="bind-row"><span>${esc(prop)}</span><select class="select" data-variant-prop="${esc(prop)}">` +
      values.map((v) => `<option ${v === current[prop] ? 'selected' : ''}>${esc(v)}</option>`).join('') + '</select></label>').join('');
  }
  const values = inst.propValues || {};
  const rows = Object.entries(propsOf(main)).map(([pid, def]) => {
    const v = values[pid] ?? def.default;
    let control;
    if (def.type === 'boolean') control = `<input type="checkbox" data-instance-prop="${pid}" ${v ? 'checked' : ''}>`;
    else if (def.type === 'text') control = `<input class="prop-input" data-instance-prop="${pid}" value="${esc(v ?? '')}" spellcheck="false">`;
    else control = `<select class="select" data-instance-prop="${pid}">${componentOptions(v, { exclude: (c) => !canPlaceInside({ type: 'instance', componentId: c.id }, getParent(inst.id)) })}</select>`;
    return `<label class="bind-row"><span>${esc(def.name)}</span>${control}</label>`;
  }).join('');
  const swap = `<label class="bind-row"><span>Swap</span><select class="select" data-swap>${componentOptions(inst.componentId)}</select></label>`;
  return variantRows + rows + swap;
}

function onComponentPropChange(t) {
  const node = selectedNodes()[0];
  if (!node) return;
  if (t.dataset.propName) {
    const def = propsOf(node)[t.dataset.propName];
    if (def && t.value.trim()) def.name = t.value.trim();
    return commit();
  }
  if (t.dataset.propDefault) {
    const def = propsOf(node)[t.dataset.propDefault];
    if (def) def.default = t.type === 'checkbox' ? t.checked : t.value;
    return commit();
  }
  if (t.dataset.bind) {
    const comp = containingComponent(node);
    const target = t.dataset.bind;
    let pid = t.value || null;
    if (pid === '__new__') {
      const type = t.dataset.bindType;
      const value = type === 'boolean' ? node.visible !== false : type === 'text' ? node.text : node.componentId;
      pid = addComponentProp(comp, type, { name: type === 'boolean' ? `Show ${node.name}` : node.name, value });
    }
    bindLayerProp(node, target, pid);
    return commit();
  }
  if (t.dataset.instanceProp) {
    setInstanceProp(node, t.dataset.instanceProp, t.type === 'checkbox' ? t.checked : t.value);
    return commit();
  }
  if (t.hasAttribute('data-swap')) {
    editNode(node, ['componentId'], () => void (node.componentId = t.value));
    return commit();
  }
}

// ---------- assets ----------
let leftTab = 'layers';
let assetQuery = '';

function initAssets() {
  document.querySelector('.left-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-left-tab]');
    if (!b) return;
    leftTab = b.dataset.leftTab;
    for (const t of document.querySelectorAll('[data-left-tab]')) t.classList.toggle('active', t === b);
    $('#left-assets').hidden = leftTab !== 'assets';
    document.querySelector('#left .pages').hidden = leftTab !== 'layers';
    document.querySelector('#left .layers').hidden = leftTab !== 'layers';
    renderAssets();
  });
  $('#assets-search').addEventListener('input', (e) => {
    assetQuery = e.target.value;
    renderAssets();
  });
  const list = $('#assets-list');
  list.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-component]');
    const main = tile && getNode(tile.dataset.component);
    if (!main) return;
    const { width, height } = viewportSize();
    placeInstance(main, toWorld({ x: width / 2, y: height / 2 }));
  });
  list.addEventListener('dragstart', (e) => {
    const tile = e.target.closest('[data-component]');
    if (!tile) return;
    e.dataTransfer.setData('application/x-sigma-component', tile.dataset.component);
    e.dataTransfer.effectAllowed = 'copy';
  });
}

export function renderAssets() {
  if (leftTab !== 'assets' || !state.doc) return;
  const q = assetQuery.trim().toLowerCase();
  // A component set appears once (inserting its first variant); its variants aren't listed separately.
  const comps = [];
  for (const c of listComponents()) {
    const set = getParent(c.node.id);
    if (set?.type === 'componentSet') {
      if (set.children.find((k) => k.type === 'component') === c.node) comps.push({ node: set, page: c.page, insert: c.node });
    } else comps.push({ ...c, insert: c.node });
  }
  const matches = comps.filter(({ node }) => !q || node.name.toLowerCase().includes(q));
  const list = $('#assets-list');
  if (!matches.length) {
    list.innerHTML = `<div class="empty-hint">${q ? 'No components match.' : 'No components yet. Select layers and press ⌥⌘K to create one.'}</div>`;
    return;
  }
  const byPage = new Map();
  for (const c of matches) {
    if (!byPage.has(c.page)) byPage.set(c.page, []);
    byPage.get(c.page).push(c);
  }
  // Within a page, "/" in component names groups them, e.g. "Buttons/Primary".
  const tile = ({ node, insert }) => {
    const leaf = node.name.slice(node.name.lastIndexOf('/') + 1);
    const desc = node.description || insert.description;
    return `<div class="asset" draggable="true" data-component="${insert.id}" title="${esc(node.name)}${desc ? `\n${esc(desc)}` : ''}\nClick to insert, or drag onto the canvas">` +
      `<div class="asset-thumb">${componentThumb(insert)}</div><div class="asset-name">${esc(leaf)}${node.type === 'componentSet' ? ` <span class="muted">· ${node.children.length}</span>` : ''}</div></div>`;
  };
  list.innerHTML = [...byPage].map(([pg, items]) => {
    const groups = new Map();
    for (const it of items) {
      const i = it.node.name.lastIndexOf('/');
      const g = i > 0 ? it.node.name.slice(0, i) : '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    }
    return `<div class="assets-group"><div class="assets-group-title">${esc(pg.name)}</div>` +
      [...groups].map(([g, list]) => (g ? `<div class="assets-subgroup">${esc(g)}</div>` : '') + `<div class="assets-grid">${list.map(tile).join('')}</div>`).join('') +
      '</div>';
  }).join('');
}

function componentThumb(n) {
  const b = worldBounds(n);
  if (!(b.w > 0 && b.h > 0)) return '';
  return `<svg viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet">${nodeWorldSVG(n)}</svg>`;
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
  // Keep a field in use (text being typed, a color picker open); dropdowns, checkboxes and buttons can be rebuilt.
  const typing = active?.tagName === 'TEXTAREA' || (active?.tagName === 'INPUT' && active.type !== 'checkbox');
  if (sameTarget && panel.contains(active) && typing) {
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
      return hex ? updatePaint(t.dataset.paintHex, 'color', (p) => void (p.color = hex)) : emit('selection');
    }
    if (t.dataset.paintOp) {
      const v = evalNum(t.value);
      if (v === null) return emit('selection');
      return updatePaint(t.dataset.paintOp, 'opacity', (p) => void (p.opacity = Math.min(100, Math.max(0, v)) / 100));
    }
    if (t.dataset.paintColor) return updatePaint(t.dataset.paintColor, 'color', (p) => void (p.color = t.value.toUpperCase()));
    if (t.dataset.bool) return setProps({ [t.dataset.bool]: t.checked });
    if (t.dataset.modeCol) return setMode(t.dataset.modeTarget, t.dataset.modeCol, t.value);
    if (t.dataset.vpropRename !== undefined) {
      renameVariantProperty(selectedNodes()[0], t.dataset.vpropRename, t.value);
      return commit();
    }
    if (t.dataset.variantValue !== undefined) {
      setVariantValue(selectedNodes()[0], t.dataset.variantValue, t.value);
      return commit();
    }
    if (t.dataset.variantProp !== undefined) {
      if (!switchVariant(selectedNodes()[0], t.dataset.variantProp, t.value)) {
        window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'No variant matches exactly, so the closest one was used.' }));
      }
      return commit();
    }
    if (t.dataset.propName || t.dataset.propDefault || t.dataset.bind || t.dataset.instanceProp || t.hasAttribute('data-swap')) {
      return onComponentPropChange(t);
    }
    if (t.hasAttribute('data-desc')) {
      for (const n of selectedNodes()) editNode(n, ['description'], () => void (n.description = t.value.trim()));
      return commit();
    }
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
      updatePaint(t.dataset.paintColor, 'color', (p) => void (p.color = t.value.toUpperCase()), { live: true });
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
    if (b.dataset.varMenu) return variableMenu(b, b.dataset.varMenu);
    if (b.dataset.paintAct === 'toggle') return updatePaint(b.dataset.paint, 'visible', (p) => void (p.visible = p.visible === false));
    if (b.dataset.paintAct === 'remove') return removePaint(b.dataset.paint);
    if (b.dataset.alMode) return setProps({ 'layout.mode': b.dataset.alMode });
    if (b.dataset.alAlign) {
      const [r, c] = b.dataset.alAlign.split(',');
      for (const n of nodes) {
        if (!n.layout) continue;
        const horiz = n.layout.mode === 'horizontal';
        editNode(n, ['layout.alignP', 'layout.alignC'], () => {
          n.layout.alignP = horiz ? c : r;
          n.layout.alignC = horiz ? r : c;
        });
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
    if (b.dataset.removeProp) {
      removeComponentProp(nodes[0], b.dataset.removeProp);
      return commit();
    }
    switch (b.dataset.action) {
      case 'add-prop': {
        const comp = nodes[0];
        const r = b.getBoundingClientRect();
        const other = listComponents().find(({ node }) => node.id !== comp.id)?.node;
        return showContextMenu(r.left - 140, r.bottom + 4, [
          { label: 'Boolean', action: () => { addComponentProp(comp, 'boolean', { value: true }); commit(); } },
          { label: 'Text', action: () => { addComponentProp(comp, 'text', { value: 'Text' }); commit(); } },
          { label: 'Instance swap', disabled: !other, action: () => { addComponentProp(comp, 'instance', { value: other.id }); commit(); } },
        ]);
      }
      case 'open-variables':
        return openVariablesEditor();
      case 'add-instance':
        return duplicateSelection();
      case 'add-variant':
        return addVariant(nodes[0]);
      case 'add-variant-prop':
        addVariantProperty(nodes[0]);
        return commit();
      case 'go-main':
        return goToMainComponent();
      case 'reset-overrides':
        return resetSelectionOverrides();
      case 'detach':
        return detachSelection();
      case 'add-al':
        return addAutoLayout();
      case 'remove-al':
        return removeAutoLayout();
      case 'lock-aspect': {
        const on = !nodes.every((n) => n.lockAspect);
        for (const n of nodes) editNode(n, ['lockAspect'], () => void (n.lockAspect = on));
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
    if (!lbl || lbl.closest('fieldset[disabled]')) return;
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
