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
  reindex, isFrameLike, isSlotArea, addStructureHook,
} from './store.js';
import { translate } from './geom.js';
import { measureText } from './text.js';
import { applyConstraints } from './constraints.js';

export const isInstance = (n) => n?.type === 'instance';
export const isComponent = (n) => n?.type === 'component';

// Instance root properties copied from the main component unless overridden on the instance.
// `bindings` makes variables on the main component's own box re-resolve in each instance's mode.
export const ROOT_PROPS = ['fills', 'strokes', 'strokeWidth', 'strokeAlign', 'strokeSides', 'radius', 'radii', 'clip', 'layout', 'layoutGrids', 'opacity', 'effects', 'minW', 'maxW', 'minH', 'maxH', 'name', 'modes', 'bindings'];
// Root size/sizing follows the main component until the instance itself is resized.
export const ROOT_FOLLOW = ['w', 'h', 'sizingH', 'sizingV'];
// Properties of layers inside an instance that can be overridden. Everything else (position, size,
// structure) comes from the main component.
const CHILD_OVERRIDABLE = new Set([
  'fills', 'strokes', 'strokeWidth', 'strokeAlign', 'strokeSides', 'cap', 'opacity', 'effects', 'visible', 'radius', 'radii', 'name',
  'text', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'textCase', 'truncate', 'maxLines',
  'componentId', 'propValues', 'variantProps', 'bindings', 'modes',
]);
const TEXT_PROPS = ['text', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textCase', 'truncate', 'maxLines'];

const clone = (v) => (v === undefined || v === null || typeof v !== 'object' ? v : structuredClone(v));
const escKey = (name) => String(name).replace(/%/g, '%25').replace(/\//g, '%2F').replace(/#/g, '%23');

// The outermost instance that contains `node` (excluding node itself). Overrides live there.
// A slot is a boundary: what's inside an instance's slot belongs to whoever placed it, not the instance.
export function owningInstance(node) {
  let owner = null;
  for (const a of ancestors(node)) {
    if (isSlotArea(a)) break;
    if (a.type === 'instance') owner = a;
  }
  return owner;
}
export const isInsideInstance = (n) => !!n && !!owningInstance(n);

// The closest instance that contains `node` (excluding node itself).
export function nearestInstance(node) {
  for (const a of ancestors(node)) {
    if (isSlotArea(a)) return null;
    if (a.type === 'instance') return a;
  }
  return null;
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
  const collect = (nodes) => walk(nodes, (n) => {
    if (n.type === 'component' && !map.has(n.id)) map.set(n.id, n); // local components win over library copies
    if (n.type === 'instance') return false; // components never live inside instances
  });
  for (const pg of doc?.pages || []) collect(pg.children);
  for (const lib of doc?.componentLibraries || []) collect(lib.components || []);
  return map;
}

// Components available in this file: local ones ({ node, page }) and ones from linked component
// libraries ({ node, page: null, library: { fileId, name } }).
export function listComponents() {
  const out = [];
  for (const pg of state.doc?.pages || []) walk(pg.children, (n) => {
    if (n.type === 'component') out.push({ node: n, page: pg });
    if (n.type === 'instance') return false;
  });
  for (const lib of state.doc?.componentLibraries || []) walk(lib.components || [], (n) => {
    if (n.type === 'component') out.push({ node: n, page: null, library: lib });
    if (n.type === 'instance') return false;
  });
  return out;
}

// ---------- deprecation ----------
// A deprecated component (or component set, for all its variants) stays usable: instances keep working and
// show a note, but it's hidden from Assets and the swap picker so nothing new uses it. A variant follows its set.
export function deprecationTarget(node) {
  return node?.type === 'component' && getParent(node.id)?.type === 'componentSet' ? getParent(node.id) : node;
}
export const isDeprecated = (node) => !!node && (!!node.deprecated || !!deprecationTarget(node)?.deprecated);

export function setDeprecated(node, on) {
  const target = deprecationTarget(node);
  editNode(target, ['deprecated'], () => {
    if (on) target.deprecated = true;
    else delete target.deprecated;
  });
}

// Does a component (or component set) match a search? Every word of `query` must appear in its name or
// description, or in its set's name or description, so keywords kept in descriptions find it too.
export function componentMatches(node, query) {
  const words = String(query || '').toLowerCase().split(/[\s/]+/).filter(Boolean);
  if (!words.length) return true;
  const set = getParent(node.id)?.type === 'componentSet' ? getParent(node.id) : null;
  const haystack = [node.name, node.description, set?.name, set?.description].filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

// The component library a component comes from, or null for local components.
export function libraryOfComponent(node) {
  for (const lib of state.doc?.componentLibraries || []) {
    let found = false;
    walk(lib.components || [], (n) => {
      if (n === node) found = true;
      return found ? false : undefined;
    });
    if (found) return lib;
  }
  return null;
}

// Top-level components and component sets of the file (what "Publish components" publishes).
export function publishableComponents(doc = state.doc) {
  const out = [];
  for (const pg of doc?.pages || []) walk(pg.children, (n) => {
    if (n.type === 'component' || n.type === 'componentSet') {
      out.push(n);
      return false; // variants come with their set
    }
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
  const key = JSON.stringify([n.text, n.fontFamily, n.fontSize, n.fontWeight, n.lineHeight, n.letterSpacing, n.textCase, n.minW, n.maxW, n.truncate, n.maxLines, n.autoResize, n.autoResize === 'height' ? n.w : 0]);
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

// Property values for one instance: its own values over the definitions' defaults. Which ones the
// instance set itself is remembered (ownValues), so a default that comes from a token stays live.
const ownValues = new WeakMap(); // values object -> Set of property ids the instance set
function propValuesFor(main, inst) {
  const defs = propsOf(main);
  const out = {};
  const own = new Set();
  for (const [pid, def] of Object.entries(defs)) out[pid] = def.default;
  for (const [pid, v] of Object.entries(inst.propValues || {})) {
    if (pid in defs && v !== undefined) {
      out[pid] = v;
      own.add(pid);
    }
  }
  ownValues.set(out, own);
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
      const own = ownValues.get(values);
      for (const [prop, pid] of Object.entries(src.propRefs)) {
        if (values[pid] === undefined) continue;
        n[prop] = clone(values[pid]);
        if (prop === 'text') textChanged = true;
        // A value set on the instance wins over a token the default comes from.
        if (own?.has(pid) && n.bindings?.[prop]) {
          delete n.bindings[prop];
          if (!Object.keys(n.bindings).length) delete n.bindings;
        }
      }
    }
    if (n.type === 'text' && textChanged) remeasure(n);

    // A slot whose contents this instance changed: those layers (the instance's own) instead of the
    // main's default content.
    const owned = src.propRefs?.slot && activeSlots?.[path];
    if (owned) {
      n.children = owned.nodes;
      return n;
    }
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
          const outerSlots = activeSlots;
          activeSlots = { ...prefixKeys(n.slots, path), ...(outerSlots || {}) };
          n.children = deriveChildren(main.children, id, path, merged, prev, comps, propValuesFor(main, n), [...chain, main.id]);
          activeSlots = outerSlots;
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

let activeSlots = null; // the outermost instance's slots ({ [path]: { nodes } }) while its layers are derived

function applyMain(inst, main, comps) {
  const overrides = inst.overrides || (inst.overrides = {});
  activeSlots = inst.slots || {};
  applyRootProps(inst, main, overrides[''] || {});
  const synced = inst.synced || {};
  for (const k of ROOT_FOLLOW) {
    if (!(k in synced) || inst[k] === synced[k]) inst[k] = main[k];
  }
  inst.synced = Object.fromEntries(ROOT_FOLLOW.map((k) => [k, main[k]]));
  const prev = new Map();
  walk(inst.children || [], (c) => void prev.set(c.id, c));
  inst.children = deriveChildren(main.children, inst.id, '', overrides, prev, comps, propValuesFor(main, inst), [main.id]);
  activeSlots = null;
  // An instance sized differently from its main repositions its layers by their constraints.
  if (inst.w !== main.w || inst.h !== main.h) applyConstraints(inst, main.children, main.w, main.h);
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
      inst.children?.length, inst.slots,
    ]);
    if (lastSync.get(inst) !== keyOf() || hasSwaps(inst, comps)) {
      applyMain(inst, main, comps);
      lastSync.set(inst, keyOf());
    }
    // Instances placed in its slots are ordinary instances: keep them in sync too.
    for (const entry of Object.values(inst.slots || {})) syncTree(entry.nodes);
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
    if (node.type === 'icon') {
      // An icon in an instance looks as its main component says; only its component properties (which
      // icon, shown or not) change it.
      if (keys.every((k) => node.propRefs?.[k.split('.')[0]])) return;
      if (Date.now() - warned > 2000) {
        warned = Date.now();
        window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'An icon in an instance takes its size, color and stroke from the main component. Choose the icon with the component’s Icon property.' }));
      }
      return false;
    }
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
    // Editing a slot's default content in an instance: the instance takes over the slot's contents.
    const area = slotAreaOf(node);
    if (area && area !== node && slotOwner(area)) materializeSlot(area);
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
    if (!owner && node.propRefs) {
      // A bound layer in a main component: its value is the property's default (like Figma), so the
      // other layers bound to the property follow, and instances that keep the default update.
      const comp = containingComponent(node);
      for (const k of roots) {
        const pid = node.propRefs[k];
        if (!pid || !comp || !propsOf(comp)[pid]) continue;
        // Typing a value by hand detaches the token (the variables hook drops the layer's binding).
        if (propsOf(comp)[pid].defaultVar) setPropDefaultVar(comp, pid, null);
        updateComponentProp(comp, pid, { default: clone(node[k]) });
      }
    }
  },
});

