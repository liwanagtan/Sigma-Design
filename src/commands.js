import {
  state, page, view, emit, commit, select, selectedNodes, getNode, getParent, siblingsOf, walk,
  createNode, cloneNode, insertNode, detach, removeNodes, reindex, worldMatrix, worldBounds, worldCorners,
  setWorldMatrix, saveViewsSoon,
} from './store.js';
import { mul, inv, apply, translate, aabb, unionBoxes, round, IDENTITY } from './geom.js';
import { measureText } from './text.js';
import { isAutoLayout, guessLayout, setSizing } from './layout.js';

let viewportEl = null;
export function setViewportElement(el) {
  viewportEl = el;
}
export function viewportSize() {
  return { width: viewportEl?.clientWidth || 800, height: viewportEl?.clientHeight || 600 };
}

// ---------- tools ----------
export function setTool(tool) {
  state.tool = tool;
  emit('tool');
}

// ---------- zoom ----------
const clampZoom = (z) => Math.min(256, Math.max(0.02, z));

export function zoomAt(factor, sp) {
  const v = view();
  const z = clampZoom(v.zoom * factor);
  const wx = (sp.x - v.x) / v.zoom, wy = (sp.y - v.y) / v.zoom;
  v.zoom = z;
  v.x = sp.x - wx * z;
  v.y = sp.y - wy * z;
  saveViewsSoon();
  emit('view');
}

const center = () => {
  const { width, height } = viewportSize();
  return { x: width / 2, y: height / 2 };
};
export const zoomIn = () => zoomAt(2, center());
export const zoomOut = () => zoomAt(0.5, center());
export const zoomTo100 = () => zoomAt(1 / view().zoom, center());

export function zoomToBox(box, maxZoom = 8) {
  if (!box) return;
  const { width, height } = viewportSize();
  const pad = 64;
  const v = view();
  const z = clampZoom(Math.min((width - pad * 2) / Math.max(box.w, 1), (height - pad * 2) / Math.max(box.h, 1), maxZoom));
  v.zoom = z;
  v.x = width / 2 - (box.x + box.w / 2) * z;
  v.y = height / 2 - (box.y + box.h / 2) * z;
  saveViewsSoon();
  emit('view');
}

export function zoomToFit() {
  const nodes = page().children.filter((n) => n.visible);
  if (!nodes.length) {
    const v = view();
    const c = center();
    Object.assign(v, { zoom: 1, x: c.x, y: c.y });
    return emit('view');
  }
  zoomToBox(unionBoxes(nodes.map(worldBounds)));
}

export function zoomToSelection() {
  const nodes = selectedNodes();
  if (!nodes.length) return zoomToFit();
  zoomToBox(unionBoxes(nodes.map(worldBounds)));
}

// ---------- z-order helpers ----------
function zOrderMap() {
  const order = new Map();
  let i = 0;
  walk(page().children, (n) => {
    order.set(n.id, i++);
  });
  return order;
}

export function sortByZ(nodes) {
  const order = zOrderMap();
  return [...nodes].sort((a, b) => order.get(a.id) - order.get(b.id));
}

// ---------- editing ----------
export function deleteSelection() {
  if (!state.selection.length) return;
  removeNodes(state.selection);
  state.selection = [];
  commit();
}

export function duplicateSelection() {
  const ids = [];
  for (const n of sortByZ(selectedNodes())) {
    const c = cloneNode(n);
    const parent = getParent(n.id);
    if (!parent && n.type === 'frame') c.x = n.x + n.w + 40;
    insertNode(c, parent, siblingsOf(n).indexOf(n) + 1);
    ids.push(c.id);
  }
  if (ids.length) {
    select(ids);
    commit();
  }
}

export function wrapSelection(type = 'group', { commitAfter = true } = {}) {
  const nodes = sortByZ(selectedNodes());
  if (!nodes.length) return null;
  const parent = getParent(nodes[0].id);
  const list = parent ? parent.children : page().children;
  const PW = parent ? worldMatrix(parent) : IDENTITY;
  const IPW = inv(PW);
  const pts = [];
  for (const n of nodes) for (const p of worldCorners(n)) pts.push(apply(IPW, p));
  const b = aabb(pts);
  const g = createNode(type, { x: b.x, y: b.y, w: Math.max(b.w, 1), h: Math.max(b.h, 1) });
  if (type === 'frame') g.clip = false;
  const mats = nodes.map((n) => worldMatrix(n));
  const top = Math.max(...nodes.map((n) => list.indexOf(n)));
  insertNode(g, parent, top + 1);
  for (const n of nodes) detach(n);
  g.children.push(...nodes);
  reindex();
  nodes.forEach((n, i) => setWorldMatrix(n, mats[i]));
  select([g.id]);
  if (commitAfter) commit();
  return g;
}

