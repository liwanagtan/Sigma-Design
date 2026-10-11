import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, makePaint, select, getParent, editNode } from '../src/store.js';
import {
  syncInstances, createInstance, addComponentProp, bindLayerProp, setInstanceProp, propsOf, updateComponentProp,
  reorderComponentProp, toggleValues, renameVariantValue, reorderVariantValues, reorderVariantProperty, removeVariantProperty,
  variantDefs, variantConflicts, defaultVariant, overrideCount, resetOverrides, switchVariant, layersUsingProp, nestedInstances,
  mainComponentOf,
} from '../src/components.js';
import { makeComponentSet, combineAsVariants, addVariant } from '../src/commands.js';

function button(name = 'Button') {
  return createNode('component', {
    name, w: 120, h: 40,
    children: [
      createNode('rect', { name: 'Icon', w: 16, h: 16, fills: [makePaint('#FFFFFF')] }),
      createNode('text', { name: 'Label', text: 'Button', autoResize: 'fixed', w: 80, h: 20 }),
    ],
  });
}

test('component props: a boolean property shows and hides a layer; false by default hides it', () => {
  const main = button();
  useDoc([main]);
  const pid = addComponentProp(main, 'boolean', { name: 'Show icon', value: false });
  bindLayerProp(main.children[0], 'visible', pid);
  const inst = createInstance(main);
  eq(inst.children[0].visible, false);
  setInstanceProp(inst, pid, true);
  syncInstances();
  eq(inst.children[0].visible, true);
  eq(layersUsingProp(main, pid).map((u) => u.layer.name), ['Icon']);
});

test('component props: names stay unique; properties can be reordered', () => {
  const main = button();
  useDoc([main]);
  const a = addComponentProp(main, 'boolean', { name: 'Show icon', value: true });
  const b = addComponentProp(main, 'text', { name: 'Label', value: 'Hi' });
  updateComponentProp(main, b, { name: 'Show icon' }); // taken: refused
  eq(propsOf(main)[b].name, 'Label');
  reorderComponentProp(main, b, a);
  eq(Object.keys(propsOf(main)), [b, a]);
  updateComponentProp(main, b, { preferred: ['x', 'x'] });
  eq(propsOf(main)[b].preferred, ['x']);
});

test('component props: "+ Variant" turns a main component into a set, like Figma', () => {
  const main = button();
  useDoc([main]);
  const pid = addComponentProp(main, 'boolean', { name: 'Show icon', value: true });
  const set = makeComponentSet(main);
  eq([set.type, set.name, set.children.map((v) => v.name)], ['componentSet', 'Button', ['Property 1=Default']]);
  ok(propsOf(main)[pid], 'properties move to the set');
  eq(state.selection, [set.id]);
  addVariant(set);
  eq(set.children.map((v) => v.name), ['Property 1=Default', 'Property 1=Variant2']);
});

test('component props: variant values rename everywhere, reorder, and properties reorder or go', () => {
  const a = button('Size=Small, State=Default');
  const b = button('Size=Large, State=Default');
  const c = button('Size=Small, State=Hover');
  useDoc([a, b, c]);
  select([a.id, b.id, c.id]);
  combineAsVariants();
  const set = getParent(a.id);
  renameVariantValue(set, 'Size', 'Small', 'S');
  eq([a.name, c.name], ['Size=S, State=Default', 'Size=S, State=Hover']);
  reorderVariantValues(set, 'Size', ['Large', 'S']);
  eq(variantDefs(set).Size, ['Large', 'S']);
  reorderVariantProperty(set, 'State', 'Size');
  eq(a.name, 'State=Default, Size=S');
  ok(removeVariantProperty(set, 'Size'), 'removed');
  eq(variantConflicts(set).length, 1); // a and b are both State=Default now
  ok(!removeVariantProperty(set, 'State'), 'a set keeps at least one variant property');
});

test('component props: true/false variant values read as a toggle; the default variant is top-left', () => {
  eq(toggleValues(['False', 'True']), { on: 'True', off: 'False' });
  eq(toggleValues(['on', 'off']), { on: 'on', off: 'off' });
  eq(toggleValues(['Small', 'Large']), null);
  const a = button('Disabled=false');
  const b = button('Disabled=true');
  a.x = 200;
  useDoc([a, b]);
  select([a.id, b.id]);
  combineAsVariants();
  eq(defaultVariant(getParent(a.id)), b);
});

test('component props: changed property values count as changes; Reset all changes keeps the variant', () => {
  const a = button('State=Default');
  const b = button('State=Hover');
  useDoc([a, b]);
  select([a.id, b.id]);
  combineAsVariants();
  const pid = addComponentProp(a, 'text', { name: 'Label', value: 'Button' });
  bindLayerProp(a.children[1], 'text', pid);
  bindLayerProp(b.children[1], 'text', pid);
  const inst = createInstance(a);
  eq(overrideCount(inst), 0);
  switchVariant(inst, 'State', 'Hover');
  setInstanceProp(inst, pid, 'Buy');
  syncInstances();
  eq([overrideCount(inst), inst.children[1].text], [1, 'Buy']);
  resetOverrides(inst);
  syncInstances();
  eq([overrideCount(inst), inst.children[1].text, mainComponentOf(inst).name], [0, 'Button', 'State=Hover']);
});

test('component props: nested instances with properties can show them on outer instances', () => {
  const btn = button();
  const icon = createNode('component', { name: 'Icon', w: 16, h: 16, children: [] });
  const card = createNode('component', { name: 'Card', w: 200, h: 100, children: [] });
  useDoc([btn, icon, card]);
  addComponentProp(btn, 'text', { name: 'Label', value: 'Go' });
  createInstance(btn, { parent: card });
  createInstance(icon, { parent: card });
  eq(nestedInstances(card).map((n) => n.name), ['Button']); // Icon has no properties
});

test('component props: the default value and the main component stay linked, like Figma', () => {
  const main = button();
  useDoc([main]);
  const [icon, label] = main.children;
  const show = addComponentProp(main, 'boolean', { name: 'Show icon', value: true });
  const text = addComponentProp(main, 'text', { name: 'Label', value: 'Button' });
  bindLayerProp(icon, 'visible', show);
  bindLayerProp(label, 'text', text);
  const inst = createInstance(main);
  updateComponentProp(main, show, { default: false });
  eq(icon.visible, false); // the main component shows the default
  editNode(label, ['text'], (n) => void (n.text = 'Submit'));
  eq(propsOf(main)[text].default, 'Submit'); // editing the main's text sets the default
  syncInstances();
  eq([inst.children[0].visible, inst.children[1].text], [false, 'Submit']);
});
