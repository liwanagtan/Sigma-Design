// Design system foundations: text case, layout grids, effects and shadow tokens, motion tokens, contrast.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, editNode, makePaint } from '../src/store.js';
import { gridBands, gridLines, gridSnapTargets, newGrid, retypeGrid } from '../src/grids.js';
import { caseText, measureText } from '../src/text.js';
import { syncInstances, createInstance } from '../src/components.js';
import { buildSVG } from '../src/io.js';
import { parseEasing, resolveVariables, shiftPaintBindings, resolveIn, addContrastPair, deleteVariable } from '../src/variables.js';
import { contrastRatio, contrastLevel, formatRatio, isLargeText, backgroundBehind, textContrast } from '../src/contrast.js';
import { sampleTokenDocument } from '../src/sample-tokens.js';
import { nodeSVG, effectOverhang } from '../src/render.js';
import { exportDTCG, exportCSS, importTokens } from '../src/tokens-io.js';

test('text case: upper, lower and title case change how text shows, not the text itself', () => {
  eq(caseText('Folders and documents', 'upper'), 'FOLDERS AND DOCUMENTS');
  eq(caseText('Folders AND Documents', 'lower'), 'folders and documents');
  eq(caseText('folders and documents-list (beta)', 'title'), 'Folders And Documents-List (Beta)');
  eq(caseText('as typed', undefined), 'as typed');
  const t = createNode('text', { text: 'save', textCase: 'upper' });
  useDoc([t]);
  measureText(t);
  const lower = createNode('text', { text: 'save' });
  measureText(lower);
  ok(t.w > lower.w, 'uppercase text is measured in its case');
  eq(t.text, 'save');
  ok(buildSVG([t]).svg.includes('>SAVE<'), 'exports in its case');
});

test('text case: an instance can override the case of a text layer', () => {
  const label = createNode('text', { name: 'Label', text: 'Button', textCase: 'upper' });
  const main = createNode('component', { name: 'Button', children: [label] });
  useDoc([main]);
  const inst = createInstance(main, { x: 200 });
  const copy = inst.children[0];
  eq(copy.textCase, 'upper');
  editNode(copy, ['textCase'], () => void (copy.textCase = 'none'));
  syncInstances();
  eq(inst.children[0].textCase, 'none');
  eq(inst.overrides.Label.textCase, 'none');
});

test('motion tokens: durations and easings export to DTCG and CSS, and import back', () => {
  eq(parseEasing('cubic-bezier(0.4, 0, 0.2, 1)'), [0.4, 0, 0.2, 1]);
  eq(parseEasing('0.4 0 0.2 1'), [0.4, 0, 0.2, 1]);
  eq(parseEasing([0, 0, 1.5, 1]), null); // x2 must be between 0 and 1
  eq(parseEasing('0.4, 0'), null);
  const mode = 'm1';
  const fast = { id: 'd1', name: 'motion/duration/fast', type: 'duration', valuesByMode: { [mode]: 100 } };
  const std = { id: 'e1', name: 'motion/easing/standard', type: 'easing', valuesByMode: { [mode]: [0.2, 0, 0, 1] } };
  const btn = { id: 'd2', name: 'button/duration', type: 'duration', valuesByMode: { [mode]: { alias: 'd1' } } };
  const cols = [{ id: 'c1', name: 'Motion', modes: [{ id: mode, name: 'Default' }], defaultModeId: mode, variables: [fast, std, btn] }];
  const json = exportDTCG(cols);
  const set = json['Motion/Default'];
  eq(set.motion.duration.fast, { $type: 'duration', $value: { value: 100, unit: 'ms' } });
  eq(set.motion.easing.standard, { $type: 'cubicBezier', $value: [0.2, 0, 0, 1] });
  eq(set.button.duration.$value, '{motion.duration.fast}');
  const css = exportCSS(cols);
  ok(css.includes('--motion-duration-fast: 100ms;'), 'duration in CSS');
  ok(css.includes('--motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);'), 'easing in CSS');
  ok(css.includes('--button-duration: var(--motion-duration-fast);'), 'references in CSS');
  const back = importTokens(JSON.parse(JSON.stringify(json))).collections[0];
  const byName = (n) => back.variables.find((v) => v.name === n);
  eq(byName('motion/duration/fast').type, 'duration');
  eq(Object.values(byName('motion/easing/standard').valuesByMode)[0], [0.2, 0, 0, 1]);
  eq(Object.values(byName('button/duration').valuesByMode)[0], { alias: byName('motion/duration/fast').id });
  // Other tools write seconds and CSS strings.
  const other = importTokens({ slow: { $type: 'duration', $value: '0.3s' }, out: { $type: 'cubicBezier', $value: 'cubic-bezier(0.3, 0, 1, 1)' } }).collections[0];
  eq(other.variables.map((v) => Object.values(v.valuesByMode)[0]), [300, [0.3, 0, 1, 1]]);
});

