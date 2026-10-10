// Components and instances.
//
// An instance stores real ("materialized") children copied from its main component, so rendering,
// hit testing, layout and export need no special cases. syncInstances() rebuilds them on every
// normalize pass:
//   - derived layers get stable ids `${instanceId}/${sourceId}` so selection and undo survive re-syncs
//   - each derived layer remembers `sourceId` and `pathKey`, its layer-name path from the instance root
//   - instance.overrides = { [pathKey]: { prop: value } } ('' is the instance root itself), recorded by
//     an edit hook whenever an overridable property of an instance layer is edited
// Overrides are keyed by layer name (not id), which is what lets them survive variant switches.
import {
  state, walk, getNode, ancestors, addEditHook, uid, createNode, insertNode, setWorldMatrix,
  reindex, isFrameLike,
} from './store.js';
import { translate } from './geom.js';
import { measureText } from './text.js';

export const isInstance = (n) => n?.type === 'instance';
export const isComponent = (n) => n?.type === 'component';

// Instance root properties copied from the main component unless overridden on the instance.
const ROOT_PROPS = ['fills', 'strokes', 'strokeWidth', 'strokeAlign', 'radius', 'clip', 'layout', 'opacity', 'name'];
// Root size/sizing follows the main component until the instance itself is resized.
const ROOT_FOLLOW = ['w', 'h', 'sizingH', 'sizingV'];
// Properties of layers inside an instance that can be overridden. Everything else (position, size,
// structure) comes from the main component.
const CHILD_OVERRIDABLE = new Set([
  'fills', 'strokes', 'strokeWidth', 'strokeAlign', 'cap', 'opacity', 'visible', 'radius', 'name',
  'text', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign',
  'componentId', 'propValues', 'variantProps', 'bindings', 'modes',
]);
const TEXT_PROPS = ['text', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];

