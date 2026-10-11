import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state } from '../src/store.js';
import { sampleTokenDocument } from '../src/sample-tokens.js';
import { collections, findByReference, aliasChain, previewValue, groupTree } from '../src/variables.js';
import { exportDTCG, importTokens } from '../src/tokens-io.js';

function loadSample() {
  useDoc([]);
  state.doc.variables = { collections: sampleTokenDocument().collections };
  return collections();
}

test('sample tokens: every reference resolves, and nothing loops', () => {
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

test('sample tokens: three levels, modes, the brand and text styles resolve as designed', () => {
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
  eq(groupTree(cols[0]).map((g) => g.name), ['color', 'space', 'radius', 'border-width', 'font', 'opacity', 'content']);
});

test('sample tokens: round-trips through tokens.json', () => {
  const cols = loadSample();
  const back = importTokens(JSON.parse(JSON.stringify(exportDTCG(cols)))).collections;
  eq(back.map((c) => [c.name, c.variables.length]), cols.map((c) => [c.name, c.variables.length]));
});
