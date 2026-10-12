import { normalizeGroups } from './token-groups.js';
import { mul, inv, translate, rotate, angleOf, normAngle, cornersOf, aabb, round } from './geom.js';

// Where documents lived before the files home (Phase 1); read once for migration.
export const LEGACY_STORAGE_KEY = 'sigma.document.v1';

export const state = {
  screen: 'home', // 'home' (file browser) | 'editor'
  doc: null,
  selection: [], // node ids
  tool: 'move',
  hoverId: null,
  editingTextId: null,
  guides: [], // [{x1,y1,x2,y2}] world
  marquee: null, // world box
  measure: null, // [{x1,y1,x2,y2,label}] world
  measureTarget: null,
  altDown: false,
  spaceDown: false,
  collapsed: new Set(),
  pageViews: {}, // pageId -> {x, y, zoom}
  layoutSkip: new Set(), // ids auto layout must not reposition (being dragged/drawn)
  readOnly: false, // viewing an older version: edits are put back and nothing is saved
  highlightIds: [], // layers outlined while a component property is hovered in the panel
  showGrids: (() => { // layout grids on the canvas (⌃G); remembered in this browser
    try {
      return localStorage.getItem('sigma.showGrids') !== '0';
    } catch {
      return true;
    }
  })(),
};

export function setShowGrids(on) {
  state.showGrids = on;
  try {
    localStorage.setItem('sigma.showGrids', on ? '1' : '0');
  } catch {
    // private mode: not remembered
  }
  emit('selection'); // the canvas and the panel's note
}

// Passes that derive props from the document, run in registration order before every render and
// commit: sync instances → resolve variables → fit groups → auto layout → fit groups (see main.js).
const normalizers = [];
export function addNormalizer(fn) {
  normalizers.push(fn);
}
export function normalizeDocument() {
  if (!state.doc) return;
  for (const fn of normalizers) fn();
}

// ---------- edits ----------
// Every user edit to layer properties goes through editNode(), so features can react in one place:
// instance overrides (components) and detaching variables when a bound value is typed over.
// `keys` are property paths such as 'text', 'visible', 'fills', 'fills.0.color', 'layout.gap'.
// Hooks: { before(node, keys) → false blocks the edit, after(node, keys) }.
const editHooks = [];
export function addEditHook(hook) {
  editHooks.push(hook);
}
export function editNode(node, keys, mutate) {
  for (const h of editHooks) if (h.before?.(node, keys) === false) return false;
  mutate(node);
  for (const h of editHooks) h.after?.(node, keys);
  return true;
}

// ---------- node kinds ----------
// Frame-like nodes have a box, fills, clipping, optional auto layout and children.
export const FRAME_TYPES = new Set(['frame', 'component', 'componentSet', 'instance']);
export const isFrameLike = (n) => !!n && FRAME_TYPES.has(n.type);

// ---------- ids ----------
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- change notification ----------
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
// kind: 'doc' | 'selection' | 'view' | 'overlay'
export function emit(kind) {
  if (kind === 'doc') reindex();
  for (const fn of listeners) fn(kind);
}

// ---------- page / view ----------
export function page() {
  return state.doc.pages.find((p) => p.id === state.doc.currentPageId) || state.doc.pages[0];
}

export function view() {
  const id = page().id;
  if (!state.pageViews[id]) state.pageViews[id] = { x: 0, y: 0, zoom: 1 };
  return state.pageViews[id];
}

// ---------- tree index ----------
let index = new Map(); // id -> { node, parent: node|null, page }

export function reindex() {
  index = new Map();
  if (!state.doc) return;
  for (const pg of state.doc.pages) {
    const walk = (nodes, parent) => {
      for (const n of nodes) {
        index.set(n.id, { node: n, parent, page: pg });
        if (n.children) walk(n.children, n);
      }
    };
    walk(pg.children, null);
  }
  // Components from linked component libraries live outside the pages but resolve like local ones.
  for (const lib of state.doc.componentLibraries || []) {
    const walkLib = (nodes, parent) => {
      for (const n of nodes) {
        if (index.has(n.id)) continue; // e.g. a duplicated file linking its original: local layers win
        index.set(n.id, { node: n, parent, page: null, library: lib.fileId });
        if (n.children) walkLib(n.children, n);
      }
    };
    walkLib(lib.components || [], null);
  }
  // Drop stale selection
  const sel = state.selection.filter((id) => index.has(id) && index.get(id).page === page());
  if (sel.length !== state.selection.length) state.selection = sel;
}

