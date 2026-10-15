import {
  state, page, view, emit, commit, select, selectedNodes, getNode, getParent, siblingsOf, walk,
  createNode, cloneNode, insertNode, detach, removeNodes, reindex, worldMatrix, worldBounds, worldCorners,
  setWorldMatrix, saveViewsSoon, isFrameLike, editNode, pageOf, ancestors, nextName,
} from './store.js';
import { mul, inv, apply, translate, aabb, unionBoxes, round, IDENTITY } from './geom.js';
import { measureText } from './text.js';
import { isAutoLayout, guessLayout, setSizing, layoutOf, directionOf } from './layout.js';
import { applyConstraints } from './constraints.js';
import {
  isInsideInstance, owningInstance, nearestInstance, mainTarget, createInstance, detachInstance, resetOverrides, mainComponentOf, canPlaceInside,
  parseVariantName, formatVariantName, variantsOf, variantDefs, libraryOfComponent, containingComponent, addComponentProp, setSlot,
} from './components.js';
import { ask } from './dialogs.js';

const hint = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));

// Structural commands (delete, group, reorder…) can't touch layers inside an instance.
function structural(nodes, verb) {
  const ok = nodes.filter((n) => !isInsideInstance(n));
  if (ok.length < nodes.length) hint(`Layers inside an instance can't be ${verb}. Edit the main component, or detach the instance.`);
  return ok;
}

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
  const nodes = structural(selectedNodes(), 'deleted');
  if (!nodes.length) return;
  removeNodes(nodes.map((n) => n.id));
  state.selection = [];
  commit();
}

export function duplicateSelection() {
  const ids = [];
  for (const n of sortByZ(structural(selectedNodes(), 'duplicated'))) {
    const parent = getParent(n.id);
    const at = siblingsOf(n).indexOf(n) + 1;
    if (n.type === 'component' && parent?.type === 'componentSet') {
      // A variant duplicates as a new variant of its set, like Figma (named as "+ Variant" names one).
      const props = parseVariantName(n.name);
      const key = Object.keys(props)[0] || 'Property 1';
      const taken = new Set(variantDefs(parent)[key] || []);
      let value = `${props[key] || 'Variant'} copy`;
      for (let i = 2; taken.has(value); i++) value = `${props[key] || 'Variant'} copy ${i}`;
      const c = cloneNode(n);
      c.name = formatVariantName({ ...props, [key]: value });
      c.y = Math.max(...variantsOf(parent).map((v) => v.y + v.h)) + SET_PADDING; // below the others
      insertNode(c, parent, at);
      fitComponentSet(parent);
      ids.push(c.id);
      continue;
    }
    if (n.type === 'component') {
      // Duplicating a main component creates an instance of it, like Figma.
      const tl = apply(worldMatrix(n), { x: 0, y: 0 });
      ids.push(createInstance(n, { parent, at, x: tl.x + (parent ? 0 : n.w + 40), y: tl.y }).id);
      continue;
    }
    const c = cloneNode(n);
    if (!parent && isFrameLike(n)) c.x = n.x + n.w + 40;
    insertNode(c, parent, at);
    ids.push(c.id);
  }
  if (ids.length) {
    select(ids);
    commit();
  }
}

