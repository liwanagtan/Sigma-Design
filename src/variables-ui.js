// The design token editor: collections on the left, a table of tokens × modes on the right.
// Extended collections show their parent's tokens; inherited values are greyed, overrides are highlighted.
// It opens as a modal for a design file's local tokens, or fills the screen for a token file.
import { state, commit, emit, subscribe, walk } from './store.js';
import {
  collections, VAR_TYPES, createCollection, deleteCollection, addMode, removeMode, createVariable, deleteVariable,
  setAlias, findVariable, allVariables, previewValue, isAlias, wouldCycle, extendCollection, inheritedVariables,
  rawValueIn, setOverride, setOverrideAlias, clearOverride, parentOf, isExtension, TYPO_FIELDS, splitColor, joinColor,
  defaultValue, localCollections, libraryCollections, inFamily, isLibraryCollection, libraryOf, aliasChain, findByReference,
  groupTree, groupOf, leafOf, inGroup, createGroup, renameGroup, moveGroup, ungroup, deleteGroup, moveTokensToGroup,
} from './variables.js';
import { openTokenPicker, closeTokenPicker, valuePreview, collectionLabel } from './token-picker.js';
import { moveLocalTokensMenu } from './libraries.js';
import { FONTS, WEIGHTS } from './fonts.js';
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
let activeGroup = ''; // group shown in the table ('' = all tokens)
let renamingGroup = null; // group path being renamed in the sidebar
const collapsedGroups = new Set(); // `${collectionId}:${path}`
let rendering = false;

const TYPE_ICON = {
  color: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"/></svg>',
  number: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M4.5 1.5l-1 9M8.5 1.5l-1 9M2 4.5h8.5M1.5 7.5H10"/></svg>',
  string: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2 3V2h8v1M6 2v8M4.5 10h3"/></svg>',
  boolean: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1" y="3.5" width="10" height="5" rx="2.5"/><circle cx="8.5" cy="6" r="1.5" fill="currentColor"/></svg>',
  typography: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M1.5 10L4.5 2l3 8M2.6 7.2h3.8M8.5 6.5h2.5M9.75 6.5V10"/></svg>',
};
const FIELD_LABELS = { fontFamily: 'Family', fontWeight: 'Weight', fontSize: 'Size', lineHeight: 'Line height', letterSpacing: 'Letter spacing' };
const LINK_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M5 7l2-2M5.5 3.5l.8-.8a2 2 0 0 1 2.8 2.8l-.8.8M6.5 8.5l-.8.8a2 2 0 0 1-2.8-2.8l.8-.8"/></svg>';
const LIB_ICON = '<svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 1.2l5 2.9v5.8L7 12.8 2 9.9V4.1z"/></svg>';
const RESET_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2.5 6a3.5 3.5 0 1 0 1-2.5M2.5 1.5v2h2"/></svg>';

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
  closeTokenPicker();
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
  closeTokenPicker();
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

// This file's own collections are edited here. Collections of linked token files can be browsed (read-only);
// they're edited in their own file.
function active() {
  const cols = localCollections();
  return cols.find((c) => c.id === activeId) || libraryCollections().find((c) => c.id === activeId) || cols[0] || null;
}
const readOnly = (c) => isLibraryCollection(c);
const editableGroups = (c) => !!c && !readOnly(c) && !isExtension(c);

// Collections in tree order: each root followed by its extensions (indented).
function collectionTree() {
  const cols = localCollections();
  const out = [];
  const add = (c, depth) => {
    out.push({ c, depth });
    for (const ext of cols.filter((x) => x.extends === c.id)) add(ext, depth + 1);
  };
  for (const c of cols.filter((x) => !x.extends || !cols.some((p) => p.id === x.extends))) add(c, 0);
  return out;
}

// A typography value with alias fields resolved (default modes), for previews.
function typoPreview(raw) {
  const base = isAlias(raw) ? previewValue(raw.alias) : raw;
  const out = { ...defaultValue('typography'), ...(base || {}) };
  for (const f of Object.keys(TYPO_FIELDS)) if (isAlias(out[f])) out[f] = previewValue(out[f].alias);
  return out;
}

const typoStyle = (t) => `font-family:'${esc(t.fontFamily)}',system-ui;font-weight:${Number(t.fontWeight) || 400};` +
  `letter-spacing:${Number(t.letterSpacing) || 0}px`;
const typoSummary = (t) => `${t.fontFamily} · ${t.fontWeight} · ${t.fontSize}${t.lineHeight ? `/${t.lineHeight}%` : ''}`;

