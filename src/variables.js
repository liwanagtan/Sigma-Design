// Variables: collections of color / number / string / boolean values with modes and aliases.
//
// doc.variables = { collections: [{ id, name, modes: [{ id, name }], defaultModeId,
//                                   variables: [{ id, name, type, valuesByMode: { [modeId]: value | { alias: varId } } }] }] }
// A layer binds a property path to a variable: node.bindings = { 'fills.0.color': varId, 'radius': varId, ... }.
// resolveVariables() (a normalize step) writes each bound variable's value into the bound property, so the
// renderer, layout and export only ever see plain values.
import { state, walk, addEditHook, uid } from './store.js';
import { measureText } from './text.js';
import { owningInstance } from './components.js';
import {
  groupOf, leafOf, cleanSegment, cleanPath, normalizeGroups, groupPaths, structureOf,
} from './token-groups.js';

export const VAR_TYPES = { color: 'Color', number: 'Number', string: 'String', boolean: 'Boolean', typography: 'Typography' };

// A typography token bundles five text properties. Each field is a value or { alias: tokenId } of the
// field's primitive type. lineHeight is a percentage, or null for "auto".
export const TYPO_FIELDS = {
  fontFamily: 'string', fontWeight: 'number', fontSize: 'number', lineHeight: 'number', letterSpacing: 'number',
};

// Color tokens are '#RRGGBB' or '#RRGGBBAA'; the editor shows hex and opacity separately.
export function splitColor(value) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(value || ''));
  if (!m) return { hex: '#000000', alpha: 1 };
  return { hex: `#${m[1].toUpperCase()}`, alpha: m[2] ? Math.round((parseInt(m[2], 16) / 255) * 100) / 100 : 1 };
}

export function joinColor(hex, alpha = 1) {
  const a = Math.max(0, Math.min(1, alpha));
  const h = splitColor(hex).hex;
  return a >= 1 ? h : h + Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
}

// Which property paths each variable type can bind to.
const NUMBER_PATHS = new Set([
  'w', 'h', 'radius', 'opacity', 'strokeWidth', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'layout.gap', 'layout.pt', 'layout.pr', 'layout.pb', 'layout.pl',
]);
export function typeForPath(path) {
  if (/^(fills|strokes)\.\d+\.color$/.test(path)) return 'color';
  if (NUMBER_PATHS.has(path)) return 'number';
  if (path === 'text' || path === 'fontFamily') return 'string';
  if (path === 'visible') return 'boolean';
  if (path === 'typography') return 'typography';
  return null;
}

const DEFAULTS = {
  color: '#000000', number: 0, string: '', boolean: true,
  typography: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, lineHeight: null, letterSpacing: 0 },
};
export const defaultValue = (type) => structuredClone(DEFAULTS[type]);
const MAX_ALIAS_DEPTH = 16;

// A design file's tokens come from its own (local) collections and from snapshots of linked token files
// (doc.libraries[].collections, each marked fromLibrary: fileId). Everything resolves together, but only
// local collections are edited here.
//
// A token file can link other token files too, and its tokens can alias theirs ("Brand" → "Core"). Its
// published version then carries copies of those libraries (published.dependencies), so a file that links
// only "Brand" still resolves the "Core" tokens it points at. A library linked directly always wins over
// a copy that came along as a dependency.
export const localCollections = () => state.doc?.variables?.collections || [];

// Dependencies of linked libraries that aren't linked directly: the newest copy of each.
export function dependencyLibraries() {
  const libs = state.doc?.libraries || [];
  const direct = new Set(libs.map((l) => l.fileId));
  const deps = new Map();
  for (const l of libs) {
    for (const d of l.dependencies || []) {
      if (direct.has(d.fileId)) continue;
      const cur = deps.get(d.fileId);
      if (!cur || d.version > cur.version) deps.set(d.fileId, { ...d, via: l.name });
    }
  }
  return [...deps.values()];
}

