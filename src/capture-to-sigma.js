// Captured components (tools/capture/capture.js) → Sigma components (Part E, Phase 28). Pure, no DOM: the
// sync skill runs it through tools/sigma.mjs library build.
//
// Flex containers become auto layout frames; other containers keep their layers where they were (block
// flow becomes a vertical auto layout when its children stack, using their most common spacing). Borders,
// outlines, radii, shadows, opacity and text styles become Sigma properties. Values written with var(--x)
// are bound to the token whose code name is --x (inherited properties like color look up the tree). SVG
// that matches an icon of the project's Sigma Icons file becomes an icon layer. Everything approximated is
// listed in `notes`.
import { parseColorValue, parseCSSValue } from './token-sync.js';
import { formatVariantName, parseVariantName } from './components.js';

const px = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const hex = (v) => {
  const c = parseColorValue(String(v || '').trim());
  return c && !/^#[0-9A-F]{6}00$/i.test(c.hex) ? c.hex : null; // fully transparent is no paint
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const ALIGN = { 'flex-start': 'start', start: 'start', normal: 'start', stretch: 'start', baseline: 'start', 'flex-end': 'end', end: 'end', center: 'center' };
const VAR = /var\(\s*(--[\w-]+)/g;
const varsIn = (text) => [...String(text || '').matchAll(VAR)].map((m) => m[1]);

// Split a CSS value at top-level spaces ("var(--a) var(--b)" → two parts).
function parts(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(text || '').trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// { codeName → token id } for binding, from token collections (codeSyntax.web or the default --path name).
export function tokenIndex(collections, defaultCode) {
  const map = new Map();
  for (const c of collections || []) {
    for (const v of c.variables || []) {
      const web = v.codeSyntax?.web;
      map.set(web && web.startsWith('--') ? web : defaultCode(v.name), { id: v.id, type: v.type, name: v.name });
    }
  }
  return map;
}

/**
 * One captured element tree → a Sigma layer tree (project format).
 *   ctx = { tokens: Map(codeName → { id, type }), iconFor(svg) → iconId | null, notes: [], idPrefix }
 */
function convert(node, ctx, parent, ancestors, path) {
  const s = node.style || {};
  const a = node.authored || {};
  const name = node.name || node.tag;
  const id = uniqueId(ctx, `${ctx.idPrefix}-${slug(path.join('-') || 'root')}`);
  const box = node.box || { x: 0, y: 0, w: 0, h: 0 };
  const bindings = {};
  const bind = (path2, codeName, type) => {
    const t = codeName && ctx.tokens.get(codeName);
    if (!t) {
      if (codeName) ctx.notes.push(`${name}: ${codeName} isn’t a token in the Sigma Tokens file, so its value was used`);
      return false;
    }
    if (type && t.type !== type) return false;
    bindings[path2] = t.id;
    return true;
  };
  // The nearest authored value of an inherited property (color, font-*), up the tree.
  const inherited = (prop) => {
    for (const n of [node, ...ancestors]) if (n.authored?.[prop]) return n.authored[prop];
    return null;
  };
  const inheritedVar = (props) => {
    for (const n of [node, ...ancestors]) {
      for (const p of props) {
        const v = n.authored?.[p];
        if (v) return { prop: p, text: v };
      }
    }
    return null;
  };

  // ---- a library component (pages) ----
  const inst = ctx.instanceFor?.(node, id, parent);
  if (inst) return inst;

  // ---- text ----
  const isText = node.tag === '#text' || (!node.children?.length && node.text !== undefined && node.tag !== 'input' && node.tag !== 'textarea')
    || (node.children?.length === 1 && node.children[0].tag === '#text' && !hasBox(s));
  if (isText) {
    // An element holding only text: its own box is the text's line box (a text run's box is shorter).
    const run = node.tag === '#text' ? node : node.children?.[0] || node;
    const t = node.tag === '#text' ? node : { ...run, name: node.name, box: node.box, style: node.style };
    const text = makeText(t, s, name, id, box, ctx, bind, inheritedVar);
    if (Object.keys(bindings).length) text.bindings = bindings;
    return text;
  }

  // ---- svg (an icon) ----
  if (node.tag === 'svg' || node.svg) {
    const iconId = ctx.iconFor(node.svg || '');
    if (iconId) {
      const icon = { id, type: 'icon', name, iconId, x: box.x, y: box.y, w: box.w, h: box.h, fills: [{ color: hex(s.color) || '#000000' }] };
      const color = inheritedVar(['color']);
      const v = color && varsIn(color.text)[0];
      if (v && bind('fills.0.color', v, 'color')) icon.fills = [{}];
      if (Object.keys(bindings).length) icon.bindings = bindings;
      return icon;
    }
    ctx.notes.push(`${name}: an SVG that isn’t in the Sigma Icons file was left out (import it as an icon first)`);
    return null;
  }
  // ---- an image: an icon when it's one of the project's icon files ----
  if (node.tag === 'img') {
    const iconId = ctx.iconForSrc?.(node.src);
    if (iconId) return { id, type: 'icon', name, iconId, x: box.x, y: box.y, w: box.w, h: box.h, fills: [{ color: '#000000' }] };
    ctx.notes.push(`${name}: an image (${node.src}) was left out`);
    return null;
  }

  // ---- a box ----
  const frame = { id, type: 'frame', name, x: box.x, y: box.y, w: box.w, h: box.h, clip: s.overflow === 'hidden' };
  const bg = hex(s['background-color']);
  if (bg) {
    frame.fills = [{ color: bg }];
    const v = varsIn(a['background-color'] || a.background)[0];
    if (v && bind('fills.0.color', v, 'color')) frame.fills = [{}];
  }
  if (s['background-image'] && s['background-image'] !== 'none') ctx.notes.push(`${name}: a background image or gradient was left out`);
  // Borders: one width and color for all drawn sides.
  const sides = ['top', 'right', 'bottom', 'left'];
  const drawn = sides.filter((d) => px(s[`border-${d}-width`]) > 0 && s[`border-${d}-style`] !== 'none');
  if (drawn.length) {
    const d0 = drawn[0];
    frame.strokes = [{ color: hex(s[`border-${d0}-color`]) || '#000000' }];
    frame.strokeWidth = px(s[`border-${d0}-width`]);
    frame.strokeAlign = 'inside';
    if (drawn.length < 4) frame.strokeSides = Object.fromEntries(sides.filter((d) => !drawn.includes(d)).map((d) => [d, false]));
    const v = varsIn(a['border-color'] || a.border || a[`border-${d0}`])[0];
    if (v && bind('strokes.0.color', v, 'color')) frame.strokes = [{}];
  } else if (s['outline-style'] && s['outline-style'] !== 'none' && px(s['outline-width']) > 0) {
    // A focus ring: an outside stroke.
    frame.strokes = [{ color: hex(s['outline-color']) || '#000000' }];
    frame.strokeWidth = px(s['outline-width']);
    frame.strokeAlign = 'outside';
    const v = varsIn(a['outline-color'] || a.outline)[0];
    if (v && bind('strokes.0.color', v, 'color')) frame.strokes = [{}];
    if (px(s['outline-offset'])) ctx.notes.push(`${name}: the outline’s ${px(s['outline-offset'])}px offset was left out`);
  }
  // Corners
  const radii = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => px(s[`border-${c}-radius`]));
  if (radii.some((r) => r)) {
    if (radii.every((r) => r === radii[0])) {
      frame.radius = radii[0];
      const v = varsIn(a['border-radius'])[0];
      if (v) bind('radius', v, 'number');
    } else frame.radii = radii;
  }
  // Shadow
  if (s['box-shadow'] && s['box-shadow'] !== 'none') {
    const sh = parseCSSValue(s['box-shadow']);
    if (sh?.type === 'shadow') {
      const { hex: c, alpha } = (() => {
        const m = /^#([0-9A-F]{6})([0-9A-F]{2})?$/i.exec(sh.value.color);
        return { hex: `#${m[1]}`, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
      })();
      frame.effects = [{ type: 'drop-shadow', color: c, opacity: Math.round(alpha * 100) / 100, x: sh.value.x, y: sh.value.y, blur: sh.value.blur, spread: sh.value.spread }];
      const v = varsIn(a['box-shadow'])[0];
      if (v) bind('effects.0', v, 'shadow');
    } else ctx.notes.push(`${name}: a shadow Sigma can’t hold (several, or inset) was left out`);
  }
  const op = parseFloat(s.opacity);
  if (op < 1) {
    frame.opacity = op;
    const v = varsIn(a.opacity)[0];
    if (v) bind('opacity', v, 'number');
  }

  // Inputs: their text (or placeholder) as a text layer inside.
  const kids = [...(node.children || [])];
  if ((node.tag === 'input' || node.tag === 'textarea') && node.text) {
    const pl = px(s['padding-left']), pt = px(s['padding-top']), pb = px(s['padding-bottom']), pr = px(s['padding-right']);
    kids.push({ tag: '#text', name: node.placeholder ? 'Placeholder' : 'Value', text: node.text, box: { x: pl, y: pt, w: box.w - pl - pr, h: box.h - pt - pb }, style: { ...s, color: node.placeholderColor || s.color }, authored: {}, placeholder: node.placeholder });
  }

  // Layout
  const flex = /flex/.test(s.display);
  const children = kids.map((k, i) => convert(k, ctx, node, [node, ...ancestors], [...path, slug(k.name || k.tag), String(i)])).filter(Boolean);
  // A CSS border takes room around the padding; Sigma's inside stroke doesn't, so it counts as padding.
  const inside = frame.strokeAlign === 'inside' ? ['top', 'right', 'bottom', 'left'].map((d) => (drawn.includes(d) ? px(s[`border-${d}-width`]) : 0)) : [0, 0, 0, 0];
  const padding = { pt: px(s['padding-top']) + inside[0], pr: px(s['padding-right']) + inside[1], pb: px(s['padding-bottom']) + inside[2], pl: px(s['padding-left']) + inside[3] };
  if (flex || (node.tag === 'input' || node.tag === 'textarea')) {
    const row = !flex || !/column/.test(s['flex-direction']);
    frame.layout = {
      mode: row ? 'horizontal' : 'vertical',
      gap: px(row ? s['column-gap'] || s.gap : s['row-gap'] || s.gap), ...padding,
      alignP: s['justify-content'] === 'space-between' ? 'start' : ALIGN[s['justify-content']] || 'start',
      alignC: ALIGN[s['align-items']] || 'start',
      spacing: s['justify-content'] === 'space-between' ? 'auto' : 'packed',
    };
    if (!flex) frame.layout.alignC = 'center';
  } else if (children.length) {
    // Block flow: a column when the children stack.
    const sorted = [...children].sort((x, y) => x.y - y.y);
    const stacks = sorted.every((k, i) => i === 0 || k.y >= sorted[i - 1].y + sorted[i - 1].h - 0.5);
    if (stacks) {
      // Margins can space layers unevenly; auto layout has one gap. Layers closer together go in a group
      // of their own (with their gap), so every spacing is kept.
      const nested = column(sorted, (base) => uniqueId(ctx, `${id}-${slug(base)}`));
      children.splice(0, children.length, ...nested.children);
      frame.layout = { mode: 'vertical', gap: nested.gap, ...padding, alignP: 'start', alignC: 'start', spacing: 'packed' };
    }
  }
  // Token bindings for gap and padding.
  if (frame.layout) {
    const gv = varsIn(a.gap || a['column-gap'] || a['row-gap'])[0];
    if (gv) bind('layout.gap', gv, 'number');
    const pad = a.padding ? parts(a.padding) : [];
    const four = pad.length === 1 ? [pad[0], pad[0], pad[0], pad[0]] : pad.length === 2 ? [pad[0], pad[1], pad[0], pad[1]] : pad.length === 3 ? [pad[0], pad[1], pad[2], pad[1]] : pad;
    ['pt', 'pr', 'pb', 'pl'].forEach((k, i) => {
      const own = a[`padding-${['top', 'right', 'bottom', 'left'][i]}`] || four[i];
      const v = varsIn(own)[0];
      if (!v) return;
      // Padding that also holds the border isn't the token's value any more.
      if (inside[i]) ctx.notes.push(`${name}: its padding includes the ${inside[i]}px border, so it isn’t bound to ${v}`);
      else bind(`layout.${k}`, v, 'number');
    });
  }
  // Sizes: a frame hugs on an axis when its size is just its content plus padding and gaps (and it wasn't
  // given that size in CSS); otherwise it keeps its size. Children in a column fill when they span it.
  const authoredW = a.width && !/auto|fit-content|max-content/.test(a.width);
  const authoredH = a.height && !/auto|fit-content|max-content/.test(a.height);
  if (frame.layout) {
    const L = frame.layout;
    const flow = children.filter((k) => k.visible !== false);
    const along = (k) => flow.reduce((t, c) => t + (c[k] || 0), 0) + Math.max(0, flow.length - 1) * (L.gap || 0);
    const across = (k) => Math.max(0, ...flow.map((c) => c[k] || 0));
    const contentW = L.pl + L.pr + (L.mode === 'horizontal' ? along('w') : across('w'));
    const contentH = L.pt + L.pb + (L.mode === 'vertical' ? along('h') : across('h'));
    // A column whose children span it fills them (below); hugging them as well would collapse it.
    const spans = L.mode === 'vertical' && flow.some((k) => Math.abs((k.w || 0) - (box.w - padding.pl - padding.pr)) < 1.5);
    frame.sizingH = !authoredW && !spans && flow.length && Math.abs(box.w - contentW) < 1 ? 'hug' : 'fixed';
    frame.sizingV = !authoredH && flow.length && Math.abs(box.h - contentH) < 1 ? 'hug' : 'fixed';
  }
  if (children.length) {
    for (const k of children) {
      if (frame.layout) {
        delete k.x;
        delete k.y;
        // A child as wide as the column's content box fills it.
        if (frame.layout.mode === 'vertical' && Math.abs((k.w || 0) - (box.w - padding.pl - padding.pr - (frame.strokeWidth || 0) * 0)) < 1.5) {
          k.sizingH = 'fill';
          if (k.type === 'text') k.autoResize = 'height';
        }
      } else {
        k.x = Math.round((k.x - box.x) * 100) / 100;
        k.y = Math.round((k.y - box.y) * 100) / 100;
      }
    }
    frame.children = children;
  }
  if (Object.keys(bindings).length) frame.bindings = bindings;
  return frame;
}

// Stacked layers (sorted top to bottom) as a column: { gap, children } where runs of layers closer than the
// largest spacing become nested vertical groups.
function column(sorted, newId) {
  if (sorted.length < 2) return { gap: 0, children: sorted };
  const gaps = sorted.slice(1).map((k, i) => Math.round((k.y - sorted[i].y - sorted[i].h) * 10) / 10);
  const max = Math.max(...gaps);
  if (gaps.every((g) => Math.abs(g - max) < 0.5)) return { gap: max, children: sorted };
  const runs = [[sorted[0]]];
  gaps.forEach((g, i) => (Math.abs(g - max) < 0.5 ? runs.push([sorted[i + 1]]) : runs[runs.length - 1].push(sorted[i + 1])));
  const children = runs.map((run) => {
    if (run.length === 1) return run[0];
    const inner = column(run, newId);
    const x = Math.min(...run.map((k) => k.x)), y = run[0].y;
    const w = Math.max(...run.map((k) => k.x + k.w)) - x, h = run[run.length - 1].y + run[run.length - 1].h - y;
    for (const k of inner.children) {
      if (Math.abs((k.w || 0) - w) < 1.5) {
        k.sizingH = 'fill';
        if (k.type === 'text') k.autoResize = 'height';
      }
      delete k.x;
      delete k.y;
    }
    return {
      id: newId(run.map((k) => k.name).join('-')), type: 'frame', name: run.map((k) => k.name).join(' + '), x, y, w, h, clip: false,
      layout: { mode: 'vertical', gap: inner.gap, pt: 0, pr: 0, pb: 0, pl: 0, alignP: 'start', alignC: 'start', spacing: 'packed' },
      sizingH: 'fixed', sizingV: 'hug', children: inner.children,
    };
  });
  return { gap: max, children };
}

const hasBox = (s) => hex(s['background-color']) || ['top', 'right', 'bottom', 'left'].some((d) => px(s[`border-${d}-width`]) > 0 && s[`border-${d}-style`] !== 'none') || (s['box-shadow'] && s['box-shadow'] !== 'none');

function makeText(t, parentStyle, name, id, box, ctx, bind, inheritedVar) {
  const s = t.style || parentStyle;
  const size = px(s['font-size']) || 16;
  const lh = s['line-height'] === 'normal' ? null : Math.round((px(s['line-height']) / size) * 1000) / 10;
  const family = String(s['font-family'] || 'Inter').split(',')[0].replace(/["']/g, '').trim();
  const node = {
    id, type: 'text', name: t.name === 'Text' ? name : t.name || name, text: t.text, x: t.box.x, y: t.box.y, w: t.box.w, h: t.box.h,
    fontFamily: family, fontSize: size, fontWeight: Number(s['font-weight']) || 400, lineHeight: lh,
    letterSpacing: s['letter-spacing'] === 'normal' ? 0 : px(s['letter-spacing']), autoResize: 'width',
    fills: [{ color: hex(s.color) || '#000000' }],
  };
  if (s['text-align'] && /center|right/.test(s['text-align'])) node.textAlign = s['text-align'];
  if (s['text-transform'] && s['text-transform'] !== 'none') node.textCase = { uppercase: 'upper', lowercase: 'lower', capitalize: 'title' }[s['text-transform']];
  if (s['text-overflow'] === 'ellipsis') node.truncate = true;
  const color = inheritedVar(['color']);
  const cv = color && !t.placeholder && varsIn(color.text)[0];
  if (cv && bind('fills.0.color', cv, 'color')) node.fills = [{}];
  const fam = inheritedVar(['font-family', 'font']);
  const fv = fam && varsIn(fam.prop === 'font' ? parts(fam.text).slice(-1)[0] : fam.text)[0];
  if (fv) bind('fontFamily', fv, 'string');
  const sz = inheritedVar(['font-size', 'font']);
  const sv = sz && varsIn(sz.prop === 'font' ? parts(sz.text)[0] : sz.text)[0];
  if (sv) bind('fontSize', sv, 'number');
  const wt = inheritedVar(['font-weight']);
  const wv = wt && varsIn(wt.text)[0];
  if (wv) bind('fontWeight', wv, 'number');
  return node;
}

function uniqueId(ctx, base) {
  let id = base;
  for (let i = 2; ctx.ids.has(id); i++) id = `${base}-${i}`;
  ctx.ids.add(id);
  return id;
}

/**
 * Build a component (or a component set, for several captures) from one component's captures.
 *   spec = { name, codeName?, description?, props?: [{ name, type, codeName?, layer }], variantCodeNames?,
 *            instances?: [{ layer, component, variant?, props? }], captures: [{ variant?: { Prop: Value }, capture }] }
 *   ctx = { tokens, iconFor, componentIdFor(name, variant) → id }
 * Returns { node, notes }.
 */
export function buildComponent(spec, ctx) {
  const notes = [];
  const ids = ctx.ids || new Set();
  const base = slug(spec.name);
  const variants = spec.captures.length > 1 || Object.keys(spec.captures[0]?.variant || {}).length > 0;
  const propIds = Object.fromEntries((spec.props || []).map((p) => [p.name, slug(`${base}-${p.name}`)]));
  const make = (cap) => {
    const vname = variants ? formatVariantName(cap.variant || {}) : spec.name;
    const prefix = variants ? `${base}-${slug(vname)}` : base;
    const root = convert(cap.capture.tree, { ...ctx, ids, notes, idPrefix: prefix }, null, [], []);
    root.id = uniqueId({ ids }, prefix);
    root.type = 'component';
    root.name = vname;
    delete root.x;
    delete root.y;
    // Properties: the layers they set.
    for (const p of spec.props || []) {
      const target = findByName(root, p.layer || p.name);
      if (!target) {
        notes.push(`${spec.name}: no layer named “${p.layer || p.name}” for the ${p.name} property`);
        continue;
      }
      const key = { text: 'text', boolean: 'visible', icon: 'iconId', instance: 'componentId' }[p.type];
      (target.propRefs ||= {})[key] = propIds[p.name];
    }
    // Nested components: instances of the components built from their own captures.
    for (const inst of spec.instances || []) {
      const hit = findParent(root, inst.layer);
      if (!hit) continue;
      const cid = ctx.componentIdFor(inst.component, inst.variant || {});
      if (!cid) {
        notes.push(`${spec.name}: ${inst.component} isn’t built yet, so its layers stay as they are`);
        continue;
      }
      const old = hit.parent.children[hit.index];
      const node = { id: old.id, type: 'instance', name: inst.component, componentId: cid };
      if (inst.props && Object.keys(inst.props).length) node.propValues = Object.fromEntries(Object.entries(inst.props).map(([k, v]) => [slug(`${slug(inst.component)}-${k}`), v]));
      if (old.sizingH === 'fill') node.sizingH = 'fill';
      hit.parent.children[hit.index] = node;
    }
    return root;
  };
  const roots = spec.captures.map(make);
  const defaults = (root) => Object.fromEntries((spec.props || []).map((p) => {
    const t = findByName(root, p.layer || p.name);
    const value = p.type === 'text' ? t?.text : p.type === 'boolean' ? t?.visible !== false : p.type === 'icon' ? t?.iconId : t?.componentId;
    return [propIds[p.name], { type: p.type, name: p.name, default: p.default ?? value, ...(p.codeName ? { codeName: p.codeName } : {}) }];
  }));
  if (!variants) {
    const node = roots[0];
    node.name = spec.name;
    if (spec.props?.length) node.props = defaults(node);
    if (spec.codeName) node.codeName = spec.codeName;
    if (spec.description) node.description = spec.description;
    return { node, notes };
  }
  // A set: variants in a grid (one row per value of the first property).
  const first = Object.keys(spec.captures[0].variant || {})[0];
  const rows = [...new Set(spec.captures.map((c) => c.variant?.[first]))];
  const placed = roots.map((r, i) => {
    const row = rows.indexOf(spec.captures[i].variant?.[first]);
    const col = spec.captures.slice(0, i).filter((c) => c.variant?.[first] === spec.captures[i].variant?.[first]).length;
    return { ...r, x: 20 + col * (Math.max(...roots.map((x) => x.w || 120)) + 24), y: 20 + row * (Math.max(...roots.map((x) => x.h || 40)) + 24) };
  });
  const width = Math.max(...placed.map((r) => r.x + (r.w || 0))) + 20, height = Math.max(...placed.map((r) => r.y + (r.h || 0))) + 20;
  const set = {
    id: uniqueId({ ids }, base), type: 'componentSet', name: spec.name, w: width, h: height, clip: false,
    props: spec.props?.length ? defaults(roots[0]) : undefined, children: placed,
  };
  if (!set.props) delete set.props;
  if (spec.codeName) set.codeName = spec.codeName;
  if (spec.variantCodeNames) set.codeNames = spec.variantCodeNames;
  if (spec.description) set.description = spec.description;
  return { node: set, notes };
}

function findByName(root, name) {
  let hit = null;
  const visit = (n) => {
    if (hit) return;
    if (n !== root && n.name === name) hit = n;
    else (n.children || []).forEach(visit);
  };
  visit(root);
  return hit;
}
function findParent(root, name) {
  let hit = null;
  const visit = (n) => (n.children || []).forEach((c, index) => {
    if (hit) return;
    if (c.name === name) hit = { parent: n, index };
    else visit(c);
  });
  visit(root);
  return hit;
}

// ---------- checking against the capture ----------
// Compare a laid-out Sigma component (layers with world boxes: { name, box, children }) with its capture:
// [{ layer, what, code, sigma }] for sizes and positions more than `tolerance` px apart.
export function compareBoxes(sigma, captureTree, { tolerance = 1.5 } = {}) {
  const out = [];
  const visit = (s, c, path) => {
    if (!s || !c) return;
    for (const [k, label] of [['w', 'width'], ['h', 'height'], ['x', 'x'], ['y', 'y']]) {
      if (path.length === 1 && (k === 'x' || k === 'y')) continue;
      const d = Math.abs((s.box[k] || 0) - (c.box[k] || 0));
      if (d > tolerance) out.push({ layer: path.join(' / '), what: label, code: c.box[k], sigma: Math.round(s.box[k] * 10) / 10 });
    }
    // Colors: a text's color, a box's background (when the Sigma side says what it paints).
    const six = (v) => (v ? String(v).slice(0, 7).toUpperCase() : null);
    if (c.style && 'color' in s && !c.placeholder) {
      const want = six(hex(c.style.color));
      if (want !== six(s.color)) out.push({ layer: path.join(' / '), what: 'color', code: want, sigma: six(s.color) });
    } else if (c.style && 'background' in s && c.tag !== '#text') {
      const want = six(hex(c.style['background-color']));
      if (want !== six(s.background)) out.push({ layer: path.join(' / '), what: 'background', code: want ?? 'none', sigma: six(s.background) ?? 'none' });
    }
    const ck = (c.children || []).filter((x) => x.tag !== '#text' || (c.children || []).length > 1);
    // A group Sigma made to keep uneven spacing has no counterpart: compare what's in it instead. Layers
    // pair by name, else by position.
    const flat = (s.children || []).flatMap((sc) => (!ck.some((x) => (x.name || x.tag) === sc.name) && sc.name.includes(' + ') ? sc.children || [] : [sc]));
    const seen = new Map();
    flat.forEach((sc, i) => {
      const n = seen.get(sc.name) || 0;
      seen.set(sc.name, n + 1);
      const named = ck.filter((x) => (x.name || x.tag) === sc.name)[n];
      visit(sc, named || ck[i], [...path, sc.name]);
    });
  };
  visit(sigma, captureTree, [sigma.name]);
  return out;
}

// ---------- pages (Phase 29) ----------
const escKey = (n) => String(n).replace(/%/g, '%25').replace(/\//g, '%2F').replace(/#/g, '%23');

// The text an element shows: its text runs (or an input's value or placeholder), joined.
function textOf(node) {
  if (!node) return '';
  if (node.tag === '#text') return node.text;
  if (node.tag === 'input' || node.tag === 'textarea') return node.text || '';
  return (node.children || []).map(textOf).filter(Boolean).join(' ');
}
// Elements under `node` (not node) matching `selector`, in document order; `stop(n)` doesn't look inside n.
function descendants(node, selector, stop = () => false) {
  const out = [];
  const visit = (n) => (n.children || []).forEach((c) => {
    if (c.matches?.includes(selector)) out.push(c);
    if (!stop(c)) visit(c);
  });
  visit(node);
  return out;
}
// A selector list ("img, svg") as one manifest selector, or tag names when the capture didn't record it.
const findIn = (node, selector) => {
  const hit = descendants(node, selector)[0];
  if (hit || !/^[a-z, ]+$/.test(selector)) return hit;
  const tags = selector.split(',').map((t) => t.trim());
  let found = null;
  const visit = (n) => (n.children || []).forEach((c) => {
    if (!found && tags.includes(c.tag)) found = c;
    if (!found) visit(c);
  });
  visit(node);
  return found;
};

// Instances in a component (not inside other instances) with their override paths.
function nestedInstances(comp) {
  const out = [];
  const visit = (children, path) => {
    const counts = new Map();
    for (const c of children || []) {
      const n = (counts.get(c.name) || 0) + 1;
      counts.set(c.name, n);
      const key = `${path ? `${path}/` : ''}${escKey(c.name)}${n > 1 ? `#${n}` : ''}`;
      if (c.type === 'instance') out.push({ path: key, node: c });
      else visit(c.children, key);
    }
  };
  visit(comp.children, '');
  return out;
}

/**
 * A captured page → a Sigma frame: elements the manifest's `match` rules recognize become instances of the
 * library's components (variant, property values, nested instances' values), everything else is rebuilt as
 * layers, like components are.
 *   capture: a sigmaCapturePage result (its tree's elements list the manifest selectors they match)
 *   ctx = { name, tokens, iconFor(svg), iconForSrc(src), ids,
 *           library: [{ name, match, node }] — the manifest's components with `match`, and each one's
 *                    component or component set from the library file }
 * Returns { node, notes, instances, loose }: `loose` lists what isn't from the library, for review.
 */
export function buildPage(capture, ctx) {
  const notes = [];
  const ids = ctx.ids || new Set();
  const entries = (ctx.library || []).filter((e) => e.match?.selector && e.node);
  const variantsOf = (e) => (e.node.type === 'componentSet' ? e.node.children : [e.node]);
  const entryOf = (componentId) => entries.find((e) => variantsOf(e).some((v) => v.id === componentId));
  const propsOf = (e) => e.node.props || {};
  const propId = (e, propName) => Object.entries(propsOf(e)).find(([, p]) => p.name === propName)?.[0];
  const isMatch = (n) => entries.some((e) => n.matches?.includes(e.match.selector));
  let instances = 0;

  // The component (variant) and property values for an element `e` recognizes.
  const resolve = (e, el) => {
    const want = {};
    for (const [prop, values] of Object.entries(e.match.variants || {})) {
      const hit = Object.entries(values).find(([, sel]) => sel !== '*' && el.matches?.includes(sel)) || Object.entries(values).find(([, sel]) => sel === '*');
      if (hit) want[prop] = hit[0];
    }
    const comp = variantsOf(e).find((v) => e.node.type !== 'componentSet' || Object.entries(want).every(([k, v2]) => parseVariantName(v.name)[k] === v2)) || variantsOf(e)[0];
    const values = {};
    for (const [prop, spec] of Object.entries(e.match.props || {})) {
      const pid = propId(e, prop);
      if (!pid) {
        notes.push(`${e.name}: no property named “${prop}” (in the manifest’s match.props)`);
        continue;
      }
      const [kind, ...rest] = String(spec).split(':');
      const sel = rest.join(':');
      let value;
      if (kind === 'text') value = textOf(sel ? findIn(el, sel) : el);
      else if (kind === 'has') value = !!findIn(el, sel);
      else if (kind === 'icon') {
        const icon = findIn(el, sel || 'img, svg');
        value = icon ? (icon.tag === 'img' ? ctx.iconForSrc?.(icon.src) : ctx.iconFor(icon.svg || '')) : undefined;
      }
      if (value !== undefined && value !== null && value !== '' && JSON.stringify(value) !== JSON.stringify(propsOf(e)[pid].default)) values[pid] = value;
    }
    return { comp, values };
  };

  const instanceFor = (el, id, parent) => {
    const e = entries.find((x) => el.matches?.includes(x.match.selector));
    if (!e) return null;
    instances++;
    const { comp, values } = resolve(e, el);
    const node = { id, type: 'instance', name: e.name, componentId: comp.id, x: el.box.x, y: el.box.y, w: el.box.w, h: el.box.h };
    if (Object.keys(values).length) node.propValues = values;
    // Components inside it (a card's button): their variants and values, as overrides.
    const nested = nestedInstances(comp);
    const used = new Map();
    for (const n of nested) {
      const ne = entryOf(n.node.componentId);
      if (!ne) continue;
      const els = descendants(el, ne.match.selector, isMatch);
      const i = used.get(ne) || 0;
      used.set(ne, i + 1);
      const child = els[i];
      if (!child) continue;
      const r = resolve(ne, child);
      const ov = {};
      if (r.comp.id !== n.node.componentId) ov.componentId = r.comp.id;
      const merged = { ...(n.node.propValues || {}) };
      for (const [pid, p] of Object.entries(propsOf(ne))) {
        if (pid in r.values) merged[pid] = r.values[pid];
        else if (ne.match.props && Object.keys(ne.match.props).some((name) => name === p.name)) delete merged[pid]; // the code shows the default
      }
      if (JSON.stringify(merged) !== JSON.stringify(n.node.propValues || {})) ov.propValues = merged;
      if (Object.keys(ov).length) (node.overrides ||= {})[n.path] = ov;
    }
    // Stretched by a grid row (cards as tall as the tallest in their row): that size is the instance's own.
    const ps = parent?.style || {};
    if (ps.display === 'grid' || ps.display === 'inline-grid') {
      const row = (parent.children || []).filter((c) => c !== el && Math.abs(c.box.y - el.box.y) < 1);
      const stretch = (v) => !v || v === 'normal' || v === 'stretch' || v === 'auto';
      if (row.length && stretch(el.style['align-self']) && stretch(ps['align-items'])) node._stretchV = true;
    }
    node._main = comp;
    return node;
  };

  const tree = { ...capture.tree, name: ctx.name || capture.tree.name };
  const root = convert(tree, { ...ctx, ids, notes, idPrefix: slug(ctx.name || 'page'), instanceFor }, null, [], []);
  delete root.x;
  delete root.y;

  // Instance sizes: only what differs from the main component is the instance's own (with `synced`, the
  // main's value it was resized from); hug and fill sizes come from layout.
  const loose = [];
  const visit = (n, trail) => {
    const path = [...trail, n.name];
    if (n.type === 'instance') {
      const main = n._main;
      const synced = {};
      if (n._stretchV) {
        n.sizingV = 'fixed';
      }
      for (const [size, sizing] of [['w', 'sizingH'], ['h', 'sizingV']]) {
        const mainSizing = main[sizing] || 'fixed';
        if (n[sizing] && n[sizing] !== mainSizing) synced[sizing] = mainSizing;
        else delete n[sizing];
        const sizingNow = n[sizing] || mainSizing;
        const resized = sizingNow === 'fixed' && (mainSizing !== 'fixed' || Math.abs((n[size] || 0) - (main[size] || 0)) > 1);
        if (resized) synced[size] = main[size] ?? null;
        else delete n[size];
      }
      if (Object.keys(synced).length) n.synced = synced;
      delete n._main;
      delete n._stretchV;
      return;
    }
    if (n !== root) {
      if (n.type === 'text') loose.push({ layer: path.join(' / '), what: 'text', text: n.text });
      else if (n.type === 'icon') loose.push({ layer: path.join(' / '), what: 'icon' });
      else if (n.fills?.length || n.strokes?.length || n.effects?.length) loose.push({ layer: path.join(' / '), what: 'box' });
    }
    for (const c of n.children || []) visit(c, path);
  };
  visit(root, []);
  return { node: root, notes, instances, loose };
}
