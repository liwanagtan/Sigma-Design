import {
  state, page, view, emit, commit, select, selectedNodes, getNode, getParent, walk, createNode, insertNode,
  detach, cloneNode, worldMatrix, worldBounds, setWorldMatrix, isAncestor, siblingsOf, reparent,
  saveViewsSoon, undo, redo, isFrameLike,
} from './store.js';
import {
  mul, inv, apply, translate, rotate, rotateAbout, angleOf, unionBoxes, intersects, contains, distToSegment,
} from './geom.js';
import { selectionGeometry, frameLabels, toWorld, addVariantButton } from './render.js';
import { hitPath, pickFromPath, frameAt } from './hit.js';
import { startEditing, stopEditing, measureText } from './text.js';
import {
  setTool, zoomAt, zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection, deleteSelection, duplicateSelection,
  wrapSelection, ungroupSelection, reorder, nudge, selectAll, selectParent, selectChildren, toggleVisible,
  toggleLocked, scaleKids, sortByZ, flip, addAutoLayout, removeAutoLayout, createComponent, detachSelection, goToMainComponent, resetSelectionOverrides, placeInstance, combineAsVariants,
  addVariant, makeComponentSet, createMultipleComponents, convertToSlot, wrapInSlot,
} from './commands.js';
import { copySelection, cutSelection, paste, pasteHere, importImages, pickImages, exportNodes } from './io.js';
import { isAutoLayout, flowInsertBefore } from './layout.js';
import { isInsideInstance, isTransparentContainer, canPlaceInside, createInstance, containingComponent } from './components.js';
import { slotMenu } from './component-ui.js';
import { applyConstraints } from './constraints.js';
import { showContextMenu, hideContextMenu } from './menu.js';

let canvasEl;
let drag = null;
let lastScreen = { x: 0, y: 0 };
const DRAG_THRESHOLD = 3;

const ROTATE_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M6 15a8 8 0 0 1 9-9" fill="none" stroke="white" stroke-width="4"/><path d="M6 15a8 8 0 0 1 9-9" fill="none" stroke="black" stroke-width="1.5"/><path d="M14 3l3 3-3 3M3 14l3 3 3-3" fill="none" stroke="black" stroke-width="1.5"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, crosshair`;
})();

export function initInteractions(el) {
  canvasEl = el;
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('pointerleave', () => {
    if (!drag && state.hoverId) {
      state.hoverId = null;
      emit('overlay');
    }
  });
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('dblclick', onDoubleClick);
  el.addEventListener('contextmenu', onContextMenu);
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const wp = toWorld(screenPt(e));
    const componentId = e.dataTransfer.getData('application/x-sigma-component');
    if (componentId) {
      const main = getNode(componentId);
      if (main) placeInstance(main, wp, frameAt(wp));
      return;
    }
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) importImages(files, wp);
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    state.spaceDown = false;
    state.altDown = false;
    updateCursor();
  });
  const inEditor = (e) => state.screen === 'editor' && state.doc && !isTyping(e);
  document.addEventListener('copy', (e) => inEditor(e) && copySelection(e));
  document.addEventListener('cut', (e) => inEditor(e) && cutSelection(e));
  document.addEventListener('paste', (e) => inEditor(e) && paste(e));
  // Safari pinch gestures
  let gestureZoom = 1;
  el.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    gestureZoom = 1;
  });
  el.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    zoomAt(e.scale / gestureZoom, screenPt(e));
    gestureZoom = e.scale;
  });
}

function screenPt(e) {
  const r = canvasEl.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

// ---------- snapping ----------
function snapTargets(exclude) {
  const xs = [], ys = [];
  walk(page().children, (n) => {
    if (!n.visible || exclude.has(n.id)) return false;
    const b = worldBounds(n);
    xs.push({ v: b.x, b }, { v: b.x + b.w / 2, b }, { v: b.x + b.w, b });
    ys.push({ v: b.y, b }, { v: b.y + b.h / 2, b }, { v: b.y + b.h, b });
    if (n.type === 'group') return false;
  });
  return { xs, ys };
}

function excludeSet(nodes) {
  const set = new Set();
  for (const n of nodes) walk([n], (c) => void set.add(c.id));
  return set;
}

function nearest(values, targets, th) {
  let best = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t.v - v;
      if (Math.abs(d) <= th && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best;
}

function guidesFor(box, T) {
  const lines = [];
  const eps = 0.01;
  for (const v of [box.x, box.x + box.w / 2, box.x + box.w]) {
    const hits = T.xs.filter((t) => Math.abs(t.v - v) < eps);
    if (!hits.length) continue;
    let y0 = box.y, y1 = box.y + box.h;
    for (const t of hits) {
      y0 = Math.min(y0, t.b.y);
      y1 = Math.max(y1, t.b.y + t.b.h);
    }
    lines.push({ x1: v, y1: y0, x2: v, y2: y1 });
  }
  for (const v of [box.y, box.y + box.h / 2, box.y + box.h]) {
    const hits = T.ys.filter((t) => Math.abs(t.v - v) < eps);
    if (!hits.length) continue;
    let x0 = box.x, x1 = box.x + box.w;
    for (const t of hits) {
      x0 = Math.min(x0, t.b.x);
      x1 = Math.max(x1, t.b.x + t.b.w);
    }
    lines.push({ x1: x0, y1: v, x2: x1, y2: v });
  }
  return lines;
}

const snapThreshold = () => 6 / view().zoom;

// Snap to whole pixels, like Figma's "snap to pixel grid".
const pixel = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });

