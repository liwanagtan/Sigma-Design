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

export const VAR_TYPES = { color: 'Color', number: 'Number', string: 'String', boolean: 'Boolean' };

// Which property paths each variable type can bind to.
const NUMBER_PATHS = new Set([
  'w', 'h', 'radius', 'opacity', 'strokeWidth', 'fontSize', 'lineHeight', 'letterSpacing',
  'layout.gap', 'layout.pt', 'layout.pr', 'layout.pb', 'layout.pl',
]);
export function typeForPath(path) {
  if (/^(fills|strokes)\.\d+\.color$/.test(path)) return 'color';
  if (NUMBER_PATHS.has(path)) return 'number';
  if (path === 'text' || path === 'fontFamily') return 'string';
  if (path === 'visible') return 'boolean';
  return null;
}

const DEFAULTS = { color: '#000000', number: 0, string: '', boolean: true };
const MAX_ALIAS_DEPTH = 16;

export const collections = () => state.doc?.variables?.collections || [];

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
  return isAlias(v) ? resolveValue(v.alias, pick, depth + 1) : v;
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
    const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(value));
    if (!m) return;
    const [kind, i] = path.split('.');
    const paint = node[kind]?.[+i];
    if (!paint) return;
    paint.color = `#${m[1].toUpperCase()}`;
    if (m[2]) paint.opacity = Math.round((parseInt(m[2], 16) / 255) * 100) / 100;
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
  if (!doc?.variables?.collections?.length) return;
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

export function createVariable(col, type, name) {
  const base = name || `${VAR_TYPES[type].toLowerCase()}`;
  let label = base;
  for (let i = 2; col.variables.some((v) => v.name === label); i++) label = `${base} ${i}`;
  const v = { id: uid(), name: label, type, valuesByMode: {} };
  for (const m of col.modes) v.valuesByMode[m.id] = DEFAULTS[type];
  col.variables.push(v);
  return v;
}

// Delete a variable. Layers bound to it keep their current value; aliases to it become plain values.
export function deleteVariable(varId) {
  reindexVariables();
  const hit = index.get(varId);
  if (!hit) return;
  const literal = previewValue(varId) ?? DEFAULTS[hit.variable.type];
  for (const c of collections()) {
    for (const v of c.variables || []) {
      for (const [m, val] of Object.entries(v.valuesByMode)) {
        if (isAlias(val) && val.alias === varId) v.valuesByMode[m] = literal;
      }
    }
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

export function setAlias(variable, modeId, targetId) {
  if (!targetId) return false;
  const target = findVariable(targetId);
  if (!target || target.variable.type !== variable.type || wouldCycle(variable.id, targetId)) return false;
  variable.valuesByMode[modeId] = { alias: targetId };
  return true;
}

export { isAlias };
