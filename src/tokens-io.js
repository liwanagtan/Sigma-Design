// Design tokens in and out of Sigma.
//
// tokens.json follows the W3C Design Tokens format (DTCG): groups come from "/" in token names, aliases
// are "{group.token}", colors use the DTCG color object, sizes are { value, unit }. DTCG has no modes, so
// every collection × mode becomes a token set ("Color/Dark"), the multi-set layout used by Tokens Studio
// and Style Dictionary setups. A "$extensions" → "app.sigma" block records Sigma's collections, modes and
// extended collections, so re-importing an export rebuilds them exactly.
import { uid } from './store.js';
import { TYPO_FIELDS, ALL_FIELDS, splitColor, joinColor, defaultValue, parseEasing } from './variables.js';
import { normalizeGroups, groupPaths } from './token-groups.js';

const SIGMA = 'app.sigma';
const isAlias = (v) => !!v && typeof v === 'object' && typeof v.alias === 'string';

// Number tokens whose names suggest a unitless quantity stay plain numbers; the rest are px dimensions.
const UNITLESS = /(opacity|weight|line-?height|z-?index|scale|ratio|count|columns|order|flex|duration)/i;
const isDimension = (name) => !UNITLESS.test(name);

const segs = (name) => name.split('/').map((s) => s.trim().replace(/[.{}]/g, '-').replace(/^\$/, '')).filter(Boolean);
const dotted = (name) => segs(name).join('.');

// ---------- collection helpers (pure: they work on a plain list of collections) ----------
function indexOf(cols) {
  const colById = new Map(cols.map((c) => [c.id, c]));
  const varById = new Map();
  for (const c of cols) for (const v of c.variables || []) varById.set(v.id, v);
  const rootOf = (c) => {
    for (let cur = c, i = 0; cur && i < 32; i++) {
      if (!cur.extends) return cur;
      cur = colById.get(cur.extends);
    }
    return c;
  };
  // A token's raw value (value or alias) in collection c, mode m, following extensions up to the root.
  const raw = (c, modeId, v, depth = 0) => {
    if (!c.extends || depth > 32) return v.valuesByMode[modeId] ?? v.valuesByMode[c.defaultModeId];
    const own = c.overrides?.[v.id]?.[modeId];
    if (own !== undefined) return own;
    const parent = colById.get(c.extends);
    if (!parent) return undefined;
    const mode = c.modes.find((m) => m.id === modeId);
    return raw(parent, mode?.parentModeId || parent.defaultModeId, v, depth + 1);
  };
  return { colById, varById, rootOf, raw };
}

// ---------- export: DTCG ----------
function colorOut(value) {
  const { hex, alpha } = splitColor(value);
  const n = parseInt(hex.slice(1), 16);
  const components = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round((x / 255) * 10000) / 10000);
  const out = { colorSpace: 'srgb', components, hex: hex.toLowerCase() };
  if (alpha < 1) out.alpha = alpha;
  return out;
}

const dimension = (n) => ({ value: Number(n) || 0, unit: 'px' });

// `external`: collections of linked token files, to name the tokens these ones point at. Those references
// are written by name ("{color.blue.500}"), so tools that load both files resolve them.
const externalNames = (external) => new Map((external || []).flatMap((c) => (c.variables || []).map((v) => [v.id, v.name])));