function snapPoint(p, T, { x = true, y = true } = {}) {
  const th = snapThreshold();
  const dx = x ? nearest([p.x], T.xs, th) : null;
  const dy = y ? nearest([p.y], T.ys, th) : null;
  return { x: p.x + (dx || 0), y: p.y + (dy || 0) };
}

// ---------- handles ----------
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const EDGES = [[0, 1, 0, -1], [1, 2, 1, 0], [2, 3, 0, 1], [3, 0, -1, 0]];

function handleAt(sp) {
  if (state.editingTextId || state.tool !== 'move') return null;
  const g = selectionGeometry();
  if (!g || selectedNodes().some((n) => n.locked || isInsideInstance(n))) return null;
  if (g.kind === 'line') {
    for (let i = 0; i < 2; i++) if (dist(sp, g.ends[i]) <= 7) return { kind: 'line-end', end: i };
    return null;
  }
  const c = g.corners;
  const small = dist(c[0], c[2]) < 16;
  for (let i = 0; i < 4; i++) {
    if (dist(sp, c[i]) <= 6) return { kind: 'resize', hx: CORNERS[i][0], hy: CORNERS[i][1], rot: g.rotation };
  }
  if (!small) {
    for (const [a, b, hx, hy] of EDGES) {
      if (distToSegment(sp, c[a], c[b]) <= 4) return { kind: 'resize', hx, hy, rot: g.rotation };
    }
  }
  if (!pointInPoly(sp, c)) {
    for (let i = 0; i < 4; i++) if (dist(sp, c[i]) <= 20) return { kind: 'rotate' };
  }
  return null;
}