export const libraryCollections = () => [
  ...(state.doc?.libraries || []).flatMap((l) => l.collections || []),
  ...dependencyLibraries().flatMap((d) => d.collections || []),
];
export const collections = () => [...localCollections(), ...libraryCollections()];
export const isLibraryCollection = (c) => !!c?.fromLibrary;
// The linked library (or dependency, with `via`) a collection comes from.
export const libraryOf = (c) => (c?.fromLibrary
  ? (state.doc?.libraries || []).find((l) => l.fileId === c.fromLibrary) || dependencyLibraries().find((d) => d.fileId === c.fromLibrary) || null
  : null);

// Copy published collections for a design file, marked with the token file they came from.
export function snapshotForLibrary(cols, fileId) {
  return structuredClone(cols || []).map((c) => ({ ...c, fromLibrary: fileId }));
}

// What changed between two published versions: token and collection names added, changed or removed.
export function diffCollections(before, after) {
  const index = (cols) => {
    const m = new Map();
    for (const c of cols || []) {
      m.set(`col:${c.id}`, { name: `Collection “${c.name}”`, sig: JSON.stringify([c.name, c.modes?.map((x) => x.name), c.extends || null]) });
      for (const v of c.variables || []) m.set(v.id, { name: v.name, sig: JSON.stringify([v.name, v.type, v.valuesByMode, v.description || '']) });
      const paths = groupPaths((c.groups || []).filter((g) => g && typeof g === 'object'));
      for (const g of (c.groups || []).filter((x) => x && typeof x === 'object')) {
        m.set(`grp:${g.id}`, { name: `Group “${paths.get(g.id)}”`, sig: JSON.stringify([paths.get(g.id), g.description || '']) });
      }
      for (const [vid, ov] of Object.entries(c.overrides || {})) m.set(`${c.id}:${vid}`, { name: `${c.name}: override`, sig: JSON.stringify(ov) });
    }
    return m;
  };
  const a = index(before), b = index(after);
  const added = [], changed = [], removed = [];
  for (const [k, v] of b) {
    if (!a.has(k)) added.push(v.name);
    else if (a.get(k).sig !== v.sig) changed.push(v.name);
  }
  for (const [k, v] of a) if (!b.has(k)) removed.push(v.name);
  return { added, changed, removed };
}

// Token files a published version points at that are new or at another version: ["Core v1 → v2", …].
export function dependencyChanges(before = [], after = []) {
  const was = new Map(before.map((d) => [d.fileId, d.version]));
  return after.filter((d) => was.get(d.fileId) !== d.version)
    .map((d) => (was.has(d.fileId) ? `${d.name} v${was.get(d.fileId)} → v${d.version}` : `${d.name} v${d.version}`));
}

function variablesRoot() {
  if (!state.doc.variables) state.doc.variables = { collections: [] };
  return state.doc.variables;
}


// ---------- lookup ----------
// Extended collections ({ extends: parentId, modes: [{ id, name, parentModeId }], overrides: { varId: { modeId: value } } })
// inherit their parent's variables and modes and store only the values they change.
let index = new Map(); // varId -> { variable, collection } (the collection that defines it)
let colIndex = new Map(); // collectionId -> collection

function reindexVariables() {
  index = new Map();
  colIndex = new Map();
  for (const c of collections()) {
    colIndex.set(c.id, c);
    for (const v of c.variables || []) index.set(v.id, { variable: v, collection: c });
  }
  for (const c of collections()) if (c.extends) syncExtensionModes(c);
}

export const isExtension = (c) => !!c?.extends;
export const parentOf = (c) => (c?.extends ? colIndex.get(c.extends) || null : null);

// Is `c` the collection `root`, or an extension of it (at any depth)?
export function inFamily(c, root) {
  for (let cur = c, guard = 0; cur && guard < 32; cur = parentOf(cur), guard++) if (cur === root) return true;
  return false;
}

// Keep an extension's modes matching its parent's: add modes the parent gained, drop ones it lost.
function syncExtensionModes(ext) {
  const parent = parentOf(ext);
  if (!parent) return;
  ext.modes = ext.modes.filter((m) => parent.modes.some((pm) => pm.id === m.parentModeId));
  for (const pm of parent.modes) {
    if (!ext.modes.some((m) => m.parentModeId === pm.id)) ext.modes.push({ id: uid(), name: pm.name, parentModeId: pm.id });
  }
  if (!ext.modes.some((m) => m.id === ext.defaultModeId)) ext.defaultModeId = ext.modes[0]?.id;
}

