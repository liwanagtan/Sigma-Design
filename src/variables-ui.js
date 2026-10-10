// The design token editor: collections on the left, a table of tokens × modes on the right.
// Extended collections show their parent's tokens; inherited values are greyed, overrides are highlighted.
// It opens as a modal for a design file's local tokens, or fills the screen for a token file.
import { state, commit, emit, subscribe, walk } from './store.js';
import {
  collections, VAR_TYPES, createCollection, deleteCollection, addMode, removeMode, createVariable, deleteVariable,
  setAlias, findVariable, allVariables, previewValue, isAlias, wouldCycle, extendCollection, inheritedVariables,
  rawValueIn, setOverride, setOverrideAlias, clearOverride, parentOf, isExtension,
} from './variables.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let modal = null; // the element the editor renders into (modal backdrop, or the token file screen)
let inline = false;
const bound = new WeakSet();
let activeId = null;
let selectedId = null; // token shown in the inspector
let query = '';
let typeFilter = '';

const TYPE_ICON = {
  color: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"/></svg>',
  number: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M4.5 1.5l-1 9M8.5 1.5l-1 9M2 4.5h8.5M1.5 7.5H10"/></svg>',
  string: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2 3V2h8v1M6 2v8M4.5 10h3"/></svg>',
  boolean: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1" y="3.5" width="10" height="5" rx="2.5"/><circle cx="8.5" cy="6" r="1.5" fill="currentColor"/></svg>',
};
const LINK_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M5 7l2-2M5.5 3.5l.8-.8a2 2 0 0 1 2.8 2.8l-.8.8M6.5 8.5l-.8.8a2 2 0 0 1-2.8-2.8l.8-.8"/></svg>';
const RESET_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2.5 6a3.5 3.5 0 1 0 1-2.5M2.5 1.5v2h2"/></svg>';
const DEFAULTS = { color: '#000000', number: 0, string: '', boolean: true };

// Fill `host` with the editor (token files). Stays until unmountTokenEditor().
export function mountTokenEditor(host) {
  close();
  modal = host;
  inline = true;
  host.innerHTML = '<div class="vars-modal inline"></div>';
  if (!bound.has(host)) {
    bind();
    bound.add(host);
  }
  render();
}

export function unmountTokenEditor() {
  if (!inline) return;
  modal.innerHTML = '';
  modal = null;
  inline = false;
}

export function openVariablesEditor(focusCollectionId) {
  if (!state.doc || inline) return;
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
  if (inline) return;
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
  if (!state.doc) return inline ? undefined : close();
  const a = document.activeElement;
  if (modal.contains(a) && ((a.tagName === 'INPUT' && a.type !== 'checkbox') || a.tagName === 'TEXTAREA')) return;
  render();
});

function active() {
  const cols = collections();
  return cols.find((c) => c.id === activeId) || cols[0] || null;
}

// Collections in tree order: each root followed by its extensions (indented).
function collectionTree() {
  const cols = collections();
  const out = [];
  const add = (c, depth) => {
    out.push({ c, depth });
    for (const ext of cols.filter((x) => x.extends === c.id)) add(ext, depth + 1);
  };
  for (const c of cols.filter((x) => !x.extends || !cols.some((p) => p.id === x.extends))) add(c, 0);
  return out;
}

function valueEditor(type, raw, data) {
  if (type === 'color') {
    return `<label class="swatch" style="--c:${esc(raw)}"><input type="color" ${data} data-cell="color" value="${esc(String(raw).slice(0, 7).toLowerCase())}"></label>` +
      `<input class="cell-input hex" ${data} data-cell="hex" value="${esc(String(raw).replace('#', ''))}" spellcheck="false">`;
  }
  if (type === 'number') return `<input class="cell-input" ${data} data-cell="number" value="${esc(raw)}" spellcheck="false">`;
  if (type === 'string') return `<input class="cell-input" ${data} data-cell="string" value="${esc(raw)}" spellcheck="false">`;
  return `<label class="cell-bool"><input type="checkbox" ${data} data-cell="boolean" ${raw ? 'checked' : ''}> ${raw ? 'True' : 'False'}</label>`;
}

