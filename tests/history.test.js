import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, commit, makePaint } from '../src/store.js';
import {
  createFile, loadFile, deleteFile, listVersions, loadVersionDoc, saveNamedVersion, restoreVersion, duplicateVersion,
  updateVersion,
} from '../src/files.js';
import { db } from '../src/db.js';

const docWith = (color, extra = {}) => ({
  name: 'History test (temporary)',
  pages: [{ id: 'p1', name: 'Page 1', background: '#F5F5F5', children: [createNode('rect', { name: 'Box', fills: [makePaint(color)] })] }],
  currentPageId: 'p1',
  ...extra,
});
const boxColor = (doc) => doc.pages[0].children[0].fills[0].color;

const tick = () => new Promise((r) => setTimeout(r, 5)); // versions saved in the same millisecond have no order

async function overwrite(id, doc) {
  await tick();
  const file = await loadFile(id);
  await db.putFile({ ...file.meta, updatedAt: Date.now() }, { id, doc, views: {} });
}

test('history: named versions are listed newest first and keep their document', async () => {
  const id = await createFile(docWith('#FF0000'));
  try {
    await saveNamedVersion(id, 'Red', 'First idea');
    await overwrite(id, docWith('#00FF00'));
    await saveNamedVersion(id, 'Green');
    const list = await listVersions(id);
    eq(list.map((v) => [v.kind, v.title]), [['named', 'Green'], ['named', 'Red']]);
    eq(list[1].description, 'First idea');
    eq(boxColor(await loadVersionDoc(list[1].id)), '#FF0000');
  } finally {
    await deleteFile(id);
  }
});

test('history: restoring keeps the replaced state and the publish records', async () => {
  const id = await createFile(docWith('#FF0000'));
  try {
    const red = await saveNamedVersion(id, 'Red');
    await overwrite(id, docWith('#0000FF', { publishedComponents: { version: 3, components: [] } }));
    await restoreVersion(id, red);
    const file = await loadFile(id);
    eq(boxColor(file.doc), '#FF0000');
    eq(file.doc.publishedComponents.version, 3);
    const list = await listVersions(id);
    ok(list[0].title.startsWith('Before restoring'), 'the replaced state is kept');
    eq(boxColor(await loadVersionDoc(list[0].id)), '#0000FF');
  } finally {
    await deleteFile(id);
  }
});

test('history: a version copies to a new file that is not a library', async () => {
  const id = await createFile(docWith('#FF0000', { publishedComponents: { version: 1, components: [] } }));
  let copy;
  try {
    const v = await saveNamedVersion(id, 'Launch');
    copy = await duplicateVersion(v);
    const file = await loadFile(copy);
    eq([boxColor(file.doc), file.doc.publishedComponents, file.meta.componentVersion], ['#FF0000', undefined, 0]);
    ok(file.doc.name.includes('Launch'), 'named after the version');
  } finally {
    await deleteFile(id);
    if (copy) await deleteFile(copy);
  }
});

test('history: naming an autosave keeps it; deleting a file deletes its versions', async () => {
  const id = await createFile(docWith('#FF0000'));
  const v = await saveNamedVersion(id, 'Temp');
  const auto = await updateVersion({ ...v, kind: 'auto', title: '' }, { title: 'Kept' });
  eq(auto.kind, 'named');
  await deleteFile(id);
  eq((await listVersions(id)).length, 0);
  eq(await loadVersionDoc(v.id), null);
});

test('history: edits are put back while viewing an older version', () => {
  const box = createNode('rect', { name: 'Box', x: 0 });
  useDoc([box]);
  state.readOnly = true;
  try {
    box.x = 50;
    commit();
    eq(state.doc.pages[0].children[0].x, 0);
  } finally {
    state.readOnly = false;
  }
});
