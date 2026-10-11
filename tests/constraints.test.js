import { test, eq } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, select, editNode } from '../src/store.js';
import { setProps } from '../src/commands.js';
import { syncInstances, createInstance } from '../src/components.js';
import { applyLayouts, DEFAULT_LAYOUT } from '../src/layout.js';

const rect = (name, x, w, h, constraints) => createNode('rect', { name, x, y: 10, w, h, constraints });

test('constraints: resizing a frame applies left, right, left & right, center and scale', () => {
  const kids = [
    rect('L', 10, 20, 20),
    rect('R', 170, 20, 20, { h: 'right' }),
    rect('LR', 10, 180, 20, { h: 'leftRight' }),
    rect('C', 90, 20, 20, { h: 'center' }),
    rect('S', 50, 100, 20, { h: 'scale' }),
  ];
  const frame = createNode('frame', { w: 200, h: 100, children: kids });
  useDoc([frame]);
  select([frame.id]);
  setProps({ w: 400 });
  const [l, r, lr, c, s] = kids;
  eq([l.x, l.w], [10, 20]);
  eq([r.x, r.w], [370, 20]);
  eq([lr.x, lr.w], [10, 380]);
  eq([c.x], [190]);
  eq([s.x, s.w], [100, 200]);
});

test('constraints: vertical rules work the same way', () => {
  const b = createNode('rect', { y: 70, h: 20, constraints: { v: 'bottom' } });
  const tb = createNode('rect', { y: 10, h: 80, constraints: { v: 'topBottom' } });
  const frame = createNode('frame', { w: 100, h: 100, children: [b, tb] });
  useDoc([frame]);
  select([frame.id]);
  setProps({ h: 300 });
  eq([b.y, tb.h], [270, 280]);
});

test('constraints: a stretched frame passes the resize on to its children', () => {
  const pin = rect('Pin', 70, 20, 20, { h: 'right' });
  const inner = createNode('frame', { name: 'Inner', x: 10, y: 10, w: 100, h: 50, constraints: { h: 'leftRight' }, children: [pin] });
  const outer = createNode('frame', { w: 120, h: 80, children: [inner] });
  useDoc([outer]);
  select([outer.id]);
  setProps({ w: 220 });
  eq([inner.w, pin.x], [200, 170]);
});

test('constraints: a resized instance repositions layers; overridden text keeps its width', () => {
  const close = rect('Close', 170, 20, 20, { h: 'right' });
  const label = createNode('text', { name: 'Label', x: 10, y: 10, text: 'Hi', autoResize: 'width' });
  const comp = createNode('component', { name: 'Toast', w: 200, h: 40, children: [label, close] });
  useDoc([comp]);
  const inst = createInstance(comp);
  editNode(inst.children[0], ['text'], (n) => void (n.text = 'A much longer message'));
  syncInstances();
  const measured = inst.children[0].w;
  inst.w = 300;
  syncInstances();
  eq([inst.children[1].x, inst.children[0].w], [270, measured]);
});

test('constraints: in auto layout only absolute layers follow constraints', () => {
  const a = rect('A', 0, 50, 20, { h: 'right' });
  const abs = rect('Badge', 80, 20, 20, { h: 'right' });
  abs.absolute = true;
  const frame = createNode('frame', { w: 100, h: 40, layout: { ...DEFAULT_LAYOUT, mode: 'horizontal' }, children: [a, abs] });
  useDoc([frame]);
  select([frame.id]);
  setProps({ w: 200 });
  applyLayouts();
  eq([a.x, abs.x], [0, 180]);
});
