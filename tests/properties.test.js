import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, editNode, makePaint } from '../src/store.js';
import {
  syncInstances, createInstance, addComponentProp, bindLayerProp, setInstanceProp, removeComponentProp,
} from '../src/components.js';

function makeIcon(name, color) {
  return createNode('component', { name, w: 16, h: 16, children: [createNode('ellipse', { name: 'Dot', w: 16, h: 16, fills: [makePaint(color)] })] });
}

function makeButton() {
  const icon = createNode('rect', { name: 'Icon', w: 16, h: 16 });
  const label = createNode('text', { name: 'Label', text: 'Button', autoResize: 'fixed', w: 80, h: 20 });
  const comp = createNode('component', { name: 'Button', w: 120, h: 40, children: [icon, label] });
  return { comp, icon, label };
}
const named = (n, name) => n.children.find((c) => c.name === name);

test('properties: a boolean property shows or hides the bound layer per instance', () => {
  const { comp, icon } = makeButton();
  useDoc([comp]);
  const pid = addComponentProp(comp, 'boolean', { name: 'Show icon', value: true });
  bindLayerProp(icon, 'visible', pid);
  const a = createInstance(comp);
  const b = createInstance(comp, { x: 200 });
  setInstanceProp(b, pid, false);
  syncInstances();
  eq([named(a, 'Icon').visible, named(b, 'Icon').visible], [true, false]);
});

test('properties: a text property sets the label; typing in the label updates the property', () => {
  const { comp, label } = makeButton();
  useDoc([comp]);
  const pid = addComponentProp(comp, 'text', { name: 'Label', value: 'Button' });
  bindLayerProp(label, 'text', pid);
  const inst = createInstance(comp);
  setInstanceProp(inst, pid, 'Buy now');
  syncInstances();
  eq(named(inst, 'Label').text, 'Buy now');
  editNode(named(inst, 'Label'), ['text'], (n) => void (n.text = 'Checkout'));
  eq(inst.propValues[pid], 'Checkout');
  ok(!inst.overrides.Label, 'no plain override for a bound layer');
  syncInstances();
  eq(named(inst, 'Label').text, 'Checkout');
});

test('properties: instance swap replaces a nested instance with another component', () => {
  const star = makeIcon('Star', '#FFC700');
  const heart = makeIcon('Heart', '#F24822');
  const card = createNode('component', { name: 'Card', w: 200, h: 100, children: [] });
  useDoc([star, heart, card]);
  const nested = createInstance(star, { parent: card });
  const pid = addComponentProp(card, 'instance', { name: 'Icon', value: star.id });
  bindLayerProp(nested, 'componentId', pid);
  const inst = createInstance(card, { x: 300 });
  setInstanceProp(inst, pid, heart.id);
  syncInstances();
  const swapped = inst.children[0];
  eq(swapped.componentId, heart.id);
  eq(swapped.children[0].fills[0].color, '#F24822');
});

test('properties: swapping to the containing component cannot recurse forever', () => {
  const star = makeIcon('Star', '#FFC700');
  const card = createNode('component', { name: 'Card', w: 200, h: 100, children: [] });
  useDoc([star, card]);
  const nested = createInstance(star, { parent: card });
  const pid = addComponentProp(card, 'instance', { name: 'Icon', value: star.id });
  bindLayerProp(nested, 'componentId', pid);
  const inst = createInstance(card);
  setInstanceProp(inst, pid, card.id);
  syncInstances(); // must terminate
  ok(inst.children.length === 1, 'still one nested layer');
});

test('properties: removing a property unbinds its layers', () => {
  const { comp, icon } = makeButton();
  useDoc([comp]);
  const pid = addComponentProp(comp, 'boolean', { value: true });
  bindLayerProp(icon, 'visible', pid);
  removeComponentProp(comp, pid);
  ok(!icon.propRefs, 'binding removed');
  eq(Object.keys(comp.props), []);
});

test('properties: binding a layer turns existing instance overrides into property values', () => {
  const { comp, label } = makeButton();
  useDoc([comp]);
  const inst = createInstance(comp);
  editNode(named(inst, 'Label'), ['text'], (n) => void (n.text = 'Buy now'));
  const pid = addComponentProp(comp, 'text', { name: 'Label', value: 'Button' });
  bindLayerProp(label, 'text', pid);
  syncInstances();
  eq(named(inst, 'Label').text, 'Buy now');
  eq(inst.propValues[pid], 'Buy now');
});