function resizeCursor(hx, hy, rot) {
  let a = (Math.atan2(hy, hx) + rot) * (180 / Math.PI);
  a = ((a % 180) + 180) % 180;
  if (a < 22.5 || a >= 157.5) return 'ew-resize';
  if (a < 67.5) return 'nwse-resize';
  if (a < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

function labelAt(sp) {
  for (let i = frameLabels.length - 1; i >= 0; i--) {
    const l = frameLabels[i];
    // Labels are rotated about their anchor; un-rotate the point.
    const r = (-l.angle * Math.PI) / 180;
    const dx = sp.x - l.x, dy = sp.y - (l.y + 18);
    const px = dx * Math.cos(r) - dy * Math.sin(r), py = dx * Math.sin(r) + dy * Math.cos(r);
    if (px >= 0 && px <= l.w && py >= -18 && py <= -2) {
      const n = getNode(l.id);
      if (n && !n.locked) return n;
    }
  }
  return null;
}

function insideSelectionBox(sp) {
  const g = selectionGeometry();
  return g && g.kind !== 'line' && pointInPoly(sp, g.corners);
}

// ---------- cursor ----------
let cursorOverride = null;
function setCursor(c) {
  cursorOverride = c;
  updateCursor();
}

function updateCursor() {
  if (!canvasEl) return;
  let c = 'default';
  if (state.spaceDown || state.tool === 'hand') c = drag?.type === 'pan' ? 'grabbing' : 'grab';
  else if (cursorOverride) c = cursorOverride;
  else if (['rect', 'ellipse', 'frame', 'line'].includes(state.tool)) c = 'crosshair';
  else if (state.tool === 'text') c = 'text';
  canvasEl.style.cursor = c;
}

// ---------- pointer ----------
function onPointerDown(e) {
  hideContextMenu();
  if (state.editingTextId) stopEditing();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  const sp = screenPt(e), wp = toWorld(sp);
  lastScreen = sp;
  if (e.button === 2) return;
  canvasEl.setPointerCapture(e.pointerId);

  if (e.button === 1 || state.spaceDown || state.tool === 'hand') {
    const v = view();
    drag = { type: 'pan', start: sp, view0: { x: v.x, y: v.y } };
    updateCursor();
    return;
  }
  if (e.button !== 0) return;

  if (['rect', 'ellipse', 'frame', 'line', 'text'].includes(state.tool)) return beginDraw(wp, sp, e);

  if (addVariantButton && Math.hypot(sp.x - addVariantButton.x, sp.y - addVariantButton.y) <= addVariantButton.r + 2) {
    const set = getNode(addVariantButton.setId);
    if (set) return addVariant(set);
  }

  const h = handleAt(sp);
  if (h) return beginTransform(h, wp, sp, e);

  const label = labelAt(sp);
  if (label) {
    if (!state.selection.includes(label.id)) select([label.id], { add: e.shiftKey });
    return beginMove(wp, sp, e, {});
  }

  const path = hitPath(wp);
  const target = pickFromPath(path, { deep: e.metaKey || e.ctrlKey });
  if (target) {
    const already = state.selection.includes(target.id);
    if (e.shiftKey) {
      if (!already) select([target.id], { add: true });
      return beginMove(wp, sp, e, { toggleOnClick: already ? target.id : null });
    }
    if (!already) {
      // Dragging on the empty background of a top-level frame with content starts a marquee inside it.
      const isFrameBg = isTransparentContainer(target) && !getParent(target.id) && target.children.length &&
        path[path.length - 1] === target;
      if (isFrameBg && !insideSelectionBox(sp)) {
        drag = { type: 'pending-frame', frame: target, start: sp, startWorld: wp, shift: e.shiftKey };
        return;
      }
      select([target.id]);
      return beginMove(wp, sp, e, {});
    }
    return beginMove(wp, sp, e, { selectOnClick: state.selection.length > 1 ? target.id : null });
  }
  if (insideSelectionBox(sp)) return beginMove(wp, sp, e, {});
  beginMarquee(wp, sp, e, null);
}

function onPointerMove(e) {
  const sp = screenPt(e);
  lastScreen = sp;
  if (!drag) return updateHover(sp, e);
  const wp = toWorld(sp);
  const moved = dist(sp, drag.start) > DRAG_THRESHOLD;
  switch (drag.type) {
    case 'pan': {
      const v = view();
      v.x = drag.view0.x + sp.x - drag.start.x;
      v.y = drag.view0.y + sp.y - drag.start.y;
      emit('view');
      break;
    }
    case 'pending-frame':
      if (moved) beginMarquee(drag.startWorld, drag.start, { shiftKey: drag.shift }, drag.frame);
      break;
    case 'marquee':
      updateMarquee(wp);
      break;
    case 'move':
      if (moved || drag.started) updateMove(wp, e);
      break;
    case 'draw':
      if (moved || drag.node) updateDraw(wp, e);
      break;
    case 'resize-single':
      updateResizeSingle(wp, e);
      break;
    case 'resize-multi':
      updateResizeMulti(wp, e);
      break;
    case 'rotate':
      updateRotate(wp, e);
      break;
    case 'line-end':
      updateLineEnd(wp, e);
      break;
  }
}

function onPointerUp(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  const sp = screenPt(e);
  const wp = toWorld(sp);
  state.guides = [];
  if (canvasEl.hasPointerCapture(e.pointerId)) canvasEl.releasePointerCapture(e.pointerId);
  switch (d.type) {
    case 'pan':
      saveViewsSoon();
      break;
    case 'pending-frame':
      select([d.frame.id], { add: d.shift });
      break;
    case 'marquee':
      state.marquee = null;
      emit('selection');
      break;
    case 'move':
      state.layoutSkip.clear();
      if (d.started) commit();
      else if (d.toggleOnClick) select([d.toggleOnClick], { toggle: true });
      else if (d.selectOnClick) select([d.selectOnClick]);
      break;
    case 'draw':
      finishDraw(d, wp, e);
      break;
    case 'resize-single':
    case 'resize-multi':
    case 'rotate':
    case 'line-end':
      commit();
      break;
  }
  setCursor(null);
  updateHover(sp, e);
  emit('overlay');
}

// ---------- hover & measurement ----------
function updateHover(sp, e = {}) {
  if (state.tool !== 'move' || state.spaceDown) {
    if (state.hoverId) {
      state.hoverId = null;
      emit('overlay');
    }
    cursorOverride = null;
    return updateCursor();
  }
  const h = handleAt(sp);
  if (h) {
    cursorOverride = h.kind === 'rotate' ? ROTATE_CURSOR : h.kind === 'line-end' ? 'move' : resizeCursor(h.hx, h.hy, h.rot);
  } else {
    cursorOverride = null;
  }
  updateCursor();
  const wp = toWorld(sp);
  const label = labelAt(sp);
  const target = label || (h ? null : pickFromPath(hitPath(wp), { deep: e.metaKey || e.ctrlKey }));
  const id = target?.id || null;
  const changed = id !== state.hoverId;
  state.hoverId = id;
  const measureChanged = computeMeasure();
  if (changed || measureChanged) emit('overlay');
}

function computeMeasure() {
  const before = JSON.stringify([state.measure, state.measureTarget]);
  state.measure = null;
  state.measureTarget = null;
  const sel = selectedNodes();
  if (state.altDown && sel.length && !drag) {
    let target = state.hoverId && !state.selection.includes(state.hoverId) ? getNode(state.hoverId) : null;
    if (target && sel.some((s) => isAncestor(s, target))) target = null;
    if (!target) target = getParent(sel[0].id);
    if (target) {
      const S = unionBoxes(sel.map(worldBounds));
      const T = worldBounds(target);
      const lines = [];
      const cx = S.x + S.w / 2, cy = S.y + S.h / 2;
      const fmt = (v) => String(Math.round(v * 100) / 100);
      const add = (x1, y1, x2, y2) => {
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len > 0.001) lines.push({ x1, y1, x2, y2, label: fmt(len) });
      };
      if (contains(T, S)) {
        add(T.x, cy, S.x, cy);
        add(S.x + S.w, cy, T.x + T.w, cy);
        add(cx, T.y, cx, S.y);
        add(cx, S.y + S.h, cx, T.y + T.h);
      } else if (contains(S, T)) {
        const tcx = T.x + T.w / 2, tcy = T.y + T.h / 2;
        add(S.x, tcy, T.x, tcy);
        add(T.x + T.w, tcy, S.x + S.w, tcy);
        add(tcx, S.y, tcx, T.y);
        add(tcx, T.y + T.h, tcx, S.y + S.h);
      } else {
        const oy0 = Math.max(S.y, T.y), oy1 = Math.min(S.y + S.h, T.y + T.h);
        const my = oy0 < oy1 ? (oy0 + oy1) / 2 : cy;
        const ox0 = Math.max(S.x, T.x), ox1 = Math.min(S.x + S.w, T.x + T.w);
        const mx = ox0 < ox1 ? (ox0 + ox1) / 2 : cx;
        if (S.x + S.w <= T.x) add(S.x + S.w, my, T.x, my);
        else if (T.x + T.w <= S.x) add(T.x + T.w, my, S.x, my);
        if (S.y + S.h <= T.y) add(mx, S.y + S.h, mx, T.y);
        else if (T.y + T.h <= S.y) add(mx, T.y + T.h, mx, S.y);
      }
      state.measure = lines;
      state.measureTarget = target.id;
    }
  }
  return before !== JSON.stringify([state.measure, state.measureTarget]);
}

// ---------- marquee ----------
function beginMarquee(wp, sp, e, context) {
  drag = { type: 'marquee', start: sp, startWorld: wp, context, base: e.shiftKey ? [...state.selection] : [] };
  if (!e.shiftKey) select([]);
}

function updateMarquee(wp) {
  const a = drag.startWorld;
  const box = { x: Math.min(a.x, wp.x), y: Math.min(a.y, wp.y), w: Math.abs(wp.x - a.x), h: Math.abs(wp.y - a.y) };
  state.marquee = box;
  const hits = [];
  const candidates = drag.context ? drag.context.children : page().children;
  for (const n of candidates) {
    if (!n.visible || n.locked) continue;
    const b = worldBounds(n);
    if (!drag.context && isTransparentContainer(n) && n.children.length && !contains(box, b)) {
      for (const c of n.children) if (c.visible && !c.locked && intersects(box, worldBounds(c))) hits.push(c.id);
    } else if (intersects(box, b)) {
      hits.push(n.id);
    }
  }
  select([...drag.base, ...hits]);
}

// ---------- move ----------
function beginMove(wp, sp, e, extra) {
  drag = { type: 'move', start: sp, startWorld: wp, started: false, alt: e.altKey, ...extra };
}

function startMoveDrag() {
  // Layers inside an instance can't be moved; their position comes from the main component.
  let nodes = selectedNodes().filter((n) => !n.locked && !isInsideInstance(n));
  if (drag.alt) {
    const clones = [];
    for (const n of sortByZ(nodes)) {
      const parent = getParent(n.id), at = siblingsOf(n).indexOf(n) + 1;
      if (n.type === 'component') {
        // ⌥-dragging a main component drags out an instance of it.
        const tl = apply(worldMatrix(n), { x: 0, y: 0 });
        clones.push(createInstance(n, { parent, at, x: tl.x, y: tl.y }));
        continue;
      }
      const c = cloneNode(n);
      insertNode(c, parent, at);
      clones.push(c);
    }
    nodes = clones;
    select(clones.map((c) => c.id));
  }
  drag.started = true;
  for (const n of nodes) state.layoutSkip.add(n.id);
  drag.items = nodes.map((n) => ({ n, M0: worldMatrix(n) }));
  drag.box0 = unionBoxes(nodes.map(worldBounds));
  drag.exclude = excludeSet(nodes);
  drag.targets = snapTargets(drag.exclude);
}

function updateMove(wp, e) {
  if (!drag.started) startMoveDrag();
  if (!drag.items.length) return;
  let dx = Math.round(wp.x - drag.startWorld.x), dy = Math.round(wp.y - drag.startWorld.y);
  if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
  const b0 = drag.box0;
  const box = { x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h };
  const th = snapThreshold();
  const T = drag.targets;
  let targetFrame = frameAt(wp, drag.exclude);
  // Never move a component inside itself (directly or through instances).
  const canReparent = drag.items.every(({ n }) => canPlaceInside(n, targetFrame));
  const intoFlow = canReparent && isAutoLayout(targetFrame) && drag.items.some(({ n }) => !n.absolute);
  if (!(e.metaKey || e.ctrlKey) && !intoFlow) {
    const sx = !e.shiftKey || dx !== 0 ? nearest([box.x, box.x + box.w / 2, box.x + box.w], T.xs, th) : null;
    const sy = !e.shiftKey || dy !== 0 ? nearest([box.y, box.y + box.h / 2, box.y + box.h], T.ys, th) : null;
    dx += sx || 0;
    dy += sy || 0;
    box.x = b0.x + dx;
    box.y = b0.y + dy;
    state.guides = guidesFor(box, T);
  } else {
    state.guides = [];
  }

  // Live reparenting into the frame under the pointer. Auto layout frames take the
  // layer into their flow at the pointer position; siblings reflow around it.
  const before = intoFlow
    ? flowInsertBefore(targetFrame, apply(inv(worldMatrix(targetFrame)), wp), drag.exclude)
    : null;
  for (const { n, M0 } of drag.items) {
    const p = getParent(n.id);
    if (p?.type !== 'group' && canReparent) {
      if (intoFlow && !(n.absolute && p === targetFrame)) {
        if (p !== targetFrame) n.absolute = false;
        detach(n);
        const list = targetFrame.children;
        insertNode(n, targetFrame, before ? list.indexOf(before) : list.length);
      } else if (p !== targetFrame) {
        detach(n);
        insertNode(n, targetFrame);
      }
    }
    setWorldMatrix(n, mul(translate(dx, dy), M0));
  }
  emit('doc');
}

// ---------- draw ----------
function beginDraw(wp, sp, e) {
  if (state.tool === 'text') {
    const path = hitPath(wp);
    const leaf = path?.[path.length - 1];
    if (leaf?.type === 'text') {
      setTool('move');
      startEditing(leaf.id, { selectAll: false });
      return;
    }
  }
  const T = snapTargets(new Set());
  drag = { type: 'draw', tool: state.tool, start: sp, startWorld: snapPoint(pixel(wp), T), parent: frameAt(wp), node: null, T };
}

function drawRect(a, b, e) {
  let w = b.x - a.x, h = b.y - a.y;
  if (e.shiftKey) {
    const s = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * s;
    h = Math.sign(h || 1) * s;
  }
  let x = a.x, y = a.y;
  if (e.altKey) {
    x -= w;
    y -= h;
    w *= 2;
    h *= 2;
  }
  return { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h) };
}

