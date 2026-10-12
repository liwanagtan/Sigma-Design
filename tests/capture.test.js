// Captured components → Sigma components (src/capture-to-sigma.js).
import { test, eq, ok } from './harness.js';
import { buildComponent, tokenIndex, compareBoxes } from '../src/capture-to-sigma.js';
import { defaultTokenCode } from '../src/code-names.js';

const tokens = tokenIndex([{
  variables: [
    { id: 'v-primary', name: 'color/primary', type: 'color' },
    { id: 'v-border', name: 'color/border', type: 'color' },
    { id: 'v-space-2', name: 'space/2', type: 'number' },
    { id: 'v-space-3', name: 'space/3', type: 'number' },
    { id: 'v-radius', name: 'radius/md', type: 'number', codeSyntax: { web: '--radius' } },
  ],
}], defaultTokenCode);

// A computed style with the defaults a browser reports, plus `over`.
const style = (over = {}) => ({
  display: 'block', 'flex-direction': 'row', 'justify-content': 'normal', 'align-items': 'normal', gap: 'normal', 'row-gap': 'normal', 'column-gap': 'normal',
  'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
  'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', color: 'rgb(0, 0, 0)', opacity: '1',
  'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px',
  'border-top-style': 'none', 'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
  'outline-style': 'none', 'outline-width': '0px', 'box-shadow': 'none', overflow: 'visible',
  'border-top-left-radius': '0px', 'border-top-right-radius': '0px', 'border-bottom-right-radius': '0px', 'border-bottom-left-radius': '0px',
  'font-family': 'Inter', 'font-size': '14px', 'font-weight': '400', 'line-height': '20px', 'letter-spacing': 'normal',
  ...over,
});
const text = (name, t, box, over = {}) => ({ tag: 'span', name, box, style: style(over), authored: {}, children: [{ tag: '#text', name: 'Text', text: t, box: { ...box, y: box.y + 2, h: box.h - 4 } }] });

// A button: flex row, 1px border, padding 8/12 written with tokens, label and a token color.
const buttonCapture = (bg = 'rgb(79, 70, 229)') => ({
  tag: 'button', name: 'Button', box: { x: 0, y: 0, w: 82, h: 38 },
  style: style({
    display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', gap: '8px', 'column-gap': '8px',
    'padding-top': '8px', 'padding-right': '12px', 'padding-bottom': '8px', 'padding-left': '12px',
    'background-color': bg, color: 'rgb(255, 255, 255)',
    'border-top-width': '1px', 'border-right-width': '1px', 'border-bottom-width': '1px', 'border-left-width': '1px',
    'border-top-style': 'solid', 'border-right-style': 'solid', 'border-bottom-style': 'solid', 'border-left-style': 'solid',
    'border-top-color': 'rgb(0, 0, 0)', 'border-right-color': 'rgb(0, 0, 0)', 'border-bottom-color': 'rgb(0, 0, 0)', 'border-left-color': 'rgb(0, 0, 0)',
    'border-top-left-radius': '6px', 'border-top-right-radius': '6px', 'border-bottom-right-radius': '6px', 'border-bottom-left-radius': '6px',
  }),
  authored: { background: 'var(--color-primary)', padding: 'var(--space-2) var(--space-3)', 'border-radius': 'var(--radius)', border: '1px solid var(--color-border)' },
  children: [text('Label', 'Continue', { x: 13, y: 9, w: 56, h: 20 })],
});

test('capture: a flex button becomes auto layout bound to tokens; the border counts into its padding', () => {
  const { node, notes } = buildComponent({ name: 'Button', captures: [{ capture: { tree: buttonCapture() } }] }, { tokens, iconFor: () => null, componentIdFor: () => null });
  eq(node.type, 'component');
  eq(node.layout.mode, 'horizontal');
  eq([node.layout.pt, node.layout.pr, node.layout.pb, node.layout.pl], [9, 13, 9, 13]);
  eq([node.sizingH, node.sizingV], ['hug', 'hug']);
  eq(node.bindings['fills.0.color'], 'v-primary');
  eq(node.bindings['strokes.0.color'], 'v-border');
  eq(node.bindings.radius, 'v-radius', 'a set web code name wins');
  ok(!node.bindings['layout.pt'], 'padding holding the border isn’t the token’s value');
  ok(notes.some((n) => /includes the 1px border/.test(n)));
  eq(node.children[0].type, 'text');
  eq(node.children[0].h, 20, 'a text-only element keeps its own (line) box');
});

