import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, makePaint, editNode } from '../src/store.js';
import {
  resolveVariables, createCollection, createVariable, bindVariable, addMode, extendCollection, setOverride,
  clearOverride, deleteCollection, collections,
} from '../src/variables.js';
import { syncInstances, createInstance } from '../src/components.js';

function brandSetup() {
  const a = createNode('rect', { name: 'A', fills: [makePaint('#000000')] });
  const b = createNode('rect', { name: 'B', fills: [makePaint('#000000')] });
  const frame = createNode('frame', { name: 'Brand B area', children: [b] });
  useDoc([a, frame]);
  const base = createCollection('Color');
  const primary = createVariable(base, 'color', 'primary');
  const surface = createVariable(base, 'color', 'surface');
  primary.valuesByMode[base.defaultModeId] = '#0D99FF';
  surface.valuesByMode[base.defaultModeId] = '#FFFFFF';
  bindVariable(a, 'fills.0.color', primary.id);
  bindVariable(b, 'fills.0.color', primary.id);
  return { a, b, frame, base, primary, surface };
}

test('extended: an extension overrides values only where it is applied', () => {
  const { a, b, frame, base, primary } = brandSetup();
  const brandB = extendCollection(base);
  setOverride(brandB, primary.id, brandB.modes[0].id, '#F24822');
  frame.modes = { [brandB.id]: brandB.modes[0].id };
  resolveVariables();
  eq([a.fills[0].color, b.fills[0].color], ['#0D99FF', '#F24822']);
});

test('extended: values it does not override keep following the parent', () => {
  const { b, frame, base, surface } = brandSetup();
  const brandB = extendCollection(base);
  bindVariable(b, 'strokes.0.color', surface.id);
  b.strokes = [makePaint('#000000')];
  frame.modes = { [brandB.id]: brandB.modes[0].id };
  surface.valuesByMode[base.defaultModeId] = '#EEEEEE';
  resolveVariables();
  eq(b.strokes[0].color, '#EEEEEE');
});

test('extended: extensions of extensions inherit through the chain', () => {
  const { b, frame, base, primary } = brandSetup();
  const brand = extendCollection(base);
  setOverride(brand, primary.id, brand.modes[0].id, '#9747FF');
  const seasonal = extendCollection(brand);
  frame.modes = { [seasonal.id]: seasonal.modes[0].id };
  resolveVariables();
  eq(b.fills[0].color, '#9747FF');
  setOverride(seasonal, primary.id, seasonal.modes[0].id, '#FFC700');
  resolveVariables();
  eq(b.fills[0].color, '#FFC700');
  clearOverride(seasonal, primary.id, seasonal.modes[0].id);
  resolveVariables();
  eq(b.fills[0].color, '#9747FF');
});

test('extended: modes added to the parent appear in its extensions', () => {
  const { base } = brandSetup();
  const brand = extendCollection(base);
  const dark = addMode(base, 'Dark');
  resolveVariables(); // reindex syncs extension modes
  ok(brand.modes.some((m) => m.parentModeId === dark.id), 'extension gained the Dark mode');
});

test('extended: a parent mode maps to the matching extension mode', () => {
  const { b, frame, base, primary } = brandSetup();
  const dark = addMode(base, 'Dark');
  primary.valuesByMode[dark.id] = '#003366';
  const brand = extendCollection(base);
  const brandDark = brand.modes.find((m) => m.parentModeId === dark.id);
  frame.modes = { [brand.id]: brandDark.id };
  resolveVariables();
  eq(b.fills[0].color, '#003366');
});

test('extended: deleting a collection removes its extensions too', () => {
  const { base } = brandSetup();
  extendCollection(base);
  deleteCollection(base);
  eq(collections().length, 0);
});

test('extended: an instance can apply a brand to a whole component', () => {
  const bg = createNode('rect', { name: 'Bg', fills: [makePaint('#000000')] });
  const comp = createNode('component', { name: 'Card', children: [bg] });
  useDoc([comp]);
  const base = createCollection('Color');
  const primary = createVariable(base, 'color', 'primary');
  primary.valuesByMode[base.defaultModeId] = '#0D99FF';
  bindVariable(bg, 'fills.0.color', primary.id);
  const brand = extendCollection(base);
  setOverride(brand, primary.id, brand.modes[0].id, '#14AE5C');
  const inst = createInstance(comp);
  editNode(inst, ['modes'], (n) => void (n.modes = { [brand.id]: brand.modes[0].id }));
  syncInstances();
  resolveVariables();
  eq([bg.fills[0].color, inst.children[0].fills[0].color], ['#0D99FF', '#14AE5C']);
});
