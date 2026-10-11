import { createNode, uid, makePaint } from './store.js';
import { DEFAULT_LAYOUT } from './layout.js';

const autoLayout = (props) => ({ ...DEFAULT_LAYOUT, ...props });

export function blankDocument() {
  const page = { id: uid(), name: 'Page 1', background: '#F5F5F5', children: [] };
  return { name: 'Untitled', pages: [page], currentPageId: page.id };
}

// The sample design file: components built entirely from the sample token file's tokens
// (sample-tokens.js), which it links as a library. `collections` are that file's published collections;
// throws if a token, collection or mode it uses is missing (or a token has another type).
export function sampleDocument(collections) {
  const col = (name) => {
    const c = collections.find((x) => x.name === name);
    if (!c) throw new Error(`Sample collection ${name} is missing`);
    return c;
  };
  const mode = (c, name) => {
    const m = c.modes.find((x) => x.name === name);
    if (!m) throw new Error(`Sample mode ${c.name} ${name} is missing`);
    return m.id;
  };
  const token = (colName, path, type = null) => {
    const v = col(colName).variables.find((x) => x.name === path);
    if (!v || (type && v.type !== type)) throw new Error(`Sample token ${colName} ${path} is missing`);
    return v.id;
  };
  const C = (path, type) => token('Components', path, type);
  const S = (path) => token('Semantic', path);
  const T = (path) => token('Typography', path);
  const P = (path) => token('Primitives', path);

  const padding = (varId) => ({ 'layout.pt': varId, 'layout.pr': varId, 'layout.pb': varId, 'layout.pl': varId });
  const text = (name, value, colorVar, typoVar, props = {}) => createNode('text', {
    name, text: value, autoResize: 'width', ...props,
    fills: [makePaint('#000000')], bindings: { 'fills.0.color': colorVar, typography: typoVar },
  });

  // Button component set: two variants sharing a "Label" text property.
  const labelProp = uid();
  const button = (style, x) => {
    const s = style.toLowerCase();
    const label = text('Label', 'Button', C(`button/${s}/text`), C('button/label'), { propRefs: { text: labelProp } });
    const bindings = {
      'fills.0.color': C(`button/${s}/background`), radius: C('button/radius'), 'layout.gap': C('button/gap'),
      'layout.pl': C('button/padding-x'), 'layout.pr': C('button/padding-x'),
      'layout.pt': C('button/padding-y'), 'layout.pb': C('button/padding-y'),
    };
    const props = {};
    if (s === 'secondary') {
      props.strokes = [makePaint('#000000')];
      bindings['strokes.0.color'] = C('button/secondary/border');
    }
    return createNode('component', {
      name: `Style=${style}`, x, y: 20, w: 100, h: 40, clip: false,
      layout: autoLayout({ mode: 'horizontal', alignP: 'center', alignC: 'center' }),
      sizingH: 'hug', sizingV: 'hug', fills: [makePaint('#000000')], ...props, bindings, children: [label],
    });
  };
  const primaryBtn = button('Primary', 20);
  const secondaryBtn = button('Secondary', 160);
  const buttonSet = createNode('componentSet', {
    name: 'Button', x: 0, y: 0, w: 300, h: 80, fills: [], clip: false,
    props: { [labelProp]: { name: 'Label', type: 'text', default: 'Button' } },
    children: [primaryBtn, secondaryBtn],
  });

  // Card component that uses the Button.
  const card = createNode('component', {
    name: 'Card', x: 0, y: 140, w: 280, h: 160, clip: true,
    layout: autoLayout({ mode: 'vertical' }), sizingH: 'fixed', sizingV: 'hug',
    fills: [makePaint('#FFFFFF')], strokes: [makePaint('#000000')],
    effects: [{ type: 'drop-shadow', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0, visible: true }],
    bindings: {
      'fills.0.color': C('card/background'), 'strokes.0.color': C('card/border'), 'effects.0': C('card/shadow', 'shadow'),
      radius: C('card/radius'), ...padding(C('card/padding')), 'layout.gap': P('space/3'),
    },
    children: [
      text('Title', 'Design tokens', S('text/primary'), T('heading/h3')),
      text('Body', 'Switch the frame mode to\nsee every layer follow.', S('text/secondary'), T('body/small')),
      createNode('instance', {
        name: 'Button', componentId: primaryBtn.id, w: primaryBtn.w, h: primaryBtn.h,
        overrides: {}, children: [], propValues: { [labelProp]: 'Get started' },
      }),
    ],
  });

  // Showcase: the same Card in three token contexts.
  const semantic = col('Semantic'), brand = col('Brand B');
  const showcase = (name, x, modes) => createNode('frame', {
    name, x, y: 420, w: 328, h: 228, modes, clip: false,
    layout: autoLayout({ mode: 'vertical' }), sizingH: 'hug', sizingV: 'hug',
    fills: [makePaint('#FFFFFF')], bindings: { 'fills.0.color': S('surface/sunken'), ...padding(P('space/6')) },
    children: [createNode('instance', { name: 'Card', componentId: card.id, w: card.w, h: card.h, overrides: {}, children: [] })],
  });
  // A page-width frame on the layout grid: 12 columns, with gutter and margin from the spacing scale.
  const layout = createNode('frame', {
    name: 'Layout grid', x: 0, y: 720, w: 1088, h: 200, clip: true,
    fills: [makePaint('#FFFFFF')], bindings: { 'fills.0.color': S('surface/default') },
    layoutGrids: [{ type: 'columns', count: 12, align: 'stretch', size: 64, gutter: 24, margin: 32, color: '#FF0000', opacity: 0.1, visible: true }],
    children: [
      text('Title', 'Layout grid', S('text/primary'), T('heading/h3'), { x: 32, y: 32 }),
      text('Body', '12 columns. The gutter and margin are layout tokens that point at the spacing scale.\nPress ⌃G to show or hide layout grids.', S('text/secondary'), T('body/small'), { x: 32, y: 68 }),
    ],
  });
  for (const [k, path] of [['count', 'layout/columns'], ['gutter', 'layout/gutter'], ['margin', 'layout/margin']]) layout.bindings[`layoutGrids.0.${k}`] = P(path);
  const page = {
    id: uid(), name: 'Design system', background: '#F5F5F5',
    children: [
      buttonSet, card,
      showcase('Light', 0, undefined),
      showcase('Dark', 380, { [semantic.id]: mode(semantic, 'Dark') }),
      showcase('Brand B', 760, { [brand.id]: mode(brand, 'Light') }),
      layout,
    ],
  };
  return { name: 'Sample design file', pages: [page], currentPageId: page.id };
}
