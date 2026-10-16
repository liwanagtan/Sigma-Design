import {test,eq,ok} from './harness.js';
import {createFile,deleteFile} from '../src/files.js';
import {db} from '../src/db.js';
const wait=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Save-status UI did not reach the expected state.');};

test('save status: real Design, Tokens and Icons headers report pending and saved browser edits',async()=>{
  const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-5000px;width:1280px;height:900px';document.body.append(frame);
  const ids=[];
  try{
    for(const kind of ['design','tokens','icons']){
      const name=`Save-state ${kind} fixture`,doc={name,pages:[{id:'p',name:'Page',children:[]}],currentPageId:'p',...(kind==='design'?{}:{kind}),variables:{collections:[]},...(kind==='icons'?{icons:[]}:{} )};
      const id=await createFile(doc,{},{projectId:null});ids.push(id);frame.src=`/index.html#/file/${id}`;
      const selector=kind==='design'?'.design-header':`#${kind} .tokens-header`;
      await wait(()=>frame.contentDocument?.querySelector(selector+' .file-name')?.value===name);
      const d=frame.contentDocument,w=frame.contentWindow;
      await wait(()=>d.querySelector(selector+' [data-save-state]')?.textContent==='Saved in browser');
      const input=d.querySelector(selector+' .file-name');input.value=name+' edited';input.dispatchEvent(new w.Event('change',{bubbles:true}));
      eq(d.querySelector(selector+' [data-save-state]').textContent,'Unsaved changes');
      await wait(()=>d.querySelector(selector+' [data-save-state]')?.textContent==='Saved in browser');
      eq((await db.get('docs',id)).doc.name,name+' edited');
      ok(d.querySelector(selector+' [aria-label="Save and recovery options"]'));
      if(kind==='icons'){
        await db.updateFile(id,(meta,rec)=>({doc:{...rec,doc:{...rec.doc,name:'Other tab edit'}}}));
        input.value='My conflicting edit';input.dispatchEvent(new w.Event('change',{bubbles:true}));
        await wait(()=>d.querySelector(selector+' [data-save-state]')?.textContent==='Save failed');
        ok(d.querySelector('#file-banner').textContent.includes('Download current edits'));
        eq((await db.get('docs',id)).doc.name,'Other tab edit');
      }
    }
  }finally{frame.remove();for(const id of ids){await deleteFile(id);for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('sigma.pending.'+id+'.'))localStorage.removeItem(key);}}}
});
