// Auto layout engine (Figma-style): frames with `layout` arrange their children in a row or column,
// and every layer can be Fixed / Hug contents / Fill container on each axis.
import { state, isFrameLike } from './store.js';
import { round } from './geom.js';
import { measureText } from './text.js';

export const DEFAULT_LAYOUT = {
  mode: 'vertical', // 'horizontal' | 'vertical'
  gap: 10,
  spacing: 'packed', // 'packed' | 'auto' (space between)
  pt: 0, pr: 0, pb: 0, pl: 0,
  alignP: 'start', // primary axis: start | center | end
  alignC: 'start', // counter axis: start | center | end
};

export const isAutoLayout = (n) => !!(isFrameLike(n) && n.layout && n.layout.mode);

export const inFlow = (n) => n.visible !== false && !n.absolute;

// Effective sizing of a node on an axis ('w' | 'h'): 'fixed' | 'hug' | 'fill'.
// Text hugging is driven by its autoResize mode.
export function getSizing(n, axis) {
  if (n.type === 'text') {
    const hug = axis === 'w' ? n.autoResize === 'width' : n.autoResize !== 'fixed';
    if (hug) return 'hug';
  }
  const s = (axis === 'w' ? n.sizingH : n.sizingV) || 'fixed';
  return s === 'hug' && !isAutoLayout(n) ? 'fixed' : s;
}

export function setSizing(n, axis, value) {
  if (n.type === 'text') {
    if (axis === 'w') {
      if (value === 'hug') n.autoResize = 'width';
      else {
        if (n.autoResize === 'width') n.autoResize = 'height';
        n.sizingH = value;
      }
    } else if (value === 'hug') {
      if (n.autoResize === 'fixed') n.autoResize = 'height';
    } else {
      n.autoResize = 'fixed';
      n.sizingV = value;
    }
    measureText(n);
    return;
  }
  if (axis === 'w') n.sizingH = value;
  else n.sizingV = value;
}

const pad = (L, axis) => (axis === 'w' ? L.pl + L.pr : L.pt + L.pb);

// Min and max sizes (minW, maxW, minH, maxH) limit hug and fill sizes on each axis.
const LIMITS = { w: ['minW', 'maxW'], h: ['minH', 'maxH'] };
export function clampSize(n, axis, v) {
  const [lo, hi] = LIMITS[axis].map((k) => (Number.isFinite(Number(n[k])) && n[k] !== null && n[k] !== '' ? Number(n[k]) : null));
  if (hi !== null) v = Math.min(v, hi);
  if (lo !== null) v = Math.max(v, lo);
  return v;
}

// Size a node contributes on an axis, resolving nested "hug" frames.
function childSize(k, axis) {
  if (getSizing(k, axis) === 'hug' && isAutoLayout(k)) return clampSize(k, axis, hugSize(k)[axis]);
  return k[axis];
}

export function hugSize(f) {
  const L = f.layout;
  const kids = f.children.filter(inFlow);
  const P = L.mode === 'horizontal' ? 'w' : 'h';
  const C = P === 'w' ? 'h' : 'w';
  let sumP = 0, maxC = 0;
  for (const k of kids) {
    sumP += childSize(k, P);
    maxC = Math.max(maxC, childSize(k, C));
  }
  const gaps = L.spacing === 'auto' ? 0 : L.gap * Math.max(0, kids.length - 1);
  return { [P]: Math.max(1, pad(L, P) + sumP + gaps), [C]: Math.max(1, pad(L, C) + maxC) };
}

// Fix sizing values that aren't valid in the node's current context.
function normalize(n, parentIsAL) {
  if (!parentIsAL) {
    if (n.sizingH === 'fill') n.sizingH = 'fixed';
    if (n.sizingV === 'fill') n.sizingV = 'fixed';
    if (n.absolute) n.absolute = false;
  }
  if (n.type === 'group') {
    if (n.sizingH === 'fill') n.sizingH = 'fixed';
    if (n.sizingV === 'fill') n.sizingV = 'fixed';
  }
}