// The raw value (a value or an alias) of `variable` in collection `c` (its own or an extension), mode `modeId`.
export function rawValueIn(c, modeId, variable, depth = 0) {
  if (!c.extends || depth > 32) {
    const v = variable.valuesByMode[modeId];
    return v === undefined ? variable.valuesByMode[c.defaultModeId] : v;
  }
  const own = c.overrides?.[variable.id]?.[modeId];
  if (own !== undefined) return own;
  const parent = parentOf(c);
  if (!parent) {
    const owner = index.get(variable.id)?.collection; // orphaned extension: use the defining collection
    return owner ? variable.valuesByMode[owner.defaultModeId] : undefined;
  }
  const mode = c.modes.find((m) => m.id === modeId);
  return rawValueIn(parent, mode?.parentModeId || parent.defaultModeId, variable, depth + 1);
}

export function findVariable(id) {
  reindexVariables();
  return index.get(id) || null;
}

export function allVariables(type = null) {
  const out = [];
  for (const c of collections()) for (const v of c.variables) if (!type || v.type === type) out.push({ variable: v, collection: c });
  return out;
}

const isAlias = (v) => !!v && typeof v === 'object' && typeof v.alias === 'string';

// Resolve a variable. `pick(rootCollection)` returns the active { collection, modeId } for that variable's
// family: the root itself or one of its extensions.
export function resolveValue(varId, pick, depth = 0) {
  if (depth > MAX_ALIAS_DEPTH) return undefined;
  const hit = index.get(varId);
  if (!hit) return undefined;
  const { collection, modeId } = pick(hit.collection);
  const v = rawValueIn(collection, modeId, hit.variable);
  if (isAlias(v)) return resolveValue(v.alias, pick, depth + 1);
  if (hit.variable.type === 'typography' && v && typeof v === 'object') {
    // Resolve each field; a field may alias a number or string token.
    const out = {};
    for (const f of Object.keys(TYPO_FIELDS)) out[f] = isAlias(v[f]) ? resolveValue(v[f].alias, pick, depth + 1) : v[f];
    return out;
  }
  return v;
}

// A picker for a mode context { collectionId: modeId } whose keys are ordered farthest → nearest.
// The nearest entry for any collection in the variable's family wins.
function contextPicker(ctx) {
  const keys = Object.keys(ctx);
  return (root) => {
    for (let i = keys.length - 1; i >= 0; i--) {
      const c = colIndex.get(keys[i]);
      if (c && inFamily(c, root) && c.modes.some((m) => m.id === ctx[keys[i]])) return { collection: c, modeId: ctx[keys[i]] };
    }
    return { collection: root, modeId: root.defaultModeId };
  };
}

// ---------- applying values ----------
function setPath(node, path, value) {
  const parts = path.split('.');
  let obj = node;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj?.[parts[i]];
    if (obj == null || typeof obj !== 'object') return false;
  }
  const last = parts[parts.length - 1];
  if (obj[last] === value) return false;
  obj[last] = value;
  return true;
}

