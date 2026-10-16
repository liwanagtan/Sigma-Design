import { test, eq, ok } from './harness.js';
import { state, createNode, commit, loadDocument, flushSave, setPersistence, editNode } from '../src/store.js';
import {
  initFiles, createFile, deleteFile, loadFile, listFiles, renameFile, setCurrentFile, saveNamedVersion, listVersions, updateThumbnail,
  ensureSigmaProject, createTokenFileWith, sampleTokenFile, sampleIconFile, appendToTokenFile, archiveFile, restoreFile, listArchivedFiles, listTokenFiles, duplicateCurrent, closeCurrentFile,
  saveNow, currentSaveFailure, discardCurrentFile,
  restoreVersion,
} from '../src/files.js';
import { SIGMA_SYSTEM_VERSION } from '../src/sigma-design-system.js';
import { sampleTokenDocument } from './fixtures/sample-tokens.js';
import { sampleIconsDocument, SAMPLE_ICONS_VERSION } from '../src/sample-icons.js';
import { loadIconSet, ICON_SETS } from '../src/icon-library.js';
import { WELCOME_VERSION } from './fixtures/welcome.js';
import { db } from '../src/db.js';
import {recoveryEntries} from '../src/recovery.js';

const sampleDoc = () => ({
  name: 'Storage test (temporary)',
  pages: [{ id: 'p1', name: 'Page 1', background: '#F5F5F5', children: [createNode('rect', { name: 'Box', x: 0 })] }],
  currentPageId: 'p1',
});
const exists = async (id) => (await listFiles()).some((f) => f.id === id);
const cleanupRecovery=id=>{for(const entry of recoveryEntries(localStorage,{fileId:id}))localStorage.removeItem(entry.key);};

test('storage safety: synchronous quota failure rolls back an already queued document write',async()=>{
  const id='quota-fixture-'+crypto.randomUUID(),put=IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put=function(value,...args){
      if(this.name==='files'&&value.id===id)throw new DOMException('Injected quota failure','QuotaExceededError');
      return put.call(this,value,...args);
    };
    let failure;try{await db.putFile({id,name:'Unstored'},{id,doc:sampleDoc()});}catch(error){failure=error;}
    eq(failure.name,'QuotaExceededError');
    IDBObjectStore.prototype.put=put;
    eq(await db.get('files',id),undefined);eq(await db.get('docs',id),undefined);
    await db.putFile({id,name:'Retry'},{id,doc:sampleDoc()});ok(await db.get('docs',id));
  }finally{IDBObjectStore.prototype.put=put;await db.deleteFile(id);}
});

test('storage safety: a concurrent writer cannot silently replace either document', async () => {
  await initFiles();const id=await createFile(sampleDoc());
  try {
    const local=await loadFile(id);setCurrentFile(id);loadDocument(local.doc);
    await db.updateFile(id,(meta,rec)=>({doc:{...rec,doc:{...rec.doc,name:'Other tab'}}}));
    state.doc.name='My edits';commit();await flushSave();
    ok(currentSaveFailure());eq((await db.get('docs',id)).doc.name,'Other tab');eq(state.doc.name,'My edits');
    let blocked=false;try{await closeCurrentFile();}catch{blocked=true;}ok(blocked);
  }finally{discardCurrentFile();cleanupRecovery(id);await deleteFile(id);}
});

test('storage safety: a failed save keeps edits, blocks leaving, and can be retried', async () => {
  await initFiles();const id=await createFile(sampleDoc());const update=db.updateFile;
  try {
    const local=await loadFile(id);setCurrentFile(id);loadDocument(local.doc);
    db.updateFile=async()=>{throw new Error('Storage unavailable');};
    state.doc.name='Recoverable edits';commit();await flushSave();ok(currentSaveFailure());
    let blocked=false;try{await closeCurrentFile();}catch{blocked=true;}ok(blocked);eq(state.doc.name,'Recoverable edits');
    db.updateFile=update;await saveNow();eq(currentSaveFailure(),null);eq((await db.get('docs',id)).doc.name,'Recoverable edits');
  }finally{db.updateFile=update;discardCurrentFile();cleanupRecovery(id);await deleteFile(id);}
});