export const getNode = (id) => index.get(id)?.node || null;
export const getParent = (id) => index.get(id)?.parent || null;
export const pageOf = (id) => index.get(id)?.page || null;

export function siblingsOf(node) {
  const p = getParent(node.id);
  return p ? p.children : pageOf(node.id).children;
}

export function ancestors(node) {
  const out = [];
  let p = getParent(node.id);
  while (p) {
    out.push(p);
    p = getParent(p.id);
  }
  return out;
}

export function isAncestor(maybeAncestor, node) {
  return ancestors(node).includes(maybeAncestor);
}

export function selectedNodes() {
  return state.selection.map(getNode).filter(Boolean);
}

export function walk(nodes, fn, parent = null) {
  for (const n of nodes) {
    if (fn(n, parent) === false) continue;
    if (n.children) walk(n.children, fn, n);
  }
}

// ---------- transforms ----------
export function localMatrix(n) {
  const cx = n.w / 2, cy = n.h / 2;
  return mul(translate(n.x + cx, n.y + cy), mul(rotate(n.rotation || 0), translate(-cx, -cy)));
}

export function worldMatrix(n) {
  const p = getParent(n.id);
  return p ? mul(worldMatrix(p), localMatrix(n)) : localMatrix(n);
}

export function parentWorld(n) {
  const p = getParent(n.id);
  return p ? worldMatrix(p) : [1, 0, 0, 1, 0, 0];
}

// Position node so its world (corner-frame) matrix equals M. M must be rotation + translation only.
export function setWorldMatrix(n, M) {
  const L = mul(inv(parentWorld(n)), M);
  const cx = n.w / 2, cy = n.h / 2;
  n.rotation = round(normAngle(angleOf(L)), 4);
  n.x = round(L[4] - cx + L[0] * cx + L[2] * cy);
  n.y = round(L[5] - cy + L[1] * cx + L[3] * cy);
}

export function worldCorners(n) {
  return cornersOf(worldMatrix(n), n.w, n.h);
}

export function worldBounds(n) {
  return aabb(worldCorners(n));
}

// ---------- node factory ----------
const NAMES = {
  frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', text: 'Text', group: 'Group', image: 'Image',
  component: 'Component', componentSet: 'Component set', instance: 'Instance', icon: 'Icon',
};
const counters = {};

export function nextName(type) {
  if (!counters[type]) {
    let max = 0;
    for (const pg of state.doc?.pages || []) {
      walk(pg.children, (n) => {
        const m = n.name.match(new RegExp(`^${NAMES[type]} (\\d+)$`));
        if (m) max = Math.max(max, +m[1]);
      });
    }
    counters[type] = max;
  }
  return `${NAMES[type]} ${++counters[type]}`;
}

// ---------- paints ----------
// Layers have lists of fills and strokes, drawn bottom (index 0) to top. Stroke weight and
// position are shared by all of a layer's strokes, like in Figma.
export const makePaint = (color, opacity = 1) => ({ color, opacity, visible: true });

// Convert the legacy single fill/stroke properties into paint lists. Safe to call repeatedly.
export function migratePaints(n) {
  if (!Array.isArray(n.fills)) n.fills = n.fill ? [makePaint(n.fill, n.fillOpacity ?? 1)] : [];
  if (!Array.isArray(n.strokes)) n.strokes = n.stroke ? [makePaint(n.stroke, n.strokeOpacity ?? 1)] : [];
  delete n.fill;
  delete n.fillOpacity;
  delete n.stroke;
  delete n.strokeOpacity;
  if (n.strokeWidth == null) n.strokeWidth = 1;
  if (!n.strokeAlign) n.strokeAlign = n.type === 'line' ? 'center' : 'inside';
}

// Bump DOC_VERSION and add a step below whenever the saved format changes.
// v3: design tokens can come from linked token files (doc.libraries). Files older than v3 have their
// variables moved into a token file the first time they're opened (see libraries.migrateLegacyTokens).
export const DOC_VERSION = 4;

