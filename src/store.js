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
};

// Passes that derive geometry from the document (auto layout), run before render and commit.
const normalizers = [];
export function addNormalizer(fn) {
  normalizers.push(fn);
}
export function normalizeDocument() {
  fixGroups();
  for (const fn of normalizers) fn();
  fixGroups();
}

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
const NAMES = { frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', text: 'Text', group: 'Group', image: 'Image' };
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

export function migrateDocument(doc) {
  for (const pg of doc.pages) walk(pg.children, migratePaints);
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
  if (type === 'frame') Object.assign(base, { fill: '#FFFFFF', children: [], clip: true });
  if (type === 'group') Object.assign(base, { fill: null, children: [] });
  if (type === 'line') Object.assign(base, { fill: null, stroke: '#000000', h: 0 });
  if (type === 'image') Object.assign(base, { fill: null, src: '' });
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
export function insertNode(node, parent, at) {
  const list = parent ? parent.children : page().children;
  if (at == null || at > list.length) at = list.length;
  list.splice(at, 0, node);
  reindex();
}

export function detach(node) {
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

export function commit() {
  normalizeDocument();
  const snap = snapshot();
  if (snap === lastSnapshot) return;
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
