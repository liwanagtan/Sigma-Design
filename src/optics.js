// Optics (Phase 36): a working design system in Welcome to Sigma, inspired by Shopify's Polaris.
//   Optics Foundations  color, typography, spacing, radius, elevation, motion and icons, as specimens built
//                       from the tokens themselves
//   Optics Components   Button, Icon button, Text field, Select, Checkbox, Radio button, Badge, Banner, Card,
//                       Avatar, Tab and Tabs, Modal, Tooltip and Spinner: component sets with variants, states
//                       and properties, documented and Ready, with Do and Don't examples on a Usage page
// Every value comes from Optics Tokens (optics-tokens.js) and every icon from Optics Icons, so the
// files pass Sigma's own checks: the token audit, the use report, the accessibility check and readiness.
import { createNode, makePaint } from './store.js';
import { DEFAULT_LAYOUT } from './layout.js';
import { newIconsDocument } from './icon-library.js';

export const OPTICS_FOUNDATIONS_NAME = 'Optics Foundations';
export const OPTICS_COMPONENTS_NAME = 'Optics Components';
export const OPTICS_ICONS_NAME = 'Optics Icons';
// Optics' own icons, made from the Sigma Icons sample: the same icons, with Optics ids.
const I = (name, filled = false) => `optics-${name}${filled ? '-filled' : ''}`;
// The icons Optics' components use (all in Sigma Icons, so in Optics Icons).
export const OPTICS_ICON_NAMES = ['plus', 'search', 'x', 'check', 'minus', 'chevron-down', 'info', 'circle-check', 'circle-alert', 'triangle-alert', 'loader', 'zap', 'pencil', 'trash', 'star'];
export const OPTICS_ICONS = OPTICS_ICON_NAMES.map((n) => I(n));

/** Optics Icons: a Sigma Icons file made from the Sigma Icons sample's icons (the whole Lucide set, outline and filled), published v1. */
export function opticsIconsDocument(sampleIcons, source = null) {
  const doc = newIconsDocument(OPTICS_ICONS_NAME);
  doc.icons = sampleIcons.map((icon) => ({ ...structuredClone(icon), id: I(icon.name, icon.style === 'filled') }));
  if (source) doc.source = { ...structuredClone(source), note: 'Optics’ icons: the whole Lucide set from Sigma Icons, outline and filled.' };
  doc.published = { version: 1, publishedAt: Date.now(), notes: 'Optics Icons v1', icons: structuredClone(doc.icons) };
  return doc;
}

