import {db} from './db.js';
import {listVersions,loadVersionDoc,createFile,openFile,currentSaveFailure,fileHref} from './files.js';
import {recoveredDocument} from './recovery.js';
import {modal} from './libraries.js';
import {openRecovery} from './recovery-ui.js';
import {toast} from './io.js';

export async function copySavedVersion(fileId, versionId) {
  // Resolve membership again at action time; never trust a stale UI row.
  const versions=await listVersions(fileId);
  if(!versions.some(version=>version.id===versionId))throw new Error('This saved version is no longer available.');
  const doc=await loadVersionDoc(versionId);
  if(!doc)throw new Error('This saved version has no readable document. Try another version or a backup.');
  return createFile(recoveredDocument({doc}),{}, {projectId:null});
}

export async function openSavedFileRecovery(fileId) {
  if(document.querySelector('[data-saved-file-recovery]'))return;
  const meta=await db.get('files',fileId);
  if(!meta)return toast('That file could not be found.');
  const wrap=modal('Recover saved file','<p data-saved-file-name></p><p>Copy a readable saved version into Drafts. The original file and its history stay unchanged. Unsaved recovery may contain newer edits; an independent project backup may also help.</p><div data-saved-version-list role="status">Loading saved versions…</div>','<button class="btn" data-unsaved-recovery>Unsaved recovery…</button><button class="btn" data-close>Close</button>');
  wrap.dataset.savedFileRecovery='';wrap.querySelector('[data-saved-file-name]').textContent=meta.name||'Untitled';
  wrap.querySelector('[data-unsaved-recovery]').onclick=()=>{wrap.remove();openRecovery({fileId});};
  const list=wrap.querySelector('[data-saved-version-list]');
  try {
    const versions=await listVersions(fileId);list.textContent='';
    if(!versions.length)list.textContent='No saved versions are available. Check unsaved recovery or restore an independent project backup.';
    for(const version of versions) {
      const row=document.createElement('article');row.className='recovery-entry';
      const title=document.createElement('strong');title.textContent=version.title||version.name||'Saved version';
      const date=document.createElement('p');date.className='muted';date.textContent=Number.isFinite(version.createdAt)?new Date(version.createdAt).toLocaleString():'Unknown date';
      const button=document.createElement('button');button.className='btn';button.textContent='Copy to Drafts';
      const result=document.createElement('p');result.setAttribute('role','status');
      button.onclick=async()=>{
        button.disabled=true;
        try {
          const id=await copySavedVersion(fileId,version.id);
          if(currentSaveFailure()){
            result.textContent='Copy saved. Your unsaved original remains open. ';
            const link=document.createElement('a');link.href=fileHref(id);link.target='_blank';link.rel='noopener';link.textContent='Open copy in a new tab';result.append(link);
            button.textContent='Copy saved';return;
          }
          wrap.remove();openFile(id);toast('Saved version copied into Drafts. The original is unchanged.');
        }catch(error){result.textContent=error.message;button.disabled=false;}
      };
      row.append(title,date,button,result);list.append(row);
    }
  }catch(error){list.textContent=`Saved history is unavailable: ${error.message}`;}
}