function setLineWorld(n, p0, p1) {
  n.w = Math.max(0.01, Math.hypot(p1.x - p0.x, p1.y - p0.y));
  n.h = 0;
  const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
  setWorldMatrix(n, mul(translate(p0.x, p0.y), rotate(ang)));
}

function constrainAngle(p0, p1) {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const a = Math.round(Math.atan2(p1.y - p0.y, p1.x - p0.x) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: p0.x + Math.cos(a) * len, y: p0.y + Math.sin(a) * len };
}

function updateDraw(wp, e) {
  const tool = drag.tool;
  if (!drag.node) {
    const type = tool === 'text' ? 'text' : tool;
    drag.node = createNode(type, type === 'text' ? { autoResize: 'height' } : {});
    insertNode(drag.node, drag.parent);
    state.layoutSkip.add(drag.node.id);
    state.selection = [drag.node.id];
  }
  const n = drag.node;
  let p = snapPoint(pixel(wp), drag.T);
  if (tool === 'line') {
    if (e.shiftKey) p = constrainAngle(drag.startWorld, wp);
    setLineWorld(n, drag.startWorld, p);
  } else {
    const r = drawRect(drag.startWorld, p, e);
    n.w = Math.max(1, r.w);
    n.h = Math.max(1, r.h);
    setWorldMatrix(n, translate(r.x, r.y));
    state.guides = guidesFor(worldBounds(n), drag.T);
  }
  emit('doc');
}