function cell(col, v, mode) {
  const ext = isExtension(col);
  const own = ext ? col.overrides?.[v.id]?.[mode.id] : v.valuesByMode[mode.id];
  const overridden = ext && own !== undefined;
  const raw = ext ? rawValueIn(col, mode.id, v) : own;
  const data = `data-var="${v.id}" data-mode="${mode.id}"`;
  const aliasBtn = `<button class="icon-btn cell-alias" ${data} data-alias-menu title="Use another token (alias)">${LINK_ICON}</button>`;
  const resetBtn = overridden ? `<button class="icon-btn cell-reset" ${data} data-reset-override title="Reset to inherited value">${RESET_ICON}</button>` : '';
  const cls = `var-cell${ext ? (overridden ? ' overridden' : ' inherited') : ''}`;
  if (isAlias(raw)) {
    const target = findVariable(raw.alias);
    return `<div class="${cls}"><button class="alias-chip" ${data} data-alias-menu title="Aliased token">→ ${esc(target ? target.variable.name : 'Missing token')}</button>${resetBtn}</div>`;
  }
  return `<div class="${cls}">${valueEditor(v.type, raw, data)}${aliasBtn}${resetBtn}</div>`;
}

// Tokens (in any collection) whose values alias `id`, with the collection they're in.
function aliasedBy(id) {
  const out = [];
  for (const c of collections()) {
    for (const v of c.variables || []) {
      if (Object.values(v.valuesByMode).some((x) => isAlias(x) && x.alias === id)) out.push({ variable: v, collection: c });
    }
    for (const [vid, byMode] of Object.entries(c.overrides || {})) {
      if (Object.values(byMode).some((x) => isAlias(x) && x.alias === id)) {
        const hit = findVariable(vid);
        if (hit) out.push({ variable: hit.variable, collection: c });
      }
    }
  }
  return out;
}

// Layers in this design file bound to `id` (token files have no layers).
function layerUses(id) {
  let n = 0;
  for (const pg of state.doc?.pages || []) walk(pg.children, (x) => {
    if (x.bindings && Object.values(x.bindings).includes(id)) n++;
  });
  return n;
}

function matches(v) {
  if (typeFilter && v.type !== typeFilter) return false;
  const q = query.trim().toLowerCase();
  return !q || v.name.toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q);
}

function inspector(col) {
  const hit = selectedId ? findVariable(selectedId) : null;
  if (!hit) {
    return '<aside class="vars-inspector"><div class="muted inspector-empty">Select a token to see its description, aliases and where it\'s used.</div></aside>';
  }
  const { variable: v, collection: home } = hit;
  const ext = isExtension(col);
  const modeRows = col.modes.map((m) => {
    const raw = ext ? rawValueIn(col, m.id, v) : v.valuesByMode[m.id];
    const value = isAlias(raw)
      ? `<button class="link-chip" data-select-token="${raw.alias}">→ ${esc(findVariable(raw.alias)?.variable.name || 'Missing token')}</button>`
      : `<span class="inspector-value">${v.type === 'color' ? `<span class="mini-swatch" style="--c:${esc(raw)}"></span>` : ''}${esc(String(raw))}</span>`;
    return `<div class="inspector-row"><span class="muted">${esc(m.name)}</span>${value}</div>`;
  }).join('');
  const users = aliasedBy(v.id);
  const uses = state.doc?.pages?.length ? layerUses(v.id) : null;
  return `<aside class="vars-inspector">
    <div class="inspector-head"><span class="var-type">${TYPE_ICON[v.type]}</span><span class="inspector-name">${esc(v.name)}</span></div>
    <div class="muted">${VAR_TYPES[v.type]} · ${esc(home.name)}</div>
    <label class="inspector-label">Description</label>
    <textarea class="desc inspector-desc" data-token-desc="${v.id}" rows="3" placeholder="What is this token for?" spellcheck="false" ${ext ? 'disabled title="Edit descriptions in the root collection"' : ''}>${esc(v.description || '')}</textarea>
    <label class="inspector-label">Values in ${esc(col.name)}</label>
    ${modeRows}
    <label class="inspector-label">Referenced by</label>
    ${users.length ? users.map(({ variable: u, collection: c }) => `<button class="link-chip" data-select-token="${u.id}" title="${esc(c.name)}">${esc(u.name)}</button>`).join('') : '<div class="muted">No other tokens alias this one.</div>'}
    ${uses === null ? '' : `<label class="inspector-label">Used in this file</label><div class="muted">${uses ? `${uses} layer${uses === 1 ? '' : 's'}` : 'Not used by any layer yet.'}</div>`}
    ${ext ? '' : `<button class="btn wide danger" data-delete-var="${v.id}">Delete token</button>`}
  </aside>`;
}

