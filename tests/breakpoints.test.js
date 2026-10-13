// Responsive breakpoints: an auto layout frame lays out differently at a width or narrower.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, makePaint } from '../src/store.js';
import { syncInstances, createInstance } from '../src/components.js';
import { applyLayouts, DEFAULT_LAYOUT, layoutOf, activeBreakpoint } from '../src/layout.js';
import { toProjectFile, fromProjectFile } from '../src/project-format.js';
import { validateFile } from '../src/validate.js';
import { breakpointCSS } from '../src/inspect.js';

const box = (name, w = 100, h = 40) => createNode('rect', { name, w, h, fills: [makePaint('#3B5BFF')] });
const responsive = (w) => createNode('frame', {
  name: 'Cards', w, h: 300, sizingV: 'hug',
  layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 24, pl: 16, pr: 16, breakpoints: [{ maxW: 600, mode: 'vertical', gap: 12 }, { maxW: 360, gap: 4 }] },
  children: [box('A'), box('B')],
});

test('breakpoints: the narrowest that fits the frame’s width wins; wider, the frame’s own layout', () => {
  const f = responsive(800);
  useDoc([f]);
  applyLayouts();
  eq([activeBreakpoint(f), f.children.map((k) => [k.x, k.y]), f.h], [null, [[16, 0], [140, 0]], 40]);
  f.w = 500;
  applyLayouts();
  eq([activeBreakpoint(f).maxW, layoutOf(f).mode, f.children.map((k) => [k.x, k.y]), f.h], [600, 'vertical', [[16, 0], [16, 52]], 92], 'a column, 12 apart');
  f.w = 320;
  applyLayouts();
  eq([layoutOf(f).mode, layoutOf(f).gap, f.children[1].y], ['horizontal', 4, 0], 'the ≤360 one: only its gap (the frame’s mode)');
  eq(f.layout.mode, 'horizontal', 'the frame’s own layout is unchanged');
});

test('breakpoints: an instance resized narrower reflows like its component would', () => {
  const card = createNode('component', {
    name: 'Card', w: 400, h: 60, sizingV: 'hug',
    layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 10, breakpoints: [{ maxW: 240, mode: 'vertical' }] },
    children: [box('Media', 80, 50), box('Text', 120, 20)],
  });
  useDoc([card]);
  const inst = createInstance(card, { x: 0, y: 200 });
  syncInstances();
  applyLayouts();
  eq(inst.children[1].y, 0, 'as wide as its component: a row');
  inst.w = 200;
  syncInstances();
  applyLayouts();
  eq([inst.children[1].x, inst.children[1].y, inst.h], [0, 60, 80], 'narrow: stacked');
  eq(card.children[1].y, 0, 'the component itself still a row');
});

test('breakpoints: as CSS, in project files, and checked', () => {
  const f = responsive(800);
  const doc = useDoc([f]);
  eq(breakpointCSS(f), '@media (max-width: 600px) {\n  flex-direction: column;\n  gap: 12px;\n}\n@media (max-width: 360px) {\n  gap: 4px;\n}');
  const file = toProjectFile(doc).file;
  eq(file.pages[0].children[0].layout.breakpoints, [{ maxW: 600, mode: 'vertical', gap: 12 }, { maxW: 360, gap: 4 }]);
  eq(fromProjectFile(file).doc.pages[0].children[0].layout.breakpoints.length, 2);
  file.pages[0].children[0].layout.breakpoints = [{ maxW: 0, mode: 'diagonal', color: 'red' }];
  const errors = validateFile(file).filter((i) => i.level === 'error').map((i) => i.at.replace(/^.*breakpoints/, 'breakpoints'));
  eq(errors, ['breakpoints[0].maxW', 'breakpoints[0].color', 'breakpoints[0].mode']);
  ok(true);
});

test('breakpoints: hide layers at a width; drawn and laid out without them, never saved as hidden', async () => {
  const { nodeSVG } = await import('../src/render.js');
  const { isShown } = await import('../src/store.js');
  const side = box('Sidebar', 200);
  const f = createNode('frame', {
    name: 'Page', w: 800, h: 200,
    layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 10, breakpoints: [{ maxW: 600, hide: [side.id] }] },
    children: [side, box('Main', 300)],
  });
  const doc = useDoc([f]);
  applyLayouts();
  eq([isShown(side), f.children[1].x], [true, 210]);
  f.w = 500;
  applyLayouts();
  eq([isShown(side), side.visible, f.children[1].x], [false, true, 0], 'hidden at 500px; Main moves up');
  eq(nodeSVG(side), '', 'and not drawn');
  ok(breakpointCSS(f).includes('/* hidden (display: none): Sidebar */'));
  eq(toProjectFile(doc).file.pages[0].children[0].children[0].visible, undefined, 'its own visibility is unchanged in the file');
  f.w = 800;
  applyLayouts();
  ok(isShown(side), 'wide again: shown');
  // In a component: its instances hide their copy when resized.
  const badge = box('Badge', 30, 20);
  const card = createNode('component', { name: 'Card', w: 300, h: 40, layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', breakpoints: [{ maxW: 200, hide: [badge.id] }] }, children: [box('Title', 100, 20), badge] });
  useDoc([card]);
  const inst = createInstance(card, { x: 0, y: 100 });
  syncInstances();
  inst.w = 150;
  syncInstances();
  applyLayouts();
  eq([isShown(inst.children[1]), isShown(badge)], [false, true]);
});
