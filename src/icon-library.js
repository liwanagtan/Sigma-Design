// Icon libraries: Sigma Icons files hold icons imported from SVG (a free icon set, for example). An icon is
// data, not a component: { id, name, group, keywords, viewBox, style, strokeWidth, cap, join, body }.
//   style  'outline' (drawn with strokes, like Lucide) or 'filled' (drawn with fills, like Material). A
//          filled icon with a strokeWidth also gets an outline that wide (filled versions of outline
//          icons keep their size and their open lines that way)
//   body   the icon's shapes as SVG markup, cleaned on import: only plain shapes and their geometry are
//          kept, and every color becomes currentColor, so the layer that shows an icon decides its color
// A Sigma Icons file publishes versions ({ version, publishedAt, notes, icons }) that Sigma Design files link.
import { uid, state, walk } from './store.js';

export const ICON_STYLES = { outline: 'Outline', filled: 'Filled' };

const SHAPES = {
  path: ['d'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'], g: [],
};
const SHARED = ['transform', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity'];
// Attribute values: numbers, path data, points, transforms, keywords. Nothing that can load or run anything.
const SAFE_VALUE = /^[-+.,\s\w()#%]*$/;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const CAPS = ['butt', 'round', 'square'], JOINS = ['miter', 'round', 'bevel'];
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const isNone = (v) => v === 'none' || v === 'transparent';

// "Arrow Right.svg" → "arrow-right"
export function iconNameFrom(fileName) {
  return String(fileName || 'icon').replace(/\.svg$/i, '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '') || 'icon';
}

// Read one SVG into an icon. Throws when it isn't an SVG or has no shapes.
export function parseSVGIcon(text, { name = 'icon', group = '' } = {}) {
  const doc = new DOMParser().parseFromString(String(text), 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('not an SVG file');
  const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
  let viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((v) => !Number.isFinite(v))) {
    const w = num(svg.getAttribute('width')) || 24, h = num(svg.getAttribute('height')) || 24;
    viewBox = [0, 0, w, h];
  }
  const rootFill = svg.getAttribute('fill'), rootStroke = svg.getAttribute('stroke');
  let strokes = 0, fills = 0;
  const walk = (el) => [...el.children].map((child) => {
    const tag = child.nodeName.toLowerCase();
    if (!(tag in SHAPES)) return ''; // defs, masks, clip paths, use, style, script, text, images… are left out
    const attrs = [];
    for (const a of [...SHAPES[tag], ...SHARED]) {
      const v = child.getAttribute(a);
      if (v !== null && SAFE_VALUE.test(v) && !/url\s*\(|script/i.test(v)) attrs.push(`${a}="${esc(v)}"`);
    }
    // Colors: "none" stays, anything else follows the layer's color.
    const fill = child.getAttribute('fill'), stroke = child.getAttribute('stroke');
    if (fill !== null) attrs.push(`fill="${isNone(fill) ? 'none' : 'currentColor'}"`);
    if (stroke !== null) attrs.push(`stroke="${isNone(stroke) ? 'none' : 'currentColor'}"`);
    if (tag !== 'g') {
      const f = fill ?? rootFill, s = stroke ?? rootStroke;
      if (s && !isNone(s)) strokes++;
      if (f === null ? !(rootStroke && !isNone(rootStroke)) : !isNone(f)) fills++;
    }
    const inner = tag === 'g' ? walk(child) : '';
    if (tag === 'g' && !inner) return '';
    return tag === 'g' ? `<g ${attrs.join(' ')}>${inner}</g>` : `<${tag} ${attrs.join(' ')}/>`;
  }).join('');
  const body = walk(svg);
  if (!body) throw new Error('no shapes found');
  const style = strokes > fills ? 'outline' : 'filled';
  return {
    id: uid() + uid(), name, group, keywords: '', viewBox: viewBox.join(' '), style, body,
    strokeWidth: num(svg.getAttribute('stroke-width')) ?? (style === 'outline' ? 2 : 0),
    cap: oneOf(svg.getAttribute('stroke-linecap'), CAPS, style === 'outline' ? 'round' : 'butt'),
    join: oneOf(svg.getAttribute('stroke-linejoin'), JOINS, style === 'outline' ? 'round' : 'miter'),
  };
}

// An icon as SVG markup, w × h (at x, y when given), in `color` (with `opacity`), with `strokeWidth` (in
// the icon's own units, so it scales with the icon like the original; filled icons with 0 have none).
export function iconMarkup(icon, { x, y, w = 24, h = 24, color = 'currentColor', opacity = 1, strokeWidth } = {}) {
  if (!icon) return '';
  const at = x === undefined ? '' : ` x="${x}" y="${y}"`;
  const sw = Number(strokeWidth ?? icon.strokeWidth ?? (icon.style === 'outline' ? 2 : 0)) || 0;
  color = esc(color);
  const stroke = `stroke="${color}" stroke-width="${sw}" stroke-linecap="${icon.cap || 'round'}" stroke-linejoin="${icon.join || 'round'}"`;
  const paint = icon.style === 'outline' ? `fill="none" ${stroke}` : sw > 0 ? `fill="${color}" ${stroke}` : `fill="${color}" stroke="none"`;
  return `<svg${at} width="${w}" height="${h}" viewBox="${esc(icon.viewBox)}" overflow="visible" preserveAspectRatio="xMidYMid meet">` +
    `<g ${paint}${opacity < 1 ? ` opacity="${opacity}"` : ''} color="${color}">${icon.body}</g></svg>`;
}

// Clean icons that come from outside this browser (an imported .sigma.json): their shapes go through the
// same filter as an imported SVG. Icons that can't be read are dropped.
export function sanitizeIcons(list) {
  const out = [];
  for (const icon of Array.isArray(list) ? list : []) {
    try {
      const clean = parseSVGIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(icon.viewBox || '0 0 24 24')}">${String(icon.body || '')}</svg>`);
      out.push({
        id: String(icon.id || clean.id), name: String(icon.name || 'icon'), group: String(icon.group || ''), keywords: String(icon.keywords || ''),
        viewBox: clean.viewBox, style: icon.style === 'outline' ? 'outline' : 'filled', body: clean.body,
        strokeWidth: Number(icon.strokeWidth) || 0, cap: oneOf(icon.cap, CAPS, 'round'), join: oneOf(icon.join, JOINS, 'round'),
      });
    } catch {}
  }
  return out;
}
// Groups in order of first appearance, with counts: [{ name, count }] ('' is ungrouped).
export function iconGroups(list) {
  const counts = new Map();
  for (const i of list || []) counts.set(i.group || '', (counts.get(i.group || '') || 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }));
}

// Does an icon match a search? Every word in its name, group or keywords.
export function iconMatches(icon, query) {
  const words = String(query || '').toLowerCase().split(/[\s/,]+/).filter(Boolean);
  const hay = `${icon.name} ${icon.group || ''} ${icon.keywords || ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

// How well an icon matches a search (lower is better): the exact name, then names that start with it,
// then names containing every word, then matches in the group or keywords.
export function iconScore(icon, query) {
  const q = String(query || '').trim().toLowerCase();
  const name = icon.name.toLowerCase();
  if (!q) return 0;
  if (name === q || name === q.replace(/\s+/g, '-')) return 0;
  if (name.startsWith(q) || name.startsWith(q.replace(/\s+/g, '-'))) return 1;
  if (q.split(/[\s/,]+/).filter(Boolean).every((w) => name.includes(w))) return 2;
  return 3;
}

// What changed between two published versions, by icon id: { added, changed, removed } (names).
export function diffIcons(before = [], after = []) {
  const sig = (i) => JSON.stringify([i.name, i.group, i.keywords, i.viewBox, i.style, i.strokeWidth, i.body]);
  const a = new Map(before.map((i) => [i.id, i])), b = new Map(after.map((i) => [i.id, i]));
  return {
    added: after.filter((i) => !a.has(i.id)).map((i) => i.name),
    changed: after.filter((i) => a.has(i.id) && sig(a.get(i.id)) !== sig(i)).map((i) => i.name),
    removed: before.filter((i) => !b.has(i.id)).map((i) => i.name),
  };
}

// ---------- free icon sets ----------
// Icon sets Sigma can create a Sigma Icons file from (built by tools/build-lucide.py).
export const ICON_SETS = [
  { id: 'lucide', name: 'Lucide', file: new URL('../icon-sets/lucide.json', import.meta.url).href, note: 'Outline icons, ISC License' },
];

// An icon set's data (see tools/build-lucide.py).
export async function loadIconSet(set) {
  const res = await fetch(set.file);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// A Sigma Icons file holding an icon set, already published (v1). Icon ids come from the set's icon
// names (lucide-arrow-right), so they stay the same in a later version of the set.
export function iconSetDocument(set, data) {
  const doc = newIconsDocument(data.name);
  doc.icons = sanitizeIcons(data.icons.map(([name, group, keywords, body]) => ({
    id: `${set.id}-${name}`, name, group, keywords, body, viewBox: data.viewBox, style: data.style,
    strokeWidth: data.strokeWidth, cap: data.cap, join: data.join,
  })));
  doc.source = { name: data.name, version: data.version, url: data.url, license: data.license, licenseText: data.licenseText };
  doc.published = { version: 1, publishedAt: Date.now(), notes: `${data.name} ${data.version}`, icons: structuredClone(doc.icons) };
  return doc;
}

// ---------- icons in Sigma Design files ----------
// A Sigma Design file links Sigma Icons files: doc.iconLibraries = [{ fileId, name, version, count, icons }],
// where icons are copies of just the icons the file uses (from the version it accepted), so a big set
// (Lucide has ~1,900) doesn't make every file that links it big. The whole set is read from the Sigma
// Icons file when the picker opens (libraryIconCache). Icon layers ({ type: 'icon', iconId, iconStroke })
// show one; components from a component library bring the icons they use (componentLibraries[].icons).
const indexes = new WeakMap(); // icons list → Map(id → icon)
const indexOf = (list) => {
  if (!indexes.has(list)) indexes.set(list, new Map(list.map((i) => [i.id, i])));
  return indexes.get(list);
};

// Published icons of linked Sigma Icons files, as last read: fileId → { version, icons }.
export const libraryIconCache = new Map();

export function findIcon(id, doc = state.doc) {
  if (!id || !doc) return null;
  for (const lib of doc.iconLibraries || []) {
    const icon = indexOf(lib.icons || []).get(id);
    if (icon) return icon;
  }
  for (const lib of doc.componentLibraries || []) if (lib.icons?.[id]) return lib.icons[id];
  for (const lib of doc.iconLibraries || []) {
    const icon = indexOf(libraryIconCache.get(lib.fileId)?.icons || []).get(id);
    if (icon) return icon;
  }
  return null;
}

// The Sigma Icons file an icon comes from (in this file's links), or null.
export const iconLibraryOf = (id, doc = state.doc) => (doc?.iconLibraries || []).find((l) =>
  indexOf(l.icons || []).has(id) || indexOf(libraryIconCache.get(l.fileId)?.icons || []).has(id)) || null;

// Ids of the icons that layers (and component properties' defaults) in `nodes` use.
export function usedIconIds(nodes) {
  const ids = new Set();
  walk(nodes, (n) => {
    if (n.type === 'icon' && n.iconId) ids.add(n.iconId);
    for (const def of Object.values(n.props || {})) if (def.type === 'icon' && def.default) ids.add(def.default);
  });
  return ids;
}

export const newIconsDocument = (name = 'Untitled icons') => ({ kind: 'icons', name, pages: [], currentPageId: null, icons: [] });
