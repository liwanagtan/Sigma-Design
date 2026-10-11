// Token audit: the values in a design file that don't come from design tokens, grouped by value, each with
// the token that matches it (or comes closest), plus layers still using deprecated tokens and instances of
// deprecated components. It's how a file's one-off values become tokens.
//
// Layers inside instances are skipped: their values come from the main component, which is audited instead.
import { state, walk, getNode, editNode, pageOf } from './store.js';
import {
  allVariables, findVariable, resolveValue, modeContextOf, bindVariable, splitColor, joinColor, aliasDepth,
} from './variables.js';
import { isInsideInstance, isDeprecated, mainComponentOf } from './components.js';
import { parseColor } from './contrast.js';

export const AUDIT_KINDS = {
  color: { label: 'Colors', type: 'color' },
  typography: { label: 'Text styles', type: 'typography' },
  spacing: { label: 'Spacing', type: 'number' },
  radius: { label: 'Corner radius', type: 'number' },
  shadow: { label: 'Shadows', type: 'shadow' },
};
// Number tokens whose names suggest they're meant for this kind come first.
const NAME_HINT = { spacing: /space|spacing|gap|padding|gutter|margin|inset/i, radius: /radius|corner|round/i };

const PADDING = ['layout.gap', 'layout.pt', 'layout.pr', 'layout.pb', 'layout.pl'];
const TYPO_KEYS = ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing'];
const SHADOW_KEYS = ['color', 'x', 'y', 'blur', 'spread'];

// Every value a layer has that could come from a token but doesn't: [{ kind, path, value }].
function unboundValues(n) {
  const out = [];
  const bound = n.bindings || {};
  const free = (path) => !bound[path] && !n.propRefs?.[path];
  (n.fills || []).forEach((p, i) => {
    if (p.visible !== false && free(`fills.${i}.color`)) out.push({ kind: 'color', path: `fills.${i}.color`, value: joinColor(p.color, p.opacity ?? 1) });
  });
  if (n.strokeWidth > 0) {
    (n.strokes || []).forEach((p, i) => {
      if (p.visible !== false && free(`strokes.${i}.color`)) out.push({ kind: 'color', path: `strokes.${i}.color`, value: joinColor(p.color, p.opacity ?? 1) });
    });
  }
  (n.effects || []).forEach((e, i) => {
    if (e.visible === false || e.type === 'layer-blur' || !free(`effects.${i}`)) return;
    out.push({ kind: 'shadow', path: `effects.${i}`, value: { color: joinColor(e.color || '#000000', e.opacity ?? 1), x: e.x || 0, y: e.y || 0, blur: e.blur || 0, spread: e.spread || 0 } });
  });
  if (n.type === 'text' && free('typography')) {
    out.push({ kind: 'typography', path: 'typography', value: Object.fromEntries(TYPO_KEYS.map((k) => [k, n[k] ?? (k === 'lineHeight' ? null : 0)])) });
  }
  if (n.layout?.mode) {
    for (const path of PADDING) {
      // A gap only matters between two layers in the flow.
      if (path === 'layout.gap' && (n.layout.spacing === 'auto' || (n.children || []).filter((c) => c.visible && !c.absolute).length < 2)) continue;
      const v = n.layout[path.slice(7)];
      if (v > 0 && free(path)) out.push({ kind: 'spacing', path, value: v });
    }
  }
  if (n.radius > 0 && free('radius')) out.push({ kind: 'radius', path: 'radius', value: n.radius });
  return out;
}

// ---------- matching ----------
// Ids of tokens that some token points at (in any mode, override or composite field).
function referencedIds() {
  const ids = new Set();
  const add = (x) => {
    if (!x || typeof x !== 'object') return;
    if (typeof x.alias === 'string') ids.add(x.alias);
    else for (const f of Object.values(x)) if (f && typeof f === 'object' && typeof f.alias === 'string') ids.add(f.alias);
  };
  for (const { variable } of allVariables()) for (const x of Object.values(variable.valuesByMode || {})) add(x);
  return ids;
}

function toLab([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// How different two colors look (ΔE, 0 = the same), counting opacity too.
export function colorDistance(a, b) {
  const A = parseColor(a), B = parseColor(b);
  const la = toLab(A.rgb), lb = toLab(B.rgb);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]) + Math.abs(A.alpha - B.alpha) * 100;
}

const sameColor = (a, b) => joinColor(splitColor(a).hex, splitColor(a).alpha) === joinColor(splitColor(b).hex, splitColor(b).alpha);

// How far a token's value is from a layer's value (0 = exact), or Infinity when they can't compare.
function distance(kind, value, tokenValue) {
  if (tokenValue === undefined || tokenValue === null) return Infinity;
  if (kind === 'color') return sameColor(value, tokenValue) ? 0 : colorDistance(value, tokenValue);
  if (kind === 'spacing' || kind === 'radius') {
    const d = Math.abs(Number(tokenValue) - value);
    return Number.isFinite(d) ? d : Infinity;
  }
  if (kind === 'typography') {
    if (TYPO_KEYS.every((k) => (tokenValue[k] ?? null) === (value[k] ?? null) || Number(tokenValue[k]) === Number(value[k]))) return 0;
    return Math.abs((Number(tokenValue.fontSize) || 0) - value.fontSize) * 2 +
      (String(tokenValue.fontFamily) === String(value.fontFamily) ? 0 : 40) +
      Math.abs((Number(tokenValue.fontWeight) || 400) - value.fontWeight) / 25 +
      Math.abs((Number(tokenValue.lineHeight) || 120) - (value.lineHeight ?? 120)) / 10 +
      Math.abs((Number(tokenValue.letterSpacing) || 0) - (value.letterSpacing || 0));
  }
  if (kind === 'shadow') {
    const nums = ['x', 'y', 'blur', 'spread'].reduce((s, k) => s + Math.abs((Number(tokenValue[k]) || 0) - (value[k] || 0)), 0);
    const c = sameColor(value.color, tokenValue.color) ? 0 : colorDistance(value.color, tokenValue.color);
    return nums === 0 && c === 0 ? 0 : nums + c / 2;
  }
  return Infinity;
}