// The building blocks both files use, bound to the Optics tokens in `collections` (throws if one is missing).
function kit(collections) {
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
  const icon = (name, iconId, color, size, props = {}) => createNode('icon', {
    name, iconId, w: size, h: size, ...props, fills: [makePaint('#000000')], bindings: { 'fills.0.color': S(color), ...(props.bindings || {}) },
  });
  // An auto layout frame (or component), every value from a token. `pad` is all sides, `px`/`py` per axis.
  const box = (type, name, o = {}, children = []) => {
    const bindings = {};
    const layout = { ...DEFAULT_LAYOUT, mode: o.dir || 'vertical', gap: 0, alignP: o.alignP || 'start', alignC: o.alignC || 'start' };
    if (o.gap) bindings['layout.gap'] = P(`space/${o.gap}`);
    const px = o.px ?? o.pad, py = o.py ?? o.pad;
    if (px) Object.assign(bindings, { 'layout.pl': P(`space/${px}`), 'layout.pr': P(`space/${px}`) });
    if (py) Object.assign(bindings, { 'layout.pt': P(`space/${py}`), 'layout.pb': P(`space/${py}`) });
    const n = createNode(type, {
      name, w: o.w || 100, h: o.h || 40, clip: !!o.clip, layout, fills: [], strokes: [],
      sizingH: o.w ? 'fixed' : o.fillW ? 'fill' : 'hug', sizingV: o.h ? 'fixed' : 'hug', children,
      ...(o.props || {}),
    });
    if (o.fill) {
      n.fills = [makePaint('#FFFFFF')];
      bindings['fills.0.color'] = S(o.fill);
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
    n.bindings = { ...bindings, ...(n.bindings || {}) };
    return n;
  };
  const frame = (name, o, children) => box('frame', name, o, children);
  return { S, P, T, text, para, icon, box, frame, modeOf, semantic };
}

// A component set laid out as a grid: rows by the first property, columns by the second (if any).
function variantSet(name, axes, make, { cellW, cellH, pad = 32 }) {
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

// Mark a component (or set) documented and Ready: its docs, code name, and the checks a person confirms.
function ready(node, { codeName, docs, a11y = null, single = false }) {
  node.codeName = codeName;
  node.docs = docs;
  node.status = 'ready';
  node.checks = { breakpoints: true, accessibility: true, ...(single ? { variants: true } : {}) };
  if (a11y) node.a11y = a11y;
  return node;
}

// ---------- Optics Components ----------
export function opticsComponentsDocument(collections) {
  const K = kit(collections);
  const { S, text, para, icon, box, frame } = K;
  const inst = (main, props = {}) => createNode('instance', { name: props.name || main.name, componentId: main.id, w: main.w, h: main.h, overrides: {}, children: [], ...props });
  const uidOf = (() => {
    let n = 0;
    return (k) => `optics-${k}-${++n}`;
  })();

  // ---------- Button ----------
  const btnLabel = uidOf('label'), btnShowIcon = uidOf('show-icon'), btnIcon = uidOf('icon');
  const BUTTON = {
    Primary: { fill: ['bg/fill/brand', 'bg/fill/brand-hover', 'bg/fill/brand-active'], text: 'text/on-fill', icon: 'icon/on-fill' },
    Secondary: { fill: ['bg/fill/default', 'bg/fill/hover', 'bg/fill/active'], text: 'text/default', icon: 'icon/default', stroke: 'border/strong' },
    Tertiary: { fill: ['bg/fill/transparent', 'bg/fill/transparent-hover', 'bg/fill/transparent-active'], text: 'text/default', icon: 'icon/default' },
    Critical: { fill: ['bg/fill/critical', 'bg/fill/critical-hover', 'bg/fill/critical-active'], text: 'text/on-fill', icon: 'icon/on-fill' },
    Plain: { fill: ['bg/fill/transparent', 'bg/fill/transparent', 'bg/fill/transparent'], text: 'text/link', icon: 'icon/brand', hoverText: 'text/link-hover' },
  };
  const STATES = ['Default', 'Hover', 'Pressed', 'Focused', 'Disabled'];
  const buttonVariant = (variant, state) => {
    const st = BUTTON[variant];
    const off = state === 'Disabled';
    const i = state === 'Hover' ? 1 : state === 'Pressed' ? 2 : 0;
    const fill = off ? (variant === 'Tertiary' || variant === 'Plain' ? 'bg/fill/transparent' : 'bg/fill/disabled') : st.fill[i];
    const color = off ? 'text/disabled' : state === 'Hover' && st.hoverText ? st.hoverText : st.text;
    const o = { dir: 'horizontal', gap: '200', px: '400', py: '300', fill, radius: '200', alignP: 'center', alignC: 'center' };
    if (state === 'Focused') Object.assign(o, { stroke: 'border/focus', strokeWidth: 2, strokeAlign: 'outside' });
    else if (st.stroke) Object.assign(o, { stroke: off ? 'border/disabled' : st.stroke });
    return box('component', variant, o, [
      icon('Icon', I('plus'), off ? 'icon/disabled' : st.icon, 20, { visible: false, propRefs: { iconId: btnIcon, visible: btnShowIcon } }),
      text('Label', 'Button', color, 'body/md-medium', { propRefs: { text: btnLabel } }),
    ]);
  };
  const button = variantSet('Button', [{ name: 'Variant', values: Object.keys(BUTTON) }, { name: 'State', values: STATES }], buttonVariant, { cellW: 150, cellH: 72 });
  button.props = {
    [btnLabel]: { name: 'Label', type: 'text', default: 'Button' },
    [btnShowIcon]: { name: 'Show icon', type: 'boolean', default: false },
    [btnIcon]: { name: 'Icon', type: 'icon', default: I('plus'), groups: ['Actions'] },
  };
  const btn = (variant, state = 'Default') => button.children.find((v) => v.name === `Variant=${variant}, State=${state}`);
  const buttonOf = (variant, label, props = {}) => inst(btn(variant), { name: 'Button', propValues: { [btnLabel]: label }, ...props });

  // ---------- Icon button ----------
  const ibIcon = uidOf('icon');
  const iconButtonVariant = (variant, state) => {
    const st = BUTTON[variant];
    const off = state === 'Disabled';
    const i = state === 'Hover' ? 1 : state === 'Pressed' ? 2 : 0;
    const o = { dir: 'horizontal', pad: '300', fill: off ? 'bg/fill/transparent' : st.fill[i], radius: '200', alignP: 'center', alignC: 'center' };
    if (state === 'Focused') Object.assign(o, { stroke: 'border/focus', strokeWidth: 2, strokeAlign: 'outside' });
    else if (st.stroke) Object.assign(o, { stroke: off ? 'border/disabled' : st.stroke });
    return box('component', variant, o, [icon('Icon', I('x'), off ? 'icon/disabled' : st.icon, 20, { propRefs: { iconId: ibIcon } })]);
  };
  const iconButton = variantSet('Icon button', [{ name: 'Variant', values: ['Secondary', 'Tertiary'] }, { name: 'State', values: STATES }], iconButtonVariant, { cellW: 76, cellH: 76 });
  iconButton.props = { [ibIcon]: { name: 'Icon', type: 'icon', default: I('x') } };
  const ib = (variant, state = 'Default') => iconButton.children.find((v) => v.name === `Variant=${variant}, State=${state}`);
  // An icon-only control needs a name for screen readers: every variant says "Close" (its default icon), and
  // an instance with another icon says what it does.
  for (const v of iconButton.children) v.a11y = { label: 'Close' };

  // ---------- Text field and Select ----------
  const tfLabel = uidOf('label'), tfValue = uidOf('value'), tfHelp = uidOf('help'), tfShowHelp = uidOf('show-help');
  const FIELD = {
    Default: { stroke: 'border/strong' }, Hover: { stroke: 'border/hover' }, Focused: { stroke: 'border/focus', strokeWidth: 2 },
    Error: { stroke: 'border/critical' }, Disabled: { stroke: 'border/disabled', fill: 'bg/surface/disabled' },
  };
  const field = (kind, state, valueText, trailing) => {
    const f = FIELD[state];
    const off = state === 'Disabled';
    const help = state === 'Error'
      ? box('frame', 'Help', { dir: 'horizontal', gap: '100', alignC: 'center' }, [
        icon('Icon', I('circle-alert'), 'icon/critical', 16),
        text('Help text', 'Enter a valid email', 'text/critical', 'body/sm', { propRefs: { text: tfHelp } }),
      ])
      : text('Help text', kind === 'Select' ? 'Where your orders ship from' : 'We’ll only use it for receipts', off ? 'text/disabled' : 'text/secondary', 'body/sm', { propRefs: { text: tfHelp } });
    help.propRefs = { ...(help.propRefs || {}), visible: tfShowHelp };
    return box('component', state, { dir: 'vertical', gap: '100', w: 280 }, [
      text('Label', kind === 'Select' ? 'Country' : 'Email', off ? 'text/disabled' : 'text/default', 'body/md-medium', { propRefs: { text: tfLabel } }),
      box('frame', 'Input', {
        dir: 'horizontal', gap: '200', px: '300', py: '300', fill: f.fill || 'bg/surface/default', stroke: f.stroke, strokeWidth: f.strokeWidth || 1,
        radius: '200', alignC: 'center', fillW: true,
      }, [
        para(kind === 'Select' ? 'Value' : 'Placeholder', valueText, off ? 'text/disabled' : kind === 'Select' ? 'text/default' : 'text/secondary', 'body/md', { propRefs: { text: tfValue } }),
        ...(trailing ? [icon('Chevron', I(trailing), off ? 'icon/disabled' : 'icon/secondary', 20)] : []),
      ]),
      help,
    ]);
  };
  const fieldProps = (label, value, help) => ({
    [tfLabel]: { name: 'Label', type: 'text', default: label },
    [tfValue]: { name: kind(label), type: 'text', default: value },
    [tfHelp]: { name: 'Help text', type: 'text', default: help },
    [tfShowHelp]: { name: 'Show help text', type: 'boolean', default: true },
  });
  const kind = (label) => (label === 'Country' ? 'Value' : 'Placeholder');
  const textField = variantSet('Text field', [{ name: 'State', values: ['Default', 'Hover', 'Focused', 'Error', 'Disabled'] }], (s) => field('Text field', s, 'name@example.com'), { cellW: 320, cellH: 120 });
  textField.props = fieldProps('Email', 'name@example.com', 'We’ll only use it for receipts');
  // Select uses its own property ids (a set's properties are its own).
  const selLabel = uidOf('label'), selValue = uidOf('value'), selHelp = uidOf('help'), selShowHelp = uidOf('show-help');
  const select = variantSet('Select', [{ name: 'State', values: ['Default', 'Hover', 'Focused', 'Disabled'] }], (s) => {
    const v = field('Select', s, 'Canada', 'chevron-down');
    const remap = { [tfLabel]: selLabel, [tfValue]: selValue, [tfHelp]: selHelp, [tfShowHelp]: selShowHelp };
    const walkRefs = (n) => {
      for (const [k, pid] of Object.entries(n.propRefs || {})) if (remap[pid]) n.propRefs[k] = remap[pid];
      (n.children || []).forEach(walkRefs);
    };
    walkRefs(v);
    return v;
  }, { cellW: 320, cellH: 120 });
  select.props = {
    [selLabel]: { name: 'Label', type: 'text', default: 'Country' },
    [selValue]: { name: 'Value', type: 'text', default: 'Canada' },
    [selHelp]: { name: 'Help text', type: 'text', default: 'Where your orders ship from' },
    [selShowHelp]: { name: 'Show help text', type: 'boolean', default: true },
  };

  // ---------- Checkbox and Radio button ----------
  const cbLabel = uidOf('label');
  const checkbox = variantSet('Checkbox', [{ name: 'Checked', values: ['Off', 'On', 'Indeterminate'] }, { name: 'State', values: ['Default', 'Hover', 'Disabled'] }], (checked, state) => {
    const off = state === 'Disabled', on = checked !== 'Off';
    const fill = off ? 'bg/fill/disabled' : on ? (state === 'Hover' ? 'bg/fill/brand-hover' : 'bg/fill/brand') : state === 'Hover' ? 'bg/surface/hover' : 'bg/surface/default';
    const stroke = off ? 'border/disabled' : on ? 'border/brand' : state === 'Hover' ? 'border/hover' : 'border/strong';
    return box('component', checked, { dir: 'horizontal', gap: '200', py: '300', alignC: 'center' }, [
      box('frame', 'Box', { w: 20, h: 20, dir: 'horizontal', fill, stroke, radius: '100', alignP: 'center', alignC: 'center' },
        on ? [icon('Check', I(checked === 'On' ? 'check' : 'minus'), off ? 'icon/disabled' : 'icon/on-fill', 16)] : []),
      text('Label', 'Email me about orders', off ? 'text/disabled' : 'text/default', 'body/md', { propRefs: { text: cbLabel } }),
    ]);
  }, { cellW: 260, cellH: 64 });
  checkbox.props = { [cbLabel]: { name: 'Label', type: 'text', default: 'Email me about orders' } };
  const cb = (checked, state = 'Default') => checkbox.children.find((v) => v.name === `Checked=${checked}, State=${state}`);

  const rbLabel = uidOf('label');
  const radio = variantSet('Radio button', [{ name: 'Selected', values: ['Off', 'On'] }, { name: 'State', values: ['Default', 'Hover', 'Disabled'] }], (selected, state) => {
    const off = state === 'Disabled', on = selected === 'On';
    const fill = off ? 'bg/fill/disabled' : on ? 'bg/fill/brand' : state === 'Hover' ? 'bg/surface/hover' : 'bg/surface/default';
    const stroke = off ? 'border/disabled' : on ? 'border/brand' : state === 'Hover' ? 'border/hover' : 'border/strong';
    return box('component', selected, { dir: 'horizontal', gap: '200', py: '300', alignC: 'center' }, [
      box('frame', 'Circle', { w: 20, h: 20, dir: 'horizontal', fill, stroke, radius: 'full', alignP: 'center', alignC: 'center' },
        on ? [box('frame', 'Dot', { w: 8, h: 8, fill: 'bg/surface/default', radius: 'full' })] : []),
      text('Label', 'Standard shipping', off ? 'text/disabled' : 'text/default', 'body/md', { propRefs: { text: rbLabel } }),
    ]);
  }, { cellW: 240, cellH: 64 });
  radio.props = { [rbLabel]: { name: 'Label', type: 'text', default: 'Standard shipping' } };
  const rb = (selected, state = 'Default') => radio.children.find((v) => v.name === `Selected=${selected}, State=${state}`);

  // ---------- Badge and Banner ----------
  const bdLabel = uidOf('label');
  const TONES = { Neutral: 'neutral', Info: 'info', Success: 'success', Caution: 'caution', Warning: 'warning', Critical: 'critical', Magic: 'magic' };
  const badge = variantSet('Badge', [{ name: 'Tone', values: Object.keys(TONES) }], (t) => {
    const k = TONES[t];
    return box('component', t, { dir: 'horizontal', px: '200', py: '050', fill: k === 'critical' ? 'bg/fill/critical-subtle' : `bg/fill/${k}`, radius: '200', alignC: 'center' }, [
      text('Label', t === 'Neutral' ? 'Draft' : t, k === 'neutral' ? 'text/default' : `text/${k}`, 'body/sm-medium', { propRefs: { text: bdLabel } }),
    ]);
  }, { cellW: 120, cellH: 44 });
  badge.props = { [bdLabel]: { name: 'Label', type: 'text', default: 'Badge' } };
  const bd = (t) => badge.children.find((v) => v.name === `Tone=${t}`);

  const bnTitle = uidOf('title'), bnBody = uidOf('body');
  const BANNER = { Info: ['info', 'info'], Success: ['success', 'circle-check'], Warning: ['warning', 'triangle-alert'], Critical: ['critical', 'circle-alert'] };
  const banner = variantSet('Banner', [{ name: 'Tone', values: Object.keys(BANNER) }], (t) => {
    const [k, ic] = BANNER[t];
    return box('component', t, { dir: 'horizontal', gap: '300', pad: '400', w: 480, fill: `bg/surface/${k}`, stroke: `border/${k}`, radius: '300' }, [
      icon('Icon', I(ic), `icon/${k}`, 20),
      box('frame', 'Content', { dir: 'vertical', gap: '100', fillW: true }, [
        para('Title', 'Your store is ready to sell', 'text/default', 'heading/xs', { propRefs: { text: bnTitle } }),
        para('Body', 'Add a payment provider to start taking orders.', 'text/default', 'body/md', { propRefs: { text: bnBody } }),
      ]),
    ]);
  }, { cellW: 520, cellH: 120 });
  banner.props = {
    [bnTitle]: { name: 'Title', type: 'text', default: 'Your store is ready to sell' },
    [bnBody]: { name: 'Body', type: 'text', default: 'Add a payment provider to start taking orders.' },
  };
  const bn = (t) => banner.children.find((v) => v.name === `Tone=${t}`);

  // ---------- Card, Avatar ----------
  const cdTitle = uidOf('title'), cdBody = uidOf('body');
  const card = box('component', 'Card', { dir: 'vertical', gap: '300', pad: '400', w: 360, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '100' }, [
    para('Title', 'Online store', 'text/default', 'heading/sm', { propRefs: { text: cdTitle } }),
    para('Body', 'Your theme is published. Preview it before you share the link.', 'text/secondary', 'body/md', { propRefs: { text: cdBody } }),
    box('frame', 'Actions', { dir: 'horizontal', gap: '200' }, [buttonOf('Secondary', 'Preview'), buttonOf('Primary', 'Share')]),
  ]);
  card.props = {
    [cdTitle]: { name: 'Title', type: 'text', default: 'Online store' },
    [cdBody]: { name: 'Body', type: 'text', default: 'Your theme is published. Preview it before you share the link.' },
  };

  const avInitials = uidOf('initials');
  const avatar = variantSet('Avatar', [{ name: 'Size', values: ['Small', 'Medium', 'Large'] }], (sz) => {
    const px = { Small: 28, Medium: 36, Large: 48 }[sz];
    return box('component', sz, { w: px, h: px, dir: 'horizontal', fill: 'bg/fill/info', radius: 'full', alignP: 'center', alignC: 'center' }, [
      text('Initials', 'OP', 'text/info', sz === 'Small' ? 'body/sm-medium' : 'body/md-semibold', { propRefs: { text: avInitials } }),
    ]);
  }, { cellW: 72, cellH: 72 });
  avatar.props = { [avInitials]: { name: 'Initials', type: 'text', default: 'OP' } };
  const av = (sz) => avatar.children.find((v) => v.name === `Size=${sz}`);

  // ---------- Tab and Tabs ----------
  const tbLabel = uidOf('label');
  const tab = variantSet('Tab', [{ name: 'State', values: ['Selected', 'Default', 'Hover', 'Disabled'] }], (state) => {
    const o = { dir: 'horizontal', px: '400', py: '300', alignC: 'center' };
    if (state === 'Selected') Object.assign(o, { stroke: 'border/brand', strokeWidth: 2, strokeSides: { top: false, right: false, bottom: true, left: false } });
    if (state === 'Hover') o.fill = 'bg/fill/transparent-hover';
    const color = state === 'Disabled' ? 'text/disabled' : state === 'Default' ? 'text/secondary' : 'text/default';
    return box('component', state, o, [text('Label', 'Orders', color, 'body/md-medium', { propRefs: { text: tbLabel } })]);
  }, { cellW: 120, cellH: 64 });
  tab.props = { [tbLabel]: { name: 'Label', type: 'text', default: 'Orders' } };
  const tb = (state) => tab.children.find((v) => v.name === `State=${state}`);
  const tabs = box('component', 'Tabs', { dir: 'horizontal', stroke: 'border/default', strokeSides: { top: false, right: false, bottom: true, left: false } }, [
    inst(tb('Selected'), { name: 'Tab', propValues: { [tbLabel]: 'All' } }),
    inst(tb('Default'), { name: 'Tab', propValues: { [tbLabel]: 'Unfulfilled' } }),
    inst(tb('Default'), { name: 'Tab', propValues: { [tbLabel]: 'Archived' } }),
  ]);

  // ---------- Modal, Tooltip, Spinner ----------
  const mdTitle = uidOf('title'), mdBody = uidOf('body');
  const modal = box('component', 'Modal', { dir: 'vertical', w: 480, fill: 'bg/surface/default', radius: '400', shadow: '600', clip: true }, [
    box('frame', 'Header', { dir: 'horizontal', gap: '300', px: '400', py: '300', alignC: 'center', fillW: true, stroke: 'border/default', strokeSides: { top: false, right: false, bottom: true, left: false } }, [
      para('Title', 'Delete product?', 'text/default', 'heading/sm', { propRefs: { text: mdTitle } }),
      inst(ib('Tertiary'), { name: 'Close' }),
    ]),
    box('frame', 'Body', { dir: 'vertical', pad: '400', fillW: true }, [
      para('Body', 'This can’t be undone. The product will be removed from every sales channel.', 'text/default', 'body/md', { propRefs: { text: mdBody } }),
    ]),
    box('frame', 'Footer', { dir: 'horizontal', gap: '200', pad: '400', alignP: 'end', fillW: true, stroke: 'border/default', strokeSides: { top: true, right: false, bottom: false, left: false } }, [
      buttonOf('Secondary', 'Cancel'), buttonOf('Critical', 'Delete'),
    ]),
  ]);
  modal.props = {
    [mdTitle]: { name: 'Title', type: 'text', default: 'Delete product?' },
    [mdBody]: { name: 'Body', type: 'text', default: 'This can’t be undone. The product will be removed from every sales channel.' },
  };

  const ttText = uidOf('text');
  const tooltip = box('component', 'Tooltip', { dir: 'horizontal', px: '200', py: '100', fill: 'bg/surface/inverse', radius: '200', shadow: '300' }, [
    text('Text', 'Search orders', 'text/inverse', 'body/sm', { propRefs: { text: ttText } }),
  ]);
  tooltip.props = { [ttText]: { name: 'Text', type: 'text', default: 'Search orders' } };

  const spinner = variantSet('Spinner', [{ name: 'Size', values: ['Small', 'Large'] }], (sz) => {
    const px = sz === 'Small' ? 20 : 44;
    return box('component', sz, { w: px, h: px, dir: 'horizontal', alignP: 'center', alignC: 'center' }, [icon('Icon', I('loader'), 'icon/brand', px)]);
  }, { cellW: 76, cellH: 76 });
  const sp = (sz) => spinner.children.find((v) => v.name === `Size=${sz}`);

  // ---------- Usage: Do and Don't examples ----------
  const usage = [];
  const example = (comp, kindOf, caption, children) => {
    const doIt = kindOf === 'Do';
    const f = frame(`${comp} · ${kindOf}`, { dir: 'vertical', gap: '300', pad: '600', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', props: { minW: 360 } }, [
      text('Verdict', doIt ? 'Do' : 'Don’t', doIt ? 'text/success' : 'text/critical', 'heading/xs'),
      para('Caption', caption, 'text/secondary', 'body/md', { w: 320 }),
      box('frame', 'Example', { dir: 'horizontal', gap: '200', alignC: 'center' }, children),
    ]);
    usage.push(f);
    return f.id;
  };
  const col = (gap, children) => box('frame', 'Column', { dir: 'vertical', gap }, children);
  const pairs = {};
  const pair = (comp, doCaption, doKids, dontCaption, dontKids) => {
    pairs[comp] = { dos: [example(comp, 'Do', doCaption, doKids)], donts: [example(comp, 'Don’t', dontCaption, dontKids)] };
  };
  pair('Button', 'Lead with one primary action, with secondary ones beside it.', [buttonOf('Secondary', 'Cancel'), buttonOf('Primary', 'Save')],
    'Put two primary buttons side by side: nobody can tell which matters.', [buttonOf('Primary', 'Save'), buttonOf('Primary', 'Publish')]);
  pair('Icon button', 'Use icons everyone knows, and name the action for screen readers.', [inst(ib('Secondary'), { name: 'Search', propValues: { [ibIcon]: I('search') }, a11y: { label: 'Search' } })],
    'Use an icon nobody can guess: give it a label in a Button instead.', [inst(ib('Secondary'), { name: 'Boost', propValues: { [ibIcon]: I('zap') }, a11y: { label: 'Boost listing' } })]);
  pair('Text field', 'Give every field a visible label and helpful hint.', [inst(textField.children[0], { name: 'Text field' })],
    'Repeat the label as a placeholder: it adds nothing and disappears when typing.', [inst(textField.children[0], { name: 'Text field', propValues: { [tfValue]: 'Email' } })]);
  pair('Select', 'Use a select for a long list of known options.', [inst(select.children[0], { name: 'Select' })],
    'Use a select for two options: radio buttons show both at once.', [inst(select.children[0], { name: 'Select', propValues: { [selLabel]: 'Gift wrap', [selValue]: 'No' } })]);
  pair('Checkbox', 'Use checkboxes for options people can turn on independently.', [col('050', [inst(cb('On'), { name: 'Checkbox' }), inst(cb('Off'), { name: 'Checkbox', propValues: { [cbLabel]: 'Text me about deliveries' } })])],
    'Phrase options negatively: people have to work out what checking means.', [inst(cb('Off'), { name: 'Checkbox', propValues: { [cbLabel]: 'Don’t stop emails' } })]);
  pair('Radio button', 'Offer two to five options where exactly one applies.', [col('050', [inst(rb('On'), { name: 'Radio button' }), inst(rb('Off'), { name: 'Radio button', propValues: { [rbLabel]: 'Express shipping' } })])],
    'Use a single radio button: it can’t be turned off again.', [inst(rb('Off'), { name: 'Radio button', propValues: { [rbLabel]: 'I agree' } })]);
  pair('Badge', 'Use a badge for a short status next to what it describes.', [text('Order', 'Order #1024', 'text/default', 'body/md'), inst(bd('Success'), { name: 'Badge', propValues: { [bdLabel]: 'Paid' } })],
    'Stack many tones together: the colors stop meaning anything.', [inst(bd('Info'), { name: 'Badge' }), inst(bd('Caution'), { name: 'Badge' }), inst(bd('Magic'), { name: 'Badge' }), inst(bd('Critical'), { name: 'Badge' })]);
  pair('Banner', 'Say what happened and what to do next, in the right tone.', [inst(bn('Critical'), { name: 'Banner', propValues: { [bnTitle]: 'Payment failed', [bnBody]: 'Update your card to keep your plan.' } })],
    'Use a banner for something that isn’t news: it trains people to ignore banners.', [inst(bn('Info'), { name: 'Banner', propValues: { [bnTitle]: 'Welcome back', [bnBody]: 'You have 3 orders.' } })]);
  pair('Card', 'Group related content and its actions in one card.', [inst(card, { name: 'Card' })],
    'Split one task across several cards: keep it together.', [col('300', [inst(card, { name: 'Card', propValues: { [cdTitle]: 'Theme', [cdBody]: 'Step 1 of 2.' } }), inst(card, { name: 'Card', propValues: { [cdTitle]: 'Theme (continued)', [cdBody]: 'Step 2 of 2.' } })])]);
  pair('Avatar', 'Pair an avatar with the person’s name.', [inst(av('Medium'), { name: 'Avatar' }), text('Name', 'Olivia Park', 'text/default', 'body/md')],
    'Mix avatar sizes in one list.', [inst(av('Small'), { name: 'Avatar' }), inst(av('Large'), { name: 'Avatar' })]);
  pair('Tabs', 'Use tabs to switch between views of the same content.', [inst(tabs, { name: 'Tabs' })],
    'Use tabs for actions: use buttons.', [inst(tb('Default'), { name: 'Tab', propValues: { [tbLabel]: 'Save' } }), inst(tb('Default'), { name: 'Tab', propValues: { [tbLabel]: 'Delete' } })]);
  pair('Modal', 'Confirm a destructive action with a clear title and the button that does it.', [inst(modal, { name: 'Modal' })],
    'Ask a vague question: say exactly what will happen.', [inst(modal, { name: 'Modal', propValues: { [mdTitle]: 'Are you sure?', [mdBody]: 'Continue?' } })]);
  pair('Tooltip', 'Use a tooltip to name an icon-only control.', [col('100', [inst(ib('Secondary'), { name: 'Search', propValues: { [ibIcon]: I('search') }, a11y: { label: 'Search' } }), inst(tooltip, { name: 'Tooltip' })])],
    'Put essential information in a tooltip: touch screens can’t hover.', [inst(tooltip, { name: 'Tooltip', propValues: { [ttText]: 'Orders over $50 ship free, except to remote areas.' } })]);
  pair('Spinner', 'Show a spinner with what’s loading.', [inst(sp('Small'), { name: 'Spinner' }), text('Loading', 'Loading orders…', 'text/secondary', 'body/md')],
    'Show several spinners at once: show one for the area that’s loading.', [inst(sp('Small'), { name: 'Spinner' }), inst(sp('Small'), { name: 'Spinner' }), inst(sp('Small'), { name: 'Spinner' })]);

  // ---------- docs ----------
  const kb = {
    button: 'Tab moves focus to it; Enter or Space activates it. Announced as its label and “button”.',
    field: 'Tab moves focus to it; typing edits it. Its label and help text are announced; an error is announced when it appears.',
  };
  ready(button, { codeName: 'Button', docs: { purpose: 'Lets people take an action: save, continue, delete.', notFor: 'Navigation (use a link) or toggling a setting (use a checkbox).', usage: 'One Primary per view, for the main action. Secondary for the rest, Tertiary and Plain for low emphasis, Critical for destructive actions. Label with a verb.', code: 'components/Button', role: 'button', keyboard: kb.button, ...pairs.Button } });
  ready(iconButton, { codeName: 'IconButton', docs: { purpose: 'An action shown as an icon, where space is tight and the icon is well known.', notFor: 'Actions whose icon isn’t obvious: use a Button with a label.', usage: 'Always give it an accessible label (Inspect → Accessibility); add a Tooltip with the same words.', code: 'components/IconButton', role: 'button', keyboard: kb.button, ...pairs['Icon button'] } });
  ready(textField, { codeName: 'TextField', docs: { purpose: 'Lets people enter text: names, emails, amounts.', notFor: 'Choosing from known options (use Select, Radio button or Checkbox).', usage: 'A short label above, a hint below. Show errors under the field, in the Error state, saying how to fix it.', code: 'components/TextField', role: 'textbox', keyboard: kb.field, ...pairs['Text field'] } });
  ready(select, { codeName: 'Select', docs: { purpose: 'Lets people choose one option from a list.', notFor: 'Two to five options (use Radio button) or several choices (use Checkbox).', usage: 'Order options logically (alphabetically, or by how often they’re used). Give it a label.', code: 'components/Select', role: 'combobox', keyboard: 'Tab moves focus to it; Space or Enter opens the list; arrows choose; Escape closes it.', ...pairs.Select } });
  ready(checkbox, { codeName: 'Checkbox', docs: { purpose: 'Turns an option on or off, independently of others.', notFor: 'One choice among several (use Radio button).', usage: 'Phrase labels positively. Indeterminate is for a parent whose children are partly checked.', code: 'components/Checkbox', role: 'checkbox', keyboard: 'Tab moves focus to it; Space checks or unchecks it.', ...pairs.Checkbox } });
  ready(radio, { codeName: 'RadioButton', docs: { purpose: 'Lets people choose exactly one of a few options.', notFor: 'A single on/off option (use Checkbox) or long lists (use Select).', usage: 'Show two to five options in a column, with a sensible one selected.', code: 'components/RadioButton', role: 'radio', keyboard: 'Tab moves focus to the group; arrows move the selection.', ...pairs['Radio button'] } });
  ready(badge, { codeName: 'Badge', docs: { purpose: 'Shows a short status: Paid, Draft, Needs review.', notFor: 'Actions (badges aren’t clickable) or long text.', usage: 'One or two words. Choose the tone by meaning: Success for done, Caution and Warning for attention, Critical for problems.', code: 'components/Badge', role: 'none', keyboard: 'Not focusable; read with the content it describes.', ...pairs.Badge } });
  ready(banner, { codeName: 'Banner', docs: { purpose: 'Tells people about something important on the page: a problem, a success, a change.', notFor: 'Confirmations of small actions (use a toast) or permanent content.', usage: 'A title that says what happened, a body that says what to do. Use the tone that matches the urgency.', code: 'components/Banner', role: 'none', keyboard: 'Not focusable itself; its title is announced when it appears.', ...pairs.Banner } });
  ready(card, { single: true, codeName: 'Card', docs: { purpose: 'Groups related content and actions on a surface.', notFor: 'Layout alone (use auto layout) or a single line of text.', usage: 'A title, content, and up to two actions. Keep one task in one card.', code: 'components/Card', role: 'none', keyboard: 'Not focusable; its controls are.', ...pairs.Card } });
  ready(avatar, { codeName: 'Avatar', docs: { purpose: 'Represents a person or a store with initials or a picture.', notFor: 'Decoration or icons.', usage: 'Small in dense lists, Medium beside a name, Large on a profile. Pair it with the name.', code: 'components/Avatar', role: 'img', keyboard: 'Not focusable; its alternative text is the person’s name.', ...pairs.Avatar } });
  ready(tab, { codeName: 'Tab', docs: { purpose: 'One view in a set of Tabs.', notFor: 'Actions (use Button).', usage: 'Short labels. Exactly one is Selected.', code: 'components/Tabs', role: 'tab', keyboard: 'Arrows move between tabs; Enter or Space selects one.', ...pairs.Tabs } });
  ready(tabs, { single: true, codeName: 'Tabs', docs: { purpose: 'Switches between views of the same content, like order statuses.', notFor: 'Steps in a process or actions.', usage: 'Up to about five tabs, with short labels, and the first selected.', code: 'components/Tabs', role: 'list', keyboard: 'Tab moves focus into the tabs; arrows move between them.', ...pairs.Tabs } });
  ready(modal, { single: true, codeName: 'Modal', docs: { purpose: 'Asks people to confirm or finish something before going on.', notFor: 'Information people need while working (keep it on the page).', usage: 'A specific title, the consequence in the body, and the action that does it as the button label.', code: 'components/Modal', role: 'dialog', keyboard: 'Focus moves into it when it opens and stays there; Escape closes it; focus returns to what opened it.', ...pairs.Modal } });
  ready(tooltip, { single: true, codeName: 'Tooltip', docs: { purpose: 'Names a control or adds a short hint on hover and focus.', notFor: 'Essential information or anything interactive.', usage: 'A few words. Always shown on keyboard focus too, not only on hover.', code: 'components/Tooltip', role: 'none', keyboard: 'Shown while its control has focus; Escape hides it.', ...pairs.Tooltip } });
  ready(spinner, { codeName: 'Spinner', a11y: { role: 'img', label: 'Loading' }, docs: { purpose: 'Shows that something is loading.', notFor: 'Progress you can measure (use a progress bar).', usage: 'One spinner for the area that’s loading, with text saying what.', code: 'components/Spinner', role: 'img', keyboard: 'Not focusable; announced as “Loading”.', ...pairs.Spinner } });

  // ---------- pages ----------
  // Placed here, not when the file opens, so it's laid out the same in the browser and as a project file.
  // Component sets have fixed sizes; the other heights are as laid out (measured), with room to spare.
  const sets = [button, iconButton, textField, select, checkbox, radio, badge, banner, card, avatar, tab, tabs, modal, tooltip, spinner];
  const LAID_OUT = { Card: 166, Tabs: 45, Modal: 218, Tooltip: 24 };
  const heightOf = (n) => (n.type === 'componentSet' ? n.h : LAID_OUT[n.name] + 24);
  const column = (nodes, x) => nodes.reduce((y, n) => {
    Object.assign(n, { x, y });
    return y + heightOf(n) + 96;
  }, 0);
  column([button, iconButton, tab, tabs, modal, tooltip, spinner], 0);
  column([textField, select, checkbox, radio, badge, banner, card, avatar], 920);
  // Do and Don't side by side, a row per component, each row as tall as its taller example (measured) and more.
  const EXAMPLE_H = {
    Button: 179, 'Icon button': 178, 'Text field': 224, Select: 224, Checkbox: 226, 'Radio button': 226, Badge: 155, Banner: 212,
    Card: 418, Avatar: 162, Tabs: 179, Modal: 332, Tooltip: 186, Spinner: 154,
  };
  let y = 0;
  for (let i = 0; i < usage.length; i += 2) {
    const comp = usage[i].name.split(' · ')[0];
    Object.assign(usage[i], { x: 0, y });
    Object.assign(usage[i + 1], { x: 600, y });
    y += (EXAMPLE_H[comp] || 240) + 24 + 64;
  }
  const pages = [
    { id: 'optics-components', name: 'Components', background: '#F1F1F1', children: sets },
    { id: 'optics-usage', name: 'Usage', background: '#F1F1F1', children: usage },
  ];
  return { name: OPTICS_COMPONENTS_NAME, pages, currentPageId: pages[0].id };
}

// ---------- Optics Foundations ----------
export function opticsFoundationsDocument(collections, { icons = [] } = {}) {
  const K = kit(collections);
  const { text, para, icon, box, frame, modeOf } = K;
  const prim = collections.find((c) => c.name === 'Primitives');
  const sem = collections.find((c) => c.name === 'Semantic');
  const typo = collections.find((c) => c.name === 'Typography');
  const value = (v) => Object.values(v.valuesByMode)[0];
  const sheet = (title, intro, sections, o = {}) => frame(title, { dir: 'vertical', gap: '1000', pad: '1200', fill: 'bg/surface/default', radius: '400', ...o }, [
    box('frame', 'Header', { dir: 'vertical', gap: '200', w: 720 }, [
      text('Title', title, 'text/default', 'heading/2xl'),
      para('Intro', intro, 'text/secondary', 'body/lg'),
    ]),
    ...sections,
  ]);
  const section = (title, children, o = {}) => box('frame', title, { dir: 'vertical', gap: '400', ...o }, [text('Heading', title, 'text/default', 'heading/lg'), ...children]);
  const label = (name, value2 = null) => box('frame', 'Label', { dir: 'vertical', gap: '050' }, [
    text('Name', name, 'text/default', 'body/sm-medium'), ...(value2 !== null ? [text('Value', String(value2), 'text/secondary', 'body/sm')] : []),
  ]);
  const page = (id, name, child) => ({ id, name, background: '#F1F1F1', children: [Object.assign(child, { x: 0, y: 0 })] });

  // ---------- Color ----------
  const scales = {};
  for (const v of prim.variables.filter((x) => x.type === 'color')) {
    const [, hue, step] = v.name.split('/');
    (scales[hue] ||= []).push({ step, v });
  }
  const palette = Object.entries(scales).map(([hue, steps]) => box('frame', hue, { dir: 'horizontal', gap: '300', alignC: 'center' }, [
    box('frame', 'Hue', { w: 96, dir: 'vertical' }, [text('Name', hue, 'text/default', 'body/md-semibold')]),
    ...steps.map(({ step, v }) => box('frame', `color/${hue}/${step}`, { dir: 'vertical', gap: '100', w: 64 }, [
      Object.assign(box('frame', 'Swatch', { w: 64, h: 48, radius: '200', stroke: 'border/default' }), {
        fills: [makePaint('#000000')], bindings: { ...{}, 'fills.0.color': v.id, radius: K.P('radius/200'), 'strokes.0.color': K.S('border/default') },
      }),
      label(step, String(value(v)).toUpperCase()),
    ])),
  ]));
  // Semantic roles in one mode: backgrounds and borders as swatches, text and icons as samples on their surface.
  const roles = (modeName) => {
    const of = (prefix) => sem.variables.filter((v) => v.type === 'color' && v.name.startsWith(prefix));
    const swatchRow = (v) => box('frame', v.name, { dir: 'horizontal', gap: '200', alignC: 'center' }, [
      Object.assign(box('frame', 'Swatch', { w: 32, h: 32, radius: '200', stroke: 'border/default' }), { fills: [makePaint('#000000')], bindings: { 'fills.0.color': v.id, radius: K.P('radius/200'), 'strokes.0.color': K.S('border/default') } }),
      text('Name', v.name, 'text/default', 'body/sm'),
    ]);
    // Text samples sit on the surface they're for, so their contrast is real.
    const surfaceFor = (name) => {
      const tone = name.split('/')[1];
      if (name === 'text/on-fill' || name === 'icon/on-fill') return 'bg/fill/brand';
      if (name.endsWith('/inverse')) return 'bg/surface/inverse';
      if (['critical', 'success', 'warning', 'caution', 'info', 'magic'].includes(tone)) return `bg/surface/${tone}`;
      return 'bg/surface/default';
    };
    const textRow = (v) => box('frame', v.name, { dir: 'horizontal', gap: '200', alignC: 'center' }, [
      box('frame', 'Sample', { dir: 'horizontal', px: '200', py: '100', radius: '200', fill: surfaceFor(v.name), stroke: 'border/default' }, [
        Object.assign(text('Aa', 'Aa', 'text/default', 'body/md-semibold'), { bindings: { 'fills.0.color': v.id, typography: K.T('body/md-semibold') } }),
      ]),
      text('Name', v.name, 'text/default', 'body/sm'),
    ]);
    const column = (title, rows) => box('frame', title, { dir: 'vertical', gap: '200', w: 260 }, [text('Heading', title, 'text/default', 'heading/xs'), ...rows]);
    return frame(modeName, { dir: 'vertical', gap: '400', pad: '600', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', modes: modeOf(modeName) }, [
      text('Mode', modeName, 'text/default', 'heading/md'),
      box('frame', 'Roles', { dir: 'horizontal', gap: '600' }, [
        column('Backgrounds', of('bg/').map(swatchRow)),
        column('Text', of('text/').map(textRow)),
        column('Borders', of('border/').map(swatchRow)),
        column('Icons', of('icon/').map(swatchRow)),
      ]),
    ]);
  };
  const color = sheet('Color', 'Optics colors come in two layers. Primitives are the palette; Semantic tokens say what a color is for (a surface, critical text, the focus ring) and change with Light and Dark. Designs only use Semantic tokens.', [
    section('Palette', palette),
    section('Semantic roles', [roles('Light'), roles('Dark')]),
  ]);

  // ---------- Typography ----------
  const typeRows = typo.variables.map((v) => {
    const val = value(v);
    const prim2 = (f) => {
      const a = val[f]?.alias;
      return a ? value(prim.variables.find((x) => x.id === a)) : val[f];
    };
    return box('frame', v.name, { dir: 'horizontal', gap: '600', alignC: 'center' }, [
      box('frame', 'Spec', { dir: 'vertical', gap: '050', w: 200 }, [
        text('Name', v.name, 'text/default', 'body/md-semibold'),
        text('Values', `${prim2('fontSize')}px · ${prim2('lineHeight')}% · ${prim2('fontWeight')}`, 'text/secondary', 'body/sm'),
      ]),
      Object.assign(text('Sample', 'Sell anywhere, from one place', 'text/default', 'body/md'), { bindings: { 'fills.0.color': K.S('text/default'), typography: v.id } }),
    ]);
  });
  const type = sheet('Typography', 'Text styles combine a font, size, weight, line height and letter spacing. Headings title pages and sections; body styles carry text and controls. Optics uses Inter.', [section('Text styles', typeRows)]);

  // ---------- Spacing and radius ----------
  const spaceRows = prim.variables.filter((v) => v.name.startsWith('space/') && value(v) > 0).map((v) => box('frame', v.name, { dir: 'horizontal', gap: '400', alignC: 'center' }, [
    box('frame', 'Spec', { dir: 'vertical', w: 160 }, [label(v.name, `${value(v)}px`)]),
    Object.assign(box('frame', 'Bar', { h: 16, fill: 'bg/fill/brand', radius: '100' }), { bindings: { 'fills.0.color': K.S('bg/fill/brand'), radius: K.P('radius/100'), 'layout.pl': v.id } }),
  ]));
  const spacing = sheet('Spacing', 'Spacing is a 4px grid. A step’s name is in hundredths of 4px: space/100 is 4px, space/400 is 16px. Use it for padding and gaps.', [section('Scale', spaceRows)]);
  const radiusTiles = prim.variables.filter((v) => v.name.startsWith('radius/')).map((v) => box('frame', v.name, { dir: 'vertical', gap: '200', alignC: 'center' }, [
    Object.assign(box('frame', 'Tile', { w: 72, h: 72, fill: 'bg/surface/selected', stroke: 'border/brand' }), { bindings: { 'fills.0.color': K.S('bg/surface/selected'), 'strokes.0.color': K.S('border/brand'), radius: v.id } }),
    label(v.name, value(v) === 9999 ? 'full' : `${value(v)}px`),
  ]));
  const radius = sheet('Radius', 'Corner radii, from square to fully round. Controls use radius/200; cards radius/300; dialogs radius/400.', [section('Scale', [box('frame', 'Tiles', { dir: 'horizontal', gap: '600' }, radiusTiles)])]);

  // ---------- Elevation ----------
  const shadows = sem.variables.filter((v) => v.type === 'shadow');
  const elevationRow = (modeName) => frame(`Elevation · ${modeName}`, { dir: 'horizontal', gap: '800', pad: '800', fill: 'bg/page', radius: '300', modes: modeOf(modeName) },
    shadows.map((v) => {
      const card = box('frame', v.name, { w: 140, h: 96, pad: '300', fill: 'bg/surface/default', radius: '300', shadow: '100' }, [text('Name', v.name, 'text/default', 'body/sm-medium')]);
      card.bindings['effects.0'] = v.id; // this level's shadow
      return card;
    }));
  const elevation = sheet('Elevation', 'Shadows lift surfaces off the page: shadow/100 for cards, 300 for menus and tooltips, 600 for dialogs. Dark mode uses darker shadows, so they still show.', [section('Light', [elevationRow('Light')]), section('Dark', [elevationRow('Dark')])]);

  // ---------- Motion ----------
  const motionRows = prim.variables.filter((v) => v.type === 'duration' || v.type === 'easing').map((v) => box('frame', v.name, { dir: 'horizontal', gap: '400', alignC: 'center' }, [
    box('frame', 'Spec', { dir: 'vertical', w: 200 }, [label(v.name, v.type === 'duration' ? `${value(v)}ms` : `cubic-bezier(${value(v).join(', ')})`)]),
    para('Use', v.description || (v.type === 'duration' ? (value(v) <= 100 ? 'Hover and press feedback.' : value(v) <= 250 ? 'Menus, tooltips and small movements.' : 'Dialogs and large movements.') : ''), 'text/secondary', 'body/sm', { w: 360, sizingH: 'fixed' }),
  ]));
  const motion = sheet('Motion', 'Durations and easing curves for transitions. Small changes are fast; big movements take longer. Respect reduced motion: skip movement, keep the change.', [section('Durations and easing', motionRows)]);

  // ---------- Icons ----------
  const groups = {};
  for (const ic of icons.filter((x) => x.style === 'outline')) (groups[ic.group] ||= []).push(ic);
  // A row of examples per group (the whole set is in Optics Icons, with search). Each is an instance of an Icon
  // tile component (icons go inside main components), choosing its icon and name.
  const SHOWN = 12;
  const tileIcon = 'optics-tile-icon', tileName = 'optics-tile-name';
  const first = icons.find((x) => x.style === 'outline');
  const tile = first && box('component', 'Icon tile', { dir: 'vertical', gap: '100', w: 112, pad: '200', alignC: 'center', radius: '200', stroke: 'border/default' }, [
    icon('Icon', first.id, 'icon/default', 24, { propRefs: { iconId: tileIcon } }),
    text('Name', first.name, 'text/secondary', 'body/sm', { propRefs: { text: tileName } }),
  ]);
  if (tile) {
    tile.props = { [tileIcon]: { name: 'Icon', type: 'icon', default: first.id }, [tileName]: { name: 'Name', type: 'text', default: first.name } };
    tile.description = 'One icon and its name, for the Icons page.';
  }
  const tileOf = (ic) => createNode('instance', { name: ic.name, componentId: tile.id, w: tile.w, h: tile.h, overrides: {}, children: [], propValues: { [tileIcon]: ic.id, [tileName]: ic.name } });
  const iconRows = Object.entries(groups).map(([g, list]) => box('frame', g, { dir: 'vertical', gap: '200' }, [
    text('Group', list.length > SHOWN ? `${g} · ${list.length} icons` : g, 'text/default', 'heading/xs'),
    box('frame', 'Icons', { dir: 'horizontal', gap: '200' }, list.slice(0, SHOWN).map(tileOf)),
  ]));
  const total = icons.filter((x) => x.style === 'outline').length;
  const iconSheet = sheet('Icons', `Optics Icons is the whole Lucide set from Sigma Icons: ${total.toLocaleString()} outline icons, 24px with a 2px stroke, colored with the icon tokens. Here are some from each group; open Optics Icons to see and search them all. Pick icons people already know, and name icon-only controls for screen readers.`,
    iconRows.length ? [section('Icon tile', [tile]), section('Optics Icons', iconRows)] : [para('None', 'Optics Icons couldn’t be made, so this page has no icons.', 'text/secondary', 'body/md')]);

  const pages = [
    page('optics-color', 'Color', color), page('optics-typography', 'Typography', type), page('optics-spacing', 'Spacing', spacing),
    page('optics-radius', 'Radius', radius), page('optics-elevation', 'Elevation', elevation), page('optics-motion', 'Motion', motion),
    page('optics-icons', 'Icons', iconSheet),
  ];
  return { name: OPTICS_FOUNDATIONS_NAME, pages, currentPageId: pages[0].id };
}
