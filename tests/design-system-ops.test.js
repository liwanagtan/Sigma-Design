// Running the design system (Part D, Phase 18): component status and readiness, the changelog, the
// documentation page.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, makePaint } from '../src/store.js';
import { resolveVariables } from '../src/variables.js';
import { readiness, statusOf, docsTarget, componentRows } from '../src/component-docs.js';
import { changelogFromChangesets, changelogFromPublishes, changelogMarkdown } from '../src/changelog.js';
import { documentationPage } from '../src/doc-site.js';

const tokens = [{
  id: 'c', name: 'Core', modes: [{ id: 'l', name: 'Light' }, { id: 'd', name: 'Dark' }], defaultModeId: 'l',
  variables: [
    { id: 'bg', name: 'surface/default', type: 'color', valuesByMode: { l: '#FFFFFF', d: '#1E1E1E' } },
    { id: 'ease', name: 'ease/standard', type: 'easing', valuesByMode: { l: [0.2, 0, 0, 1], d: [0.2, 0, 0, 1] } },
  ],
}];

function buttonSet() {
  const v = (name, color) => createNode('component', { name, w: 80, h: 32, fills: [makePaint(color)], bindings: { 'fills.0.color': 'bg' } });
  const set = createNode('componentSet', { name: 'Button', children: [v('Variant=Primary', '#3B5BFF'), v('Variant=Secondary', '#FFFFFF')] });
  return set;
}

test('readiness: Sigma checks what it can, a person ticks the rest; a variant’s status is its set’s', () => {
  const set = buttonSet();
  const dont = createNode('frame', { name: 'Two primaries', w: 100, h: 40 });
  useDoc([set, dont]);
  const byKey = () => Object.fromEntries(readiness(set).map((c) => [c.key, c.ok]));
  eq(byKey(), { named: true, purpose: false, variants: true, tokens: true, breakpoints: false, documented: false, accessibility: false, code: false });
  set.docs = { purpose: 'The main action.', usage: 'Label with a verb.', donts: [dont.id], code: 'https://example.com/button.tsx' };
  set.checks = { breakpoints: true, accessibility: true };
  ok(readiness(set).every((c) => c.ok), 'every check passes');
  ok(readiness(set).find((c) => c.key === 'breakpoints').manual, 'breakpoints are confirmed by a person');
  eq(statusOf(set.children[0]), 'draft');
  set.status = 'ready';
  eq([docsTarget(set.children[1]).id, statusOf(set.children[1])], [set.id, 'ready']);
  set.deprecated = true;
  eq(statusOf(set), 'deprecated', 'deprecated wins');
  const lone = createNode('component', { name: 'Component 3', w: 10, h: 10, fills: [makePaint('#000000')] });
  useDoc([lone]);
  const r = Object.fromEntries(readiness(lone).map((c) => [c.key, c]));
  eq([r.named.ok, r.variants.manual, r.tokens.ok], [false, true, false], 'a default name, no variants, a one-off fill');
});

test('changelog: from proposals that changed the file (newest first), or from publishes', () => {
  const changesets = [
    { title: 'Button says Next', status: 'proposed', createdAt: '2026-10-02', changes: [{ file: 'lib.sigma.json', kind: 'component', name: 'Button', change: 'Changed' }] },
    { title: 'Darker hover', status: 'merged', mergedAt: '2026-10-01', pr: { url: 'https://github.com/o/r/pull/1', number: 1 }, changes: [{ file: 'lib.sigma.json', kind: 'component', name: 'Button', change: 'Changed' }, { file: 'tokens.sigma.json', kind: 'token', name: 'x', change: 'Added' }] },
    { title: 'Closed idea', status: 'closed', createdAt: '2026-10-03', changes: [{ file: 'lib.sigma.json', kind: 'component', name: 'Card', change: 'Added' }] },
  ];
  const entries = changelogFromChangesets(changesets, 'lib.sigma.json');
  eq(entries.map((e) => e.title), ['Button says Next', 'Darker hover']);
  eq(entries[1].changes.length, 1, 'only the changes to this file');
  const md = changelogMarkdown('Acme library', entries);
  ok(md.startsWith('# What\'s new in Acme library'));
  ok(md.includes('## Button says Next (Proposed)') && md.includes('[pull request #1](https://github.com/o/r/pull/1)'));
  ok(md.includes('- Changed component **Button**'));
  const page = (name) => ({ name: 'Lib', pages: [{ id: 'p', name: 'Components', children: [{ id: 'b', type: 'component', name, w: 10, h: 10 }] }] });
  const published = changelogFromPublishes([
    { title: 'v1', createdAt: Date.parse('2026-09-01'), file: page('Button') },
    { title: 'v2', description: 'Renamed', createdAt: Date.parse('2026-09-10'), file: page('Primary button') },
  ]);
  eq(published.map((e) => [e.title, !!e.first]), [['v2', false], ['v1', true]]);
  ok(published[0].changes.length > 0, 'v2 lists what changed since v1');
});

test('documentation page: components with previews, status, docs, properties and code; tokens per mode', () => {
  const set = buttonSet();
  set.docs = { purpose: 'The main action <in a section>.', usage: 'Label with a verb.' };
  set.status = 'review';
  const doc = useDoc([set]);
  doc.variables = { collections: tokens };
  resolveVariables();
  eq(componentRows().length, 1);
  const html = documentationPage();
  ok(html.startsWith('<!doctype html>'), 'a whole page');
  eq((html.match(/<div class="preview"><svg/g) || []).length, 2, 'a preview per variant');
  ok(html.includes('<span class="status review">In review</span>'));
  ok(html.includes('The main action &lt;in a section&gt;.'), 'docs are escaped');
  ok(html.includes('<td>variant</td><td><code>primary</code> <code>secondary</code></td>'), 'the variant property and its values in code');
  ok(html.includes('<code>Button</code>'), 'its code name');
  ok(html.includes('<th>Light</th><th>Dark</th>') && html.includes('#1E1E1E'), 'tokens per mode');
  ok(html.includes('cubic-bezier(0.2, 0, 0, 1)') && html.includes('--surface-default'));
});