function layoutChildren(f) {
  const L = f.layout;
  const horiz = L.mode === 'horizontal';
  const P = horiz ? 'w' : 'h', C = horiz ? 'h' : 'w';
  const posP = horiz ? 'x' : 'y', posC = horiz ? 'y' : 'x';
  const padStart = horiz ? L.pl : L.pt, padEnd = horiz ? L.pr : L.pb;
  const cStart = horiz ? L.pt : L.pl, cEnd = horiz ? L.pb : L.pr;
  const innerP = f[P] - padStart - padEnd;
  const innerC = f[C] - cStart - cEnd;

  for (const k of f.children) normalize(k, true);
  const kids = f.children.filter(inFlow);

  // 1. Sizes: hug, counter-axis fill, then share leftover primary space among fill children.
  for (const k of kids) {
    const w0 = k.w;
    for (const axis of ['w', 'h']) {
      const s = getSizing(k, axis);
      if (s === 'hug' && isAutoLayout(k)) k[axis] = round(clampSize(k, axis, hugSize(k)[axis]));
      if (s === 'fill' && axis === C && !(k.type === 'line' && axis === 'h')) k[axis] = round(Math.max(1, clampSize(k, axis, innerC)));
    }
    if (k.type === 'text' && k.w !== w0) measureText(k);
  }
  const gap = L.spacing === 'auto' ? 0 : L.gap;
  const fills = kids.filter((k) => getSizing(k, P) === 'fill' && !(k.type === 'line' && P === 'h'));
  if (fills.length) {
    const fixed = kids.filter((k) => !fills.includes(k)).reduce((s, k) => s + k[P], 0);
    let free = innerP - fixed - gap * Math.max(0, kids.length - 1);
    // Share the space; a layer that hits its min or max keeps that, and the rest is shared again.
    let open = [...fills];
    const size = new Map();
    for (let guard = 0; open.length && guard < fills.length + 1; guard++) {
      const each = Math.max(1, free / open.length);
      const clamped = open.filter((k) => clampSize(k, P, each) !== each);
      if (!clamped.length) {
        for (const k of open) size.set(k, each);
        break;
      }
      for (const k of clamped) {
        size.set(k, clampSize(k, P, each));
        free -= size.get(k);
      }
      open = open.filter((k) => !clamped.includes(k));
    }
    for (const k of fills) {
      const w0 = k.w;
      k[P] = round(Math.max(1, size.get(k) ?? 1));
      if (k.type === 'text' && k.w !== w0) measureText(k);
    }
  }

  // 2. Positions
  const total = kids.reduce((s, k) => s + k[P], 0);
  let cursor = padStart, spacing = gap;
  if (L.spacing === 'auto' && kids.length > 1) {
    spacing = (innerP - total) / (kids.length - 1);
  } else {
    const free = innerP - total - gap * Math.max(0, kids.length - 1);
    cursor += L.alignP === 'center' ? free / 2 : L.alignP === 'end' ? free : 0;
  }
  for (const k of kids) {
    if (!state.layoutSkip.has(k.id)) {
      const free = innerC - k[C];
      k[posP] = round(cursor);
      k[posC] = round(cStart + (L.alignC === 'center' ? free / 2 : L.alignC === 'end' ? free : 0));
    }
    cursor += k[P] + spacing;
  }

  // 3. Recurse
  for (const k of f.children) {
    if (isAutoLayout(k)) layoutChildren(k);
    else if (k.children) layoutPlain(k.children);
  }
}

function layoutPlain(nodes) {
  for (const n of nodes) {
    normalize(n, false);
    if (isAutoLayout(n)) {
      if (getSizing(n, 'w') === 'hug') n.w = round(clampSize(n, 'w', hugSize(n).w));
      if (getSizing(n, 'h') === 'hug') n.h = round(clampSize(n, 'h', hugSize(n).h));
      layoutChildren(n);
    } else if (n.children) {
      layoutPlain(n.children);
    }
  }
}

export function applyLayouts() {
  for (const pg of state.doc.pages) layoutPlain(pg.children);
}

// ---------- helpers for editing ----------

// Index (into f.children minus `exclude`) where a point should insert into an auto layout frame.
export function flowInsertBefore(f, localPt, exclude) {
  const horiz = f.layout.mode === 'horizontal';
  const others = f.children.filter((c) => !exclude.has(c.id));
  const v = horiz ? localPt.x : localPt.y;
  let idx = 0;
  others.forEach((c, i) => {
    if (!inFlow(c)) return;
    const mid = horiz ? c.x + c.w / 2 : c.y + c.h / 2;
    if (v > mid) idx = i + 1;
  });
  return others[idx] || null; // insert before this node (null = at the end)
}

// Infer direction, gap, padding and alignment from how the children are currently arranged.
export function guessLayout(f) {
  const kids = f.children.filter((k) => k.visible !== false);
  const cx = kids.map((k) => k.x + k.w / 2), cy = kids.map((k) => k.y + k.h / 2);
  const span = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
  const horiz = kids.length < 2 ? true : span(cx) >= span(cy);
  const P = horiz ? 'w' : 'h', C = horiz ? 'h' : 'w';
  const pos = horiz ? 'x' : 'y', cpos = horiz ? 'y' : 'x';
  f.children.sort((a, b) => a[pos] - b[pos]);

  let gap = 10;
  if (kids.length > 1) {
    const sorted = [...kids].sort((a, b) => a[pos] - b[pos]);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i][pos] - (sorted[i - 1][pos] + sorted[i - 1][P]));
    gap = Math.max(0, Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length));
  }

  let pt = 0, pr = 0, pb = 0, pl = 0, alignC = 'start';
  if (kids.length) {
    const x0 = Math.min(...kids.map((k) => k.x)), y0 = Math.min(...kids.map((k) => k.y));
    const x1 = Math.max(...kids.map((k) => k.x + k.w)), y1 = Math.max(...kids.map((k) => k.y + k.h));
    pl = Math.max(0, Math.round(x0));
    pt = Math.max(0, Math.round(y0));
    pr = Math.max(0, Math.round(f.w - x1));
    pb = Math.max(0, Math.round(f.h - y1));
    const centers = kids.map((k) => k[cpos] + k[C] / 2);
    const starts = kids.map((k) => k[cpos]);
    if (span(centers) < 1 && span(starts) >= 1) alignC = 'center';
    if (kids.length === 1) {
      const before = horiz ? pt : pl, after = horiz ? pb : pr;
      if (Math.abs(before - after) <= 1) alignC = 'center';
    }
  }
  f.layout = { ...DEFAULT_LAYOUT, mode: horiz ? 'horizontal' : 'vertical', gap, pt, pr, pb, pl, alignC };
  f.sizingH = 'hug';
  f.sizingV = 'hug';
}

