import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, editNode, makePaint, select, getParent } from '../src/store.js';
import {
  syncInstances, createInstance, variantDefs, switchVariant, findVariant, renameVariantProperty, addVariantProperty,
  addComponentProp, bindLayerProp, setInstanceProp, displayName,
} from '../src/components.js';
import { combineAsVariants } from '../src/commands.js';

function button(name, color) {
  return createNode('component', {
    name, w: 120, h: 40,
    children: [
      createNode('rect', { name: 'Bg', w: 120, h: 40, fills: [makePaint(color)] }),
      createNode('text', { name: 'Label', text: 'Button', autoResize: 'fixed', w: 80, h: 20 }),
    ],
  });
}

function makeSet() {
  const a = button('Size=Small, State=Default', '#0D99FF');
  const b = button('Size=Large, State=Default', '#14AE5C');
  const c = button('Size=Small, State=Hover', '#F24822');
  useDoc([a, b, c]);
  select([a.id, b.id, c.id]);
  combineAsVariants();
  return { set: getParent(a.id), a, b, c };
}

test('variants: combining components creates a set with variant properties', () => {
  const { set } = makeSet();
  eq(set.type, 'componentSet');
  eq(set.children.length, 3);
  eq(variantDefs(set), { Size: ['Small', 'Large'], State: ['Default', 'Hover'] });
});

test('variants: plain component names become "Property 1" values', () => {
  const x = button('Primary', '#000000');
  const y = button('Secondary', '#FFFFFF');
  useDoc([x, y]);
  select([x.id, y.id]);
  combineAsVariants();
  eq(variantDefs(getParent(x.id)), { 'Property 1': ['Primary', 'Secondary'] });
});

test('variants: switching keeps overrides by layer name; instances are named after the set', () => {
  const { set, a, b } = makeSet();
  set.name = 'Button';
  const inst = createInstance(a);
  eq(inst.name, 'Button');
  const label = () => inst.children.find((c) => c.name === 'Label');
  editNode(label(), ['text'], (n) => void (n.text = 'Kept'));
  ok(switchVariant(inst, 'Size', 'Large'), 'exact match');
  syncInstances();
  eq(inst.componentId, b.id);
  eq(inst.children.find((c) => c.name === 'Bg').fills[0].color, '#14AE5C');
  eq(label().text, 'Kept');
  eq(displayName(b), 'Button');
});

test('variants: with no exact match the closest variant is used', () => {
  const { set, c } = makeSet();
  const { variant, exact } = findVariant(set, { Size: 'Large', State: 'Hover' });
  ok(!exact, 'no Large/Hover variant');
  ok(variant, 'falls back to a variant');
  const inst = createInstance(c);
  ok(!switchVariant(inst, 'Size', 'Large'), 'reported as inexact');
});

test('variants: renaming and adding properties rewrites variant names', () => {
  const { set } = makeSet();
  renameVariantProperty(set, 'State', 'Status');
  ok(set.children.every((v) => v.name.includes('Status=')), 'renamed');
  const added = addVariantProperty(set);
  eq(variantDefs(set)[added], ['Default']);
});

test('variants: component properties live on the set and apply to every variant', () => {
  const { set, a, b } = makeSet();
  const pid = addComponentProp(a, 'text', { name: 'Label', value: 'Button' });
  ok(set.props[pid], 'defined on the set');
  bindLayerProp(a.children[1], 'text', pid);
  bindLayerProp(b.children[1], 'text', pid);
  const inst = createInstance(a);
  setInstanceProp(inst, pid, 'Go');
  switchVariant(inst, 'Size', 'Large');
  syncInstances();
  eq(inst.children[1].text, 'Go');
});

test('variants: properties defined before combining move to the set', () => {
  const a = button('Primary', '#000000');
  const b = button('Secondary', '#FFFFFF');
  useDoc([a, b]);
  const pid = addComponentProp(a, 'text', { name: 'Label', value: 'Button' });
  bindLayerProp(a.children[1], 'text', pid);
  const inst = createInstance(a);
  setInstanceProp(inst, pid, 'Kept value');
  select([a.id, b.id]);
  combineAsVariants();
  syncInstances();
  ok(getParent(a.id).props[pid], 'on the set');
  ok(!a.props, 'removed from the variant');
  eq(inst.children[1].text, 'Kept value');
});