test('storage safety: recovered edits never overwrite a newer stored revision', async () => {
  const id=await createFile(sampleDoc());
  try {
    await db.updateFile(id,(meta,rec)=>({doc:{...rec,doc:{...rec.doc,name:'Newer saved work'}}}));
    localStorage.setItem('sigma.pending',JSON.stringify({id,revision:0,t:Date.now()+1000,doc:{...sampleDoc(),name:'Recovered older edits'},views:{}}));
    const recovered=await loadFile(id);
    eq(recovered.doc.name,'Newer saved work');eq((await db.get('docs',id)).doc.name,'Newer saved work');
    eq(recoveryEntries(localStorage,{fileId:id})[0].record.doc.name,'Recovered older edits');
  }finally{localStorage.removeItem('sigma.pending');discardCurrentFile();cleanupRecovery(id);await deleteFile(id);}
});

test('storage safety: rename and named-history mutations stop when current edits conflict',async()=>{
  await initFiles();const id=await createFile(sampleDoc());
  try{
    const file=await loadFile(id);setCurrentFile(id);loadDocument(file.doc);
    await db.updateFile(id,(meta,rec)=>({doc:{...rec,doc:{...rec.doc,name:'Other writer'}}}));
    state.doc.name='Local edit';commit();await flushSave();
    for(const action of [()=>renameFile(id,'Rename'),()=>saveNamedVersion(id,'Unstored')]){
      let failed=false;try{await action();}catch{failed=true;}ok(failed);
    }
    eq((await db.get('docs',id)).doc.name,'Other writer');eq((await listVersions(id)).filter(v=>v.title==='Unstored').length,0);
  }finally{discardCurrentFile();cleanupRecovery(id);await deleteFile(id);}
});

test('storage safety: concurrent history restore rolls back without replacing newer work or adding history',async()=>{
  const id=await createFile(sampleDoc());const update=db.updateFile;
  try{
    const version=await saveNamedVersion(id,'Original');const count=(await listVersions(id)).length;let raced=false;
    db.updateFile=async(fileId,fn)=>{
      if(fileId===id&&!raced){raced=true;await update(id,(meta,rec)=>({doc:{...rec,doc:{...rec.doc,name:'Concurrent edit'}}}));}
      return update(fileId,fn);
    };
    let failed=false;try{await restoreVersion(id,version);}catch{failed=true;}ok(failed);
    eq((await db.get('docs',id)).doc.name,'Concurrent edit');eq((await listVersions(id)).length,count);
  }finally{db.updateFile=update;cleanupRecovery(id);await deleteFile(id);}
});

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
        cleanupRecovery(id);await deleteFile(id);
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