// ---------- auto layout ----------
// Shift+A: turn a frame into an auto layout frame, or wrap the selection in a new one.
export function addAutoLayout() {
  const nodes = selectedNodes();
  if (!nodes.length) return;
  let f;
  if (nodes.length === 1 && nodes[0].type === 'frame' && !isAutoLayout(nodes[0])) {
    f = nodes[0];
  } else {
    f = wrapSelection('frame', { commitAfter: false });
    if (!f) return;
    f.fills = [];
  }
  guessLayout(f);
  select([f.id]);
  commit();
}

export function removeAutoLayout(nodes = selectedNodes()) {
  const frames = nodes.filter(isAutoLayout);
  for (const f of frames) {
    f.layout = null;
    if (f.sizingH === 'hug') f.sizingH = 'fixed';
    if (f.sizingV === 'hug') f.sizingV = 'fixed';
  }
  if (frames.length) commit();
}

// Move auto layout children earlier/later in the flow (arrow keys).
function reorderInFlow(nodes, dir) {
  const ordered = dir > 0 ? sortByZ(nodes).reverse() : sortByZ(nodes);
  for (const n of ordered) {
    const list = siblingsOf(n);
    const i = list.indexOf(n);
    const j = i + dir;
    if (j < 0 || j >= list.length || nodes.includes(list[j])) continue;
    [list[i], list[j]] = [list[j], list[i]];
  }
  reindex();
}

export function ungroupSelection() {
  const ids = [];
  for (const n of selectedNodes()) {
    if (!n.children) {
      ids.push(n.id);
      continue;
    }
    const list = siblingsOf(n);
    const i = list.indexOf(n);
    const kids = [...n.children];
    const mats = kids.map((k) => worldMatrix(k));
    list.splice(i, 1, ...kids);
    reindex();
    kids.forEach((k, j) => {
      setWorldMatrix(k, mats[j]);
      if (n.opacity < 1) k.opacity = +(k.opacity * n.opacity).toFixed(3);
    });
    ids.push(...kids.map((k) => k.id));
  }
  select(ids);
  commit();
}

export function reorder(dir) {
  const nodes = sortByZ(selectedNodes());
  if (!nodes.length) return;
  const seq = dir === 'front' || dir === 'backward' ? nodes : [...nodes].reverse();
  const sel = new Set(nodes);
  for (const n of seq) {
    const list = siblingsOf(n);
    const i = list.indexOf(n);
    if (dir === 'front') {
      list.splice(i, 1);
      list.push(n);
    } else if (dir === 'back') {
      list.splice(i, 1);
      list.unshift(n);
    } else if (dir === 'forward' && i < list.length - 1 && !sel.has(list[i + 1])) {
      [list[i], list[i + 1]] = [list[i + 1], list[i]];
    } else if (dir === 'backward' && i > 0 && !sel.has(list[i - 1])) {
      [list[i], list[i - 1]] = [list[i - 1], list[i]];
    }
  }
  reindex();
  commit();
}

function moveWorld(n, dx, dy) {
  setWorldMatrix(n, mul(translate(dx, dy), worldMatrix(n)));
}

