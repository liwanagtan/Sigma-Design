import { page, walk, worldMatrix } from './store.js';
import { apply, inv } from './geom.js';

// Color contrast, as WCAG 2 measures it: the ratio of two colors' relative luminance, from 1:1 to 21:1.
// Normal text needs 4.5:1 for AA and 7:1 for AAA; large text (24px, or 18.66px bold) needs 3:1 and 4.5:1.

const channels = (hex) => {
  const h = String(hex || '#000000').replace('#', '');
  const n = parseInt(h.slice(0, 6).padEnd(6, '0'), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// '#RRGGBB' or '#RRGGBBAA' → { rgb: [r, g, b] (0–255), alpha (0–1) }.
export function parseColor(hex) {
  const h = String(hex || '').replace('#', '');
  return { rgb: channels(h), alpha: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
}

// `top` (with `alpha`) painted over the opaque color `under`.
export function blend(top, alpha, under) {
  return top.map((c, i) => c * alpha + under[i] * (1 - alpha));
}

export function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast of a foreground color over a background color (both '#RRGGBB[AA]'). A translucent background
// sits on white; a translucent foreground is blended over the background first.
export function contrastRatio(fg, bg) {
  const b = parseColor(bg);
  const back = blend(b.rgb, b.alpha, [255, 255, 255]);
  const f = parseColor(fg);
  const front = blend(f.rgb, f.alpha, back);
  const [l1, l2] = [luminance(front), luminance(back)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export const isLargeText = (fontSize, fontWeight) => fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

// 'AAA' | 'AA' | 'Fail' for text of that size (large text passes at lower ratios).
export function contrastLevel(ratio, large = false) {
  if (ratio >= (large ? 4.5 : 7)) return 'AAA';
  if (ratio >= (large ? 3 : 4.5)) return 'AA';
  return 'Fail';
}

export const formatRatio = (ratio) => `${(Math.floor(ratio * 100) / 100).toFixed(2).replace(/\.?0+$/, '')}:1`;

// A small badge: "4.6:1 AA", colored by level.
export function contrastBadge(ratio, large = false, { title = '' } = {}) {
  const level = contrastLevel(ratio, large);
  const tip = title || `${large ? 'Large text' : 'Normal text'}: AA needs ${large ? '3' : '4.5'}:1, AAA needs ${large ? '4.5' : '7'}:1`;
  return `<span class="contrast-badge ${level === 'Fail' ? 'fail' : level === 'AA' ? 'aa' : 'aaa'}" title="${tip}">${formatRatio(ratio)} ${level}</span>`;
}

const toHex = (rgb) => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const visibleFills = (n) => (n.fills || []).filter((p) => p.visible !== false);

// The opaque color behind the middle of `node`: the page background with every filled layer painted under
// that point (in order, with fill and layer opacity). null when an image is behind it (it can't be measured).
export function backgroundBehind(node) {
  const W = worldMatrix(node);
  const pt = apply(W, { x: node.w / 2, y: node.h / 2 });
  let color = parseColor(page().background || '#FFFFFF').rgb;
  let unknown = false;
  let done = false;
  const opacity = new Map();
  walk(page().children, (n, parent) => {
    if (done) return false;
    if (n === node) {
      done = true;
      return false;
    }
    if (!n.visible) return false;
    const op = (n.opacity ?? 1) * (parent ? opacity.get(parent.id) ?? 1 : 1);
    opacity.set(n.id, op);
    if (n.type === 'text' || n.type === 'line' || n.type === 'group') return;
    const L = apply(inv(worldMatrix(n)), pt);
    let inside = L.x >= 0 && L.y >= 0 && L.x <= n.w && L.y <= n.h;
    if (inside && n.type === 'ellipse') {
      const dx = (L.x - n.w / 2) / (n.w / 2), dy = (L.y - n.h / 2) / (n.h / 2);
      inside = dx * dx + dy * dy <= 1;
    }
    if (!inside) return n.clip ? false : undefined; // a clipping frame hides its layers outside it
    for (const p of visibleFills(n)) {
      const a = (p.opacity ?? 1) * parseColor(p.color).alpha * op;
      color = blend(parseColor(p.color).rgb, a, color);
      if (a >= 1) unknown = false; // an opaque fill covers any image below
    }
    if (n.type === 'image' && n.src && op > 0) unknown = true; // drawn over its own fills
  });
  return unknown ? null : toHex(color);
}

// A text layer's contrast with what's behind it: { ratio, large, fg, bg } or null (no fill, or over an image).
export function textContrast(node) {
  const fills = visibleFills(node);
  if (node.type !== 'text' || !fills.length) return null;
  const bg = backgroundBehind(node);
  if (!bg) return null;
  let fg = parseColor(bg).rgb;
  for (const p of fills) fg = blend(parseColor(p.color).rgb, (p.opacity ?? 1) * (node.opacity ?? 1), fg);
  return { ratio: contrastRatio(toHex(fg), bg), large: isLargeText(node.fontSize, node.fontWeight), fg: toHex(fg), bg };
}
