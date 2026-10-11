// Design system foundations: text case, layout grids, effects and shadow tokens, motion tokens, contrast.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, editNode, makePaint } from '../src/store.js';
import { caseText, measureText } from '../src/text.js';
import { syncInstances, createInstance } from '../src/components.js';
import { buildSVG } from '../src/io.js';

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
