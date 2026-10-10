// The "Local variables" editor: collections on the left, a table of variables × modes on the right.
import { state, commit, emit, subscribe } from './store.js';
import {
  collections, VAR_TYPES, createCollection, deleteCollection, addMode, removeMode, createVariable, deleteVariable,
  setAlias, findVariable, allVariables, previewValue, isAlias, wouldCycle,
} from './variables.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let modal = null;
let activeId = null;

const TYPE_ICON = {
  color: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"/></svg>',
  number: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M4.5 1.5l-1 9M8.5 1.5l-1 9M2 4.5h8.5M1.5 7.5H10"/></svg>',
  string: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2 3V2h8v1M6 2v8M4.5 10h3"/></svg>',
  boolean: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1" y="3.5" width="10" height="5" rx="2.5"/><circle cx="8.5" cy="6" r="1.5" fill="currentColor"/></svg>',
};
const LINK_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M5 7l2-2M5.5 3.5l.8-.8a2 2 0 0 1 2.8 2.8l-.8.8M6.5 8.5l-.8.8a2 2 0 0 1-2.8-2.8l.8-.8"/></svg>';

export function openVariablesEditor(focusCollectionId) {
  if (!state.doc) return;
  if (focusCollectionId) activeId = focusCollectionId;
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = '<div class="modal vars-modal"></div>';
    document.body.appendChild(modal);
    bind();
    window.addEventListener('keydown', onKey, true);
  }
  render();
}

function close() {
  modal?.remove();
  modal = null;
  window.removeEventListener('keydown', onKey, true);
}

function onKey(e) {
  if (e.key === 'Escape' && !e.target.closest?.('input')) {
    e.stopImmediatePropagation();
    close();
  }
}

// Re-render when the document changes (undo, edits elsewhere), unless the user is typing in the editor.
subscribe((kind) => {
  if (!modal || kind !== 'doc') return;
  if (!state.doc) return close();
  const a = document.activeElement;
  if (modal.contains(a) && a.tagName === 'INPUT' && a.type !== 'checkbox') return;
  render();
});

function active() {
  const cols = collections();
  return cols.find((c) => c.id === activeId) || cols[0] || null;
}

function cell(v, mode) {
  const raw = v.valuesByMode[mode.id];
  const data = `data-var="${v.id}" data-mode="${mode.id}"`;
  const aliasBtn = `<button class="icon-btn cell-alias" ${data} data-alias-menu title="Use another variable (alias)">${LINK_ICON}</button>`;
  if (isAlias(raw)) {
    const target = findVariable(raw.alias);
    return `<div class="var-cell"><button class="alias-chip" ${data} data-alias-menu title="Aliased variable">→ ${esc(target ? target.variable.name : 'Missing variable')}</button></div>`;
  }
  let editor;
  if (v.type === 'color') {
    editor = `<label class="swatch" style="--c:${esc(raw)}"><input type="color" ${data} data-cell="color" value="${esc(String(raw).slice(0, 7).toLowerCase())}"></label>` +
      `<input class="cell-input hex" ${data} data-cell="hex" value="${esc(String(raw).replace('#', ''))}" spellcheck="false">`;
  } else if (v.type === 'number') {
    editor = `<input class="cell-input" ${data} data-cell="number" value="${esc(raw)}" spellcheck="false">`;
  } else if (v.type === 'string') {
    editor = `<input class="cell-input" ${data} data-cell="string" value="${esc(raw)}" spellcheck="false">`;
  } else {
    editor = `<label class="cell-bool"><input type="checkbox" ${data} data-cell="boolean" ${raw ? 'checked' : ''}> ${raw ? 'True' : 'False'}</label>`;
  }
  return `<div class="var-cell">${editor}${aliasBtn}</div>`;
}

function render() {
  if (!modal) return;
  const cols = collections();
  const col = active();
  const sidebar = cols.map((c) => `<button class="vars-col${c === col ? ' active' : ''}" data-col="${c.id}">${esc(c.name)}<span class="muted">${c.variables.length}</span></button>`).join('');
  let main;
  if (!col) {
    main = '<div class="vars-empty"><div class="home-empty-title">No variables yet</div><p>Variables store reusable colors, numbers, text and booleans. Create a collection to start.</p><button class="btn primary" data-act="new-collection">Create collection</button></div>';
  } else {
    const gridCols = `minmax(200px, 1.3fr) repeat(${col.modes.length}, minmax(150px, 1fr)) 40px`;
    const head = `<div class="vars-row vars-head" style="grid-template-columns:${gridCols}"><div>Name</div>` +
      col.modes.map((m) => `<div class="mode-head"><input class="mode-name" data-mode-name="${m.id}" value="${esc(m.name)}" spellcheck="false">` +
        (col.modes.length > 1 ? `<button class="icon-btn" data-remove-mode="${m.id}" title="Delete mode">${icons.close}</button>` : '') + '</div>').join('') +
      `<div><button class="icon-btn" data-act="add-mode" title="Add mode">${icons.plus}</button></div></div>`;
    // Group rows by the part of the name before the last "/".
    const groups = new Map();
    for (const v of col.variables) {
      const i = v.name.lastIndexOf('/');
      const g = i > 0 ? v.name.slice(0, i) : '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(v);
    }
    const body = [...groups].map(([g, vars]) =>
      (g ? `<div class="vars-group">${esc(g)}</div>` : '') +
      vars.map((v) => `<div class="vars-row" style="grid-template-columns:${gridCols}">` +
        `<div class="var-name"><span class="var-type" title="${VAR_TYPES[v.type]}">${TYPE_ICON[v.type]}</span>` +
        `<input data-var-name="${v.id}" value="${esc(v.name)}" spellcheck="false"></div>` +
        col.modes.map((m) => cell(v, m)).join('') +
        `<div><button class="icon-btn" data-delete-var="${v.id}" title="Delete variable">${icons.close}</button></div></div>`).join('')).join('');
    main = `<div class="vars-toolbar"><input class="vars-col-name" data-col-name="${col.id}" value="${esc(col.name)}" spellcheck="false">` +
      `<button class="btn" data-act="delete-collection">Delete collection</button></div>` +
      `<div class="vars-table">${head}${body || '<div class="muted vars-none">No variables in this collection yet.</div>'}</div>` +
      '<div class="vars-footer"><button class="btn" data-act="new-variable">+ Create variable</button></div>';
  }
  modal.querySelector('.modal').innerHTML =
    `<div class="modal-head">Local variables<button class="icon-btn" data-close>${icons.close}</button></div>` +
    `<div class="vars-body"><aside class="vars-side">${sidebar}<button class="vars-add" data-act="new-collection">+ New collection</button></aside>` +
    `<section class="vars-main">${main}</section></div>`;
}

