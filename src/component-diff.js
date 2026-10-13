// Design to code for components (Part E, Phase 30). Pure, no DOM.
//
// componentDiff(before, after, ctx) compares two versions of a library component (or component set), as saved
// in a project file, and plans the code change:
//   - structured changes become exact edits: a value the CSS sets on the component's root (background,
//     padding, gap, radius, opacity, shadow, border, and the text color and font its layers inherit) is set
//     in the rule for that component, variant value or state (found through the captures' manifest `match`
//     selectors); a new variant value gets its own rule (and selector, following its siblings'); a changed
//     property default is edited where the code declares it.
//   - everything else (layers added, removed or moved, child layers' sizes and spacing) is listed for the
//     agent, as a design diff, with the component's source.
import { DEFAULT_LAYOUT } from './layout.js';
import { parseVariantName, formatVariantName } from './components.js';

const STATE_PSEUDO = { Hover: ':hover', Focus: ':focus-visible', Pressed: ':active', Active: ':active', Disabled: ':disabled' };
const px = (n) => `${Math.round(n * 100) / 100}px`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

const variantsOf = (n) => (!n ? [] : n.type === 'componentSet' ? n.children || [] : [n]);
const shorthand = (v) => (v[0] === v[2] && v[1] === v[3] ? (v[0] === v[1] ? v[0] : `${v[0]} ${v[1]}`) : v[1] === v[3] ? `${v[0]} ${v[1]} ${v[2]}` : v.join(' '));

// The CSS a component's root is written with, as Sigma has it: { property: value text }.
export function rootCSS(node, codeOf) {
  const b = node.bindings || {};
  const val = (key, literal) => (b[key] && codeOf(b[key]) ? `var(${codeOf(b[key])})` : literal);
  const css = {};
  const fill = (node.fills || []).find((f) => f.visible !== false);
  css.background = fill ? val('fills.0.color', fill.color || 'transparent') : 'transparent';
  const stroke = (node.strokes || []).find((s) => s.visible !== false);
  const sw = stroke ? node.strokeWidth ?? 1 : 0;
  const inside = stroke && (node.strokeAlign || 'inside') === 'inside';
  if (stroke && node.strokeAlign === 'outside') {
    css.outline = `${px(sw)} solid ${val('strokes.0.color', stroke.color)}`;
  } else if (stroke) {
    css['border-width'] = px(sw);
    css['border-color'] = val('strokes.0.color', stroke.color);
  }
  if (node.radii) css['border-radius'] = node.radii.map(px).join(' ');
  else css['border-radius'] = val('radius', px(node.radius || 0));
  if (node.layout) {
    const L = { ...DEFAULT_LAYOUT, ...node.layout };
    const sides = ['pt', 'pr', 'pb', 'pl'].map((k, i) => {
      const side = ['top', 'right', 'bottom', 'left'][i];
      const border = inside && node.strokeSides?.[side] !== false ? sw : 0;
      // An inside stroke is a CSS border, which sits outside the padding.
      return border ? px(L[k] - border) : val(`layout.${k}`, px(L[k]));
    });
    css.padding = shorthand(sides);
    css.gap = L.spacing === 'auto' ? 'auto' : val('layout.gap', px(L.gap));
  }
  css.opacity = val('opacity', String(node.opacity ?? 1));
  const shadow = (node.effects || []).find((e) => e.type === 'drop-shadow' && e.visible !== false);
  css['box-shadow'] = shadow ? val('effects.0', `${px(shadow.x || 0)} ${px(shadow.y || 0)} ${px(shadow.blur || 0)} ${px(shadow.spread || 0)} ${shadow.color}`) : 'none';
  // Text and icons inside take their color (and text its font) from the root, when they all agree.
  const inherited = { color: new Set(), 'font-size': new Set(), 'font-weight': new Set() };
  const visit = (n) => {
    for (const c of n.children || []) {
      if (c.type === 'instance') continue;
      if (c.type === 'text' || c.type === 'icon') {
        const cb = c.bindings || {};
        const cv = (key, literal) => (cb[key] && codeOf(cb[key]) ? `var(${codeOf(cb[key])})` : literal);
        inherited.color.add(cv('fills.0.color', c.fills?.[0]?.color || '#000000'));
        if (c.type === 'text') {
          inherited['font-size'].add(cv('fontSize', px(c.fontSize ?? 16)));
          inherited['font-weight'].add(cv('fontWeight', String(c.fontWeight ?? 400)));
        }
      }
      visit(c);
    }
  };
  visit(node);
  for (const [k, set] of Object.entries(inherited)) if (set.size === 1) css[k] = [...set][0];
  return css;
}

