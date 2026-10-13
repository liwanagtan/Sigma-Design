// The Inspect panel (code handoff): for the selected layer, its CSS with tokens as their code names, the
// tokens it uses with their values in its modes, and for components their code: how an instance is
// written (<Button variant="primary" label="Save" />) and the component's API, with editable code names.
import { getParent, isFrameLike } from './store.js';
import { findVariable, resolveValue, modeContextOf, splitColor, joinColor } from './variables.js';
import { propsOf, mainComponentOf, parseVariantName, variantDefs, isInsideInstance } from './components.js';
import { getSizing, isAutoLayout } from './layout.js';
import { cornerRadii, strokeSides } from './render.js';
import { findIcon } from './icon-library.js';
import { docsHTML } from './component-docs.js';
import { a11yOf, roleOf, a11yCode, ROLES } from './a11y.js';
import {
  cssVar, cssVarName, tokenCode, PLATFORMS, componentCode, propCode, variantPropCode, variantValueCode, defaultComponentCode, defaultPropCode,
} from './code-names.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const px = (n) => (Math.round(n * 100) / 100 === 0 ? '0' : `${Math.round(n * 100) / 100}px`);
const color = (hex, opacity = 1) => {
  const { hex: h, alpha } = splitColor(hex);
  const a = alpha * opacity;
  return (a < 1 ? joinColor(h, a) : h).toLowerCase();
};

