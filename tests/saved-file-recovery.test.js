import {test,eq,ok} from './harness.js';
import {db} from '../src/db.js';
import {createFile,loadFile,deleteFile,discardCurrentFile} from '../src/files.js';
import {copySavedVersion,openSavedFileRecovery} from '../src/saved-file-recovery.js';

const doc=name=>({name,pages:[{id:'page',children:[]}],currentPageId:'page'});
test('saved recovery: missing or malformed current data preserves history and copies a version into Drafts',async()=>{
  const original=doc('Saved work'),id=await createFile(original,{}, {projectId:null});let copy;
  const version={id:'rescue-'+crypto.randomUUID(),fileId:id,title:'Before damage',createdAt:Date.now()};
  try {
    await db.putVersion(version,original);await db.delete('docs',id);
    let failure;try{await loadFile(id);}catch(error){failure=error;}
    eq(failure.savedFileId,id);ok(await db.get('files',id));eq((await db.versionsOf(id)).length,1);
    copy=await copySavedVersion(id,version.id);
    eq((await loadFile(copy)).doc.name,'Saved work (recovered)');eq((await db.get('files',copy)).projectId,null);
    eq(await db.get('docs',id),undefined);eq((await db.versionDoc(version.id)).name,'Saved work');
    await db.put('docs',{id,doc:{name:'Damaged',pages:'broken'}});
    failure=null;try{await loadFile(id);}catch(error){failure=error;}eq(failure.savedFileId,id);
    eq((await db.get('docs',id)).doc.pages,'broken');
    await db.put('docs',{id,figmaDocumentChunks:[new TextEncoder().encode('bad saved transfer').buffer]});
    failure=null;try{await loadFile(id);}catch(error){failure=error;}eq(failure.savedFileId,id);
    eq((await db.versionsOf(id)).length,1);
  }finally{discardCurrentFile();if(copy)await deleteFile(copy);await deleteFile(id);}
});

test('saved recovery: unreadable and unrelated versions cannot create a partial Draft',async()=>{
  const id=await createFile(doc('Keep original'),{}, {projectId:null});
  const bad={id:'bad-'+crypto.randomUUID(),fileId:id,title:'Unreadable',createdAt:Date.now()};
  try {
    await db.putVersion(bad,{name:'Bad',pages:'broken'});
    for(const versionId of [bad.id,'other-file-version']) {
      let failed=false;try{await copySavedVersion(id,versionId);}catch{failed=true;}ok(failed);
    }
    eq((await loadFile(id)).doc.name,'Keep original');eq((await db.versionsOf(id)).length,1);
    await openSavedFileRecovery(id);
    const wrap=document.querySelector('[data-saved-file-recovery]');ok(wrap);eq(wrap.querySelector('[data-saved-file-name]').textContent,'Keep original');
    const button=[...wrap.querySelectorAll('button')].find(b=>b.textContent==='Copy to Drafts');
    await button.onclick();ok(!button.disabled);ok(wrap.textContent.includes('pages must be a list'));wrap.remove();
  }finally{document.querySelector('[data-saved-file-recovery]')?.remove();await deleteFile(id);}
});

test('saved recovery: actual app opens a damaged file recovery dialog and copies history into an editable Draft',async()=>{
  const id=await createFile(doc('Damaged file UI fixture'),{}, {projectId:null});let copy;
  const version={id:'ui-rescue-'+crypto.randomUUID(),fileId:id,title:'Usable history',createdAt:Date.now()};
  const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-5000px;width:1280px;height:900px';
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Recovery UI did not reach expected state');};
  try {
    await db.putVersion(version,doc('Historical design'));
    await db.put('docs',{id,doc:{name:'Unreadable current',pages:'broken'}});
    document.body.append(frame);frame.src=`/index.html#/file/${id}`;
    await wait(()=>frame.contentDocument?.querySelector('[data-saved-file-recovery]'));
    const d=frame.contentDocument;
    await wait(()=>[...d.querySelectorAll('[data-saved-file-recovery] button')].some(b=>b.textContent==='Copy to Drafts'));
    [...d.querySelectorAll('[data-saved-file-recovery] button')].find(b=>b.textContent==='Copy to Drafts').click();
    await wait(()=>d.querySelector('.design-header .file-name')?.value==='Historical design (recovered)');
    copy=frame.contentWindow.location.hash.match(/\/file\/([\w-]+)/)?.[1];ok(copy&&copy!==id);
    eq((await loadFile(copy)).meta.projectId,null);eq((await db.get('docs',id)).doc.pages,'broken');
    eq((await db.versionDoc(version.id)).name,'Historical design');
  }finally{frame.remove();if(copy)await deleteFile(copy);await deleteFile(id);}
});