// Overrides whose layer no longer exists in the main component (renamed or deleted there).
export function orphanedOverrides(inst) {
  if (!inst?.overrides || inst.missingMain) return [];
  const paths = new Set();
  walk(inst.children || [], (n) => void (n.pathKey && paths.add(n.pathKey)));
  return Object.keys(inst.overrides).filter((k) => k !== '' && !paths.has(k) && Object.keys(inst.overrides[k]).length);
}

export function clearOrphanedOverrides(inst) {
  for (const k of orphanedOverrides(inst)) delete inst.overrides[k];
}

// The main component's layers by path (the same naming as an instance's derived layers), not looking
// inside nested instances.
function mainLayersByPath(main) {
  const map = new Map();
  const visit = (nodes, prefix) => {
    const counts = new Map();
    for (const n of nodes) {
      const c = (counts.get(n.name) || 0) + 1;
      counts.set(n.name, c);
      const path = (prefix ? `${prefix}/` : '') + escKey(n.name) + (c > 1 ? `#${c}` : '');
      map.set(path, n);
      if (n.children && n.type !== 'instance') visit(n.children, path);
    }
  };
  visit(main?.children || [], '');
  return map;
}

// Property ids bound to the main layer at `path` or below it (whose values an instance sets through
// that layer, e.g. its text).
function propsUnderPath(main, path) {
  const out = new Set();
  for (const [p, layer] of mainLayersByPath(main)) {
    if (p !== path && !p.startsWith(`${path}/`)) continue;
    for (const pid of Object.values(layer.propRefs || {})) out.add(pid);
  }
  return out;
}

