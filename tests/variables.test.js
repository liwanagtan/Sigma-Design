import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, editNode, makePaint } from '../src/store.js';
import {
  resolveVariables, createCollection, createVariable, bindVariable, setAlias, deleteVariable, addMode, wouldCycle,
} from '../src/variables.js';
import { syncInstances, createInstance } from '../src/components.js';

function setup() {
  const rect = createNode('rect', { name: 'Card', fills: [makePaint('#D9D9D9')] });
  useDoc([rect]);
  const col = createCollection('Tokens');
  return { rect, col };
}

test('variables: bound fill color and radius follow the variable', () => {
  const { rect, col } = setup();
  const brand = createVariable(col, 'color', 'brand');
  brand.valuesByMode[col.defaultModeId] = '#0D99FF';
  const r = createVariable(col, 'number', 'radius/md');
  r.valuesByMode[col.defaultModeId] = 12;
  bindVariable(rect, 'fills.0.color', brand.id);
  bindVariable(rect, 'radius', r.id);
  resolveVariables();
  eq([rect.fills[0].color, rect.radius], ['#0D99FF', 12]);
  brand.valuesByMode[col.defaultModeId] = '#14AE5C';
  resolveVariables();
  eq(rect.fills[0].color, '#14AE5C');
});

test('variables: aliases resolve, and alias loops are refused', () => {
  const { rect, col } = setup();
  const base = createVariable(col, 'color', 'blue/500');
  base.valuesByMode[col.defaultModeId] = '#0D99FF';
  const semantic = createVariable(col, 'color', 'bg/primary');
  ok(setAlias(semantic, col.defaultModeId, base.id), 'alias set');
  bindVariable(rect, 'fills.0.color', semantic.id);
  resolveVariables();
  eq(rect.fills[0].color, '#0D99FF');
  ok(wouldCycle(base.id, semantic.id), 'base → semantic would loop');
  ok(!setAlias(base, col.defaultModeId, semantic.id), 'refused');
  const n = createVariable(col, 'number', 'n');
  ok(!setAlias(n, col.defaultModeId, base.id), 'type mismatch refused');
});

test('variables: typing a raw value detaches the variable', () => {
  const { rect, col } = setup();
  const r = createVariable(col, 'number', 'radius');
  r.valuesByMode[col.defaultModeId] = 8;
  bindVariable(rect, 'radius', r.id);
  resolveVariables();
  editNode(rect, ['radius'], (n) => void (n.radius = 30));
  ok(!rect.bindings, 'binding removed');
  resolveVariables();
  eq(rect.radius, 30);
});

test('variables: a layer pins a mode for itself and its children', () => {
  const child = createNode('rect', { name: 'Inner', fills: [makePaint('#000000')] });
  const frame = createNode('frame', { name: 'Dark area', children: [child] });
  const outside = createNode('rect', { name: 'Outside', fills: [makePaint('#000000')] });
  useDoc([frame, outside]);
  const col = createCollection('Theme');
  const dark = addMode(col, 'Dark');
  const bg = createVariable(col, 'color', 'bg');
  bg.valuesByMode[col.defaultModeId] = '#FFFFFF';
  bg.valuesByMode[dark.id] = '#1E1E1E';
  bindVariable(child, 'fills.0.color', bg.id);
  bindVariable(outside, 'fills.0.color', bg.id);
  frame.modes = { [col.id]: dark.id };
  resolveVariables();
  eq([child.fills[0].color, outside.fills[0].color], ['#1E1E1E', '#FFFFFF']);
});

test('variables: deleting a variable keeps current values and unbinds layers', () => {
  const { rect, col } = setup();
  const base = createVariable(col, 'color', 'base');
  base.valuesByMode[col.defaultModeId] = '#F24822';
  const alias = createVariable(col, 'color', 'alias');
  setAlias(alias, col.defaultModeId, base.id);
  bindVariable(rect, 'fills.0.color', base.id);
  resolveVariables();
  deleteVariable(base.id);
  ok(!rect.bindings, 'unbound');
  eq(rect.fills[0].color, '#F24822');
  eq(alias.valuesByMode[col.defaultModeId], '#F24822');
});