const shadowFx = (props = {}) => ({ type: 'drop-shadow', color: '#000000', opacity: 0.25, x: 0, y: 4, blur: 8, spread: 0, visible: true, ...props });

test('effects: drop shadows, inner shadows and layer blur render as one filter, and exports make room for them', () => {
  const card = createNode('rect', { name: 'Card', w: 100, h: 60, effects: [shadowFx(), shadowFx({ type: 'inner-shadow', y: 2 }), shadowFx({ type: 'layer-blur', blur: 4 })] });
  useDoc([card]);
  const svg = nodeSVG(card);
  ok(svg.includes(`filter="url(#fx-${card.id})"`), 'the layer uses its filter');
  ok(svg.includes('flood-opacity="0.25"'), 'shadow color and opacity');
  ok(svg.includes('<feGaussianBlur in="all" stdDeviation="2"/>'), 'layer blur: half the radius');
  ok(svg.indexOf('in="s0"') < svg.indexOf('in="SourceGraphic"') && svg.indexOf('in="SourceGraphic"') < svg.indexOf('in="s1"'), 'drop shadow under, inner shadow over');
  eq(effectOverhang(card), 4 + 12); // offset 4 + blur 8 × 1.5
  const { box } = buildSVG([card]);
  eq(box.w, 100 + 2 * 16);
  card.effects.forEach((e) => (e.visible = false));
  ok(!nodeSVG(card).includes('<filter'), 'hidden effects draw nothing');
});

test('shadow tokens: fields can point at other tokens, a bound effect follows the mode, and editing it detaches the token', () => {
  const light = 'l', dark = 'd';
  const black10 = { id: 't1', name: 'alpha/black-10', type: 'color', valuesByMode: { [light]: '#0000001A', [dark]: '#0000001A' } };
  const black40 = { id: 't2', name: 'alpha/black-40', type: 'color', valuesByMode: { [light]: '#00000066', [dark]: '#00000066' } };
  const raised = {
    id: 't3', name: 'elevation/raised', type: 'shadow',
    valuesByMode: { [light]: { color: { alias: 't1' }, x: 0, y: 2, blur: 8, spread: 0 }, [dark]: { color: { alias: 't2' }, x: 0, y: 2, blur: 8, spread: 0 } },
  };
  const col = { id: 'c', name: 'Semantic', modes: [{ id: light, name: 'Light' }, { id: dark, name: 'Dark' }], defaultModeId: light, variables: [black10, black40, raised] };
  const card = createNode('rect', { name: 'Card', effects: [shadowFx()], bindings: { 'effects.0': 't3' } });
  const darkFrame = createNode('frame', { name: 'Dark', modes: { c: dark }, children: [createNode('rect', { name: 'Card 2', effects: [shadowFx()], bindings: { 'effects.0': 't3' } })] });
  const doc = useDoc([card, darkFrame]);
  doc.variables = { collections: [col] };
  resolveVariables();
  eq([card.effects[0].opacity, card.effects[0].y, card.effects[0].blur], [0.1, 2, 8]);
  eq(darkFrame.children[0].effects[0].opacity, 0.4);
  editNode(card, ['effects.0'], () => void (card.effects[0].y = 10));
  ok(!card.bindings, 'typing a value detaches the shadow token');
  // Removing an effect moves the bindings of the ones above it down.
  const n = createNode('rect', { effects: [shadowFx(), shadowFx()], bindings: { 'effects.1': 't3', 'fills.0.color': 't1' } });
  n.effects.splice(0, 1);
  shiftPaintBindings(n, 'effects', 0);
  eq(n.bindings, { 'effects.0': 't3', 'fills.0.color': 't1' });
  // tokens.json and CSS
  const json = exportDTCG([col]);
  eq(json['Semantic/Dark'].elevation.raised.$value, { color: '{alpha.black-40}', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 8, unit: 'px' }, spread: { value: 0, unit: 'px' }, inset: false });
  ok(exportCSS([col]).includes('--elevation-raised: 0px 2px 8px 0px var(--alpha-black-10);'), 'box-shadow value in CSS');
  const back = importTokens(JSON.parse(JSON.stringify(json))).collections[0];
  const r = back.variables.find((v) => v.name === 'elevation/raised');
  const b40 = back.variables.find((v) => v.name === 'alpha/black-40');
  eq(r.type, 'shadow');
  eq(r.valuesByMode[back.modes[1].id], { color: { alias: b40.id }, x: 0, y: 2, blur: 8, spread: 0 });
  const other = importTokens({ s: { $type: 'shadow', $value: [{ color: '#00000033', offsetX: '0px', offsetY: '1px', blur: '3px', spread: '0px' }, { color: '#000', offsetX: 0, offsetY: 8, blur: 24, spread: 0 }] } }).collections[0];
  eq(Object.values(other.variables[0].valuesByMode)[0], { color: '#00000033', x: 0, y: 1, blur: 3, spread: 0 });
});