// Property values an instance changed (differing from the defaults), optionally only those bound under `path`.
function changedProps(inst, path = null) {
  const main = mainComponentOf(inst);
  const defs = propsOf(main);
  const under = path === null ? null : propsUnderPath(main, path);
  return Object.entries(inst?.propValues || {})
    .filter(([pid, v]) => pid in defs && (!under || under.has(pid)) && JSON.stringify(v) !== JSON.stringify(defs[pid].default))
    .map(([pid]) => pid);
}

// Is the instance resized away from its main component (a change, like in Figma)? Hug and fill sizes
// follow their content or container, so only a different sizing mode or a different fixed size counts.
function sizeChanged(inst) {
  const main = mainComponentOf(inst);
  if (!main) return false;
  return [['w', 'sizingH'], ['h', 'sizingV']].some(([dim, mode]) => {
    const m = inst[mode] || 'fixed';
    if (m !== (main[mode] || 'fixed')) return true;
    return m === 'fixed' && Math.round(inst[dim]) !== Math.round(main[dim]);
  });
}

// Changes made on an instance: overridden layers, property values that differ from their defaults, and
// (for the whole instance) a resize. A `path` counts the changes of that layer and the layers in it.
export function overrideCount(inst, path = null) {
  const ov = inst?.overrides || {};
  const layers = Object.keys(ov).filter((k) => (path === null || k === path || k.startsWith(path + '/')) && Object.keys(ov[k]).length).length;
  const slots = Object.keys(inst?.slots || {}).filter((k) => path === null || k === path || k.startsWith(path + '/')).length;
  if (path !== null) return layers + changedProps(inst, path).length + slots;
  return layers + changedProps(inst).length + (sizeChanged(inst) ? 1 : 0) + slots;
}

