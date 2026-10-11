// The design token editor: collections on the left, a table of tokens × modes on the right.
// Extended collections show their parent's tokens; inherited values are greyed, overrides are highlighted.
// It opens as a modal for a design file's local tokens, or fills the screen for a token file.
import { state, commit, emit, subscribe, walk } from './store.js';
import {
  collections, VAR_TYPES, createCollection, deleteCollection, addMode, removeMode, createVariable, deleteVariable,
  setAlias, findVariable, allVariables, previewValue, isAlias, wouldCycle, extendCollection, inheritedVariables,
  rawValueIn, setOverride, setOverrideAlias, clearOverride, parentOf, isExtension, COMPOSITE_FIELDS, ALL_FIELDS, splitColor, joinColor,
  defaultValue, localCollections, libraryCollections, inFamily, isLibraryCollection, libraryOf, aliasChain, findByReference,
  groupTree, groupOf, leafOf, createGroup, renameGroup, moveGroup, ungroup, deleteGroup, moveTokensToGroup, findGroup,
  groupIdOf, groupPathOf, tokenInGroup, tokensInOrder, setTokenName, setGroupDescription, parseEasing, resolveIn,
  addContrastPair, removeContrastPair, setTokenDeprecated,
} from './variables.js';
import { contrastRatio, contrastBadge } from './contrast.js';
import { openTokenPicker, closeTokenPicker, valuePreview, collectionLabel, easingCurve } from './token-picker.js';
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
let activeGroup = null; // id of the group shown in the table (null: the whole collection)
let renamingGroup = null; // id of the group being renamed in the sidebar
const collapsedGroups = new Set(); // group ids
const openCollections = new Map(); // collection id → expanded in the sidebar (default: own collections open)
let rendering = false;

const TYPE_ICON = {
  color: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"/></svg>',
  number: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M4.5 1.5l-1 9M8.5 1.5l-1 9M2 4.5h8.5M1.5 7.5H10"/></svg>',
  string: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2 3V2h8v1M6 2v8M4.5 10h3"/></svg>',
  boolean: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1" y="3.5" width="10" height="5" rx="2.5"/><circle cx="8.5" cy="6" r="1.5" fill="currentColor"/></svg>',
  typography: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M1.5 10L4.5 2l3 8M2.6 7.2h3.8M8.5 6.5h2.5M9.75 6.5V10"/></svg>',
  duration: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><circle cx="6" cy="6.5" r="4.5"/><path d="M6 4v2.5l1.6 1M4.5 1h3"/></svg>',
  easing: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M1.5 10.5C6 10.5 6 1.5 10.5 1.5"/></svg>',
  shadow: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1.5" y="1.5" width="7" height="7" rx="1"/><path d="M10.5 4v6.5H4" stroke-opacity=".55"/></svg>',
};
const FIELD_LABELS = {
  fontFamily: 'Family', fontWeight: 'Weight', fontSize: 'Size', lineHeight: 'Line height', letterSpacing: 'Letter spacing',
  color: 'Color', x: 'X', y: 'Y', blur: 'Blur', spread: 'Spread',
};
const LINK_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M5 7l2-2M5.5 3.5l.8-.8a2 2 0 0 1 2.8 2.8l-.8.8M6.5 8.5l-.8.8a2 2 0 0 1-2.8-2.8l.8-.8"/></svg>';
const LIB_ICON = '<svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 1.2l5 2.9v5.8L7 12.8 2 9.9V4.1z"/></svg>';
const CHEVRON = '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 1.5L5.5 4l-3 2.5"/></svg>';
const GROUP_ICON = '<svg class="group-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M1.5 3.5h3l1 1h5v5h-9z"/></svg>';
const RESET_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M2.5 6a3.5 3.5 0 1 0 1-2.5M2.5 1.5v2h2"/></svg>';

