import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, editNode, makePaint } from '../src/store.js';
import {
  resolveVariables, createCollection, createVariable, bindVariable, addMode, extendCollection, setOverride,
  splitColor, joinColor,
} from '../src/variables.js';

test('tokens: color opacity sets the paint opacity; a solid color resets it to 100%', () => {
  const rect = createNode('rect', { fills: [makePaint('#000000', 0.3)] });
  useDoc([rect]);
  const col = createCollection('Color');
  const glass = createVariable(col, 'color', 'glass');
  glass.valuesByMode[col.defaultModeId] = joinColor('#0D99FF', 0.4);
  bindVariable(rect, 'fills.0.color', glass.id);
  resolveVariables();
  eq([rect.fills[0].color, rect.fills[0].opacity], ['#0D99FF', 0.4]);
  glass.valuesByMode[col.defaultModeId] = '#0D99FF';
  resolveVariables();
  eq(rect.fills[0].opacity, 1);
});

test('tokens: splitColor and joinColor round-trip', () => {
  eq(splitColor('#0D99FF80'), { hex: '#0D99FF', alpha: 0.5 });
  eq(joinColor('#0d99ff', 1), '#0D99FF');
  eq(joinColor('#0D99FF', 0.5), '#0D99FF80');
  eq(splitColor(joinColor('#123456', 0.25)).alpha, 0.25);
});

function typeSetup() {
  const a = createNode('text', { name: 'H1', text: 'Hello', autoResize: 'width' });
  const b = createNode('text', { name: 'H1 copy', text: 'World', autoResize: 'width' });
  useDoc([a, b]);
  const col = createCollection('Type');
  const size = createVariable(col, 'number', 'font/size/xl');
  size.valuesByMode[col.defaultModeId] = 32;
  const heading = createVariable(col, 'typography', 'heading/h1');
  heading.valuesByMode[col.defaultModeId] = {
    fontFamily: 'Playfair Display', fontWeight: 700, fontSize: { alias: size.id }, lineHeight: 120, letterSpacing: -0.5,
  };
  bindVariable(a, 'typography', heading.id);
  bindVariable(b, 'typography', heading.id);
  return { a, b, col, size, heading };
}

test('tokens: a typography token sets all five text properties, with aliased fields', () => {
  const { a, b, col, size } = typeSetup();
  resolveVariables();
  eq([a.fontFamily, a.fontWeight, a.fontSize, a.lineHeight, a.letterSpacing], ['Playfair Display', 700, 32, 120, -0.5]);
  size.valuesByMode[col.defaultModeId] = 48;
  resolveVariables();
  eq([a.fontSize, b.fontSize], [48, 48]);
});

test('tokens: changing a font property by hand detaches the text style', () => {
  const { a, b } = typeSetup();
  resolveVariables();
  editNode(a, ['fontSize'], (n) => void (n.fontSize = 20));
  ok(!a.bindings?.typography, 'detached');
  ok(b.bindings.typography, 'other layer still linked');
  resolveVariables();
  eq(a.fontSize, 20);
});

test('tokens: an extended collection can override one typography field', () => {
  const { b, col, heading } = typeSetup();
  const frame = createNode('frame', { name: 'Brand', children: [] });
  const ext = extendCollection(col);
  setOverride(ext, heading.id, ext.modes[0].id, { ...heading.valuesByMode[col.defaultModeId], fontFamily: 'Space Grotesk' });
  b.modes = { [ext.id]: ext.modes[0].id };
  resolveVariables();
  eq([b.fontFamily, b.fontSize], ['Space Grotesk', 32]);
  ok(frame, 'frame created');
});

test('tokens: each mode of a new typography token has its own value object', () => {
  useDoc([]);
  const col = createCollection('Type');
  addMode(col, 'Compact');
  const t = createVariable(col, 'typography', 'body');
  const [m1, m2] = col.modes;
  t.valuesByMode[m2.id].fontSize = 12;
  eq(t.valuesByMode[m1.id].fontSize, 16);
});
