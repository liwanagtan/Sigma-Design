import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, makePaint, uid } from '../src/store.js';
import {
  resolveVariables, collections, localCollections, snapshotForLibrary, diffCollections, isLibraryCollection,
} from '../src/variables.js';
import { syncInstances, createInstance } from '../src/components.js';
import { createTokenFileWith, appendToTokenFile, loadPublished, deleteFile } from '../src/files.js';
import { answerWith } from '../src/dialogs.js';

function tokenCollections() {
  const mode = uid();
  return [{
    id: uid(), name: 'Color', modes: [{ id: mode, name: 'Light' }], defaultModeId: mode,
    variables: [{ id: 'tok-primary', name: 'brand/primary', type: 'color', valuesByMode: { [mode]: '#0D99FF' } }],
  }];
}

test('libraries: tokens from a linked token file resolve even with no local tokens', () => {
  const rect = createNode('rect', { fills: [makePaint('#000000')], bindings: { 'fills.0.color': 'tok-primary' } });
  useDoc([rect]);
  state.doc.libraries = [{ fileId: 'lib-1', name: 'Core', version: 1, collections: snapshotForLibrary(tokenCollections(), 'lib-1') }];
  eq(localCollections().length, 0);
  ok(collections().every(isLibraryCollection), 'only library collections');
  resolveVariables();
  eq(rect.fills[0].color, '#0D99FF');
});

test('libraries: accepting a new snapshot updates instances of components that use the token', () => {
  const bg = createNode('rect', { name: 'Bg', fills: [makePaint('#000000')], bindings: { 'fills.0.color': 'tok-primary' } });
  const comp = createNode('component', { name: 'Chip', children: [bg] });
  useDoc([comp]);
  const v1 = tokenCollections();
  state.doc.libraries = [{ fileId: 'lib-1', name: 'Core', version: 1, collections: snapshotForLibrary(v1, 'lib-1') }];
  const inst = createInstance(comp);
  syncInstances();
  resolveVariables();
  eq(inst.children[0].fills[0].color, '#0D99FF');
  const v2 = structuredClone(v1);
  v2[0].variables[0].valuesByMode[v2[0].defaultModeId] = '#14AE5C';
  state.doc.libraries[0] = { ...state.doc.libraries[0], version: 2, collections: snapshotForLibrary(v2, 'lib-1') };
  syncInstances();
  resolveVariables();
  eq([bg.fills[0].color, inst.children[0].fills[0].color], ['#14AE5C', '#14AE5C']);
});

test('libraries: diff lists added, changed and removed tokens', () => {
  const before = tokenCollections();
  const after = structuredClone(before);
  after[0].variables[0].valuesByMode[after[0].defaultModeId] = '#FF0000';
  after[0].variables.push({ id: 'tok-new', name: 'brand/accent', type: 'color', valuesByMode: {} });
  const d = diffCollections(before, after);
  eq([d.added, d.changed, d.removed], [['brand/accent'], ['brand/primary'], []]);
  eq(diffCollections(after, before).removed, ['brand/accent']);
});

test('libraries: token files publish numbered versions', async () => {
  const lib = await createTokenFileWith('Test tokens (temporary)', tokenCollections());
  try {
    eq(lib.published.version, 1);
    const more = tokenCollections();
    more[0].id = uid();
    more[0].name = 'Spacing';
    const next = await appendToTokenFile(lib.id, more, 'Add spacing');
    eq(next.published.version, 2);
    const loaded = await loadPublished(lib.id);
    eq([loaded.published.version, loaded.published.notes, loaded.published.collections.length, loaded.meta.tokenVersion], [2, 'Add spacing', 2, 2]);
  } finally {
    await deleteFile(lib.id);
  }
});

test('design tokens: a design file uses one token file; switching moves layers to same-named tokens', async () => {
  const { useTokenFile, tokenFile } = await import('../src/libraries.js');
  const { createTokenFileWith, deleteFile, setCurrentFile } = await import('../src/files.js');
  const brand = (name, primary) => {
    const m = uid();
    return [{ id: uid(), name: 'Color', modes: [{ id: m, name: 'Default' }], defaultModeId: m, variables: [
      { id: uid(), name: 'brand/primary', type: 'color', valuesByMode: { [m]: primary } },
      { id: uid(), name: `only-in-${name}`, type: 'color', valuesByMode: { [m]: '#000000' } },
    ] }];
  };
  const a = await createTokenFileWith('Brand A (temporary)', brand('a', '#0D99FF'));
  const b = await createTokenFileWith('Brand B (temporary)', brand('b', '#9747FF'));
  answerWith(() => true); // OK to switching token files
  try {
    setCurrentFile(null);
    const [aPrimary, aOnly] = a.published.collections[0].variables;
    const r1 = createNode('rect', { fills: [makePaint('#000000')], bindings: { 'fills.0.color': aPrimary.id } });
    const r2 = createNode('rect', { fills: [makePaint('#000000')], bindings: { 'fills.0.color': aOnly.id } });
    useDoc([r1, r2]);
    await useTokenFile(a.id);
    resolveVariables();
    eq([tokenFile().name, r1.fills[0].color], ['Brand A (temporary)', '#0D99FF']);
    await useTokenFile(b.id);
    resolveVariables();
    eq(state.doc.libraries.map((l) => l.name), ['Brand B (temporary)']); // only one
    eq(r1.bindings['fills.0.color'], b.published.collections[0].variables[0].id);
    eq(r1.fills[0].color, '#9747FF');
    eq(r2.fills[0].color, '#000000'); // no match: keeps its value
  } finally {
    answerWith(null);
    await deleteFile(a.id);
    await deleteFile(b.id);
  }
});