test('effects: an instance takes the main component’s effects and can override them', () => {
  const main = createNode('component', { name: 'Card', effects: [shadowFx()] });
  useDoc([main]);
  const inst = createInstance(main, { x: 300 });
  eq(inst.effects[0].y, 4);
  main.effects[0].y = 6;
  syncInstances();
  eq(inst.effects[0].y, 6);
  editNode(inst, ['effects.0'], () => void (inst.effects[0].y = 20));
  main.effects[0].y = 8;
  syncInstances();
  eq(inst.effects[0].y, 20);
});

test('layout grids: stretch, left, center and right columns, rows and square grids', () => {
  const cols = (props) => ({ type: 'columns', count: 4, gutter: 20, margin: 10, align: 'stretch', size: 50, ...props });
  // 400 wide: (400 - 2×10 - 3×20) / 4 = 80 per column.
  eq(gridBands(cols(), 400), [{ start: 10, size: 80 }, { start: 110, size: 80 }, { start: 210, size: 80 }, { start: 310, size: 80 }]);
  eq(gridBands(cols({ align: 'min' }), 400).map((b) => b.start), [10, 80, 150, 220]);
  eq(gridBands(cols({ align: 'center' }), 400)[0].start, (400 - (4 * 50 + 3 * 20)) / 2);
  eq(gridBands(cols({ align: 'max' }), 400).at(-1), { start: 400 - 10 - 50, size: 50 });
  eq(gridBands(cols({ margin: 300 }), 400), []); // no room left
  eq(gridLines({ type: 'grid', size: 100 }, 350), [100, 200, 300]);
  eq(retypeGrid({ type: 'grid', size: 8, color: '#00FF00', opacity: 0.2 }, 'rows').color, '#00FF00');
});

test('layout grids: layers snap to column edges while grids show; gutters bind to tokens; instances follow', () => {
  const frame = createNode('frame', { name: 'Page', x: 100, y: 50, w: 400, h: 300, layoutGrids: [{ type: 'columns', count: 4, gutter: 20, margin: 10, align: 'stretch', color: '#FF0000', opacity: 0.1 }] });
  const doc = useDoc([frame]);
  state.showGrids = true;
  const xs = gridSnapTargets().xs.map((t) => t.v);
  eq(xs.slice(0, 4), [110, 190, 210, 290]);
  state.showGrids = false;
  eq(gridSnapTargets().xs.length, 0);
  state.showGrids = true;
  const gutter = { id: 'g', name: 'layout/gutter', type: 'number', valuesByMode: { m: 32 } };
  doc.variables = { collections: [{ id: 'c', name: 'Layout', modes: [{ id: 'm', name: 'Default' }], defaultModeId: 'm', variables: [gutter] }] };
  frame.bindings = { 'layoutGrids.0.gutter': 'g' };
  resolveVariables();
  eq(frame.layoutGrids[0].gutter, 32);
  const n = createNode('frame', { layoutGrids: [newGrid('columns'), newGrid('rows')], bindings: { 'layoutGrids.1.gutter': 'g' } });
  n.layoutGrids.splice(0, 1);
  shiftPaintBindings(n, 'layoutGrids', 0);
  eq(n.bindings, { 'layoutGrids.0.gutter': 'g' });
  const main = createNode('component', { name: 'Screen', layoutGrids: [newGrid('grid')] });
  useDoc([main]);
  const inst = createInstance(main, { x: 500 });
  eq(inst.layoutGrids, main.layoutGrids);
});

