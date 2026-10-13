// Optics' building blocks (Phases 36–37): layers whose every value comes from Optics Tokens, component sets laid
// out as grids, instances, and the registry each category of components adds itself to. Used by the category
// modules next to this file (actions.js, forms.js…) and by optics.js, which turns the registry into pages.
import { createNode, makePaint } from '../store.js';
import { DEFAULT_LAYOUT } from '../layout.js';

// An Optics Icon's id (Optics Icons are Lucide icons, from Sigma Icons).
export const I = (name, filled = false) => `optics-${name}${filled ? '-filled' : ''}`;

// The building blocks, bound to the Optics tokens in `collections` (throws if a token is missing).
export function kit(collections) {
  const col = (name) => {
    const c = collections.find((x) => x.name === name);
    if (!c) throw new Error(`Optics collection ${name} is missing`);
    return c;
  };
  const find = (colName, path) => {
    const v = col(colName).variables.find((x) => x.name === path);
    if (!v) throw new Error(`Optics token ${colName} ${path} is missing`);
    return v.id;
  };
  const S = (path) => find('Semantic', path);
  const P = (path) => find('Primitives', path);
  const T = (path) => find('Typography', path);
  const semantic = col('Semantic');
  const modeOf = (name) => ({ [semantic.id]: semantic.modes.find((m) => m.name === name).id });

  const text = (name, value, color, typo, props = {}) => createNode('text', {
    name, text: value, autoResize: 'width', ...props,
    fills: [makePaint('#000000')], bindings: { 'fills.0.color': S(color), typography: T(typo), ...(props.bindings || {}) },
  });
  // Wrapping text that fills its parent's width.
  const para = (name, value, color, typo, props = {}) => text(name, value, color, typo, { autoResize: 'height', w: 320, h: 20, sizingH: 'fill', ...props });
  const icon = (name, iconName, color, size, props = {}) => createNode('icon', {
    name, iconId: iconName.startsWith('optics-') ? iconName : I(iconName), w: size, h: size, ...props,
    fills: [makePaint('#000000')], bindings: { 'fills.0.color': S(color), ...(props.bindings || {}) },
  });
  // An auto layout frame (or component), every value from a token. `pad` is all sides, `px`/`py` per axis.
  const box = (type, name, o = {}, children = []) => {
    const bindings = {};
    const layout = { ...DEFAULT_LAYOUT, mode: o.dir || 'vertical', gap: 0, alignP: o.alignP || 'start', alignC: o.alignC || 'start', ...(o.spacing ? { spacing: o.spacing } : {}) };
    if (o.gap) bindings['layout.gap'] = P(`space/${o.gap}`);
    const px = o.px ?? o.pad, py = o.py ?? o.pad;
    if (px) Object.assign(bindings, { 'layout.pl': P(`space/${px}`), 'layout.pr': P(`space/${px}`) });
    if (py) Object.assign(bindings, { 'layout.pt': P(`space/${py}`), 'layout.pb': P(`space/${py}`) });
    if (o.pt) bindings['layout.pt'] = P(`space/${o.pt}`);
    if (o.pb) bindings['layout.pb'] = P(`space/${o.pb}`);
    if (o.pl) bindings['layout.pl'] = P(`space/${o.pl}`);
    if (o.pr) bindings['layout.pr'] = P(`space/${o.pr}`);
    const n = createNode(type, {
      name, w: o.w || 100, h: o.h || 40, clip: !!o.clip, layout, fills: [], strokes: [],
      sizingH: o.w ? 'fixed' : o.fillW ? 'fill' : 'hug', sizingV: o.h ? 'fixed' : o.fillH ? 'fill' : 'hug', children,
      ...(o.props || {}),
    });
    if (o.fill) {
      n.fills = [makePaint('#FFFFFF')];
      bindings['fills.0.color'] = o.fill.startsWith('color/') ? P(o.fill) : S(o.fill);
    }
    if (o.stroke) {
      n.strokes = [makePaint('#000000')];
      bindings['strokes.0.color'] = S(o.stroke);
      n.strokeWidth = o.strokeWidth || 1;
      n.strokeAlign = o.strokeAlign || 'inside';
      if (o.strokeSides) n.strokeSides = o.strokeSides;
    }
    if (o.radius) bindings.radius = P(`radius/${o.radius}`);
    if (o.shadow) {
      n.effects = [{ type: 'drop-shadow', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0, visible: true }];
      bindings['effects.0'] = S(`shadow/${o.shadow}`);
    }
    if (o.modes) n.modes = o.modes;
    if (o.a11y) n.a11y = o.a11y;
    n.bindings = { ...bindings, ...(n.bindings || {}) };
    return n;
  };
  const frame = (name, o, children) => box('frame', name, o, children);
  const comp = (name, o, children) => box('component', name, o, children);
  // A bottom (or top) border only.
  const side = (which) => ({ top: which === 'top', right: false, bottom: which === 'bottom', left: false });
  // An instance of `main` (a component, or a variant of a set).
  const inst = (main, props = {}) => createNode('instance', { name: props.name || main.name, componentId: main.id, w: main.w, h: main.h, overrides: {}, children: [], ...props });
  // A placeholder for a picture: a tinted area with an image icon.
  const picture = (name, w, h, o = {}) => box('frame', name, { w, h, dir: 'horizontal', alignP: 'center', alignC: 'center', fill: o.fill || 'bg/surface/tertiary', radius: o.radius || '200', clip: true },
    [icon('Picture', o.icon || 'image', o.iconColor || 'icon/secondary', o.iconSize || Math.max(16, Math.round(Math.min(w, h) / 3)))]);
  return { S, P, T, text, para, icon, box, frame, comp, side, inst, picture, modeOf, semantic };
}