// What a node is, apart from what rootCSS covers: for spotting visual changes.
const ROOT_COVERED = ['fills', 'strokes', 'strokeWidth', 'strokeAlign', 'strokeSides', 'radius', 'radii', 'opacity', 'effects', 'bindings', 'layout'];
// About the component, not how it looks: never a change to its code.
const META = ['docs', 'status', 'checks', 'description', 'codeName', 'codeNames', 'deprecated'];
function shape(node, { root = false } = {}) {
  const { id, children, name, propRefs, ...rest } = node;
  for (const k of META) delete rest[k];
  if (root) {
    for (const k of ROOT_COVERED) delete rest[k];
    delete rest.x; // where it sits on the canvas isn't part of the code
    delete rest.y;
    if (node.layout) rest.layout = { mode: node.layout.mode, alignP: node.layout.alignP, alignC: node.layout.alignC, spacing: node.layout.spacing, ...(node.layout.breakpoints ? { breakpoints: node.layout.breakpoints } : {}) };
  } else if (node.type === 'text' || node.type === 'icon') {
    delete rest.fills;
    delete rest.fontSize;
    delete rest.fontWeight;
    if (rest.bindings) {
      const { 'fills.0.color': _c, fontSize: _s, fontWeight: _w, ...b } = rest.bindings;
      if (Object.keys(b).length) rest.bindings = b;
      else delete rest.bindings;
    }
  }
  for (const k of ['type', 'text', 'iconId', 'componentId', 'propValues', 'visible']) if (k in rest && rest[k] === undefined) delete rest[k];
  return rest;
}
const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => stable(a[k]) !== stable(b[k]));

// Layers by path below a component's root: Map(path → node).
function layers(root) {
  const out = new Map();
  const visit = (n, trail) => (n.children || []).forEach((c) => {
    const path = [...trail, c.name ?? c.type].join(' / ');
    out.set(path, c);
    if (c.type !== 'instance') visit(c, [...trail, c.name]);
  });
  visit(root, []);
  return out;
}

/**
 * before, after: the component (or set) as saved in the library file (null when added or removed).
 * ctx = { entry (the manifest's component: match, props, variantCodeNames, source, captures),
 *         codeOf(tokenId) → '--code-name' | null, source: the component's code text (optional) }
 * Returns { name, selector, css: [{ selector, prop, value, why }], code: [{ file, find, replace, why }],
 *           manifest: { variants: { Prop: { Value: selector } }, captures: [...] }, agent: [text], diff: [text] }
 */
