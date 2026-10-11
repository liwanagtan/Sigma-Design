import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, editNode, makePaint, getNode, reindex, select } from '../src/store.js';
import {
  syncInstances, createInstance, listComponents, publishableComponents, libraryOfComponent, switchVariant, mainComponentOf,
} from '../src/components.js';
import { combineAsVariants } from '../src/commands.js';
import { acceptUpdate, diffComponents } from '../src/libraries.js';

function button(name, color) {
  return createNode('component', {
    name, w: 120, h: 40,
    children: [
      createNode('rect', { name: 'Bg', w: 120, h: 40, fills: [makePaint(color)] }),
      createNode('text', { name: 'Label', text: 'Button', autoResize: 'fixed', w: 80, h: 20 }),
    ],
  });
}

// Publish from one document, then open another one that links the published snapshot.
function publishAndLink(nodes) {
  useDoc(nodes);
  const published = { version: 1, components: structuredClone(publishableComponents()) };
  useDoc([]);
  acceptUpdate({ kind: 'components', lib: { fileId: 'lib-c' }, meta: { name: 'UI kit' }, published });
  return published;
}

test('component libraries: linked components are listed and can be instanced', () => {
  const main = button('Button', '#0D99FF');
  publishAndLink([main]);
  const [entry] = listComponents();
  eq([entry.node.name, entry.page, entry.library.name], ['Button', null, 'UI kit']);
  ok(libraryOfComponent(entry.node), 'knows its library');
  const inst = createInstance(entry.node, { x: 10, y: 10 });
  eq(inst.children.map((c) => c.name), ['Bg', 'Label']);
  eq(inst.children[0].fills[0].color, '#0D99FF');
});

test('component libraries: accepting an update re-syncs instances and keeps overrides', () => {
  const main = button('Button', '#0D99FF');
  const v1 = publishAndLink([main]);
  const inst = createInstance(getNode(main.id));
  editNode(inst.children[1], ['text'], (n) => void (n.text = 'Buy'));
  const v2 = { version: 2, components: structuredClone(v1.components) };
  v2.components[0].children[0].fills[0].color = '#14AE5C';
  v2.components[0].children[1].fontSize = 22;
  eq(diffComponents(v1.components, v2.components), { added: [], changed: ['Button'], removed: [] });
  acceptUpdate({ kind: 'components', lib: state.doc.componentLibraries[0], meta: { name: 'UI kit' }, published: v2 });
  syncInstances();
  eq([inst.children[0].fills[0].color, inst.children[1].text, inst.children[1].fontSize], ['#14AE5C', 'Buy', 22]);
  eq(state.doc.componentLibraries[0].version, 2);
});

test('component libraries: variants from a library set can be switched', () => {
  const a = button('Size=Small', '#0D99FF');
  const b = button('Size=Large', '#14AE5C');
  useDoc([a, b]);
  select([a.id, b.id]);
  combineAsVariants();
  publishAndLink(structuredClone(state.doc.pages[0].children));
  eq(listComponents().length, 2);
  const inst = createInstance(getNode(a.id));
  ok(switchVariant(inst, 'Size', 'Large'), 'exact match');
  syncInstances();
  eq([mainComponentOf(inst).id, inst.children[0].fills[0].color], [b.id, '#14AE5C']);
});

test('component libraries: unlinking leaves instances with their last look', () => {
  const main = button('Button', '#0D99FF');
  publishAndLink([main]);
  const inst = createInstance(getNode(main.id));
  state.doc.componentLibraries = [];
  reindex();
  syncInstances();
  ok(inst.missingMain, 'flagged as missing');
  eq(inst.children[0].fills[0].color, '#0D99FF');
});

test('component libraries: a local component wins over a library copy with the same id', () => {
  const main = button('Button', '#0D99FF');
  publishAndLink([main]);
  const local = structuredClone(state.doc.componentLibraries[0].components[0]);
  local.children[0].fills[0].color = '#FF0000';
  state.doc.pages[0].children.push(local);
  reindex();
  ok(getNode(main.id) === local, 'index prefers the local node');
  const inst = createInstance(local);
  eq(inst.children[0].fills[0].color, '#FF0000');
});

test('component libraries: re-measured text and moving a component are not unpublished changes', () => {
  const label = createNode('text', { name: 'Label', text: 'Hi', autoResize: 'width', w: 40, h: 20 });
  const comp = createNode('component', { name: 'Tag', x: 0, w: 60, h: 20, children: [label] });
  const before = [structuredClone(comp)];
  label.w = 41;
  comp.x = 300;
  eq(diffComponents(before, [comp]).changed, []);
  label.text = 'Hello';
  eq(diffComponents(before, [comp]).changed, ['Tag']);
});