function render() {
  if (!modal) return;
  // Keep the search box focused (with its caret) across re-renders.
  const searching = document.activeElement?.hasAttribute?.('data-search');
  const caret = searching ? document.activeElement.selectionStart : 0;
  const col = active();
  const sidebar = collectionTree().map(({ c, depth }) => {
    const count = isExtension(c) ? Object.keys(c.overrides || {}).length : c.variables.length;
    return `<button class="vars-col${c === col ? ' active' : ''}" data-col="${c.id}" style="padding-left:${10 + depth * 14}px">` +
      `<span class="vars-col-label">${depth ? '↳ ' : ''}${esc(c.name)}</span>` +
      `<span class="muted" title="${isExtension(c) ? 'Overridden tokens' : 'Tokens'}">${count}</span></button>`;
  }).join('');
  let main;
  if (!col) {
    main = '<div class="vars-empty"><div class="home-empty-title">No design tokens yet</div><p>Design tokens store reusable colors, numbers, text and booleans. Create a collection to start.</p><button class="btn primary" data-act="new-collection">Create collection</button></div>';
  } else {
    const ext = isExtension(col);
    const all = ext ? inheritedVariables(col) : col.variables;
    const vars = all.filter(matches);
    const gridCols = `minmax(200px, 1.3fr) repeat(${col.modes.length}, minmax(150px, 1fr)) 40px`;
    const head = `<div class="vars-row vars-head" style="grid-template-columns:${gridCols}"><div>Name</div>` +
      col.modes.map((m) => `<div class="mode-head"><input class="mode-name" data-mode-name="${m.id}" value="${esc(m.name)}" spellcheck="false">` +
        (!ext && col.modes.length > 1 ? `<button class="icon-btn" data-remove-mode="${m.id}" title="Delete mode">${icons.close}</button>` : '') + '</div>').join('') +
      `<div>${ext ? '' : `<button class="icon-btn" data-act="add-mode" title="Add mode">${icons.plus}</button>`}</div></div>`;
    // Group rows by the part of the name before the last "/".
    const groups = new Map();
    for (const v of vars) {
      const i = v.name.lastIndexOf('/');
      const g = i > 0 ? v.name.slice(0, i) : '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(v);
    }
    const body = [...groups].map(([g, list]) =>
      (g ? `<div class="vars-group">${esc(g)}</div>` : '') +
      list.map((v) => `<div class="vars-row${v.id === selectedId ? ' selected' : ''}" data-row="${v.id}" style="grid-template-columns:${gridCols}">` +
        `<div class="var-name"><span class="var-type" title="${VAR_TYPES[v.type]}">${TYPE_ICON[v.type]}</span>` +
        (ext ? `<span class="var-name-text">${esc(v.name)}</span>` : `<input data-var-name="${v.id}" value="${esc(v.name)}" spellcheck="false">`) +
        (v.description ? `<span class="desc-dot" title="${esc(v.description)}"></span>` : '') + '</div>' +
        col.modes.map((m) => cell(col, v, m)).join('') +
        `<div>${ext ? '' : `<button class="icon-btn" data-delete-var="${v.id}" title="Delete token">${icons.close}</button>`}</div></div>`).join('')).join('');
    const parent = parentOf(col);
    const empty = all.length
      ? '<div class="muted vars-none">No tokens match the search or filter.</div>'
      : '<div class="muted vars-none">No tokens in this collection yet.</div>';
    main = `<div class="vars-toolbar"><div class="vars-title"><input class="vars-col-name" data-col-name="${col.id}" value="${esc(col.name)}" spellcheck="false">` +
      (ext ? `<span class="ext-badge" title="Inherits tokens and modes from ${esc(parent?.name || 'a missing collection')}">Extends ${esc(parent?.name || '?')}</span>` : '') + '</div>' +
      `<div class="vars-actions"><input type="search" class="vars-search" data-search placeholder="Search tokens" value="${esc(query)}" spellcheck="false">` +
      `<select class="select" data-type-filter title="Filter by type"><option value="">All types</option>${Object.entries(VAR_TYPES).map(([t, l]) => `<option value="${t}" ${t === typeFilter ? 'selected' : ''}>${l}</option>`).join('')}</select>` +
      `<button class="btn" data-act="extend" title="Create a collection that inherits this one and overrides only some values">Extend</button>` +
      `<button class="btn" data-act="delete-collection">Delete</button></div></div>` +
      (ext ? '<div class="vars-hint">Greyed values are inherited. Edit a value to override it for this collection; ↺ resets it. Add tokens and modes in the root collection.</div>' : '') +
      `<div class="vars-work"><div class="vars-table">${head}${body || empty}</div>${inspector(col)}</div>` +
      (ext ? '' : '<div class="vars-footer"><button class="btn" data-act="new-variable">+ Create token</button></div>');
  }
  modal.querySelector('.vars-modal').innerHTML =
    (inline ? '' : `<div class="modal-head">Local design tokens<button class="icon-btn" data-close>${icons.close}</button></div>`) +
    `<div class="vars-body"><aside class="vars-side">${sidebar}<button class="vars-add" data-act="new-collection">+ New collection</button></aside>` +
    `<section class="vars-main">${main}</section></div>`;
  if (searching) {
    const box = modal.querySelector('[data-search]');
    box?.focus();
    box?.setSelectionRange(caret, caret);
  }
}