test('capture: unevenly spaced blocks become nested columns, so every spacing is kept', () => {
  const card = {
    tag: 'div', name: 'Card', box: { x: 0, y: 0, w: 200, h: 112 }, style: style({ 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' }), authored: {},
    children: [
      text('Title', 'Acme', { x: 16, y: 16, w: 168, h: 20 }),
      text('Body', 'Words', { x: 16, y: 40, w: 168, h: 20 }), // 4px under the title
      text('Action', 'Go', { x: 16, y: 76, w: 40, h: 20 }), // 16px under the body
    ],
  };
  const { node } = buildComponent({ name: 'Card', captures: [{ capture: { tree: card } }] }, { tokens, iconFor: () => null, componentIdFor: () => null });
  eq(node.layout.mode, 'vertical');
  eq(node.layout.gap, 16);
  eq(node.children.map((c) => c.name), ['Title + Body', 'Action']);
  const group = node.children[0];
  eq(group.layout.gap, 4);
  eq(group.children.map((c) => c.sizingH), ['fill', 'fill']);
  eq(node.children[1].sizingH, undefined, 'a narrower child keeps its width');
});

test('capture: several captures make a set in a grid, with properties and nested instances', () => {
  const ctx = { tokens, iconFor: () => null, componentIdFor: () => null, ids: new Set() };
  const { node: set } = buildComponent({
    name: 'Button', props: [{ name: 'Label', type: 'text' }], variantCodeNames: { Variant: 'variant' },
    captures: [
      { variant: { Variant: 'Primary', State: 'Default' }, capture: { tree: buttonCapture() } },
      { variant: { Variant: 'Primary', State: 'Hover' }, capture: { tree: buttonCapture('rgb(67, 56, 202)') } },
      { variant: { Variant: 'Danger', State: 'Default' }, capture: { tree: buttonCapture('rgb(220, 38, 38)') } },
    ],
  }, ctx);
  eq(set.type, 'componentSet');
  eq(set.children.map((c) => c.name), ['Variant=Primary, State=Default', 'Variant=Primary, State=Hover', 'Variant=Danger, State=Default']);
  eq(set.children.map((c) => [c.x, c.y]), [[20, 20], [126, 20], [20, 82]], 'one row per value of the first property');
  eq(set.props['button-label'], { type: 'text', name: 'Label', default: 'Continue' });
  eq(set.children[0].children[0].propRefs, { text: 'button-label' });
  eq(set.codeNames, { Variant: 'variant' });

  const card = { tag: 'div', name: 'Card', box: { x: 0, y: 0, w: 100, h: 38 }, style: style(), authored: {}, children: [{ ...buttonCapture(), name: 'Button' }] };
  const { node } = buildComponent({ name: 'Card', instances: [{ layer: 'Button', component: 'Button', variant: { Variant: 'Danger' }, props: { Label: 'Delete' } }], captures: [{ capture: { tree: card } }] },
    { ...ctx, componentIdFor: (name, v) => (name === 'Button' && v.Variant === 'Danger' ? set.children[2].id : null) });
  const inst = node.children[0];
  eq([inst.type, inst.componentId, inst.propValues], ['instance', set.children[2].id, { 'button-label': 'Delete' }]);
});

test('capture: comparing finds layers whose size or place differ, also inside groups Sigma made', () => {
  const capture = { name: 'Card', box: { x: 0, y: 0, w: 200, h: 112 }, children: [
    { name: 'Title', box: { x: 16, y: 16, w: 168, h: 20 } },
    { name: 'Body', box: { x: 16, y: 40, w: 168, h: 20 } },
  ] };
  const sigma = { name: 'Card', box: { x: 0, y: 0, w: 200, h: 113 }, children: [
    { name: 'Title + Body', box: { x: 16, y: 16, w: 168, h: 44 }, children: [
      { name: 'Title', box: { x: 16, y: 16, w: 168, h: 20 } },
      { name: 'Body', box: { x: 16, y: 44, w: 168, h: 20 } },
    ] },
  ] };
  eq(compareBoxes(sigma, capture), [{ layer: 'Card / Body', what: 'y', code: 40, sigma: 44 }], 'within 1.5px counts as the same');
  eq(compareBoxes(sigma, capture, { tolerance: 0.5 }).length, 2);
});