function finishDraw(d, wp, e) {
  let n = d.node;
  if (!n) {
    // Click without drag: create a default-sized shape.
    if (d.tool === 'text') {
      n = createNode('text', { autoResize: 'width' });
      insertNode(n, d.parent);
      measureText(n);
      setWorldMatrix(n, translate(d.startWorld.x, d.startWorld.y - n.h / 2));
    } else {
      n = createNode(d.tool, d.tool === 'line' ? { w: 100 } : {});
      insertNode(n, d.parent);
      setWorldMatrix(n, translate(d.startWorld.x, d.startWorld.y));
    }
  }
  state.layoutSkip.clear();
  const parent = getParent(n.id);
  if (d.node && isAutoLayout(parent)) {
    // Drop the drawn layer into the flow where it was drawn.
    const W = worldMatrix(n);
    const c = apply(W, { x: n.w / 2, y: n.h / 2 });
    const before = flowInsertBefore(parent, apply(inv(worldMatrix(parent)), c), new Set([n.id]));
    detach(n);
    insertNode(n, parent, before ? parent.children.indexOf(before) : parent.children.length);
  } else if (['frame', 'component'].includes(n.type) && d.node) {
    // Adopt siblings that are fully inside the new frame.
    const fb = worldBounds(n);
    const list = siblingsOf(n);
    const inside = list.filter((s) => s !== n && s.visible && !s.locked && contains(fb, worldBounds(s)));
    for (const s of inside) reparent(s, n);
  }
  setTool('move');
  select([n.id]);
  if (n.type === 'text') {
    measureText(n);
    startEditing(n.id);
  } else {
    commit();
  }
}