function valueEditor(type, raw, data, v) {
  if (type === 'color') {
    const { hex, alpha } = splitColor(raw);
    return `<label class="swatch" style="--c:${esc(raw)}"><input type="color" ${data} data-cell="color" value="${hex.toLowerCase()}"></label>` +
      `<input class="cell-input hex" ${data} data-cell="hex" value="${hex.slice(1)}" spellcheck="false">` +
      `<span class="alpha-wrap" title="Opacity"><input class="cell-input alpha" ${data} data-cell="alpha" value="${Math.round(alpha * 100)}" spellcheck="false">%</span>`;
  }
  if (type === 'typography') {
    const t = typoPreview(raw);
    return `<button class="typo-cell" data-row-select="${v.id}" title="Edit in the inspector">` +
      `<span class="typo-sample" style="${typoStyle(t)}">Ag</span><span class="typo-meta">${esc(typoSummary(t))}</span></button>`;
  }
  if (type === 'number') return `<input class="cell-input" ${data} data-cell="number" value="${esc(raw)}" spellcheck="false">`;
  if (type === 'string') return `<input class="cell-input" ${data} data-cell="string" value="${esc(raw)}" spellcheck="false">`;
  return `<label class="cell-bool"><input type="checkbox" ${data} data-cell="boolean" ${raw ? 'checked' : ''}> ${raw ? 'True' : 'False'}</label>`;
}

// A reference to another token: its name, the file it's from, and the value it resolves to here.
function refChip(col, mode, v, raw, attrs) {
  const target = findVariable(raw.alias);
  const lib = target && isLibraryCollection(target.collection) ? libraryOf(target.collection) : null;
  const { steps, value } = aliasChain(col, mode.id, v);
  const title = `Points to ${steps.map((st) => (st.missing ? 'a missing token' : st.variable.name)).join(' → ')}`;
  const name = target ? target.variable.name : 'Missing token';
  const group = target ? groupOf(name) : '';
  return `<button class="alias-chip${target ? '' : ' missing'}" ${attrs} title="${esc(title)}${lib ? `\nFrom ${esc(lib.name)}` : ''}"><span class="ref-arrow">→</span>` +
    (lib ? `<span class="ref-lib">${LIB_ICON}</span>` : '') +
    (group ? `<span class="ref-group">${esc(group)}/</span>` : '') + `<span class="ref-leaf">${esc(target ? leafOf(name) : name)}</span>` +
    `<span class="ref-value">${valuePreview(v.type, value)}</span></button>`;
}

function cell(col, v, mode) {
  const ext = isExtension(col);
  const own = ext ? col.overrides?.[v.id]?.[mode.id] : v.valuesByMode[mode.id];
  const overridden = ext && own !== undefined;
  const raw = ext ? rawValueIn(col, mode.id, v) : own;
  const data = `data-var="${v.id}" data-mode="${mode.id}"`;
  if (readOnly(col)) {
    if (isAlias(raw)) return `<div class="var-cell readonly">${refChip(col, mode, v, raw, `data-select-token="${raw.alias}"`)}</div>`;
    return `<div class="var-cell readonly"><span class="static-value">${valuePreview(v.type, v.type === 'typography' ? typoPreview(raw) : raw)}</span></div>`;
  }
  const pickBtn = `<button class="icon-btn cell-alias" ${data} data-pick-token title="Point to another token (or type { in the value)">${LINK_ICON}</button>`;
  const resetBtn = overridden ? `<button class="icon-btn cell-reset" ${data} data-reset-override title="Reset to inherited value">${RESET_ICON}</button>` : '';
  const cls = `var-cell${ext ? (overridden ? ' overridden' : ' inherited') : ''}`;
  if (isAlias(raw)) return `<div class="${cls}">${refChip(col, mode, v, raw, `${data} data-pick-token`)}${resetBtn}</div>`;
  return `<div class="${cls}">${valueEditor(v.type, raw, data, v)}${pickBtn}${resetBtn}</div>`;
}

