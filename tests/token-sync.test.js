// Tokens between code and Sigma (src/token-sync.js): reading CSS variables, merging, diffing, writing back.
import { test, eq, ok } from './harness.js';
import {
  parseCSSVariables, parseCSSValue, formatCSSValue, parseColorValue, formatColor, cssToCollections, mergeTokenCollections,
  tokenChanges, applyToCSS, codeNameFor, tokenNameFor,
} from '../src/token-sync.js';

const CSS = `/* tokens */
:root {
  --color-blue-500: #0d99ff;
  --color-gray-600: rgb(117 117 117);
  --space-4: 1rem; /* base */
  --radius-md: 8px;
  --font-family-base: "Inter", system-ui, sans-serif;
  --duration-fast: 150ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --shadow-raised: 0 2px 8px rgba(0, 0, 0, 0.1);
  --accent: var(--color-blue-500);
  --text-secondary: var(--color-gray-600);
}
[data-theme="dark"] {
  --accent: #4db5ff;
}
.unrelated { --local: 1px; color: red; }
`;
const MODES = { Light: ':root', Dark: '[data-theme="dark"]' };

test('token sync: reads CSS custom properties with their selectors and exact value positions', () => {
  const decls = parseCSSVariables(CSS);
  eq(decls.length, 12);
  const space = decls.find((d) => d.name === '--space-4');
  eq([space.selector, space.value, CSS.slice(space.start, space.end)], [':root', '1rem', '1rem']);
  eq(decls.find((d) => d.name === '--accent' && d.selector !== ':root').selector, '[data-theme="dark"]');
  eq(decls.find((d) => d.name === '--font-family-base').value, '"Inter", system-ui, sans-serif');
});

test('token sync: CSS values become token values, and are written back the way they were', () => {
  eq(parseCSSValue('1rem'), { type: 'number', value: 16, like: { unit: 'rem' } });
  eq(parseCSSValue('var(--x, 4px)'), { alias: '--x' });
  eq(parseCSSValue('0.2s').value, 200);
  eq(parseCSSValue('0 2px 8px rgba(0, 0, 0, 0.1)').value, { color: '#0000001A', x: 0, y: 2, blur: 8, spread: 0 });
  eq(parseColorValue('hsl(0 84% 60%)').hex, '#EF4343');
  eq(formatColor('#3B5BFF', parseColorValue('#0d99ff')), '#3b5bff', 'lowercase hex stays lowercase');
  eq(formatColor('#3B5BFF80', parseColorValue('rgb(1 2 3)')), 'rgb(59 91 255 / 0.5)');
  eq(formatColor('#3B5BFF', parseColorValue('rgba(1, 2, 3, 1)')), 'rgb(59, 91, 255)');
  eq(formatCSSValue('number', 20, { unit: 'rem' }), '1.25rem', 'rem stays rem');
  eq(formatCSSValue('duration', 250, { unit: 's' }), '0.25s');
  eq(codeNameFor('color/blue/500'), '--color-blue-500');
  eq(codeNameFor('primary/main', { naming: 'camel' }), 'primaryMain');
  eq(tokenNameFor('--acme-space-4', { prefix: 'acme-' }), 'space/4');
});

test('token sync: CSS becomes primitives and semantic tokens with modes and references', () => {
  const { collections, skipped } = cssToCollections(parseCSSVariables(CSS), { modes: MODES });
  eq(collections.map((c) => c.name), ['Primitives', 'Semantic']);
  const [prim, sem] = collections;
  eq(prim.variables.map((v) => v.name), ['color/blue/500', 'color/gray/600', 'space/4', 'radius/md', 'font/family/base', 'duration/fast', 'ease/standard', 'shadow/raised']);
  const accent = sem.variables.find((v) => v.name === 'accent');
  eq(accent.valuesByMode, { light: { alias: 'color-blue-500' }, dark: '#4DB5FF' });
  eq(accent.codeSyntax, { web: '--accent' });
  eq(sem.variables.find((v) => v.name === 'text/secondary').valuesByMode.dark, { alias: 'color-gray-600' }, 'a mode without its own value keeps the default');
  ok(skipped.some((s) => s.name === '--local'), 'variables outside the modes’ selectors are skipped, and said why');
});

test('token sync: importing the same code again changes nothing; ids, descriptions and order stay', () => {
  const first = cssToCollections(parseCSSVariables(CSS), { modes: MODES }).collections;
  const { collections: merged } = mergeTokenCollections([], first);
  merged[0].variables[0].description = 'Brand blue';
  merged[0].variables.reverse();
  const again = mergeTokenCollections(merged, cssToCollections(parseCSSVariables(CSS), { modes: MODES }).collections);
  eq([again.report.added.length, again.report.changed.length], [0, 0]);
  eq(JSON.stringify(again.collections), JSON.stringify(merged), 'untouched');
  // A value changed in code is the only change; a token only in Sigma stays (unless pruned).
  merged[1].variables.push({ id: 'new-in-sigma', name: 'new/in/sigma', type: 'color', valuesByMode: { light: '#000000', dark: '#FFFFFF' } });
  const changed = mergeTokenCollections(merged, cssToCollections(parseCSSVariables(CSS.replace('#0d99ff', '#123456')), { modes: MODES }).collections);
  eq(changed.report.changed, ['color/blue/500']);
  eq(changed.report.onlyInSigma, ['new/in/sigma']);
  eq(mergeTokenCollections(merged, first, { prune: true }).report.onlyInSigma, ['new/in/sigma']);
  ok(!mergeTokenCollections(merged, first, { prune: true }).collections[1].variables.some((v) => v.id === 'new-in-sigma'), 'pruned');
});

test('token sync: Sigma changes go back into CSS as minimal edits', () => {
  const cols = mergeTokenCollections([], cssToCollections(parseCSSVariables(CSS), { modes: MODES }).collections).collections;
  eq(applyToCSS(CSS, cols, { modes: MODES }).edits, [], 'nothing to do when they agree');
  const v = (name) => cols.flatMap((c) => c.variables).find((x) => x.name === name);
  v('color/blue/500').valuesByMode[cols[0].defaultModeId] = '#3B5BFF';
  v('space/4').valuesByMode[cols[0].defaultModeId] = 20;
  v('accent').valuesByMode[cols[1].modes.find((m) => m.name === 'Dark').id] = { alias: 'color-gray-600' };
  cols[0].variables.push({ id: 'space-8', name: 'space/8', type: 'number', valuesByMode: { [cols[0].defaultModeId]: 32 } });
  const before = tokenChanges(mergeTokenCollections([], cssToCollections(parseCSSVariables(CSS), { modes: MODES }).collections).collections, cols);
  eq(before.map((c) => `${c.change} ${c.name}`).sort(), ['added space/8', 'changed accent', 'changed color/blue/500', 'changed space/4']);
  const { text, edits } = applyToCSS(CSS, cols, { modes: MODES, remove: ['--duration-fast'] });
  const changedLines = text.split('\n').filter((l) => !CSS.split('\n').includes(l));
  eq(changedLines, ['  --color-blue-500: #3b5bff;', '  --space-4: 1.25rem; /* base */', '  --space-8: 2rem;', '  --accent: var(--color-gray-600);']);
  ok(!text.includes('--duration-fast'), 'removed');
  eq(edits.length, 5);
  // And reading it back gives the Sigma values.
  const back = cssToCollections(parseCSSVariables(text), { modes: MODES }).collections;
  eq(back[0].variables.find((x) => x.name === 'space/8').valuesByMode.default, 32);
});
