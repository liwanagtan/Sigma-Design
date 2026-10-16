import {test,eq,ok} from './harness.js';
import {db} from '../src/db.js';
import {createFile,archiveFile,saveNamedVersion} from '../src/files.js';
import {createProject} from '../src/projects.js';
import {buildProjectBackup,prepareProjectRestore} from '../src/project-backup.js';
const doc=name=>({name,pages:[{id:'page',children:[]}],currentPageId:'page'});

test('project backup: includes archived files, historical dependencies, and restores as an independent project',async()=>{
  const projectId=await createProject('Backup fixture '+crypto.randomUUID());const created=[];let restored;
  try{
    const tokens=await createFile({...doc('External tokens'),kind:'tokens',variables:{collections:[]}},{},{projectId:null});created.push(tokens);
    const design=await createFile({...doc('Design'),libraries:[{fileId:tokens,collections:[]}]},{},{projectId});created.push(design);
    await saveNamedVersion(design,'Named version');await archiveFile(design);
    const bundle=buildProjectBackup(await db.backupProject(projectId));eq(bundle.files.length,2);eq(bundle.files.find(f=>f.meta.id===design).versions.length,1);
    restored=prepareProjectRestore(bundle);await db.restoreProject(restored);
    const copied=restored.files.find(f=>f.doc.name==='Design'),library=restored.files.find(f=>f.doc.kind==='tokens');
    ok(copied.meta.id!==design);ok((await db.get('files',copied.meta.id)).archivedAt);
    eq((await db.get('docs',copied.meta.id)).doc.libraries[0].fileId,library.meta.id);
    eq((await db.versionsOf(copied.meta.id)).length,1);ok(await db.get('docs',design));
    const repeat=prepareProjectRestore(bundle);await db.restoreProject(repeat);for(const f of repeat.files)created.push(f.meta.id);await db.delete('projects',repeat.project.id);
    ok(repeat.project.name!==restored.project.name);
  }finally{for(const id of [...created,...(restored?.files||[]).map(f=>f.meta.id)])await db.deleteFile(id);await db.delete('projects',projectId);if(restored)await db.delete('projects',restored.project.id);}
});

test('project backup: ID collisions abort the entire restore without partial projects/files',async()=>{
  const id=await createFile(doc('Collision fixture'),{},{projectId:null});let projectId;
  try{
    const bundle=buildProjectBackup(await db.backupProject(null));
    // Use a single fixture so unrelated Drafts are never restored by this test.
    bundle.files=bundle.files.filter(f=>f.meta.id===id);
    const prepared=prepareProjectRestore(bundle);projectId=prepared.project.id;prepared.files[0].meta.id=id;prepared.files[0].versions=[];
    let failed=false;try{await db.restoreProject(prepared);}catch{failed=true;}ok(failed);
    eq(await db.get('projects',projectId),undefined);eq((await db.get('docs',id)).doc.name,'Collision fixture');
  }finally{await db.deleteFile(id);}
});

test('project backup: corrupt history is reported instead of producing an incomplete backup',async()=>{
  const projectId=await createProject('Corrupt backup fixture '+crypto.randomUUID());
  const id=await createFile(doc('Missing history fixture'),{},{projectId});
  try{
    const version=await saveNamedVersion(id,'Missing payload');await db.delete('docs','v:'+version.id);
    let message='';try{await db.backupProject(projectId);}catch(error){message=error.message;}
    ok(message.includes('historical document is missing'));
  }finally{await db.deleteFile(id);await db.delete('projects',projectId);}
});