function applyBinding(node, path, value) {
  const type = typeForPath(path);
  if (value === undefined || value === null || !type) return;
  if (type === 'color') {
    if (!/^#([0-9a-f]{6})([0-9a-f]{2})?$/i.test(String(value))) return;
    const [kind, i] = path.split('.');
    const paint = node[kind]?.[+i];
    if (!paint) return;
    // The token's opacity is the paint's opacity (100% when the token has none).
    const { hex, alpha } = splitColor(value);
    paint.color = hex;
    paint.opacity = alpha;
    return;
  }
  if (type === 'typography') {
    if (node.type !== 'text' || !value || typeof value !== 'object') return;
    let changed = false;
    for (const f of Object.keys(TYPO_FIELDS)) {
      let x = value[f];
      if (x === undefined) continue;
      if (f !== 'fontFamily' && f !== 'lineHeight') x = Number(x);
      if (f === 'lineHeight' && x !== null) x = Number(x);
      if (node[f] !== x) {
        node[f] = x;
        changed = true;
      }
    }
    if (changed) measureText(node);
    return;
  }
  if (type === 'number') {
    let n = Number(value);
    if (!Number.isFinite(n)) return;
    if (path === 'opacity' && n > 1) n /= 100; // opacity variables are percentages, like Figma
    if (path === 'w' || path === 'h') n = Math.max(0.01, n);
    setPath(node, path, n);
    return;
  }
  if (type === 'boolean') return void setPath(node, path, !!value);
  if (setPath(node, path, String(value)) && node.type === 'text') measureText(node);
}

// Normalize step: write every bound variable's value into its layer property.
export function resolveVariables() {
  const doc = state.doc;
  if (!doc || !collections().length) return; // local tokens or linked token files
  reindexVariables();
  for (const pg of doc.pages) {
    const visit = (nodes, ctx) => {
      for (const n of nodes) {
        // Re-insert this layer's modes so they come last (nearest) in key order.
        const here = n.modes
          ? Object.assign(Object.fromEntries(Object.entries(ctx).filter(([k]) => !(k in n.modes))), n.modes)
          : ctx;
        if (n.bindings) {
          const pick = contextPicker(here);
          for (const [path, varId] of Object.entries(n.bindings)) applyBinding(n, path, resolveValue(varId, pick));
        }
        if (n.children) visit(n.children, here);
      }
    };
    visit(pg.children, pg.modes || {});
  }
}

// The mode a layer inherits for `col` from its ancestors or page, or null if none pins one.
export function inheritedMode(node, col, ancestorsOf, pageOfNode) {
  for (const a of ancestorsOf(node)) if (a.modes?.[col.id]) return a.modes[col.id];
  return pageOfNode(node)?.modes?.[col.id] || null;
}

// Collections worth a mode picker: roots with several modes, and every extension (picking one applies it).
export const multiModeCollections = () => collections().filter((c) => c.modes.length > 1 || c.extends);

// Resolved value of a variable in each collection's default mode (for previews in menus and the editor).
export function previewValue(varId) {
  reindexVariables();
  return resolveValue(varId, (root) => ({ collection: root, modeId: root.defaultModeId }));
}

// ---------- binding ----------
export function bindVariable(node, path, varId) {
  (node.bindings ||= {})[path] = varId;
}

export function unbindVariable(node, path) {
  if (!node.bindings) return;
  delete node.bindings[path];
  if (!Object.keys(node.bindings).length) delete node.bindings;
}

// After removing paint `index` from node[kind], move bindings of later paints down one slot.
export function shiftPaintBindings(node, kind, index) {
  if (!node.bindings) return;
  const next = {};
  for (const [path, varId] of Object.entries(node.bindings)) {
    const m = new RegExp(`^${kind}\\.(\\d+)\\.(.+)$`).exec(path);
    if (!m) next[path] = varId;
    else if (+m[1] < index) next[path] = varId;
    else if (+m[1] > index) next[`${kind}.${+m[1] - 1}.${m[2]}`] = varId;
  }
  node.bindings = next;
  if (!Object.keys(next).length) delete node.bindings;
}

// Typing a raw value into a bound property detaches the variable (like Figma). Runs after the
// component hook, so for layers inside instances the detached state is recorded as an override.
addEditHook({
  after(node, keys) {
    if (!node.bindings) return;
    let changed = false;
    if (node.bindings.typography && keys.some((k) => k in TYPO_FIELDS)) {
      delete node.bindings.typography; // changing one font property by hand detaches the text style
      changed = true;
    }
    for (const k of keys) {
      if (k === 'bindings') continue;
      for (const path of Object.keys(node.bindings)) {
        if (path === k || path.startsWith(k + '.')) {
          delete node.bindings[path];
          changed = true;
        }
      }
    }
    if (!changed) return;
    if (!Object.keys(node.bindings).length) delete node.bindings;
    const owner = owningInstance(node);
    const record = owner && node.pathKey ? [owner, node.pathKey] : node.type === 'instance' ? [node, ''] : null;
    if (record) ((record[0].overrides ||= {})[record[1]] ||= {}).bindings = structuredClone(node.bindings || {});
  },
});

// ---------- editing collections and variables ----------
export function createCollection(name = 'Collection') {
  const root = variablesRoot();
  let label = name;
  for (let i = 2; root.collections.some((c) => c.name === label); i++) label = `${name} ${i}`;
  const mode = { id: uid(), name: 'Mode 1' };
  const col = { id: uid(), name: label, modes: [mode], defaultModeId: mode.id, variables: [] };
  root.collections.push(col);
  return col;
}

export function deleteCollection(col) {
  reindexVariables();
  for (const ext of collections().filter((c) => c !== col && inFamily(c, col))) deleteCollection(ext);
  for (const v of [...(col.variables || [])]) deleteVariable(v.id);
  const root = variablesRoot();
  root.collections = root.collections.filter((c) => c !== col);
}

// Create an extension of `parent`: same variables and modes, no values of its own yet.
export function extendCollection(parent) {
  const root = variablesRoot();
  let name = `${parent.name} (extended)`;
  for (let i = 2; root.collections.some((c) => c.name === name); i++) name = `${parent.name} (extended ${i})`;
  const modes = parent.modes.map((m) => ({ id: uid(), name: m.name, parentModeId: m.id }));
  const ext = { id: uid(), name, extends: parent.id, modes, defaultModeId: modes[0].id, variables: [], overrides: {} };
  root.collections.push(ext);
  return ext;
}

// Variables an extension shows: everything defined up its chain.
export function inheritedVariables(ext) {
  reindexVariables();
  let root = ext;
  for (let guard = 0; root?.extends && guard < 32; guard++) root = parentOf(root);
  return root?.variables || [];
}

export function setOverride(ext, varId, modeId, value) {
  ((ext.overrides ||= {})[varId] ||= {})[modeId] = value;
}

export function setOverrideAlias(ext, varId, modeId, targetId) {
  const v = findVariable(varId)?.variable;
  const target = findVariable(targetId)?.variable;
  if (!v || !target || v.type !== target.type || varId === targetId || wouldCycle(varId, targetId)) return false;
  setOverride(ext, varId, modeId, { alias: targetId });
  return true;
}

export function clearOverride(ext, varId, modeId) {
  if (!ext.overrides?.[varId]) return;
  delete ext.overrides[varId][modeId];
  if (!Object.keys(ext.overrides[varId]).length) delete ext.overrides[varId];
}

export function addMode(col, name) {
  let label = name || `Mode ${col.modes.length + 1}`;
  for (let i = col.modes.length + 2; col.modes.some((m) => m.name === label); i++) label = `Mode ${i}`;
  const mode = { id: uid(), name: label };
  col.modes.push(mode);
  // New modes start as copies of the default mode.
  for (const v of col.variables) v.valuesByMode[mode.id] = structuredClone(v.valuesByMode[col.defaultModeId]);
  return mode;
}

export function removeMode(col, modeId) {
  if (col.modes.length < 2) return;
  col.modes = col.modes.filter((m) => m.id !== modeId);
  if (col.defaultModeId === modeId) col.defaultModeId = col.modes[0].id;
  for (const v of col.variables) delete v.valuesByMode[modeId];
}

// A new token, at the top level or in group `groupId`, with a name no other token there has.
export function createVariable(col, type, name, groupId = null) {
  const base = cleanSegment(name) || `${VAR_TYPES[type].toLowerCase()}`;
  const taken = (label) => col.variables.some((v) => (v.groupId || null) === (groupId || null) && leafOf(v.name) === label);
  let label = base;
  for (let i = 2; taken(label); i++) label = `${base} ${i}`;
  const v = { id: uid(), name: label, type, valuesByMode: {} };
  if (groupId) v.groupId = groupId;
  for (const m of col.modes) v.valuesByMode[m.id] = defaultValue(type);
  col.variables.push(v);
  normalizeGroups(col); // its name becomes its full path
  return v;
}

// Delete a variable. Layers bound to it keep their current value; aliases to it become plain values.
export function deleteVariable(varId) {
  reindexVariables();
  const hit = index.get(varId);
  if (!hit) return;
  const literal = previewValue(varId) ?? defaultValue(hit.variable.type);
  // Typography fields that alias the deleted token become plain values too.
  const fixFields = (val) => {
    if (!val || typeof val !== 'object' || isAlias(val)) return;
    for (const f of Object.keys(TYPO_FIELDS)) if (isAlias(val[f]) && val[f].alias === varId) val[f] = literal;
  };
  for (const c of collections()) {
    for (const v of c.variables || []) {
      for (const [m, val] of Object.entries(v.valuesByMode)) {
        if (isAlias(val) && val.alias === varId) v.valuesByMode[m] = literal;
        else fixFields(val);
      }
    }
    for (const byMode of Object.values(c.overrides || {})) for (const val of Object.values(byMode)) fixFields(val);
    if (c.overrides) {
      delete c.overrides[varId];
      for (const byMode of Object.values(c.overrides)) {
        for (const [m, val] of Object.entries(byMode)) if (isAlias(val) && val.alias === varId) byMode[m] = literal;
      }
    }
  }
  for (const pg of state.doc.pages) {
    walk(pg.children, (n) => {
      if (!n.bindings) return;
      for (const [path, id] of Object.entries(n.bindings)) if (id === varId) delete n.bindings[path];
      if (!Object.keys(n.bindings).length) delete n.bindings;
    });
  }
  hit.collection.variables = hit.collection.variables.filter((v) => v.id !== varId);
}

// Would making `varId` alias `targetId` create a loop?
export function wouldCycle(varId, targetId) {
  reindexVariables();
  const seen = new Set();
  let frontier = [targetId];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      if (id === varId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const hit = index.get(id);
      if (!hit) continue;
      for (const val of Object.values(hit.variable.valuesByMode)) if (isAlias(val)) next.push(val.alias);
    }
    frontier = next;
  }
  return false;
}