test('variables: 8-digit colors set the paint opacity', () => {
  const { rect, col } = setup();
  const glass = createVariable(col, 'color', 'glass');
  glass.valuesByMode[col.defaultModeId] = '#FFFFFF80';
  bindVariable(rect, 'fills.0.color', glass.id);
  resolveVariables();
  eq([rect.fills[0].color, rect.fills[0].opacity], ['#FFFFFF', 0.5]);
});

test('variables: bindings in a main component reach its instances; detaching there is an override', () => {
  const bg = createNode('rect', { name: 'Bg', fills: [makePaint('#D9D9D9')] });
  const comp = createNode('component', { name: 'Chip', children: [bg] });
  useDoc([comp]);
  const col = createCollection('Tokens');
  const brand = createVariable(col, 'color', 'brand');
  brand.valuesByMode[col.defaultModeId] = '#9747FF';
  bindVariable(bg, 'fills.0.color', brand.id);
  const inst = createInstance(comp);
  resolveVariables();
  eq(inst.children[0].fills[0].color, '#9747FF');
  editNode(inst.children[0], ['fills.0.color'], (n) => void (n.fills[0].color = '#000000'));
  syncInstances();
  resolveVariables();
  eq(inst.children[0].fills[0].color, '#000000');
  eq(bg.bindings['fills.0.color'], brand.id);
  eq(state.doc.variables.collections.length, 1);
});

test('modes: the page mode applies unless a layer pins its own', () => {
  const a = createNode('rect', { name: 'A', fills: [makePaint('#000000')] });
  const b = createNode('rect', { name: 'B', fills: [makePaint('#000000')] });
  const doc = useDoc([a, b]);
  const col = createCollection('Theme');
  const dark = addMode(col, 'Dark');
  const bg = createVariable(col, 'color', 'bg');
  bg.valuesByMode[col.defaultModeId] = '#FFFFFF';
  bg.valuesByMode[dark.id] = '#111111';
  bindVariable(a, 'fills.0.color', bg.id);
  bindVariable(b, 'fills.0.color', bg.id);
  doc.pages[0].modes = { [col.id]: dark.id };
  b.modes = { [col.id]: col.defaultModeId };
  resolveVariables();
  eq([a.fills[0].color, b.fills[0].color], ['#111111', '#FFFFFF']);
});

test('modes: instances inherit a mode pinned on their main component and can pin their own', () => {
  const bg = createNode('rect', { name: 'Bg', fills: [makePaint('#000000')] });
  const comp = createNode('component', { name: 'Card', children: [bg] });
  useDoc([comp]);
  const col = createCollection('Theme');
  const dark = addMode(col, 'Dark');
  const v = createVariable(col, 'color', 'bg');
  v.valuesByMode[col.defaultModeId] = '#FFFFFF';
  v.valuesByMode[dark.id] = '#111111';
  bindVariable(bg, 'fills.0.color', v.id);
  comp.modes = { [col.id]: dark.id };
  const inst = createInstance(comp);
  const lightInst = createInstance(comp, { x: 300 });
  editNode(lightInst, ['modes'], (n) => void (n.modes = { [col.id]: col.defaultModeId }));
  syncInstances();
  resolveVariables();
  eq([inst.children[0].fills[0].color, lightInst.children[0].fills[0].color], ['#111111', '#FFFFFF']);
});

test("modes: variables on a main component's own fill re-resolve in each instance's mode", () => {
  const comp = createNode('component', { name: 'Tag', fills: [makePaint('#000000')], children: [] });
  useDoc([comp]);
  const col = createCollection('Theme');
  const dark = addMode(col, 'Dark');
  const v = createVariable(col, 'color', 'surface');
  v.valuesByMode[col.defaultModeId] = '#FFFFFF';
  v.valuesByMode[dark.id] = '#111111';
  bindVariable(comp, 'fills.0.color', v.id);
  const inst = createInstance(comp);
  editNode(inst, ['modes'], (n) => void (n.modes = { [col.id]: dark.id }));
  syncInstances();
  resolveVariables();
  eq([comp.fills[0].color, inst.fills[0].color], ['#FFFFFF', '#111111']);
});
