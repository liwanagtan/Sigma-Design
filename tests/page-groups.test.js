// Page groups (Part H, Phase 38): a design file's pages, grouped by name, kept together.
import { test, eq, ok } from './harness.js';
import { state, loadDocument } from '../src/store.js';
import {
  pageRuns, groupNames, keepTogether, movePage, moveGroup, renameGroup, ungroup, newGroupName, pageLabel,
} from '../src/page-groups.js';
import { toProjectFile, fromProjectFile } from '../src/project-format.js';
import { validateFile } from '../src/validate.js';
import { mergeBranch } from '../src/branches.js';

const pg = (id, group) => ({ id, name: id.toUpperCase(), background: '#F5F5F5', children: [], ...(group ? { group } : {}) });
const order = (pages) => pages.map((p) => (p.group ? `${p.group}:${p.id}` : p.id)).join(' ');
const sample = () => [pg('a'), pg('b', 'G1'), pg('c', 'G1'), pg('d'), pg('e', 'G2'), pg('f', 'G2')];

test('page groups: runs, names, labels and new names', () => {
  const pages = sample();
  eq(pageRuns(pages).map((r) => [r.group, r.pages.map((p) => p.id).join('')]), [[null, 'a'], ['G1', 'bc'], [null, 'd'], ['G2', 'ef']]);
  eq(groupNames(pages), ['G1', 'G2']);
  eq([pageLabel(pages[0]), pageLabel(pages[1])], ['A', 'G1 / B']);
  eq(newGroupName([pg('x', 'Group 1')]), 'Group 2');
});

test('page groups: a group’s pages are kept together, where its first page is; blank names go', () => {
  const pages = [pg('a', 'G'), pg('b'), pg('c', 'G'), pg('d', '  ')];
  ok(keepTogether(pages));
  eq(order(pages), 'G:a G:c b d');
  ok(!('group' in pages[3]), 'a blank group name is no group');
  ok(!keepTogether(pages), 'idempotent');
  // Opening a file does it too (a merge or a hand edit may split a group).
  loadDocument({ name: 'T', pages: [pg('a', 'G'), pg('b'), pg('c', 'G')], currentPageId: 'a' });
  eq(order(state.doc.pages), 'G:a G:c b');
});

test('page groups: move pages in and out, move and rename groups, ungroup', () => {
  let pages = sample();
  movePage(pages, 'a', { group: 'G2' }); // into a group: at its end
  eq(order(pages), 'G1:b G1:c d G2:e G2:f G2:a');
  movePage(pages, 'a', { group: 'G2', beforeId: 'e' });
  eq(order(pages), 'G1:b G1:c d G2:a G2:e G2:f');
  movePage(pages, 'c', { group: null, beforeId: 'd' }); // out of its group
  eq(order(pages), 'G1:b c d G2:a G2:e G2:f');
  pages = sample();
  moveGroup(pages, 'G2', 'a'); // to the top
  eq(order(pages), 'G2:e G2:f a G1:b G1:c d');
  moveGroup(pages, 'G2', 'c'); // never into the middle of another group: before it
  eq(order(pages), 'a G2:e G2:f G1:b G1:c d');
  moveGroup(pages, 'G2', null); // to the end
  eq(order(pages), 'a G1:b G1:c d G2:e G2:f');
  renameGroup(pages, 'G2', 'G1'); // renaming into another group's name merges them
  eq(order(pages), 'a G1:b G1:c G1:e G1:f d');
  ungroup(pages, 'G1');
  eq(order(pages), 'a b c e f d');
});

test('page groups: kept in the project format, checked by the validator, and merged from a branch', () => {
  const doc = { name: 'T', pages: sample(), currentPageId: 'a' };
  const file = toProjectFile(doc).file;
  eq(file.pages.map((p) => p.group || null), [null, 'G1', 'G1', null, 'G2', 'G2']);
  eq(order(fromProjectFile(file).doc.pages), order(sample()));
  const issues = (f) => validateFile(f).filter((i) => /group/.test(i.at)).map((i) => `${i.level} ${i.at}`);
  eq(issues(file), []);
  eq(issues({ ...file, pages: [{ ...file.pages[0], group: '' }, ...file.pages.slice(1)] }), ['error pages[0] (“A”).group']);
  eq(issues({ ...file, pages: [file.pages[1], file.pages[0], file.pages[2]] }), ['warning pages[2] (“C”).group'], 'a split group');
  // A branch groups a page while the main file renames another: both land.
  const asBase = (d) => ({ ...toProjectFile(d, { pathOf: (id) => `id:${id}` }).file, name: '' });
  const main = structuredClone(doc);
  const branch = structuredClone(doc);
  branch.branch = { of: 'main', ofName: 'T', name: 'Groups', base: asBase(doc) };
  branch.pages[3].group = 'G1';
  main.pages[0].name = 'Start';
  const r = mergeBranch(main, branch);
  eq(r.conflicts, []);
  loadDocument(r.doc);
  eq(order(state.doc.pages), 'a G1:b G1:c G1:d G2:e G2:f');
  eq(state.doc.pages[0].name, 'Start');
});