test('storage: Sigma Components is reused and links the current app tokens and icons', async () => {
  const before = new Set((await listFiles()).map((f) => f.id));
  const archivedBefore = new Set((await listArchivedFiles()).map((f) => f.id));
  const linked = async (id) => (await loadFile(id)).doc.libraries.map((l) => l.fileId);
  try {
    // Start from no current Welcome file, so this test sees one being made.
    for (const f of await listFiles()) if (f.welcome) await archiveFile(f.id);
    const a = await ensureSigmaProject();
    const b = await ensureSigmaProject();
    eq(b, a); // the same Welcome file is reopened
    eq((await loadFile(a)).meta.name, 'Components');
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
    const c = await ensureSigmaProject();
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

test('storage: old teaching tokens are archived intact, Sigma UI Tokens replace them, and icons are reused', async () => {
  const before = new Set((await listFiles()).map((f) => f.id));
  const archivedBefore = new Set((await listArchivedFiles()).map((f) => f.id));
  try {
    // The sample icons, named as before: reused, and renamed (in the list and in the file).
    const doc = sampleIconsDocument(await loadIconSet(ICON_SETS.find((s) => s.id === 'lucide')));
    doc.name = 'Sigma Icons';
    const iconsId = await createFile(doc, {}, { sample: true, sampleIcons: SAMPLE_ICONS_VERSION });
    const icons = await sampleIconFile();
    eq([icons.id, icons.name, (await loadFile(iconsId)).meta.name, (await loadFile(iconsId)).doc.name], [iconsId, 'Icons', 'Icons', 'Icons']);
    // The sample tokens, named as before: a new guide reuses them, renamed, and links them by the new name.
    for (const f of await listFiles()) if (f.welcome) await archiveFile(f.id);
    const old = await createTokenFileWith('Sigma Tokens', sampleTokenDocument().collections, 'Before', { meta: { sample: true } });
    const guide = await loadFile(await ensureSigmaProject());
    eq(guide.meta.name,'Components');
    eq(guide.doc.libraries[0].name, 'Tokens');
    ok(guide.doc.libraries[0].fileId !== old.id, 'replaces teaching tokens with the interface system');
    eq((await loadFile(old.id)).meta.name, 'Sigma Tokens', 'old file preserved intact');
    ok((await listArchivedFiles()).some(f => f.id === old.id), 'old tokens remain recoverable');
    const system = (await listFiles()).filter(f => f.sample && f.sigmaSystem === SIGMA_SYSTEM_VERSION);
    eq(system.map(f => f.name).sort(), ['Components', 'Tokens']);
    for (const meta of system.filter(f => f.kind === 'design')) {
      const file = await loadFile(meta.id);
      eq(file.doc.libraries[0].fileId, guide.doc.libraries[0].fileId);
    }
    eq((await listFiles()).filter(f=>f.sample && f.sigmaPages).length,0,'Pages and UI is not created');
    await ensureSigmaProject();
    eq((await listFiles()).filter(f=>f.sample && f.sigmaSystem===SIGMA_SYSTEM_VERSION).length,2,'no duplicate Sigma system');
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
    cleanupRecovery(id);await deleteFile(id);
    ok(!(await loadFile(id)), 'Delete forever erases it');
  } finally {
    cleanupRecovery(id);await deleteFile(id);
    await deleteFile(tokens.id);
  }
});

test('storage: a sample file (Welcome to Sigma) can be edited while open but is never saved', async () => {
  await initFiles();
  const id = await createFile(sampleDoc(), {}, { welcome: 1 });
  let keptCopy = null;
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
    const originalThumbnail = (await loadFile(id)).meta.thumbnail;
    await updateThumbnail();
    eq((await loadFile(id)).meta.thumbnail, originalThumbnail, 'temporary edits never update thumbnails');
    keptCopy = await duplicateCurrent();
    eq((await loadFile(keptCopy)).doc.pages[0].children[0].x, 500, 'copy keeps the current edits');
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
    await closeCurrentFile();
    const reopened = await loadFile(id);
    loadDocument(reopened.doc, reopened.views);
    eq(state.doc.pages[0].children[0].x, 0, 'leaving and reopening resets the sample');
  } finally {
    setCurrentFile(null);
    state.screen = 'home';
    cleanupRecovery(id);await deleteFile(id);
    await deleteFile(tokens.id);
    if (keptCopy) await deleteFile(keptCopy);
  }
});

test('Sigma setup permanently removes active and archived retired references without touching other files',async()=>{
  const {GUIDE_CHAPTERS}=await import('../src/welcome-guide.js');
  const before=new Set((await db.getAll('files')).map(f=>f.id));
  const archivedBefore=new Set((await listArchivedFiles()).map(f=>f.id));
  const refs=[];
  try{
    refs.push(await createFile({name:'Foundations',pages:[]},{},{sample:true,sigmaSystem:SIGMA_SYSTEM_VERSION}));
    refs.push(await createFile({name:'Pages and UI',pages:[]},{},{sample:true,sigmaPages:15}));
    refs.push(await createFile({name:'Guide examples',pages:[]},{},{welcome:WELCOME_VERSION}));
    const custom=await createFile({name:'Foundations',pages:[]},{},{projectId:'project-sigma'});
    const optics=await createFile({name:'Optics Foundations',pages:[]},{},{optics:1,projectId:'project-optics'});
    await archiveFile(refs[1]);
    const id=await ensureSigmaProject();await ensureSigmaProject();
    const live=await listFiles();eq(live.filter(f=>f.sample||f.welcome).map(f=>f.name).sort(),['Components','Icons','Tokens']);
    for(const ref of refs){ok(!live.some(f=>f.id===ref));ok(!(await listArchivedFiles()).some(f=>f.id===ref));eq(await db.get('docs',ref),undefined,'retired content is permanently removed');}
    ok(live.some(f=>f.id===custom));ok(live.some(f=>f.id===optics));eq(id,await ensureSigmaProject());
    for(const chapter of GUIDE_CHAPTERS)if(chapter.example)ok(['sigma:tokens','sigma:icons','sigma:components'].includes(chapter.example),'documentation links target retained files');
  }finally{
    for(const f of await db.getAll('files'))if(!before.has(f.id))await deleteFile(f.id);
    for(const f of await listArchivedFiles())if(before.has(f.id)&&!archivedBefore.has(f.id))await restoreFile(f.id);
  }
});
