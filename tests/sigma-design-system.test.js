import { test, eq, ok } from './harness.js';
import { sigmaTokenDocument, sigmaFoundationsDocument, sigmaComponentsDocument } from '../src/sigma-design-system.js';
import { state, loadDocument, walk } from '../src/store.js';
import { aliasChain, collections, resolveVariables } from '../src/variables.js';
import { exportDTCG, importTokens } from '../src/tokens-io.js';

test('Sigma UI tokens: both modes resolve all aliases, and export/import preserves tokens', () => {
  const tokens = sigmaTokenDocument();
  eq(tokens.name, 'Tokens');
  loadDocument({ name: 'UI test', variables: { collections: tokens.collections }, pages: [{ id: 'ui', name: 'UI', children: [] }], currentPageId: 'ui' });
  for (const c of collections()) {
    eq(new Set(c.variables.map(v => v.name)).size, c.variables.length, 'unique token names');
    eq(c.modes.map(m => m.name), ['Light', 'Dark']);
    for (const v of c.variables) for (const m of c.modes) {
      const chain = aliasChain(c, m.id, v);
      ok(!chain.steps.some(s => s.missing), `${v.name}: missing reference`);
      ok(chain.value !== undefined && chain.value !== null, `${v.name}: unresolved in ${m.name}`);
    }
  }
  const back = importTokens(JSON.parse(JSON.stringify(exportDTCG(tokens.collections)))).collections;
  // DTCG import merges each collection’s modes back into one collection.
  eq(back.map(c => c.modes.map(m => m.name)), tokens.collections.map(c => c.modes.map(m => m.name)));
  eq(back.reduce((n,c) => n+c.variables.length, 0), tokens.collections.reduce((n,c) => n+c.variables.length, 0));
});

test('Sigma UI specimens: all bindings exist, Light matches interface source and Dark resolves at each specimen', () => {
  const tokens = sigmaTokenDocument();
  const ids = new Set(tokens.collections.flatMap(c => c.variables.map(v => v.id)));
  for (const make of [sigmaFoundationsDocument, sigmaComponentsDocument]) {
    const doc = make(tokens.collections); doc.variables = { collections: tokens.collections };
    loadDocument(doc); resolveVariables();
    for (const pg of state.doc.pages) walk(pg.children, n => {
      for (const id of Object.values(n.bindings || {})) ok(ids.has(id), `${n.name}: missing binding`);
      ok(Number.isFinite(n.w) && Number.isFinite(n.h), `${n.name}: valid geometry`);
      if (n.type === 'text') ok(n.fontFamily === 'Inter' && n.fontSize > 0, 'text style resolves');
    });
  }
  const page = state.doc.pages.find(p => p.name === 'Button');
  const [light, dark] = page.children.filter(n => n.type === 'componentSet');
  eq(light.children[0].fills[0].color, '#FFFFFF');
  eq(dark.children[0].fills[0].color, '#242424');
  eq(light.children[0].h, 30);
  eq(light.children[0].radius, 5);
  eq(light.children[1].fills[0].color, '#F5F5F5');
  eq(dark.children[1].fills[0].color, '#333333');
});


test('Sigma Components: changing the page Interface mode updates inherited specimens and their canvas surface', () => {
  const tokens = sigmaTokenDocument();
  const doc = sigmaComponentsDocument(tokens.collections);
  doc.variables = { collections:tokens.collections };
  loadDocument(doc); resolveVariables();
  const page = state.doc.pages.find(p => p.name === 'Button');
  const [current, reference] = page.children.filter(n => n.type === 'componentSet');
  const surface = page.children.find(n => n.name === 'Specimen background');
  const interfaceTokens = tokens.collections.find(c => c.name === 'Interface');
  page.modes[interfaceTokens.id] = interfaceTokens.modes.find(m => m.name === 'Dark').id;
  resolveVariables();
  eq(current.children[0].fills[0].color, '#242424', 'page mode reaches the main specimen');
  eq(current.children[1].fills[0].color, '#333333', 'hover tokens follow too');
  eq(surface.fills[0].color, '#1A1A1A', 'specimen background follows the page mode');
  eq(reference.children[0].fills[0].color, '#242424', 'explicit Dark reference stays Dark');
  page.modes[interfaceTokens.id] = interfaceTokens.modes.find(m => m.name === 'Light').id;
  resolveVariables();
  eq(current.children[0].fills[0].color, '#FFFFFF');
  eq(surface.fills[0].color, '#F5F5F5');
  eq(reference.children[0].fills[0].color, '#242424');
});


test('Sigma component sets: padded boundaries hug variants and resize with their contents', async () => {
  const { applyLayouts } = await import('../src/layout.js');
  const tokens = sigmaTokenDocument();
  const doc = sigmaComponentsDocument(tokens.collections);
  doc.variables = {collections:tokens.collections};
  loadDocument(doc); resolveVariables(); applyLayouts();
  for (const page of state.doc.pages) for (const set of page.children.filter(n => n.type === 'componentSet')) {
    eq([set.sizingH,set.sizingV], ['hug','hug']);
    eq(set.w, 32 + set.children.reduce((sum,n) => sum+n.w,0) + 24*(set.children.length-1));
    eq(set.h, 32 + Math.max(...set.children.map(n => n.h)));
    for (const child of set.children) {
      ok(child.x >= 16 && child.y >= 16, 'top/left padding');
      ok(child.x+child.w <= set.w-16 && child.y+child.h <= set.h-16, 'bottom/right padding');
    }
  }
  const set = state.doc.pages.find(p => p.name === 'Button').children.find(n => n.type === 'componentSet');
  const before = set.w;
  set.children[0].sizingH = 'fixed';
  set.children[0].w += 40;
  applyLayouts();
  eq(set.w, before+40, 'hug responds to changed variant width');
});