const clone = (v) => (v === undefined || v === null || typeof v !== 'object' ? v : structuredClone(v));
const escKey = (name) => String(name).replace(/%/g, '%25').replace(/\//g, '%2F').replace(/#/g, '%23');

// The outermost instance that contains `node` (excluding node itself). Overrides live there.
export function owningInstance(node) {
  let owner = null;
  for (const a of ancestors(node)) if (a.type === 'instance') owner = a;
  return owner;
}
export const isInsideInstance = (n) => !!n && !!owningInstance(n);

export function componentMap(doc = state.doc) {
  const map = new Map();
  for (const pg of doc?.pages || []) walk(pg.children, (n) => {
    if (n.type === 'component') map.set(n.id, n);
    if (n.type === 'instance') return false; // components never live inside instances
  });
  return map;
}

export function listComponents() {
  const out = [];
  for (const pg of state.doc?.pages || []) walk(pg.children, (n) => {
    if (n.type === 'component') out.push({ node: n, page: pg });
    if (n.type === 'instance') return false;
  });
  return out;
}

export function instancesOf(componentId) {
  const out = [];
  for (const pg of state.doc?.pages || []) walk(pg.children, (n) => {
    if (n.type === 'instance') {
      if (n.componentId === componentId) out.push(n);
      return false;
    }
  });
  return out;
}

// ---------- sync ----------
const measureCache = new Map();

// Text layers whose text or font was overridden need re-measuring; cache by content.
function remeasure(n) {
  if (n.autoResize === 'fixed') return;
  const key = JSON.stringify([n.text, n.fontFamily, n.fontSize, n.fontWeight, n.lineHeight, n.letterSpacing, n.autoResize, n.autoResize === 'height' ? n.w : 0]);
  let size = measureCache.get(key);
  if (!size) {
    measureText(n);
    size = { w: n.w, h: n.h };
    if (measureCache.size > 2000) measureCache.clear();
    measureCache.set(key, size);
  }
  n.w = size.w;
  n.h = size.h;
}

function applyRootProps(target, main, rootOverride) {
  for (const k of ROOT_PROPS) target[k] = clone(k in rootOverride ? rootOverride[k] : main[k]);
}

function deriveChildren(srcList, ownerId, parentPath, overrides, prev, comps) {
  const counts = new Map();
  return srcList.map((src) => {
    const c = (counts.get(src.name) || 0) + 1;
    counts.set(src.name, c);
    const key = escKey(src.name) + (c > 1 ? `#${c}` : '');
    const path = parentPath ? `${parentPath}/${key}` : key;
    const id = `${ownerId}/${src.id}`;

    // Reuse the existing object so references held elsewhere (drags, editors) stay valid.
    const n = prev.get(id) || {};
    for (const k of Object.keys(n)) delete n[k];
    for (const [k, v] of Object.entries(src)) if (k !== 'children') n[k] = clone(v);
    n.id = id;
    n.sourceId = src.id;
    n.pathKey = path;
    const ov = overrides[path];
    if (ov) for (const [k, v] of Object.entries(ov)) n[k] = clone(v);
    if (n.type === 'text' && ov && TEXT_PROPS.some((k) => k in ov)) remeasure(n);

    if (src.children) {
      const swapped = n.type === 'instance' && n.componentId !== src.componentId && comps.get(n.componentId);
      if (swapped) {
        // A nested instance swapped to another component: rebuild it from that component.
        applyRootProps(n, swapped, ov || {});
        n.children = deriveChildren(swapped.children, id, path, overrides, prev, comps);
      } else {
        n.children = deriveChildren(src.children, id, path, overrides, prev, comps);
      }
    }
    return n;
  });
}

function applyMain(inst, main, comps) {
  const overrides = inst.overrides || (inst.overrides = {});
  applyRootProps(inst, main, overrides[''] || {});
  const synced = inst.synced || {};
  for (const k of ROOT_FOLLOW) {
    if (!(k in synced) || inst[k] === synced[k]) inst[k] = main[k];
  }
  inst.synced = Object.fromEntries(ROOT_FOLLOW.map((k) => [k, main[k]]));
  const prev = new Map();
  walk(inst.children || [], (c) => void prev.set(c.id, c));
  inst.children = deriveChildren(main.children, inst.id, '', overrides, prev, comps);
}

// Normalize step: rebuild every instance from its main component.
export function syncInstances() {
  if (!state.doc) return;
  const comps = componentMap();
  if (!comps.size && !hasInstances()) return;
  const done = new Set();
  const visiting = new Set();

  const syncTree = (nodes) => walk(nodes, (n) => {
    if (n.type !== 'instance') return;
    syncInstance(n);
    return false; // its children are derived
  });

  const syncComponent = (c) => {
    if (done.has(c.id) || visiting.has(c.id)) return;
    visiting.add(c.id);
    syncTree(c.children);
    visiting.delete(c.id);
    done.add(c.id);
  };

  function syncInstance(inst) {
    const main = comps.get(inst.componentId);
    if (!main) {
      inst.missingMain = true; // keep the last materialized state
      return;
    }
    delete inst.missingMain;
    if (visiting.has(main.id)) return; // an instance of a component inside itself; guarded elsewhere
    syncComponent(main);
    applyMain(inst, main, comps);
  }

  for (const pg of state.doc.pages) syncTree(pg.children);
  reindex();
}

function hasInstances() {
  let found = false;
  for (const pg of state.doc.pages) walk(pg.children, (n) => {
    if (n.type === 'instance') found = true;
    return found ? false : undefined;
  });
  return found;
}

// ---------- overrides via the edit funnel ----------
let warned = 0;
addEditHook({
  before(node, keys) {
    if (!isInsideInstance(node)) return;
    const blocked = keys.map((k) => k.split('.')[0]).filter((k) => !CHILD_OVERRIDABLE.has(k));
    if (blocked.length) {
      if (Date.now() - warned > 2000) {
        warned = Date.now();
        window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Layers inside an instance can only change appearance and text. Edit the main component or detach the instance to change more.' }));
      }
      return false;
    }
  },
  after(node, keys) {
    const roots = [...new Set(keys.map((k) => k.split('.')[0]))];
    const owner = owningInstance(node);
    const record = (inst, path, allowed) => {
      const props = roots.filter(allowed);
      if (!props.length) return;
      const entry = ((inst.overrides ||= {})[path] ||= {});
      for (const k of props) entry[k] = clone(node[k]);
    };
    if (owner && node.pathKey) record(owner, node.pathKey, (k) => CHILD_OVERRIDABLE.has(k));
    else if (node.type === 'instance') record(node, '', (k) => ROOT_PROPS.includes(k));
  },
});

export function overrideCount(inst, path = null) {
  const ov = inst?.overrides || {};
  return Object.keys(ov).filter((k) => (path === null || k === path || k.startsWith(path + '/')) && Object.keys(ov[k]).length).length;
}

// Remove overrides of an instance (all of them, or those at/under `path`).
export function resetOverrides(inst, path = null) {
  if (!inst?.overrides) return;
  if (path === null) {
    inst.overrides = {};
    delete inst.synced; // size follows the main component again
    return;
  }
  for (const k of Object.keys(inst.overrides)) if (k === path || k.startsWith(path + '/')) delete inst.overrides[k];
}

// ---------- create / detach ----------
export function createInstance(main, { parent = null, at, x = 0, y = 0 } = {}) {
  const inst = createNode('instance', {
    name: main.name, componentId: main.id, w: main.w, h: main.h, overrides: {}, children: [],
  });
  insertNode(inst, parent, at);
  setWorldMatrix(inst, translate(x, y));
  syncInstances();
  return inst;
}

// Turn an instance into a plain frame that keeps its current look. Nested instances stay instances,
// and the overrides that targeted them move onto them.
export function detachInstance(inst) {
  const outer = inst.overrides || {};
  const relocate = (nested, prefix) => {
    const own = clone(nested.overrides) || {};
    for (const [p, v] of Object.entries(outer)) {
      if (p === prefix) own[''] = { ...(own[''] || {}), ...clone(v) };
      else if (p.startsWith(prefix + '/')) own[p.slice(prefix.length + 1)] = { ...(own[p.slice(prefix.length + 1)] || {}), ...clone(v) };
    }
    return own;
  };
  const convert = (n) => {
    const prefix = n.pathKey;
    n.id = uid();
    delete n.sourceId;
    delete n.pathKey;
    if (n.type === 'instance') {
      n.overrides = relocate(n, prefix);
      delete n.synced;
      // Its children are derived; they're rebuilt for the new id on the next sync.
      const reid = (c) => {
        c.id = uid();
        delete c.sourceId;
        delete c.pathKey;
        c.children?.forEach(reid);
      };
      n.children?.forEach(reid);
      return;
    }
    n.children?.forEach(convert);
  };
  inst.type = 'frame';
  for (const k of ['componentId', 'overrides', 'synced', 'missingMain', 'propValues', 'variantProps']) delete inst[k];
  inst.children.forEach(convert);
  reindex();
}

// ---------- guards ----------
// Does component `compId` (directly or through nested instances) use any component in `targets`?
function dependsOn(compId, targets, comps, seen = new Set()) {
  if (targets.has(compId)) return true;
  if (seen.has(compId)) return false;
  seen.add(compId);
  const c = comps.get(compId);
  if (!c) return false;
  let found = false;
  walk(c.children, (n) => {
    if (found) return false;
    if (n.type === 'instance') {
      if (dependsOn(n.componentId, targets, comps, seen)) found = true;
      return false;
    }
  });
  return found;
}

// Can `node` (with its subtree) be placed inside `parent` (null = page) without breaking rules?
// No children can be added to instances, and a component may not end up containing itself.
export function canPlaceInside(node, parent) {
  if (!parent) return true;
  if (parent.type === 'instance' || isInsideInstance(parent)) return false;
  const targets = new Set([parent, ...ancestors(parent)].filter((a) => a.type === 'component').map((a) => a.id));
  if (!targets.size) return true;
  const comps = componentMap();
  let ok = true;
  walk([node], (n) => {
    if (!ok) return false;
    if (n.type === 'component' && targets.has(n.id)) ok = false;
    if (n.type === 'instance') {
      if (dependsOn(n.componentId, targets, comps)) ok = false;
      return false;
    }
  });
  return ok;
}

// Instance roots are selected as a whole; top-level frames and components are "transparent".
export const isTransparentContainer = (n) => isFrameLike(n) && n.type !== 'instance';

export function mainComponentOf(inst) {
  return inst?.componentId ? getNode(inst.componentId) : null;
}

