import {db} from './db.js';
import {buildProjectBackup,prepareProjectRestore,MAX_BACKUP_BYTES} from './project-backup.js';
import {download,toast} from './io.js';
import {ask} from './dialogs.js';
import {scopeHref,notifyProjectsChanged} from './projects.js';

export async function downloadProjectBackup(projectId) {
  try {
    toast('Preparing project backup, including archive, dependencies and history…');
    const backup=buildProjectBackup(await db.backupProject(projectId));
    const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});
    if(blob.size>MAX_BACKUP_BYTES)throw new Error('Backup exceeds 256 MiB. Reduce retained history or artwork before retrying.');
    download(blob,`${backup.project.name.replace(/[^\p{L}\p{N}_-]+/gu,'-')}.sigma-backup.json`);
    toast(`Backed up ${backup.files.length} files${backup.missingDependencies.length?' · some linked source files are unavailable; embedded snapshots are retained':''}.`);
  }catch(error){toast(`Could not back up: ${error.message}`);}
}

export function pickProjectBackup() {
  const input=document.createElement('input');input.type='file';input.accept='.sigma-backup.json,application/json';
  input.hidden=true;document.body.append(input);
  input.oncancel=()=>input.remove();
  input.onchange=async()=>{
    const file=input.files?.[0];if(!file){input.remove();return;}
    try {
      if(file.size>MAX_BACKUP_BYTES)throw new Error('Project backups must be no larger than 256 MiB.');
      const prepared=prepareProjectRestore(JSON.parse(await file.text()));
      const history=prepared.files.reduce((sum,f)=>sum+f.versions.length,0);
      if(!await ask(`Restore ${prepared.files.length} files and ${history} historical version${history===1?'':'s'} into a new project? Existing projects will stay unchanged.${prepared.missingDependencies.length?' Some original linked source files were unavailable; saved snapshots remain included.':''}`,{title:'Restore project backup',ok:'Restore as new project'}))return;
      const id=await db.restoreProject(prepared);
      notifyProjectsChanged();
      location.hash=scopeHref('workspace',id);toast('Backup restored into a new editable project.');
    }catch(error){toast(`Could not restore: ${error.message}`);}
    finally{input.remove();}
  };
  input.click();
}