// [[property, value]] for one layer. A value that comes from a token is written as the token's variable.
export function layerCSS(n) {
  const b = n.bindings || {};
  const tok = (path, fallback) => {
    const v = b[path] && findVariable(b[path])?.variable;
    return v ? cssVar(v) : fallback;
  };
  const out = [];
  const add = (k, v) => v !== null && v !== undefined && v !== '' && out.push([k, v]);
  if (!n.visible) add('display', 'none');
  // Size
  const parent = getParent(n.id);
  for (const [axis, prop] of [['w', 'width'], ['h', 'height']]) {
    const sizing = getSizing(n, axis);
    if (sizing === 'hug') add(prop, 'fit-content');
    else if (sizing === 'fill') {
      if (isAutoLayout(parent) && (parent.layout.mode === 'horizontal') === (axis === 'w')) add('flex', '1 1 0');
      else add('align-self', 'stretch');
    } else if (!(n.type === 'line' && axis === 'h')) add(prop, tok(axis, px(n[axis])));
  }
  for (const [k, prop] of [['minW', 'min-width'], ['maxW', 'max-width'], ['minH', 'min-height'], ['maxH', 'max-height']]) {
    if (n[k] !== undefined && n[k] !== null) add(prop, tok(k, px(n[k])));
  }
  // Auto layout
  if (isAutoLayout(n)) {
    const L = n.layout;
    add('display', 'flex');
    add('flex-direction', L.mode === 'horizontal' ? 'row' : 'column');
    if (L.spacing !== 'auto') add('gap', tok('layout.gap', px(L.gap)));
    const pads = ['pt', 'pr', 'pb', 'pl'].map((k) => tok(`layout.${k}`, px(L[k] || 0)));
    if (pads.some((p) => p !== '0')) add('padding', pads[0] === pads[2] && pads[1] === pads[3] ? (pads[0] === pads[1] ? pads[0] : `${pads[0]} ${pads[1]}`) : pads.join(' '));
    const align = { start: 'flex-start', center: 'center', end: 'flex-end' };
    add('justify-content', L.spacing === 'auto' ? 'space-between' : align[L.alignP] || 'flex-start');
    add('align-items', align[L.alignC] || 'flex-start');
  }
  if (n.absolute && isAutoLayout(parent)) add('position', 'absolute');
  // Corners
  if (isFrameLike(n) || n.type === 'rect' || n.type === 'image') {
    if (Array.isArray(n.radii)) add('border-radius', cornerRadii(n).map((r, i) => tok(`radii.${i}`, px(r))).join(' '));
    else if (n.radius > 0 || b.radius) add('border-radius', tok('radius', px(n.radius)));
  }
  if (n.type === 'ellipse') add('border-radius', '50%');
  // Fills: the color of text and icons, the background of everything else.
  const fills = (n.fills || []).map((p, i) => ({ p, i })).filter(({ p }) => p.visible !== false);
  const paint = ({ p, i }, kind = 'fills') => tok(`${kind}.${i}.color`, color(p.color, p.opacity ?? 1));
  if (n.type === 'text' || n.type === 'icon') {
    if (fills.length) add('color', paint(fills[fills.length - 1]));
  } else if (fills.length === 1) add('background', paint(fills[0]));
  else if (fills.length > 1) add('background', fills.slice().reverse().map((f, k) => (k < fills.length - 1 ? `linear-gradient(${paint(f)}, ${paint(f)})` : paint(f))).join(', '));
  // Strokes
  const strokes = (n.strokes || []).map((p, i) => ({ p, i })).filter(({ p }) => p.visible !== false);
  if (strokes.length && n.strokeWidth > 0 && n.type !== 'text') {
    const w = tok('strokeWidth', px(n.strokeWidth));
    const c = paint(strokes[strokes.length - 1], 'strokes');
    if (n.type === 'line') add('border-top', `${w} solid ${c}`);
    else if ((n.strokeAlign || 'inside') === 'outside') add('outline', `${w} solid ${c}`);
    else {
      const sides = strokeSides(n);
      const on = Object.entries(sides).filter(([, x]) => x).map(([s]) => s);
      if (on.length === 4) add('border', `${w} solid ${c}`);
      else for (const s of on) add(`border-${s}`, `${w} solid ${c}`);
      if ((n.strokeAlign || 'inside') === 'inside') add('box-sizing', 'border-box');
    }
  }
  // Effects
  const shadows = [];
  (n.effects || []).forEach((e, i) => {
    if (e.visible === false) return;
    if (e.type === 'layer-blur') return add('filter', `blur(${px(e.blur)})`);
    const v = b[`effects.${i}`] && findVariable(b[`effects.${i}`])?.variable;
    shadows.push(v ? cssVar(v) : `${e.type === 'inner-shadow' ? 'inset ' : ''}${px(e.x || 0)} ${px(e.y || 0)} ${px(e.blur || 0)} ${px(e.spread || 0)} ${color(e.color || '#000000', e.opacity ?? 1)}`);
  });
  if (shadows.length) add('box-shadow', shadows.join(', '));
  if (n.opacity < 1) add('opacity', tok('opacity', String(Math.round(n.opacity * 100) / 100)));
  // Text
  if (n.type === 'text') {
    const typo = b.typography && findVariable(b.typography)?.variable;
    if (typo) {
      add('font', cssVar(typo));
      add('letter-spacing', `var(${cssVarName(typo)}-letter-spacing)`);
    } else {
      add('font-family', tok('fontFamily', `"${n.fontFamily}", sans-serif`));
      add('font-size', tok('fontSize', px(n.fontSize)));
      add('font-weight', tok('fontWeight', String(n.fontWeight)));
      add('line-height', tok('lineHeight', n.lineHeight === null || n.lineHeight === undefined ? 'normal' : String(Math.round(n.lineHeight) / 100)));
      if (n.letterSpacing) add('letter-spacing', tok('letterSpacing', px(n.letterSpacing)));
    }
    if (n.textAlign && n.textAlign !== 'left') add('text-align', n.textAlign);
    if (n.textCase) add('text-transform', { upper: 'uppercase', lower: 'lowercase', title: 'capitalize' }[n.textCase]);
    if (n.truncate) {
      if ((n.maxLines || 1) === 1) add('white-space', 'nowrap'), add('overflow', 'hidden'), add('text-overflow', 'ellipsis');
      else add('display', '-webkit-box'), add('-webkit-line-clamp', String(n.maxLines)), add('-webkit-box-orient', 'vertical'), add('overflow', 'hidden');
    }
  }
  if (n.clip && isFrameLike(n)) add('overflow', 'hidden');
  return out;
}

// The tokens a layer uses: [{ path, variable, value }], value in the layer's modes.
export function layerTokens(n) {
  const { pick } = modeContextOf(n);
  return Object.entries(n.bindings || {}).map(([path, id]) => {
    const v = findVariable(id)?.variable;
    return v ? { path, variable: v, value: resolveValue(id, pick) } : null;
  }).filter(Boolean);
}

