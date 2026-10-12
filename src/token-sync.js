// Design tokens between a codebase and a Sigma Tokens file (Part E, Phase 22). Pure functions, no DOM: the
// sync skill runs them in Node through tools/sigma.mjs.
//
//   CSS custom properties → Sigma: parseCSSVariables + cssToCollections (modes come from selectors, like
//     ":root" for Light and "[data-theme=dark]" for Dark; var() references become token references)
//   any other stack → Sigma: the agent writes the tokens as DTCG (tokens.json), importTokens reads them
//   mergeTokenCollections: the imported tokens into the existing Sigma file, keeping ids, descriptions and
//     order, so importing the same code again changes nothing
//   tokenChanges: what changed between two versions of a Sigma Tokens file, with code names and values
//   applyToCSS: write a Sigma Tokens file back into CSS as minimal edits (each value keeps its unit and
//     color format)
//
// Each token can record its name in code: token.codeSyntax = { web: '--color-blue-500' } (Figma calls this
// code syntax). Sigma writes it on import and uses it when writing back.
import { normalizeGroups } from './token-groups.js';
import { splitColor } from './variables.js';

const isAlias = (v) => !!v && typeof v === 'object' && typeof v.alias === 'string';
// JSON with sorted keys, so the same value read from a file or from code compares equal.
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

// ---------- names ----------
// How a token name becomes a code name ("color/blue/500" with kebab → "--color-blue-500").
export function codeNameFor(name, { naming = 'kebab', prefix = '', map = {} } = {}) {
  if (map[name]) return map[name];
  const parts = name.split('/').filter(Boolean);
  const words = parts.flatMap((p) => p.split(/[\s_-]+/)).filter(Boolean);
  let id;
  if (naming === 'camel') id = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase())).join('');
  else if (naming === 'snake') id = words.join('_').toLowerCase();
  else if (naming === 'path' || naming === 'as-is') id = parts.join(naming === 'path' ? '.' : '/');
  else id = words.join('-').toLowerCase();
  return naming === 'kebab' ? `--${prefix}${id}` : `${prefix}${id}`;
}

// And back: "--color-blue-500" → "color/blue/500" (kebab: each dash is a level).
export function tokenNameFor(codeName, { prefix = '', map = {} } = {}) {
  const back = Object.entries(map).find(([, c]) => c === codeName);
  if (back) return back[0];
  return codeName.replace(/^--/, '').replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').split('-').filter(Boolean).join('/');
}

// ---------- reading CSS ----------
// Every custom property declaration: [{ selector, name, value, start, end }] (start/end: the value's place
// in the text, so it can be replaced without touching anything else). Nested blocks (@media) give
// selectors like "@media (prefers-color-scheme: dark) :root".
export function parseCSSVariables(text) {
  const out = [];
  const blocks = []; // [{ selector, open }]
  let i = 0;
  let stmtStart = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const e = text.indexOf(c, i + 1);
      i = e < 0 ? n : e + 1;
      continue;
    }
    if (c === '{') {
      blocks.push({ selector: text.slice(stmtStart, i).replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' '), open: i });
      i++;
      stmtStart = i;
      continue;
    }
    if (c === '}') {
      blocks.pop();
      i++;
      stmtStart = i;
      continue;
    }
    if (c === ';') {
      i++;
      stmtStart = i;
      continue;
    }
    if (c === '-' && text[i + 1] === '-' && blocks.length && /^\s*$/.test(text.slice(stmtStart, i).replace(/\/\*[\s\S]*?\*\//g, ''))) {
      const m = /^--[\w-]+/.exec(text.slice(i));
      const colon = m && text.indexOf(':', i + m[0].length);
      if (m && colon >= 0 && /^\s*$/.test(text.slice(i + m[0].length, colon))) {
        // The value runs to ";" or "}" outside parentheses and strings.
        let j = colon + 1, depth = 0;
        for (; j < n; j++) {
          const d = text[j];
          if (d === '(') depth++;
          else if (d === ')') depth--;
          else if ((d === '"' || d === "'")) j = Math.max(j, text.indexOf(d, j + 1));
          else if ((d === ';' || d === '}') && depth <= 0) break;
        }
        let start = colon + 1, end = j;
        while (start < end && /\s/.test(text[start])) start++;
        while (end > start && /\s/.test(text[end - 1])) end--;
        out.push({ selector: blocks.map((b) => b.selector).join(' '), name: m[0], value: text.slice(start, end), start, end });
        i = j;
        continue;
      }
    }
    i++;
  }
  return out;
}

