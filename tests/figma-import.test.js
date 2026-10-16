import { test, eq, ok } from './harness.js';
import { importFiles, loadFile, deleteFile, createFile } from '../src/files.js';
import { readFigmaFile } from '../src/figma-import-file.js';
import { loadDocument, state, commit, undo, redo, createNode } from '../src/store.js';
import { db } from '../src/db.js';
import { encodeFigmaResult, decodeFigmaResult, FIG_TRANSFER_VERSION } from '../src/figma-import-transfer.js';

test('Figma import: strict editor CSP still permits its isolated decoder worker',async()=>{
  const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-5000px;width:1000px;height:700px';document.body.append(frame);let worker;
  try{
    await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('Editor failed to load'));frame.src='/index.html#/drafts/drafts';});
    const w=frame.contentWindow;let blocked=false;try{w.Function('return 1')();}catch(error){blocked=error.name==='EvalError';}ok(blocked);
    const bytes=await(await fetch('./fixtures/figma-basic.fig')).arrayBuffer();
    worker=new w.Worker(new URL('/src/figma-import-worker.js',location.href),{type:'module'});
    const response=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('CSP worker decode timed out')),10000);
      worker.onmessage=event=>{clearTimeout(timer);resolve(event.data);};worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};
      worker.postMessage({protocol:FIG_TRANSFER_VERSION,file:new w.File([bytes],'CSP.fig'),name:'CSP'});
    });
    ok(!response.error,response.error);const result=decodeFigmaResult(response.chunks.map(chunk=>new Uint8Array(chunk).slice().buffer));eq(result.doc.pages[0].name,'Landing page');
  }finally{worker?.terminate();frame.remove();}
});

test('Figma import: large repeated artwork saves, reloads, updates and supports undo',async()=> {
  const src='data:image/svg+xml;charset=utf-8,'+'A'.repeat(65536);
  const report={counts:{pages:1,layers:8192},warnings:[]};
  const doc={name:'Shared artwork storage test',figmaImport:report,currentPageId:'p',pages:[{id:'p',name:'Page',children:Array.from({length:8192},()=>createNode('image',{src}))}]};
  const id=await createFile(doc);
  try {
    const loaded=await loadFile(id);
    loadDocument(loaded.doc,loaded.views);
    state.doc.pages[0].children[0].name='Changed';commit();undo();
    ok(state.doc.pages[0].children[0].name!=='Changed');redo();
    eq(state.doc.pages[0].children[0].name,'Changed');
    await db.updateFile(id,(meta,rec)=>({meta,doc:{...rec,doc:state.doc}}));
    eq((await loadFile(id)).doc.pages[0].children[0].name,'Changed');
    await db.putVersion({id:'figma-storage-test-version',fileId:id},{...state.doc});
    eq((await db.versionDoc('figma-storage-test-version')).pages[0].children[8191].src,src);
  } finally {await deleteFile(id);}
});

test('Figma import: an old tab gets a refresh instruction before parsing', async () => {
  const worker=new Worker(new URL('../src/figma-import-worker.js',import.meta.url),{type:'module'});
  try {
    const message=await new Promise((resolve,reject)=> {
      const timer=setTimeout(()=>reject(new Error('Worker version check timed out')),5000);
      worker.onmessage=event=> {clearTimeout(timer);resolve(event.data);};
      worker.onerror=event=> {clearTimeout(timer);reject(new Error(event.message));};
      worker.postMessage({file:new File(['invalid'],'Old tab.fig'),name:'Old tab'});
    });
    ok(/updated.*Refresh Sigma/.test(message.error));
    ok(!message.chunks);
  } finally {worker.terminate();}
});

test('Figma import: repeated artwork above 128 MB uses a compact shared transfer', () => {
  const src='data:image/svg+xml;charset=utf-8,'+'A'.repeat(65536);
  const value={doc:{pages:[{children:Array.from({length:4096},(_,i)=>({id:String(i),type:'image',src}))}]},report:{warnings:[]}};
  ok(src.length*4096>256*1024*1024);
  const chunks=encodeFigmaResult(value,{maxBytes:1024*1024});
  const received=structuredClone({chunks},{transfer:chunks});
  ok(chunks.every(chunk=>chunk.byteLength===0));
  const result=decodeFigmaResult(received.chunks);
  eq(result.doc.pages[0].children.length,4096);
  eq(result.doc.pages[0].children[4095].src,src);
});

test('Figma import: browser worker converts a binary .fig and saves an editable Design file', async () => {
  const bytes=await (await fetch('./fixtures/figma-basic.fig')).arrayBuffer();
  const ids=await importFiles([new File([bytes],'Figma demo.fig')]);
  try {
    eq(ids.length,1);
    const file=await loadFile(ids[0]);
    eq(file.meta.name,'Figma demo'); eq(file.meta.kind,'design');
    eq(file.doc.pages.length,1); eq(file.doc.pages[0].name,'Landing page');
    const title=file.doc.pages[0].children[0].children[0];
    eq(title.type,'text'); eq(title.text,'Imported from Figma');
    eq(file.doc.figmaImport.counts.layers,7);
    loadDocument(file.doc,file.views);
    const editable=state.doc.pages[0].children[0].children[0];
    editable.text='Edited in Sigma'; commit(); eq(editable.text,'Edited in Sigma');
  } finally { for(const id of ids) await deleteFile(id); }
});
test('Figma import: invalid and oversized files do not create partial Design files', async () => {
  eq(await importFiles([new File(['not a Figma archive'],'Bad.fig')]),[]);
  let refused=false;
  try { await readFigmaFile({size:129*1024*1024}); } catch(error) { refused=/128 MB/.test(error.message); }
  ok(refused);
});

test('Figma import: concurrent imports are limited to one worker', async () => {
  const bytes=await (await fetch('./fixtures/figma-basic.fig')).arrayBuffer();
  const file=new File([bytes],'Concurrent.fig');
  const first=readFigmaFile(file);
  let refused=false;
  try { await readFigmaFile(file); } catch(error) { refused=/already running/.test(error.message); }
  ok(refused);
  eq((await first).doc.pages[0].name,'Landing page');
  eq((await readFigmaFile(file)).doc.pages[0].name,'Landing page','worker slot released after completion');
});