export function exportDTCG(cols, { external = [] } = {}) {
  const { varById, rootOf, raw } = indexOf(cols);
  const ext = externalNames(external);
  const ref = (id) => (varById.has(id) ? `{${dotted(varById.get(id).name)}}` : ext.has(id) ? `{${dotted(ext.get(id))}}` : null);
  const out = {};
  const order = [];

  const valueOut = (v, value) => {
    if (isAlias(value)) return ref(value.alias);
    switch (v.type) {
      case 'color': return colorOut(value);
      case 'number': return isDimension(v.name) ? dimension(value) : Number(value) || 0;
      case 'duration': return { value: Number(value) || 0, unit: 'ms' };
      case 'easing': return parseEasing(value) || defaultValue('easing');
      case 'shadow': {
        const t = { ...defaultValue('shadow'), ...(value || {}) };
        const f = (k, conv) => (isAlias(t[k]) ? ref(t[k].alias) : conv(t[k]));
        return {
          color: f('color', colorOut), offsetX: f('x', dimension), offsetY: f('y', dimension),
          blur: f('blur', dimension), spread: f('spread', dimension), inset: false,
        };
      }
      case 'typography': {
        const t = { ...defaultValue('typography'), ...(value || {}) };
        const f = (k, conv) => (isAlias(t[k]) ? ref(t[k].alias) : conv(t[k]));
        return {
          fontFamily: f('fontFamily', (x) => String(x)),
          fontWeight: f('fontWeight', (x) => Number(x) || 400),
          fontSize: f('fontSize', dimension),
          // "normal" keeps Sigma's "Auto" line height through a round trip.
          lineHeight: f('lineHeight', (x) => (x === null || x === undefined ? 'normal' : Math.round((x / 100) * 1000) / 1000)),
          letterSpacing: f('letterSpacing', dimension),
        };
      }
      default: return value;
    }
  };
  const typeOut = (v) => ({
    color: 'color', number: isDimension(v.name) ? 'dimension' : 'number', string: /font-?family/i.test(v.name) ? 'fontFamily' : 'string',
    boolean: 'boolean', typography: 'typography', duration: 'duration', easing: 'cubicBezier', shadow: 'shadow',
  }[v.type]);

  for (const c of cols) {
    const vars = rootOf(c).variables || [];
    // Group descriptions become "$description" on the group.
    const groups = (rootOf(c).groups || []).filter((g) => g && typeof g === 'object');
    const groupPathById = groupPaths(groups);
    for (const m of c.modes) {
      const set = `${c.name}/${m.name}`;
      const tree = {};
      for (const g of groups) {
        if (!g.description) continue;
        let node = tree;
        for (const p of segs(groupPathById.get(g.id))) node = node[p] ||= {};
        node.$description = g.description;
      }
      for (const v of vars) {
        const path = segs(v.name);
        if (!path.length) continue;
        let node = tree;
        for (const p of path.slice(0, -1)) node = node[p] ||= {};
        const token = { $type: typeOut(v), $value: valueOut(v, raw(c, m.id, v)) };
        if (v.description) token.$description = v.description;
        node[path[path.length - 1]] = token;
      }
      out[set] = tree;
      order.push(set);
    }
  }
  out.$themes = order.map((set) => ({ name: set, selectedTokenSets: { [set]: 'enabled' } }));
  out.$metadata = { tokenSetOrder: order };
  out.$extensions = {
    [SIGMA]: {
      version: 1,
      collections: cols.map((c) => ({
        id: c.id, name: c.name, extends: c.extends || null, defaultModeId: c.defaultModeId,
        modes: c.modes.map((m) => ({ id: m.id, name: m.name, parentModeId: m.parentModeId || null })),
        variables: (c.variables || []).map((v) => ({ id: v.id, name: v.name, type: v.type })),
        groups: (c.groups || []).filter((g) => g && typeof g === 'object')
          .map((g) => ({ id: g.id, name: g.name, parentId: g.parentId || null, ...(g.description ? { description: g.description } : {}) })),
      })),
    },
  };
  return out;
}

// ---------- export: CSS ----------
const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const cssName = (name) => `--${segs(name).map(slug).join('-')}`;