// ---------- references ----------
// Every value a token holds in one mode, including typography fields: [value, write(newValue)].
function eachValue(fn) {
  for (const c of localCollections()) {
    const visit = (holder, key) => {
      const val = holder[key];
      fn(val, (x) => void (holder[key] = x));
      if (val && typeof val === 'object' && !isAlias(val)) {
        for (const f of Object.keys(TYPO_FIELDS)) if (val[f] !== undefined) fn(val[f], (x) => void (val[f] = x));
      }
    };
    for (const v of c.variables || []) for (const m of Object.keys(v.valuesByMode)) visit(v.valuesByMode, m);
    for (const byMode of Object.values(c.overrides || {})) for (const m of Object.keys(byMode)) visit(byMode, m);
  }
}

// Ids of tokens that this file's own tokens alias.
export function referencedIds() {
  const ids = new Set();
  eachValue((val) => isAlias(val) && ids.add(val.alias));
  return ids;
}

// Replace aliases to `ids` with the values they resolve to now (before a library is unlinked). Returns the count.
export function detachAliasesTo(ids) {
  reindexVariables();
  let n = 0;
  const literal = new Map();
  eachValue((val, write) => {
    if (!isAlias(val) || !ids.has(val.alias)) return;
    if (!literal.has(val.alias)) literal.set(val.alias, previewValue(val.alias) ?? defaultValue(index.get(val.alias)?.variable.type || 'string'));
    write(structuredClone(literal.get(val.alias)));
    n++;
  });
  return n;
}