// How an instance is written in code: <Button variant="primary" label="Save" />. Variant properties are
// always written; other properties only when they differ from the default.
export function instanceUsage(inst) {
  const main = mainComponentOf(inst);
  if (!main) return null;
  const set = getParent(main.id)?.type === 'componentSet' ? getParent(main.id) : null;
  const host = set || main;
  const attrs = [];
  if (set) for (const [prop, value] of Object.entries(parseVariantName(main.name))) attrs.push(`${variantPropCode(set, prop)}="${variantValueCode(value)}"`);
  for (const [pid, def] of Object.entries(propsOf(main))) {
    const v = inst.propValues?.[pid];
    if (v === undefined || JSON.stringify(v) === JSON.stringify(def.default) || def.type === 'slot') continue;
    const name = propCode(def);
    if (def.type === 'boolean') attrs.push(v ? name : `${name}={false}`);
    else if (def.type === 'text') attrs.push(`${name}="${String(v).replace(/"/g, '&quot;')}"`);
    else if (def.type === 'instance') {
      const target = mainComponentOf({ componentId: v });
      attrs.push(`${name}={<${target ? componentCode(getParent(target.id)?.type === 'componentSet' ? getParent(target.id) : target) : 'Component'} />}`);
    } else if (def.type === 'icon') attrs.push(`${name}="${findIcon(v)?.name || v}"`);
  }
  const tag = componentCode(host);
  const one = `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''} />`;
  return one.length <= 72 ? one : `<${tag}\n${attrs.map((a) => `  ${a}`).join('\n')}\n/>`;
}

// A component's API: its code name and each property's, with the values it takes.
function componentAPI(host) {
  const rows = [];
  if (host.type === 'componentSet') {
    for (const [prop, values] of Object.entries(variantDefs(host))) {
      rows.push({ kind: 'variant', key: prop, label: prop, code: variantPropCode(host, prop), placeholder: defaultPropCode(prop), type: values.map((v) => `"${variantValueCode(v)}"`).join(' | ') });
    }
  }
  for (const [pid, def] of Object.entries(host.props || {})) {
    const type = { boolean: 'boolean', text: 'string', instance: 'ReactNode', icon: 'IconName', slot: 'ReactNode' }[def.type] || def.type;
    rows.push({ kind: 'prop', key: pid, label: def.name, code: propCode(def), placeholder: defaultPropCode(def.name), type });
  }
  return rows;
}

// ---------- the panel ----------
const block = (title, body, copy) => `<div class="section inspect-section"><div class="section-title"><span>${title}</span>` +
  `${copy ? `<button class="icon-btn inspect-copy" data-copy="${esc(copy)}" title="Copy">${COPY_ICON}</button>` : ''}</div>${body}</div>`;
const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><rect x="4.5" y="4.5" width="7" height="7" rx="1"/><path d="M9.5 4.5v-2a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2"/></svg>';

// Accessibility annotations (Phase 16): what the layer is to assistive technology. An instance shows its main
// component's as placeholders; what's typed here is the instance's own.
function a11yBlock(n) {
  const own = n.a11y || {};
  const all = a11yOf(n);
  const inherited = (k) => (own[k] === undefined && all[k] !== undefined ? all[k] : '');
  const field = (label, html) => `<label class="code-name-row a11y-row"><span class="muted">${label}</span>${html}</label>`;
  const input = (k, ph = '') => `<input class="prop-input" data-a11y="${k}" data-node="${esc(n.id)}" value="${esc(own[k] ?? '')}" placeholder="${esc(inherited(k) || ph)}" spellcheck="${k === 'focus' ? 'false' : 'true'}"${k === 'focus' ? ' inputmode="numeric"' : ''}>`;
  const role = roleOf(n);
  const rows = [];
  if (n.type === 'image' || n.type === 'icon' || own.decorative || all.decorative) {
    rows.push(field('Decorative', `<input type="checkbox" data-a11y="decorative" data-node="${esc(n.id)}" ${all.decorative ? 'checked' : ''}>`));
  }
  if (n.type === 'image' && !all.decorative) rows.push(field('Alt text', input('alt', 'What the image shows')));
  if (n.type === 'text') {
    rows.push(field('Heading', `<select class="prop-input" data-a11y="heading" data-node="${esc(n.id)}"><option value="">Not a heading</option>${[1, 2, 3, 4, 5, 6].map((l) => `<option value="${l}" ${all.heading === l ? 'selected' : ''}>Heading ${l} (h${l})</option>`).join('')}</select>`));
  }
  if (n.type !== 'text' && n.type !== 'image') {
    const auto = !own.role && role ? `${ROLES[role] || role} (auto)` : 'Automatic';
    rows.push(field('Role', `<select class="prop-input" data-a11y="role" data-node="${esc(n.id)}"><option value="">${esc(auto)}</option>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${own.role === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`));
    rows.push(field('Label', input('label', role && role !== 'none' ? 'From its text' : 'Accessible name')));
  }
  rows.push(field('Focus order', input('focus', '—')));
  const code = a11yCode(n);
  return block('Accessibility', rows.join('') + (code.length ? `<pre class="inspect-code">${esc(code.join('\n'))}</pre>` : '') +
    '<button class="btn wide" data-a11y-check>Check accessibility…</button>', code.join('\n') || undefined);
}

