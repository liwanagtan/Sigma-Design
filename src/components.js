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
  state, walk, getNode, getParent, ancestors, addEditHook, editNode, uid, createNode, insertNode, setWorldMatrix,
  reindex, isFrameLike,
} from './store.js';
import { translate } from './geom.js';
import { measureText } from './text.js';

export const isInstance = (n) => n?.type === 'instance';
export const isComponent = (n) => n?.type === 'component';

// Instance root properties copied from the main component unless overridden on the instance.
// `bindings` makes variables on the main component's own box re-resolve in each instance's mode.
const ROOT_PROPS = ['fills', 'strokes', 'strokeWidth', 'strokeAlign', 'radius', 'clip', 'layout', 'opacity', 'name', 'modes', 'bindings'];
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

// The closest instance that contains `node` (excluding node itself).
export function nearestInstance(node) {
  return ancestors(node).find((a) => a.type === 'instance') || null;
}

// The main component a layer belongs to (not looking past instances), or null.
export function containingComponent(node) {
  for (const a of ancestors(node)) {
    if (a.type === 'instance') return null;
    if (a.type === 'component') return a;
  }
  return null;
}

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
  for (const k of ROOT_PROPS) {
    if (k in rootOverride) target[k] = clone(rootOverride[k]);
    else target[k] = k === 'name' ? displayName(main) : clone(main[k]);
  }
}

// Instances of a variant are named after the component set, like Figma.
export function displayName(main) {
  const set = getParent(main.id);
  return set?.type === 'componentSet' ? set.name : main.name;
}

// Component property definitions for a main component. Variants share the definitions of their set.
export function propsOf(main) {
  if (!main) return {};
  const set = getParent(main.id);
  return (set?.type === 'componentSet' ? set.props : main.props) || {};
}

// Property values for one instance: its own values over the definitions' defaults.
function propValuesFor(main, inst) {
  const defs = propsOf(main);
  const out = {};
  for (const [pid, def] of Object.entries(defs)) out[pid] = def.default;
  for (const [pid, v] of Object.entries(inst.propValues || {})) if (pid in defs && v !== undefined) out[pid] = v;
  return out;
}

const prefixKeys = (ov, path) =>
  Object.fromEntries(Object.entries(ov || {}).map(([k, v]) => [k ? `${path}/${k}` : path, v]));