// The steps from a token's value in `col` / `modeId` to the value it finally resolves to:
// { steps: [{ id, variable, collection } | { id, missing: true }], value }. Tokens in the same collection
// family follow the same mode; others use their default mode.
export function aliasChain(col, modeId, variable) {
  reindexVariables();
  const pick = (root) => (inFamily(col, root) ? { collection: col, modeId } : { collection: root, modeId: root.defaultModeId });
  const steps = [];
  let raw = rawValueIn(col, modeId, variable);
  while (isAlias(raw) && steps.length <= MAX_ALIAS_DEPTH) {
    const hit = index.get(raw.alias);
    if (!hit) {
      steps.push({ id: raw.alias, missing: true });
      return { steps, value: undefined };
    }
    steps.push({ id: raw.alias, ...hit });
    const at = pick(hit.collection);
    raw = rawValueIn(at.collection, at.modeId, hit.variable);
  }
  if (raw && typeof raw === 'object' && !isAlias(raw)) raw = resolveValue(steps.at(-1)?.id || variable.id, pick);
  return { steps, value: raw };
}

// A token from a typed reference like "{color/brand/primary}" or "{color.brand.primary}", of `type`.
// This file's own tokens win over library tokens with the same name.
export function findByReference(text, type = null) {
  const m = /^\s*\{?\s*([^{}]+?)\s*\}?\s*$/.exec(String(text || ''));
  if (!m) return null;
  const ref = m[1].replace(/\s*[./]\s*/g, '/');
  for (const c of collections()) {
    const v = (c.variables || []).find((x) => x.name.replace(/\s*\/\s*/g, '/') === ref && (!type || x.type === type));
    if (v) return { variable: v, collection: c };
  }
  return null;
}