function bind() {
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) return close();
    const t = e.target.closest('button');
    if (!t) return;
    const col = active();
    if (t.dataset.col) {
      activeId = t.dataset.col;
      return render();
    }
    if (t.dataset.removeMode) return change(() => removeMode(col, t.dataset.removeMode));
    if (t.dataset.deleteVar) return change(() => deleteVariable(t.dataset.deleteVar));
    if (t.hasAttribute('data-alias-menu')) return aliasMenu(t);
    switch (t.dataset.act) {
      case 'new-collection':
        return change(() => void (activeId = createCollection().id));
      case 'delete-collection':
        if (col && confirm(`Delete the collection “${col.name}” and its ${col.variables.length} variables? Bound layers keep their current values.`)) {
          change(() => deleteCollection(col));
        }
        return;
      case 'add-mode':
        return change(() => addMode(col));
      case 'new-variable': {
        const r = t.getBoundingClientRect();
        return showContextMenu(r.left, r.top - 120, Object.entries(VAR_TYPES).map(([type, label]) => ({
          label, action: () => change(() => createVariable(col, type)),
        })));
      }
    }
  });
  modal.addEventListener('change', (e) => {
    const t = e.target;
    const col = active();
    if (t.dataset.colName) return change(() => void (col.name = t.value.trim() || col.name));
    if (t.dataset.modeName) return change(() => {
      const m = col.modes.find((x) => x.id === t.dataset.modeName);
      if (m && t.value.trim()) m.name = t.value.trim();
    });
    if (t.dataset.varName) return change(() => {
      const v = findVariable(t.dataset.varName)?.variable;
      if (v && t.value.trim()) v.name = t.value.trim().replace(/\s*\/\s*/g, '/');
    });
    if (t.dataset.cell) {
      const v = findVariable(t.dataset.var)?.variable;
      if (!v) return;
      const mode = t.dataset.mode;
      let value;
      if (t.dataset.cell === 'color') value = t.value.toUpperCase();
      else if (t.dataset.cell === 'hex') {
        const h = t.value.trim().replace(/^#/, '');
        const full = /^[0-9a-f]{3}$/i.test(h) ? h.split('').map((c) => c + c).join('') : h;
        if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(full)) return render();
        value = `#${full.toUpperCase()}`;
      } else if (t.dataset.cell === 'number') {
        value = Number(t.value);
        if (!Number.isFinite(value)) return render();
      } else if (t.dataset.cell === 'boolean') value = t.checked;
      else value = t.value;
      change(() => void (v.valuesByMode[mode] = value));
    }
  });
  modal.addEventListener('input', (e) => {
    // Live color preview while the picker is open.
    const t = e.target;
    if (t.dataset.cell !== 'color') return;
    const v = findVariable(t.dataset.var)?.variable;
    if (!v) return;
    v.valuesByMode[t.dataset.mode] = t.value.toUpperCase();
    t.parentElement.style.setProperty('--c', t.value);
    emit('doc'); // committed (one undo step) by the change event when the picker closes
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur();
    e.stopPropagation();
  });
}

function change(fn) {
  fn();
  commit();
  render();
}

function aliasMenu(btn) {
  const hit = findVariable(btn.dataset.var);
  if (!hit) return;
  const { variable } = hit;
  const mode = btn.dataset.mode;
  const current = variable.valuesByMode[mode];
  const options = allVariables(variable.type).filter(({ variable: o }) => o.id !== variable.id && !wouldCycle(variable.id, o.id));
  const r = btn.getBoundingClientRect();
  const items = options.map(({ variable: o, collection }) => ({
    label: `${collection.name} / ${o.name}`,
    checked: isAlias(current) && current.alias === o.id,
    action: () => change(() => setAlias(variable, mode, o.id)),
  }));
  if (isAlias(current)) {
    items.push('-', { label: 'Detach alias', action: () => change(() => {
      variable.valuesByMode[mode] = previewValue(current.alias) ?? (variable.type === 'color' ? '#000000' : variable.type === 'number' ? 0 : variable.type === 'boolean' ? true : '');
    }) });
  }
  if (!items.length) items.push({ label: `No other ${VAR_TYPES[variable.type].toLowerCase()} variables`, disabled: true });
  showContextMenu(r.left, r.bottom + 4, items);
}