// Tokens (in any collection) whose values alias `id`, with the collection they're in.
function aliasedBy(id) {
  const out = [];
  for (const c of collections()) {
    const refers = (x) => (isAlias(x) && x.alias === id) ||
      (x && typeof x === 'object' && Object.keys(TYPO_FIELDS).some((f) => isAlias(x[f]) && x[f].alias === id));
    for (const v of c.variables || []) {
      if (Object.values(v.valuesByMode).some(refers)) out.push({ variable: v, collection: c });
    }
    for (const [vid, byMode] of Object.entries(c.overrides || {})) {
      if (Object.values(byMode).some(refers)) {
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

// The typography editor for one mode: each field is a value or an alias to a number/string token.
function typographyEditor(col, v, mode) {
  const raw = isExtension(col) ? rawValueIn(col, mode.id, v) : v.valuesByMode[mode.id];
  if (isAlias(raw)) {
    return `<div class="typo-mode"><div class="typo-mode-name">${esc(mode.name)}</div>` +
      `<button class="link-chip" data-select-token="${raw.alias}">→ ${esc(findVariable(raw.alias)?.variable.name || 'Missing token')}</button></div>`;
  }
  const value = { ...defaultValue('typography'), ...(raw || {}) };
  const data = (f) => `data-var="${v.id}" data-mode="${mode.id}" data-typo-field="${f}"`;
  const field = (f) => {
    const x = value[f];
    const alias = `<button class="icon-btn cell-alias always" ${data(f)} data-typo-alias title="Use a ${TYPO_FIELDS[f]} token">${LINK_ICON}</button>`;
    let control;
    if (isAlias(x)) {
      const target = findVariable(x.alias);
      control = `<button class="alias-chip" ${data(f)} data-typo-alias><span class="ref-arrow">→</span><span class="ref-name">${esc(target?.variable.name || 'Missing token')}</span>` +
        `<span class="ref-value">${valuePreview(TYPO_FIELDS[f], previewValue(x.alias))}</span></button>`;
    } else if (f === 'fontFamily') {
      const fonts = FONTS.includes(x) ? FONTS : [x, ...FONTS];
      control = `<select class="select" ${data(f)}>${fonts.map((n) => `<option ${n === x ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    } else if (f === 'fontWeight') {
      control = `<select class="select" ${data(f)}>${WEIGHTS.map(([w, l]) => `<option value="${w}" ${w === Number(x) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    } else {
      const shown = f === 'lineHeight' && (x === null || x === undefined) ? 'Auto' : x;
      control = `<input class="cell-input boxed" ${data(f)} value="${esc(shown)}" spellcheck="false" title="Type { to point to a token">`;
    }
    return `<label class="typo-field"><span class="muted">${FIELD_LABELS[f]}</span>${control}${isAlias(x) ? '' : alias}</label>`;
  };
  const t = typoPreview(raw);
  return `<div class="typo-mode">${col.modes.length > 1 ? `<div class="typo-mode-name">${esc(mode.name)}</div>` : ''}` +
    `<div class="typo-sample-line" style="${typoStyle(t)};font-size:${Math.min(Number(t.fontSize) || 16, 40)}px;line-height:${t.lineHeight ? t.lineHeight + '%' : 'normal'}">The quick brown fox</div>` +
    Object.keys(TYPO_FIELDS).map(field).join('') + '</div>';
}

function inspector(col) {
  const hit = selectedId ? findVariable(selectedId) : null;
  if (!hit) {
    return '<aside class="vars-inspector"><div class="muted inspector-empty">Select a token to see its description, aliases and where it\'s used.</div></aside>';
  }
  const { variable: v, collection: home } = hit;
  if (!inFamily(col, home)) col = home; // selected elsewhere: show its values where it lives
  const ext = isExtension(col);
  const ro = readOnly(col) || readOnly(home);
  // Each mode's value, following references to the value it finally resolves to.
  const chainRow = (m) => {
    const { steps, value } = aliasChain(col, m.id, v);
    const parts = steps.map((st) => (st.missing ? '<span class="muted">Missing token</span>'
      : `<button class="link-chip" data-select-token="${st.id}" title="${esc(collectionLabel(st.collection))}">${esc(st.variable.name)}` +
        `${isLibraryCollection(st.collection) ? `<span class="lib-tag">${esc(libraryOf(st.collection)?.name || 'Library')}</span>` : ''}</button>`));
    parts.push(`<span class="inspector-value">${valuePreview(v.type, value)}</span>`);
    return `<div class="inspector-row"><span class="muted">${esc(m.name)}</span><span class="chain">${parts.join('<span class="chain-arrow">→</span>')}</span></div>`;
  };
  const modeRows = v.type === 'typography' && !ro ? col.modes.map((m) => typographyEditor(col, v, m)).join('') : col.modes.map(chainRow).join('');
  const users = aliasedBy(v.id);
  const uses = state.doc?.pages?.length ? layerUses(v.id) : null;
  return `<aside class="vars-inspector">
    <div class="inspector-head"><span class="var-type">${TYPE_ICON[v.type]}</span><span class="inspector-name">${esc(v.name)}</span></div>
    <div class="muted">${VAR_TYPES[v.type]} · ${esc(collectionLabel(home))}</div>
    <label class="inspector-label">Description</label>
    <textarea class="desc inspector-desc" data-token-desc="${v.id}" rows="3" placeholder="${ro ? 'No description' : 'What is this token for?'}" spellcheck="false" ${ext || ro ? `disabled title="${ro ? 'Edit it in its token file' : 'Edit descriptions in the root collection'}"` : ''}>${esc(v.description || '')}</textarea>
    <label class="inspector-label">Values in ${esc(col.name)}</label>
    ${modeRows}
    <label class="inspector-label">Referenced by</label>
    ${users.length ? users.map(({ variable: u, collection: c }) => `<button class="link-chip" data-select-token="${u.id}" title="${esc(c.name)}">${esc(u.name)}</button>`).join('') : '<div class="muted">No other tokens alias this one.</div>'}
    ${uses === null ? '' : `<label class="inspector-label">Used in this file</label><div class="muted">${uses ? `${uses} layer${uses === 1 ? '' : 's'}` : 'Not used by any layer yet.'}</div>`}
    ${ext || ro ? '' : `<button class="btn wide danger" data-delete-var="${v.id}">Delete token</button>`}
  </aside>`;
}

// The group tree under the active collection in the sidebar.
function groupRows(col) {
  const editable = editableGroups(col);
  const rows = [];
  const visit = (nodes, depth) => {
    for (const g of nodes) {
      const open = !collapsedGroups.has(`${col.id}:${g.path}`);
      const caret = g.children.length
        ? `<button class="group-caret${open ? ' open' : ''}" data-toggle-group="${esc(g.path)}" title="${open ? 'Collapse' : 'Expand'}">▸</button>`
        : '<span class="group-caret"></span>';
      const label = renamingGroup === g.path
        ? `<input class="group-rename" data-rename-group="${esc(g.path)}" value="${esc(g.name)}" spellcheck="false">`
        : `<span class="group-name">${esc(g.name)}</span>`;
      rows.push(`<div class="vars-group-item${g.path === activeGroup ? ' active' : ''}" data-group="${esc(g.path)}" style="padding-left:${16 + depth * 12}px"${editable ? ' draggable="true"' : ''}>` +
        `${caret}${label}<span class="muted group-count">${g.count}</span>` +
        (editable ? `<button class="icon-btn group-more" data-group-menu="${esc(g.path)}" title="Group options">⋯</button>` : '') + '</div>');
      if (open) visit(g.children, depth + 1);
    }
  };
  visit(groupTree(col), 0);
  return `<div class="vars-groups"><div class="vars-group-item${activeGroup === '' ? ' active' : ''}" data-group="" style="padding-left:16px">` +
    '<span class="group-caret"></span><span class="group-name">All tokens</span></div>' + rows.join('') +
    (editable ? `<button class="vars-add sub" data-act="new-group">+ New group${activeGroup ? ` in ${esc(leafOf(activeGroup))}` : ''}</button>` : '') + '</div>';
}

function colButton(c, col, depth, label = c.name) {
  const count = isExtension(c) ? Object.keys(c.overrides || {}).length : (c.variables || []).length;
  return `<button class="vars-col${c === col ? ' active' : ''}" data-col="${c.id}" style="padding-left:${10 + depth * 14}px">` +
    `<span class="vars-col-label">${depth ? '↳ ' : ''}${esc(label)}</span>` +
    `<span class="muted" title="${isExtension(c) ? 'Overridden tokens' : 'Tokens'}">${count}</span></button>` + (c === col ? groupRows(c) : '');
}

function render() {
  if (!modal) return;
  if (rendering) return void queueMicrotask(render); // a blur during the HTML swap changed something: render after
  // Keep the search box focused (with its caret) across re-renders.
  const searching = document.activeElement?.hasAttribute?.('data-search');
  const caret = searching ? document.activeElement.selectionStart : 0;
  const col = active();
  if (col && activeGroup && !inGroupTree(col, activeGroup)) activeGroup = '';
  const libCols = libraryCollections();
  const sidebar = collectionTree().map(({ c, depth }) => colButton(c, col, depth)).join('') +
    '<button class="vars-add" data-act="new-collection">+ New collection</button>' +
    (libCols.length ? '<div class="vars-side-head" title="Tokens from linked token files. Edit them in their own file.">Linked libraries</div>' +
      libCols.map((c) => colButton(c, col, 0, collectionLabel(c))).join('') : '');
  let main;
  if (!col) {
    main = '<div class="vars-empty"><div class="home-empty-title">No design tokens yet</div><p>Design tokens store reusable colors, numbers, text and booleans. Create a collection to start.</p><button class="btn primary" data-act="new-collection">Create collection</button></div>';
  } else {
    const ext = isExtension(col);
    const ro = readOnly(col);
    const all = ext ? inheritedVariables(col) : col.variables;
    // Search looks through every group; otherwise the table shows the selected group.
    const scope = query.trim() ? '' : activeGroup;
    const vars = all.filter(matches).filter((v) => inGroup(v.name, scope));
    const gridCols = `minmax(200px, 1.3fr) repeat(${col.modes.length}, minmax(170px, 1fr)) 40px`;
    const head = `<div class="vars-row vars-head" style="grid-template-columns:${gridCols}"><div>Name</div>` +
      col.modes.map((m) => `<div class="mode-head">${ro ? `<span>${esc(m.name)}</span>` : `<input class="mode-name" data-mode-name="${m.id}" value="${esc(m.name)}" spellcheck="false">`}` +
        (!ext && !ro && col.modes.length > 1 ? `<button class="icon-btn" data-remove-mode="${m.id}" title="Delete mode">${icons.close}</button>` : '') + '</div>').join('') +
      `<div>${ext || ro ? '' : `<button class="icon-btn" data-act="add-mode" title="Add mode">${icons.plus}</button>`}</div></div>`;
    // Rows under a header for each group (relative to the selected group).
    const groups = new Map();
    for (const v of vars) {
      const g = groupOf(v.name);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(v);
    }
    const editable = editableGroups(col);
    const body = [...groups].map(([g, list]) => {
      const rel = scope && g.startsWith(`${scope}/`) ? g.slice(scope.length + 1) : g === scope ? '' : g;
      return (rel ? `<div class="vars-group" data-group-head="${esc(g)}" title="Show only this group">${esc(rel).replace(/\//g, ' <span class="muted">/</span> ')}</div>` : '') +
      list.map((v) => `<div class="vars-row${v.id === selectedId ? ' selected' : ''}" data-row="${v.id}" style="grid-template-columns:${gridCols}">` +
        `<div class="var-name"><span class="var-type${editable ? ' drag-handle' : ''}" title="${VAR_TYPES[v.type]}${editable ? ' · drag to a group' : ''}"${editable ? ` draggable="true" data-drag-token="${v.id}"` : ''}>${TYPE_ICON[v.type]}</span>` +
        (ext || ro ? `<span class="var-name-text" title="${esc(v.name)}">${esc(leafOf(v.name))}</span>`
          : `<input data-var-name="${v.id}" value="${esc(leafOf(v.name))}" spellcheck="false" title="${esc(v.name)} · a / makes a subgroup, a leading / a path from the top">`) +
        (v.description ? `<span class="desc-dot" title="${esc(v.description)}"></span>` : '') + '</div>' +
        col.modes.map((m) => cell(col, v, m)).join('') +
        `<div>${ext || ro ? '' : `<button class="icon-btn" data-delete-var="${v.id}" title="Delete token">${icons.close}</button>`}</div></div>`).join('');
    }).join('');
    const parent = parentOf(col);
    const lib = ro ? libraryOf(col) : null;
    const empty = all.length
      ? `<div class="muted vars-none">${scope && !query.trim() ? 'No tokens in this group yet.' : 'No tokens match the search or filter.'}</div>`
      : '<div class="muted vars-none">No tokens in this collection yet.</div>';
    main = `<div class="vars-toolbar"><div class="vars-title">` +
      (ro ? `<span class="vars-col-name static">${esc(col.name)}</span><span class="ext-badge lib" title="Edit these tokens in their token file">${esc(lib?.name || 'Library')}${lib?.via ? ` · via ${esc(lib.via)}` : ''} · v${lib?.version ?? '?'} · read-only</span>`
        : `<input class="vars-col-name" data-col-name="${col.id}" value="${esc(col.name)}" spellcheck="false">`) +
      (ext ? `<span class="ext-badge" title="Inherits tokens and modes from ${esc(parent ? collectionLabel(parent) : 'a missing collection')}">Extends ${esc(parent ? collectionLabel(parent) : '?')}</span>` : '') + '</div>' +
      `<div class="vars-actions"><input type="search" class="vars-search" data-search placeholder="Search tokens" value="${esc(query)}" spellcheck="false">` +
      `<select class="select" data-type-filter title="Filter by type"><option value="">All types</option>${Object.entries(VAR_TYPES).map(([t, l]) => `<option value="${t}" ${t === typeFilter ? 'selected' : ''}>${l}</option>`).join('')}</select>` +
      `<button class="btn" data-act="extend" title="Create a collection that inherits this one and overrides only some values">Extend</button>` +
      (ro ? (lib ? `<button class="btn" data-act="open-library" data-file="${lib.fileId}">Open token file</button>` : '') : '<button class="btn" data-act="delete-collection">Delete</button>') + '</div></div>' +
      (ext ? '<div class="vars-hint">Greyed values are inherited. Edit a value to override it for this collection; ↺ resets it. Add tokens and modes in the root collection.</div>' : '') +
      `<div class="vars-work"><div class="vars-table">${head}${body || empty}</div>${inspector(col)}</div>` +
      (ext || ro ? '' : `<div class="vars-footer"><button class="btn" data-act="new-variable">+ Create token${scope ? ` in ${esc(leafOf(scope))}` : ''}</button></div>`);
  }
  rendering = true; // replacing the HTML blurs a focused field; that's not the user finishing an edit
  modal.querySelector('.vars-modal').innerHTML =
    (inline ? '' : `<div class="modal-head">Local design tokens<span class="head-actions">` +
      (localCollections().length ? '<button class="btn" data-act="move-to-file" title="Move these tokens into a token file and link it">Move to token file…</button>' : '') +
      `<button class="icon-btn" data-close>${icons.close}</button></span></div>`) +
    `<div class="vars-body"><aside class="vars-side">${sidebar}</aside>` +
    `<section class="vars-main">${main}</section></div>`;
  rendering = false;
  if (searching) {
    const box = modal.querySelector('[data-search]');
    box?.focus();
    box?.setSelectionRange(caret, caret);
  }
  const rename = modal.querySelector('[data-rename-group]');
  if (rename) {
    rename.focus();
    rename.select();
  }
}

const inGroupTree = (col, path) => {
  const find = (nodes) => nodes.some((g) => g.path === path || find(g.children));
  return find(groupTree(col));
};

// The raw value shown in a cell (an extension shows its override or the inherited value).
function cellRaw(col, varId, modeId) {
  const v = findVariable(varId)?.variable;
  if (!v) return undefined;
  return isExtension(col) ? rawValueIn(col, modeId, v) : v.valuesByMode[modeId];
}

// Change one field of a typography token for a mode (writing an override in an extension).
function writeTypoField(col, varId, modeId, field, value) {
  let base = cellRaw(col, varId, modeId);
  base = isAlias(base) ? { ...defaultValue('typography'), ...(previewValue(base.alias) || {}) } : { ...defaultValue('typography'), ...(base || {}) };
  base[field] = value;
  writeCell(col, varId, modeId, base);
}

function typoAliasPicker(btn, col, query = '') {
  const { var: varId, mode, typoField: field } = btn.dataset;
  const current = cellRaw(col, varId, mode)?.[field];
  const cellEl = btn.closest('.typo-field') || btn;
  openTokenPicker({
    anchor: cellEl.getBoundingClientRect(), type: TYPO_FIELDS[field], query,
    currentId: isAlias(current) ? current.alias : null,
    onPick: (id) => change(() => writeTypoField(col, varId, mode, field, { alias: id })),
    onDetach: () => change(() => writeTypoField(col, varId, mode, field, previewValue(current.alias) ?? null)),
  });
}

// Point a cell at another token (refusing loops and other types).
function setReference(col, varId, modeId, targetId) {
  const v = findVariable(varId)?.variable;
  if (!v) return;
  const ok = isExtension(col) ? setOverrideAlias(col, varId, modeId, targetId) : setAlias(v, modeId, targetId);
  if (!ok) toast('That token can’t be used here: it’s a different type, or it would point back to this one.');
}

function tokenPicker(cellEl, col, varId, modeId, query = '') {
  const v = findVariable(varId)?.variable;
  if (!v) return;
  const current = cellRaw(col, varId, modeId);
  openTokenPicker({
    anchor: cellEl.getBoundingClientRect(), type: v.type, query,
    exclude: (id) => id === varId || wouldCycle(varId, id),
    currentId: isAlias(current) ? current.alias : null,
    onPick: (id) => change(() => setReference(col, varId, modeId, id)),
    onDetach: () => change(() => writeCell(col, varId, modeId, aliasChain(col, modeId, v).value ?? defaultValue(v.type))),
  });
}

const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));

// Group options (⋯ in the sidebar).
function groupMenu(btn, col, path) {
  const r = btn.getBoundingClientRect();
  const count = col.variables.filter((v) => inGroup(v.name, path)).length;
  showContextMenu(r.left, r.bottom + 4, [
    { label: 'New group inside', action: () => change(() => { renamingGroup = createGroup(col, path); activeGroup = renamingGroup; collapsedGroups.delete(`${col.id}:${path}`); }) },
    { label: 'Rename', action: () => { renamingGroup = path; render(); } },
    { label: 'Ungroup', action: () => change(() => { ungroup(col, path); activeGroup = groupOf(path); }) },
    '-',
    { label: count ? `Delete group and ${count} token${count === 1 ? '' : 's'}` : 'Delete group', action: () => {
      if (count && !confirm(`Delete “${path}” and its ${count} token${count === 1 ? '' : 's'}? Layers and tokens that use them keep their current values.`)) return;
      change(() => { deleteGroup(col, path); activeGroup = groupOf(path); });
    } },
  ]);
}

// Move a token to a group (right-click a row).
function moveToGroupMenu(x, y, col, varId) {
  const v = findVariable(varId)?.variable;
  const paths = [];
  const walkTree = (nodes, depth) => nodes.forEach((g) => { paths.push([g.path, depth]); walkTree(g.children, depth + 1); });
  walkTree(groupTree(col), 0);
  showContextMenu(x, y, [
    { label: 'Top level', checked: v && !groupOf(v.name), action: () => change(() => moveTokensToGroup(col, [varId], '')) },
    ...paths.map(([path, depth]) => ({
      label: `${'   '.repeat(depth)}${leafOf(path)}`, checked: v && groupOf(v.name) === path,
      action: () => change(() => moveTokensToGroup(col, [varId], path)),
    })),
  ]);
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
    // Groups: select one in the sidebar or by its header in the table.
    const groupEl = !e.target.closest('button, input') && e.target.closest('[data-group], [data-group-head]');
    if (groupEl) {
      activeGroup = groupEl.dataset.group ?? groupEl.dataset.groupHead;
      query = '';
      return render();
    }
    const row = e.target.closest('[data-row]');
    if (row && !e.target.closest('button, input, label')) {
      selectedId = row.dataset.row;
      return render();
    }
    const t = e.target.closest('button');
    if (!t) return;
    const col = active();
    if (t.dataset.rowSelect) {
      selectedId = t.dataset.rowSelect;
      return render();
    }
    if (t.hasAttribute('data-typo-alias')) return typoAliasPicker(t, col);
    if (t.hasAttribute('data-pick-token')) return tokenPicker(t.closest('.var-cell') || t, col, t.dataset.var, t.dataset.mode);
    if (t.dataset.toggleGroup !== undefined) {
      const key = `${col.id}:${t.dataset.toggleGroup}`;
      collapsedGroups.has(key) ? collapsedGroups.delete(key) : collapsedGroups.add(key);
      return render();
    }
    if (t.dataset.groupMenu !== undefined) return groupMenu(t, col, t.dataset.groupMenu);
    if (t.dataset.selectToken) {
      // Jump to a token, switching to its collection (maybe a linked library's) if it lives elsewhere.
      const hit = findVariable(t.dataset.selectToken);
      if (hit && !inFamily(col, hit.collection)) activeId = hit.collection.id;
      activeGroup = '';
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
    switch (t.dataset.act) {
      case 'new-group':
        return change(() => {
          renamingGroup = createGroup(col, activeGroup);
          collapsedGroups.delete(`${col.id}:${activeGroup}`);
        });
      case 'open-library':
        return window.open(`#/file/${t.dataset.file}`, '_blank');
      case 'move-to-file': {
        const r = t.getBoundingClientRect(); // read before the modal (and the button) goes away
        close();
        return moveLocalTokensMenu({ getBoundingClientRect: () => r });
      }
      case 'new-collection':
        return change(() => void (activeId = createCollection().id));
      case 'extend':
        return change(() => void (activeId = extendCollection(col).id));
      case 'delete-collection': {
        if (readOnly(col)) return;
        const exts = collections().filter((c) => c.extends === col.id).length;
        const what = isExtension(col) ? 'its overrides' : `its ${col.variables.length} tokens${exts ? ` and ${exts} extended collection${exts === 1 ? '' : 's'}` : ''}`;
        if (col && confirm(`Delete “${col.name}” and ${what}? Bound layers keep their current values.`)) change(() => deleteCollection(col));
        return;
      }
      case 'add-mode':
        return change(() => addMode(col));
      case 'new-variable': {
        const r = t.getBoundingClientRect();
        const scope = query.trim() ? '' : activeGroup;
        return showContextMenu(r.left, r.top - 120, Object.entries(VAR_TYPES).map(([type, label]) => ({
          label, action: () => change(() => void (selectedId = createVariable(col, type, scope ? `${scope}/${type}` : undefined).id)),
        })));
      }
    }
  });
  modal.addEventListener('focusout', (e) => {
    if (!rendering && e.target.dataset?.renameGroup !== undefined) finishGroupRename(e.target);
  });
  modal.addEventListener('contextmenu', (e) => {
    const col = active();
    const row = e.target.closest('[data-row]');
    const group = e.target.closest('[data-group]');
    if (group?.dataset.group && editableGroups(col)) {
      e.preventDefault();
      return groupMenu({ getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) }, col, group.dataset.group);
    }
    if (!row || e.target.closest('input')) return;
    e.preventDefault();
    const v = findVariable(row.dataset.row)?.variable;
    if (!v) return;
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Copy reference', shortcut: `{${v.name}}`.length > 28 ? '' : `{${v.name}}`, action: () => navigator.clipboard?.writeText(`{${v.name}}`) },
      ...(editableGroups(col) ? [
        { label: 'Move to group…', action: () => moveToGroupMenu(e.clientX, e.clientY, col, v.id) },
        '-',
        { label: 'Delete token', action: () => change(() => deleteVariable(v.id)) },
      ] : []),
    ]);
  });
  // Drag tokens (by their type icon) and groups onto groups in the sidebar or table.
  let dragging = null;
  modal.addEventListener('dragstart', (e) => {
    const token = e.target.closest?.('[data-drag-token]');
    const group = e.target.closest?.('[data-group][draggable]');
    if (token) dragging = { token: token.dataset.dragToken };
    else if (group) dragging = { group: group.dataset.group };
    else return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragging.token ? `{${findVariable(dragging.token)?.variable.name}}` : dragging.group);
  });
  const dropTarget = (e) => (dragging ? e.target.closest?.('[data-group], [data-group-head]') : null);
  modal.addEventListener('dragover', (e) => {
    const target = dropTarget(e);
    modal.querySelectorAll('.drop-into').forEach((x) => x !== target && x.classList.remove('drop-into'));
    if (!target) return;
    e.preventDefault();
    target.classList.add('drop-into');
  });
  modal.addEventListener('dragend', () => {
    dragging = null;
    modal.querySelectorAll('.drop-into').forEach((x) => x.classList.remove('drop-into'));
  });
  modal.addEventListener('drop', (e) => {
    const target = dropTarget(e);
    if (!target) return;
    e.preventDefault();
    const into = target.dataset.group ?? target.dataset.groupHead;
    const col = active();
    const what = dragging;
    dragging = null;
    if (what.token) change(() => moveTokensToGroup(col, [what.token], into));
    else if (what.group !== into) change(() => { activeGroup = moveGroup(col, what.group, into); });
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
    if (t.dataset.renameGroup !== undefined) return finishGroupRename(t);
    if (t.dataset.varName) return change(() => {
      // The name is relative to the token's group: "a/b" makes a subgroup; a leading "/" starts from the top.
      const v = findVariable(t.dataset.varName)?.variable;
      const typed = t.value.trim().replace(/\s*\/\s*/g, '/');
      if (!v || !typed.replace(/\//g, '')) return;
      const group = groupOf(v.name);
      v.name = (typed.startsWith('/') || !group ? typed : `${group}/${typed}`).replace(/^\/+|\/+$/g, '');
    });
    if (t.dataset.typoField) {
      const f = t.dataset.typoField;
      let value = t.value.trim();
      if (/^\{.+\}$/.test(value)) {
        // A pasted reference: "{font/size/body}".
        const hit = findByReference(value, TYPO_FIELDS[f]);
        if (!hit) return toast(`No ${VAR_TYPES[TYPO_FIELDS[f]].toLowerCase()} token named ${value}`), render();
        return change(() => writeTypoField(col, t.dataset.var, t.dataset.mode, f, { alias: hit.variable.id }));
      }
      if (f === 'lineHeight' && /^(auto)?$/i.test(value)) value = null;
      else if (f !== 'fontFamily') {
        value = Number(value);
        if (!Number.isFinite(value)) return render();
      }
      return change(() => writeTypoField(col, t.dataset.var, t.dataset.mode, f, value));
    }
    if (t.dataset.cell) {
      if (/^\s*\{.+\}\s*$/.test(t.value)) {
        // A pasted reference: "{color/brand/primary}" or "{color.brand.primary}".
        const v = findVariable(t.dataset.var)?.variable;
        const hit = v && findByReference(t.value, v.type);
        if (!hit) return toast(`No ${VAR_TYPES[v?.type || 'string'].toLowerCase()} token named ${t.value.trim()}`), render();
        return change(() => setReference(col, t.dataset.var, t.dataset.mode, hit.variable.id));
      }
      let value;
      // Colors keep their opacity when the hex or picker changes, and vice versa.
      const current = splitColor(cellRaw(col, t.dataset.var, t.dataset.mode));
      if (t.dataset.cell === 'color') value = joinColor(t.value, current.alpha);
      else if (t.dataset.cell === 'alpha') {
        const pct = Number(t.value.replace('%', ''));
        if (!Number.isFinite(pct)) return render();
        value = joinColor(current.hex, pct / 100);
      } else if (t.dataset.cell === 'hex') {
        const h = t.value.trim().replace(/^#/, '');
        const full = /^[0-9a-f]{3}$/i.test(h) ? h.split('').map((c) => c + c).join('') : h;
        if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(full)) return render();
        value = full.length === 8 ? `#${full.toUpperCase()}` : joinColor(`#${full}`, current.alpha);
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
    // Typing "{" in a value starts pointing it at another token.
    const typed = t.value;
    if (typeof typed === 'string' && typed.includes('{') && !/\}\s*$/.test(typed) && (t.dataset.cell || t.dataset.typoField)) {
      const q = typed.slice(typed.lastIndexOf('{') + 1);
      t.value = t.defaultValue; // nothing is written unless a token is picked
      const col = active();
      if (t.dataset.typoField) return typoAliasPicker(t, col, q);
      return tokenPicker(t.closest('.var-cell') || t, col, t.dataset.var, t.dataset.mode, q);
    }
    // Live color preview while the picker is open; the change event commits one undo step.
    if (t.dataset.cell !== 'color') return;
    const col = active();
    const { alpha } = splitColor(cellRaw(col, t.dataset.var, t.dataset.mode));
    writeCell(col, t.dataset.var, t.dataset.mode, joinColor(t.value, alpha));
    t.parentElement.style.setProperty('--c', t.value);
    emit('doc');
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && e.target.dataset?.renameGroup !== undefined) {
      renamingGroup = null;
      e.stopPropagation();
      return render();
    }
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

function finishGroupRename(input) {
  const path = input.dataset.renameGroup;
  if (renamingGroup !== path) return;
  renamingGroup = null;
  const name = input.value.trim().replace(/\//g, '-');
  const col = active();
  if (!name || name === leafOf(path) || !col) return render();
  change(() => {
    const next = renameGroup(col, path, groupOf(path) ? `${groupOf(path)}/${name}` : name);
    if (activeGroup === path || inGroup(activeGroup, path)) activeGroup = next + activeGroup.slice(path.length);
  });
}
