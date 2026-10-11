import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, getNode, editNode, makePaint, walk } from '../src/store.js';
import {
  syncInstances, createInstance, detachInstance, canPlaceInside, resetOverrides, overrideCount, isInsideInstance,
  orphanedOverrides, clearOrphanedOverrides, componentMatches,
} from '../src/components.js';

// A "Button" component: a frame with a Label text and a Bg rectangle.
function makeButton() {
  const bg = createNode('rect', { name: 'Bg', w: 120, h: 40, fills: [makePaint('#0D99FF')] });
  const label = createNode('text', { name: 'Label', text: 'Button', autoResize: 'fixed', w: 80, h: 20 });
  return createNode('component', { name: 'Button', w: 120, h: 40, children: [bg, label] });
}
const childNamed = (n, name) => n.children.find((c) => c.name === name);

test('components: an instance mirrors its main component with stable derived ids', () => {
  const main = makeButton();
  useDoc([main]);
  const inst = createInstance(main, { x: 200, y: 0 });
  eq(inst.children.map((c) => c.name), ['Bg', 'Label']);
  eq(inst.children[0].id, `${inst.id}/${main.children[0].id}`);
  ok(isInsideInstance(inst.children[0]), 'children are inside the instance');
  const bgBefore = inst.children[0];
  main.children[0].fills[0].color = '#FF0000';
  syncInstances();
  eq(inst.children[0].fills[0].color, '#FF0000');
  ok(inst.children[0] === bgBefore, 're-sync reuses the same object');
});

test('components: overrides survive main changes; other props still update', () => {
  const main = makeButton();
  useDoc([main]);
  const inst = createInstance(main);
  const label = () => childNamed(inst, 'Label');
  editNode(label(), ['text'], (n) => void (n.text = 'Buy now'));
  eq(inst.overrides, { Label: { text: 'Buy now' } });
  main.children[1].text = 'Main text';
  main.children[1].fontSize = 24;
  syncInstances();
  eq(label().text, 'Buy now');
  eq(label().fontSize, 24);
  eq(overrideCount(inst), 1);
  resetOverrides(inst);
  syncInstances();
  eq(label().text, 'Main text');
});

test('components: position and size of instance layers cannot be edited', () => {
  const main = makeButton();
  useDoc([main]);
  const inst = createInstance(main);
  const bg = childNamed(inst, 'Bg');
  const applied = editNode(bg, ['x'], (n) => void (n.x = 50));
  eq(applied, false);
  eq(bg.x, 0);
});

test('components: instance size follows the main until the instance is resized', () => {
  const main = makeButton();
  useDoc([main]);
  const inst = createInstance(main);
  main.w = 200;
  syncInstances();
  eq(inst.w, 200);
  inst.w = 300; // user resized the instance
  main.w = 250;
  syncInstances();
  eq(inst.w, 300);
});

test('components: nested instances are materialized and overridable through the outer instance', () => {
  const button = makeButton();
  const card = createNode('component', { name: 'Card', w: 300, h: 200, children: [] });
  useDoc([button, card]);
  createInstance(button, { parent: card });
  const cardInst = createInstance(card, { x: 400 });
  const nestedLabel = cardInst.children[0].children.find((c) => c.name === 'Label');
  eq(nestedLabel.pathKey, 'Button/Label');
  editNode(nestedLabel, ['text'], (n) => void (n.text = 'Nested override'));
  ok(cardInst.overrides['Button/Label'], 'override stored on the outermost instance');
  button.children[1].fontSize = 30;
  syncInstances();
  const again = cardInst.children[0].children.find((c) => c.name === 'Label');
  eq([again.text, again.fontSize], ['Nested override', 30]);
});

test('components: a component can never contain an instance of itself', () => {
  const a = createNode('component', { name: 'A', children: [] });
  const b = createNode('component', { name: 'B', children: [] });
  useDoc([a, b]);
  createInstance(a, { parent: b }); // B uses A
  ok(!canPlaceInside({ type: 'instance', componentId: a.id }, a), 'A inside A');
  ok(!canPlaceInside({ type: 'instance', componentId: b.id }, a), 'B (which uses A) inside A');
  ok(canPlaceInside({ type: 'instance', componentId: a.id }, b), 'A inside B is fine');
  const inst = createInstance(a);
  ok(!canPlaceInside(createNode('rect'), inst), 'nothing can be dropped into an instance');
});

test('components: detaching keeps the look and gives layers fresh ids', () => {
  const main = makeButton();
  useDoc([main]);
  const inst = createInstance(main);
  editNode(childNamed(inst, 'Label'), ['text'], (n) => void (n.text = 'Detached'));
  syncInstances();
  detachInstance(inst);
  eq(inst.type, 'frame');
  const label = childNamed(inst, 'Label');
  eq(label.text, 'Detached');
  ok(!label.id.includes('/') && !('sourceId' in label), 'plain layer');
  main.children[1].text = 'Changed main';
  syncInstances();
  eq(childNamed(inst, 'Label').text, 'Detached');
});

test('components: an instance whose main is deleted keeps its last state', () => {
  const main = makeButton();
  const doc = useDoc([main]);
  const inst = createInstance(main, { x: 300 });
  doc.pages[0].children = doc.pages[0].children.filter((n) => n !== main);
  syncInstances();
  ok(inst.missingMain, 'flagged as missing');
  eq(inst.children.length, 2);
  let count = 0;
  walk(doc.pages[0].children, () => void count++);
  eq(count, 3);
  ok(!getNode(main.id), 'main is gone');
});

test('components: overrides on layers renamed in the main component are reported and can be cleared', () => {
  const main = makeButton();
  useDoc([main]);
  const inst = createInstance(main);
  editNode(childNamed(inst, 'Label'), ['text'], (n) => void (n.text = 'Kept?'));
  eq(orphanedOverrides(inst), []);
  main.children[1].name = 'Title';
  syncInstances();
  eq(orphanedOverrides(inst), ['Label']);
  clearOrphanedOverrides(inst);
  eq(Object.keys(inst.overrides), []);
});

test('components: search matches names and the keywords in descriptions (a variant also matches its set)', () => {
  const icon = createNode('component', { name: 'stopwatch', description: 'speed, timer, fast' });
  const variant = createNode('component', { name: 'Size=Small' });
  const set = createNode('componentSet', { name: 'Button', description: 'call to action, CTA', children: [variant] });
  useDoc([icon, set]);
  ok(componentMatches(icon, 'stopwatch'), 'by name');
  ok(componentMatches(icon, 'Timer'), 'by a description keyword, any case');
  ok(componentMatches(icon, 'fast stop'), 'every word must match somewhere');
  ok(!componentMatches(icon, 'speed button'), 'a word that matches nothing fails');
  ok(componentMatches(variant, 'cta small'), 'a variant matches its set’s description');
  ok(componentMatches(icon, ''), 'an empty search matches everything');
});
