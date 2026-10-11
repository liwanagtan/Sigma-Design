// Design system foundations: text case, layout grids, effects and shadow tokens, motion tokens, contrast.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, editNode, makePaint } from '../src/store.js';
import { caseText, measureText } from '../src/text.js';
import { syncInstances, createInstance } from '../src/components.js';
import { buildSVG } from '../src/io.js';
import { parseEasing, resolveVariables, shiftPaintBindings } from '../src/variables.js';
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