// Undo an instance's changes (all of them, or those of the layer at `path` and the layers in it): the
// overrides, the property values set through those layers, and (for the whole instance) its size.
// The variant stays. The instance is always rebuilt from its main afterwards.
export function resetOverrides(inst, path = null) {
  if (!inst) return;
  inst.overrides ||= {};
  if (path === null) {
    inst.overrides = {};
    delete inst.propValues; // properties go back to their defaults
    delete inst.slots; // slots show their default content again
    delete inst.synced; // size follows the main component again
    const main = mainComponentOf(inst);
    if (main) for (const k of ['w', 'h', 'sizingH', 'sizingV']) inst[k] = main[k];
  } else {
    for (const k of Object.keys(inst.overrides)) if (k === path || k.startsWith(path + '/')) delete inst.overrides[k];
    for (const k of Object.keys(inst.slots || {})) if (k === path || k.startsWith(path + '/')) delete inst.slots[k];
    for (const pid of propsUnderPath(mainComponentOf(inst), path)) {
      if (inst.propValues) delete inst.propValues[pid];
    }
    if (inst.propValues && !Object.keys(inst.propValues).length) delete inst.propValues;
  }
  lastSync.delete(inst); // never skip the rebuild: layers may hold changes nothing else records
}

// "Push changes to main component": an instance's changes become the main component's (Figma's
// command). Root changes go to the main itself, layer changes to the matching layers (or, below a
// nested instance, to that nested instance's overrides), and property values become the defaults.
// The instance is then reset; it looks the same, now through its main.
export function pushOverridesToMain(inst) {
  const main = mainComponentOf(inst);
  if (!main || libraryOfComponent(main)) return false;
  const pathMap = mainLayersByPath(main);
  for (const [path, ov] of Object.entries(inst.overrides || {})) {
    if (!path) {
      for (const [k, v] of Object.entries(ov)) if (ROOT_PROPS.includes(k) && k !== 'name') main[k] = clone(v);
      continue;
    }
    let target = pathMap.get(path);
    if (target) {
      for (const [k, v] of Object.entries(ov)) {
        if (target.propRefs?.[k]) continue; // bound layers take property values (pushed below)
        target[k] = clone(v);
      }
      if (target.type === 'text') measureText(target);
      continue;
    }
    // Inside a nested instance of the main: keep it as that nested instance's override.
    const parts = path.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const head = parts.slice(0, i).join('/');
      target = pathMap.get(head);
      if (target?.type === 'instance') {
        const rest = parts.slice(i).join('/');
        ((target.overrides ||= {})[rest] ||= {});
        Object.assign(target.overrides[rest], clone(ov));
        break;
      }
    }
  }
  for (const [pid, v] of Object.entries(inst.propValues || {})) {
    if (propsOf(main)[pid]) updateComponentProp(main, pid, { default: clone(v) });
  }
  resetOverrides(inst);
  return true;
}

// ---------- slots ----------
// A slot is a frame in a main component bound to a slot property (propRefs.slot). Its children are the
// default content. In an instance, the slot shows that default content until something in it changes;
// from then on the instance owns its contents: inst.slots[pathKey] = { nodes } (plain, editable layers).
// "Reset slot" goes back to the default content.

// The slot area a layer sits in (itself or an ancestor), inside an instance; or null.
export function slotAreaOf(node) {
  if (isSlotArea(node)) return node;
  for (const a of ancestors(node)) if (isSlotArea(a)) return a;
  return null;
}