function valueText(type, value) {
  if (value === undefined || value === null) return '—';
  if (type === 'color') return color(value);
  if (typeof value === 'object') return Object.entries(value).map(([k, x]) => `${k} ${typeof x === 'object' ? '…' : x}`).join(', ');
  return String(value);
}

export function inspectHTML(nodes) {
  if (!nodes.length) {
    return '<div class="section"><div class="muted inspect-empty">Select a layer to see its CSS, the design tokens it uses and, for components, their code.</div></div>';
  }
  if (nodes.length > 1) return '<div class="section"><div class="muted inspect-empty">Select one layer to inspect it.</div></div>';
  const n = nodes[0];
  let html = '';
  const comp = n.type === 'component' ? (getParent(n.id)?.type === 'componentSet' ? getParent(n.id) : n) : n.type === 'componentSet' ? n : null;
  if (comp && !isInsideInstance(n)) {
    const rows = componentAPI(comp);
    html += block('Component', `<label class="code-name-row"><span class="muted">Code name</span><input class="prop-input" data-code-component="${comp.id}" value="${esc(comp.codeName || '')}" placeholder="${esc(defaultComponentCode(comp.name))}" spellcheck="false"></label>` +
      (rows.length ? '<div class="inspect-props">' + rows.map((r) => `<label class="code-name-row" title="${esc(r.label)}"><span class="muted">${esc(r.label)}</span>` +
        `<input class="prop-input" data-code-${r.kind}="${esc(r.key)}" data-host="${comp.id}" value="${esc(r.code === r.placeholder ? '' : r.code)}" placeholder="${esc(r.placeholder)}" spellcheck="false"><code class="inspect-type">${esc(r.type)}</code></label>`).join('') + '</div>'
        : '<div class="muted">No properties.</div>'));
  }
  if (n.type === 'instance' && !isInsideInstance(n)) {
    const usage = instanceUsage(n);
    if (usage) html += block('Code', `<pre class="inspect-code">${esc(usage)}</pre>`, usage);
    const main = mainComponentOf(n);
    const docs = main ? docsHTML(main) : '';
    if (docs) html += block('Component docs', docs);
  } else if (comp && !isInsideInstance(n)) {
    const docs = docsHTML(comp);
    if (docs) html += block('Component docs', docs);
  }
  html += a11yBlock(n);
  const css = layerCSS(n);
  const cssText = css.map(([k, v]) => `${k}: ${v};`).join('\n');
  html += block(`CSS <span class="muted">${esc(n.name)}</span>`, css.length ? `<pre class="inspect-code">${esc(cssText)}</pre>` : '<div class="muted">Nothing to style.</div>', cssText);
  const tokens = layerTokens(n);
  if (tokens.length) {
    const seen = new Set();
    const list = tokens.filter((t) => !seen.has(t.variable.id) && seen.add(t.variable.id));
    html += block('Design tokens', '<div class="inspect-tokens">' + list.map(({ variable: v, value }) => `<div class="inspect-token">
      <div class="inspect-token-head"><b>${esc(v.name)}</b><span class="muted">${esc(valueText(v.type, value))}</span></div>
      ${Object.keys(PLATFORMS).map((p) => `<div class="inspect-token-code"><span class="muted">${PLATFORMS[p]}</span><code>${esc(tokenCode(v, p))}</code></div>`).join('')}
    </div>`).join('') + '</div>', list.map(({ variable: v, value }) => `${tokenCode(v)}: ${valueText(v.type, value)}`).join('\n'));
  }
  if (n.type === 'icon') {
    const icon = findIcon(n.iconId);
    if (icon) html += block('Icon', `<div class="muted">${esc(icon.name)}${icon.group ? ` · ${esc(icon.group)}` : ''} (${icon.style})</div>`);
  }
  return html;
}