// ---------- values ----------
const NAMED = { white: '#FFFFFF', black: '#000000', transparent: '#00000000', red: '#FF0000', blue: '#0000FF', green: '#008000' };
const hex2 = (x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0').toUpperCase();
const toHex = (r, g, b, a = 1) => `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a * 255) : ''}`;

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// A CSS color as { hex: '#RRGGBB[AA]', format }, or null.
export function parseColorValue(v) {
  const s = String(v).trim();
  if (NAMED[s.toLowerCase()]) return { hex: NAMED[s.toLowerCase()], format: 'named' };
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const hex = `#${h.toUpperCase()}`;
    return { hex: hex.length === 9 && hex.endsWith('FF') ? hex.slice(0, 7) : hex, format: 'hex', lower: m[1] === m[1].toLowerCase() && /[a-f]/.test(m[1]) };
  }
  m = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i.exec(s);
  if (!m) return null;
  const parts = m[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const alphaOf = (x) => (x === undefined ? 1 : x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x));
  const comma = m[2].includes(',');
  if (m[1].toLowerCase().startsWith('rgb')) {
    const ch = parts.slice(0, 3).map((x) => (x.endsWith('%') ? (parseFloat(x) * 255) / 100 : parseFloat(x)));
    if (ch.some((x) => !Number.isFinite(x))) return null;
    return { hex: toHex(...ch, alphaOf(parts[3])), format: 'rgb', comma };
  }
  const [h, sat, l] = [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])];
  if (![h, sat, l].every(Number.isFinite)) return null;
  return { hex: toHex(...hslToRgb(h, sat, l), alphaOf(parts[3])), format: 'hsl', comma };
}