// ---------- groups ----------
// A collection holds tokens and groups; groups hold tokens and groups (see token-groups.js). Tokens and
// groups are edited in root collections; extensions show their root's groups.
export { groupOf, leafOf };

function groupOwner(col) {
  let root = col;
  for (let guard = 0; root?.extends && guard < 32; guard++) root = parentOf(root);
  return root || col;
}

const structure = (col) => structureOf(groupOwner(col));

// Nested groups in order: [{ id, name, path, description, count, children }]; count includes subgroups.
export function groupTree(col) {
  reindexVariables();
  const owner = groupOwner(col);
  const { groups, groupIdOf } = structureOf(owner);
  const paths = groupPaths(groups);
  const nodes = new Map(groups.map((g) => [g.id, { id: g.id, name: g.name, path: paths.get(g.id), description: g.description || '', count: 0, children: [] }]));
  const roots = [];
  for (const g of groups) (g.parentId && nodes.has(g.parentId) ? nodes.get(g.parentId).children : roots).push(nodes.get(g.id));
  const parentOfGroup = new Map(groups.map((g) => [g.id, g.parentId || null]));
  for (const v of owner.variables || []) for (let id = groupIdOf(v); id && nodes.has(id); id = parentOfGroup.get(id)) nodes.get(id).count++;
  return roots;
}

export const findGroup = (col, id) => structure(col).groups.find((g) => g.id === id) || null;
export const groupIdOf = (col, v) => structure(col).groupIdOf(v);
export const groupPathOf = (col, id) => (id ? groupPaths(structure(col).groups).get(id) || '' : '');

// Group `id` and every group inside it.
export function groupAndDescendants(col, id) {
  const { groups } = structure(col);
  const out = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const g of groups) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) out.add(g.id), (grew = true);
  }
  return out;
}

// Is token `v` in group `id` (directly or in a group inside it)? A null id is the whole collection.
export function tokenInGroup(col, v, id) {
  if (!id) return true;
  const { groups, groupIdOf: gid } = structure(col);
  const parent = new Map(groups.map((g) => [g.id, g.parentId || null]));
  for (let g = gid(v), guard = 0; g && guard < 64; g = parent.get(g), guard++) if (g === id) return true;
  return false;
}

// Tokens of `col` in display order: the top level first, then each group's tokens, depth first.
export function tokensInOrder(col, vars) {
  const { groups, groupIdOf: gid } = structure(col);
  const rank = new Map();
  let i = 0;
  const visit = (parentId) => {
    rank.set(parentId, i++);
    for (const g of groups) if ((g.parentId || null) === parentId) visit(g.id);
  };
  visit(null);
  const pos = new Map(vars.map((v, k) => [v.id, k]));
  return [...vars].sort((a, b) => (rank.get(gid(a) || null) ?? 0) - (rank.get(gid(b) || null) ?? 0) || pos.get(a.id) - pos.get(b.id));
}

const siblingNameTaken = (col, parentId, name, exceptId) =>
  (col.groups || []).some((g) => (g.parentId || null) === (parentId || null) && g.name === name && g.id !== exceptId);
function uniqueGroupName(col, parentId, base, exceptId = null) {
  let name = base;
  for (let i = 2; siblingNameTaken(col, parentId, name, exceptId); i++) name = `${base} ${i}`;
  return name;
}

// A new, empty group inside `parentId` (or at the top level). Returns its id.
export function createGroup(col, parentId = null, name = 'New group') {
  normalizeGroups(col);
  const g = { id: uid(), name: uniqueGroupName(col, parentId, cleanSegment(name) || 'Group'), parentId: parentId || null };
  col.groups.push(g);
  return g.id;
}