// The best token for a value, as layers in these modes would resolve it: { id, name, value, exact, distance }.
function suggest(kind, value, pick) {
  const type = AUDIT_KINDS[kind].type;
  let candidates = allVariables(type).filter(({ variable }) => !variable.deprecated);
  // Spacing and radius only look at well-named number tokens (space/…, radius/…) when there are some, so a
  // padding of 12 isn't matched to a font size or a column count.
  const hint = NAME_HINT[kind];
  if (hint && candidates.some(({ variable }) => hint.test(variable.name))) candidates = candidates.filter(({ variable }) => hint.test(variable.name));
  const scored = candidates.map(({ variable }) => {
    const tokenValue = resolveValue(variable.id, pick);
    return { id: variable.id, name: variable.name, value: tokenValue, distance: distance(kind, value, tokenValue) };
  }).filter((c) => c.distance < Infinity);
  if (!scored.length) return null;
  // Equally close tokens, by role: semantic tokens first (they point at another token and others point at
  // them, like surface/default), then primitives (color/gray/0), then component tokens (card/radius), which
  // are meant for their component.
  const referenced = referencedIds();
  const rank = (c) => (aliasDepth(c.id, pick) === 0 ? 1 : referenced.has(c.id) ? 0 : 2);
  const min = Math.min(...scored.map((c) => c.distance));
  const tied = scored.filter((c) => c.distance - min < 0.01);
  tied.sort((a, b) => rank(a) - rank(b));
  const best = tied[0];
  best.exact = best.distance < 0.01;
  best.others = tied.length - 1; // other tokens that match as well
  return best;
}

// ---------- the audit ----------
// { groups: [{ kind, value, modeKey, layers: [{ id, path }], suggestion }], deprecatedTokens: [{ id, name, layers }],
//   deprecatedComponents: [{ id, name, instances: [id] }], total }
export function auditDocument(doc = state.doc) {
  const groups = new Map();
  const deprecatedTokens = new Map();
  const deprecatedComponents = new Map();
  for (const pg of doc.pages) {
    walk(pg.children, (n) => {
      if (isInsideInstance(n)) return false; // comes from its main component
      for (const [path, varId] of Object.entries(n.bindings || {})) {
        const v = findVariable(varId)?.variable;
        if (!v?.deprecated) continue;
        if (!deprecatedTokens.has(varId)) deprecatedTokens.set(varId, { id: varId, name: v.name, layers: [] });
        deprecatedTokens.get(varId).layers.push({ id: n.id, path });
      }
      if (n.type === 'instance') {
        const main = mainComponentOf(n);
        if (main && isDeprecated(main)) {
          if (!deprecatedComponents.has(main.id)) deprecatedComponents.set(main.id, { id: main.id, name: main.name, instances: [] });
          deprecatedComponents.get(main.id).instances.push(n.id);
        }
        return; // an instance's own values come from its main component (overrides aside)
      }
      if (n.type === 'componentSet') return;
      const values = unboundValues(n);
      if (!values.length) return;
      const mode = modeContextOf(n);
      for (const { kind, path, value } of values) {
        const key = `${kind}|${JSON.stringify(value)}|${mode.key}`;
        if (!groups.has(key)) groups.set(key, { kind, value, modeKey: mode.key, pick: mode.pick, layers: [] });
        groups.get(key).layers.push({ id: n.id, path });
      }
    });
  }
  const list = [...groups.values()].map((g) => ({ ...g, suggestion: suggest(g.kind, g.value, g.pick) }));
  for (const g of list) delete g.pick;
  // Most-used values first within each kind.
  list.sort((a, b) => Object.keys(AUDIT_KINDS).indexOf(a.kind) - Object.keys(AUDIT_KINDS).indexOf(b.kind) || b.layers.length - a.layers.length);
  return {
    groups: list,
    deprecatedTokens: [...deprecatedTokens.values()],
    deprecatedComponents: [...deprecatedComponents.values()],
    total: list.reduce((s, g) => s + g.layers.length, 0),
  };
}

// Bind the layers' properties to a token (the value becomes the token's, in each layer's modes).
export function applyToken(layers, varId) {
  let n = 0;
  for (const { id, path } of layers) {
    const node = getNode(id);
    if (!node) continue;
    editNode(node, ['bindings'], () => bindVariable(node, path, varId));
    n++;
  }
  return n;
}

// The pages the layers are on, in page order.
export const pagesOf = (layers) => [...new Set(layers.map(({ id }) => pageOf(id)).filter(Boolean))];
