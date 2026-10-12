// Comments on layers (Phase 27): stored in the file, moving with their layer, in changesets and the validator.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, setWorldMatrix } from '../src/store.js';
import { translate } from '../src/geom.js';
import { addComment, reply, setResolved, pinPoint, comments, deleteComment } from '../src/comments.js';
import { projectChanges, applyChanges } from '../src/changesets.js';
import { toProjectFile } from '../src/project-format.js';
import { validateFile } from '../src/validate.js';

test('comments: pinned to a layer, they move with it; replies and resolving are kept', () => {
  try { localStorage.setItem('sigma.author', 'Tester'); } catch {}
  const title = createNode('text', { name: 'Title', text: 'Hi', x: 20, y: 30 });
  const card = createNode('frame', { name: 'Card', x: 100, y: 100, w: 200, h: 100, children: [title] });
  useDoc([card]);
  const c = addComment({ worldPoint: { x: 125, y: 135 }, text: 'Use the heading token', node: title });
  eq([c.layer, c.author, c.at], ['Card / Title', 'Tester', { x: 5, y: 5 }]);
  setWorldMatrix(card, translate(300, 100));
  eq(pinPoint(c), { x: 325, y: 135 }, 'moves with its layer');
  reply(c, 'Done');
  setResolved(c, true);
  eq([c.replies.length, c.resolved, c.resolvedBy], [1, true, 'Tester']);
  const { file } = toProjectFile(state.doc);
  eq(file.comments[0].text, 'Use the heading token', 'saved in the file');
  eq(validateFile(file, { path: 'f' }).filter((i) => i.level === 'error'), []);
  deleteComment(c);
  eq(comments(), []);
});

test('comments: changes to comments are changeset items, and apply on their own', () => {
  const page = { id: 'p', name: 'P', children: [{ id: 'n', type: 'rect', name: 'Box' }] };
  const base = { 'd.json': { format: 1, kind: 'design', name: 'D', pages: [page] } };
  const now = { 'd.json': { ...structuredClone(base['d.json']), comments: [{ id: 'c1', pageId: 'p', nodeId: 'n', at: { x: 0, y: 0 }, layer: 'Box', text: 'Too dark', author: 'R', createdAt: '', replies: [] }] } };
  const items = projectChanges(base, now);
  eq(items.map((i) => `${i.kind} ${i.change}`), ['comment added']);
  eq(applyChanges(base, items)['d.json'].comments[0].text, 'Too dark');
  const orphan = { ...now['d.json'], comments: [{ ...now['d.json'].comments[0], nodeId: 'gone' }] };
  ok(validateFile(orphan, { path: 'd.json' }).some((i) => i.level === 'warning' && i.message.includes('isn’t there any more')));
});
