import { test, eq, ok } from './harness.js';
import { state, createNode, commit, loadDocument, flushSave, setPersistence, editNode } from '../src/store.js';
import {
  initFiles, createFile, deleteFile, loadFile, listFiles, renameFile, setCurrentFile, saveNamedVersion, listVersions, updateThumbnail,
  welcomeFile, createTokenFileWith, sampleTokenFile, sampleIconFile, appendToTokenFile, archiveFile, restoreFile, listArchivedFiles, listTokenFiles,
} from '../src/files.js';
import { sampleTokenDocument } from '../src/sample-tokens.js';
import { sampleIconsDocument, SAMPLE_ICONS_VERSION } from '../src/sample-icons.js';
import { loadIconSet, ICON_SETS } from '../src/icon-library.js';
import { WELCOME_VERSION } from '../src/welcome.js';
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

test('storage: Welcome to Sigma is reused, and links the sample tokens, skipping a copy that lost tokens it uses', async () => {
  const before = new Set((await listFiles()).map((f) => f.id));
  const archivedBefore = new Set((await listArchivedFiles()).map((f) => f.id));
  const linked = async (id) => (await loadFile(id)).doc.libraries.map((l) => l.fileId);
  try {
    // Start from no current Welcome file, so this test sees one being made.
    for (const f of await listFiles()) if (f.welcome) await archiveFile(f.id);
    const a = await welcomeFile();
    const b = await welcomeFile();
    eq(b, a); // the same Welcome file is reopened
    eq((await loadFile(a)).meta.welcome, WELCOME_VERSION);
    eq([(await sampleTokenFile()).id], await linked(a)); // Sample token file opens the same one
    const icons = (await loadFile(a)).doc.iconLibraries?.[0];
    ok(icons && (await loadFile(icons.fileId)).meta.sample, 'links the sample icons');
    eq((await sampleIconFile()).id, icons.fileId, 'which is reused');
    // (In a browser's first Welcome to Sigma, Optics comes too, with Optics Tokens: not a sample.)
    const newTokenFiles = (await listFiles()).filter((f) => !before.has(f.id) && f.kind === 'tokens' && !f.optics);
    ok(newTokenFiles.length <= 1, `at most one sample token file is created (${newTokenFiles.map((f) => f.name).join(', ')})`);
    // A newer sample token file without the Components collection can't back the sample, so it is skipped.
    const { name, collections } = sampleTokenDocument();
    const broken = await createTokenFileWith(name, collections.filter((c) => c.name !== 'Components'), 'Broken', { meta: { sample: true } });
    await archiveFile(a); // the next one is new, and must skip the broken tokens
    const c = await welcomeFile();
    ok(c !== a, 'an archived Welcome file isn’t reopened');
    ok(!(await listFiles()).some((f) => f.id === broken.id), 'a new guide moves the other sample files to the Archive');
    ok((await listArchivedFiles()).some((f) => f.id === broken.id), '…where they stay, not deleted');
    eq(await linked(c), await linked(a));
    ok(!(await linked(c)).includes(broken.id), 'the broken file is not linked');
  } finally {
    for (const f of [...await listFiles(), ...await listArchivedFiles()]) if (!before.has(f.id) && !archivedBefore.has(f.id)) await deleteFile(f.id);
    // Put back whatever this test (or the automatic archiving of older samples) moved to the Archive.
    for (const f of await listArchivedFiles()) if (before.has(f.id) && !archivedBefore.has(f.id)) await restoreFile(f.id);
  }
});