// Build the derived copies of `srcList` for an instance.
//   overrides: the outermost instance's overrides, keyed by path from its root
//   values: property values for layers that belong directly to this main component (null below nested instances)
function deriveChildren(srcList, ownerId, parentPath, overrides, prev, comps, values, chain) {
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
    let textChanged = !!ov && TEXT_PROPS.some((k) => k in ov);
    // Component property bindings win over overrides; editing a bound layer edits the property instead.
    if (values && src.propRefs) {
      for (const [prop, pid] of Object.entries(src.propRefs)) {
        if (values[pid] === undefined) continue;
        n[prop] = clone(values[pid]);
        if (prop === 'text') textChanged = true;
      }
    }
    if (n.type === 'text' && textChanged) remeasure(n);

    if (src.children) {
      if (n.type === 'instance') {
        const main = comps.get(n.componentId);
        // `chain` holds the components being expanded, so a swap can never expand a component inside itself.
        const rebuild = main && !chain.includes(main.id) && (n.componentId !== src.componentId ||
          JSON.stringify(n.propValues || {}) !== JSON.stringify(src.propValues || {}));
        if (rebuild) {
          // Swapped to another component, or given other property values: rebuild from its main,
          // keeping the overrides it had inside its parent component.
          if (n.componentId !== src.componentId) applyRootProps(n, main, ov || {});
          const merged = { ...prefixKeys(n.overrides, path), ...overrides };
          n.children = deriveChildren(main.children, id, path, merged, prev, comps, propValuesFor(main, n), [...chain, main.id]);
        } else {
          n.children = deriveChildren(src.children, id, path, overrides, prev, comps, null, chain);
        }
      } else {
        n.children = deriveChildren(src.children, id, path, overrides, prev, comps, values, chain);
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
  inst.children = deriveChildren(main.children, inst.id, '', overrides, prev, comps, propValuesFor(main, inst), [main.id]);
}

// Instances whose main component and own settings haven't changed since the last pass are skipped.
const lastSync = new WeakMap(); // instance -> key it was last synced with

// Normalize step: rebuild every instance from its main component.
export function syncInstances() {
  if (!state.doc) return;
  const comps = componentMap();
  if (!comps.size && !hasInstances()) return;
  const done = new Set();
  const visiting = new Set();
  const mainKeys = new Map();
  const mainKey = (main) => {
    if (!mainKeys.has(main.id)) {
      const set = getParent(main.id);
      mainKeys.set(main.id, JSON.stringify(main) + (set?.type === 'componentSet' ? JSON.stringify([set.name, set.props]) : ''));
    }
    return mainKeys.get(main.id);
  };

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
    // Everything a re-sync depends on. Components swapped in (by override or property) aren't part of
    // the main's key, so those instances always re-sync.
    const keyOf = () => mainKey(main) + JSON.stringify([
      inst.componentId, inst.overrides, inst.propValues, inst.w, inst.h, inst.sizingH, inst.sizingV, inst.modes,
      inst.children?.length,
    ]);
    if (lastSync.get(inst) === keyOf() && !hasSwaps(inst, comps)) return;
    applyMain(inst, main, comps);
    lastSync.set(inst, keyOf());
  }

  for (const pg of state.doc.pages) syncTree(pg.children);
  reindex();
}

function hasSwaps(inst, comps) {
  return Object.values(inst.overrides || {}).some((o) => 'componentId' in o || 'propValues' in o) ||
    Object.values(inst.propValues || {}).some((v) => comps.has(v));
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
    if (owner && node.pathKey) {
      // A layer bound to a component property: the edit sets the property value on its instance.
      const nearest = nearestInstance(node);
      const bound = roots.filter((k) => node.propRefs?.[k] && nearest);
      for (const k of bound) {
        const pid = node.propRefs[k];
        if (nearest === owner) (owner.propValues ||= {})[pid] = clone(node[k]);
        else {
          const entry = ((owner.overrides ||= {})[nearest.pathKey] ||= {});
          entry.propValues = { ...(nearest.propValues || {}), [pid]: clone(node[k]) };
        }
      }
      record(owner, node.pathKey, (k) => CHILD_OVERRIDABLE.has(k) && !bound.includes(k));
    } else if (node.type === 'instance') {
      record(node, '', (k) => ROOT_PROPS.includes(k));
    }
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


// ---------- component properties ----------
export const PROP_TYPES = { boolean: 'Boolean', text: 'Text', instance: 'Instance swap' };
// Which layer property each property type binds to.
export const PROP_TARGET = { boolean: 'visible', text: 'text', instance: 'componentId' };

// Properties are defined on the component (or on its component set, for variants).
function propsHost(comp) {
  const set = getParent(comp.id);
  return set?.type === 'componentSet' ? set : comp;
}

export function addComponentProp(comp, type, { name, value } = {}) {
  const host = propsHost(comp);
  const props = (host.props ||= {});
  const base = name || PROP_TYPES[type];
  let label = base;
  for (let i = 2; Object.values(props).some((p) => p.name === label); i++) label = `${base} ${i}`;
  const id = uid();
  props[id] = { name: label, type, default: value };
  return id;
}

export function removeComponentProp(comp, pid) {
  const host = propsHost(comp);
  delete host.props?.[pid];
  walk([host], (n) => {
    if (n.type === 'instance' && n !== host) return false;
    if (!n.propRefs) return;
    for (const [k, v] of Object.entries(n.propRefs)) if (v === pid) delete n.propRefs[k];
    if (!Object.keys(n.propRefs).length) delete n.propRefs;
  });
}

// Path of `node` below `root`, using the same naming rules as derived layers.
function pathFrom(root, node) {
  const parts = [];
  for (let cur = node; cur && cur !== root; cur = getParent(cur.id)) {
    const siblings = getParent(cur.id)?.children || [];
    let k = 0;
    for (const s of siblings) {
      if (s.name === cur.name) k++;
      if (s === cur) break;
    }
    parts.unshift(escKey(cur.name) + (k > 1 ? `#${k}` : ''));
  }
  return parts.join('/');
}

// Bind a layer's property (visible / text / componentId) to a component property, or unbind with null.
// Existing instance overrides of that layer property become the instances' property values, so
// nothing changes visually (like Figma).
export function bindLayerProp(layer, target, pid) {
  if (!pid) {
    if (layer.propRefs) {
      delete layer.propRefs[target];
      if (!Object.keys(layer.propRefs).length) delete layer.propRefs;
    }
    return;
  }
  (layer.propRefs ||= {})[target] = pid;
  const comp = containingComponent(layer);
  if (!comp) return;
  const path = pathFrom(comp, layer);
  for (const inst of instancesOf(comp.id)) {
    const entry = inst.overrides?.[path];
    if (!entry || !(target in entry)) continue;
    (inst.propValues ||= {})[pid] = entry[target];
    delete entry[target];
    if (!Object.keys(entry).length) delete inst.overrides[path];
  }
}

export function setInstanceProp(inst, pid, value) {
  editNode(inst, ['propValues'], () => {
    inst.propValues = { ...(inst.propValues || {}), [pid]: value };
  });
}

// ---------- variants ----------
// Variant components live in a component set and are named "Prop=Value, Prop2=Value2".
export function parseVariantName(name) {
  const out = {};
  for (const part of String(name).split(',')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export const formatVariantName = (props) => Object.entries(props).map(([k, v]) => `${k}=${v}`).join(', ');

export const isVariant = (n) => n?.type === 'component' && getParent(n.id)?.type === 'componentSet';
export const variantsOf = (set) => set.children.filter((c) => c.type === 'component');

// { Prop: [values in order of appearance] } for a component set.
export function variantDefs(set) {
  const defs = {};
  for (const v of variantsOf(set)) {
    for (const [k, val] of Object.entries(parseVariantName(v.name))) {
      if (!defs[k]) defs[k] = [];
      if (!defs[k].includes(val)) defs[k].push(val);
    }
  }
  return defs;
}

// The variant matching `props` exactly, or else the one matching the most of them.
export function findVariant(set, props) {
  let best = null, bestScore = -1;
  for (const v of variantsOf(set)) {
    const vp = parseVariantName(v.name);
    const score = Object.entries(props).filter(([k, val]) => vp[k] === val).length;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return { variant: best, exact: bestScore === Object.keys(props).length };
}

// Switch an instance (top-level or nested) to another variant of its set. Overrides carry over by layer name.
export function switchVariant(inst, prop, value) {
  const main = mainComponentOf(inst);
  const set = main && getParent(main.id);
  if (set?.type !== 'componentSet') return false;
  const wanted = { ...parseVariantName(main.name), [prop]: value };
  const { variant, exact } = findVariant(set, wanted);
  if (variant && variant.id !== inst.componentId) {
    editNode(inst, ['componentId'], () => void (inst.componentId = variant.id));
  }
  return exact;
}

function renameAll(set, fn) {
  for (const v of variantsOf(set)) {
    const props = fn(parseVariantName(v.name));
    if (props) v.name = formatVariantName(props);
  }
}

export function renameVariantProperty(set, from, to) {
  to = to.trim();
  if (!to || to === from || to.includes('=') || to.includes(',')) return;
  renameAll(set, (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k === from ? to : k, v])));
}

export function setVariantValue(variant, prop, value) {
  value = value.trim();
  if (!value || value.includes(',') || value.includes('=')) return;
  variant.name = formatVariantName({ ...parseVariantName(variant.name), [prop]: value });
}

export function addVariantProperty(set) {
  const defs = variantDefs(set);
  let name = 'Property 1';
  for (let i = 2; defs[name]; i++) name = `Property ${i}`;
  renameAll(set, (p) => ({ ...p, [name]: 'Default' }));
  return name;
}