export function migrateDocument(doc) {
  // v1 → v2: single fill/stroke → paint lists, and a variables container.
  for (const pg of doc.pages) walk(pg.children, migratePaints); // idempotent; also fixes pasted legacy nodes
  if (!doc.variables) doc.variables = { collections: [] };
  // v3 → v4: token groups become objects (from the "/" paths in token names); idempotent. Published and
  // linked copies convert too (to the same group ids), so nothing looks changed.
  const copies = [doc.published, ...(doc.libraries || []), ...(doc.libraries || []).flatMap((l) => l.dependencies || [])];
  for (const c of [...(doc.variables.collections || []), ...copies.flatMap((x) => x?.collections || [])]) normalizeGroups(c);
  for (const d of doc.published?.dependencies || []) for (const c of d.collections || []) normalizeGroups(c);
  doc.version = DOC_VERSION;
  return doc;
}

export function createNode(type, props = {}) {
  const base = {
    id: uid(), type, name: props.name || nextName(type),
    x: 0, y: 0, w: 100, h: 100, rotation: 0,
    opacity: 1, visible: true, locked: false,
    fill: '#D9D9D9', fillOpacity: 1,
    stroke: null, strokeOpacity: 1, strokeWidth: 1, strokeAlign: 'inside',
    radius: 0,
  };
  if (isFrameLike({ type })) Object.assign(base, { fill: '#FFFFFF', children: [], clip: true });
  if (type === 'group') Object.assign(base, { fill: null, children: [] });
  if (type === 'line') Object.assign(base, { fill: null, stroke: '#000000', h: 0 });
  if (type === 'image') Object.assign(base, { fill: null, src: '' });
  // An icon from a linked Sigma Icons file, in its fill color; iconStroke (outline icons) in the icon's units.
  if (type === 'icon') Object.assign(base, { fill: '#1E1E1E', w: 24, h: 24, iconId: null, lockAspect: true });
  if (type === 'text') {
    Object.assign(base, {
      fill: '#000000', text: '', fontFamily: 'Inter', fontSize: 16, fontWeight: 400,
      lineHeight: null, letterSpacing: 0, textAlign: 'left', autoResize: 'width',
    });
  }
  const n = Object.assign(base, props, { id: base.id });
  if ('fills' in props) delete n.fill;
  if ('strokes' in props) delete n.stroke;
  migratePaints(n);
  return n;
}

export function cloneNode(n) {
  const c = JSON.parse(JSON.stringify(n));
  const reid = (x) => {
    x.id = uid();
    x.children?.forEach(reid);
  };
  reid(c);
  return c;
}

// Insert node into parent (null = page) at index (default top).
// A slot inside an instance: a layer derived from a main component's frame that is bound to a slot
// property. Its contents belong to the instance and can be edited freely (see components.js).
export const isSlotArea = (n) => !!(n?.sourceId && n.propRefs?.slot);

// Called before a layer is inserted into or removed from a parent (components.js takes over a slot's
// contents for the instance at that moment).
const structureHooks = [];
export const addStructureHook = (fn) => structureHooks.push(fn);

export function insertNode(node, parent, at) {
  for (const h of structureHooks) h('insert', parent, node);
  const list = parent ? parent.children : page().children;
  if (at == null || at > list.length) at = list.length;
  list.splice(at, 0, node);
  reindex();
}

export function detach(node) {
  const parent = getParent(node.id);
  if (parent) for (const h of structureHooks) h('remove', parent, node);
  const list = siblingsOf(node);
  const i = list.indexOf(node);
  if (i >= 0) list.splice(i, 1);
  return i;
}

export function removeNodes(ids) {
  for (const id of ids) {
    const n = getNode(id);
    if (n) detach(n);
  }
  reindex();
}

// Move node to a new parent while keeping its on-canvas position.
export function reparent(node, newParent, at) {
  const M = worldMatrix(node);
  detach(node);
  insertNode(node, newParent, at);
  setWorldMatrix(node, M);
}

// Shrink-wrap groups around their children (bottom-up) and remove empty groups.
export function fixGroups() {
  let changed = false;
  const fit = (nodes) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!n.children) continue;
      fit(n.children);
      if (n.type !== 'group') continue;
      if (!n.children.length) {
        nodes.splice(i, 1);
        changed = true;
        continue;
      }
      const pts = [];
      for (const c of n.children) pts.push(...cornersOf(localMatrix(c), c.w, c.h));
      const b = aabb(pts);
      if (Math.abs(b.x) < 1e-6 && Math.abs(b.y) < 1e-6 && Math.abs(b.w - n.w) < 1e-6 && Math.abs(b.h - n.h) < 1e-6) continue;
      const G = mul(worldMatrix(n), translate(b.x, b.y));
      for (const c of n.children) {
        c.x = round(c.x - b.x);
        c.y = round(c.y - b.y);
      }
      n.w = round(b.w);
      n.h = round(b.h);
      setWorldMatrix(n, G);
      changed = true;
    }
  };
  for (const pg of state.doc.pages) fit(pg.children);
  if (changed) reindex();
}