// ---------- resize / rotate ----------
function beginTransform(h, wp, sp, e) {
  const nodes = selectedNodes();
  const g = selectionGeometry();
  const T = snapTargets(excludeSet(nodes));
  if (h.kind === 'line-end') {
    const n = g.node;
    const W = worldMatrix(n);
    const ends = [apply(W, { x: 0, y: 0 }), apply(W, { x: n.w, y: 0 })];
    drag = { type: 'line-end', start: sp, node: n, end: h.end, fixed: ends[1 - h.end], T };
    return;
  }
  if (h.kind === 'rotate') {
    const box = unionBoxes(nodes.map(worldBounds));
    const center = g.kind === 'single'
      ? apply(worldMatrix(g.node), { x: g.node.w / 2, y: g.node.h / 2 })
      : { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    drag = {
      type: 'rotate', start: sp, center,
      a0: Math.atan2(wp.y - center.y, wp.x - center.x),
      items: nodes.map((n) => ({ n, M0: worldMatrix(n) })),
    };
    setCursor(ROTATE_CURSOR);
    return;
  }
  setCursor(resizeCursor(h.hx, h.hy, h.rot));
  const snapItem = (n) => ({
    n, M0: worldMatrix(n), w0: n.w, h0: n.h,
    kids0: n.type === 'group' ? JSON.parse(JSON.stringify(n.children)) : null,
    // Frames reposition their children by constraints (instances do it when they re-sync).
    frameKids0: ['frame', 'component', 'componentSet'].includes(n.type) ? JSON.parse(JSON.stringify(n.children)) : null,
  });
  if (g.kind === 'single') {
    drag = { type: 'resize-single', start: sp, hx: h.hx, hy: h.hy, T, ...snapItem(g.node) };
  } else {
    drag = { type: 'resize-multi', start: sp, hx: h.hx, hy: h.hy, T, box0: g.box, items: nodes.map(snapItem) };
  }
}

// Compute a resized box in a local frame where the original box is [0,0,w0,h0].
function resizeBox(hx, hy, w0, h0, p, alt, shift) {
  const fx = alt ? 0.5 : hx === -1 ? 1 : 0;
  const fy = alt ? 0.5 : hy === -1 ? 1 : 0;
  let sw = hx ? (p.x - fx * w0) * hx * (alt ? 2 : 1) : w0;
  let sh = hy ? (p.y - fy * h0) * hy * (alt ? 2 : 1) : h0;
  let ax = fx, ay = fy;
  if (shift && w0 > 0 && h0 > 0) {
    if (hx && hy) {
      const s = Math.max(Math.abs(sw) / w0, Math.abs(sh) / h0);
      sw = Math.sign(sw || 1) * w0 * s;
      sh = Math.sign(sh || 1) * h0 * s;
    } else if (hx) {
      sh = (h0 * Math.abs(sw)) / w0;
      ay = 0.5;
    } else if (hy) {
      sw = (w0 * Math.abs(sh)) / h0;
      ax = 0.5;
    }
  }
  const left = ax * w0 - ax * sw, top = ay * h0 - ay * sh;
  return {
    x0: Math.min(left, left + sw), y0: Math.min(top, top + sh),
    w: Math.max(Math.abs(sw), 1), h: Math.max(Math.abs(sh), 1),
    sx: Math.sign(sw || 1), sy: Math.sign(sh || 1),
  };
}

const isAxisAligned = (M) => Math.abs(M[1]) < 1e-6 && Math.abs(M[2]) < 1e-6 && M[0] > 0;

function updateResizeSingle(wp, e) {
  const d = drag;
  const n = d.n;
  if (isAxisAligned(d.M0)) {
    wp = pixel(wp);
    if (!(e.metaKey || e.ctrlKey)) wp = snapPoint(wp, d.T, { x: !!d.hx, y: !!d.hy });
  }
  const p = apply(inv(d.M0), wp);
  const r = resizeBox(d.hx, d.hy, d.w0, d.h0, p, e.altKey, e.shiftKey !== !!n.lockAspect);
  n.w = r.w;
  n.h = r.h;
  if (d.hx || n.lockAspect) n.sizingH = 'fixed';
  if (d.hy || n.lockAspect) n.sizingV = 'fixed';
  if (d.kids0) scaleKids(n.children, d.kids0, r.w / d.w0, r.h / d.h0);
  if (d.frameKids0) applyConstraints(n, d.frameKids0, d.w0, d.h0, { ignore: e.metaKey || e.ctrlKey }); // ⌘ ignores constraints
  if (n.type === 'text') {
    n.autoResize = d.hy === 0 ? 'height' : 'fixed';
    measureText(n);
  }
  setWorldMatrix(n, mul(d.M0, translate(r.x0, r.y0)));
  state.guides = isAxisAligned(d.M0) ? guidesFor(worldBounds(n), d.T) : [];
  emit('doc');
}

function updateResizeMulti(wp, e) {
  const d = drag;
  const b0 = d.box0;
  wp = pixel(wp);
  if (!(e.metaKey || e.ctrlKey)) wp = snapPoint(wp, d.T, { x: !!d.hx, y: !!d.hy });
  const locked = d.items.every((it) => it.n.lockAspect);
  const r = resizeBox(d.hx, d.hy, b0.w, b0.h, { x: wp.x - b0.x, y: wp.y - b0.y }, e.altKey, e.shiftKey !== locked);
  const sx = r.w / b0.w, sy = r.h / b0.h;
  const nx = b0.x + r.x0, ny = b0.y + r.y0;
  for (const it of d.items) {
    const { n, M0 } = it;
    const c0 = apply(M0, { x: it.w0 / 2, y: it.h0 / 2 });
    const c = { x: nx + (c0.x - b0.x) * sx, y: ny + (c0.y - b0.y) * sy };
    n.w = Math.max(1, it.w0 * sx);
    n.h = n.type === 'line' ? 0 : Math.max(1, it.h0 * sy);
    if (it.kids0) scaleKids(n.children, it.kids0, n.w / it.w0, n.h / it.h0);
    if (it.frameKids0) applyConstraints(n, it.frameKids0, it.w0, it.h0, { ignore: e.metaKey || e.ctrlKey });
    if (n.type === 'text') n.autoResize = 'fixed';
    if (d.hx || locked) n.sizingH = 'fixed';
    if (d.hy || locked) n.sizingV = 'fixed';
    const M = mul(translate(c.x, c.y), mul(rotate(angleOf(M0)), translate(-n.w / 2, -n.h / 2)));
    setWorldMatrix(n, M);
  }
  state.guides = guidesFor({ x: nx, y: ny, w: r.w, h: r.h }, d.T);
  emit('doc');
}

function updateRotate(wp, e) {
  const d = drag;
  let delta = ((Math.atan2(wp.y - d.center.y, wp.x - d.center.x) - d.a0) * 180) / Math.PI;
  if (e.shiftKey) {
    const base = angleOf(d.items[0].M0);
    delta = Math.round((base + delta) / 15) * 15 - base;
  }
  const R = rotateAbout(delta, d.center.x, d.center.y);
  for (const { n, M0 } of d.items) setWorldMatrix(n, mul(R, M0));
  emit('doc');
}

function updateLineEnd(wp, e) {
  const d = drag;
  let p = snapPoint(pixel(wp), d.T);
  if (e.shiftKey) p = constrainAngle(d.fixed, wp);
  if (d.end === 0) setLineWorld(d.node, p, d.fixed);
  else setLineWorld(d.node, d.fixed, p);
  emit('doc');
}

// ---------- wheel / dblclick / context menu ----------
function onWheel(e) {
  e.preventDefault();
  const sp = screenPt(e);
  if (e.ctrlKey || e.metaKey) {
    const k = e.deltaMode === 1 ? 0.05 : 0.01;
    const factor = Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * k);
    zoomAt(factor, sp);
  } else {
    const v = view();
    const mult = e.deltaMode === 1 ? 16 : 1;
    let dx = e.deltaX * mult, dy = e.deltaY * mult;
    if (e.shiftKey && !dx) [dx, dy] = [dy, 0];
    v.x -= dx;
    v.y -= dy;
    saveViewsSoon();
    emit('view');
  }
  if (!drag) updateHover(sp, e);
}

