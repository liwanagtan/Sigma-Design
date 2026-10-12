// Changesets (Propose change, src/changesets.js): splitting edits into items and applying some of them.
import { test, eq, ok } from './harness.js';
import { projectChanges, applyChanges, unproposed, newChangeset, summarize } from '../src/changesets.js';

const tokens = (light) => ({
  format: 1, kind: 'tokens', name: 'Core',
  collections: [{ id: 'c', name: 'Core', modes: [{ id: 'l', name: 'Light' }], defaultModeId: 'l', variables: [
    { id: 'a', name: 'a', type: 'color', valuesByMode: { l: '#000000' } },
    { id: 'b', name: 'b', type: 'color', valuesByMode: { l: light } },
    { id: 'c', name: 'c', type: 'color', valuesByMode: { l: '#FFFFFF' } },
  ] }],
});
const design = (label, extraPage = false) => ({
  format: 1, kind: 'design', name: 'Lib',
  pages: [
    { id: 'p1', name: 'Components', children: [
      { id: 'btn', type: 'component', name: 'Button', props: { l: { type: 'text', name: 'Label', default: label } }, children: [{ id: 't', type: 'text', name: 'Label', text: label }] },
      { id: 'note', type: 'text', name: 'Note', text: 'Buttons' },
    ] },
    ...(extraPage ? [{ id: 'p2', name: 'Screens', children: [{ id: 'i', type: 'instance', componentId: 'btn' }] }] : []),
  ],
});

test('changesets: edits split into tokens, components and pages', () => {
  const base = { 't.json': tokens('#111111'), 'd.json': design('Continue') };
  const now = { 't.json': tokens('#222222'), 'd.json': design('Next', true) };
  const items = projectChanges(base, now);
  eq(items.map((i) => `${i.kind} ${i.name} ${i.change}`), ['component Button changed', 'page Screens added', 'token b changed']);
  eq(summarize(items), '1 component, 1 page, 1 token');
  eq(projectChanges(base, base), [], 'nothing changed, nothing to propose');
});

test('changesets: applying some changes onto the base gives only those, in place', () => {
  const base = { 't.json': tokens('#111111'), 'd.json': design('Continue') };
  const now = { 't.json': tokens('#222222'), 'd.json': design('Next', true) };
  const items = projectChanges(base, now);
  const tokenOnly = applyChanges(base, items.filter((i) => i.kind === 'token'));
  eq(Object.keys(tokenOnly), ['t.json']);
  eq(tokenOnly['t.json'].collections[0].variables.map((v) => v.id), ['a', 'b', 'c'], 'the token stays in its place');
  eq(tokenOnly['t.json'].collections[0].variables[1].valuesByMode.l, '#222222');
  const pageOnly = applyChanges(base, items.filter((i) => i.kind === 'page'))['d.json'];
  eq(pageOnly.pages.map((p) => p.id), ['p1', 'p2']);
  eq(pageOnly.pages[0].children[0].props.l.default, 'Continue', 'the component’s change wasn’t included');
  const all = applyChanges(base, items);
  eq(all['d.json'], now['d.json']);
  eq(all['t.json'], now['t.json']);
});

test('changesets: changes already proposed aren’t offered again, until they change further', () => {
  const base = { 't.json': tokens('#111111') };
  const items = projectChanges(base, { 't.json': tokens('#222222') });
  const cs = newChangeset({ title: 'Darker b', changes: items });
  ok(/^\d{4}-\d\d-\d\d-darker-b-/.test(cs.id), cs.id);
  eq(unproposed(items, [cs]), []);
  eq(unproposed(projectChanges(base, { 't.json': tokens('#333333') }), [cs]).length, 1, 'edited again after proposing');
  eq(unproposed(items, [{ ...cs, status: 'merged' }]).length, 1, 'merged proposals don’t hide changes');
});

test('changesets: a new component goes where it is in Sigma; a removed one is removed', () => {
  const base = { 'd.json': design('Continue') };
  const now = structuredClone(base);
  now['d.json'].pages[0].children.splice(1, 0, { id: 'card', type: 'component', name: 'Card', children: [] });
  const added = projectChanges(base, now).filter((i) => i.kind === 'component');
  eq(added.map((i) => `${i.name} ${i.change}`), ['Card added']);
  eq(applyChanges(base, added)['d.json'].pages[0].children.map((n) => n.id), ['btn', 'card', 'note']);
  const removed = projectChanges(now, base).filter((i) => i.kind === 'component');
  eq(applyChanges(now, removed)['d.json'].pages[0].children.map((n) => n.id), ['btn', 'note']);
});
