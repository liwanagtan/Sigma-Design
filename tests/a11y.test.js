// Accessibility (Phase 16): annotations, roles and the check.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, makePaint, getNode, editNode } from '../src/store.js';
import { syncInstances, createInstance } from '../src/components.js';
import { checkAccessibility, a11yOf, roleOf, a11yCode } from '../src/a11y.js';

const text = (name, color, extra = {}) => createNode('text', { name, text: name, fills: [makePaint(color)], fontSize: 16, ...extra });
const kinds = (issues) => issues.map((i) => `${i.severity} ${i.kind} ${i.name}`);

test('a11y check: contrast (disabled exempt), small text, alt text and decorative images', () => {
  const ok1 = text('Body', '#1E1E1E');
  const faint = text('Faint', '#BBBBBB');
  const big = text('Big', '#888888', { fontSize: 28 }); // 3.5:1: enough for large text
  const tiny = text('Tiny', '#1E1E1E', { fontSize: 10 });
  const photo = createNode('image', { name: 'Photo', w: 100, h: 60 });
  const logo = createNode('image', { name: 'Logo', w: 40, h: 40, a11y: { decorative: true } });
  const off = createNode('frame', { name: 'Disabled', w: 100, h: 40, fills: [makePaint('#FFFFFF')], children: [text('Off', '#CCCCCC')] });
  const frame = createNode('frame', { name: 'Screen', w: 400, h: 400, fills: [makePaint('#FFFFFF')], children: [ok1, faint, big, tiny, photo, logo, off] });
  useDoc([frame]);
  eq(kinds(checkAccessibility([frame])), ['error contrast Faint', 'warning text-size Tiny', 'error alt Photo']);
  ok(checkAccessibility([frame])[0].message.startsWith('1.91:1 against #FFFFFF; needs 4.5:1'));
  photo.a11y = { alt: 'Our team' };
  eq(kinds(checkAccessibility([frame], { minText: 10 })), ['error contrast Faint']);
});

test('a11y check: controls by role, tap targets, accessible names, headings and focus order', () => {
  const icon = createNode('icon', { name: 'Icon', w: 16, h: 16 });
  const close = createNode('component', { name: 'Icon button', w: 32, h: 32, children: [icon] });
  const button = createNode('component', { name: 'Button', w: 120, h: 48, fills: [makePaint('#FFFFFF')], children: [text('Label', '#1E1E1E')] });
  const h1 = text('Title', '#1E1E1E', { a11y: { heading: 1 } });
  const h3 = text('Section', '#1E1E1E', { a11y: { heading: 3 } });
  const frame = createNode('frame', { name: 'Screen', x: 0, y: 200, w: 400, h: 300, fills: [makePaint('#FFFFFF')], children: [h1, h3] });
  useDoc([close, button, frame]);
  const a = createInstance(close, { parent: frame, x: 10, y: 10 });
  const b = createInstance(button, { parent: frame, x: 10, y: 60 });
  const tiny = createInstance(close, { parent: frame, x: 60, y: 10 });
  tiny.w = 20;
  tiny.h = 20;
  syncInstances();
  eq([roleOf(a), roleOf(b), roleOf(h1), roleOf(frame)], ['button', 'button', 'heading', null], 'roles from component names');
  a.a11y = { focus: 1 };
  b.a11y = { focus: 1 };
  const issues = checkAccessibility([frame]);
  eq(kinds(issues), [
    'warning target Icon button', 'error label Icon button',
    'error target Icon button', 'error label Icon button',
    'warning heading Section',
    'warning focus Icon button', 'warning focus Button',
  ]);
  eq(issues[0].message, 'Button is 32×32; under 44×44');
  eq(issues[2].message, 'Button is 20×20; under 24×24');
  ok(!checkAccessibility([frame], { target: 48 }).some((i) => i.name === 'Button' && i.kind === 'target'), 'a 48px button meets Material’s size');
  close.a11y = { label: 'Close' };
  ok(!checkAccessibility([frame]).some((i) => i.kind === 'label'), 'the component’s label is every instance’s');
});

test('a11y annotations: instances inherit and override; layers inside them per instance; the code they mean', () => {
  const pic = createNode('image', { name: 'Photo', w: 100, h: 60, a11y: { alt: 'Placeholder' } });
  const card = createNode('component', { name: 'Card', w: 200, h: 200, children: [pic], a11y: { role: 'list' } });
  card.docs = { role: 'navigation' };
  useDoc([card]);
  const inst = createInstance(card, { x: 0, y: 300 });
  syncInstances();
  eq(a11yOf(inst), { role: 'list' });
  eq(roleOf(inst), 'list', 'the layer’s own role wins over the docs');
  delete card.a11y;
  eq(roleOf(inst), 'navigation', 'then the component docs’');
  inst.a11y = { label: 'Featured' };
  eq(a11yCode(inst), ['role="navigation"', 'aria-label="Featured"']);
  const inner = inst.children[0];
  eq(a11yOf(inner).alt, 'Placeholder', 'from the main component');
  editNode(inner, ['a11y'], () => void (inner.a11y = { alt: 'A team at work' }));
  syncInstances();
  eq(inst.overrides.Photo.a11y, { alt: 'A team at work' }, 'kept as an override');
  eq([getNode(inner.id).a11y.alt, pic.a11y.alt], ['A team at work', 'Placeholder']);
  eq(a11yCode(getNode(inner.id)), ['alt="A team at work"']);
  eq(a11yCode({ ...pic, a11y: { decorative: true } }), ['alt=""']);
  eq(a11yCode(createNode('text', { name: 'T', text: 'Hi', a11y: { heading: 2, focus: 4 } })), ['<h2>', 'focus order 4']);
});