export function renameGroup(col, id, name) {
  const g = (col.groups || []).find((x) => x.id === id);
  name = cleanSegment(name);
  if (!g || !name) return;
  g.name = uniqueGroupName(col, g.parentId, name, id);
  normalizeGroups(col); // token paths follow
}

export function setGroupDescription(col, id, text) {
  const g = (col.groups || []).find((x) => x.id === id);
  if (!g) return;
  if (text?.trim()) g.description = text.trim();
  else delete g.description;
}

// Move a group into `parentId` (null: top level), before sibling `beforeId` or after the others.
// A group can't move into itself or a group inside it. Returns false if refused.
export function moveGroup(col, id, parentId = null, beforeId = null) {
  const g = (col.groups || []).find((x) => x.id === id);
  if (!g || (parentId && groupAndDescendants(col, id).has(parentId)) || beforeId === id) return false;
  g.parentId = parentId || null;
  g.name = uniqueGroupName(col, g.parentId, g.name, id);
  col.groups = col.groups.filter((x) => x !== g);
  const at = beforeId ? col.groups.findIndex((x) => x.id === beforeId) : -1;
  if (at >= 0) col.groups.splice(at, 0, g);
  else col.groups.push(g);
  normalizeGroups(col);
  return true;
}

// Move tokens into group `groupId` (null: top level), before token `beforeId` or after the others.
export function moveTokensToGroup(col, ids, groupId = null, beforeId = null) {
  const moving = col.variables.filter((v) => ids.includes(v.id));
  for (const v of moving) {
    if (groupId) v.groupId = groupId;
    else delete v.groupId;
  }
  if (beforeId && !ids.includes(beforeId)) {
    const rest = col.variables.filter((v) => !ids.includes(v.id));
    const at = rest.findIndex((v) => v.id === beforeId);
    rest.splice(at >= 0 ? at : rest.length, 0, ...moving);
    col.variables = rest;
  }
  normalizeGroups(col);
}

// Remove a group but keep what's in it, one level up (in its place).
export function ungroup(col, id) {
  const g = (col.groups || []).find((x) => x.id === id);
  if (!g) return;
  for (const child of col.groups) {
    if (child.parentId === id) {
      child.parentId = g.parentId || null;
      child.name = uniqueGroupName(col, child.parentId, child.name, child.id);
    }
  }
  for (const v of col.variables) {
    if (v.groupId !== id) continue;
    if (g.parentId) v.groupId = g.parentId;
    else delete v.groupId;
  }
  col.groups = col.groups.filter((x) => x !== g);
  normalizeGroups(col);
}

// Delete a group, the groups in it and their tokens (layers and aliases keep their current values).
export function deleteGroup(col, id) {
  const ids = groupAndDescendants(col, id);
  for (const v of col.variables.filter((x) => ids.has(x.groupId))) deleteVariable(v.id);
  col.groups = (col.groups || []).filter((g) => !ids.has(g.id));
  normalizeGroups(col);
}

// Rename a token. `typed` is relative to its group: "a/b" puts it in a (new or existing) group "a"
// inside its group; a leading "/" starts from the top of the collection.
export function setTokenName(col, v, typed) {
  typed = String(typed || '').trim().replace(/\s*\/\s*/g, '/');
  const leaf = cleanSegment(leafOf(typed));
  if (!leaf) return;
  let parent = typed.startsWith('/') ? null : v.groupId || null;
  for (const seg of cleanPath(groupOf(typed.replace(/^\/+/, ''))).split('/').filter(Boolean)) {
    const name = cleanSegment(seg);
    parent = (col.groups || []).find((g) => (g.parentId || null) === parent && g.name === name)?.id || createGroup(col, parent, name);
  }
  if (parent) v.groupId = parent;
  else delete v.groupId;
  v.name = leaf;
  normalizeGroups(col);
}

// Normalize step: keep every local collection's groups and token paths consistent (imports and merges
// add tokens by path; older files have paths only).
export function normalizeTokenGroups() {
  for (const c of localCollections()) normalizeGroups(c);
}

export function setAlias(variable, modeId, targetId) {
  if (!targetId) return false;
  const target = findVariable(targetId);
  if (!target || target.variable.type !== variable.type || wouldCycle(variable.id, targetId)) return false;
  variable.valuesByMode[modeId] = { alias: targetId };
  return true;
}

export { isAlias };
