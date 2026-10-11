import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, makePaint, insertNode, detach, getNode, loadDocument } from '../src/store.js';
import {
  syncInstances, createInstance, addComponentProp, setSlot, materializeSlot, resetSlot, clearSlot, isSlotModified,
  slotLimits, isInsideInstance, canPlaceInside, removeComponentProp, propsOf,
} from '../src/components.js';
import { DEFAULT_LAYOUT } from '../src/layout.js';

// A Card with a "Content" frame (vertical auto layout) holding one default text layer.
function card() {
  const text = createNode('text', { name: 'Body', text: 'Default', autoResize: 'fixed', w: 100, h: 20 });
  const content = createNode('frame', { name: 'Content', x: 10, y: 10, w: 180, h: 80, layout: { ...DEFAULT_LAYOUT, mode: 'vertical' }, children: [text] });
  return createNode('component', { name: 'Card', w: 200, h: 100, children: [content] });
}
const areaOf = (inst) => inst.children[0];

test('slots: a frame in a main component becomes a slot; instances show its default content', () => {
  const main = card();
  useDoc([main]);
  const pid = addComponentProp(main, 'slot', { name: 'Content' });
  ok(setSlot(main.children[0], pid), 'converted');
  ok(!setSlot(main, pid), 'never the component itself');
  const inst = createInstance(main);
  eq(areaOf(inst).children.map((n) => n.text), ['Default']);
  ok(!isSlotModified(areaOf(inst)), 'default content');
  ok(isInsideInstance(areaOf(inst)), 'the slot itself is part of the instance');
  ok(!isInsideInstance(areaOf(inst).children[0]), 'its contents can be edited');
});

test('slots: adding layers makes the instance own the slot; others still follow the default', () => {
  const main = card();
  useDoc([main]);
  setSlot(main.children[0], addComponentProp(main, 'slot', { name: 'Content' }));
  const a = createInstance(main);
  const b = createInstance(main);
  const rect = createNode('rect', { name: 'Photo', w: 40, h: 40, fills: [makePaint('#FF0000')] });
  ok(canPlaceInside(rect, areaOf(a)), 'a slot takes new layers');
  ok(!canPlaceInside({ type: 'instance', componentId: main.id }, areaOf(a)), 'but never the component itself');
  insertNode(rect, areaOf(a));
  syncInstances();
  ok(isSlotModified(areaOf(a)), 'modified');
  eq(areaOf(a).children.map((n) => n.name), ['Body', 'Photo']);
  eq(getNode(rect.id), rect);
  main.children[0].children[0].text = 'New default';
  syncInstances();
  eq([areaOf(a).children[0].text, areaOf(b).children[0].text], ['Default', 'New default']);
  // Survives a save and reload (the document is plain data).
  loadDocument(JSON.parse(JSON.stringify(state.doc)));
  syncInstances();
  const a2 = state.doc.pages[0].children.find((n) => n.id === a.id);
  eq(areaOf(a2).children.map((n) => n.name), ['Body', 'Photo']);
});

test('slots: reset, delete contents, limits and removing the property', () => {
  const main = card();
  useDoc([main]);
  const pid = addComponentProp(main, 'slot', { name: 'Content' });
  propsOf(main)[pid].max = 1;
  setSlot(main.children[0], pid);
  const inst = createInstance(main);
  insertNode(createNode('rect', { name: 'Extra' }), areaOf(inst));
  syncInstances();
  eq(slotLimits(areaOf(inst)), { count: 2, min: null, max: 1, ok: false });
  detach(areaOf(inst).children[0]);
  syncInstances();
  eq(areaOf(inst).children.map((n) => n.name), ['Extra']);
  resetSlot(areaOf(inst));
  syncInstances();
  eq(areaOf(inst).children.map((n) => n.name), ['Body']);
  clearSlot(areaOf(inst));
  syncInstances();
  eq([areaOf(inst).children.length, isSlotModified(areaOf(inst))], [0, true]);
  removeComponentProp(main, pid);
  syncInstances();
  eq(Object.keys(inst.slots || {}), []);
  eq(areaOf(inst).children.map((n) => n.name), ['Body']);
});

test('slots: editing default content in an instance takes the slot over, keeping the edit', () => {
  const main = card();
  useDoc([main]);
  setSlot(main.children[0], addComponentProp(main, 'slot', { name: 'Content' }));
  const inst = createInstance(main);
  materializeSlot(areaOf(inst));
  const body = areaOf(inst).children[0];
  body.text = 'Mine';
  syncInstances();
  eq(areaOf(inst).children[0].text, 'Mine');
  ok(!body.sourceId, 'a plain layer now');
});