// A component set laid out as a grid: rows by the first property, columns by the second (if any).
export function variantSet(name, axes, make, { cellW, cellH, pad = 32 }) {
  const [rows, cols = { name: null, values: [null] }] = axes;
  const children = [];
  rows.values.forEach((r, ri) => cols.values.forEach((c, ci) => {
    const v = make(r, c);
    v.name = cols.name ? `${rows.name}=${r}, ${cols.name}=${c}` : `${rows.name}=${r}`;
    Object.assign(v, { x: pad + ci * cellW, y: pad + ri * cellH });
    children.push(v);
  }));
  return createNode('componentSet', {
    name, w: pad * 2 + cols.values.length * cellW, h: pad * 2 + rows.values.length * cellH, fills: [], clip: false, children,
  });
}
// A variant of a set by its name (`Variant=Primary, State=Default`), or the component itself.
export const variant = (node, name) => (node.type === 'componentSet' ? node.children.find((v) => v.name === name) || node.children[0] : node);

// Mark a component (or set) documented and Ready: its docs, code name, and the checks a person confirms.
export function ready(node, { codeName, docs, a11y = null }) {
  node.codeName = codeName;
  node.docs = docs;
  node.status = 'ready';
  node.checks = { breakpoints: true, accessibility: true, ...(node.type === 'component' ? { variants: true } : {}) };
  if (a11y) node.a11y = a11y;
  return node;
}

let ids = 0;
// A property id, unique in the file.
export const pid = (k) => `optics-${k}-${++ids}`;

// The components, in order, as categories add them: { name, category, node, extra, info, usage }.
//   info: { purpose, notFor, usage, role, keyboard, code? }
//   usage: { do: [caption, () => layers], dont: [caption, () => layers] }
export function registry() {
  const list = [];
  const byName = new Map();
  return {
    list,
    add(entry) {
      list.push(entry);
      byName.set(entry.name, entry);
      return entry.node;
    },
    get: (name) => {
      const e = byName.get(name);
      if (!e) throw new Error(`Optics has no component ${name} (yet)`);
      return e;
    },
  };
}
