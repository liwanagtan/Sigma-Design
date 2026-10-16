import {recoveryEntries,recoveredDocument,removeRecovery} from './recovery.js';
import {createFile,openFile,currentSaveFailure,fileHref} from './files.js';
import {modal} from './libraries.js';
import {download,toast} from './io.js';
import {ask} from './dialogs.js';
import {inspectImportedData} from './document-safety.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function createRecoveredCopy(entry) {
  const doc=recoveredDocument(entry.record);
  // Validate views as part of the same import boundary, not arbitrary storage object data.
  const views=entry.record.views&&typeof entry.record.views==='object'?structuredClone(entry.record.views):{};
  inspectImportedData(views);
  for(const view of Object.values(views))if(!view||typeof view!=='object'||Object.values(view).some(value=>typeof value!=='number'||!Number.isFinite(value)))throw new Error('Recovery has invalid viewport data.');
  const id=await createFile(doc,views,{projectId:null});
  return id; // retain the recovery until explicitly discarded; another tab may still be using it
}

export function openRecovery({fileId=null}={}) {
  if(document.querySelector('[data-recovery-dialog]'))return;
  let entries;
  try{entries=recoveryEntries(localStorage,{fileId});}catch{return toast('Recovery storage is unavailable. Keep current edits by downloading the file.');}
  const wrap=modal('Recover unsaved edits',`<p>Each entry belongs to one file and editing session. Open a recovered copy in Drafts to keep it without replacing saved work. Recovery storage is limited; download important work or use a project backup.</p><div data-recovery-list></div>`,'<button class="btn" data-close>Close</button>');
  wrap.dataset.recoveryDialog='';
  const list=wrap.querySelector('[data-recovery-list]');
  const render=()=>{list.innerHTML=entries.length?entries.map((entry,i)=>{
    const record=entry.record,date=record?.t&&Number.isFinite(record.t)?new Date(record.t).toLocaleString():'Unknown time';
    return `<article class="recovery-entry"><strong>${esc(record?.name||record?.doc?.name||'Unreadable recovery')}</strong><p class="muted">${esc(date)}</p><div><button class="btn" data-recover="${i}" ${record?'':'disabled'}>Open recovered copy</button> <button class="btn" data-download-recovery="${i}">Download recovery</button> <button class="btn" data-discard-recovery="${i}">Discard…</button></div><p role="status" data-recovery-result="${i}"></p></article>`;
  }).join(''):'<p role="status">No unsaved recovery entries were found.</p>';};render();
  wrap.addEventListener('click',async event=>{
    const button=event.target.closest('[data-recover],[data-download-recovery],[data-discard-recovery]');if(!button)return;
    const index=Number(button.dataset.recover??button.dataset.downloadRecovery??button.dataset.discardRecovery),entry=entries[index];if(!entry)return;
    const result=list.querySelector(`[data-recovery-result="${index}"]`);button.disabled=true;
    try {
      if(button.hasAttribute('data-recover')){
        const id=await createRecoveredCopy(entry);
        if(currentSaveFailure()){
          result.textContent='Recovered copy saved in Drafts. Your unsaved original remains open. ';
          const link=document.createElement('a');link.href=fileHref(id);link.target='_blank';link.rel='noopener';link.textContent='Open recovered copy in a new tab';result.append(link);
          button.dataset.saved='true';button.textContent='Copy saved';
        }else{wrap.querySelector('[data-close]').click();openFile(id);toast('Recovered edits opened as a new Draft. The original is unchanged.');}
      }else if(button.hasAttribute('data-download-recovery')){
        let text=entry.raw,name='Sigma-recovery-record.json';
        if(entry.record)try{text=JSON.stringify(recoveredDocument(entry.record));name='Sigma-recovered.sigma.json';}catch{}
        download(new Blob([text||''],{type:'application/json'}),name);
      }else{
        const expected=entry.raw;
        if(!await ask('Discard this recovery entry permanently? Save a recovered copy or download it first.',{title:'Discard recovered edits',ok:'Discard recovery',danger:true}))return;
        if(!removeRecovery(localStorage,entry.key,expected))throw new Error('This recovery changed in another tab. Close and reopen the recovery list.');
        entries=entries.filter(e=>e!==entry);render();window.dispatchEvent(new CustomEvent('sigma:recovery'));
      }
    }catch(error){if(result?.isConnected)result.textContent=error.message;}
    finally{if(button.isConnected&&!button.dataset.saved)button.disabled=false;}
  });
}