test('storage: sample files from before keep going, renamed: Sigma Tokens → Sample tokens, Sigma Icons → Sample icons', async () => {
  const before = new Set((await listFiles()).map((f) => f.id));
  const archivedBefore = new Set((await listArchivedFiles()).map((f) => f.id));
  try {
    // The sample icons, named as before: reused, and renamed (in the list and in the file).
    const doc = sampleIconsDocument(await loadIconSet(ICON_SETS.find((s) => s.id === 'lucide')));
    doc.name = 'Sigma Icons';
    const iconsId = await createFile(doc, {}, { sample: true, sampleIcons: SAMPLE_ICONS_VERSION });
    const icons = await sampleIconFile();
    eq([icons.id, icons.name, (await loadFile(iconsId)).meta.name, (await loadFile(iconsId)).doc.name], [iconsId, 'Sample icons', 'Sample icons', 'Sample icons']);
    // The sample tokens, named as before: a new guide reuses them, renamed, and links them by the new name.
    for (const f of await listFiles()) if (f.welcome) await archiveFile(f.id);
    const old = await createTokenFileWith('Sigma Tokens', sampleTokenDocument().collections, 'Before', { meta: { sample: true } });
    const guide = await loadFile(await welcomeFile());
    eq([guide.meta.name, guide.doc.libraries[0].fileId, guide.doc.libraries[0].name, (await loadFile(old.id)).meta.name], ['Guide', old.id, 'Sample tokens', 'Sample tokens']);
  } finally {
    for (const f of [...await listFiles(), ...await listArchivedFiles()]) if (!before.has(f.id) && !archivedBefore.has(f.id)) await deleteFile(f.id);
    for (const f of await listArchivedFiles()) if (before.has(f.id) && !archivedBefore.has(f.id)) await restoreFile(f.id);
  }
});

test('storage: deleting moves a file to the Archive; it can be restored, and only Delete forever erases it', async () => {
  const id = await createFile(sampleDoc());
  const tokens = await createTokenFileWith('Archive test tokens (temporary)', sampleTokenDocument().collections, 'x');
  try {
    ok(await archiveFile(id), 'archived');
    ok(!(await exists(id)), 'gone from the file lists');
    ok((await listArchivedFiles()).some((f) => f.id === id), 'in the Archive');
    ok(await loadFile(id), 'still stored, with its document');
    await archiveFile(tokens.id);
    ok(!(await listTokenFiles()).some((f) => f.id === tokens.id), 'archived tokens files aren’t offered as libraries');
    ok(await restoreFile(id), 'restored');
    ok(await exists(id), 'back in the file lists');
    eq((await loadFile(id)).meta.archivedAt, undefined);
    await archiveFile(id);
    await deleteFile(id);
    ok(!(await loadFile(id)), 'Delete forever erases it');
  } finally {
    await deleteFile(id);
    await deleteFile(tokens.id);
  }
});

test('storage: a sample file (Welcome to Sigma) can be edited while open but is never saved', async () => {
  await initFiles();
  const id = await createFile(sampleDoc(), {}, { welcome: 1 });
  const tokens = await createTokenFileWith('Sample tokens test (temporary)', sampleTokenDocument().collections, 'x', { meta: { sample: true } });
  try {
    const file = await loadFile(id);
    setCurrentFile(id, { sample: true });
    state.screen = 'editor';
    loadDocument(file.doc, file.views);
    const box = state.doc.pages[0].children[0];
    editNode(box, ['x'], (n) => void (n.x = 500));
    commit();
    await flushSave();
    eq(state.doc.pages[0].children[0].x, 500); // the edit works while it's open
    eq((await loadFile(id)).doc.pages[0].children[0].x, 0); // …but the file is unchanged
    eq(await saveNamedVersion(id, 'Mine'), null);
    eq((await listVersions(id)).length, 0);
    await renameFile(id, 'Renamed');
    eq((await loadFile(id)).meta.name, 'Storage test (temporary)');
    let refused = false;
    try {
      await appendToTokenFile(tokens.id, [], 'x');
    } catch {
      refused = true;
    }
    ok(refused, 'tokens can’t be moved into the sample tokens');
  } finally {
    setCurrentFile(null);
    state.screen = 'home';
    await deleteFile(id);
    await deleteFile(tokens.id);
  }
});
