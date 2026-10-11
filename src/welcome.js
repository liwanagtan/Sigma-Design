// "Welcome to Sigma": the file a new user starts with. Each page pairs a short guide with live examples,
// and everything in it is built from the sample tokens (sample-tokens.js), which it links as its Sigma
// Tokens file. It replaces the old sample design file.
//
// Bump WELCOME_VERSION whenever the content changes: "Open Welcome to Sigma" then makes a fresh copy
// instead of reopening an older one.
import { createNode, uid, makePaint } from './store.js';
import { DEFAULT_LAYOUT } from './layout.js';

export const WELCOME_VERSION = 1;
export const WELCOME_NAME = 'Welcome to Sigma';

const autoLayout = (props) => ({ ...DEFAULT_LAYOUT, ...props });

// `collections` are the sample tokens' published collections. Throws if a token, collection or mode it
// uses is missing (or a token has another type), so an edited copy of the sample tokens is never linked.
export function welcomeDocument(collections) {
  // ---------- tokens ----------
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
  const semantic = col('Semantic'), brand = col('Brand B');

  // ---------- building blocks ----------
  const fillOf = (varId) => ({ fills: [makePaint('#000000')], bindings: { 'fills.0.color': varId } });
  const pad = (varId) => ({ 'layout.pt': varId, 'layout.pr': varId, 'layout.pb': varId, 'layout.pl': varId });
  const text = (name, value, colorVar, typoVar, props = {}) => createNode('text', {
    name, text: value, autoResize: 'width', ...props,
    fills: [makePaint('#000000')], bindings: { 'fills.0.color': colorVar, typography: typoVar, ...(props.bindings || {}) },
  });
  // Wrapping text that fills its auto layout parent's width.
  const para = (value, { color = S('text/primary'), typo = T('body/default'), name } = {}) =>
    text(name || value.slice(0, 40), value, color, typo, { autoResize: 'height', w: 440, h: 24, sizingH: 'fill' });
  const stack = (name, dir, { gap = P('space/2'), padding = null, fill = null, radius = null, stroke = null, width = null, props = {} } = {}, children = []) => {
    const n = createNode('frame', {
      name, clip: false, w: width || 100, h: 100, fills: [], children,
      layout: autoLayout({ mode: dir }), sizingH: width ? 'fixed' : 'hug', sizingV: 'hug', ...props,
    });
    n.bindings = { 'layout.gap': gap, ...(padding ? pad(padding) : {}) };
    if (fill) Object.assign(n, { fills: [makePaint('#FFFFFF')] }, { bindings: { ...n.bindings, 'fills.0.color': fill } });
    if (stroke) Object.assign(n, { strokes: [makePaint('#000000')] }, { bindings: { ...n.bindings, 'strokes.0.color': stroke } });
    if (radius) n.bindings.radius = radius;
    return n;
  };
  const fillWidth = (n) => Object.assign(n, { sizingH: 'fill' });

  // A guide: the column on the left of every page.
  const guide = (step, title, intro, sections) => {
    const parts = [
      text('Kicker', step, S('text/secondary'), T('label/small'), { textCase: 'upper' }),
      fillWidth(text('Title', title, S('text/primary'), T('heading/h1'), { autoResize: 'height', w: 440 })),
      para(intro, { name: 'Intro' }),
    ];
    for (const s of sections) {
      const items = [fillWidth(text('Heading', s.h, S('text/primary'), T('heading/h3'), { autoResize: 'height', w: 440 }))];
      for (const p of s.p || []) items.push(para(p));
      for (const b of s.bullets || []) items.push(para(`•  ${b}`, { name: 'Bullet' }));
      for (const [key, does] of s.keys || []) {
        items.push(fillWidth(stack('Shortcut', 'horizontal', { gap: P('space/3'), props: { layout: autoLayout({ mode: 'horizontal', alignC: 'center' }) } }, [
          stack('Keys', 'horizontal', { width: 84 }, [
            stack('Key', 'horizontal', { padding: P('space/1'), fill: S('surface/sunken'), radius: P('radius/sm') }, [text('Key', key, S('text/primary'), T('code'))]),
          ]),
          para(does, { name: does, typo: T('body/small') }),
        ])));
      }
      parts.push(fillWidth(stack(s.h, 'vertical', { gap: P('space/2') }, items)));
    }
    return { parts };
  };
  const guideFrame = (g) => createNode('frame', {
    name: 'Guide', x: 0, y: 0, w: 520, h: 400, clip: false, fills: [makePaint('#FFFFFF')], strokes: [makePaint('#000000')],
    layout: autoLayout({ mode: 'vertical' }), sizingH: 'fixed', sizingV: 'hug',
    bindings: { 'fills.0.color': S('surface/default'), 'strokes.0.color': S('border/default'), radius: P('radius/lg'), 'layout.gap': P('space/6'), ...pad(P('space/10')) },
    children: g.parts,
  });
  // A "Try it" note.
  const tryIt = (value) => fillWidth(stack('Try it', 'vertical', { gap: P('space/1'), padding: P('space/4'), fill: S('accent/subtle'), radius: P('radius/md') }, [
    text('Label', 'Try it', S('text/link'), T('label/default'), { textCase: 'upper' }),
    para(value, { typo: T('body/small') }),
  ]));
  // A titled example area to the right of the guide.
  const example = (name, x, y, children, { width = null, note = null } = {}) => {
    const items = [text('Title', name, S('text/secondary'), T('label/default'), { textCase: 'upper' })];
    if (note) items.push(width ? para(note, { typo: T('body/small'), color: S('text/secondary') }) : text('Note', note, S('text/secondary'), T('body/small')));
    items.push(...children);
    const n = stack(name, 'vertical', { gap: P('space/4'), padding: P('space/6'), fill: S('surface/default'), radius: P('radius/lg'), stroke: S('border/default'), width }, items);
    return Object.assign(n, { x, y });
  };
  const row = (name, children, gap = P('space/3'), alignC = 'center') => stack(name, 'horizontal', { gap, props: { layout: autoLayout({ mode: 'horizontal', alignC }) } }, children);
  // `columns`: examples stacked top to bottom by their real heights when the file is first opened.
  const page = (name, children, columns = []) => ({ id: uid(), name, background: '#F5F5F5', children, ...(columns.length ? { welcomeColumns: columns.map((c) => c.map((n) => n.id)) } : {}) });

  // ---------- components (shared by several pages) ----------
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
    name: 'Button', x: 600, y: 0, w: 300, h: 80, fills: [], clip: false,
    description: 'Calls to action. Primary for the main action on a screen, Secondary for the others.',
    props: { [labelProp]: { name: 'Label', type: 'text', default: 'Button' } },
    children: [primaryBtn, secondaryBtn],
  });
  const buttonInstance = (main, label, props = {}) => createNode('instance', {
    name: 'Button', componentId: main.id, w: main.w, h: main.h, overrides: {}, children: [], propValues: { [labelProp]: label }, ...props,
  });

  const card = createNode('component', {
    name: 'Card', x: 600, y: 140, w: 280, h: 160, clip: true,
    description: 'A raised surface that groups related content, with an optional action.',
    layout: autoLayout({ mode: 'vertical' }), sizingH: 'fixed', sizingV: 'hug',
    fills: [makePaint('#FFFFFF')], strokes: [makePaint('#000000')],
    effects: [{ type: 'drop-shadow', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0, visible: true }],
    bindings: {
      'fills.0.color': C('card/background'), 'strokes.0.color': C('card/border'), 'effects.0': C('card/shadow', 'shadow'),
      radius: C('card/radius'), ...pad(C('card/padding')), 'layout.gap': P('space/3'),
    },
    children: [
      text('Title', 'Design tokens', S('text/primary'), T('heading/h3')),
      text('Body', 'Switch the frame’s mode to\nsee every layer follow.', S('text/secondary'), T('body/small')),
      buttonInstance(primaryBtn, 'Get started'),
    ],
  });
  const cardInstance = (props = {}) => createNode('instance', { name: 'Card', componentId: card.id, w: card.w, h: card.h, overrides: {}, children: [], ...props });

  // ---------- 1. Start here ----------
  const start = guide('Start here · 1 of 9', 'Welcome to Sigma', 'Sigma is a design tool for building a design system and designing with it, right in your browser. Your files are saved in this browser; nothing leaves it unless you download or export it.', [
    { h: 'Two kinds of file', bullets: [
      'Sigma Design files have a canvas: pages, frames, components and layouts. This file is one.',
      'Sigma Tokens files hold design tokens (colors, spacing, type, shadows, motion) and have no canvas. They’re published for Sigma Design files to use.',
    ] },
    { h: 'How they connect', p: [
      'This file uses the sample tokens (“Sample design tokens”). Every color, size, text style and shadow here comes from a token, so switching a mode or a brand restyles everything at once.',
      'When a Sigma Tokens file publishes a new version, the Sigma Design files that use it are offered the update.',
    ] },
    { h: 'Find your way', bullets: [
      'Layers and Assets are on the left. The right panel shows what you’ve selected, or this file’s tokens and libraries when nothing is.',
      'The Σ menu has your files, export, version history, tokens, libraries and the keyboard shortcuts (press ?).',
      'Back to files (Σ menu) goes to the files home. Deleted files wait in its Archive until you delete them forever.',
    ] },
    { h: 'Pages in this file', bullets: [
      '2 Canvas basics: tools, selecting, organizing',
      '3 Layout: auto layout, resizing, constraints, layout grids',
      '4 Components: variants, properties, instances',
      '5 Tokens in designs: using tokens, modes and brands',
      '6 Style: fills, effects, text styles, text case',
      '7 Quality checks: contrast, token audit, deprecation',
      '8 Libraries and versions: publishing, updates, history',
      '9 Sigma Tokens: how token files work',
    ] },
  ]);
  start.parts.push(tryIt('Pick a page in the Pages list on the left. Each one has a guide like this and examples to try on the right.'));
  const tokensBox = stack('Sigma Tokens', 'vertical', { gap: P('space/2'), padding: P('space/6'), fill: S('surface/default'), radius: P('radius/lg'), stroke: S('border/strong'), width: 300 }, [
    text('Kind', 'Sigma Tokens', S('text/link'), T('label/default'), { textCase: 'upper' }),
    text('Name', 'Sample design tokens', S('text/primary'), T('heading/h3')),
    para('Primitives → Semantic → Components, in Light and Dark, with a Brand B extension.', { typo: T('body/small'), color: S('text/secondary') }),
  ]);
  const designBox = stack('Sigma Design', 'vertical', { gap: P('space/2'), padding: P('space/6'), fill: S('surface/default'), radius: P('radius/lg'), stroke: S('border/strong'), width: 300 }, [
    text('Kind', 'Sigma Design', S('text/link'), T('label/default'), { textCase: 'upper' }),
    text('Name', WELCOME_NAME, S('text/primary'), T('heading/h3')),
    para('Pages, components and layouts whose colors, sizes and text styles are those tokens.', { typo: T('body/small'), color: S('text/secondary') }),
  ]);
  const arrow = stack('Publish and use', 'vertical', { gap: P('space/1'), props: { layout: autoLayout({ mode: 'vertical', alignC: 'center' }) } }, [
    text('Label', 'publish →', S('text/secondary'), T('label/default')),
    text('Label', '← accept updates', S('text/secondary'), T('label/small')),
  ]);
  const diagram = example('How the files connect', 600, 0, [row('Files', [tokensBox, arrow, designBox], P('space/6'))]);

  // ---------- 2. Canvas basics ----------
  const basics = guide('Canvas basics · 2 of 9', 'Canvas basics', 'Draw, select and arrange layers on an infinite canvas. Most of it works the way it does in Figma.', [
    { h: 'Tools', keys: [['V', 'Move'], ['H', 'Hand (or hold Space and drag)'], ['F', 'Frame (presets appear in the panel)'], ['R', 'Rectangle'], ['O', 'Ellipse'], ['L', 'Line'], ['T', 'Text'], ['⇧⌘K', 'Place an image']] },
    { h: 'Select and move', bullets: [
      'Click selects; ⇧-click adds. Drag on the canvas for a marquee.',
      '⌘-click selects deep inside groups and frames; double-click or Enter goes one level in, ⇧Enter one level out.',
      'Dragging snaps to other layers with red guides; hold ⌘ to place freely. Hold ⌥ to measure distances.',
      '⌥-drag or ⌘D duplicates; arrow keys nudge by 1 (⇧ for 10).',
    ] },
    { h: 'Organize', keys: [['⌘G', 'Group'], ['⌥⌘G', 'Frame the selection'], ['⇧⌘G', 'Ungroup'], ['⌘R', 'Rename'], ['⇧⌘H', 'Hide or show'], ['⇧⌘L', 'Lock or unlock'], ['⌘] / ⌘[', 'Bring forward / send backward']] },
    { h: 'View', keys: [['⇧1', 'Zoom to fit'], ['⇧2', 'Zoom to selection'], ['⇧0', 'Zoom to 100%'], ['⌘-scroll', 'Zoom; scroll or Space-drag to pan'], ['⌃G', 'Show or hide layout grids']] },
  ]);
  basics.parts.push(tryIt('Select two shapes on the right and press ⌘G to group them, then ⇧H to flip the group. Double-click the text to edit it. ⌘Z undoes anything.'));
  const shape = (type, name, colorVar, props) => createNode(type, { name, ...props, fills: [makePaint('#000000')], bindings: { ...(props.bindings || {}), 'fills.0.color': colorVar } });
  const practice = createNode('frame', {
    name: 'Practice area', x: 600, y: 0, w: 520, h: 360, clip: true, fills: [makePaint('#FFFFFF')], strokes: [makePaint('#000000')],
    bindings: { 'fills.0.color': S('surface/default'), 'strokes.0.color': S('border/default'), radius: P('radius/lg') },
    children: [
      text('Title', 'Practice area', S('text/secondary'), T('label/default'), { x: 24, y: 24, textCase: 'upper' }),
      shape('rect', 'Blue square', P('color/blue/500'), { x: 40, y: 80, w: 120, h: 120, bindings: { radius: P('radius/md') } }),
      shape('ellipse', 'Violet circle', P('color/violet/500'), { x: 200, y: 80, w: 120, h: 120 }),
      shape('rect', 'Green bar', P('color/green/500'), { x: 360, y: 80, w: 120, h: 48, rotation: -8 }),
      shape('rect', 'Amber bar', P('color/amber/500'), { x: 360, y: 152, w: 120, h: 48 }),
      text('Edit me', 'Double-click to edit me', S('text/primary'), T('heading/h3'), { x: 40, y: 240 }),
      text('Caption', 'Every color here comes from a primitive token.', S('text/secondary'), T('body/small'), { x: 40, y: 280 }),
    ],
  });

  // ---------- 3. Layout ----------
  const layoutGuide = guide('Layout · 3 of 9', 'Layout', 'Auto layout arranges layers in a row or a column, so designs adjust as content changes. Constraints and layout grids handle the rest.', [
    { h: 'Auto layout', keys: [['⇧A', 'Add auto layout to a frame or the selection'], ['⌥⇧A', 'Remove it']], bullets: [
      'Set the direction, gap, padding and alignment in the Auto layout section. Gap and padding can use spacing tokens.',
      'Drag a layer inside to reorder it, or use the arrow keys. Absolute position takes a layer out of the flow.',
    ] },
    { h: 'Resizing', bullets: [
      'Each layer is Fixed, Hug (fits its contents) or Fill (takes the space left), set per direction.',
      'The link button next to W and H locks the aspect ratio.',
    ] },
    { h: 'Constraints', p: ['Layers placed freely in a frame keep their place when the frame is resized: Left, Right, Left & right, Center or Scale (and the same vertically). Hold ⌘ while resizing to ignore them.'] },
    { h: 'Layout grids', p: ['Frames can have column, row and square grids, drawn on the canvas only. Layers snap to them, and ⌃G shows or hides them. Count, gutter and margin can use tokens, like the 12-column grid on the right.'] },
  ]);
  layoutGuide.parts.push(tryIt('Select a tag and press ⌘D: the row grows. Resize the Constraints frame by a corner and watch its layers keep their places.'));
  const chip = (label) => stack('Tag', 'horizontal', { gap: P('space/1'), padding: P('space/2'), fill: S('accent/subtle'), radius: P('radius/full') }, [text('Label', label, S('text/link'), T('label/default'))]);
  const tags = example('Auto layout: hug', 600, 0, [row('Tags', [chip('Design'), chip('Tokens'), chip('Components')], P('space/2'))], { note: 'The row hugs its tags; each tag hugs its label.' });
  const listRow = (label) => fillWidth(stack('Row', 'horizontal', { gap: P('space/3'), padding: P('space/3'), fill: S('surface/sunken'), radius: P('radius/sm') }, [
    text('Label', label, S('text/primary'), T('body/default')),
  ]));
  const list = example('Auto layout: fill', 600, 200, [listRow('Rows fill the width'), listRow('Padding and gap are space tokens'), listRow('Add one with ⌘D')], { width: 360, note: 'A fixed-width column; its rows fill it.' });
  const pinned = (name, props, value) => createNode('frame', {
    name, clip: false, w: 120, h: 32, ...props, fills: [makePaint('#000000')], layout: autoLayout({ mode: 'horizontal', alignP: 'center', alignC: 'center' }),
    sizingH: 'fixed', sizingV: 'fixed', bindings: { 'fills.0.color': S('accent/subtle'), radius: P('radius/sm') },
    children: [text('Label', value, S('text/link'), T('label/small'))],
  });
  const constraintsDemo = createNode('frame', {
    name: 'Constraints', x: 1040, y: 0, w: 360, h: 240, clip: true, fills: [makePaint('#FFFFFF')], strokes: [makePaint('#000000')],
    bindings: { 'fills.0.color': S('surface/default'), 'strokes.0.color': S('border/default'), radius: P('radius/lg') },
    children: [
      pinned('Top left', { x: 16, y: 16, constraints: { h: 'left', v: 'top' } }, 'Left · Top'),
      pinned('Top right', { x: 224, y: 16, constraints: { h: 'right', v: 'top' } }, 'Right · Top'),
      pinned('Center', { x: 120, y: 104, constraints: { h: 'center', v: 'center' } }, 'Center'),
      pinned('Bottom', { x: 16, y: 192, w: 328, constraints: { h: 'leftRight', v: 'bottom' } }, 'Left & right · Bottom'),
    ],
  });
  const gridFrame = createNode('frame', {
    name: 'Layout grid', x: 600, y: 480, w: 1088, h: 200, clip: true,
    fills: [makePaint('#FFFFFF')], strokes: [makePaint('#000000')],
    bindings: { 'fills.0.color': S('surface/default'), 'strokes.0.color': S('border/default'), radius: P('radius/lg') },
    layoutGrids: [{ type: 'columns', count: 12, align: 'stretch', size: 64, gutter: 24, margin: 32, color: '#FF0000', opacity: 0.1, visible: true }],
    children: [
      text('Title', 'Layout grid', S('text/primary'), T('heading/h3'), { x: 32, y: 32 }),
      text('Body', '12 columns. The gutter and margin are layout tokens that point at the spacing scale.\nPress ⌃G to show or hide layout grids.', S('text/secondary'), T('body/small'), { x: 32, y: 68 }),
    ],
  });
  for (const [k, path] of [['count', 'layout/columns'], ['gutter', 'layout/gutter'], ['margin', 'layout/margin']]) gridFrame.bindings[`layoutGrids.0.${k}`] = P(path);

  // ---------- 4. Components ----------
  const compGuide = guide('Components · 4 of 9', 'Components', 'A component is a reusable piece of design. Its instances follow every change to the main component, and can still change their text and colors.', [
    { h: 'Create', keys: [['⌥⌘K', 'Create a component from a frame or the selection'], ['⌥-drag', 'Drag an instance out of a main component'], ['⌥⌘B', 'Detach an instance']], bullets: [
      'Insert instances from Assets (click or drag), or by duplicating one.',
      'Right-click several layers → Create multiple components makes one each.',
    ] },
    { h: 'Variants and properties', bullets: [
      'Combine components as variants into a set; names like “Style=Primary” become variant properties.',
      'Properties (the + in the Properties section): boolean (show or hide a layer), text, instance swap and slots (an area instances can fill).',
      'Select a main component to see its properties; select an instance to set them.',
    ] },
    { h: 'Instances', bullets: [
      'Change an instance’s text, colors or properties; ⋯ → Reset all changes puts them back, Push changes to main component sends them to the main.',
      'Click the instance’s name in the panel to swap it for another component.',
    ] },
    { h: 'Share and retire', bullets: [
      'Assets → ⓘ opens a component in the playground to try its properties before inserting it.',
      'Publish components (Σ menu) to use them in other Sigma Design files as a library.',
      'A component’s ⋯ → Deprecate hides it from Assets while its instances keep working.',
    ] },
  ]);
  compGuide.parts.push(tryIt('Select one of the instances on the right and type a new Label in the panel. Then select the main Button set and change a variant’s color: every instance follows.'));
  const instances = example('Instances', 600, 360, [
    row('Buttons', [buttonInstance(primaryBtn, 'Save'), buttonInstance(secondaryBtn, 'Cancel'), buttonInstance(primaryBtn, 'Publish')], P('space/3')),
    cardInstance(),
  ], { note: 'Instances of the Button set and the Card, with their own labels.' });

  // ---------- 5. Tokens in designs ----------
  const tokensGuide = guide('Tokens in designs · 5 of 9', 'Tokens in designs', 'A design token is a named value: a color, a size, a text style, a shadow. Layers that use tokens update when the token changes, and follow modes like Light and Dark.', [
    { h: 'Use a token', bullets: [
      'The token button (◈) next to a fill, stroke, number, visibility, text content or effect applies a token; it then shows as a purple chip.',
      'Text style in the Text section applies a typography token.',
      'Typing a value over a token detaches it.',
    ] },
    { h: 'Modes and brands', bullets: [
      'Collections with several modes (Light and Dark) get a picker in the Layer section; set it on a frame, a page or an instance, and its layers follow. Auto inherits from the parent.',
      'An extension like Brand B changes only some tokens (the accent). Pick it in the same place to re-skin a design.',
    ] },
    { h: 'This file’s tokens', bullets: [
      'With nothing selected, the panel shows the Sigma Tokens file this file uses. Design tokens… (Σ menu) changes it; files with the same token names are interchangeable.',
      'A file can keep a few local tokens too (Local design tokens…), and move them to a Sigma Tokens file later.',
      'Audit design tokens… finds the values that don’t use a token yet. See page 7.',
    ] },
  ]);
  tokensGuide.parts.push(tryIt('Select the Light frame and set Semantic to Dark in its Layer section. Then try Brand B on the Dark frame.'));
  const showcase = (name, x, modes) => createNode('frame', {
    name, x, y: 0, w: 328, h: 228, modes, clip: false,
    layout: autoLayout({ mode: 'vertical' }), sizingH: 'hug', sizingV: 'hug',
    fills: [makePaint('#FFFFFF')], bindings: { 'fills.0.color': S('surface/sunken'), ...pad(P('space/6')) },
    children: [cardInstance()],
  });
  const showcases = [
    showcase('Light', 600, undefined),
    showcase('Dark', 980, { [semantic.id]: mode(semantic, 'Dark') }),
    showcase('Brand B', 1360, { [brand.id]: mode(brand, 'Light') }),
  ];

  // ---------- 6. Style ----------
  const styleGuide = guide('Style · 6 of 9', 'Style', 'Fills, strokes, effects and text, each of which can come from a token.', [
    { h: 'Fills and strokes', bullets: [
      'A layer can have several fills and strokes, stacked, each with its own opacity; + adds one.',
      'Strokes sit inside, centered or outside the edge, with one weight for all of them.',
    ] },
    { h: 'Effects', bullets: [
      'Drop shadow, inner shadow and layer blur, as many as you like (Effects +).',
      'A shadow can use a shadow token, like the elevation tokens on the right.',
    ] },
    { h: 'Text', bullets: [
      'Text style applies a typography token: family, weight, size, line height and letter spacing at once.',
      'Auto width, auto height or fixed size; left, center or right.',
      'Case shows text as typed, UPPERCASE, lowercase or Title Case, without changing what you typed.',
    ] },
    { h: 'Export', p: ['The Export section exports the selection (or the page) as PNG, JPG or SVG at 0.5× to 4×; ⇧⌘E exports a PNG.'] },
  ]);
  styleGuide.parts.push(tryIt('Select a text style sample and look at its Text style chip. Select the Overlay card and change its shadow in Effects: the token detaches.'));
  const specimen = (label, path, sample) => row(label, [
    stack('Label', 'vertical', { width: 140, gap: P('space/1') }, [text('Name', path, S('text/secondary'), T('code'))]),
    text('Sample', sample, S('text/primary'), T(path)),
  ], P('space/4'));
  const typeScale = example('Text styles', 600, 0, [
    specimen('Display', 'heading/display', 'Display'),
    specimen('H1', 'heading/h1', 'Heading 1'),
    specimen('H2', 'heading/h2', 'Heading 2'),
    specimen('H3', 'heading/h3', 'Heading 3'),
    specimen('Body', 'body/default', 'Body text for reading'),
    specimen('Small', 'body/small', 'Small body text'),
    specimen('Label', 'label/default', 'Label'),
    specimen('Code', 'code', 'const token = "{accent/default}"'),
  ]);
  const elevated = (name, shadowPath) => createNode('frame', {
    name, w: 200, h: 120, clip: false, fills: [makePaint('#FFFFFF')],
    effects: [{ type: 'drop-shadow', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0, visible: true }],
    layout: autoLayout({ mode: 'vertical', alignP: 'center', alignC: 'center' }), sizingH: 'fixed', sizingV: 'fixed',
    bindings: { 'fills.0.color': S('surface/raised'), 'effects.0': S(shadowPath), radius: P('radius/lg') },
    children: [text('Label', shadowPath, S('text/secondary'), T('code'))],
  });
  const elevation = example('Elevation', 1080, 0, [row('Shadows', [elevated('Raised', 'elevation/raised'), elevated('Overlay', 'elevation/overlay')], P('space/8'))], { note: 'Shadow tokens, darker in Dark mode.' });
  const cases = example('Text case', 1080, 260, [
    text('As typed', 'Folders and documents', S('text/primary'), T('body/default')),
    text('Uppercase', 'Folders and documents', S('text/primary'), T('label/default'), { textCase: 'upper' }),
    text('Lowercase', 'Folders and Documents', S('text/primary'), T('body/default'), { textCase: 'lower' }),
    text('Title Case', 'folders and documents', S('text/primary'), T('body/strong'), { textCase: 'title' }),
  ], { note: 'One text, four cases.' });

  // ---------- 7. Quality checks ----------
  const qualityGuide = guide('Quality checks · 7 of 9', 'Quality checks', 'Sigma helps keep a design accessible and on-system.', [
    { h: 'Contrast', bullets: [
      'Select one text layer: the Fill section shows its contrast with what’s behind it and its WCAG level. AA needs 4.5:1 (3:1 for large text), AAA 7:1.',
      'In a Sigma Tokens file, a color token’s inspector checks it against the colors it’s used with, in every mode.',
    ] },
    { h: 'Token audit', bullets: [
      'Audit design tokens… (Σ menu, or the panel with nothing selected) lists every color, text style, spacing, radius and shadow that doesn’t use a token, with the token that matches.',
      'Use, Choose… or Use all exact matches binds them; Select shows the layers.',
      'It also finds layers using deprecated tokens and instances of deprecated components.',
    ] },
    { h: 'Deprecation', p: ['Deprecate tokens (in their inspector) and components (⋯ menu) you’re retiring: they’re hidden from pickers and Assets, while everything that uses them keeps working with a note.'] },
  ]);
  qualityGuide.parts.push(tryIt('Select each text on the right and look at Contrast in its Fill section. Then run Audit design tokens…: it finds the two one-off values on purpose.'));
  const contrastSample = (name, fg, bg, value) => createNode('frame', {
    name, w: 220, h: 64, clip: false, fills: [makePaint('#FFFFFF')], layout: autoLayout({ mode: 'horizontal', alignP: 'center', alignC: 'center' }),
    strokes: [makePaint('#000000')], sizingH: 'fixed', sizingV: 'fixed',
    bindings: { 'fills.0.color': S(bg), 'strokes.0.color': S('border/default'), radius: P('radius/md') },
    children: [text('Text', value, S(fg), T('body/default'))],
  });
  const contrast = example('Contrast', 600, 0, [
    contrastSample('Passes AAA', 'text/primary', 'surface/default', 'Primary text: AAA'),
    contrastSample('Passes AA', 'text/secondary', 'surface/default', 'Secondary text: AA'),
    contrastSample('Fails AA', 'text/on-accent', 'accent/default', 'White on the accent'),
  ], { note: 'The last one fails AA: white on this blue is under 3:1.' });
  const oneOffs = example('Not on tokens yet', 600, 400, [
    createNode('rect', { name: 'One-off blue', w: 160, h: 64, fills: [makePaint('#0E98FE')], radius: 10 }),
    createNode('text', { name: 'One-off text', text: 'Hand-set text', autoResize: 'width', fontSize: 15, fontWeight: 500, fills: [makePaint('#333333')] }),
  ], { note: 'These use raw values on purpose. Run the audit.' });

  // ---------- 8. Libraries and versions ----------
  const libGuide = guide('Libraries and versions · 8 of 9', 'Libraries and versions', 'Design systems change. Sigma publishes changes as numbered versions, lets the files that use them decide when to update, and keeps a history of every file.', [
    { h: 'Sigma Tokens as a library', bullets: [
      'Publish… in a Sigma Tokens file creates a version (v1, v2…) with notes and a list of what changed.',
      'Sigma Design files that use it get a banner when a new version is out; they review it and accept it.',
      'Sigma Tokens files can link other Sigma Tokens files (a Brand file pointing at a Core file).',
    ] },
    { h: 'Component libraries', bullets: [
      'Publish components… (Σ menu) publishes this file’s components.',
      'Component libraries… in another Sigma Design file links it; its components then appear in Assets.',
    ] },
    { h: 'Version history', keys: [['⌥⌘S', 'Save a named version']], bullets: [
      'Every file autosaves versions as you work. Show version history (Σ menu) to view one, restore it, or duplicate it as a new file.',
    ] },
    { h: 'Moving files', bullets: [
      'Download a copy (.sigma.json) and Import file… move files between browsers.',
      'A Sigma Tokens file exports tokens.json (W3C Design Tokens) and CSS variables, and imports tokens.json.',
      'Move to Archive (on the files home) is a soft delete; restore from the Archive.',
    ] },
  ]);
  libGuide.parts.push(tryIt('Open the Σ menu → Show version history to see this file’s versions. Nothing you do here can’t be undone or restored.'));
  const step = (n, title, body) => stack(title, 'vertical', { gap: P('space/1'), padding: P('space/4'), fill: S('surface/default'), radius: P('radius/md'), stroke: S('border/default'), width: 180 }, [
    text('Step', `Step ${n}`, S('text/link'), T('label/small'), { textCase: 'upper' }),
    text('Title', title, S('text/primary'), T('body/strong')),
    para(body, { typo: T('body/small'), color: S('text/secondary') }),
  ]);
  const flow = example('Releasing a change', 600, 0, [row('Steps', [
    step(1, 'Edit', 'Change tokens in the Sigma Tokens file.'),
    step(2, 'Publish', 'Publish… creates v2 with notes.'),
    step(3, 'Review', 'Files using it see “v2 available”.'),
    step(4, 'Accept', 'Accepting updates every layer that uses those tokens.'),
  ], P('space/3'), 'start')]);

  // ---------- 9. Sigma Tokens ----------
  const tokGuide = guide('Sigma Tokens · 9 of 9', 'Sigma Tokens', 'A Sigma Tokens file is a design system’s values, with no canvas. Open the sample tokens from the files home (Sigma Tokens) to explore the one this file uses.', [
    { h: 'Structure', bullets: [
      'Collections hold groups and tokens (Collection → Group → Tokens), with descriptions.',
      'Three levels work well: Primitives (raw values: color/blue/500), Semantic (what they mean: accent/default) and Components (where they’re used: button/primary/background).',
    ] },
    { h: 'Types', p: ['Color (with opacity), number, text, boolean, typography, shadow, duration and easing. Typography and shadow tokens are made of parts that can point at other tokens.'] },
    { h: 'References', bullets: [
      'Type { in a value to point it at another token; the inspector shows the whole chain and what refers to a token.',
      'Change a primitive and everything pointing at it follows.',
    ] },
    { h: 'Modes and extensions', bullets: [
      'Modes are columns (Light, Dark). Extend creates a collection that inherits everything and overrides only some values (Brand B); ↺ resets an override.',
    ] },
    { h: 'Quality and sharing', bullets: [
      'Contrast pairs check colors used together in every mode; Deprecated retires a token safely.',
      'Export tokens.json (W3C format) and CSS variables for code; import tokens.json from other tools.',
    ] },
  ]);
  tokGuide.parts.push(tryIt('Select a swatch on the right: its fill is a primitive token. Back to files → Sigma Tokens → Sample design tokens shows them all.'));
  const swatchRow = (hue, steps) => row(hue, [
    stack('Label', 'vertical', { width: 64, gap: P('space/1') }, [text('Hue', hue, S('text/secondary'), T('code'))]),
    ...steps.map((s) => createNode('rect', {
      name: `${hue}/${s}`, w: 40, h: 40, fills: [makePaint('#000000')], strokes: [makePaint('#000000')], strokeWidth: 1,
      bindings: { 'fills.0.color': P(`color/${hue}/${s}`), 'strokes.0.color': S('border/default'), radius: P('radius/sm') },
    })),
  ], P('space/2'));
  const palette = example('Primitives: color', 600, 0, [
    swatchRow('gray', ['0', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '1000']),
    swatchRow('blue', ['100', '200', '300', '400', '500', '600', '700', '800']),
    swatchRow('violet', ['100', '300', '400', '500', '600', '700', '800']),
    swatchRow('green', ['100', '400', '500', '700']),
    swatchRow('amber', ['100', '400', '500', '700']),
    swatchRow('red', ['100', '400', '500', '700']),
  ]);
  const spaceBar = (k) => row(`space/${k}`, [
    stack('Label', 'vertical', { width: 72, gap: P('space/1') }, [text('Name', `space/${k}`, S('text/secondary'), T('code'))]),
    createNode('rect', { name: 'Bar', w: 16, h: 16, fills: [makePaint('#000000')], bindings: { 'fills.0.color': S('accent/default'), w: P(`space/${k}`), radius: P('radius/sm') } }),
  ], P('space/3'));
  const spacing = example('Primitives: space', 600, 480, ['1', '2', '3', '4', '6', '8', '12', '16'].map(spaceBar), { note: 'A 4-point scale. Each bar’s width is the token.' });
  const radiusSample = (k) => stack(`radius/${k}`, 'vertical', { gap: P('space/2'), props: { layout: autoLayout({ mode: 'vertical', alignC: 'center' }) } }, [
    createNode('rect', { name: 'Shape', w: 56, h: 56, fills: [makePaint('#000000')], bindings: { 'fills.0.color': S('accent/default'), radius: P(`radius/${k}`) } }),
    text('Name', k, S('text/secondary'), T('code')),
  ]);
  const radii = example('Primitives: radius', 1040, 480, [row('Radii', ['none', 'sm', 'md', 'lg', 'xl', 'full'].map(radiusSample), P('space/4'))]);

  // ---------- pages ----------
  const pages = [
    page('1 Start here', [guideFrame(start), diagram]),
    page('2 Canvas basics', [guideFrame(basics), practice]),
    page('3 Layout', [guideFrame(layoutGuide), tags, list, constraintsDemo, gridFrame], [[tags, list, gridFrame]]),
    page('4 Components', [guideFrame(compGuide), buttonSet, card, instances], [[buttonSet, card, instances]]),
    page('5 Tokens in designs', [guideFrame(tokensGuide), ...showcases]),
    page('6 Style', [guideFrame(styleGuide), typeScale, elevation, cases], [[elevation, cases]]),
    page('7 Quality checks', [guideFrame(qualityGuide), contrast, oneOffs], [[contrast, oneOffs]]),
    page('8 Libraries and versions', [guideFrame(libGuide), flow]),
    page('9 Sigma Tokens', [guideFrame(tokGuide), palette, spacing, radii], [[palette, spacing], [palette, radii]]),
  ];
  return { name: WELCOME_NAME, pages, currentPageId: pages[0].id };
}

// The first time the file is opened (when its text is measured and its layouts are done), stack each page's
// example columns by their real heights. Returns whether anything moved.
const COLUMN_GAP = 64;
export function arrangeWelcome(doc) {
  let moved = false;
  for (const pg of doc.pages) {
    if (!pg.welcomeColumns) continue;
    const byId = new Map(pg.children.map((n) => [n.id, n]));
    for (const column of pg.welcomeColumns) {
      const nodes = column.map((id) => byId.get(id)).filter(Boolean);
      for (let i = 1; i < nodes.length; i++) {
        const y = nodes[i - 1].y + nodes[i - 1].h + COLUMN_GAP;
        if (nodes[i].y !== y) {
          nodes[i].y = y;
          moved = true;
        }
      }
    }
    delete pg.welcomeColumns;
    moved = true;
  }
  return moved;
}