export function exportCSS(cols, { title = 'Design tokens', external = [] } = {}) {
  const { varById, rootOf, raw } = indexOf(cols);
  const ext = externalNames(external);
  const varRef = (id) => (varById.has(id) ? `var(${cssName(varById.get(id).name)})` : ext.has(id) ? `var(${cssName(ext.get(id))})` : 'initial');
  const num = (v, n) => (isDimension(v.name) ? `${Number(n) || 0}px` : `${Number(n) || 0}`);
  const lines = (v, value) => {
    const name = cssName(v.name);
    if (isAlias(value)) return [`${name}: ${varRef(value.alias)};`];
    switch (v.type) {
      case 'color': {
        const { hex, alpha } = splitColor(value);
        return [`${name}: ${alpha < 1 ? joinColor(hex, alpha).toLowerCase() : hex.toLowerCase()};`];
      }
      case 'number': return [`${name}: ${num(v, value)};`];
      case 'boolean': return [`${name}: ${value ? 1 : 0};`];
      case 'duration': return [`${name}: ${Number(value) || 0}ms;`];
      case 'easing': return [`${name}: cubic-bezier(${(parseEasing(value) || defaultValue('easing')).join(', ')});`];
      case 'shadow': {
        const t = { ...defaultValue('shadow'), ...(value || {}) };
        const f = (k, conv) => (isAlias(t[k]) ? varRef(t[k].alias) : conv(t[k]));
        const px = (x) => `${Number(x) || 0}px`;
        const color = f('color', (x) => {
          const { hex, alpha } = splitColor(x);
          return (alpha < 1 ? joinColor(hex, alpha) : hex).toLowerCase();
        });
        return [`${name}: ${f('x', px)} ${f('y', px)} ${f('blur', px)} ${f('spread', px)} ${color};`];
      }
      case 'typography': {
        const t = { ...defaultValue('typography'), ...(value || {}) };
        const f = (k, conv) => (isAlias(t[k]) ? varRef(t[k].alias) : conv(t[k]));
        const family = f('fontFamily', (x) => `"${String(x).replace(/"/g, '')}", system-ui, sans-serif`);
        const weight = f('fontWeight', (x) => `${Number(x) || 400}`);
        const size = f('fontSize', (x) => `${Number(x) || 16}px`);
        const lh = f('lineHeight', (x) => (x === null || x === undefined ? 'normal' : `${Math.round(x) / 100}`));
        const ls = f('letterSpacing', (x) => `${Number(x) || 0}px`);
        return [
          `${name}-font-family: ${family};`, `${name}-font-weight: ${weight};`, `${name}-font-size: ${size};`,
          `${name}-line-height: ${lh};`, `${name}-letter-spacing: ${ls};`,
          `${name}: ${weight} ${size}/${lh} ${family};`,
        ];
      }
      default: return [`${name}: "${String(value ?? '').replace(/"/g, '\\"')}";`];
    }
  };
  const body = (c, modeId) => (rootOf(c).variables || []).flatMap((v) => lines(v, raw(c, modeId, v)));
  const block = (selector, list) => (list.length ? `${selector} {\n${list.map((l) => `  ${l}`).join('\n')}\n}` : '');
  const rootLines = [];
  const blocks = [];
  const notes = [];
  for (const c of cols) {
    const root = rootOf(c);
    const attr = `data-${slug(root.name)}`;
    for (const m of c.modes) {
      if (!c.extends && m.id === c.defaultModeId) {
        rootLines.push(...body(c, m.id)); // every collection's default mode shares one :root block
        continue;
      }
      const value = c.extends ? slug(`${c.name} ${m.name}`) : slug(m.name);
      blocks.push(block(`[${attr}="${value}"]`, body(c, m.id)));
      notes.push(`${attr}="${value}"  →  ${c.name} / ${m.name}`);
    }
  }
  const header = `/* ${title} — exported from Sigma.\n * Default modes are on :root. Switch a mode or brand on any element:\n` +
    (notes.length ? notes.map((n) => ` *   ${n}`).join('\n') + '\n' : '') + ' */';
  return `${header}\n\n${[block(':root', rootLines), ...blocks].filter(Boolean).join('\n\n')}\n`;
}

// ---------- import ----------
const WEIGHT_NAMES = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, normal: 400, regular: 400, book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
const TYPE_IN = {
  color: 'color', dimension: 'number', number: 'number', fontWeight: 'number', duration: 'duration', cubicBezier: 'easing',
  fontFamily: 'string', string: 'string', text: 'string', boolean: 'boolean', typography: 'typography', shadow: 'shadow',
};

function hexIn(value) {
  if (value && typeof value === 'object') {
    if (typeof value.hex === 'string') return joinColor(value.hex, value.alpha ?? 1);
    if (Array.isArray(value.components)) {
      const h = value.components.slice(0, 3).map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
      return joinColor(`#${h}`, value.alpha ?? 1);
    }
    return null;
  }
  const s = String(value).trim();
  let m = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (m) return joinColor(`#${m[1].slice(0, 3).split('').map((c) => c + c).join('')}`, m[1].length === 4 ? parseInt(m[1][3] + m[1][3], 16) / 255 : 1);
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return joinColor(`#${m[1]}`, m[2] ? parseInt(m[2], 16) / 255 : 1);
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const h = [m[1], m[2], m[3]].map((x) => Math.round(Number(x)).toString(16).padStart(2, '0')).join('');
    const a = m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])) : 1;
    return joinColor(`#${h}`, a);
  }
  return null;
}