// A color written the way `like` was (hex, rgb() or hsl(); comma or space syntax; lowercase hex).
export function formatColor(hex, like = { format: 'hex' }) {
  const { hex: h6, alpha } = splitColor(hex);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h6.slice(i, i + 2), 16));
  const a = Math.round(alpha * 100) / 100;
  if (like.format === 'rgb') {
    return like.comma ? (a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`) : `rgb(${r} ${g} ${b}${a < 1 ? ` / ${a}` : ''})`;
  }
  if (like.format === 'hsl') {
    const [R, G, B] = [r, g, b].map((x) => x / 255);
    const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
    let hh = 0;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d) hh = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    const H = Math.round(((hh * 60) + 360) % 360), S = Math.round(s * 100), L = Math.round(l * 100);
    return like.comma ? (a < 1 ? `hsla(${H}, ${S}%, ${L}%, ${a})` : `hsl(${H}, ${S}%, ${L}%)`) : `hsl(${H} ${S}% ${L}%${a < 1 ? ` / ${a}` : ''})`;
  }
  const out = hex.length === 9 ? hex : h6;
  return like.lower ? out.toLowerCase() : out;
}

const LENGTH = /^(-?\d*\.?\d+)(px|rem|em|%)?$/;
// What a CSS value is as a token: { type, value, like } (like: how it was written, for writing back), or
// { alias: '--name' }, or null (not a token Sigma knows how to hold).
export function parseCSSValue(raw, { remBase = 16, name = '' } = {}) {
  const v = String(raw).trim().replace(/\s*!important$/, '');
  const ref = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/.exec(v);
  if (ref) return { alias: ref[1] };
  const color = parseColorValue(v);
  if (color) return { type: 'color', value: color.hex, like: color };
  let m = /^(-?\d*\.?\d+)(ms|s)$/.exec(v);
  if (m) return { type: 'duration', value: m[2] === 's' ? Math.round(parseFloat(m[1]) * 1000) : parseFloat(m[1]), like: { unit: m[2] } };
  m = /^cubic-bezier\(([^)]*)\)$/.exec(v);
  if (m) {
    const nums = m[1].split(/[\s,]+/).filter(Boolean).map(Number);
    if (nums.length === 4 && nums.every(Number.isFinite)) return { type: 'easing', value: nums, like: {} };
  }
  m = LENGTH.exec(v);
  if (m) {
    const unit = m[2] || '';
    const num = parseFloat(m[1]);
    if (unit === '%' && !/opacity/i.test(name)) return { type: 'string', value: v, like: {} };
    const px = unit === 'rem' || unit === 'em' ? Math.round(num * remBase * 1000) / 1000 : unit === '%' ? num : num;
    return { type: 'number', value: px, like: { unit } };
  }
  // A single box shadow: x y [blur [spread]] color, in any order of color and lengths.
  const shadowParts = v.match(/(?:rgba?|hsla?)\([^)]*\)|#[0-9a-f]{3,8}\b|-?\d*\.?\d+(?:px|rem|em)?|\S+/gi) || [];
  if (!v.includes(',') || /^[^,]*\([^)]*,[^)]*\)[^,]*$/.test(v)) {
    const colors = shadowParts.map((p) => parseColorValue(p)).filter(Boolean);
    const lengths = shadowParts.filter((p) => LENGTH.test(p)).map((p) => parseCSSValue(p, { remBase }).value);
    if (colors.length === 1 && lengths.length >= 2 && lengths.length <= 4 && colors.length + lengths.length === shadowParts.length) {
      const [x, y, blur = 0, spread = 0] = lengths;
      return { type: 'shadow', value: { color: colors[0].hex, x, y, blur, spread }, like: { color: colors[0], colorFirst: !!parseColorValue(shadowParts[0]) } };
    }
  }
  return { type: 'string', value: v, like: {} };
}

// A token value written as CSS, the way `like` was written.
export function formatCSSValue(type, value, like = {}, { remBase = 16 } = {}) {
  const num = (x) => String(Math.round(x * 1000) / 1000);
  if (type === 'color') return formatColor(value, like);
  if (type === 'number') {
    if (like.unit === 'rem' || like.unit === 'em') return `${num(value / remBase)}${like.unit}`;
    if (like.unit === '%') return `${num(value)}%`;
    return like.unit === '' || /opacity|weight|line-height|z-index/.test(like.name || '') ? num(value) : value === 0 ? '0' : `${num(value)}px`;
  }
  if (type === 'duration') return like.unit === 's' ? `${num(value / 1000)}s` : `${num(value)}ms`;
  if (type === 'easing') return `cubic-bezier(${value.join(', ')})`;
  if (type === 'shadow') {
    const px = (x) => (x === 0 ? '0' : `${num(x)}px`);
    const color = formatColor(value.color, like.color || { format: 'rgb', comma: true });
    const lengths = [px(value.x), px(value.y), px(value.blur), ...(value.spread ? [px(value.spread)] : [])].join(' ');
    return like.colorFirst ? `${color} ${lengths}` : `${lengths} ${color}`;
  }
  return String(value);
}

// ---------- CSS → collections ----------
// `modes`: { "Light": ":root", "Dark": "[data-theme=\"dark\"]" } (the first is the default). Tokens defined
// only in the default selector with a plain value are primitives; tokens that point at others or change
// between modes are semantic. Returns { collections, skipped: [{ name, selector, value, why }] }.
export function cssToCollections(decls, { modes = { Default: ':root' }, naming = 'kebab', prefix = '', map = {}, remBase = 16 } = {}) {
  const modeNames = Object.keys(modes);
  const selectorMode = new Map(Object.entries(modes).map(([m, sel]) => [normSel(sel), m]));
  const byVar = new Map(); // --name → { modeName: parsed }
  const skipped = [];
  for (const d of decls) {
    const mode = selectorMode.get(normSel(d.selector));
    if (!mode) {
      skipped.push({ name: d.name, selector: d.selector, value: d.value, why: 'its selector isn’t one of the modes in sigma.config.json' });
      continue;
    }
    if (prefix && !d.name.startsWith(`--${prefix}`)) continue;
    const parsed = parseCSSValue(d.value, { remBase, name: d.name });
    if (!byVar.has(d.name)) byVar.set(d.name, {});
    byVar.get(d.name)[mode] = parsed;
  }
  const nameOf = (cssName) => tokenNameFor(cssName, { prefix, map });
  // A reference's type is its target's.
  const typeOf = (cssName, depth = 0) => {
    const vals = byVar.get(cssName);
    if (!vals || depth > 16) return null;
    for (const p of Object.values(vals)) {
      if (p.type) return p.type;
      const t = typeOf(p.alias, depth + 1);
      if (t) return t;
    }
    return null;
  };
  const def = modeNames[0];
  const primitives = [], semantic = [];
  for (const [cssName, vals] of byVar) {
    const type = typeOf(cssName);
    if (!type) {
      skipped.push({ name: cssName, value: Object.values(vals)[0]?.alias, why: 'it points at a variable that isn’t defined' });
      continue;
    }
    const token = { id: slug(nameOf(cssName)), name: nameOf(cssName), type, codeSyntax: { web: cssName }, raw: vals };
    const onlyDefault = Object.keys(vals).length === 1 && vals[def] && !vals[def].alias;
    (onlyDefault || modeNames.length === 1 ? (vals[def]?.alias ? semantic : primitives) : semantic).push(token);
  }
  const ref = (p) => (p.alias ? (byVar.has(p.alias) ? { alias: slug(nameOf(p.alias)) } : undefined) : p.value);
  const collections = [];
  if (primitives.length) {
    collections.push({
      id: 'primitives', name: 'Primitives', modes: [{ id: 'default', name: 'Default' }], defaultModeId: 'default',
      variables: primitives.map(({ raw, ...t }) => ({ ...t, valuesByMode: { default: ref(raw[def]) } })),
    });
  }
  if (semantic.length) {
    const ms = modeNames.map((m) => ({ id: slug(m), name: m }));
    collections.push({
      id: 'semantic', name: modeNames.length > 1 ? 'Semantic' : 'Tokens', modes: ms, defaultModeId: ms[0].id,
      variables: semantic.map(({ raw, ...t }) => ({
        ...t, valuesByMode: Object.fromEntries(ms.map((m) => [m.id, ref(raw[m.name] || raw[def])]).filter(([, v]) => v !== undefined)),
      })),
    });
  }
  for (const c of collections) normalizeGroups(c);
  return { collections, skipped };
}
const normSel = (s) => String(s).replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').replace(/"/g, "'").trim();

// ---------- merging into the existing file ----------
// The imported tokens into the existing collections: values come from the import (the code); ids,
// descriptions, groups and order stay; new collections, modes and tokens get ids from their names.
// Tokens that are only in the Sigma file stay (listed in onlyInSigma) unless `prune`.
// Returns { collections, report: { added, changed, unchanged, onlyInSigma } } (token names).
export function mergeTokenCollections(existing = [], imported = [], { prune = false } = {}) {
  const out = structuredClone(existing);
  const report = { added: [], changed: [], unchanged: [], onlyInSigma: [] };
  const taken = new Set(out.flatMap((c) => [c.id, ...(c.variables || []).map((v) => v.id), ...(c.modes || []).map((m) => m.id)]));
  const fresh = (base) => {
    let id = slug(base);
    for (let i = 2; taken.has(id); i++) id = `${slug(base)}-${i}`;
    taken.add(id);
    return id;
  };
  // Imported ids (random from tokens.json, or from names) → the ids they get here.
  const idMap = new Map();
  const existingByName = new Map(out.flatMap((c) => (c.variables || []).map((v) => [v.name, { c, v }])));
  const plan = imported.map((ic) => {
    let c = out.find((x) => x.name === ic.name && !x.extends === !ic.extends);
    if (!c) {
      c = { ...structuredClone(ic), id: fresh(ic.name), variables: [], modes: [] };
      delete c.groups;
      out.push(c);
    }
    const modeMap = new Map();
    for (const m of ic.modes || []) {
      let mine = c.modes.find((x) => x.name === m.name);
      if (!mine) {
        mine = { ...m, id: fresh(`${c.id}-${m.name}`) };
        c.modes.push(mine);
      }
      modeMap.set(m.id, mine.id);
    }
    c.defaultModeId = modeMap.get(ic.defaultModeId) || c.defaultModeId || c.modes[0]?.id;
    for (const v of ic.variables || []) {
      const hit = existingByName.get(v.name);
      idMap.set(v.id, hit ? hit.v.id : fresh(v.name));
    }
    return { ic, c, modeMap };
  });
  const remap = (val) => {
    if (isAlias(val)) return { alias: idMap.get(val.alias) || val.alias };
    if (val && typeof val === 'object' && !Array.isArray(val)) return Object.fromEntries(Object.entries(val).map(([k, x]) => [k, remap(x)]));
    return val;
  };
  const seen = new Set();
  for (const { ic, c, modeMap } of plan) {
    for (const v of ic.variables || []) {
      const id = idMap.get(v.id);
      seen.add(id);
      const valuesByMode = Object.fromEntries(Object.entries(v.valuesByMode || {}).map(([m, x]) => [modeMap.get(m) || m, remap(x)]));
      const hit = existingByName.get(v.name);
      if (hit) {
        const target = hit.v;
        if (hit.c !== c) { // moved to another collection
          hit.c.variables = hit.c.variables.filter((x) => x !== target);
          c.variables.push(target);
        }
        const before = stable([target.type, target.valuesByMode, target.codeSyntax]);
        target.type = v.type;
        target.valuesByMode = { ...target.valuesByMode, ...valuesByMode };
        for (const m of Object.keys(target.valuesByMode)) if (!c.modes.some((x) => x.id === m)) delete target.valuesByMode[m];
        if (v.codeSyntax) target.codeSyntax = { ...(target.codeSyntax || {}), ...v.codeSyntax };
        if (v.description && !target.description) target.description = v.description;
        (before === stable([target.type, target.valuesByMode, target.codeSyntax]) ? report.unchanged : report.changed).push(v.name);
      } else {
        const t = { id, name: v.name, type: v.type, valuesByMode };
        for (const k of ['description', 'codeSyntax', 'deprecated']) if (v[k] !== undefined) t[k] = structuredClone(v[k]);
        c.variables.push(t);
        report.added.push(v.name);
      }
    }
  }
  for (const c of out) {
    if (c.extends) continue;
    const keep = [];
    for (const v of c.variables || []) {
      if (seen.has(v.id)) keep.push(v);
      else {
        report.onlyInSigma.push(v.name);
        if (!prune) keep.push(v);
      }
    }
    c.variables = keep;
    normalizeGroups(c);
  }
  return { collections: out.filter((c) => c.extends || c.variables.length || existing.some((e) => e.id === c.id)), report };
}

// ---------- what changed ----------
// [{ id, name, code, type, change: 'added' | 'changed' | 'removed', modes: { [modeName]: { before, after } } }]
// Values are as stored: a value, or { alias: '<token name>' } (names, not ids, so it reads well).
export function tokenChanges(before = [], after = [], { naming, prefix, map } = {}) {
  const index = (cols) => {
    const vars = new Map();
    const names = new Map(cols.flatMap((c) => (c.variables || []).map((v) => [v.id, v.name])));
    for (const c of cols) {
      for (const v of c.variables || []) {
        const modes = {};
        const named = (x) => (isAlias(x) ? { alias: names.get(x.alias) || x.alias }
          : x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, named(y)])) : x);
        for (const m of c.modes || []) modes[m.name] = named(v.valuesByMode?.[m.id]);
        vars.set(v.id, { id: v.id, name: v.name, type: v.type, code: v.codeSyntax?.web || codeNameFor(v.name, { naming, prefix, map }), modes });
      }
    }
    return vars;
  };
  const a = index(before), b = index(after);
  const out = [];
  for (const [id, t] of b) {
    const old = a.get(id);
    if (!old) out.push({ ...t, change: 'added', modes: Object.fromEntries(Object.entries(t.modes).map(([m, x]) => [m, { after: x }])) });
    else {
      const modes = {};
      for (const m of new Set([...Object.keys(old.modes), ...Object.keys(t.modes)])) {
        if (stable(old.modes[m]) !== stable(t.modes[m])) modes[m] = { before: old.modes[m], after: t.modes[m] };
      }
      if (Object.keys(modes).length || old.name !== t.name || old.code !== t.code) out.push({ ...t, change: 'changed', renamedFrom: old.name !== t.name ? old.name : undefined, codeBefore: old.code !== t.code ? old.code : undefined, modes });
    }
  }
  for (const [id, t] of a) if (!b.has(id)) out.push({ ...t, change: 'removed', modes: {} });
  return out;
}

// ---------- collections → CSS ----------
// Write the tokens into a CSS file's custom properties as minimal edits: a value that already means the
// same thing isn't touched; a changed value is written the way the old one was; a token with no
// declaration yet is added at the end of its mode's block. `remove`: code names to delete.
// Returns { text, edits: [{ name, selector, before, after }], missing: [{ name, selector }] }.
export function applyToCSS(text, collections, { modes = { Default: ':root' }, remBase = 16, naming = 'kebab', prefix = '', map = {}, remove = [] } = {}) {
  const decls = parseCSSVariables(text);
  const modeNames = Object.keys(modes);
  const def = modeNames[0];
  const ids = new Map(collections.flatMap((c) => (c.variables || []).map((v) => [v.id, v])));
  const codeOf = (v) => v.codeSyntax?.web || codeNameFor(v.name, { naming, prefix, map });
  const edits = [], inserts = [], missing = [];
  // How this file writes colors, for a value that had none to copy (it was a var() before).
  const fileColor = decls.map((d) => parseColorValue(d.value)).find(Boolean) || { format: 'hex' };
  const find = (name, selector) => decls.find((d) => d.name === name && normSel(d.selector) === normSel(selector));
  for (const c of collections) {
    if (c.extends) continue;
    const modeByName = new Map((c.modes || []).map((m) => [m.name, m.id]));
    for (const v of c.variables || []) {
      const name = codeOf(v);
      for (const modeName of modeNames) {
        const selector = modes[modeName];
        // Single-mode collections (primitives) live in the default block only.
        const modeId = c.modes.length === 1 ? (modeName === def ? c.modes[0].id : null) : modeByName.get(modeName);
        if (!modeId) continue;
        const val = v.valuesByMode?.[modeId];
        if (val === undefined) continue;
        const want = isAlias(val) ? { alias: ids.get(val.alias) ? codeOf(ids.get(val.alias)) : null } : { type: v.type, value: val };
        if (want.alias === null) continue;
        const have = find(name, selector);
        // Other modes only need a declaration where they differ from the default.
        if (modeName !== def && !have) {
          const defVal = v.valuesByMode?.[c.defaultModeId];
          if (stable(defVal) === stable(val)) continue;
        }
        if (have) {
          const parsed = parseCSSValue(have.value, { remBase, name });
          const same = want.alias ? parsed.alias === want.alias
            : !parsed.alias && sameValue(v.type, parsed.value, want.value);
          if (same) continue;
          const like = parsed.like?.format || parsed.like?.unit !== undefined ? parsed.like : v.type === 'color' ? fileColor : {};
          const after = want.alias ? `var(${want.alias})` : formatCSSValue(v.type, want.value, { ...like, name }, { remBase });
          edits.push({ name, selector, before: have.value, after, start: have.start, end: have.end });
        } else {
          // Next to its closest relative (--space-8 after --space-4), written the same way.
          const block = blockOf(text, decls, selector, name);
          const like = block?.neighbor ? parseCSSValue(block.neighbor.value, { remBase, name: block.neighbor.name }) : null;
          const fallback = { unit: v.type === 'number' && !/opacity|weight|line-height|z-index/.test(name) ? 'px' : '', name };
          const after = want.alias ? `var(${want.alias})` : formatCSSValue(v.type, want.value, like?.type === v.type ? { ...like.like, name } : v.type === 'color' ? { ...fileColor, name } : fallback, { remBase });
          if (block) inserts.push({ name, selector, after, at: block.at, indent: block.indent });
          else missing.push({ name, selector });
        }
      }
    }
  }
  for (const name of remove) {
    for (const d of decls.filter((x) => x.name === name)) {
      const lineStart = text.lastIndexOf('\n', d.start) + 1;
      let lineEnd = text.indexOf('\n', d.end);
      lineEnd = lineEnd < 0 ? text.length : lineEnd + 1;
      edits.push({ name, selector: d.selector, before: d.value, after: null, start: lineStart, end: lineEnd, whole: true });
    }
  }
  // Apply from the end, so earlier offsets stay right.
  const all = [
    ...edits.map((e) => ({ at: e.start, end: e.end, text: e.after === null ? '' : e.after })),
    ...inserts.map((e) => ({ at: e.at, end: e.at, text: `${e.indent}${e.name}: ${e.after};\n` })),
  ].sort((a, b) => b.at - a.at);
  let out = text;
  for (const e of all) out = out.slice(0, e.at) + e.text + out.slice(e.end);
  return {
    text: out,
    edits: [...edits.map(({ start, end, whole, ...e }) => e), ...inserts.map(({ at, indent, ...e }) => ({ ...e, before: null }))],
    missing,
  };
}

function sameValue(type, a, b) {
  if (type === 'color') return typeof a === 'string' && typeof b === 'string' && a.toUpperCase() === b.toUpperCase();
  if (type === 'number' || type === 'duration') return Math.abs(Number(a) - Number(b)) < 1e-6;
  return stable(a) === stable(b);
}

// Where to add a declaration in a selector's block: after the custom property whose name shares the most
// with it (the last of those), or after the block's last one. null if the block has none.
function blockOf(text, decls, selector, name = '') {
  const inBlock = decls.filter((d) => normSel(d.selector) === normSel(selector));
  if (!inBlock.length) return null;
  const shared = (d) => {
    const a = d.name.split('-'), b = name.split('-');
    let k = 0;
    while (k < a.length && k < b.length && a[k] === b[k]) k++;
    return k;
  };
  const best = Math.max(...inBlock.map(shared));
  const neighbor = best > 2 ? inBlock.filter((d) => shared(d) === best).pop() : null; // "--" plus at least one word
  const after = neighbor || inBlock[inBlock.length - 1];
  const lineEnd = text.indexOf('\n', after.end);
  const lineStart = text.lastIndexOf('\n', after.start) + 1;
  const indent = /^\s*/.exec(text.slice(lineStart))[0];
  return { at: lineEnd < 0 ? text.length : lineEnd + 1, indent, neighbor };
}
