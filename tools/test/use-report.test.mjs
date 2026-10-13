// The design system use report (src/use-report.js): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useReport } from '../../src/use-report.js';

const tokens = {
  name: 'Core tokens',
  collections: [{
    id: 'c', modes: [{ id: 'm', name: 'Default' }],
    variables: [
      { id: 'blue', name: 'color/blue', type: 'color', valuesByMode: { m: '#3B5BFF' } },
      { id: 'accent', name: 'accent', type: 'color', valuesByMode: { m: { alias: 'blue' } } },
      { id: 'space-2', name: 'space/2', type: 'number', valuesByMode: { m: 8 } },
      { id: 'unused', name: 'space/9', type: 'number', valuesByMode: { m: 72 } },
    ],
  }],
};
const button = {
  id: 'button', type: 'componentSet', name: 'Button',
  children: [
    { id: 'button-primary', type: 'component', name: 'Variant=Primary', fills: [{}], bindings: { 'fills.0.color': 'accent', 'layout.pl': 'space-2' }, layout: { mode: 'horizontal', pl: 8 }, children: [] },
    { id: 'button-danger', type: 'component', name: 'Variant=Danger', fills: [{ color: '#FF0000' }], layout: { mode: 'horizontal', pl: 8 }, children: [] },
  ],
};
const badge = { id: 'badge', type: 'component', name: 'Badge', fills: [{}], bindings: { 'fills.0.color': 'accent' }, children: [] };
const library = {
  name: 'Library',
  doc: { pages: [{ id: 'p', name: 'Components', children: [button, badge] }], libraries: [tokens] },
};
const page = (handoff) => ({
  id: handoff ? 'h' : 'w', name: handoff ? 'Home' : 'Drafts', ...(handoff ? { handoff: true } : {}),
  children: [{
    id: `frame-${handoff}`, type: 'frame', name: 'Screen', fills: [{}], bindings: { 'fills.0.color': 'blue' },
    layout: { mode: 'vertical', gap: 16 },
    children: [
      { id: `i1-${handoff}`, type: 'instance', name: 'Button', componentId: 'button-primary' },
      { id: `i2-${handoff}`, type: 'instance', name: 'Button', componentId: 'button-danger' },
      { id: `t-${handoff}`, type: 'text', name: 'Title', text: 'Hi', fills: [{ color: '#111111' }] },
    ],
  }],
});
const screens = {
  name: 'Screens', editedAt: Date.parse('2026-10-01'),
  doc: { pages: [page(true), page(false)], libraries: [tokens], componentLibraries: [{ name: 'Library', components: [button, badge] }] },
};

test('report: component share counts instances once, against the layers on pages', () => {
  const r = useReport([library, screens]);
  const s = r.files.find((f) => f.name === 'Screens');
  assert.equal(s.layers, 8, 'per page: the frame, two instances, the text');
  assert.equal(s.instances, 4);
  assert.equal(s.componentShare, 0.5);
  assert.equal(r.files.find((f) => f.name === 'Library').layers, 0, 'component definitions aren’t page layers');
});

test('report: token share by kind, components included, instances’ insides left out', () => {
  const r = useReport([library, screens]);
  const lib = r.files.find((f) => f.name === 'Library');
  assert.deepEqual(lib.kinds.color, { bound: 2, total: 3 }, 'the Danger fill is a one-off');
  assert.deepEqual(lib.kinds.spacing, { bound: 1, total: 2 });
  const s = r.files.find((f) => f.name === 'Screens');
  assert.deepEqual(s.kinds.color, { bound: 2, total: 4 }, 'frames bound, titles not');
  assert.deepEqual(s.kinds.type, { bound: 0, total: 2 });
  assert.deepEqual(s.kinds.spacing, { bound: 0, total: 2 }, 'the gap of 16 is a one-off');
});

test('report: most-used and unused components and tokens; a token another points at is used', () => {
  const r = useReport([library, screens]);
  assert.deepEqual(r.components.map((c) => [c.name, c.uses]), [['Button', 4]]);
  assert.deepEqual(r.unusedComponents.map((c) => c.name), ['Badge']);
  assert.deepEqual(r.tokens.map((t) => [t.name, t.uses]), [['accent', 2], ['color/blue', 2], ['space/2', 1]]);
  assert.deepEqual(r.unusedTokens.map((t) => t.name), ['space/9'], 'color/blue is used, and accent points at it too');
});

test('report: only handoff pages, only recently edited files', () => {
  const handoff = useReport([library, screens], { handoff: true }).files.find((f) => f.name === 'Screens');
  assert.equal(handoff.layers, 4);
  const recent = useReport([library, screens], { since: Date.parse('2026-10-05') });
  assert.deepEqual(recent.files.map((f) => f.name), ['Library'], 'Screens was edited before');
});