function numIn(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'value' in value) return Number(value.value) * (value.unit === 'rem' || value.unit === 'em' ? 16 : 1);
  const m = /^(-?[\d.]+)\s*(px|rem|em|%)?$/i.exec(String(value).trim());
  if (!m) return null;
  return Number(m[1]) * (/r?em/i.test(m[2] || '') ? 16 : 1);
}

// Milliseconds from 200, "200ms", "0.2s" or { value, unit: "ms" | "s" }.
function durationIn(value) {
  if (typeof value === 'number') return value;
  const [n, unit] = value && typeof value === 'object' ? [Number(value.value), value.unit] : (() => {
    const m = /^(-?[\d.]+)\s*(ms|s)?$/i.exec(String(value).trim());
    return m ? [Number(m[1]), m[2]] : [NaN];
  })();
  if (!Number.isFinite(n)) return null;
  return String(unit).toLowerCase() === 's' ? Math.round(n * 1000) : n;
}

const refIn = (value) => (typeof value === 'string' && /^\{[^{}]+\}$/.test(value.trim()) ? value.trim().slice(1, -1) : null);

// Read tokens.json (DTCG, Tokens Studio multi-set, or a Sigma export) into Sigma collections with fresh ids.
// Returns { collections, skipped } where skipped counts tokens of types Sigma doesn't support.
// `external`: collections of linked token files; references not found in the import resolve to them.
export function importTokens(json, { external = [] } = {}) {
  if (!json || typeof json !== 'object') throw new Error('Not a tokens file');
  const meta = json.$extensions?.[SIGMA];
  const setNames = Object.keys(json).filter((k) => !k.startsWith('$'));
  const looksLikeSets = !!(meta || json.$metadata?.tokenSetOrder || setNames.some((k) => k.includes('/')));
  const sets = looksLikeSets ? setNames.map((k) => [k, json[k]]) : [['Tokens/Default', json]];
  let skipped = 0;

  // Collections and modes: from Sigma's metadata when present, else from set names "Collection/Mode".
  const cols = [];
  const colByName = new Map();
  const idMap = new Map(); // old id -> new id
  const fresh = (old) => {
    if (!idMap.has(old)) idMap.set(old, uid());
    return idMap.get(old);
  };
  if (meta?.collections) {
    for (const mc of meta.collections) {
      const c = {
        id: fresh(mc.id), name: mc.name, modes: mc.modes.map((m) => ({ id: fresh(m.id), name: m.name, ...(m.parentModeId ? { parentModeId: fresh(m.parentModeId) } : {}) })),
        defaultModeId: fresh(mc.defaultModeId), variables: [], ...(mc.extends ? { extends: fresh(mc.extends), overrides: {} } : {}),
        _declared: new Map((mc.variables || []).map((v) => [v.name, v])),
        ...(mc.groups?.length ? {
          groups: mc.groups.map((g) => ({ id: fresh(g.id), name: g.name, parentId: g.parentId ? fresh(g.parentId) : null, ...(g.description ? { description: g.description } : {}) })),
        } : {}),
      };
      cols.push(c);
      colByName.set(c.name, c);
    }
  }
  const ensure = (setName) => {
    const i = setName.lastIndexOf('/');
    const colName = i > 0 ? setName.slice(0, i) : setName;
    const modeName = i > 0 ? setName.slice(i + 1) : 'Default';
    let c = colByName.get(colName);
    if (!c) {
      c = { id: uid(), name: colName, modes: [], defaultModeId: null, variables: [] };
      cols.push(c);
      colByName.set(colName, c);
    }
    let m = c.modes.find((x) => x.name === modeName);
    if (!m) {
      m = { id: uid(), name: modeName };
      c.modes.push(m);
    }
    c.defaultModeId ||= m.id;
    return { c, m };
  };

  // Collect every token: [{ c, m, name, type, value, description }]
  const found = [];
  for (const [setName, tree] of sets) {
    const { c, m } = ensure(setName);
    const walkTree = (node, path, inherited) => {
      if (!node || typeof node !== 'object') return;
      const groupType = node.$type || inherited;
      if (!('$value' in node) && path.length && typeof node.$description === 'string') ((c._groupDescs ||= new Map())).set(path.join('/'), node.$description);
      if ('$value' in node) {
        const type = TYPE_IN[node.$type || inherited];
        if (!type) return void skipped++;
        found.push({ c, m, name: path.join('/'), type, value: node.$value, description: node.$description });
        return;
      }
      for (const [k, child] of Object.entries(node)) if (!k.startsWith('$')) walkTree(child, [...path, k], groupType);
    };
    walkTree(tree, [], undefined);
  }

  // Create tokens in their root collections (extensions get overrides later).
  const rootOf = (c) => {
    for (let cur = c, i = 0; cur && i < 32; i++) {
      if (!cur.extends) return cur;
      cur = cols.find((x) => x.id === cur.extends);
    }
    return c;
  };
  const tokenByName = (c, name) => rootOf(c).variables.find((v) => v.name === name);
  for (const f of found) {
    const root = rootOf(f.c);
    if (root !== f.c && tokenByName(f.c, f.name)) continue;
    let v = root.variables.find((x) => x.name === f.name);
    if (!v) {
      const declared = root._declared?.get(f.name);
      v = { id: declared ? fresh(declared.id) : uid(), name: f.name, type: declared?.type || f.type, valuesByMode: {} };
      root.variables.push(v);
    }
    if (f.description && !v.description) v.description = f.description;
  }

  // Resolve "{a.b.c}" references: same collection family first, then anywhere.
  const resolveRef = (ref, c) => {
    const name = ref.split('.').join('/');
    const own = tokenByName(c, name);
    if (own) return own.id;
    for (const other of [...cols, ...external]) {
      const v = (other.variables || []).find((x) => dotted(x.name) === ref || x.name === name);
      if (v) return v.id;
    }
    return null;
  };
  const valueIn = (type, value, c) => {
    const r = refIn(value);
    if (r) {
      const id = resolveRef(r, c);
      return id ? { alias: id } : undefined;
    }
    switch (type) {
      case 'color': return hexIn(value) ?? undefined;
      case 'number': {
        if (typeof value === 'string' && WEIGHT_NAMES[value.toLowerCase().replace(/[\s-]/g, '')]) return WEIGHT_NAMES[value.toLowerCase().replace(/[\s-]/g, '')];
        return numIn(value) ?? undefined;
      }
      case 'string': return Array.isArray(value) ? String(value[0]) : String(value);
      case 'duration': return durationIn(value) ?? undefined;
      case 'easing': return parseEasing(value) ?? undefined;
      case 'boolean': return value === true || value === 'true' || value === 1;
      case 'shadow': {
        // One shadow per token: a list (layered shadows) keeps its first layer.
        const s = Array.isArray(value) ? value[0] : value;
        if (!s || typeof s !== 'object') return undefined;
        const t = defaultValue('shadow');
        const keys = { color: 'color', x: 'offsetX', y: 'offsetY', blur: 'blur', spread: 'spread' };
        for (const [k, from] of Object.entries(keys)) {
          const raw = s[from] ?? s[k];
          if (raw === undefined) continue;
          const r2 = refIn(raw);
          if (r2) {
            const id = resolveRef(r2, c);
            if (id) t[k] = { alias: id };
            continue;
          }
          t[k] = k === 'color' ? (hexIn(raw) ?? t[k]) : (numIn(raw) ?? t[k]);
        }
        return t;
      }
      case 'typography': {
        if (!value || typeof value !== 'object') return undefined;
        const t = defaultValue('typography');
        for (const k of Object.keys(TYPO_FIELDS)) {
          if (value[k] === undefined) continue;
          const r2 = refIn(value[k]);
          if (r2) {
            const id = resolveRef(r2, c);
            if (id) t[k] = { alias: id };
            continue;
          }
          if (k === 'fontFamily') t[k] = Array.isArray(value[k]) ? String(value[k][0]) : String(value[k]);
          else if (k === 'fontWeight') t[k] = typeof value[k] === 'string' ? (WEIGHT_NAMES[value[k].toLowerCase()] ?? (Number(value[k]) || 400)) : Number(value[k]);
          else if (k === 'lineHeight') {
            const n = typeof value[k] === 'string' && value[k].trim().endsWith('%') ? parseFloat(value[k]) / 100 : numIn(value[k]);
            t[k] = n === null || value[k] === 'normal' ? null : Math.round(n * 100 * 100) / 100; // ratio → percent
          } else t[k] = numIn(value[k]) ?? t[k];
        }
        return t;
      }
      default: return value;
    }
  };

  // Root collections first, so extensions compare against their parents' final values.
  const ordered = [...found.filter((f) => !f.c.extends), ...found.filter((f) => f.c.extends)];
  for (const f of ordered) {
    const v = tokenByName(f.c, f.name);
    if (!v) continue;
    const value = valueIn(v.type, f.value, f.c);
    if (value === undefined) continue;
    if (f.c.extends) {
      // Store only values that differ from what the extension inherits.
      const parent = cols.find((x) => x.id === f.c.extends);
      const inherited = parent && rawIn(cols, parent, f.m.parentModeId || parent.defaultModeId, v);
      if (JSON.stringify(inherited) !== JSON.stringify(value)) ((f.c.overrides ||= {})[v.id] ||= {})[f.m.id] = value;
    } else {
      v.valuesByMode[f.m.id] = value;
    }
  }
  // Fill modes a token had no value for with its default-mode value (or the type default).
  for (const c of cols) {
    // JSON groups regroup tokens; a Sigma export restores the original order.
    if (c._declared) {
      const order = [...c._declared.keys()];
      const rank = (v) => (order.includes(v.name) ? order.indexOf(v.name) : order.length);
      c.variables.sort((a, b) => rank(a) - rank(b));
    }
    delete c._declared;
    // Groups: Sigma's own (from its metadata) keep their order and descriptions; the rest come from paths.
    normalizeGroups(c);
    const descs = c._groupDescs;
    delete c._groupDescs;
    if (descs && !c.extends) {
      const paths = groupPaths(c.groups);
      for (const g of c.groups) if (!g.description && descs.has(paths.get(g.id))) g.description = descs.get(paths.get(g.id));
    }
    for (const v of c.variables) {
      const fallback = v.valuesByMode[c.defaultModeId] ?? defaultValue(v.type);
      for (const m of c.modes) if (v.valuesByMode[m.id] === undefined) v.valuesByMode[m.id] = structuredClone(fallback);
    }
  }
  return { collections: cols, skipped };
}