function onDoubleClick(e) {
  if (state.tool !== 'move') return;
  const sp = screenPt(e), wp = toWorld(sp);
  const label = labelAt(sp);
  if (label) {
    window.dispatchEvent(new CustomEvent('sigma:rename', { detail: label.id }));
    return;
  }
  const path = hitPath(wp);
  if (!path) return;
  const sel = selectedNodes();
  const cur = sel.length === 1 ? sel[0] : null;
  const i = cur ? path.indexOf(cur) : -1;
  if (cur && cur.type === 'text' && i >= 0) return startEditing(cur.id, { selectAll: true });
  if (i >= 0 && i < path.length - 1) {
    const next = path[i + 1];
    select([next.id]);
    return;
  }
  const leaf = path[path.length - 1];
  if (leaf.type === 'text' && pickFromPath(path) === leaf) startEditing(leaf.id);
}

function onContextMenu(e) {
  e.preventDefault();
  if (state.editingTextId) stopEditing();
  const sp = screenPt(e), wp = toWorld(sp);
  const target = labelAt(sp) || pickFromPath(hitPath(wp));
  if (target && !state.selection.includes(target.id)) select([target.id]);
  const has = state.selection.length > 0;
  const nodes = selectedNodes();
  const items = has ? [
    { label: 'Copy', shortcut: '⌘C', action: () => copySelection() },
    { label: 'Paste here', shortcut: '⌘V', action: () => pasteHere(wp) },
    { label: 'Duplicate', shortcut: '⌘D', action: duplicateSelection },
    { label: 'Delete', shortcut: '⌫', action: deleteSelection },
    '-',
    { label: 'Bring to front', shortcut: '⌥⌘]', action: () => reorder('front') },
    { label: 'Bring forward', shortcut: '⌘]', action: () => reorder('forward') },
    { label: 'Send backward', shortcut: '⌘[', action: () => reorder('backward') },
    { label: 'Send to back', shortcut: '⌥⌘[', action: () => reorder('back') },
    '-',
    { label: 'Group selection', shortcut: '⌘G', action: () => wrapSelection('group') },
    { label: 'Frame selection', shortcut: '⌥⌘G', action: () => wrapSelection('frame') },
    { label: 'Create component', shortcut: '⌥⌘K', action: createComponent },
    ...(nodes.length > 1 && !nodes.some((n) => n.type === 'component' || n.type === 'componentSet' || n.type === 'instance')
      ? [{ label: 'Create multiple components', action: createMultipleComponents }] : []),
    ...(nodes.length > 1 && nodes.every((n) => n.type === 'component' && getParent(n.id)?.type !== 'componentSet') ? [{ label: 'Combine as variants', action: combineAsVariants }] : []),
    // Main component / set: add a variant (a main component becomes a set), like Figma's Main component menu.
    ...(nodes.length === 1 && (nodes[0].type === 'component' || nodes[0].type === 'componentSet') ? [{
      label: 'Add variant',
      action: () => {
        const n = nodes[0];
        const set = n.type === 'componentSet' ? n : getParent(n.id)?.type === 'componentSet' ? getParent(n.id) : makeComponentSet(n);
        if (set) addVariant(set);
      },
    }] : []),
    // Slots: a frame in a main component converts; other layers there wrap into a new slot.
    ...(nodes.length && nodes.every((n) => containingComponent(n) && containingComponent(n) !== n && !isInsideInstance(n)) ? [
      nodes.length === 1 && nodes[0].type === 'frame'
        ? { label: nodes[0].propRefs?.slot ? 'Change slot…' : 'Convert to slot', shortcut: '⇧⌘S', action: () => (nodes[0].propRefs?.slot ? slotMenu({ left: e.clientX, bottom: e.clientY }, nodes[0]) : convertToSlot()) }
        : { label: 'Wrap in new slot', action: wrapInSlot },
    ] : []),
    ...(nodes.some((n) => n.type === 'instance' || isInsideInstance(n)) ? [
      { label: 'Go to main component', action: goToMainComponent },
      { label: 'Reset all changes', action: resetSelectionOverrides },
      { label: 'Detach instance', shortcut: '⌥⌘B', action: detachSelection },
    ] : []),
    nodes.length === 1 && isAutoLayout(nodes[0])
      ? { label: 'Remove auto layout', shortcut: '⌥⇧A', action: () => removeAutoLayout() }
      : { label: 'Add auto layout', shortcut: '⇧A', action: addAutoLayout },
    ...(nodes.some((n) => n.children) ? [{ label: 'Ungroup', shortcut: '⇧⌘G', action: ungroupSelection }] : []),
    '-',
    { label: 'Flip horizontal', shortcut: '⇧H', action: () => flip('x') },
    { label: 'Flip vertical', shortcut: '⇧V', action: () => flip('y') },
    '-',
    { label: nodes.every((n) => n.visible) ? 'Hide' : 'Show', shortcut: '⇧⌘H', action: () => toggleVisible() },
    { label: nodes.every((n) => n.locked) ? 'Unlock' : 'Lock', shortcut: '⇧⌘L', action: () => toggleLocked() },
    '-',
    { label: 'Export as PNG', action: () => exportNodes(selectedNodes(), { format: 'png', scale: 2 }) },
    { label: 'Export as SVG', action: () => exportNodes(selectedNodes(), { format: 'svg' }) },
  ] : [
    { label: 'Paste here', shortcut: '⌘V', action: () => pasteHere(wp) },
    { label: 'Place image…', shortcut: '⇧⌘K', action: () => pickImages(wp) },
    '-',
    { label: 'Select all', shortcut: '⌘A', action: selectAll },
    { label: 'Zoom to fit', shortcut: '⇧1', action: zoomToFit },
  ];
  showContextMenu(e.clientX, e.clientY, items);
}

