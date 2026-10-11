import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, makePaint, uid } from '../src/store.js';
import {
  resolveVariables, snapshotForLibrary, groupTree, createGroup, renameGroup, moveGroup, ungroup, deleteGroup, findGroup,
  moveTokensToGroup, findByReference, aliasChain, detachAliasesTo, collections, wouldCycle, setGroupDescription, tokensInOrder,
  setTokenName, createVariable,
} from '../src/variables.js';
import { normalizeGroups } from '../src/token-groups.js';
import { publishDependencies } from '../src/libraries.js';
import { exportDTCG, importTokens } from '../src/tokens-io.js';

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

const byName = (col, path) => groupTree(col).flatMap(function flat(g) { return [g, ...g.children.flatMap(flat)]; }).find((g) => g.path === path);

test('groups: older files and imports become group objects; token names stay full paths', () => {
  const [col] = withLocal([collection('Color', [
    ['a', 'brand/primary', 'color', '#0D99FF'], ['b', 'brand/accent/strong', 'color', '#000000'], ['c', 'white', 'color', '#FFFFFF'],
  ])]);
  col.groups = ['neutral']; // the earlier format: paths
  normalizeGroups(col);
  ok(col.groups.every((g) => typeof g === 'object' && g.id), 'objects with ids');
  const brand = byName(col, 'brand');
  eq([col.variables[0].groupId, col.variables[2].groupId], [brand.id, undefined]);
  eq(groupTree(col).map((g) => [g.path, g.count]), [['brand', 2], ['neutral', 0]]);
  eq(brand.children.map((g) => [g.path, g.count]), [['brand/accent', 1]]);
  eq(names(col), ['brand/primary', 'brand/accent/strong', 'white']);
});

test('groups: renaming or moving a group keeps its tokens; their paths follow', () => {
  const [col] = withLocal([collection('Color', [['a', 'brand/primary', 'color', '#0D99FF'], ['b', 'brand/accent/strong', 'color', '#000000']])]);
  normalizeGroups(col);
  const brand = byName(col, 'brand').id;
  const accent = byName(col, 'brand/accent').id;
  renameGroup(col, brand, 'Theme');
  eq(names(col), ['Theme/primary', 'Theme/accent/strong']);
  eq(col.variables[0].groupId, brand);
  ok(!moveGroup(col, brand, accent), 'a group never moves into a group inside it');
  ok(moveGroup(col, accent, null), 'to the top level');
  eq(names(col), ['Theme/primary', 'accent/strong']);
  const other = createGroup(col, null, 'Theme');
  eq(findGroup(col, other).name, 'Theme 2'); // sibling names stay unique
});

test('groups: order, descriptions, ungroup and delete', () => {
  const [col] = withLocal([collection('Size', [['a', 'space/small', 'number', 4], ['b', 'space/inner/tiny', 'number', 2], ['c', 'radius', 'number', 8]])]);
  normalizeGroups(col);
  const space = byName(col, 'space').id;
  const shape = createGroup(col, null, 'shape');
  moveGroup(col, shape, null, space); // before "space"
  eq(groupTree(col).map((g) => g.name), ['shape', 'space']);
  setGroupDescription(col, shape, 'Corners and borders');
  eq(groupTree(col)[0].description, 'Corners and borders');
  moveTokensToGroup(col, ['c'], shape);
  eq(names(col)[2], 'shape/radius');
  moveTokensToGroup(col, ['c'], space, 'a'); // into "space", before "small"
  eq(tokensInOrder(col, col.variables).map((v) => v.name), ['space/radius', 'space/small', 'space/inner/tiny']);
  ungroup(col, byName(col, 'space/inner').id);
  eq(names(col).sort(), ['space/radius', 'space/small', 'space/tiny']);
  deleteGroup(col, space);
  eq(col.variables.length, 0);
});

test('groups: a typed name with "/" puts the token in groups', () => {
  const [col] = withLocal([collection('Color', [['a', 'primary', 'color', '#0D99FF']])]);
  normalizeGroups(col);
  const v = col.variables[0];
  setTokenName(col, v, 'brand/main');
  eq(v.name, 'brand/main');
  setTokenName(col, v, 'strong');
  eq(v.name, 'brand/strong'); // relative to its group
  setTokenName(col, v, '/top');
  eq([v.name, v.groupId], ['top', undefined]);
  const t = createVariable(col, 'color', 'x', byName(col, 'brand').id);
  eq(t.name, 'brand/x');
});

test('groups: tokens.json keeps groups, their order and descriptions', () => {
  const [col] = withLocal([collection('Color', [['a', 'brand/primary', 'color', '#0D99FF'], ['b', 'alpha/one', 'color', '#000000']])]);
  normalizeGroups(col);
  setGroupDescription(col, byName(col, 'brand').id, 'Brand colors');
  const json = JSON.parse(JSON.stringify(exportDTCG([col])));
  eq(json['Color/Default'].brand.$description, 'Brand colors');
  const [back] = importTokens(json).collections;
  eq(groupTree(back).map((g) => [g.name, g.description]), [['brand', 'Brand colors'], ['alpha', '']]);
  eq(back.variables.map((v) => v.name), ['brand/primary', 'alpha/one']);
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