function rawIn(cols, c, modeId, v) {
  return indexOf(cols).raw(c, modeId, v);
}

// Merge imported collections into existing ones by name: tokens match by name, modes by name; new
// collections, modes and tokens are added. Returns the number of tokens added or updated.
export function mergeCollections(target, incoming) {
  const idMap = new Map();
  let touched = 0;
  for (const inc of incoming) {
    const existing = target.find((c) => c.name === inc.name && !!c.extends === !!inc.extends);
    if (!existing) {
      target.push(inc);
      for (const v of inc.variables) idMap.set(v.id, v.id);
      touched += inc.variables.length;
      continue;
    }
    idMap.set(inc.id, existing.id);
    const modeMap = new Map();
    for (const m of inc.modes) {
      let em = existing.modes.find((x) => x.name === m.name);
      if (!em) {
        em = { id: uid(), name: m.name };
        existing.modes.push(em);
        for (const v of existing.variables) v.valuesByMode[em.id] = structuredClone(v.valuesByMode[existing.defaultModeId]);
      }
      modeMap.set(m.id, em.id);
    }
    for (const v of inc.variables) {
      let ev = existing.variables.find((x) => x.name === v.name && x.type === v.type);
      if (!ev) {
        ev = { id: v.id, name: v.name, type: v.type, valuesByMode: {} };
        for (const m of existing.modes) ev.valuesByMode[m.id] = structuredClone(v.valuesByMode[inc.defaultModeId]);
        existing.variables.push(ev);
      }
      idMap.set(v.id, ev.id);
      for (const [mid, value] of Object.entries(v.valuesByMode)) if (modeMap.has(mid)) ev.valuesByMode[modeMap.get(mid)] = value;
      if (v.description) ev.description = v.description;
      touched++;
    }
  }
  // Aliases inside merged values pointed at incoming ids; point them at the tokens they merged into.
  const remap = (x) => {
    if (isAlias(x)) return { alias: idMap.get(x.alias) || x.alias };
    if (x && typeof x === 'object') {
      for (const k of ALL_FIELDS) if (isAlias(x[k])) x[k] = { alias: idMap.get(x[k].alias) || x[k].alias };
    }
    return x;
  };
  for (const c of target) {
    for (const v of c.variables || []) for (const m of Object.keys(v.valuesByMode)) v.valuesByMode[m] = remap(v.valuesByMode[m]);
    if (c.extends && idMap.has(c.extends)) c.extends = idMap.get(c.extends);
  }
  return touched;
}