export function wrapSelection(type = 'group', { commitAfter = true } = {}) {
  const nodes = sortByZ(structural(selectedNodes(), 'grouped'));
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
  if (nodes.length === 1 && ['frame', 'component'].includes(nodes[0].type) && !isAutoLayout(nodes[0])) {
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
  for (const n of structural(selectedNodes(), 'ungrouped')) {
    if (!n.children || n.type === 'instance') {
      if (n.type === 'instance') hint('Use Detach instance (⌥⌘B) to ungroup an instance.');
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
  const nodes = sortByZ(structural(selectedNodes(), 'reordered'));
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
  editNode(n, ['x', 'y'], () => setWorldMatrix(n, mul(translate(dx, dy), worldMatrix(n))));
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
  const nodes = structural(selectedNodes(), 'moved').filter((n) => !n.locked);
  const inFlowNodes = nodes.filter((n) => isAutoLayout(getParent(n.id)) && !n.absolute);
  for (const n of nodes) if (!inFlowNodes.includes(n)) moveWorld(n, dx, dy);
  if (inFlowNodes.length) {
    // In auto layout, arrows along the flow direction reorder instead of moving.
    const parent = getParent(inFlowNodes[0].id);
    const horiz = layoutOf(parent).mode === 'horizontal';
    // A right-to-left row runs from the right: left is later.
    const d = Math.sign(horiz ? dx : dy) * (horiz && directionOf(parent) === 'rtl' ? -1 : 1);
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
  for (const n of nodes) editNode(n, ['visible'], () => void (n.visible = v));
  commit();
}

export function toggleLocked(nodes = selectedNodes()) {
  if (!nodes.length) return;
  const l = !nodes.every((n) => n.locked);
  for (const n of nodes) editNode(n, ['locked'], () => void (n.locked = l));
  if (l) state.selection = state.selection.filter((id) => !getNode(id)?.locked);
  commit();
}

export function flip(axis) {
  // Mirror positions of children/rotation; shapes here are symmetric, so flipping a single shape mirrors its rotation.
  for (const n of structural(selectedNodes(), 'flipped')) {
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
    const invalidLimit=['W','H'].some(axis=>{
      if(!Object.hasOwn(props,'min'+axis)&&!Object.hasOwn(props,'max'+axis))return false;
      const min=Object.hasOwn(props,'min'+axis)?props['min'+axis]:n['min'+axis];
      const max=Object.hasOwn(props,'max'+axis)?props['max'+axis]:n['max'+axis];
      return min!=null&&max!=null&&min>max;
    });
    if(invalidLimit){hint('Minimum size cannot exceed maximum size. Clear or adjust the other limit first.');continue;}
    editNode(n, Object.keys(props), () => {
      for (const [k, v] of Object.entries(props)) {
        if (k.startsWith('layout.')) {
          if (n.layout) n.layout[k.slice(7)] = v;
          continue;
        }
        if (k.startsWith('constraints.')) {
          n.constraints = { ...(n.constraints || {}), [k.slice(12)]: v };
          continue;
        }
        if (k.startsWith('radii.')) {
          // One corner: the others keep the shared radius until they're set too.
          if (!(isFrameLike(n) || ['rect', 'image'].includes(n.type))) continue;
          const r = n.radius || 0;
          n.radii = Array.isArray(n.radii) && n.radii.length === 4 ? [...n.radii] : [r, r, r, r];
          n.radii[+k.slice(6)] = v;
          continue;
        }
        if (k === 'radius' && n.radii) delete n.radii; // one radius for all four corners again
        if (k === 'sizingH' || k === 'sizingV') {
          const axis = k === 'sizingH' ? 'w' : 'h';
          if (v === 'hug' && !(isAutoLayout(n) || n.type === 'text')) continue;
          if (v === 'fill' && !isAutoLayout(getParent(n.id))) continue;
          if (axis === 'h' && n.type === 'line') continue;
          setSizing(n, axis, v);
          continue;
        }
        if (k === 'radius' && !(isFrameLike(n) || ['rect', 'image'].includes(n.type))) continue;
        if (k === 'strokeAlign' && n.type === 'line') continue;
        if (k.startsWith('font') || ['lineHeight', 'letterSpacing', 'textAlign', 'textCase', 'truncate', 'maxLines', 'autoResize', 'text'].includes(k)) {
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
          const frameKids0 = ['frame', 'component', 'componentSet'].includes(n.type) ? JSON.parse(JSON.stringify(n.children)) : null;
          const w0 = n.w, h0 = n.h;
          n[k] = next;
          if (lock) n[other] = Math.max(0.01, round(n[other] * ratio));
          if (frameKids0) applyConstraints(n, frameKids0, w0, h0);
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
    });
  }
  if (live) emit('doc');
  else commit();
}

// ---------- components ----------
// ⌥⌘K: a frame becomes a component; anything else is wrapped in a new component.
export function createComponent() {
  const nodes = selectedNodes();
  if (!nodes.length) return;
  if (nodes.some(isInsideInstance)) return hint("Can't create a component inside an instance.");
  if (nodes.some((n) => ancestors(n).some((a) => a.type === 'component'))) {
    return hint("Components can't be created inside another component.");
  }
  let c;
  if (nodes.length === 1 && nodes[0].type === 'component') return hint('This layer is already a component.');
  if (nodes.length === 1 && nodes[0].type === 'frame') {
    c = nodes[0];
    c.type = 'component';
  } else {
    c = wrapSelection('frame', { commitAfter: false });
    if (!c) return;
    c.type = 'component';
    c.name = nextName('component');
    c.fills = [];
  }
  select([c.id]);
  commit();
}

// "Create multiple components": each selected layer becomes its own component (frames are converted,
// other layers are wrapped), like Figma's option for a multi-layer selection.
export function createMultipleComponents() {
  const nodes = selectedNodes();
  if (nodes.length < 2) return createComponent();
  if (nodes.some(isInsideInstance) || nodes.some((n) => n.type === 'component' || ancestors(n).some((a) => a.type === 'component'))) {
    return hint("Components can't be created inside another component or an instance.");
  }
  const made = [];
  for (const n of nodes) {
    if (n.type === 'frame') {
      n.type = 'component';
      made.push(n);
      continue;
    }
    select([n.id]);
    const c = wrapSelection('frame', { commitAfter: false });
    if (!c) continue;
    c.type = 'component';
    c.name = n.name;
    c.fills = [];
    made.push(c);
  }
  select(made.map((c) => c.id));
  commit();
}

// ⌘⇧S "Convert to slot": a frame nested in a main component becomes a slot with a new slot property.
export function convertToSlot() {
  const n = selectedNodes()[0];
  const comp = n && containingComponent(n);
  if (!comp || comp === n || n.type !== 'frame') return hint('Select a frame inside a main component to convert it to a slot.');
  if (n.propRefs?.slot) return hint('This frame is already a slot.');
  const pid = addComponentProp(comp, 'slot', { name: n.name });
  setSlot(n, pid);
  commit();
  hint(`“${n.name}” is now a slot. Its layers are the default content.`);
}

// "Wrap in new slot": wrap the selected layers (in a main component) in a frame that is a new slot.
export function wrapInSlot() {
  const nodes = selectedNodes();
  const comp = nodes[0] && containingComponent(nodes[0]);
  if (!comp || nodes.some((n) => n === comp || containingComponent(n) !== comp)) return hint('Select layers inside one main component.');
  const frame = wrapSelection('frame', { commitAfter: false });
  if (!frame) return;
  frame.name = 'Slot';
  frame.fills = [];
  const pid = addComponentProp(comp, 'slot', { name: 'Slot' });
  setSlot(frame, pid);
  select([frame.id]);
  commit();
}

// ⌥⌘B: turn selected instances into plain frames.
export function detachSelection() {
  const insts = selectedNodes().filter((n) => n.type === 'instance' && !isInsideInstance(n));
  if (!insts.length) return hint('Select an instance to detach.');
  for (const inst of insts) detachInstance(inst);
  select(insts.map((n) => n.id));
  commit();
}

// Select a node anywhere in the document (switching page if needed) and zoom to it.
export function revealNode(node) {
  const pg = pageOf(node.id);
  if (pg && pg.id !== state.doc.currentPageId) state.doc.currentPageId = pg.id;
  state.selection = [node.id];
  emit('doc');
  requestAnimationFrame(() => zoomToSelection());
}

export function goToMainComponent(n = selectedNodes()[0]) {
  const inst = n?.type === 'instance' ? n : n && nearestInstance(n);
  const main = mainTarget(n);
  if (!main) return hint(inst ? 'The main component for this instance is missing.' : 'Select an instance first.');
  const lib = libraryOfComponent(main);
  if (lib) {
    // Library components live in another file: open it to edit them.
    ask(`“${main.name}” comes from the library “${lib.name}”. Open that file in a new tab to edit it?`, { title: 'A library component', ok: 'Open the library' })
      .then((ok) => ok && window.open(`#/file/${encodeURIComponent(lib.fileId)}?nodeId=${encodeURIComponent(main.id)}`, '_blank'));
    return;
  }
  revealNode(main);
}

// Reset overrides on the selected instances (whole instance) or instance layers (just that layer).
export function resetSelectionOverrides() {
  for (const n of selectedNodes()) {
    if (n.type === 'instance' && !isInsideInstance(n)) resetOverrides(n);
    else if (isInsideInstance(n)) resetOverrides(owningInstance(n), n.pathKey);
  }
  commit();
}

// Place an instance of `main` centered on a world point, inside the frame under that point if allowed.
export function placeInstance(main, worldPt, parent = null) {
  const inst = { type: 'instance', componentId: main.id };
  if (parent && !canPlaceInside(inst, parent)) parent = null; // e.g. would put a component inside itself
  const n = createInstance(main, { parent, x: Math.round(worldPt.x - main.w / 2), y: Math.round(worldPt.y - main.h / 2) });
  select([n.id]);
  commit();
  return n;
}

// ---------- variants ----------
const SET_PADDING = 20;

// Grow/shrink a component set around its variants, keeping them in place on the canvas.
export function fitComponentSet(set) {
  if (!set.children.length) return;
  const pts = [];
  for (const c of set.children) pts.push(...worldCorners(c));
  const IW = inv(worldMatrix(set));
  const b = aabb(pts.map((p) => apply(IW, p)));
  const dx = b.x - SET_PADDING, dy = b.y - SET_PADDING;
  for (const c of set.children) {
    c.x = round(c.x - dx);
    c.y = round(c.y - dy);
  }
  set.x = round(set.x + dx);
  set.y = round(set.y + dy);
  set.w = round(b.w + SET_PADDING * 2);
  set.h = round(b.h + SET_PADDING * 2);
}

// Combine selected components into a component set; their names become variant properties.
export function combineAsVariants() {
  const nodes = sortByZ(selectedNodes());
  if (nodes.length < 1 || !nodes.every((n) => n.type === 'component')) return hint('Select components to combine as variants.');
  return combine(nodes);
}

// "+ → Variant" on a main component: it becomes a component set holding it as "Property 1=Default".
export function makeComponentSet(comp) {
  if (comp?.type !== 'component' || getParent(comp.id)?.type === 'componentSet') return null;
  select([comp.id]);
  return combine([comp], { names: ['Property 1=Default'] });
}

function combine(nodes, { names = null } = {}) {
  if (nodes.some((n) => getParent(n.id)?.type === 'componentSet')) return hint('Some of these are already variants in a set.');
  const parent = getParent(nodes[0].id);
  if (nodes.some((n) => getParent(n.id) !== parent)) return hint('Variants must share the same parent.');
  const setName = nodes[0].name.includes('=') ? nextName('componentSet') : nodes[0].name;
  const used = new Set();
  if (names) nodes.forEach((n, i) => void (n.name = names[i] || n.name));
  for (const n of nodes) {
    let props = parseVariantName(n.name);
    if (!Object.keys(props).length) props = { 'Property 1': n.name };
    let name = formatVariantName(props);
    for (let i = 2; used.has(name); i++) name = formatVariantName({ ...props, 'Property 1': `${props['Property 1'] || 'Variant'} ${i}` });
    used.add(name);
    n.name = name;
  }
  const set = wrapSelection('frame', { commitAfter: false });
  set.type = 'componentSet';
  set.name = setName;
  // Component properties move up to the set, which shares them across variants.
  const props = Object.assign({}, ...nodes.map((n) => n.props || {}));
  if (Object.keys(props).length) set.props = props;
  for (const n of nodes) delete n.props;
  set.fills = [];
  set.clip = false;
  fitComponentSet(set);
  select([set.id]);
  commit();
  return set;
}

// Add a variant by duplicating the last one with a new value for the first property.
export function addVariant(set) {
  const variants = variantsOf(set);
  const last = variants[variants.length - 1];
  if (!last) return;
  const props = parseVariantName(last.name);
  const key = Object.keys(props)[0] || 'Property 1';
  const taken = new Set(variantDefs(set)[key] || []);
  let value = `Variant${variants.length + 1}`; // Figma's naming: Variant2, Variant3…
  for (let i = variants.length + 2; taken.has(value); i++) value = `Variant${i}`;
  const c = cloneNode(last);
  c.name = formatVariantName({ ...props, [key]: value });
  c.x = last.x + last.w + SET_PADDING;
  insertNode(c, set);
  fitComponentSet(set);
  select([c.id]);
  commit();
}
