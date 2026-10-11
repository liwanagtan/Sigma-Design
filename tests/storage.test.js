import { test, eq, ok } from './harness.js';
import { state, createNode, commit, loadDocument, flushSave, setPersistence, editNode } from '../src/store.js';
import {
  initFiles, createFile, deleteFile, loadFile, listFiles, renameFile, setCurrentFile, saveNamedVersion, listVersions, updateThumbnail,
} from '../src/files.js';
import { db } from '../src/db.js';

const sampleDoc = () => ({
  name: 'Storage test (temporary)',
  pages: [{ id: 'p1', name: 'Page 1', background: '#F5F5F5', children: [createNode('rect', { name: 'Box', x: 0 })] }],
  currentPageId: 'p1',
});
const exists = async (id) => (await listFiles()).some((f) => f.id === id);

test('storage: a guarded update writes nothing once the file is deleted', async () => {
  const id = await createFile(sampleDoc());
  ok(await db.updateFile(id, (meta) => ({ meta: { ...meta, name: 'Renamed' } })), 'writes while the file exists');
  eq((await loadFile(id)).meta.name, 'Renamed');
  // Delete and update queued together: storage runs them in order, and the update finds nothing.
  const [, wrote] = await Promise.all([deleteFile(id), db.updateFile(id, (meta) => ({ meta, doc: { id, doc: sampleDoc(), views: {} } }))]);
  eq(wrote, false);
  ok(!(await exists(id)), 'stays deleted');
  await renameFile(id, 'Back?');
  await saveNamedVersion(id, 'Ghost');
  ok(!(await exists(id)), 'rename does not bring it back');
  eq((await listVersions(id)).length, 0);
});

test('storage: an autosave that races with a delete never brings the file back', async () => {
  await initFiles();
  const id = await createFile(sampleDoc());
  const file = await loadFile(id);
  try {
    setCurrentFile(id);
    state.screen = 'editor';
    loadDocument(file.doc, file.views);
    const box = state.doc.pages[0].children[0];
    editNode(box, ['x'], (n) => void (n.x = 40));
    commit(); // an autosave is now pending
    // The file is deleted (here or in another tab) right after the autosave has read it.
    const realGet = db.get;
    db.get = async (store, key) => {
      const result = await realGet(store, key);
      if (store === 'files' && key === id) {
        db.get = realGet;
        await deleteFile(id);
      }
      return result;
    };
    await flushSave();
    db.get = realGet;
    await updateThumbnail();
    ok(!(await exists(id)), 'the file stays deleted');
    eq(await db.get('docs', id), undefined);
  } finally {
    setCurrentFile(null);
    setPersistence(null);
    state.screen = 'home';
  }
});