// Fill `host` with the editor (token files). Stays until unmountTokenEditor().
export function mountTokenEditor(host) {
  close();
  modal = host;
  inline = true;
  sideTab = null;
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
  if (!modal) sideTab = null; // opening: show the tab of the selected collection
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
// The sidebar has two tabs when the file links Sigma Tokens files: 'linked' (their collections, read-only)
// and 'local' (this file's own). null follows the selected collection; with no local collections, the
// linked file's first collection is shown.
let sideTab = null;
function active() {
  const locals = localCollections(), libs = libraryCollections();
  const pool = sideTab === 'local' ? locals : sideTab === 'linked' ? libs : [...locals, ...libs];
  const first = sideTab === 'local' ? locals[0] : sideTab === 'linked' ? libs[0] : locals[0] || libs[0];
  return pool.find((c) => c.id === activeId) || first || null;
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

// A composite value (typography, shadow) with alias fields resolved (default modes), for previews.
function compositePreview(type, raw) {
  const base = isAlias(raw) ? previewValue(raw.alias) : raw;
  const out = { ...defaultValue(type), ...(base || {}) };
  for (const f of Object.keys(COMPOSITE_FIELDS[type])) if (isAlias(out[f])) out[f] = previewValue(out[f].alias);
  return out;
}
const typoPreview = (raw) => compositePreview('typography', raw);

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
  if (type === 'shadow') {
    return `<button class="typo-cell" data-row-select="${v.id}" title="Edit in the inspector">${valuePreview('shadow', compositePreview('shadow', raw))}</button>`;
  }
  if (type === 'number') return `<input class="cell-input" ${data} data-cell="number" value="${esc(raw)}" spellcheck="false">`;
  if (type === 'duration') {
    return `<span class="unit-wrap"><input class="cell-input" ${data} data-cell="duration" value="${esc(raw)}" spellcheck="false">ms</span>`;
  }
  if (type === 'easing') {
    const e = parseEasing(raw) || defaultValue('easing');
    return `<span class="easing-preview" title="cubic-bezier(${e.join(', ')})">${easingCurve(e)}</span>` +
      `<input class="cell-input" ${data} data-cell="easing" value="${esc(e.join(', '))}" spellcheck="false" title="x1, y1, x2, y2 — like CSS cubic-bezier()">`;
  }
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
  return `<button class="alias-chip${target ? '' : ' missing'}${target?.variable.deprecated ? ' deprecated' : ''}" ${attrs} title="${esc(title)}${lib ? `\nFrom ${esc(lib.name)}` : ''}${target?.variable.deprecated ? '\nThis token is deprecated' : ''}"><span class="ref-arrow">→</span>` +
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
    return `<div class="var-cell readonly"><span class="static-value">${valuePreview(v.type, COMPOSITE_FIELDS[v.type] ? compositePreview(v.type, raw) : raw)}</span></div>`;
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
      (x && typeof x === 'object' && ALL_FIELDS.some((f) => isAlias(x[f]) && x[f].alias === id));
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

// The editor for one mode of a composite token (typography, shadow): each field is a value or an alias to a
// token of the field's type.
function compositeEditor(col, v, mode) {
  const fields = COMPOSITE_FIELDS[v.type];
  const raw = isExtension(col) ? rawValueIn(col, mode.id, v) : v.valuesByMode[mode.id];
  if (isAlias(raw)) {
    return `<div class="typo-mode"><div class="typo-mode-name">${esc(mode.name)}</div>` +
      `<button class="link-chip" data-select-token="${raw.alias}">→ ${esc(findVariable(raw.alias)?.variable.name || 'Missing token')}</button></div>`;
  }
  const value = { ...defaultValue(v.type), ...(raw || {}) };
  const data = (f) => `data-var="${v.id}" data-mode="${mode.id}" data-typo-field="${f}"`;
  const field = (f) => {
    const x = value[f];
    const alias = `<button class="icon-btn cell-alias always" ${data(f)} data-typo-alias title="Use a ${fields[f]} token">${LINK_ICON}</button>`;
    let control;
    if (isAlias(x)) {
      const target = findVariable(x.alias);
      control = `<button class="alias-chip" ${data(f)} data-typo-alias><span class="ref-arrow">→</span><span class="ref-name">${esc(target?.variable.name || 'Missing token')}</span>` +
        `<span class="ref-value">${valuePreview(fields[f], previewValue(x.alias))}</span></button>`;
    } else if (f === 'fontFamily') {
      const fonts = FONTS.includes(x) ? FONTS : [x, ...FONTS];
      control = `<select class="select" ${data(f)}>${fonts.map((n) => `<option ${n === x ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    } else if (f === 'fontWeight') {
      control = `<select class="select" ${data(f)}>${WEIGHTS.map(([w, l]) => `<option value="${w}" ${w === Number(x) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    } else if (fields[f] === 'color') {
      const { hex, alpha } = splitColor(x);
      control = `<label class="swatch" style="--c:${esc(x)}"><input type="color" ${data(f)} data-field-color value="${hex.toLowerCase()}"></label>` +
        `<input class="cell-input boxed" ${data(f)} value="${esc(alpha < 1 ? joinColor(hex, alpha) : hex)}" spellcheck="false" title="Hex, with opacity as two more digits (#00000040). Type { to point to a color token">`;
    } else {
      const shown = f === 'lineHeight' && (x === null || x === undefined) ? 'Auto' : x;
      control = `<input class="cell-input boxed" ${data(f)} value="${esc(shown)}" spellcheck="false" title="Type { to point to a token">`;
    }
    return `<label class="typo-field"><span class="muted">${FIELD_LABELS[f]}</span>${control}${isAlias(x) ? '' : alias}</label>`;
  };
  let sample = '';
  if (v.type === 'typography') {
    const t = typoPreview(raw);
    sample = `<div class="typo-sample-line" style="${typoStyle(t)};font-size:${Math.min(Number(t.fontSize) || 16, 40)}px;line-height:${t.lineHeight ? t.lineHeight + '%' : 'normal'}">The quick brown fox</div>`;
  } else if (v.type === 'shadow') {
    const t = compositePreview('shadow', raw);
    sample = `<div class="shadow-sample"><div style="box-shadow:${shadowCSS(t)}"></div></div>`;
  }
  return `<div class="typo-mode">${col.modes.length > 1 ? `<div class="typo-mode-name">${esc(mode.name)}</div>` : ''}` +
    sample + Object.keys(fields).map(field).join('') + '</div>';
}

const shadowCSS = (t) => {
  const { hex, alpha } = splitColor(t.color);
  const n = parseInt(hex.slice(1), 16);
  return `${Number(t.x) || 0}px ${Number(t.y) || 0}px ${Math.max(0, Number(t.blur) || 0)}px ${Number(t.spread) || 0}px rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

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
        `${isLibraryCollection(st.collection) ? `<span class="lib-tag">${esc(libraryOf(st.collection)?.name || 'Sigma Tokens')}</span>` : ''}</button>`));
    parts.push(`<span class="inspector-value">${valuePreview(v.type, value)}</span>`);
    return `<div class="inspector-row"><span class="muted">${esc(m.name)}</span><span class="chain">${parts.join('<span class="chain-arrow">→</span>')}</span></div>`;
  };
  const modeRows = COMPOSITE_FIELDS[v.type] && !ro ? col.modes.map((m) => compositeEditor(col, v, m)).join('') : col.modes.map(chainRow).join('');
  const users = aliasedBy(v.id);
  const uses = state.doc?.pages?.length ? layerUses(v.id) : null;
  const contrast = v.type === 'color' ? contrastSection(col, v, ext || ro) : '';
  return `<aside class="vars-inspector">
    <div class="inspector-head"><span class="var-type">${TYPE_ICON[v.type]}</span><span class="inspector-name">${esc(v.name)}</span></div>
    <div class="muted">${VAR_TYPES[v.type]} · ${esc(collectionLabel(home))}</div>
    <label class="inspector-label">Description</label>
    <textarea class="desc inspector-desc" data-token-desc="${v.id}" rows="3" placeholder="${ro ? 'No description' : v.deprecated ? 'What should be used instead?' : 'What is this token for?'}" spellcheck="false" ${ext || ro ? `disabled title="${ro ? 'Edit it in its token file' : 'Edit descriptions in the root collection'}"` : ''}>${esc(v.description || '')}</textarea>
    <label class="check-row deprecate-row" title="Hidden from token pickers so nothing new uses it. Layers and tokens that use it keep working."><input type="checkbox" data-token-deprecated="${v.id}" ${v.deprecated ? 'checked' : ''} ${ext || ro ? 'disabled' : ''}> Deprecated</label>
    ${v.deprecated ? '<div class="muted">Hidden from token pickers. Layers and tokens that use it keep working; say what to use instead in the description.</div>' : ''}
    <label class="inspector-label">Values in ${esc(col.name)}</label>
    ${modeRows}
    ${contrast}
    <label class="inspector-label">Referenced by</label>
    ${users.length ? users.map(({ variable: u, collection: c }) => `<button class="link-chip" data-select-token="${u.id}" title="${esc(c.name)}">${esc(u.name)}</button>`).join('') : '<div class="muted">No other tokens alias this one.</div>'}
    ${uses === null ? '' : `<label class="inspector-label">Used in this file</label><div class="muted">${uses ? `${uses} layer${uses === 1 ? '' : 's'}` : 'Not used by any layer yet.'}</div>`}
    ${ext || ro ? '' : `<button class="btn wide danger" data-delete-var="${v.id}">Delete token</button>`}
  </aside>`;
}

// Contrast pairs: this color with the colors it's used with, in every mode of the collection shown. A pair
// is stored on the foreground token ("text/primary" lists "surface/default"); the background token shows
// it too. Ratios are for normal text: AA needs 4.5:1, AAA 7:1.
function contrastSection(col, v, readOnlyPairs) {
  const rows = [];
  const add = (fg, bg, ownerId, otherId) => {
    const other = findVariable(otherId);
    if (!other) return;
    const badges = col.modes.map((m) => {
      const a = resolveIn(col, m.id, fg), b = resolveIn(col, m.id, bg);
      if (!a || !b) return '';
      return `<span class="contrast-mode">${col.modes.length > 1 ? `<span class="muted">${esc(m.name)}</span>` : ''}${contrastBadge(contrastRatio(a, b), false, { title: `${esc(findVariable(fg)?.variable.name)} on ${esc(findVariable(bg)?.variable.name)} in ${esc(m.name)}: normal text needs 4.5:1 for AA and 7:1 for AAA (large text 3:1 and 4.5:1)` })}</span>`;
    }).join('');
    const owner = findVariable(ownerId);
    const canRemove = !readOnlyPairs && owner && !readOnly(owner.collection);
    rows.push(`<div class="contrast-pair-row"><div class="contrast-pair-head"><span class="muted">${fg === v.id ? 'on' : 'under'}</span>` +
      `<button class="link-chip" data-select-token="${otherId}">${esc(other.variable.name)}</button>` +
      (canRemove ? `<button class="icon-btn" data-remove-pair="${ownerId}:${ownerId === v.id ? otherId : v.id}" title="Stop checking this pair">${icons.close}</button>` : '') +
      `</div><div class="contrast-modes">${badges}</div></div>`);
  };
  for (const id of v.contrastWith || []) add(v.id, id, v.id, id);
  for (const { variable: u } of allVariables('color')) if (u.contrastWith?.includes(v.id)) add(u.id, v.id, u.id, u.id);
  return `<label class="inspector-label">Contrast</label>` +
    (rows.join('') || '<div class="muted">Check this color against the colors it’s used with, in every mode.</div>') +
    (readOnlyPairs ? '' : `<button class="btn wide" data-add-pair="${v.id}">+ Check contrast with…</button>`);
}

// The sidebar is one tree: collections, and inside each its groups (nested).
function groupRows(c, col) {
  const editable = editableGroups(c);
  const rows = [];
  const visit = (nodes, depth) => {
    for (const g of nodes) {
      const open = !collapsedGroups.has(g.id);
      const caret = g.children.length
        ? `<button class="group-caret${open ? ' open' : ''}" data-toggle-group="${esc(g.id)}" title="${open ? 'Collapse' : 'Expand'}">${CHEVRON}</button>`
        : '<span class="group-caret"></span>';
      const label = renamingGroup === g.id
        ? `<input class="group-rename" data-rename-group="${esc(g.id)}" value="${esc(g.name)}" spellcheck="false">`
        : `<span class="group-name">${esc(g.name)}</span>`;
      rows.push(`<div class="vars-group-item${c === col && g.id === activeGroup ? ' active' : ''}" data-col-id="${c.id}" data-group="${esc(g.id)}" ` +
        `style="padding-left:${26 + depth * 12}px"${editable ? ' draggable="true"' : ''} title="${esc(g.description || g.path)}">` +
        `${caret}${GROUP_ICON}${label}<span class="muted group-count">${g.count}</span>` +
        (editable ? `<button class="icon-btn group-more" data-group-menu="${esc(g.id)}" title="Group options">⋯</button>` : '') + '</div>');
      if (open) visit(g.children, depth + 1);
    }
  };
  visit(groupTree(c), 0);
  return rows.join('') + (editable && c === col ? `<button class="vars-add sub" data-act="new-group">+ New group${activeGroup ? ` in ${esc(findGroup(c, activeGroup)?.name || '')}` : ''}</button>` : '');
}

const collectionOpen = (c, col) => (openCollections.has(c.id) ? openCollections.get(c.id) : !readOnly(c) || c === col);

function colRow(c, col, depth, label = c.name) {
  const count = isExtension(c) ? Object.keys(c.overrides || {}).length : (c.variables || []).length;
  const hasGroups = groupTree(c).length > 0 || (editableGroups(c) && c === col);
  const open = collectionOpen(c, col);
  return `<div class="vars-col-row" style="padding-left:${depth * 14}px">` +
    (hasGroups ? `<button class="group-caret${open ? ' open' : ''}" data-toggle-col="${c.id}" title="${open ? 'Collapse' : 'Expand'}">${CHEVRON}</button>` : '<span class="group-caret"></span>') +
    `<button class="vars-col${c === col && !activeGroup ? ' active' : c === col ? ' current' : ''}" data-col="${c.id}">` +
    `<span class="vars-col-label">${depth ? '↳ ' : ''}${esc(label)}</span>` +
    `<span class="muted" title="${isExtension(c) ? 'Overridden tokens' : 'Tokens'}">${count}</span></button></div>` +
    (open && hasGroups ? groupRows(c, col) : '');
}

function render() {
  if (!modal) return;
  if (rendering) return void queueMicrotask(render); // a blur during the HTML swap changed something: render after
  // Keep the search box focused (with its caret) across re-renders.
  const searching = document.activeElement?.hasAttribute?.('data-search');
  const caret = searching ? document.activeElement.selectionStart : 0;
  const col = active();
  if (col && activeGroup && !findGroup(col, activeGroup)) activeGroup = null;
  // The sidebar: tabs for the linked Sigma Tokens file(s) and this file's own (local) collections.
  const design = state.doc?.kind !== 'tokens';
  const locals = collectionTree();
  const libFiles = new Map();
  for (const c of libraryCollections()) {
    const lib = libraryOf(c);
    const key = lib?.fileId || c.fromLibrary;
    if (!libFiles.has(key)) libFiles.set(key, { lib, cols: [] });
    libFiles.get(key).cols.push(c);
  }
  const tab = libFiles.size ? (sideTab || (col && readOnly(col) ? 'linked' : 'local')) : 'local';
  const linkedCount = [...libFiles.values()].reduce((n, f) => n + f.cols.length, 0);
  const single = libFiles.size === 1 ? [...libFiles.values()][0].lib : null;
  const tabButton = (key, label, count, title) => `<button class="vars-tab${tab === key ? ' active' : ''}" data-side-tab="${key}" title="${esc(`${title} · ${count} collection${count === 1 ? '' : 's'}`)}">${label}</button>`;
  const linkedTab = tabButton('linked', esc(single?.name || 'Linked'), linkedCount, design ? 'The Sigma Tokens file this file uses (read-only)' : 'Sigma Tokens files this file links (read-only)');
  const localTab = tabButton('local', design ? 'Local' : 'This file', locals.length, design ? 'Tokens kept only in this file' : 'This file’s collections');
  const tabs = libFiles.size ? `<div class="vars-tabs" role="tablist">${design ? linkedTab + localTab : localTab + linkedTab}</div>` : '';
  const linkedPanel = () => [...libFiles.values()].map(({ lib, cols }) =>
    `<div class="lib-file-bar" title="Edit these tokens in their own Sigma Tokens file">` +
    `<span class="lib-file-meta">${libFiles.size > 1 ? `<b>${esc(lib?.name || 'Sigma Tokens')}</b> · ` : ''}v${lib?.version ?? '?'}${lib?.via ? ` · via ${esc(lib.via)}` : ''} · read-only</span>` +
    (lib?.fileId ? `<button class="link-btn" data-act="open-library" data-file="${lib.fileId}" title="Open it to edit these tokens">Open</button>` : '') + '</div>' +
    cols.map((c) => colRow(c, col, 0)).join('')).join('');
  const localPanel = () => locals.map(({ c, depth }) => colRow(c, col, depth)).join('') +
    (design && !locals.length && libFiles.size ? '<div class="muted vars-side-note">No local tokens. Tokens usually live in the Sigma Tokens file; a local collection is just for this file.</div>' : '') +
    '<button class="vars-add" data-act="new-collection">+ New collection</button>';
  const sidebar = tabs + (tab === 'linked' ? linkedPanel() : localPanel());
  let main;
  if (!col && libFiles.size && design) {
    main = '<div class="vars-empty"><div class="home-empty-title">No local tokens</div><p>Most files don’t need any: their tokens come from the Sigma Tokens file. Create a collection here for tokens only this file uses; you can move them to a Sigma Tokens file later.</p><button class="btn primary" data-act="new-collection">Create collection</button></div>';
  } else if (!col) {
    main = '<div class="vars-empty"><div class="home-empty-title">No design tokens yet</div><p>Design tokens store reusable colors, numbers, text and booleans. Create a collection to start.</p><button class="btn primary" data-act="new-collection">Create collection</button></div>';
  } else {
    const ext = isExtension(col);
    const ro = readOnly(col);
    const all = ext ? inheritedVariables(col) : col.variables;
    // Search looks through every group; otherwise the table shows the selected group.
    const scope = query.trim() ? null : activeGroup;
    const scopePath = groupPathOf(col, scope);
    const vars = tokensInOrder(col, all.filter(matches).filter((v) => tokenInGroup(col, v, scope)));
    const gridCols = `minmax(200px, 1.3fr) repeat(${col.modes.length}, minmax(170px, 1fr)) 40px`;
    const head = `<div class="vars-row vars-head" style="grid-template-columns:${gridCols}"><div>Name</div>` +
      col.modes.map((m) => `<div class="mode-head">${ro ? `<span>${esc(m.name)}</span>` : `<input class="mode-name" data-mode-name="${m.id}" value="${esc(m.name)}" spellcheck="false">`}` +
        (!ext && !ro && col.modes.length > 1 ? `<button class="icon-btn" data-remove-mode="${m.id}" title="Delete mode">${icons.close}</button>` : '') + '</div>').join('') +
      `<div>${ext || ro ? '' : `<button class="icon-btn" data-act="add-mode" title="Add mode">${icons.plus}</button>`}</div></div>`;
    // Rows under a header for each group (its path relative to the selected group).
    const groups = new Map();
    for (const v of vars) {
      const g = groupIdOf(col, v) || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(v);
    }
    const editable = editableGroups(col);
    const body = [...groups].map(([g, list]) => {
      const path = groupPathOf(col, g);
      const rel = scopePath && path.startsWith(`${scopePath}/`) ? path.slice(scopePath.length + 1) : g === scope ? '' : path;
      const desc = g && g !== scope ? findGroup(col, g)?.description : '';
      return (rel ? `<div class="vars-group" data-group-head="${esc(g)}" title="Show only this group">${esc(rel).replace(/\//g, ' <span class="muted">/</span> ')}` +
        `${desc ? `<span class="group-desc-inline">${esc(desc)}</span>` : ''}</div>` : '') +
      list.map((v) => `<div class="vars-row${v.id === selectedId ? ' selected' : ''}${v.deprecated ? ' deprecated' : ''}" data-row="${v.id}" style="grid-template-columns:${gridCols}"${editable ? ' data-drop-row' : ''}>` +
        `<div class="var-name"><span class="var-type${editable ? ' drag-handle' : ''}" title="${VAR_TYPES[v.type]}${editable ? ' · drag to a group' : ''}"${editable ? ` draggable="true" data-drag-token="${v.id}"` : ''}>${TYPE_ICON[v.type]}</span>` +
        (ext || ro ? `<span class="var-name-text" title="${esc(v.name)}">${esc(leafOf(v.name))}</span>`
          : `<input data-var-name="${v.id}" value="${esc(leafOf(v.name))}" spellcheck="false" title="${esc(v.name)} · type a/b to put it in a group a, /b for the top of the collection">`) +
        (v.deprecated ? `<span class="deprecated-tag" title="Deprecated${v.description ? `: ${esc(v.description)}` : ''}">Deprecated</span>` : '') +
        (v.description ? `<span class="desc-dot" title="${esc(v.description)}"></span>` : '') + '</div>' +
        col.modes.map((m) => cell(col, v, m)).join('') +
        `<div>${ext || ro ? '' : `<button class="icon-btn" data-delete-var="${v.id}" title="Delete token">${icons.close}</button>`}</div></div>`).join('');
    }).join('');
    const parent = parentOf(col);
    const lib = ro ? libraryOf(col) : null;
    const empty = all.length
      ? `<div class="muted vars-none">${scope ? 'No tokens in this group yet. Drag tokens here or create one.' : 'No tokens match the search or filter.'}</div>`
      : '<div class="muted vars-none">No tokens in this collection yet.</div>';
    main = `<div class="vars-toolbar"><div class="vars-title">` +
      (ro ? `<span class="vars-col-name static">${esc(col.name)}</span><span class="ext-badge lib" title="From ${esc(lib?.name || 'a Sigma Tokens file')} v${lib?.version ?? '?'}${lib?.via ? ` (via ${esc(lib.via)})` : ''}. Edit these tokens in that file.">Read-only</span>`
        : `<input class="vars-col-name" data-col-name="${col.id}" value="${esc(col.name)}" spellcheck="false">`) +
      (ext ? `<span class="ext-badge" title="Inherits tokens and modes from ${esc(parent ? collectionLabel(parent) : 'a missing collection')}">Extends ${esc(parent ? collectionLabel(parent) : '?')}</span>` : '') + '</div>' +
      `<div class="vars-actions"><input type="search" class="vars-search" data-search placeholder="Search tokens" value="${esc(query)}" spellcheck="false">` +
      `<select class="select" data-type-filter title="Filter by type"><option value="">All types</option>${Object.entries(VAR_TYPES).map(([t, l]) => `<option value="${t}" ${t === typeFilter ? 'selected' : ''}>${l}</option>`).join('')}</select>` +
      `<button class="btn" data-act="extend" title="Create a collection that inherits this one and overrides only some values">Extend</button>` +
      (ro ? (lib ? `<button class="btn" data-act="open-library" data-file="${lib.fileId}">Open Sigma Tokens file</button>` : '') : '<button class="btn" data-act="delete-collection">Delete</button>') + '</div></div>' +
      (ext ? '<div class="vars-hint">Greyed values are inherited. Edit a value to override it for this collection; ↺ resets it. Add tokens and modes in the root collection.</div>' : '') +
      `<div class="vars-work"><div class="vars-table">${groupHeading(col, scope)}${head}${body || empty}</div>${inspector(col)}</div>` +
      (ext || ro ? '' : '<div class="vars-footer"><button class="btn" data-act="new-variable">+ Create token</button></div>');
  }
  rendering = true; // replacing the HTML blurs a focused field; that's not the user finishing an edit
  modal.querySelector('.vars-modal').innerHTML =
    (inline ? '' : `<div class="modal-head">Design tokens<span class="head-actions">` +
      (localCollections().length ? '<button class="btn" data-act="move-to-file" title="Move these tokens into a Sigma Tokens file and link it">Move to Sigma Tokens…</button>' : '') +
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

// The selected group's path and description, above its tokens.
function groupHeading(col, id) {
  const g = id ? findGroup(col, id) : null;
  if (!g) return '';
  const path = groupPathOf(col, id);
  const crumbs = path.split('/').map((p) => esc(p)).join(' <span class="muted">/</span> ');
  const desc = editableGroups(col)
    ? `<textarea class="desc group-desc" data-group-desc="${esc(id)}" rows="1" placeholder="Describe this group (optional)" spellcheck="false">${esc(g.description || '')}</textarea>`
    : (g.description ? `<div class="muted">${esc(g.description)}</div>` : '');
  return `<div class="group-heading"><div class="group-crumbs">${GROUP_ICON}${crumbs}</div>${desc}</div>`;
}

// The raw value shown in a cell (an extension shows its override or the inherited value).
function cellRaw(col, varId, modeId) {
  const v = findVariable(varId)?.variable;
  if (!v) return undefined;
  return isExtension(col) ? rawValueIn(col, modeId, v) : v.valuesByMode[modeId];
}

// Change one field of a composite token (typography, shadow) for a mode (writing an override in an extension).
function writeTypoField(col, varId, modeId, field, value) {
  const type = findVariable(varId)?.variable.type || 'typography';
  let base = cellRaw(col, varId, modeId);
  base = isAlias(base) ? { ...defaultValue(type), ...(previewValue(base.alias) || {}) } : { ...defaultValue(type), ...(base || {}) };
  base[field] = value;
  writeCell(col, varId, modeId, base);
}

// The type of field `field` of composite token `varId`.
const fieldType = (varId, field) => COMPOSITE_FIELDS[findVariable(varId)?.variable.type || 'typography']?.[field] || 'number';

function typoAliasPicker(btn, col, query = '') {
  const { var: varId, mode, typoField: field } = btn.dataset;
  const current = cellRaw(col, varId, mode)?.[field];
  const cellEl = btn.closest('.typo-field') || btn;
  openTokenPicker({
    anchor: cellEl.getBoundingClientRect(), type: fieldType(varId, field), query,
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

// Group options (⋯ or right-click in the sidebar).
function groupMenu(btn, col, id) {
  const g = findGroup(col, id);
  if (!g) return;
  const r = btn.getBoundingClientRect();
  const count = col.variables.filter((v) => tokenInGroup(col, v, id)).length;
  showContextMenu(r.left, r.bottom + 4, [
    { label: 'New token in this group…', action: () => newTokenMenu(r.left, r.bottom + 4, col, id) },
    { label: 'New group inside', action: () => change(() => { collapsedGroups.delete(id); activeGroup = renamingGroup = createGroup(col, id); }) },
    { label: 'Rename', action: () => { renamingGroup = id; render(); } },
    { label: 'Edit description', action: () => { activeGroup = id; render(); modal.querySelector('[data-group-desc]')?.focus(); } },
    { label: 'Ungroup', action: () => change(() => { ungroup(col, id); activeGroup = g.parentId || null; }) },
    '-',
    { label: count ? `Delete group and ${count} token${count === 1 ? '' : 's'}` : 'Delete group', action: () => {
      if (count && !confirm(`Delete “${groupPathOf(col, id)}” and its ${count} token${count === 1 ? '' : 's'}? Layers and tokens that use them keep their current values.`)) return;
      change(() => { activeGroup = g.parentId || null; deleteGroup(col, id); });
    } },
  ]);
}

// Pick a type and create a token in group `groupId` (null: the top level), then show it.
function newTokenMenu(x, y, col, groupId) {
  showContextMenu(x, y, Object.entries(VAR_TYPES).map(([type, label]) => ({
    label, action: () => change(() => {
      selectedId = createVariable(col, type, undefined, groupId).id;
      query = '';
      if (!groupId) activeGroup = null; // make sure the new token is in view
      else if (!tokenInGroup(col, findVariable(selectedId).variable, activeGroup)) activeGroup = groupId;
    }),
  })));
}

// Move a token to a group (right-click a row).
function moveToGroupMenu(x, y, col, varId) {
  const v = findVariable(varId)?.variable;
  const current = v ? groupIdOf(col, v) : null;
  const items = [];
  const walkTree = (nodes, depth) => nodes.forEach((g) => {
    items.push({ label: `${'   '.repeat(depth)}${g.name}`, checked: current === g.id, action: () => change(() => moveTokensToGroup(col, [varId], g.id)) });
    walkTree(g.children, depth + 1);
  });
  walkTree(groupTree(col), 0);
  showContextMenu(x, y, [
    { label: `Top of “${col.name}”`, checked: !current, action: () => change(() => moveTokensToGroup(col, [varId], null)) },
    ...(items.length ? ['-', ...items] : []),
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
    const groupEl = !e.target.closest('button, input, textarea') && e.target.closest('[data-group], [data-group-head]');
    if (groupEl) {
      if (groupEl.dataset.colId) activeId = groupEl.dataset.colId;
      activeGroup = (groupEl.dataset.group ?? groupEl.dataset.groupHead) || null;
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
    if (t.dataset.addPair) {
      const v = findVariable(t.dataset.addPair)?.variable;
      if (!v) return;
      const taken = new Set([v.id, ...(v.contrastWith || [])]);
      return openTokenPicker({
        anchor: t.getBoundingClientRect(), type: 'color', exclude: (id) => taken.has(id),
        onPick: (id) => change(() => addContrastPair(v, id)),
      });
    }
    if (t.dataset.removePair) {
      const [ownerId, otherId] = t.dataset.removePair.split(':');
      const owner = findVariable(ownerId)?.variable;
      return owner && change(() => removeContrastPair(owner, otherId));
    }
    if (t.hasAttribute('data-pick-token')) return tokenPicker(t.closest('.var-cell') || t, col, t.dataset.var, t.dataset.mode);
    if (t.dataset.sideTab) {
      sideTab = t.dataset.sideTab;
      activeId = null;
      activeGroup = null;
      query = '';
      return render();
    }
    if (t.dataset.toggleGroup) {
      const id = t.dataset.toggleGroup;
      collapsedGroups.has(id) ? collapsedGroups.delete(id) : collapsedGroups.add(id);
      return render();
    }
    if (t.dataset.toggleCol) {
      const c = collections().find((x) => x.id === t.dataset.toggleCol);
      if (c) openCollections.set(c.id, !collectionOpen(c, col));
      return render();
    }
    if (t.dataset.groupMenu) {
      const owner = t.closest('[data-col-id]')?.dataset.colId;
      if (owner && owner !== col?.id) activeId = owner;
      return groupMenu(t, active(), t.dataset.groupMenu);
    }
    if (t.dataset.selectToken) {
      // Jump to a token, switching to its collection (maybe a linked library's) if it lives elsewhere.
      const hit = findVariable(t.dataset.selectToken);
      if (hit && !inFamily(col, hit.collection)) {
        activeId = hit.collection.id;
        sideTab = null; // follow it to its tab
      }
      activeGroup = null;
      selectedId = t.dataset.selectToken;
      query = '';
      typeFilter = '';
      return render();
    }
    if (t.dataset.col) {
      activeId = t.dataset.col;
      activeGroup = null;
      return render();
    }
    if (t.dataset.removeMode) return change(() => removeMode(col, t.dataset.removeMode));
    if (t.dataset.deleteVar) return change(() => deleteVariable(t.dataset.deleteVar));
    if (t.hasAttribute('data-reset-override')) return change(() => clearOverride(col, t.dataset.var, t.dataset.mode));
    switch (t.dataset.act) {
      case 'new-group':
        return change(() => {
          if (activeGroup) collapsedGroups.delete(activeGroup);
          openCollections.set(col.id, true);
          renamingGroup = createGroup(col, activeGroup);
        });
      case 'open-library':
        return window.open(`#/file/${t.dataset.file}`, '_blank');
      case 'move-to-file': {
        const r = t.getBoundingClientRect(); // read before the modal (and the button) goes away
        close();
        return moveLocalTokensMenu({ getBoundingClientRect: () => r });
      }
      case 'new-collection':
        sideTab = 'local';
        return change(() => void (activeId = createCollection().id));
      case 'extend':
        sideTab = 'local'; // the extension is this file's own
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
        // New tokens go at the top level of the collection; a group's ⋯ menu adds one inside it.
        return newTokenMenu(r.left, r.top - 120, col, null);
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
    if (group?.dataset.group) {
      const owner = collections().find((c) => c.id === group.dataset.colId) || col;
      if (!editableGroups(owner)) return;
      e.preventDefault();
      activeId = owner.id;
      return groupMenu({ getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) }, owner, group.dataset.group);
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
  // Drag and drop, within the collection being edited:
  //   a token (by its type icon) onto a group, a group heading or the collection (top level) moves it
  //   there; onto another token, it goes before or after that token (and into its group);
  //   a group onto a group goes inside it (middle), or before / after it (top / bottom edge).
  let dragging = null;
  modal.addEventListener('dragstart', (e) => {
    const col = active();
    const token = e.target.closest?.('[data-drag-token]');
    const group = e.target.closest?.('[data-group][draggable]');
    if (token) dragging = { col, token: token.dataset.dragToken };
    else if (group) dragging = { col, group: group.dataset.group };
    else return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragging.token ? `{${findVariable(dragging.token)?.variable.name}}` : groupPathOf(col, dragging.group));
  });
  const clearMarks = () => modal.querySelectorAll('.drop-into, .drop-before, .drop-after').forEach((x) => x.classList.remove('drop-into', 'drop-before', 'drop-after'));
  // Where a drop would land: { el, kind: 'into' | 'before' | 'after', ... }.
  const dropAt = (e) => {
    if (!dragging) return null;
    const col = dragging.col;
    const el = e.target.closest?.('[data-group], [data-group-head], [data-drop-row], [data-col]');
    if (!el) return null;
    if (el.dataset.colId && el.dataset.colId !== col.id) return null; // other collections
    if (el.dataset.col !== undefined && el.dataset.col !== col.id) return null;
    const r = el.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (el.dataset.dropRow !== undefined) {
      if (!dragging.token || el.dataset.row === dragging.token) return null;
      return { el, kind: y < 0.5 ? 'before' : 'after', token: el.dataset.row };
    }
    if (el.dataset.col !== undefined) return { el, kind: 'into', group: null };
    const id = el.dataset.group ?? el.dataset.groupHead;
    if (dragging.group && el.dataset.group !== undefined) {
      if (id === dragging.group) return null;
      return { el, kind: y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'into', group: id };
    }
    return { el, kind: 'into', group: id || null };
  };
  modal.addEventListener('dragover', (e) => {
    const at = dropAt(e);
    clearMarks();
    if (!at) return;
    e.preventDefault();
    at.el.classList.add(`drop-${at.kind}`);
  });
  modal.addEventListener('dragend', () => {
    dragging = null;
    clearMarks();
  });
  modal.addEventListener('drop', (e) => {
    const at = dropAt(e);
    clearMarks();
    if (!at) return;
    e.preventDefault();
    const { col } = dragging;
    const what = dragging;
    dragging = null;
    if (what.token) {
      if (at.token) {
        // Before or after another token, in its group.
        const target = findVariable(at.token)?.variable;
        const order = tokensInOrder(col, col.variables);
        const next = at.kind === 'before' ? at.token : order[order.findIndex((v) => v.id === at.token) + 1]?.id || null;
        return change(() => moveTokensToGroup(col, [what.token], groupIdOf(col, target), next));
      }
      return change(() => moveTokensToGroup(col, [what.token], at.group));
    }
    if (at.kind === 'into') {
      if (!moveGroup(col, what.group, at.group)) return toast('A group can’t go inside itself.');
      if (at.group) collapsedGroups.delete(at.group);
      return change(() => {});
    }
    // Before or after a sibling group.
    const target = findGroup(col, at.group);
    const siblings = (col.groups || []).filter((g) => (g.parentId || null) === (target.parentId || null) && g.id !== what.group);
    const before = at.kind === 'before' ? target.id : siblings[siblings.findIndex((g) => g.id === target.id) + 1]?.id || null;
    if (!moveGroup(col, what.group, target.parentId || null, before)) return toast('A group can’t go inside itself.');
    change(() => {});
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
    if (t.dataset.tokenDeprecated) return change(() => {
      const v = findVariable(t.dataset.tokenDeprecated)?.variable;
      if (v) setTokenDeprecated(v, t.checked);
    });
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
      const v = findVariable(t.dataset.varName)?.variable;
      if (v) setTokenName(col, v, t.value);
    });
    if (t.dataset.groupDesc) return change(() => setGroupDescription(col, t.dataset.groupDesc, t.value));
    if (t.dataset.typoField) {
      const f = t.dataset.typoField;
      const ftype = fieldType(t.dataset.var, f);
      let value = t.value.trim();
      if (/^\{.+\}$/.test(value)) {
        // A pasted reference: "{font/size/body}".
        const hit = findByReference(value, ftype);
        if (!hit) return toast(`No ${VAR_TYPES[ftype].toLowerCase()} token named ${value}`), render();
        return change(() => writeTypoField(col, t.dataset.var, t.dataset.mode, f, { alias: hit.variable.id }));
      }
      if (ftype === 'color') {
        const current = splitColor(cellRaw(col, t.dataset.var, t.dataset.mode)?.[f]);
        if (t.hasAttribute('data-field-color')) value = joinColor(t.value, current.alpha);
        else {
          const h = value.replace(/^#/, '');
          const full = /^[0-9a-f]{3}$/i.test(h) ? h.split('').map((c) => c + c).join('') : h;
          if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(full)) return render();
          value = `#${full.toUpperCase()}`;
        }
        return change(() => writeTypoField(col, t.dataset.var, t.dataset.mode, f, value));
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
      } else if (t.dataset.cell === 'duration') {
        value = Number(t.value.replace(/ms$/i, '').trim());
        if (!Number.isFinite(value) || value < 0) return render();
      } else if (t.dataset.cell === 'easing') {
        value = parseEasing(t.value);
        if (!value) return toast('An easing is four numbers, like 0.4, 0, 0.2, 1 (the first and third between 0 and 1).'), render();
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
  const id = input.dataset.renameGroup;
  if (renamingGroup !== id) return;
  renamingGroup = null;
  const col = active();
  const name = input.value.trim();
  if (!name || !col || name === findGroup(col, id)?.name) return render();
  change(() => renameGroup(col, id, name));
}