// ---------- selection ----------
export function select(ids, { add = false, toggle = false } = {}) {
  ids = ids.filter(Boolean);
  if (toggle) {
    const set = new Set(state.selection);
    for (const id of ids) set.has(id) ? set.delete(id) : set.add(id);
    state.selection = [...set];
  } else if (add) {
    state.selection = [...new Set([...state.selection, ...ids])];
  } else {
    state.selection = ids;
  }
  // A node and its ancestor can't both be selected.
  const sel = state.selection.map(getNode).filter(Boolean);
  state.selection = sel.filter((n) => !sel.some((o) => o !== n && isAncestor(o, n))).map((n) => n.id);
  for (const n of state.selection.map(getNode)) for (const a of ancestors(n)) state.collapsed.delete(a.id);
  emit('selection');
}

// ---------- history & persistence ----------
let past = [];
let future = [];
let lastSnapshot = null;
let saveTimer = null;

const snapshot = () => JSON.stringify(state.doc);

let readOnlyHintAt = 0;

// Forget undo history (after a change that shouldn't be undone, like arranging a new file once).
export function forgetUndo() {
  past = [];
  future = [];
}

export function commit() {
  normalizeDocument();
  const snap = snapshot();
  if (snap === lastSnapshot) return;
  if (state.readOnly) {
    // Viewing an older version: put back whatever was changed.
    state.doc = JSON.parse(lastSnapshot);
    state.editingTextId = null;
    reindex();
    state.selection = state.selection.filter((id) => getNode(id));
    emit('doc');
    if (Date.now() - readOnlyHintAt > 3000) {
      readOnlyHintAt = Date.now();
      window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'You’re viewing an older version. Restore it to make changes.' }));
    }
    return;
  }
  if (lastSnapshot) past.push({ doc: lastSnapshot, selection: [...state.selection] });
  if (past.length > 200) past.shift();
  future = [];
  lastSnapshot = snap;
  scheduleSave({ edited: true });
  emit('doc');
}

function restore(entry) {
  state.doc = JSON.parse(entry.doc);
  lastSnapshot = entry.doc;
  state.editingTextId = null;
  reindex();
  state.selection = (entry.selection || []).filter((id) => getNode(id));
  scheduleSave({ edited: true });
  emit('doc');
}

export function undo() {
  if (!past.length) return;
  const prev = past.pop();
  future.push({ doc: lastSnapshot, selection: [...state.selection] });
  restore(prev);
}

export function redo() {
  if (!future.length) return;
  const next = future.pop();
  past.push({ doc: lastSnapshot, selection: [...state.selection] });
  restore(next);
}

// ---------- persistence ----------
// The file layer (files.js) registers how documents are written. `edited` is true for real document
// changes and false for view-only changes (pan/zoom), so browsing a file doesn't bump its edit time.
let persist = null;
let pendingEdit = false;

export function setPersistence(fn) {
  persist = fn;
}

function scheduleSave({ edited = false } = {}) {
  if (edited) pendingEdit = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), 300);
}

export function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!persist || !state.doc) return Promise.resolve();
  const edited = pendingEdit;
  pendingEdit = false;
  return persist(state.doc, state.pageViews, { edited });
}

// True while a change is waiting for the debounced autosave.
export const hasUnsavedChanges = () => saveTimer !== null || pendingEdit;

// Drop any unsaved change (used when reloading a file that another tab changed).
export function cancelPendingSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  pendingEdit = false;
}

export function saveViewsSoon() {
  scheduleSave();
}

export function loadDocument(doc, views = {}) {
  clearTimeout(saveTimer);
  pendingEdit = false;
  state.doc = migrateDocument(doc);
  state.pageViews = views;
  state.selection = [];
  state.editingTextId = null;
  for (const k of Object.keys(counters)) delete counters[k];
  past = [];
  future = [];
  lastSnapshot = snapshot();
  reindex();
  emit('doc');
}

export function unloadDocument() {
  clearTimeout(saveTimer);
  pendingEdit = false;
  state.doc = null;
  state.selection = [];
  state.hoverId = null;
  state.editingTextId = null;
  past = [];
  future = [];
  lastSnapshot = null;
}
