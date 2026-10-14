// Icons between a codebase and an icons file (Part E, Phase 23). Pure functions, no DOM: the sync
// skill runs them in Node through tools/sigma.mjs.
//
// An icon folder maps to an icons file: each .svg file is an icon named after the file, in a group
// named after its folder (relative to the icon folder; "" at the top). Writing back puts an icon at
// <folder>/<group>/<name>.svg.
import { parseSVGIcon, iconNameFrom } from './icon-library.js';
import { slug } from './token-sync.js';

const keyOf = (i) => `${i.group || ''}\u0000${i.name}`;
// The parts of an icon that make it look the way it does.
const look = (i) => JSON.stringify([i.viewBox, i.style, i.body, Number(i.strokeWidth) || 0, i.cap || '', i.join || '']);
export const sameIcon = (a, b) => look(a) === look(b);

// [{ path: 'arrows/arrow-right.svg', text }] (paths relative to the icon folder) → { icons, skipped }.
export function iconsFromFiles(files) {
  const icons = [], skipped = [];
  for (const { path, text } of files) {
    const parts = path.replace(/\\/g, '/').split('/');
    const file = parts.pop();
    if (!/\.svg$/i.test(file)) continue;
    const group = parts.join('/');
    const name = iconNameFrom(file);
    try {
      const icon = parseSVGIcon(text, { name, group });
      icon.id = slug(group ? `${group}-${name}` : name);
      icons.push(icon);
    } catch (err) {
      skipped.push({ path, why: err.message });
    }
  }
  icons.sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.name.localeCompare(b.name)); // ungrouped first
  return { icons, skipped };
}

// The imported icons into the existing ones: shapes come from the import (the code); ids, keywords and
// order stay; new icons get ids from their group and name. Icons only in Sigma stay (onlyInSigma) unless
// `prune`. Returns { icons, report: { added, changed, unchanged, onlyInSigma } } (as "group/name").
export function mergeIcons(existing = [], imported = [], { prune = false } = {}) {
  const out = structuredClone(existing);
  const report = { added: [], changed: [], unchanged: [], onlyInSigma: [] };
  const label = (i) => (i.group ? `${i.group}/${i.name}` : i.name);
  const taken = new Set(out.map((i) => i.id));
  const seen = new Set();
  for (const icon of imported) {
    const hit = out.find((x) => keyOf(x) === keyOf(icon) && (x.style === icon.style || out.filter((y) => keyOf(y) === keyOf(icon)).length === 1));
    if (hit) {
      seen.add(hit.id);
      if (sameIcon(hit, icon)) report.unchanged.push(label(icon));
      else {
        Object.assign(hit, { viewBox: icon.viewBox, style: icon.style, body: icon.body, strokeWidth: icon.strokeWidth, cap: icon.cap, join: icon.join });
        report.changed.push(label(icon));
      }
      continue;
    }
    let id = icon.id || slug(label(icon));
    for (let n = 2; taken.has(id); n++) id = `${icon.id || slug(label(icon))}-${n}`;
    taken.add(id);
    seen.add(id);
    out.push({ ...icon, id, keywords: icon.keywords || '' });
    report.added.push(label(icon));
  }
  const kept = out.filter((i) => {
    if (seen.has(i.id)) return true;
    report.onlyInSigma.push(label(i));
    return !prune;
  });
  return { icons: kept, report };
}

// What changed between two versions of an icons file: [{ id, name, group, change, icon, before }].
export function iconChanges(before = [], after = []) {
  const a = new Map(before.map((i) => [i.id, i]));
  const b = new Map(after.map((i) => [i.id, i]));
  const out = [];
  for (const [id, icon] of b) {
    const old = a.get(id);
    if (!old) out.push({ id, name: icon.name, group: icon.group || '', change: 'added', icon });
    else if (!sameIcon(old, icon) || keyOf(old) !== keyOf(icon)) out.push({ id, name: icon.name, group: icon.group || '', change: 'changed', icon, before: old });
  }
  for (const [id, old] of a) if (!b.has(id)) out.push({ id, name: old.name, group: old.group || '', change: 'removed', before: old });
  return out;
}

// An icon's file, relative to the icon folder.
export const iconFilePath = (icon) => `${icon.group ? `${icon.group}/` : ''}${icon.name}.svg`;

// How a project writes its SVG files (from one of them): attributes on one line or one per line, " />" or
// "/>", the indent, and the order of the root's attributes.
export function svgStyleOf(text) {
  const t = String(text || '');
  const root = /<svg\b([^>]*)>/.exec(t)?.[1] || '';
  return {
    multiline: /<svg\s*\n/.test(t),
    selfClose: / \/>/.test(t) ? ' />' : '/>',
    indent: /\n([ \t]+)</.exec(t)?.[1] ?? '  ',
    order: [...root.matchAll(/([\w:-]+)\s*=/g)].map((m) => m[1]),
  };
}

// An icon as a standalone SVG file (24 × 24, currentColor), written in `style` (svgStyleOf) when given, so
// a changed icon differs from the file it replaces only where it changed.
export function iconSVG(icon, { size = 24, style = null } = {}) {
  const outline = icon.style === 'outline';
  const sw = Number(icon.strokeWidth) || 0;
  const attrs = { xmlns: 'http://www.w3.org/2000/svg', width: String(size), height: String(size), viewBox: icon.viewBox };
  if (outline || sw > 0) {
    Object.assign(attrs, { fill: outline ? 'none' : 'currentColor', stroke: 'currentColor', 'stroke-width': String(sw || 2), 'stroke-linecap': icon.cap || 'round', 'stroke-linejoin': icon.join || 'round' });
  } else attrs.fill = 'currentColor';
  const st = { multiline: false, selfClose: '/>', indent: '  ', order: [], ...(style || {}) };
  const keys = [...st.order.filter((k) => k in attrs), ...Object.keys(attrs).filter((k) => !st.order.includes(k))];
  const pairs = keys.map((k) => `${k}="${attrs[k]}"`);
  const open = st.multiline ? `<svg\n${pairs.map((p) => `${st.indent}${p}`).join('\n')}\n>` : `<svg ${pairs.join(' ')}>`;
  const body = icon.body.replace(/\/>/g, st.selfClose).replace(/></g, `>\n${st.indent}<`);
  return `${open}\n${st.indent}${body}\n</svg>\n`;
}
