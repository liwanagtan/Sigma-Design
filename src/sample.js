import { createNode, uid, makePaint } from './store.js';
import { DEFAULT_LAYOUT } from './layout.js';

const autoLayout = (props) => ({ ...DEFAULT_LAYOUT, ...props });

const text = (props) => createNode('text', { autoResize: 'width', ...props, name: props.name || props.text.slice(0, 30) });

export function sampleDocument({ blank = false } = {}) {
  const page1 = { id: uid(), name: 'Page 1', background: '#F5F5F5', children: [] };
  const doc = { name: 'Untitled', pages: [page1], currentPageId: page1.id };
  if (blank) return doc;

  doc.name = 'Welcome to Sigma';
  const hero = createNode('frame', { name: 'Desktop', x: 0, y: 0, w: 960, h: 600, fill: '#FFFFFF' });
  hero.children.push(
    createNode('rect', { name: 'Nav', x: 0, y: 0, w: 960, h: 64, fill: '#FFFFFF', stroke: '#E6E6E6' }),
    createNode('ellipse', { name: 'Logo', x: 32, y: 20, w: 24, h: 24, fill: '#0D99FF' }),
    text({ text: 'Sigma', x: 66, y: 21, fontSize: 18, fontWeight: 700, w: 60, h: 22 }),
    text({ text: 'Design on an infinite canvas', x: 64, y: 160, fontSize: 48, fontWeight: 700, letterSpacing: -1, w: 640, h: 58 }),
    text({ text: 'Draw frames, shapes and text. Drag, resize, rotate, and snap\nwith smart guides — all in your browser.', x: 64, y: 236, fontSize: 18, lineHeight: 150, fill: '#555555', w: 520, h: 54 }),
    button(),
    createNode('rect', { name: 'Card', x: 600, y: 300, w: 280, h: 220, radius: 16, fill: '#FFC700', rotation: -6 }),
    createNode('ellipse', { name: 'Blob', x: 720, y: 360, w: 180, h: 180, fill: '#9747FF', fillOpacity: 0.85 }),
  );
  // Vertical auto layout screen: children fill the width, the row splits its width between two tiles.
  const mobile = createNode('frame', {
    name: 'Mobile', x: 1040, y: 0, w: 390, h: 600, fill: '#1E1E1E',
    layout: autoLayout({ mode: 'vertical', gap: 16, pt: 64, pr: 24, pb: 24, pl: 24 }), sizingH: 'fixed', sizingV: 'fixed',
  });
  const row = createNode('frame', {
    name: 'Row', fill: null, w: 342, h: 160,
    layout: autoLayout({ mode: 'horizontal', gap: 16 }), sizingH: 'fill', sizingV: 'hug',
  });
  row.children.push(
    createNode('rect', { name: 'Tile', w: 163, h: 160, radius: 20, fill: '#F24822', sizingH: 'fill' }),
    createNode('rect', { name: 'Tile', w: 163, h: 160, radius: 20, fill: '#0D99FF', sizingH: 'fill' }),
  );
  mobile.children.push(
    text({ text: 'Hello 👋', fontSize: 32, fontWeight: 700, fill: '#FFFFFF' }),
    createNode('rect', { name: 'Tile', w: 342, h: 160, radius: 20, fill: '#14AE5C', sizingH: 'fill' }),
    row,
    createNode('line', { name: 'Divider', w: 342, h: 0, stroke: '#444444', strokeWidth: 1, sizingH: 'fill' }),
  );
  page1.children.push(hero, mobile);
  const ds = designSystemPage();
  doc.pages.push(ds.page);
  doc.variables = { collections: ds.collections };
  return doc;
}

