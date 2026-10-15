// Auto layout engine (Figma-style): frames with `layout` arrange their children in a row or column,
// and every layer can be Fixed / Hug contents / Fill container on each axis.
import { state, isFrameLike, getParent, hiddenByWidth } from './store.js';
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

// Breakpoints: an auto layout frame can lay out differently by its width. layout.breakpoints is
// [{ maxW, ...layout values }]: at that width or narrower, its values replace the frame's (the narrowest that
// fits wins, like max-width media queries). Instances copy them, so a component reflows when it's resized.
export const LAYOUT_KEYS = ['mode', 'gap', 'spacing', 'pt', 'pr', 'pb', 'pl', 'alignP', 'alignC'];
export function activeBreakpoint(f) {
  const fits = (f.layout?.breakpoints || []).filter((b) => Number.isFinite(b.maxW) && f.w <= b.maxW);
  return fits.length ? fits.reduce((a, b) => (b.maxW < a.maxW ? b : a)) : null;
}
// Which of the frame's layers its breakpoint hides at this width (by id; in an instance, by the main
// component's layer id).
function applyHidden(f) {
  const hide = new Set(activeBreakpoint(f)?.hide || []);
  for (const k of f.children || []) {
    if (hide.has(k.sourceId || k.id)) hiddenByWidth.add(k);
    else hiddenByWidth.delete(k);
  }
}

export function layoutOf(f) {
  const b = activeBreakpoint(f);
  if (!b) return f.layout;
  const out = { ...f.layout };
  for (const k of LAYOUT_KEYS) if (b[k] !== undefined) out[k] = b[k];
  return out;
}

// Right to left (like HTML's dir): a frame's `dir` ('rtl' | 'ltr') applies to everything inside it, unless a
// frame inside sets its own. Auto layout then runs rows from the right, and its counter-axis start is the
// right edge. Padding stays where it is (pl is the left padding), as in CSS.
export function directionOf(n) {
  for (let x = n; x; x = getParent(x.id)) if (x.dir === 'rtl' || x.dir === 'ltr') return x.dir;
  return 'ltr';
}

export const inFlow = (n) => n.visible !== false && !n.absolute && !hiddenByWidth.has(n);

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
  if (value === 'fill' && getSizing(n, axis) !== 'fill') (n.layoutBasis ||= {})[axis] = n[axis];
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

// Intrinsic measurement is independent of a previous Fill allocation. Empty/leaf Fill
// nodes retain a serialized preferred basis; content-bearing frames measure their content.
function childSize(k, axis) {
  const sizing=getSizing(k,axis);
  if(isAutoLayout(k)&&sizing!=='fixed'&&k.children.some(inFlow))return clampSize(k,axis,hugSize(k)[axis]);
  if(sizing==='fill') {
    if(k.type==='text') {
      if(axis==='h')return clampSize(k,axis,k.h);
      const probe={...k,autoResize:'width'};measureText(probe);return clampSize(k,axis,probe.w);
    }
    const basis=(k.layoutBasis ||= {});
    if(k.bindings?.[axis]||!Number.isFinite(basis[axis]))basis[axis]=Math.max(1,k[axis]||1);
    return clampSize(k,axis,basis[axis]);
  }
  return clampSize(k,axis,k[axis]);
}

export function hugSize(f) {
  applyHidden(f);
  const L=layoutOf(f),kids=f.children.filter(inFlow);
  const P=L.mode==='horizontal'?'w':'h',C=P==='w'?'h':'w';
  const anchored=kids.filter(k=>getSizing(k,C)!=='fill');
  const cross=anchored.length?anchored:kids;
  const sumP=kids.reduce((sum,k)=>sum+childSize(k,P),0);
  const minKey=C==='w'?'minW':'minH';
  const maxC=Math.max(0,...cross.map(k=>childSize(k,C)),...kids.filter(k=>getSizing(k,C)==='fill').map(k=>Number(k[minKey])||0));
  const gaps=L.spacing==='auto'?0:L.gap*Math.max(0,kids.length-1);
  return {[P]:Math.max(1,pad(L,P)+sumP+gaps),[C]:Math.max(1,pad(L,C)+maxC)};
}

