import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, makePaint, uid } from '../src/store.js';
import {
  resolveVariables, snapshotForLibrary, groupTree, groupPaths, createGroup, renameGroup, moveGroup, ungroup, deleteGroup,
  moveTokensToGroup, findByReference, aliasChain, detachAliasesTo, collections, wouldCycle,
} from '../src/variables.js';
import { publishDependencies } from '../src/libraries.js';
import { exportDTCG } from '../src/tokens-io.js';

function collection(name, vars, modes = ['Default']) {
  const ms = modes.map((n) => ({ id: uid(), name: n }));
  return {
    id: uid(), name, modes: ms, defaultModeId: ms[0].id,
    variables: vars.map(([id, vname, type, ...values]) => ({ id, name: vname, type, valuesByMode: Object.fromEntries(ms.map((m, i) => [m.id, values[i] ?? values[0]])) })),
  };
}
const names = (col) => col.variables.map((v) => v.name);

function withLocal(cols, nodes = []) {
  useDoc(nodes);
  state.doc.variables = { collections: cols };
  return cols;
}

test('groups: the tree nests "/" paths, counts tokens and keeps empty groups', () => {
  const [col] = withLocal([collection('Color', [
    ['a', 'brand/primary', 'color', '#0D99FF'], ['b', 'brand/accent/strong', 'color', '#000000'], ['c', 'white', 'color', '#FFFFFF'],
  ])]);
  createGroup(col, '', 'neutral');
  const tree = groupTree(col);
  eq(tree.map((g) => [g.path, g.count]), [['brand', 2], ['neutral', 0]]);
  eq(tree[0].children.map((g) => [g.path, g.count]), [['brand/accent', 1]]);
  eq(createGroup(col, '', 'neutral'), 'neutral 2');
});

test('groups: renaming moves tokens and subgroups; a group never moves into itself', () => {
  const [col] = withLocal([collection('Color', [['a', 'brand/primary', 'color', '#0D99FF'], ['b', 'brand/accent/strong', 'color', '#000000']])]);
  col.groups = ['brand/empty'];
  eq(renameGroup(col, 'brand', 'theme/brand'), 'theme/brand');
  eq(names(col), ['theme/brand/primary', 'theme/brand/accent/strong']);
  eq(col.groups, ['theme/brand/empty']);
  eq(moveGroup(col, 'theme', 'theme/brand'), 'theme'); // refused
  eq(moveGroup(col, 'theme/brand/accent', ''), 'accent');
  eq(names(col), ['theme/brand/primary', 'accent/strong']);
});

test('groups: ungroup keeps tokens one level up; delete removes them; tokens move between groups', () => {
  const [col] = withLocal([collection('Size', [['a', 'space/small', 'number', 4], ['b', 'space/inner/tiny', 'number', 2], ['c', 'radius', 'number', 8]])]);
  ungroup(col, 'space/inner');
  eq(names(col), ['space/small', 'space/tiny', 'radius']);
  moveTokensToGroup(col, ['c'], 'shape');
  eq(names(col)[2], 'shape/radius');
  ok(groupPaths(col).includes('shape'), 'group exists');
  deleteGroup(col, 'space');
  eq(names(col), ['shape/radius']);
});

test('references: typed references find tokens by path with / or .', () => {
  withLocal([collection('Color', [['a', 'brand/primary', 'color', '#0D99FF'], ['n', 'brand/primary', 'number', 1]])]);
  eq(findByReference('{brand.primary}', 'color')?.variable.id, 'a');
  eq(findByReference('{ brand / primary }', 'number')?.variable.id, 'n');
  eq(findByReference('{brand.missing}', 'color'), null);
});

test('references: the chain follows the mode inside a collection family', () => {
  const [col] = withLocal([collection('Color', [
    ['blue', 'blue', 'color', '#0000FF', '#000088'],
    ['brand', 'brand', 'color', { alias: 'blue' }, { alias: 'blue' }],
    ['bg', 'bg', 'color', { alias: 'brand' }, { alias: 'brand' }],
  ], ['Light', 'Dark'])]);
  const bg = col.variables[2];
  const { steps, value } = aliasChain(col, col.modes[1].id, bg);
  eq([steps.map((s) => s.id), value], [['brand', 'blue'], '#000088']);
  ok(wouldCycle('blue', 'bg'), 'blue → bg would loop');
});

// "Core" holds primitives; "Brand" points at them. A design file links only Brand.
function coreAndBrand() {
  const core = collection('Primitives', [['core-blue', 'blue/500', 'color', '#0D99FF']]);
  const brand = collection('Brand', [['brand-primary', 'primary', 'color', { alias: 'core-blue' }]]);
  return { core, brand };
}

test('cross-file: a token file publishes the token files it points at, and they resolve downstream', () => {
  const { core, brand } = coreAndBrand();
  // In the Brand token file: Core is linked, Brand's token points at it.
  withLocal([brand]);
  state.doc.libraries = [{ fileId: 'core', name: 'Core', version: 3, collections: snapshotForLibrary([core], 'core') }];
  const deps = publishDependencies();
  eq(deps.map((d) => [d.fileId, d.version, d.collections[0].variables[0].id]), [['core', 3, 'core-blue']]);
  // In a design file that links only Brand.
  const rect = createNode('rect', { fills: [makePaint('#000000')], bindings: { 'fills.0.color': 'brand-primary' } });
  withLocal([], [rect]);
  state.doc.libraries = [{
    fileId: 'brand', name: 'Brand', version: 1, collections: snapshotForLibrary([brand], 'brand'),
    dependencies: deps.map((d) => ({ ...d, collections: snapshotForLibrary(d.collections, d.fileId) })),
  }];
  resolveVariables();
  eq(rect.fills[0].color, '#0D99FF');
  // Linking Core directly wins over the copy that came with Brand.
  const newer = structuredClone(core);
  newer.variables[0].valuesByMode[newer.defaultModeId] = '#14AE5C';
  state.doc.libraries.push({ fileId: 'core', name: 'Core', version: 4, collections: snapshotForLibrary([newer], 'core') });
  resolveVariables();
  eq(rect.fills[0].color, '#14AE5C');
  eq(collections().filter((c) => c.name === 'Primitives').length, 1);
});

test('cross-file: only token files that are pointed at are published along', () => {
  const { core, brand } = coreAndBrand();
  withLocal([collection('Spacing', [['s', 'space', 'number', 4]])]);
  state.doc.libraries = [{ fileId: 'core', name: 'Core', version: 1, collections: snapshotForLibrary([core], 'core') }];
  eq(publishDependencies(), []);
  withLocal([brand]);
  state.doc.libraries = [{ fileId: 'core', name: 'Core', version: 1, collections: snapshotForLibrary([core], 'core') }];
  eq(publishDependencies().length, 1);
});

test('cross-file: detaching references keeps the values they resolved to', () => {
  const { core, brand } = coreAndBrand();
  withLocal([brand]);
  state.doc.libraries = [{ fileId: 'core', name: 'Core', version: 1, collections: snapshotForLibrary([core], 'core') }];
  eq(detachAliasesTo(new Set(['core-blue'])), 1);
  eq(brand.variables[0].valuesByMode[brand.defaultModeId], '#0D99FF');
});

test('cross-file: tokens.json names tokens in linked files in references', () => {
  const { core, brand } = coreAndBrand();
  const json = exportDTCG([brand], { external: [core] });
  eq(json['Brand/Default'].primary.$value, '{blue.500}');
});
