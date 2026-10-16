// Portable browser-project backup. Restore always creates new ownership/file identities.
import {serializeDocument,deserializeDocument} from './document-storage.js';
import {prepareImportedDocument,inspectImportedData} from './document-safety.js';
import {validateProjectIcon} from './project-icons.js';
export const BACKUP_FORMAT='sigma-project-backup';
export const MAX_BACKUP_BYTES=256*1024*1024;

export function linkedFileIds(doc) {
  const ids=new Set();
  function visit(value) {
    if(!value||typeof value!=='object')return;
    if(typeof value.fileId==='string')ids.add(value.fileId);
    if(value.branch?.of)ids.add(value.branch.of);
    for(const child of Object.values(value))visit(child);
  }
  visit(doc);return ids;
}

export function buildProjectBackup(snapshot) {
  return {format:BACKUP_FORMAT,version:1,createdAt:new Date().toISOString(),project:snapshot.project,
    missingDependencies:snapshot.missingDependencies||[],files:snapshot.files.map(({meta,doc,views,versions})=>({
      meta,document:serializeDocument(doc),views:views||{},
      versions:versions.map(({record,doc})=>({record,document:serializeDocument(doc)})),
    }))};
}

export function prepareProjectRestore(bundle, makeId=()=>crypto.randomUUID()) {
  if(bundle?.format!==BACKUP_FORMAT||bundle.version!==1)throw new Error('Unsupported Sigma project backup format/version.');
  if(!Array.isArray(bundle.files)||bundle.files.length>10000)throw new Error('Backup must contain up to 10,000 files.');
  if(!bundle.project||typeof bundle.project.name!=='string')throw new Error('Backup project name is missing.');
  const ids=new Map(),unavailable=new Map(),versionIds=new Set();let versionCount=0;
  const projectId='project-'+makeId();
  for(const f of bundle.files){
    if(!f?.meta||typeof f.meta.id!=='string'||ids.has(f.meta.id))throw new Error('Backup has missing or duplicate file IDs.');
    ids.set(f.meta.id,makeId());
  }
  function remap(value) {
    if(!value||typeof value!=='object')return;
    const target=id=>{if(ids.has(id))return ids.get(id);if(!unavailable.has(id))unavailable.set(id,'unavailable-'+makeId());return unavailable.get(id);};
    if(typeof value.fileId==='string')value.fileId=target(value.fileId);
    if(typeof value.branch?.of==='string')value.branch.of=target(value.branch.of);
    for(const [key,child]of Object.entries(value)) {
      if(key==='uses'&&child&&typeof child==='object')for(const paths of Object.values(child))if(Array.isArray(paths))for(let i=0;i<paths.length;i++)if(typeof paths[i]==='string'&&paths[i].startsWith('id:'))paths[i]='id:'+target(paths[i].slice(3));
      remap(child);
    }
  }
  function document(text) {
    if(typeof text!=='string')throw new Error('Backup document is missing.');
    const doc=prepareImportedDocument(deserializeDocument(text));
    // Restored files are browser-owned, never attached to a repository or a generated sample.
    delete doc.project;remap(doc);return doc;
  }
  const files=bundle.files.map(f=>{
    const doc=document(f.document),id=ids.get(f.meta.id),meta={id,projectId,name:String(doc.name||f.meta.name||'Untitled'),kind:doc.kind==='tokens'||doc.kind==='icons'?doc.kind:'design',docRevision:0};
    for(const key of ['createdAt','updatedAt','openedAt','archivedAt','lastVersionAt','tokenVersion','componentVersion'])if(typeof f.meta[key]==='number'&&Number.isFinite(f.meta[key]))meta[key]=f.meta[key];
    meta.createdAt??=Date.now();meta.updatedAt??=meta.createdAt;
    if(!Array.isArray(f.versions))throw new Error('Backup versions must be a list.');
    const versions=f.versions.map(v=>{
      if(++versionCount>100000||!v.record||typeof v.record.id!=='string'||versionIds.has(v.record.id)||v.record.fileId!==f.meta.id)throw new Error('Backup contains invalid or duplicate version records.');
      versionIds.add(v.record.id);
      return {record:{id:makeId(),fileId:id,kind:['auto','named','publish'].includes(v.record.kind)?v.record.kind:'named',title:String(v.record.title||''),description:String(v.record.description||''),createdAt:Number(v.record.createdAt)||Date.now(),name:String(v.record.name||meta.name)},doc:document(v.document)};
    });
    const views=structuredClone(f.views||{});inspectImportedData(views);
    return {meta,doc,views,versions};
  });
  if(bundle.missingDependencies!==undefined&&(!Array.isArray(bundle.missingDependencies)||bundle.missingDependencies.some(id=>typeof id!=='string')))throw new Error('Invalid backup dependency report.');
  return {project:{id:projectId,kind:'user',name:bundle.project.name.slice(0,100)||'Restored project',description:String(bundle.project.description||'').slice(0,2000),icon:validateProjectIcon(bundle.project.icon||null),createdAt:Date.now(),updatedAt:Date.now()},files,missingDependencies:[...new Set([...(bundle.missingDependencies||[]),...unavailable.keys()])]};
}