export function componentDiff(before, after, { entry = {}, codeOf = () => null, source = null } = {}) {
  const name = (after || before)?.name || entry.name;
  const base = entry.match?.selector || null;
  const out = { name, selector: base, css: [], code: [], manifest: { variants: {}, captures: [] }, agent: [], diff: [] };
  if (!before || !after) {
    out.diff.push(`${name}: ${before ? 'removed' : 'added'}`);
    out.agent.push(before ? `${name} was removed from the library: remove it from the code only if nothing uses it (search for it first).`
      : `${name} is new: write it in the code (${entry.source ? `next to ${entry.source}` : 'with the other components'}), then capture it and add it to the manifest.`);
    return out;
  }
  const vb = variantsOf(before), va = variantsOf(after);
  const isSet = after.type === 'componentSet';
  const valuesOf = (v) => (isSet ? parseVariantName(v.name) : {});
  const vprops = [...new Set(va.flatMap((v) => Object.keys(valuesOf(v))))];
  // A property's default value: the one the manifest maps to "*", else the first variant's.
  const defaults = Object.fromEntries(vprops.map((p) => {
    const star = Object.entries(entry.match?.variants?.[p] || {}).find(([, s]) => s === '*')?.[0];
    return [p, star ?? (p === 'State' && va.some((v) => valuesOf(v).State === 'Default') ? 'Default' : valuesOf(va[0])[p])];
  }));
  const knownValues = Object.fromEntries(vprops.map((p) => [p, new Set(vb.map((v) => valuesOf(v)[p]))]));

  // Selectors: a variant value's, then a combination's.
  const newSelectors = {};
  const valueSelector = (p, value) => {
    if (value === defaults[p]) return '';
    const known = entry.match?.variants?.[p]?.[value] ?? newSelectors[p]?.[value];
    if (known && known !== '*') return known;
    if (STATE_PSEUDO[value] && (p === 'State' || !knownValues[p].has(value))) return STATE_PSEUDO[value];
    if (!base) return null;
    // Like its siblings: .button--danger → .button--secondary.
    const sib = Object.entries(entry.match?.variants?.[p] || {}).find(([v, s]) => s !== '*' && !s.startsWith(':') && s.toLowerCase().includes(slug(v)));
    const sel = sib ? sib[1].replace(new RegExp(slug(sib[0]), 'i'), slug(value)) : `${base}--${slug(value)}`;
    (newSelectors[p] ||= {})[value] = sel;
    return sel;
  };
  const selectorOf = (values) => {
    const parts = vprops.map((p) => valueSelector(p, values[p]));
    if (parts.some((s) => s === null)) return null;
    const classes = parts.filter((s) => s && !s.startsWith(':'));
    const pseudos = parts.filter((s) => s && s.startsWith(':'));
    return `${classes.length ? classes.join('') : base}${pseudos.join('')}`;
  };

  // 1. Variants added and removed.
  const byName = (list) => new Map(list.map((v) => [v.name, v]));
  const bMap = byName(vb), aMap = byName(va);
  const added = va.filter((v) => !bMap.has(v.name));
  const removed = vb.filter((v) => !aMap.has(v.name));
  for (const v of removed) {
    out.diff.push(`${name} / ${v.name}: removed`);
    out.agent.push(`${name}: the variant ${v.name} was removed: remove what only it uses (its CSS rule, its option in the code) if nothing else needs it.`);
  }

  // 2. Changes to variants in both: root CSS values (structured) and everything else (visual).
  const changes = []; // { variant, prop, before, after }
  const firstVisual = out.diff.length;
  for (const v of va) {
    const old = bMap.get(v.name);
    if (!old) continue;
    const ca = rootCSS(v, codeOf), cb = rootCSS(old, codeOf);
    for (const prop of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
      if ((ca[prop] ?? null) !== (cb[prop] ?? null)) changes.push({ variant: v, prop, before: cb[prop] ?? null, after: ca[prop] ?? null });
    }
    const label = isSet ? `${name} / ${v.name}` : name;
    for (const k of changedKeys(shape(old, { root: true }), shape(v, { root: true }))) out.diff.push(`${label}: ${k} ${JSON.stringify(old[k])} → ${JSON.stringify(v[k])}`);
    const lb = layers(old), la = layers(v);
    const orderB = [...lb.keys()], orderA = [...la.keys()];
    for (const [path, n] of la) {
      const o = lb.get(path);
      if (!o) {
        out.diff.push(`${label} / ${path}: added (${n.type}${n.text ? ` “${n.text}”` : ''})`);
        continue;
      }
      const keys = changedKeys(shape(o), shape(n));
      for (const k of keys) out.diff.push(`${label} / ${path}: ${k} ${JSON.stringify(o[k])} → ${JSON.stringify(n[k])}`);
    }
    for (const path of lb.keys()) if (!la.has(path)) out.diff.push(`${label} / ${path}: removed`);
    const common = orderA.filter((p) => lb.has(p));
    if (stable(common) !== stable(orderB.filter((p) => la.has(p)))) out.diff.push(`${label}: layers reordered (${common.join(', ')})`);
  }
  const visual = out.diff.slice(firstVisual);

  // Group each CSS change by what it became; edit the rule that covers exactly the variants it changed in.
  const groups = new Map();
  for (const c of changes) {
    const key = `${c.prop}\u0000${c.after}`;
    if (!groups.has(key)) groups.set(key, { prop: c.prop, after: c.after, before: c.before, variants: [] });
    groups.get(key).variants.push(c.variant);
  }
  const existing = va.filter((v) => bMap.has(v.name));
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  for (const g of groups.values()) {
    const where = `${g.prop}: ${g.before ?? '(none)'} → ${g.after ?? '(none)'}`;
    let targets = [];
    if (sameSet(g.variants, existing)) targets = [base];
    else {
      for (const p of vprops) {
        for (const value of new Set(existing.map((v) => valuesOf(v)[p]))) {
          const vs = existing.filter((v) => valuesOf(v)[p] === value);
          if (!targets.length && sameSet(vs, g.variants)) targets = [selectorOf({ ...defaults, [p]: value })];
        }
      }
      if (!targets.length) targets = g.variants.map((v) => selectorOf(valuesOf(v)));
    }
    const label = sameSet(g.variants, existing) ? name : g.variants.map((v) => `${name} / ${v.name}`).join(', ');
    out.diff.push(`${label}: ${where}`);
    if (targets.some((t) => !t)) {
      out.agent.push(`${label}: ${where} — no CSS selector for it in the manifest's match rules; make the change in the code.`);
      continue;
    }
    if (g.after === null) {
      for (const t of targets) out.css.push({ selector: t, prop: g.prop, value: null, why: `${label}: ${where}` });
      continue;
    }
    for (const t of targets) out.css.push({ selector: t, prop: g.prop, value: g.after, why: `${label}: ${where}` });
  }

  // 3. New variant values: a rule for each, with what differs from what the cascade would give anyway.
  if (added.length) {
    const refOf = (values) => va.find((v) => stable(valuesOf(v)) === stable(values));
    for (const v of added) {
      const values = valuesOf(v);
      out.diff.push(`${name} / ${v.name}: added`);
      const newProps = vprops.filter((p) => !knownValues[p].has(values[p]));
      if (!newProps.length) {
        out.agent.push(`${name}: the variant ${v.name} is new (its values exist on other variants): check the code shows it; capture it and add it to the manifest.`);
        continue;
      }
      const sel = selectorOf(values);
      if (!sel) {
        out.agent.push(`${name}: the variant ${v.name} is new and there's no selector to write it with; write it in the code.`);
        continue;
      }
      // Without its own rule it would look like: the default value's variant with the same other values,
      // plus the new value's own rule where the other values don't override it.
      const withDefaults = (vals) => Object.fromEntries(vprops.map((p) => [p, newProps.includes(p) ? defaults[p] : vals[p]]));
      const ref = refOf(withDefaults(values));
      const plain = refOf(Object.fromEntries(vprops.map((p) => [p, newProps.includes(p) ? values[p] : defaults[p]])));
      const refPlain = refOf(defaults);
      if (!ref || !refPlain) {
        out.agent.push(`${name}: the variant ${v.name} is new; write its styles in the code (no variant to compare it with).`);
        continue;
      }
      const css = rootCSS(v, codeOf), refCSS = rootCSS(ref, codeOf), plainCSS = plain ? rootCSS(plain, codeOf) : null, rpCSS = rootCSS(refPlain, codeOf);
      const isPlain = v === plain;
      for (const prop of Object.keys(css)) {
        // What applies already: the reference's value, unless this value's own rule sets it (and the other
        // values' rules don't override it).
        let cascade = refCSS[prop];
        if (!isPlain && plainCSS && plainCSS[prop] !== rpCSS[prop] && refCSS[prop] === rpCSS[prop]) cascade = plainCSS[prop];
        if (css[prop] !== cascade && css[prop] !== undefined) out.css.push({ selector: sel, prop, value: css[prop], why: `${name} / ${v.name} is new: ${prop} ${css[prop]}` });
      }
      for (const p of newProps) {
        const s = newSelectors[p]?.[values[p]] || entry.match?.variants?.[p]?.[values[p]];
        if (s) (out.manifest.variants[p] ||= {})[values[p]] = s;
      }
      const file = `${slug(name)}-${Object.values(values).map(slug).join('-')}.json`;
      const sibling = (entry.captures || []).find((c) => stable(withDefaults(c.variant || {})) === stable(withDefaults(values)));
      out.manifest.captures.push({ variant: values, file, ...(sibling?.element ? { element: sibling.element.replace(new RegExp(slug(defaults[newProps[0]] || ''), 'i'), slug(values[newProps[0]])) } : {}) });
      const codeName = entry.variantCodeNames?.[newProps[0]] || slug(newProps[0]);
      if (newProps.some((p) => p !== 'State')) {
        out.agent.push(`${name}: ${newProps.map((p) => `${p}=${values[p]}`).join(', ')} is new: the code needs \`${codeName}\` = '${slug(values[newProps[0]])}' to give the element ${sel.match(/^[.#][\w-]+/)?.[0] || sel} (its CSS is written). Render it for capturing as well (the manifest names the element).`);
      }
    }
    const uniq = new Set();
    out.agent = out.agent.filter((t) => (uniq.has(t) ? false : uniq.add(t)));
  }

  // 4. Component properties: defaults edited where the code declares them; the rest for the agent.
  const pb = before.props || {}, pa = after.props || {};
  const codeNameOf = (id, p) => (entry.props || []).find((x) => x.name === p.name)?.codeName || p.codeName || null;
  for (const id of new Set([...Object.keys(pb), ...Object.keys(pa)])) {
    const x = pb[id], y = pa[id];
    if (stable(x) === stable(y)) continue;
    if (!x || !y) {
      out.diff.push(`${name}: property ${(x || y).name} ${x ? 'removed' : 'added'}`);
      out.agent.push(`${name}: the ${(x || y).type} property ${(x || y).name} was ${x ? 'removed' : 'added'}: ${x ? 'remove that prop from' : 'add it as a prop of'} the code component${y?.codeName ? ` (\`${y.codeName}\`)` : ''}.`);
      continue;
    }
    if (stable(x.default) !== stable(y.default)) {
      const cn = codeNameOf(id, y);
      out.diff.push(`${name}: ${y.name} defaults to ${JSON.stringify(y.default)} (was ${JSON.stringify(x.default)})`);
      const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = cn && typeof x.default !== 'object' ? new RegExp(`(\\b${esc(cn)}\\s*=\\s*)(['"\`]?)${esc(x.default)}\\2`, 'g') : null;
      const hits = re && source ? [...source.matchAll(re)] : [];
      if (hits.length === 1 && entry.source) {
        const q = hits[0][2];
        out.code.push({ file: entry.source, find: hits[0][0], replace: `${hits[0][1]}${q}${typeof y.default === 'string' ? y.default : JSON.stringify(y.default)}${q}`, why: `${name}: ${y.name} defaults to ${JSON.stringify(y.default)}` });
      } else out.agent.push(`${name}: the default of ${y.name}${cn ? ` (\`${cn}\`)` : ''} changed from ${JSON.stringify(x.default)} to ${JSON.stringify(y.default)}: change it where the code declares it.`);
    }
    if (x.name !== y.name) out.diff.push(`${name}: property ${x.name} is now called ${y.name} (the code name stays ${y.codeName || 'as it is'})`);
  }
  if (visual.length) {
    out.agent.unshift(`${name}: ${visual.length} visual change${visual.length === 1 ? '' : 's'} the tool doesn't write (in the design diff, before the CSS changes): change ${entry.source || 'the component’s code'} to match, then capture and compare.`);
  }
  return out;
}

// The plan as text for people and agents.
export function formatComponentDiff(d) {
  const lines = [`${d.name}${d.selector ? ` (${d.selector})` : ''}`];
  if (d.diff.length) lines.push('  Design diff:', ...d.diff.map((l) => `    ${l}`));
  if (d.css.length) lines.push('  CSS:', ...d.css.map((e) => `    ${e.selector} { ${e.prop}: ${e.value ?? '(remove)'} }`));
  if (d.code.length) lines.push('  Code:', ...d.code.map((e) => `    ${e.file}: ${e.find} → ${e.replace}`));
  const mv = Object.entries(d.manifest.variants);
  if (mv.length || d.manifest.captures.length) lines.push('  Manifest:', ...mv.flatMap(([p, vals]) => Object.entries(vals).map(([v, s]) => `    match.variants.${p}.${v} = ${s}`)), ...d.manifest.captures.map((c) => `    capture ${formatVariantName(c.variant)} → ${c.file}`));
  if (d.agent.length) lines.push('  For the agent:', ...d.agent.map((a) => `    - ${a}`));
  return lines.join('\n');
}