// ---------- keyboard ----------
const TOOL_KEYS = { v: 'move', h: 'hand', f: 'frame', a: 'frame', r: 'rect', o: 'ellipse', l: 'line', t: 'text' };

function onKeyDown(e) {
  if (state.screen !== 'editor' || !state.doc) return;
  if (e.key === 'Alt') {
    state.altDown = true;
    if (!drag) updateHover(lastScreen, e);
  }
  if (isTyping(e)) return;
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();

  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.spaceDown) {
      state.spaceDown = true;
      updateCursor();
    }
    return;
  }

  if (mod && e.altKey && e.code === 'KeyK') {
    e.preventDefault();
    return createComponent();
  }
  if (mod && e.shiftKey && !e.altKey && e.code === 'KeyS') {
    e.preventDefault();
    return convertToSlot();
  }
  if (mod && e.altKey && e.code === 'KeyB') {
    e.preventDefault();
    return detachSelection();
  }
  if (mod) {
    switch (true) {
      case k === 'z' && e.shiftKey:
      case k === 'y':
        e.preventDefault();
        return redo();
      case k === 'z':
        e.preventDefault();
        return undo();
      case k === 'd':
        e.preventDefault();
        return duplicateSelection();
      case k === 'a':
        e.preventDefault();
        return selectAll();
      case k === 'g' && e.shiftKey:
        e.preventDefault();
        return ungroupSelection();
      case k === 'g':
        e.preventDefault();
        return wrapSelection(e.altKey ? 'frame' : 'group');
      case e.code === 'BracketRight':
        e.preventDefault();
        return reorder(e.altKey ? 'front' : 'forward');
      case e.code === 'BracketLeft':
        e.preventDefault();
        return reorder(e.altKey ? 'back' : 'backward');
      case k === 'h' && e.shiftKey:
        e.preventDefault();
        return toggleVisible();
      case k === 'l' && e.shiftKey:
        e.preventDefault();
        return toggleLocked();
      case k === 'k' && e.shiftKey:
        e.preventDefault();
        return pickImages();
      case k === '=' || k === '+':
        e.preventDefault();
        return zoomIn();
      case k === '-':
        e.preventDefault();
        return zoomOut();
      case k === '0':
        e.preventDefault();
        return zoomTo100();
      case k === 'r':
        e.preventDefault();
        if (state.selection.length === 1) window.dispatchEvent(new CustomEvent('sigma:rename', { detail: state.selection[0] }));
        return;
      case k === 's':
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Autosaved to this browser. Use the menu → Save file… to download a copy.' }));
        return;
      case k === 'e' && e.shiftKey:
        e.preventDefault();
        return exportNodes(selectedNodes().length ? selectedNodes() : page().children, { format: 'png', scale: 2 });
    }
    return;
  }

  if (e.shiftKey && e.code === 'KeyA') {
    e.preventDefault();
    return e.altKey ? removeAutoLayout() : addAutoLayout();
  }
  if (e.shiftKey && !e.altKey) {
    if (e.code === 'Digit0') return zoomTo100();
    if (e.code === 'Digit1') return zoomToFit();
    if (e.code === 'Digit2') return zoomToSelection();
    if (k === 'h') return flip('x');
    if (k === 'v') return flip('y');
    if (e.key === 'Enter') return selectParent();
  }

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      return deleteSelection();
    case 'Escape':
      if (state.tool !== 'move') return setTool('move');
      return select([]);
    case 'Enter': {
      const sel = selectedNodes();
      if (sel.length === 1 && sel[0].type === 'text') return startEditing(sel[0].id);
      return selectChildren();
    }
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0;
      const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
      return nudge(dx, dy);
    }
  }
  if (!e.shiftKey && !e.altKey && TOOL_KEYS[k]) {
    setTool(TOOL_KEYS[k]);
    updateHover(lastScreen, e);
  }
}

function onKeyUp(e) {
  if (state.screen !== 'editor') return;
  if (e.code === 'Space') {
    state.spaceDown = false;
    updateCursor();
  }
  if (e.key === 'Alt') {
    state.altDown = false;
    if (!drag) updateHover(lastScreen, e);
  }
}

export function refreshCursor() {
  updateCursor();
}
