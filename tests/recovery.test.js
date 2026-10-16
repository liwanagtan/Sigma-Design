import {test,eq,ok} from './harness.js';
import {createFile,loadFile,deleteFile,currentSaveState,setCurrentFile,discardCurrentFile,initFiles,stashPending} from '../src/files.js';
import {loadDocument,state,commit,flushSave,saveViewsSoon} from '../src/store.js';
import {writeRecovery,recoveryEntries} from '../src/recovery.js';
import {createRecoveredCopy,openRecovery} from '../src/recovery-ui.js';
import {modal} from '../src/libraries.js';
const doc=name=>({name,pages:[{id:'page',children:[]}],currentPageId:'page'});

test('recovery: opening a file does not apply or delete another session; recovered copy keeps both sources',async()=>{
  await initFiles();const id=await createFile(doc('Saved work'),{},{projectId:null});let copy;const keys=[];
  try{
    keys.push(writeRecovery(localStorage,'test-a',{id,doc:doc('Unsaved A'),revision:0}));keys.push(writeRecovery(localStorage,'test-b',{id,doc:doc('Unsaved B'),revision:0}));
    eq((await loadFile(id)).doc.name,'Saved work');const entries=recoveryEntries(localStorage,{fileId:id});eq(entries.length,2);
    copy=await createRecoveredCopy(entries[0]);eq((await loadFile(copy)).meta.projectId,null);
    eq((await loadFile(id)).doc.name,'Saved work');eq(recoveryEntries(localStorage,{fileId:id}).length,2);
    eq((await loadFile(copy)).doc.name,entries[0].record.name+' (recovered)');
  }finally{for(const key of keys)localStorage.removeItem(key);await deleteFile(id);if(copy)await deleteFile(copy);}
});

test('save state: edit, save, temporary and read-only states distinguish browser persistence',async()=>{
  await initFiles();const id=await createFile(doc('Status fixture'),{},{projectId:null});
  try{
    const file=await loadFile(id);setCurrentFile(id);loadDocument(file.doc);eq(currentSaveState().status,'saved');
    state.doc.name='Edited';commit();eq(currentSaveState().status,'pending');ok(stashPending());
    eq(recoveryEntries(localStorage,{fileId:id}).length,1);await flushSave();eq(currentSaveState().status,'saved');eq(recoveryEntries(localStorage,{fileId:id}).length,0);
    saveViewsSoon();eq(currentSaveState().status,'saved');ok(stashPending());eq(recoveryEntries(localStorage,{fileId:id}).length,0);await flushSave();
    setCurrentFile(id,{sample:true});eq(currentSaveState().status,'temporary');state.readOnly=true;eq(currentSaveState().status,'readonly');
  }finally{state.readOnly=false;discardCurrentFile();await deleteFile(id);}
});

test('shared dialogs: semantics, keyboard focus trapping and return focus work',async()=>{
  const previous=document.createElement('button');document.body.append(previous);previous.focus();
  const wrap=modal('Dialog fixture','<button data-first>First</button><button data-last>Last</button>');
  try{
    const dialog=wrap.querySelector('[role="dialog"]');ok(dialog);eq(dialog.getAttribute('aria-modal'),'true');
    const close=wrap.querySelector('[data-close]'),last=wrap.querySelector('[data-last]');close.focus();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));eq(document.activeElement,last);
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));eq(document.activeElement,close);
    close.click();eq(document.activeElement,previous);
  }finally{wrap.remove();previous.remove();}
});

test('recovery dialog shows explicit safe-copy actions and a useful empty state',()=>{
  openRecovery({fileId:'nonexistent-recovery-fixture'});const wrap=document.querySelector('[data-recovery-dialog]');
  try{ok(wrap);ok(wrap.textContent.includes('No unsaved recovery entries'));ok(wrap.querySelector('[role="dialog"]'));}finally{wrap.querySelector('[data-close]').click();}
});
