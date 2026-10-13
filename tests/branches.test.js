// Branches in the browser: a copy of a design file that merges back three ways.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { createNode, makePaint } from '../src/store.js';
import { toProjectFile } from '../src/project-format.js';
import { mergeBranch } from '../src/branches.js';

const asBase = (doc) => ({ ...toProjectFile(doc, { pathOf: (id) => `id:${id}` }).file, name: '' }); // as createBranch keeps it

test('branches: the branch’s changes go into the main file, which changed too; library copies come along', () => {
  const a = createNode('frame', { name: 'Home', w: 100, h: 100, fills: [makePaint('#FFFFFF')] });
  const b = createNode('frame', { name: 'About', x: 200, w: 100, h: 100, fills: [makePaint('#FFFFFF')] });
  const doc = useDoc([a, b]);
  doc.libraries = [{ fileId: 'tokens1', name: 'Core', version: 2, collections: [] }];
  const main = structuredClone(doc);
  const branch = structuredClone(doc);
  branch.branch = { of: 'main', ofName: 'Test', name: 'New home', base: asBase(doc) };
  branch.pages[0].children[0].fills = [makePaint('#FF0000')]; // the branch changes Home
  branch.componentLibraries = [{ fileId: 'lib1', name: 'Kit', version: 1, components: [] }]; // and links a library
  main.pages[0].children[1].fills = [makePaint('#00FF00')]; // meanwhile, the main file changes About
  const r = mergeBranch(main, branch);
  eq(r.conflicts, []);
  eq(r.doc.pages[0].children.map((n) => `${n.name}:${n.fills[0].color}`), ['Home:#FF0000', 'About:#00FF00']);
  eq([r.doc.name, r.doc.branch, r.doc.libraries.map((l) => l.fileId), r.doc.componentLibraries.map((l) => l.fileId)], ['Test', undefined, ['tokens1'], ['lib1']]);
  eq(r.branchChanges.map((c) => c.kind), ['file', 'page'], 'the new link and the page');
  eq(r.mainChanges.map((c) => c.kind), ['page']);
  // Both change Home: whose wins is a choice.
  main.pages[0].children[0].fills = [makePaint('#0000FF')];
  const mine = mergeBranch(main, branch, { prefer: 'branch' });
  eq([mine.conflicts.map((c) => c.name), mine.doc.pages[0].children[0].fills[0].color], [['Page 1 / Home'], '#FF0000']);
  eq(mergeBranch(main, branch, { prefer: 'main' }).doc.pages[0].children[0].fills[0].color, '#0000FF');
  ok(mine.doc.pages[0].children[1].fills[0].color === '#00FF00', 'the rest still merges');
});