// Find an equal share whose clamped sum fits the budget. Unlike freezing all
// violations at once, this also handles simultaneous lower and upper bounds.
export function distributeFill(nodes,axis,space) {
  const minimum=nodes.map(n=>Math.max(1,clampSize(n,axis,1)));
  if(minimum.reduce((a,b)=>a+b,0)>=space)return minimum;
  let lo=0,hi=Math.max(1,space);
  for(let i=0;i<60;i++) {
    const mid=(lo+hi)/2,total=nodes.reduce((sum,n)=>sum+Math.max(1,clampSize(n,axis,mid)),0);
    if(total>space)hi=mid;else lo=mid;
  }
  return nodes.map(n=>Math.max(1,clampSize(n,axis,lo)));
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

function layoutChildren(f, dir = 'ltr') {
  applyHidden(f);
  const L = layoutOf(f);
  dir = f.dir === 'rtl' || f.dir === 'ltr' ? f.dir : dir;
  const rtl = dir === 'rtl';
  const horiz = L.mode === 'horizontal';
  const P = horiz ? 'w' : 'h', C = horiz ? 'h' : 'w';
  const posP = horiz ? 'x' : 'y', posC = horiz ? 'y' : 'x';
  // Right to left: laid out from the right edge (its padding is pr), then x is mirrored.
  const [left, right] = rtl ? [L.pr, L.pl] : [L.pl, L.pr];
  const padStart = horiz ? left : L.pt, padEnd = horiz ? right : L.pb;
  const cStart = horiz ? L.pt : left, cEnd = horiz ? L.pb : right;
  const innerP = f[P] - padStart - padEnd;
  const innerC = f[C] - cStart - cEnd;

  for (const k of f.children) normalize(k, true);
  const kids = f.children.filter(inFlow);

  // 1. Sizes: hug, counter-axis fill, then share leftover primary space among fill children.
  for (const k of kids) {
    const w0 = k.w;
    for(const axis of ['w','h'])if(getSizing(k,axis)==='fill'&&k.type!=='text'&&(!isAutoLayout(k)||!k.children.some(inFlow)))childSize(k,axis);
    for (const axis of ['w', 'h']) {
      const s = getSizing(k, axis);
      if(s==='fixed'&&!(k.type==='line'&&axis==='h'))k[axis]=round(Math.max(0.01,clampSize(k,axis,k[axis])));
      if (s === 'hug' && isAutoLayout(k)) k[axis] = round(clampSize(k, axis, hugSize(k)[axis]));
      if (s === 'fill' && axis === C && !(k.type === 'line' && axis === 'h')) k[axis] = round(Math.max(1, clampSize(k, axis, innerC)));
    }
    if (k.type === 'text' && k.w !== w0) remeasure(k);
  }
  const gap = L.spacing === 'auto' ? 0 : L.gap;
  const fills = kids.filter((k) => getSizing(k, P) === 'fill' && !(k.type === 'line' && P === 'h'));
  if (fills.length) {
    const fixed = kids.filter((k) => !fills.includes(k)).reduce((s, k) => s + k[P], 0);
    const free=innerP-fixed-gap*Math.max(0,kids.length-1);
    const allocation=distributeFill(fills,P,free);
    const size=new Map(fills.map((k,i)=>[k,allocation[i]]));
    for (const k of fills) {
      const w0 = k.w;
      k[P] = round(Math.max(1, size.get(k) ?? 1));
      if (k.type === 'text' && k.w !== w0) remeasure(k);
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
      if (rtl) k.x = round(f.w - k.x - k.w);
    }
    cursor += k[P] + spacing;
  }

  // 3. Recurse
  for (const k of f.children) {
    if (isAutoLayout(k)) layoutChildren(k, dir);
    else if (k.children) layoutPlain(k.children, dir);
  }
}

function layoutPlain(nodes, dir = 'ltr') {
  for (const n of nodes) {
    normalize(n, false);
    for(const axis of ['w','h'])if(getSizing(n,axis)==='fixed'&&!(n.type==='line'&&axis==='h'))n[axis]=round(Math.max(0.01,clampSize(n,axis,n[axis])));
    const own = n.dir === 'rtl' || n.dir === 'ltr' ? n.dir : dir;
    if (isAutoLayout(n)) {
      if (getSizing(n, 'w') === 'hug') n.w = round(clampSize(n, 'w', hugSize(n).w));
      if (getSizing(n, 'h') === 'hug') n.h = round(clampSize(n, 'h', hugSize(n).h));
      layoutChildren(n, own);
    } else if (n.children) {
      for (const k of n.children) hiddenByWidth.delete(k); // no auto layout, no breakpoints: nothing hidden by width
      layoutPlain(n.children, own);
    }
  }
}

// Width changes remeasure text before geometry convergence propagates its height.
function remeasure(k) { measureText(k); }

export function layoutGeometry() {
  const values=[];const visit=nodes=>{for(const n of nodes){values.push(n.id,n.x,n.y,n.w,n.h,hiddenByWidth.has(n));if(n.children)visit(n.children);}};
  for(const pg of state.doc.pages)visit(pg.children);
  return JSON.stringify(values);
}
export function applyLayouts() {
  let depth=0;const visit=(nodes,d)=>{depth=Math.max(depth,d);for(const n of nodes)if(n.children)visit(n.children,d+1);};
  for(const pg of state.doc.pages)visit(pg.children,1);
  const seen=new Set();state.layoutWarnings=[];
  const check=nodes=>{for(const n of nodes){for(const axis of ['W','H'])if(n['min'+axis]!=null&&n['max'+axis]!=null&&n['min'+axis]>n['max'+axis])state.layoutWarnings.push(`${n.name}: minimum ${axis==='W'?'width':'height'} exceeds maximum; minimum takes precedence.`);if(n.children)check(n.children);}};for(const pg of state.doc.pages)check(pg.children);
  for(let pass=0;pass<Math.min(128,depth*2+4);pass++) {
    const before=layoutGeometry();seen.add(before);
    for(const pg of state.doc.pages)layoutPlain(pg.children);
    const after=layoutGeometry();if(after===before)return;
    if(seen.has(after)){state.layoutWarnings=['Layout has a sizing/breakpoint cycle. Use a fixed size or adjust the breakpoint.'];return;}
  }
  state.layoutWarnings=['Layout could not settle within its nesting budget. Review cyclic sizing or breakpoints.'];
}

// ---------- helpers for editing ----------

// Index (into f.children minus `exclude`) where a point should insert into an auto layout frame.
export function flowInsertBefore(f, localPt, exclude) {
  const horiz = layoutOf(f).mode === 'horizontal';
  const rtl = horiz && directionOf(f) === 'rtl'; // a row that runs from the right
  const others = f.children.filter((c) => !exclude.has(c.id));
  const v = horiz ? localPt.x : localPt.y;
  let idx = 0;
  others.forEach((c, i) => {
    if (!inFlow(c)) return;
    const mid = horiz ? c.x + c.w / 2 : c.y + c.h / 2;
    if (rtl ? v < mid : v > mid) idx = i + 1;
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
  const fromRight = horiz && directionOf(f) === 'rtl'; // a right-to-left row starts at the right
  f.children.sort((a, b) => (fromRight ? b[pos] - a[pos] : a[pos] - b[pos]));

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

