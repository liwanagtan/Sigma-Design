// Right-to-left auto layout (Part D, "Later"): a frame's dir, inherited like HTML's.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, select } from '../src/store.js';
import { nudge } from '../src/commands.js';
import { syncInstances, createInstance } from '../src/components.js';
import { applyLayouts, DEFAULT_LAYOUT, directionOf, flowInsertBefore } from '../src/layout.js';
import { toProjectFile, fromProjectFile } from '../src/project-format.js';
import { validateFile } from '../src/validate.js';
import { layerCSS } from '../src/inspect.js';

const box = (name, w, h = 20) => createNode('rect', { name, w, h });
const row = (props, kids) => createNode('frame', { name: 'Row', w: 300, h: 60, layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 10, pl: 10, pr: 20 }, ...props, children: kids });

test('rtl: a row starts at the right, padding stays where it is, and the counter axis starts at the right', () => {
  const a = box('A', 50), b = box('B', 60);
  const f = row({ dir: 'rtl' }, [a, b]);
  const col = createNode('frame', { name: 'Column', x: 0, y: 100, w: 200, h: 100, dir: 'rtl', layout: { ...DEFAULT_LAYOUT, mode: 'vertical', pl: 10, pr: 30 }, children: [box('C', 40)] });
  useDoc([f, col]);
  applyLayouts();
  eq([a.x, b.x], [230, 160], 'A at the right edge, inside the 20px right padding');
  eq(col.children[0].x, 130, 'start is the right edge, inside the 30px right padding');
  f.layout.alignP = 'end';
  applyLayouts();
  eq([a.x, b.x], [80, 10], 'end is the left edge');
  delete f.dir;
  f.layout.alignP = 'start';
  applyLayouts();
  eq([a.x, b.x], [10, 70], 'left to right again');
  ok(!layerCSS(f).some(([k]) => k === 'direction'));
  f.dir = 'rtl';
  ok(layerCSS(f).some(([k, v]) => k === 'direction' && v === 'rtl'), 'Inspect writes it as CSS');
});

test('rtl: frames and instances inside follow the frame they’re in, unless they set their own', () => {
  const label = box('Label', 40);
  const icon = box('Icon', 16, 16);
  const button = createNode('component', { name: 'Button', w: 100, h: 32, layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 8, pl: 12, pr: 12, alignC: 'center' }, sizingH: 'hug', children: [icon, label] });
  const inner = row({ name: 'Inner', w: 200 }, [box('X', 30)]);
  const ltr = row({ name: 'Kept', w: 200, dir: 'ltr' }, [box('Y', 30)]);
  const screen = createNode('frame', { name: 'Screen', x: 0, y: 200, w: 400, h: 300, dir: 'rtl', children: [inner, ltr] });
  useDoc([button, screen]);
  const inst = createInstance(button, { parent: screen, x: 0, y: 200 });
  syncInstances();
  applyLayouts();
  eq([directionOf(inner), directionOf(ltr), directionOf(inst.children[0])], ['rtl', 'ltr', 'rtl']);
  eq(inner.children[0].x, 150, 'inherited: 200 - 20 - 30');
  eq(ltr.children[0].x, 10, 'its own ltr');
  eq([inst.w, inst.children[0].x, inst.children[1].x], [88, 60, 12], 'the instance’s icon goes to the right of its label');
  eq([icon.x, label.x], [12, 36], 'the main component stays left to right');
  // Dropping into a right-to-left row: further left is later.
  const f = row({ dir: 'rtl' }, [box('A', 50), box('B', 60)]);
  useDoc([f]);
  applyLayouts();
  eq(flowInsertBefore(f, { x: 200, y: 10 }, new Set())?.name, 'B', 'between A (230–280) and B (160–220): before B');
  eq(flowInsertBefore(f, { x: 100, y: 10 }, new Set()), null, 'left of B: at the end');
});

test('rtl: the left arrow moves a layer later in a right-to-left row (it runs from the right)', () => {
  const a = box('A', 50), b = box('B', 60);
  const f = row({ dir: 'rtl' }, [a, b]);
  useDoc([f]);
  applyLayouts();
  select([a.id]);
  nudge(-1, 0);
  eq(f.children.map((k) => k.name), ['B', 'A'], 'A, at the right, moved left: after B');
  nudge(1, 0);
  eq(f.children.map((k) => k.name), ['A', 'B']);
});

test('rtl: kept in project files and checked', () => {
  const f = row({ dir: 'rtl' }, [box('A', 50)]);
  const doc = useDoc([f]);
  const file = toProjectFile(doc).file;
  eq(file.pages[0].children[0].dir, 'rtl');
  eq(fromProjectFile(file).doc.pages[0].children[0].dir, 'rtl');
  file.pages[0].children[0].dir = 'right';
  ok(validateFile(file).some((i) => i.level === 'error' && /dir/.test(i.at) && /"rtl" or "ltr"/.test(i.message)));
});