// The instance a slot area belongs to (where its contents are stored).
export const slotOwner = (area) => owningInstance(area);

export function slotDef(area) {
  const owner = slotOwner(area);
  const main = owner && mainComponentOf(owner);
  return main ? propsOf(main)[area.propRefs.slot] || null : null;
}

export const isSlotModified = (area) => !!slotOwner(area)?.slots?.[area.pathKey];

// From now on the instance owns the slot's contents. The layers stay the same objects (and ids), so
// selections and the edit in progress carry on.
export function materializeSlot(area) {
  const owner = slotOwner(area);
  if (!owner || owner.slots?.[area.pathKey]) return;
  const strip = (n) => {
    delete n.sourceId;
    delete n.pathKey;
    if (n.type === 'instance') return; // a nested instance: its own children are derived from its main
    n.children?.forEach(strip);
  };
  area.children ||= [];
  area.children.forEach(strip);
  (owner.slots ||= {})[area.pathKey] = { nodes: area.children };
}

export function resetSlot(area) {
  const owner = slotOwner(area);
  if (owner?.slots) delete owner.slots[area.pathKey];
}

// "Delete contents": an empty slot (still a change from the default).
export function clearSlot(area) {
  materializeSlot(area);
  area.children.length = 0;
}

// Layer count against the slot property's limits: { count, min, max, ok }.
export function slotLimits(area) {
  const def = slotDef(area) || {};
  const count = (area.children || []).length;
  const ok = (def.min == null || count >= def.min) && (def.max == null || count <= def.max);
  return { count, min: def.min ?? null, max: def.max ?? null, ok };
}

// Before layers go in or out of a slot in an instance, the instance takes over its contents. New layers
// can fill the slot's counter axis (a slot setting), and going past the maximum warns.
addStructureHook((kind, parent, node) => {
  const area = parent && slotAreaOf(parent);
  if (!area || !slotOwner(area)) return;
  materializeSlot(area);
  if (kind !== 'insert' || parent !== area) return;
  const def = slotDef(area);
  if (def?.fillCounter && area.layout?.mode && area.layout.mode !== 'none' && node) {
    if (area.layout.mode === 'vertical') node.sizingH = 'fill';
    else node.sizingV = 'fill';
  }
  if (def?.max != null && area.children.length + 1 > def.max) {
    window.dispatchEvent(new CustomEvent('sigma:toast', { detail: `“${def.name}” allows at most ${def.max} layer${def.max === 1 ? '' : 's'}.` }));
  }
});

// Turn a frame nested in a main component into a slot for property `pid` (or stop, with null).
export function setSlot(frame, pid) {
  const comp = containingComponent(frame);
  if (!comp || frame === comp || !isFrameLike(frame) || frame.type === 'instance') return false;
  if (!pid) {
    if (frame.propRefs) {
      delete frame.propRefs.slot;
      if (!Object.keys(frame.propRefs).length) delete frame.propRefs;
    }
    return true;
  }
  (frame.propRefs ||= {}).slot = pid;
  return true;
}

