import { MAX_FIG_BYTES, FIG_TRANSFER_VERSION, decodeFigmaResult, figmaImportError } from './figma-import-transfer.js';
let active=false;
// Binary decoding and input allocation happen off the UI thread.
export async function readFigmaFile(file) {
  if(file.size > MAX_FIG_BYTES) throw new Error('Figma import accepts input files up to 128 MB; expanded designs must also fit the import memory budget.');
  if(active) throw new Error('A Figma import is already running. Wait for it to finish before importing another file.');
  active=true;
  const name=file.name.replace(/\.fig$/i,'') || 'Imported Figma';
  return new Promise((resolve,reject)=> {
    const workerURL=new URL('./figma-import-worker.js',import.meta.url);
    workerURL.searchParams.set('protocol',FIG_TRANSFER_VERSION);
    const worker=new Worker(workerURL,{type:'module'});
    let settled=false;
    const finish=(error,result)=> { if(settled)return; settled=true; clearTimeout(timer);worker.terminate(); error ? reject(error) : resolve(result); };
    const timer=setTimeout(()=>finish(new Error('The .fig import timed out. Try exporting fewer pages.')),120000);
    worker.onmessage=event=> {
      // Release worker-held binary/schema/bitmap data before allocating the UI graph.
      worker.terminate();
      if(event.data.error) return finish(new Error(event.data.error));
      try { finish(null,decodeFigmaResult(event.data.chunks)); }
      catch(error) { finish(new Error(figmaImportError(error))); }
    };
    worker.onerror=()=>finish(new Error('The Figma importer stopped before finishing. The file may exceed available memory; try exporting fewer pages.'));
    worker.onmessageerror=()=>finish(new Error('The Figma import result could not be transferred. Try exporting fewer pages.'));
    try { worker.postMessage({file,name,protocol:FIG_TRANSFER_VERSION}); }
    catch(error) {finish(new Error(figmaImportError(error)));}
  }).finally(()=> {active=false;});
}
