import {
  state, page, view, getNode, getParent, selectedNodes, localMatrix, worldMatrix, worldCorners, worldBounds, isFrameLike, walk,
} from './store.js';
import { css, mul, apply, unionBoxes, cornersOf } from './geom.js';
import { textStyle } from './text.js';
import { isInsideInstance } from './components.js';

export const ACCENT = '#0D99FF';
export const COMPONENT_ACCENT = '#9747FF';
const isComponentish = (n) => n && (n.type === 'component' || n.type === 'componentSet' || n.type === 'instance');
export const GUIDE = '#F24822';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function hexToRgba(hex, a = 1) {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function paint(color, opacity, attr = 'fill') {
  if (!color) return `${attr}="none"`;
  return `${attr}="${color}"${opacity < 1 ? ` ${attr}-opacity="${opacity}"` : ''}`;
}

const visiblePaints = (list) => (list || []).filter((p) => p.visible !== false);

// One element per visible fill, bottom to top. `shape(attrs)` returns the element markup.
function fillLayers(n, shape) {
  return visiblePaints(n.fills).map((p) => shape(paint(p.color, p.opacity))).join('');
}

// How far a stroke's centerline sits inside the shape's edge: inside = +sw/2, center = 0, outside = -sw/2.
function strokeInset(n) {
  const align = n.strokeAlign || 'inside';
  return align === 'center' ? 0 : align === 'outside' ? -n.strokeWidth / 2 : n.strokeWidth / 2;
}

const hasStroke = (n) => n.strokeWidth > 0 && visiblePaints(n.strokes).length > 0;

// How far a node's stroke extends beyond its bounds (used to pad exports).
export function strokeOverhang(n) {
  if (!n.visible || !hasStroke(n)) return 0;
  if (n.type === 'line') return n.strokeWidth / 2;
  return Math.max(0, n.strokeWidth / 2 - strokeInset(n));
}

function strokeLayers(n, shape) {
  if (!hasStroke(n)) return '';
  const sw = n.strokeWidth, d = strokeInset(n);
  let geom;
  if (shape === 'ellipse') {
    geom = `<ellipse cx="${n.w / 2}" cy="${n.h / 2}" rx="${Math.max(0, n.w / 2 - d)}" ry="${Math.max(0, n.h / 2 - d)}"`;
  } else {
    const r0 = Math.min(n.radius || 0, n.w / 2, n.h / 2);
    const r = r0 > 0 ? Math.max(0, r0 - d) : 0;
    geom = `<rect x="${d}" y="${d}" width="${Math.max(0, n.w - 2 * d)}" height="${Math.max(0, n.h - 2 * d)}" rx="${r}"`;
  }
  return visiblePaints(n.strokes)
    .map((p) => `${geom} fill="none" ${paint(p.color, p.opacity, 'stroke')} stroke-width="${sw}"/>`).join('');
}

// Renders a node in its parent's coordinate space.
export function nodeSVG(n, opts = {}) {
  if (!n.visible) return '';
  const r = Math.min(n.radius || 0, n.w / 2, n.h / 2);
  let inner = '';
  switch (n.type) {
    case 'frame':
    case 'component':
    case 'componentSet':
    case 'instance': {
      const cid = `clip-${n.id}`;
      const kids = n.children.map((c) => nodeSVG(c, opts)).join('');
      inner = fillLayers(n, (a) => `<rect width="${n.w}" height="${n.h}" rx="${r}" ${a}/>`);
      inner += n.clip
        ? `<clipPath id="${cid}"><rect width="${n.w}" height="${n.h}" rx="${r}"/></clipPath><g clip-path="url(#${cid})">${kids}</g>`
        : `<g>${kids}</g>`;
      inner += strokeLayers(n, 'rect');
      break;
    }
    case 'group':
      inner = n.children.map((c) => nodeSVG(c, opts)).join('');
      break;
    case 'rect':
      inner = fillLayers(n, (a) => `<rect width="${n.w}" height="${n.h}" rx="${r}" ${a}/>`) + strokeLayers(n, 'rect');
      break;
    case 'ellipse':
      inner = fillLayers(n, (a) => `<ellipse cx="${n.w / 2}" cy="${n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" ${a}/>`) + strokeLayers(n, 'ellipse');
      break;
    case 'line':
      inner = visiblePaints(n.strokes).map((p) =>
        `<line x1="0" y1="0" x2="${n.w}" y2="0" ${paint(p.color, p.opacity, 'stroke')} stroke-width="${n.strokeWidth}" stroke-linecap="${n.cap || 'butt'}"/>`).join('');
      break;
    case 'image': {
      const cid = `clip-${n.id}`;
      inner = fillLayers(n, (a) => `<rect width="${n.w}" height="${n.h}" rx="${r}" ${a}/>`) +
        `<clipPath id="${cid}"><rect width="${n.w}" height="${n.h}" rx="${r}"/></clipPath>` +
        `<image href="${esc(n.src)}" width="${n.w}" height="${n.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>` +
        strokeLayers(n, 'rect');
      break;
    }
    case 'text': {
      // Text fills stack like shape fills: one text layer per visible fill.
      const hidden = !opts.export && state.editingTextId === n.id;
      if (n.autoResize === 'width') {
        // Text that never wraps is drawn as native SVG text: much cheaper for the browser than HTML.
        inner = svgText(n, visiblePaints(n.fills), hidden);
        break;
      }
      inner = visiblePaints(n.fills).map((p) =>
        `<foreignObject width="${Math.max(n.w, 1)}" height="${Math.max(n.h, 1)}" style="overflow:visible"${hidden ? ' visibility="hidden"' : ''}>` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="${esc(textStyle(n))};color:${hexToRgba(p.color, p.opacity)};width:${n.autoResize === 'width' ? 'max-content' : n.w + 'px'}">${esc(n.text)}</div></foreignObject>`).join('');
      break;
    }
  }
  const op = n.opacity < 1 ? ` opacity="${n.opacity}"` : '';
  return `<g transform="${css(localMatrix(n))}"${op}>${inner}</g>`;
}

// ---------- native SVG text (for text that doesn't wrap) ----------
let metricsCtx = null;
const metricsCache = new Map();

// Ascent and descent of a font, as the browser lays out an HTML line box with it.
function fontMetrics(n) {
  const font = `${n.fontWeight} ${n.fontSize}px '${n.fontFamily}', system-ui, sans-serif`;
  let m = metricsCache.get(font);
  if (!m) {
    metricsCtx ||= document.createElement('canvas').getContext('2d');
    metricsCtx.font = font;
    const t = metricsCtx.measureText('Hg');
    m = {
      asc: t.fontBoundingBoxAscent ?? t.actualBoundingBoxAscent ?? n.fontSize * 0.8,
      desc: t.fontBoundingBoxDescent ?? t.actualBoundingBoxDescent ?? n.fontSize * 0.2,
    };
    // Fonts still loading report fallback metrics; don't keep those.
    if (!document.fonts || document.fonts.check(font)) metricsCache.set(font, m);
  }
  return m;
}

function svgText(n, paints, hidden) {
  const lines = String(n.text ?? '').split('\n');
  const lineH = n.lineHeight ? (n.lineHeight / 100) * n.fontSize : (n.h || n.fontSize * 1.2) / lines.length;
  const { asc, desc } = fontMetrics(n);
  const baseline = (lineH - (asc + desc)) / 2 + asc; // where an HTML line box puts the baseline
  const anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start';
  const x = anchor === 'middle' ? n.w / 2 : anchor === 'end' ? n.w : 0;
  const spans = lines.map((line, i) => `<tspan x="${x}" y="${(baseline + i * lineH).toFixed(2)}">${esc(line)}</tspan>`).join('');
  const attrs = `font-family="${esc(`'${n.fontFamily}', system-ui, sans-serif`)}" font-size="${n.fontSize}" font-weight="${n.fontWeight}"` +
    (n.letterSpacing ? ` letter-spacing="${n.letterSpacing}"` : '') + ` text-anchor="${anchor}" style="white-space:pre"` +
    (hidden ? ' visibility="hidden"' : '');
  return paints.map((p) => `<text ${attrs} ${paint(p.color, p.opacity)}>${spans}</text>`).join('');
}

// ---------- scene ----------
// One <g> per top-level layer, rebuilt only when that layer's data changed. While dragging one object,
// only it is re-rendered instead of the whole page.
const SVG_NS = 'http://www.w3.org/2000/svg';
const sceneCache = new Map(); // top-level node id -> { key, el }
// Image data URLs can be huge; compare them by length and tail instead of copying them every frame.
const keyReplacer = (k, v) => (k === 'src' && typeof v === 'string' ? `${v.length}:${v.slice(-48)}` : v);

export function renderScene(worldEl) {
  const editing = state.editingTextId || '';
  const seen = new Set();
  let prev = null;
  for (const n of page().children) {
    const key = editing + JSON.stringify(n, keyReplacer);
    let entry = sceneCache.get(n.id);
    if (!entry || entry.key !== key) {
      const holder = document.createElementNS(SVG_NS, 'g');
      holder.innerHTML = nodeSVG(n);
      const el = holder.firstElementChild || document.createElementNS(SVG_NS, 'g'); // hidden layers render nothing
      if (entry) entry.el.replaceWith(el);
      entry = { key, el };
      sceneCache.set(n.id, entry);
    }
    const expected = prev ? prev.nextSibling : worldEl.firstChild;
    if (entry.el !== expected) worldEl.insertBefore(entry.el, expected);
    prev = entry.el;
    seen.add(n.id);
  }
  for (const [id, entry] of sceneCache) {
    if (!seen.has(id)) {
      entry.el.remove();
      sceneCache.delete(id);
    }
  }
  // Anything else left in the group (e.g. from before the cache existed) goes.
  while (prev ? prev.nextSibling : worldEl.firstChild) (prev ? prev.nextSibling : worldEl.firstChild).remove();
}

export function applyViewTransform(worldEl) {
  const v = view();
  worldEl.setAttribute('transform', css([v.zoom, 0, 0, v.zoom, v.x, v.y]));
}

// ---------- screen-space helpers ----------
export function toScreen(p) {
  const v = view();
  return { x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y };
}

export function toWorld(p) {
  const v = view();
  return { x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom };
}

const fmt = (v) => String(Math.round(v * 100) / 100);

// Geometry of the current selection's transform box, in screen space.
export function selectionGeometry() {
  const nodes = selectedNodes();
  if (!nodes.length) return null;
  if (nodes.length === 1) {
    const n = nodes[0];
    const W = worldMatrix(n);
    if (n.type === 'line') {
      return { kind: 'line', node: n, ends: [toScreen(apply(W, { x: 0, y: 0 })), toScreen(apply(W, { x: n.w, y: 0 }))] };
    }
    const corners = cornersOf(W, n.w, n.h).map(toScreen);
    return { kind: 'single', node: n, corners, rotation: Math.atan2(W[1], W[0]), w: n.w, h: n.h };
  }
  const b = unionBoxes(nodes.map(worldBounds));
  const corners = [
    { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
  ].map(toScreen);
  return { kind: 'multi', box: b, corners, rotation: 0, w: b.w, h: b.h };
}

let labelCtx = null;
function labelWidth(text) {
  if (!labelCtx) labelCtx = document.createElement('canvas').getContext('2d');
  labelCtx.font = '500 11px Inter, system-ui, sans-serif';
  return labelCtx.measureText(text).width;
}

// Top-level frame name labels (hit-testable).
export let frameLabels = [];
export let addVariantButton = null; // { x, y, r, setId } in screen space, when shown

function poly(pts, attrs) {
  return `<polygon points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
}

function pill(x, y, text, bg) {
  const w = labelWidth(text) + 8;
  return `<g transform="translate(${x - w / 2},${y})"><rect width="${w}" height="16" rx="2" fill="${bg}"/>` +
    `<text x="${w / 2}" y="11.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="500" font-family="Inter,system-ui,sans-serif">${esc(text)}</text></g>`;
}

export function renderOverlay(svg) {
  let out = '';
  const sel = new Set(state.selection);

  // Frame labels
  frameLabels = [];
  for (const n of page().children) {
    if (!isFrameLike(n) || !n.visible) continue;
    const W = worldMatrix(n);
    const tl = toScreen(apply(W, { x: 0, y: 0 }));
    const tr = toScreen(apply(W, { x: n.w, y: 0 }));
    const maxW = Math.max(0, Math.hypot(tr.x - tl.x, tr.y - tl.y));
    let text = (n.type === 'component' || n.type === 'componentSet' ? '❖ ' : n.type === 'instance' ? '◇ ' : '') + n.name;
    if (labelWidth(text) > maxW) {
      while (text.length > 1 && labelWidth(text + '…') > maxW) text = text.slice(0, -1);
      text = maxW < 16 ? '' : text + '…';
    }
    const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180 / Math.PI;
    const color = isComponentish(n) ? COMPONENT_ACCENT : sel.has(n.id) ? ACCENT : state.hoverId === n.id ? '#333' : '#8C8C8C';
    out += `<text transform="translate(${tl.x},${tl.y}) rotate(${angle})" y="-6" fill="${color}" font-size="11" font-weight="500" font-family="Inter,system-ui,sans-serif">${esc(text)}</text>`;
    frameLabels.push({ id: n.id, x: tl.x, y: tl.y - 18, w: Math.max(labelWidth(text), 8), h: 16, angle });
  }

  // Component sets get Figma's dashed purple border (canvas chrome only, never exported).
  const sets = [];
  walk(page().children, (n) => {
    if (n.type === 'componentSet' && n.visible) sets.push(n);
    if (n.type === 'instance') return false;
  });
  for (const set of sets) {
    out += poly(worldCorners(set).map(toScreen), `fill="none" stroke="${COMPONENT_ACCENT}" stroke-width="1" stroke-dasharray="4 3"`);
  }
  // A "+" below the selected component set (or the set of a selected variant) adds a variant, like Figma.
  addVariantButton = null;
  const one = state.selection.length === 1 ? getNode(state.selection[0]) : null;
  const activeSet = one?.type === 'componentSet' ? one : one?.type === 'component' && getParent(one.id)?.type === 'componentSet' ? getParent(one.id) : null;
  if (activeSet && !state.editingTextId) {
    const pts = worldCorners(activeSet).map(toScreen);
    const bottom = Math.max(...pts.map((p) => p.y));
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cy = bottom + 44; // below the size badge
    addVariantButton = { x: cx, y: cy, r: 11, setId: activeSet.id };
    out += `<g class="add-variant"><circle cx="${cx}" cy="${cy}" r="11" fill="${COMPONENT_ACCENT}"/>` +
      `<path d="M${cx - 4.5} ${cy}h9M${cx} ${cy - 4.5}v9" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>`;
  }

  // Hover outline
  const hover = state.hoverId && !sel.has(state.hoverId) ? getNode(state.hoverId) : null;
  if (hover && !state.marquee) out += outline(hover, 2, isComponentish(hover) ? COMPONENT_ACCENT : ACCENT);
  if (state.measureTarget) {
    const t = getNode(state.measureTarget);
    if (t) out += outline(t, 1, GUIDE);
  }

  // Selection
  const g = selectionGeometry();
  if (g && !state.editingTextId) {
    const selNodes = selectedNodes();
    const accent = selNodes.every(isComponentish) ? COMPONENT_ACCENT : ACCENT;
    // Layers inside an instance can't be moved or resized, so they get no handles.
    const handles = !selNodes.some(isInsideInstance);
    for (const n of selNodes) if (g.kind === 'multi' || n.children) out += outline(n, 1, isComponentish(n) ? COMPONENT_ACCENT : ACCENT);
    if (g.kind === 'line') {
      out += `<line x1="${g.ends[0].x}" y1="${g.ends[0].y}" x2="${g.ends[1].x}" y2="${g.ends[1].y}" stroke="${accent}" stroke-width="1"/>`;
      if (handles) for (const p of g.ends) out += handle(p, accent);
      const mid = { x: (g.ends[0].x + g.ends[1].x) / 2, y: Math.max(g.ends[0].y, g.ends[1].y) + 8 };
      out += pill(mid.x, mid.y, fmt(g.node.w), accent);
    } else {
      out += poly(g.corners, `fill="none" stroke="${accent}" stroke-width="1"`);
      if (handles) for (const p of g.corners) out += handle(p, accent);
      const xs = g.corners.map((p) => p.x), ys = g.corners.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      out += pill(cx, Math.max(...ys) + 8, `${fmt(g.w)} × ${fmt(g.h)}`, accent);
    }
  } else if (g && state.editingTextId) {
    out += poly(g.corners, `fill="none" stroke="${ACCENT}" stroke-width="1"`);
  }

  // Smart guides
  for (const l of state.guides) {
    const a = toScreen({ x: l.x1, y: l.y1 }), b = toScreen({ x: l.x2, y: l.y2 });
    out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${GUIDE}" stroke-width="1"/>`;
    for (const p of [a, b]) out += `<path d="M${p.x - 3},${p.y - 3}L${p.x + 3},${p.y + 3}M${p.x + 3},${p.y - 3}L${p.x - 3},${p.y + 3}" stroke="${GUIDE}" stroke-width="1"/>`;
  }

  // Alt measurements
  for (const m of state.measure || []) {
    const a = toScreen({ x: m.x1, y: m.y1 }), b = toScreen({ x: m.x2, y: m.y2 });
    out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${GUIDE}" stroke-width="1"/>`;
    const horizontal = Math.abs(a.y - b.y) < 0.5;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    out += horizontal ? pill(mx, my + 4, m.label, GUIDE) : pill(mx + labelWidth(m.label) / 2 + 10, my - 8, m.label, GUIDE);
  }

  // Marquee
  if (state.marquee) {
    const m = state.marquee;
    const a = toScreen({ x: m.x, y: m.y });
    out += `<rect x="${a.x}" y="${a.y}" width="${m.w * view().zoom}" height="${m.h * view().zoom}" fill="rgba(13,153,255,0.08)" stroke="${ACCENT}" stroke-width="1"/>`;
  }

  svg.innerHTML = out;
}

function handle(p, color = ACCENT) {
  return `<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" rx="1.5" fill="#fff" stroke="${color}" stroke-width="1"/>`;
}

function outline(n, width, color = ACCENT) {
  if (n.type === 'line') {
    const W = worldMatrix(n);
    const a = toScreen(apply(W, { x: 0, y: 0 })), b = toScreen(apply(W, { x: n.w, y: 0 }));
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${width}"/>`;
  }
  if (n.type === 'ellipse') {
    const v = view();
    const M = mul([v.zoom, 0, 0, v.zoom, v.x, v.y], worldMatrix(n));
    return `<ellipse transform="${css(M)}" cx="${n.w / 2}" cy="${n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" fill="none" stroke="${color}" stroke-width="${width / v.zoom}"/>`;
  }
  return poly(worldCorners(n).map(toScreen), `fill="none" stroke="${color}" stroke-width="${width}"`);
}

// Used by export: render nodes in world space.
export function nodeWorldSVG(n) {
  const p = getParent(n.id);
  const inner = nodeSVG(n, { export: true });
  return p ? `<g transform="${css(worldMatrix(p))}">${inner}</g>` : inner;
}