// Is `node` a frame (or a layer inside one) that is a slot in a main component? Component properties
// can't be applied to layers inside a slot (Figma's rule).
export function insideMainSlot(node) {
  for (const a of ancestors(node)) {
    if (a.type === 'instance' || a.type === 'component') return false;
    if (a.propRefs?.slot) return true;
  }
  return false;
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
  for (const k of ['componentId', 'overrides', 'synced', 'missingMain', 'propValues', 'variantProps', 'slots']) delete inst[k];
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
  // Inside an instance, only its slots take new layers.
  if (parent.type === 'instance' || (isInsideInstance(parent) && !isSlotArea(parent))) return false;
  const chain = [parent, ...ancestors(parent)];
  const targets = new Set(chain.filter((a) => a.type === 'component').map((a) => a.id));
  // In a slot, the instance's own component (and those around it) count too: no component inside itself.
  for (const a of chain) if (a.type === 'instance' && a.componentId) targets.add(a.componentId);
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
export const PROP_TYPES = { boolean: 'Boolean', text: 'Text', instance: 'Instance swap', slot: 'Slot', icon: 'Icon' };
// Like Figma, a component's properties are listed variant properties first, then the others in order.
//   def = { name, type, default, preferred?: [componentId] (instance swap), groups?: [name] (icon: the
//   icon groups instances can choose from; all when absent) }
// Which layer property each property type binds to.
export const PROP_TARGET = { boolean: 'visible', text: 'text', instance: 'componentId', slot: 'slot', icon: 'iconId' };

// Properties are defined on the component (or on its component set, for variants).
export function propsHost(comp) {
  if (comp?.type === 'componentSet') return comp;
  const set = getParent(comp.id);
  return set?.type === 'componentSet' ? set : comp;
}

// Change a property definition (name, default, preferred). Names stay unique.
export function updateComponentProp(comp, pid, changes) {
  const host = propsHost(comp);
  const def = host.props?.[pid];
  if (!def) return;
  if ('name' in changes) {
    const name = String(changes.name || '').trim();
    if (name && !Object.entries(host.props).some(([id, d]) => id !== pid && d.name === name)) def.name = name;
  }
  if ('default' in changes) {
    def.default = changes.default;
    // The main component shows the default: every layer bound to the property takes it.
    for (const { layer, target } of layersUsingProp(comp, pid)) {
      if (JSON.stringify(layer[target]) === JSON.stringify(def.default)) continue;
      layer[target] = clone(def.default);
      if (target === 'text' && layer.type === 'text') measureText(layer);
    }
  }
  if ('preferred' in changes) {
    if (changes.preferred?.length) def.preferred = [...new Set(changes.preferred)];
    else delete def.preferred;
  }
  if ('groups' in changes) {
    if (changes.groups?.length) def.groups = [...new Set(changes.groups)];
    else delete def.groups;
  }
}

// Let a property's default come from a design token (Boolean ↔ boolean token, Text ↔ string token), or
// stop (varId null). The main component's bound layers bind the token, so they (and every instance that
// keeps the default) follow the token in each mode.
export function setPropDefaultVar(comp, pid, varId) {
  const def = propsHost(comp).props?.[pid];
  if (!def || def.type === 'instance' || def.type === 'icon') return;
  if (varId) def.defaultVar = varId;
  else delete def.defaultVar;
  for (const { layer, target } of layersUsingProp(comp, pid)) {
    if (varId) (layer.bindings ||= {})[target] = varId;
    else if (layer.bindings) {
      delete layer.bindings[target];
      if (!Object.keys(layer.bindings).length) delete layer.bindings;
    }
  }
}

// Put property `pid` before `beforePid` (or last).
export function reorderComponentProp(comp, pid, beforePid = null) {
  const host = propsHost(comp);
  if (!host.props?.[pid] || pid === beforePid) return;
  const entries = Object.entries(host.props).filter(([id]) => id !== pid);
  const at = beforePid ? entries.findIndex(([id]) => id === beforePid) : -1;
  entries.splice(at >= 0 ? at : entries.length, 0, [pid, host.props[pid]]);
  host.props = Object.fromEntries(entries);
}

// Layers in a main component (or every variant of a set) bound to property `pid`, with what they bind.
export function layersUsingProp(comp, pid) {
  const host = propsHost(comp);
  const out = [];
  walk(host.children || [], (n) => {
    for (const [target, id] of Object.entries(n.propRefs || {})) if (id === pid) out.push({ layer: n, target });
    if (n.type === 'instance') return false;
  });
  return out;
}

// Nested instances in a main component (or set) that could show their properties on its instances.
export function nestedInstances(comp) {
  const host = propsHost(comp);
  const out = [];
  walk(host.children || [], (n) => {
    if (n.type !== 'instance') return;
    const main = mainComponentOf(n);
    const set = main && getParent(main.id);
    if (main && (Object.keys(propsOf(main)).length || set?.type === 'componentSet')) out.push(n);
    return false;
  });
  return out;
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
  if (host.props?.[pid]?.type === 'slot') {
    // Like Figma: removing a slot property resets that slot in every instance (their added layers go).
    for (const { layer } of layersUsingProp(comp, pid)) {
      for (const inst of instancesOf(variantOrSelf(layer).id)) {
        for (const key of Object.keys(inst.slots || {})) if (key === pathFrom(variantOrSelf(layer), layer)) delete inst.slots[key];
      }
    }
  }
  delete host.props?.[pid];
  walk([host], (n) => {
    if (n.type === 'instance' && n !== host) return false;
    if (!n.propRefs) return;
    for (const [k, v] of Object.entries(n.propRefs)) if (v === pid) delete n.propRefs[k];
    if (!Object.keys(n.propRefs).length) delete n.propRefs;
  });
}

// The main component (or variant) a layer belongs to.
function variantOrSelf(layer) {
  return containingComponent(layer) || layer;
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
  // The layer takes the property's value (the main component shows the default).
  const def = propsOf(comp)[pid];
  if (def && def.default !== undefined && JSON.stringify(layer[target]) !== JSON.stringify(def.default)) {
    layer[target] = clone(def.default);
    if (target === 'text' && layer.type === 'text') measureText(layer);
  }
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

// { Prop: [values] } for a component set: properties in the order the variants name them, values in
// the set's chosen order (set.valueOrder), then in order of appearance.
export function variantDefs(set) {
  const defs = {};
  for (const v of variantsOf(set)) {
    for (const [k, val] of Object.entries(parseVariantName(v.name))) {
      if (!defs[k]) defs[k] = [];
      if (!defs[k].includes(val)) defs[k].push(val);
    }
  }
  for (const [k, order] of Object.entries(set.valueOrder || {})) {
    if (!defs[k]) continue;
    const rank = (x) => (order.includes(x) ? order.indexOf(x) : order.length + defs[k].indexOf(x));
    defs[k].sort((a, b) => rank(a) - rank(b));
  }
  return defs;
}

// Variant values that read as on/off ("true"/"false", "yes"/"no", "on"/"off"): instances show a toggle.
const BOOL_PAIRS = [['true', 'false'], ['yes', 'no'], ['on', 'off']];
export function toggleValues(values) {
  if (!values || values.length !== 2) return null;
  const lower = values.map((v) => v.toLowerCase());
  for (const [on, off] of BOOL_PAIRS) {
    if (lower.includes(on) && lower.includes(off)) return { on: values[lower.indexOf(on)], off: values[lower.indexOf(off)] };
  }
  return null;
}

// The default variant: the one in the top-left corner of the set (like Figma).
export function defaultVariant(set) {
  const vs = variantsOf(set);
  return [...vs].sort((a, b) => a.y - b.y || a.x - b.x)[0] || null;
}

// Groups of variants that share the exact same property values (a conflict, like in Figma).
export function variantConflicts(set) {
  const keys = Object.keys(variantDefs(set));
  const groups = new Map();
  for (const v of variantsOf(set)) {
    const p = parseVariantName(v.name);
    const key = keys.map((k) => `${k}=${p[k] ?? ''}`).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

// Rename a value of a variant property in every variant that uses it.
export function renameVariantValue(set, prop, from, to) {
  to = String(to || '').trim();
  if (!to || to === from || to.includes('=') || to.includes(',')) return false;
  renameAll(set, (p) => (p[prop] === from ? { ...p, [prop]: to } : null));
  if (set.valueOrder?.[prop]) set.valueOrder[prop] = set.valueOrder[prop].map((x) => (x === from ? to : x));
  return true;
}

export function reorderVariantValues(set, prop, values) {
  (set.valueOrder ||= {})[prop] = [...values];
}

// Move variant property `prop` before `beforeProp` (or last): rewrites every variant's name.
export function reorderVariantProperty(set, prop, beforeProp = null) {
  const keys = Object.keys(variantDefs(set)).filter((k) => k !== prop);
  const at = beforeProp ? keys.indexOf(beforeProp) : -1;
  keys.splice(at >= 0 ? at : keys.length, 0, prop);
  renameAll(set, (p) => Object.fromEntries(keys.filter((k) => k in p).map((k) => [k, p[k]])));
}

// Remove a variant property from every variant (a set keeps at least one).
export function removeVariantProperty(set, prop) {
  if (Object.keys(variantDefs(set)).length < 2) return false;
  renameAll(set, (p) => {
    const next = { ...p };
    delete next[prop];
    return next;
  });
  if (set.valueOrder) delete set.valueOrder[prop];
  return true;
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