// ---------- "Design system" page: variables, modes, an extended collection, components ----------
function designSystemPage() {
  const light = uid(), dark = uid();
  const v = (name, type, l, d = l) => ({ id: uid(), name, type, valuesByMode: { [light]: l, [dark]: d } });
  const bg = v('bg', 'color', '#FFFFFF', '#1E1E1E');
  const surface = v('surface', 'color', '#F5F5F5', '#2C2C2C');
  const text = v('text/primary', 'color', '#1E1E1E', '#FFFFFF');
  const muted = v('text/muted', 'color', '#6B6B6B', '#B3B3B3');
  const primary = v('brand/primary', 'color', '#0D99FF', '#3DADFF');
  const onPrimary = v('brand/on-primary', 'color', '#FFFFFF', '#FFFFFF');
  const color = {
    id: uid(), name: 'Color', modes: [{ id: light, name: 'Light' }, { id: dark, name: 'Dark' }], defaultModeId: light,
    variables: [bg, surface, text, muted, primary, onPrimary],
  };
  // "Brand B" re-skins the same tokens: only the brand colors change.
  const bLight = uid(), bDark = uid();
  const brandB = {
    id: uid(), name: 'Brand B', extends: color.id, defaultModeId: bLight, variables: [],
    modes: [{ id: bLight, name: 'Light', parentModeId: light }, { id: bDark, name: 'Dark', parentModeId: dark }],
    overrides: { [primary.id]: { [bLight]: '#F24822', [bDark]: '#FF7262' } },
  };
  const sm = uid();
  const radius = { id: uid(), name: 'radius/md', type: 'number', valuesByMode: { [sm]: 10 } };
  const gap = { id: uid(), name: 'space/gap', type: 'number', valuesByMode: { [sm]: 12 } };
  const spacing = { id: uid(), name: 'Spacing', modes: [{ id: sm, name: 'Default' }], defaultModeId: sm, variables: [radius, gap] };

  const fill = (varId, color = '#000000') => ({ fills: [makePaint(color)], bindings: { 'fills.0.color': varId } });
  const labelProp = uid();

  // Button component set: two variants sharing a "Label" text property.
  const button = (styleName, bgVar, textVar) => {
    const label = createNode('text', {
      name: 'Label', text: 'Button', fontSize: 14, fontWeight: 600, autoResize: 'width',
      ...fill(textVar), propRefs: { text: labelProp },
    });
    return createNode('component', {
      name: `Style=${styleName}`, x: 20, y: 20, w: 100, h: 40, clip: false,
      layout: autoLayout({ mode: 'horizontal', pt: 10, pb: 10, pl: 20, pr: 20, alignP: 'center', alignC: 'center' }),
      sizingH: 'hug', sizingV: 'hug', fills: [makePaint('#000000')],
      bindings: { 'fills.0.color': bgVar, radius: radius.id }, children: [label],
    });
  };
  const primaryBtn = button('Primary', primary.id, onPrimary.id);
  const secondaryBtn = button('Secondary', surface.id, text.id);
  secondaryBtn.x = 160;
  const buttonSet = createNode('componentSet', {
    name: 'Button', x: 0, y: 0, w: 300, h: 80, fills: [], clip: false,
    props: { [labelProp]: { name: 'Label', type: 'text', default: 'Button' } },
    children: [primaryBtn, secondaryBtn],
  });

  const instanceOf = (main, props = {}) => createNode('instance', {
    name: 'Button', componentId: main.id, w: main.w, h: main.h, overrides: {}, children: [], ...props,
  });

  // Card component that uses the Button.
  const card = createNode('component', {
    name: 'Card', x: 0, y: 140, w: 280, h: 160, clip: true,
    layout: autoLayout({ mode: 'vertical', pt: 20, pr: 20, pb: 20, pl: 20 }), sizingH: 'fixed', sizingV: 'hug',
    ...fill(bg.id, '#FFFFFF'),
    children: [
      createNode('text', { name: 'Title', text: 'Design tokens', fontSize: 18, fontWeight: 700, autoResize: 'width', ...fill(text.id) }),
      createNode('text', { name: 'Body', text: 'Switch the frame mode to\nsee every layer follow.', fontSize: 13, lineHeight: 140, autoResize: 'width', ...fill(muted.id) }),
      instanceOf(primaryBtn, { propValues: { [labelProp]: 'Get started' } }),
    ],
  });
  card.bindings.radius = radius.id;
  card.bindings['layout.gap'] = gap.id;

  // Showcase: the same Card in three variable contexts.
  const showcase = (name, x, modes) => createNode('frame', {
    name, x, y: 380, w: 320, h: 220, ...fill(surface.id, '#F5F5F5'), modes,
    children: [createNode('instance', { name: 'Card', componentId: card.id, x: 20, y: 20, w: card.w, h: card.h, overrides: {}, children: [] })],
  });
  const page = {
    id: uid(), name: 'Design system', background: '#F5F5F5',
    children: [
      buttonSet, card,
      showcase('Light', 0, undefined),
      showcase('Dark', 360, { [color.id]: dark }),
      showcase('Brand B', 720, { [brandB.id]: bLight }),
    ],
  };
  return { page, collections: [color, brandB, spacing] };
}

// Hug-contents button: edit the label and the button grows with it.
function button() {
  const btn = createNode('frame', {
    name: 'Button', x: 64, y: 320, w: 160, h: 48, radius: 8, fill: '#0D99FF', clip: false,
    layout: autoLayout({ mode: 'horizontal', gap: 8, pt: 14, pb: 14, pl: 24, pr: 24, alignP: 'center', alignC: 'center' }),
    sizingH: 'hug', sizingV: 'hug',
  });
  btn.children.push(text({ text: 'Get started', fontSize: 16, fontWeight: 600, fill: '#FFFFFF' }));
  return btn;
}