test('contrast: WCAG ratios and levels, including translucent colors and large text', () => {
  eq(Math.round(contrastRatio('#000000', '#FFFFFF') * 100) / 100, 21);
  eq(formatRatio(contrastRatio('#767676', '#FFFFFF')), '4.54:1'); // the lightest gray that passes AA on white
  eq(contrastLevel(4.54), 'AA');
  eq(contrastLevel(4.4), 'Fail');
  eq(contrastLevel(4.4, true), 'AA'); // large text needs 3:1
  eq(contrastLevel(7.1), 'AAA');
  ok(isLargeText(24, 400) && isLargeText(19, 700) && !isLargeText(19, 400), 'large text sizes');
  eq(formatRatio(contrastRatio('#00000000', '#FFFFFF')), '1:1'); // fully transparent text has no contrast
  ok(contrastRatio('#00000080', '#FFFFFF') < contrastRatio('#000000', '#FFFFFF'), 'translucent text is blended first');
});

test('contrast: a text layer is measured against the layers painted behind it', () => {
  const label = createNode('text', { text: 'Hi', fills: [makePaint('#FFFFFF')], fontSize: 14, x: 10, y: 10 });
  const card = createNode('frame', { name: 'Card', x: 0, y: 0, w: 200, h: 100, fills: [makePaint('#0D99FF')], children: [label] });
  const outside = createNode('text', { text: 'Far', fills: [makePaint('#FFFFFF')], x: 500, y: 500 });
  useDoc([card, outside]);
  measureText(label);
  measureText(outside);
  eq(backgroundBehind(label), '#0D99FF');
  eq(backgroundBehind(outside), '#F5F5F5'); // only the page behind it
  const c = textContrast(label);
  eq(c.bg, '#0D99FF');
  eq(contrastLevel(c.ratio, c.large), 'Fail'); // white on that blue is under 3:1
  // A translucent overlay in between is blended in.
  card.children.unshift(createNode('rect', { w: 200, h: 100, fills: [makePaint('#000000', 0.5)] }));
  useDoc([card, outside]);
  ok(textContrast(label).ratio > c.ratio, 'darker behind, more contrast');
  // Over an image it can't be measured.
  card.children.unshift(createNode('image', { w: 200, h: 100, src: 'data:image/png;base64,AA' }));
  card.children.splice(1, 1);
  useDoc([card, outside]);
  eq(textContrast(label), null);
});

test('contrast pairs: tokens list the colors they’re used with; pairs survive tokens.json and token deletion cleans them up', () => {
  const m = 'm';
  const text = { id: 'a', name: 'text/primary', type: 'color', valuesByMode: { [m]: '#1A1D22' } };
  const surface = { id: 'b', name: 'surface/default', type: 'color', valuesByMode: { [m]: '#FFFFFF' } };
  const col = { id: 'c', name: 'Semantic', modes: [{ id: m, name: 'Light' }], defaultModeId: m, variables: [text, surface] };
  const doc = useDoc([]);
  doc.variables = { collections: [col] };
  ok(addContrastPair(text, 'b'), 'added');
  ok(!addContrastPair(text, 'b') && !addContrastPair(text, 'a'), 'no duplicates or self-pairs');
  eq(formatRatio(contrastRatio(resolveIn(col, m, 'a'), resolveIn(col, m, 'b'))), '16.89:1');
  const back = importTokens(JSON.parse(JSON.stringify(exportDTCG([col])))).collections[0];
  const t2 = back.variables.find((v) => v.name === 'text/primary');
  eq(t2.contrastWith, [back.variables.find((v) => v.name === 'surface/default').id]);
  deleteVariable('b');
  eq(text.contrastWith, undefined);
});

test('sample tokens: contrast pairs are defined for text on surfaces and on the accent', () => {
  const cols = sampleTokenDocument().collections;
  const semantic = cols.find((c) => c.name === 'Semantic');
  const named = (n) => semantic.variables.find((v) => v.name === n);
  eq(named('text/primary').contrastWith, [named('surface/default').id, named('surface/raised').id]);
  ok(named('text/on-accent').contrastWith.includes(named('accent/default').id), 'on-accent on the accent');
});
