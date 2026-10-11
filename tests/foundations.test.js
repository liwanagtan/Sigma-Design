// Design system foundations: text case, layout grids, effects and shadow tokens, motion tokens, contrast.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, editNode, makePaint } from '../src/store.js';
import { caseText, measureText } from '../src/text.js';
import { syncInstances, createInstance } from '../src/components.js';
import { buildSVG } from '../src/io.js';
import { parseEasing } from '../src/variables.js';
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