// Write a cell: a root collection's own value, or an extension's override.
function writeCell(col, varId, modeId, value) {
  if (isExtension(col)) setOverride(col, varId, modeId, value);
  else {
    const v = findVariable(varId)?.variable;
    if (v) v.valuesByMode[modeId] = value;
  }
}

function bind() {
  modal.addEventListener('click', (e) => {
    if (!inline && (e.target === modal || e.target.closest('[data-close]'))) return close();
    const row = e.target.closest('[data-row]');
    if (row && !e.target.closest('button, input, label')) {
      selectedId = row.dataset.row;
      return render();
    }
    const t = e.target.closest('button');
    if (!t) return;
    const col = active();
    if (t.dataset.selectToken) {
      // Jump to a token, switching to its collection if it lives elsewhere.
      const hit = findVariable(t.dataset.selectToken);
      if (hit && !isExtension(col)) activeId = hit.collection.id;
      selectedId = t.dataset.selectToken;
      query = '';
      typeFilter = '';
      return render();
    }
    if (t.dataset.col) {
      activeId = t.dataset.col;
      return render();
    }
    if (t.dataset.removeMode) return change(() => removeMode(col, t.dataset.removeMode));
    if (t.dataset.deleteVar) return change(() => deleteVariable(t.dataset.deleteVar));
    if (t.hasAttribute('data-reset-override')) return change(() => clearOverride(col, t.dataset.var, t.dataset.mode));
    if (t.hasAttribute('data-alias-menu')) return aliasMenu(t, col);
    switch (t.dataset.act) {
      case 'new-collection':
        return change(() => void (activeId = createCollection().id));
      case 'extend':
        return change(() => void (activeId = extendCollection(col).id));
      case 'delete-collection': {
        const exts = collections().filter((c) => c.extends === col.id).length;
        const what = isExtension(col) ? 'its overrides' : `its ${col.variables.length} tokens${exts ? ` and ${exts} extended collection${exts === 1 ? '' : 's'}` : ''}`;
        if (col && confirm(`Delete “${col.name}” and ${what}? Bound layers keep their current values.`)) change(() => deleteCollection(col));
        return;
      }
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
  modal.addEventListener('focusin', (e) => {
    // Focusing a token's name selects it.
    const id = e.target.dataset?.varName;
    if (id && id !== selectedId) {
      selectedId = id;
      modal.querySelectorAll('.vars-row.selected').forEach((r) => r.classList.remove('selected'));
      e.target.closest('.vars-row')?.classList.add('selected');
      const insp = modal.querySelector('.vars-inspector');
      if (insp) insp.outerHTML = inspector(active());
    }
  });
  modal.addEventListener('change', (e) => {
    const t = e.target;
    const col = active();
    if (t.hasAttribute('data-type-filter')) {
      typeFilter = t.value;
      return render();
    }
    if (t.dataset.tokenDesc) return change(() => {
      const v = findVariable(t.dataset.tokenDesc)?.variable;
      if (v) v.description = t.value.trim() || undefined;
    });
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
      change(() => writeCell(col, t.dataset.var, t.dataset.mode, value));
    }
  });
  modal.addEventListener('input', (e) => {
    const t = e.target;
    if (t.hasAttribute('data-search')) {
      query = t.value;
      return render();
    }
    // Live color preview while the picker is open; the change event commits one undo step.
    if (t.dataset.cell !== 'color') return;
    writeCell(active(), t.dataset.var, t.dataset.mode, t.value.toUpperCase());
    t.parentElement.style.setProperty('--c', t.value);
    emit('doc');
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur();
    // On the token file screen, let ⌘Z / ⇧⌘Z through to the screen's undo (unless typing).
    if (inline && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && e.target.tagName !== 'INPUT') return;
    e.stopPropagation(); // keep canvas shortcuts (Delete, arrows…) from acting on layers behind the modal
  });
}

function change(fn) {
  fn();
  commit();
  render();
}

function aliasMenu(btn, col) {
  const hit = findVariable(btn.dataset.var);
  if (!hit) return;
  const { variable } = hit;
  const mode = btn.dataset.mode;
  const ext = isExtension(col);
  const current = ext ? col.overrides?.[variable.id]?.[mode] : variable.valuesByMode[mode];
  const options = allVariables(variable.type).filter(({ variable: o }) => o.id !== variable.id && !wouldCycle(variable.id, o.id));
  const r = btn.getBoundingClientRect();
  const items = options.map(({ variable: o, collection }) => ({
    label: `${collection.name} / ${o.name}`,
    checked: isAlias(current) && current.alias === o.id,
    action: () => change(() => (ext ? setOverrideAlias(col, variable.id, mode, o.id) : setAlias(variable, mode, o.id))),
  }));
  if (isAlias(current)) {
    items.push('-', { label: 'Detach alias', action: () => change(() => writeCell(col, variable.id, mode, previewValue(current.alias) ?? DEFAULTS[variable.type])) });
  }
  if (!items.length) items.push({ label: `No other ${VAR_TYPES[variable.type].toLowerCase()} tokens`, disabled: true });
  showContextMenu(r.left, r.bottom + 4, items);
}
