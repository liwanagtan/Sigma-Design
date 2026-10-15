import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, loadDocument, walk } from '../src/store.js';
import { sampleTokenDocument } from './fixtures/sample-tokens.js';
import { collections, findByReference, aliasChain, previewValue, groupTree, findVariable, snapshotForLibrary, resolveVariables } from '../src/variables.js';
import { syncInstances } from '../src/components.js';
import { welcomeDocument } from './fixtures/welcome.js';
import { exportDTCG, importTokens } from '../src/tokens-io.js';

function loadSample() {
  useDoc([]);
  state.doc.variables = { collections: sampleTokenDocument().collections };
  return collections();
}

test('Sample tokens: every reference resolves, and nothing loops', () => {
  const cols = loadSample();
  eq(cols.map((c) => c.name), ['Primitives', 'Semantic', 'Brand B', 'Typography', 'Components']);
  for (const c of cols) {
    for (const v of c.variables) {
      for (const m of c.modes) {
        const { steps, value } = aliasChain(c, m.id, v);
        ok(!steps.some((s) => s.missing), `${v.name} points at a missing token`);
        ok(value !== undefined && value !== null, `${v.name} resolves in ${m.name}`);
      }
    }
  }
});

test('Sample tokens: three levels, modes, the brand and text styles resolve as designed', () => {
  const cols = loadSample();
  const [, semantic, brand] = cols;
  const btn = findByReference('{button/primary/background}', 'color').variable;
  const chain = aliasChain(cols[4], cols[4].defaultModeId, btn);
  eq(chain.steps.map((s) => s.variable.name), ['accent/default', 'color/blue/500']);
  eq(chain.value, '#0D99FF');
  const accent = findByReference('{accent/default}', 'color').variable;
  eq(aliasChain(semantic, semantic.modes[1].id, accent).value, '#47A8FF'); // Dark
  eq(aliasChain(brand, brand.modes[0].id, accent).value, '#9747FF'); // Brand B, Light
  const h1 = previewValue(findByReference('{heading/h1}', 'typography').variable.id);
  eq(h1, { fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeight: 120, letterSpacing: -0.5 });
  eq(groupTree(cols[0]).map((g) => g.name), ['color', 'space', 'layout', 'radius', 'border-width', 'font', 'opacity', 'motion', 'content']);
});

test('Sample tokens: round-trips through tokens.json', () => {
  const cols = loadSample();
  const back = importTokens(JSON.parse(JSON.stringify(exportDTCG(cols)))).collections;
  eq(back.map((c) => [c.name, c.variables.length]), cols.map((c) => [c.name, c.variables.length]));
});

test('Welcome to Sigma: ten pages, every binding points at a linked sample token, and the examples resolve per mode', () => {
  const tokens = sampleTokenDocument();
  const doc = welcomeDocument(tokens.collections);
  doc.libraries = [{ fileId: 'lib', name: tokens.name, version: 1, collections: snapshotForLibrary(tokens.collections, 'lib') }];
  loadDocument(doc);
  syncInstances();
  resolveVariables();
  eq(state.doc.pages.length, 10);
  eq(state.doc.pages[0].name, '1 Start here');
  eq(state.doc.variables?.collections?.length || 0, 0); // no local tokens: all of them come from the tokens file
  let bound = 0, oneOff = 0;
  for (const pg of state.doc.pages) {
    ok(pg.children.some((n) => n.name === 'Guide'), `${pg.name} has a guide`);
    walk(pg.children, (n) => {
      for (const [path, id] of Object.entries(n.bindings || {})) {
        bound++;
        ok(findVariable(id), `${pg.name} › ${n.name} ${path} is bound to a missing token`);
      }
      if (n.name.startsWith('One-off')) oneOff++;
    });
  }
  ok(bound > 300, 'everything uses tokens');
  eq(oneOff, 2); // the two raw values the audit example finds, on purpose
  const tokensPage = state.doc.pages.find((p) => p.name === '5 Tokens in designs');
  const showcase = (name) => tokensPage.children.find((n) => n.name === name);
  const card = (name) => showcase(name).children[0];
  const button = (name) => card(name).children.find((n) => n.name === 'Button');
  eq(card('Light').fills[0].color, '#FFFFFF'); // card/background → surface/raised → gray/0
  eq(card('Dark').fills[0].color, '#2C3038'); // gray/800 in Dark
  eq(button('Light').fills[0].color, '#0D99FF'); // accent: blue
  eq(button('Brand B').fills[0].color, '#9747FF'); // Brand B: violet
  eq(card('Light').children[0].fontSize, 20); // Title: heading/h3
});