export function align(where) {
  const nodes = selectedNodes().filter((n) => !n.locked);
  if (!nodes.length) return;
  let ref;
  if (nodes.length === 1) {
    const p = getParent(nodes[0].id);
    if (!p) return;
    ref = worldBounds(p);
  } else {
    ref = unionBoxes(nodes.map(worldBounds));
  }
  for (const n of nodes) {
    const b = worldBounds(n);
    let dx = 0, dy = 0;
    if (where === 'left') dx = ref.x - b.x;
    if (where === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
    if (where === 'right') dx = ref.x + ref.w - (b.x + b.w);
    if (where === 'top') dy = ref.y - b.y;
    if (where === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
    if (where === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
    moveWorld(n, dx, dy);
  }
  commit();
}

export function distribute(axis) {
  const nodes = selectedNodes().filter((n) => !n.locked);
  if (nodes.length < 3) return;
  const items = nodes.map((n) => ({ n, b: worldBounds(n) }));
  const pos = axis === 'x' ? 'x' : 'y', size = axis === 'x' ? 'w' : 'h';
  items.sort((a, b) => a.b[pos] - b.b[pos]);
  const first = items[0].b, last = items[items.length - 1].b;
  const span = last[pos] + last[size] - first[pos];
  const total = items.reduce((s, it) => s + it.b[size], 0);
  const gap = (span - total) / (items.length - 1);
  let cur = first[pos];
  for (const it of items) {
    const d = cur - it.b[pos];
    moveWorld(it.n, axis === 'x' ? d : 0, axis === 'x' ? 0 : d);
    cur += it.b[size] + gap;
  }
  commit();
}

export function nudge(dx, dy) {
  const nodes = selectedNodes().filter((n) => !n.locked);
  const inFlowNodes = nodes.filter((n) => isAutoLayout(getParent(n.id)) && !n.absolute);
  for (const n of nodes) if (!inFlowNodes.includes(n)) moveWorld(n, dx, dy);
  if (inFlowNodes.length) {
    // In auto layout, arrows along the flow direction reorder instead of moving.
    const horiz = getParent(inFlowNodes[0].id).layout.mode === 'horizontal';
    const d = Math.sign(horiz ? dx : dy);
    if (d) reorderInFlow(inFlowNodes, d);
  }
  if (nodes.length) commit();
}

export function selectAll() {
  const first = selectedNodes()[0];
  const list = first ? siblingsOf(first) : page().children;
  select(list.filter((n) => n.visible && !n.locked).map((n) => n.id));
}

export function selectParent() {
  const parents = selectedNodes().map((n) => getParent(n.id)).filter(Boolean);
  if (parents.length) select(parents.map((p) => p.id));
  else select([]);
}

export function selectChildren() {
  const kids = selectedNodes().flatMap((n) => n.children || []);
  if (kids.length) select(kids.map((k) => k.id));
}

export function toggleVisible(nodes = selectedNodes()) {
  if (!nodes.length) return;
  const v = !nodes.every((n) => n.visible);
  for (const n of nodes) n.visible = v;
  commit();
}

export function toggleLocked(nodes = selectedNodes()) {
  if (!nodes.length) return;
  const l = !nodes.every((n) => n.locked);
  for (const n of nodes) n.locked = l;
  if (l) state.selection = state.selection.filter((id) => !getNode(id)?.locked);
  commit();
}

export function flip(axis) {
  // Mirror positions of children/rotation; shapes here are symmetric, so flipping a single shape mirrors its rotation.
  for (const n of selectedNodes()) {
    n.rotation = -n.rotation;
    if (n.children) {
      for (const c of n.children) {
        if (axis === 'x') c.x = n.w - c.x - c.w;
        else c.y = n.h - c.y - c.h;
        c.rotation = -c.rotation;
      }
    }
  }
  commit();
}

// Scale a group's descendants from a snapshot of their original geometry.
export function scaleKids(kids, kids0, sx, sy) {
  kids.forEach((k, i) => {
    const k0 = kids0[i];
    k.x = round(k0.x * sx);
    k.y = round(k0.y * sy);
    k.w = round(k0.w * sx);
    k.h = round(k0.h * sy);
    if (k.type === 'text') k.autoResize = 'fixed';
    k.sizingH = k.sizingV = 'fixed';
    if (k.type === 'group') scaleKids(k.children, k0.children, sx, sy);
  });
}

// Update props on all selected nodes (from the properties panel).
export function setProps(props, { live = false, nodes = selectedNodes() } = {}) {
  for (const n of nodes) {
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith('layout.')) {
        if (n.layout) n.layout[k.slice(7)] = v;
        continue;
      }
      if (k === 'sizingH' || k === 'sizingV') {
        const axis = k === 'sizingH' ? 'w' : 'h';
        if (v === 'hug' && !(isAutoLayout(n) || n.type === 'text')) continue;
        if (v === 'fill' && !isAutoLayout(getParent(n.id))) continue;
        if (axis === 'h' && n.type === 'line') continue;
        setSizing(n, axis, v);
        continue;
      }
      if (k === 'radius' && !['rect', 'frame', 'image'].includes(n.type)) continue;
      if (k === 'strokeAlign' && n.type === 'line') continue;
      if (k.startsWith('font') || ['lineHeight', 'letterSpacing', 'textAlign', 'autoResize', 'text'].includes(k)) {
        if (n.type !== 'text') continue;
      }
      if (k === 'autoResize' && v !== 'width' && n.sizingH === 'hug') n.sizingH = 'fixed';
      if (k === 'absolute' && !isAutoLayout(getParent(n.id))) continue;
      if (k === 'h' && n.type === 'line') continue;
      if (k === 'w' || k === 'h') {
        // Resize about the top-left corner in parent space (keeps x/y stable even if rotated).
        const M = worldMatrix(n);
        const next = Math.max(0.01, v);
        const other = k === 'w' ? 'h' : 'w';
        const ratio = n[k] > 0 ? next / n[k] : 1;
        const lock = n.lockAspect && n.type !== 'line' && n[other] > 0;
        if (n.type === 'group' && n[k] > 0) {
          scaleKids(n.children, JSON.parse(JSON.stringify(n.children)), k === 'w' || lock ? ratio : 1, k === 'h' || lock ? ratio : 1);
        }
        n[k] = next;
        if (lock) n[other] = Math.max(0.01, round(n[other] * ratio));
        setWorldMatrix(n, M);
        if (n.type === 'text') {
          n.autoResize = lock || k === 'h' ? 'fixed' : n.autoResize === 'width' ? 'height' : n.autoResize;
        }
        // Typing a size makes that axis fixed (no longer hug/fill), like Figma.
        if (k === 'w' || lock) n.sizingH = 'fixed';
        if (k === 'h' || lock) n.sizingV = 'fixed';
        continue;
      }
      if (k === 'rotation') {
        n.rotation = v;
        continue;
      }
      n[k] = v;
    }
    if (n.type === 'text') measureText(n);
  }
  if (live) emit('doc');
  else commit();
}
