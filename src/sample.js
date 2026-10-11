import { createNode, uid, makePaint } from './store.js';
import { DEFAULT_LAYOUT } from './layout.js';

const autoLayout = (props) => ({ ...DEFAULT_LAYOUT, ...props });

export function blankDocument() {
  const page = { id: uid(), name: 'Page 1', background: '#F5F5F5', children: [] };
  return { name: 'Untitled', pages: [page], currentPageId: page.id };
}

// The sample design file: components built entirely from the sample token file's tokens
// (sample-tokens.js), which it links as a library. `collections` are that file's collections.
export function sampleDocument(collections) {
  const col = (name) => collections.find((c) => c.name === name);
  const token = (colName, path) => {
    const v = col(colName).variables.find((x) => x.name === path);
    if (!v) throw new Error(`Sample token ${colName} ${path} is missing`);
    return v.id;
  };
  const C = (path) => token('Components', path);
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
    bindings: {
      'fills.0.color': C('card/background'), 'strokes.0.color': C('card/border'),
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
  const page = {
    id: uid(), name: 'Design system', background: '#F5F5F5',
    children: [
      buttonSet, card,
      showcase('Light', 0, undefined),
      showcase('Dark', 380, { [semantic.id]: semantic.modes[1].id }),
      showcase('Brand B', 760, { [brand.id]: brand.modes[0].id }),
    ],
  };
  return { name: 'Sample design file', pages: [page], currentPageId: page.id };
}
