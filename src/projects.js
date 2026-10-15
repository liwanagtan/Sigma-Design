import {db} from './db.js';
import {validateProjectIcon} from './project-icons.js';
export const SIGMA_PROJECT='project-sigma', OPTICS_PROJECT='project-optics';
const KEY='sigma.selectedScope';
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('sigma.projects'):null;
channel?.unref?.();
channel?.addEventListener('message',()=>window.dispatchEvent(new CustomEvent('sigma:projects')));
const changed=()=>{window.dispatchEvent(new CustomEvent('sigma:projects'));channel?.postMessage({changed:true});};
let active=null,hasPreference=false;
try {const saved=sessionStorage.getItem(KEY);hasPreference=saved!==null;active=JSON.parse(saved||'null');}catch{}
export const selectedProjectId=()=>active;
export const inScope=(file,id=active)=>(file.projectId||null)===(id||null);
export function selectProject(id,{notify=true}={}) {
  active=id||null;hasPreference=true;
  try{sessionStorage.setItem(KEY,JSON.stringify(active));}catch{}
  if(notify) window.dispatchEvent(new CustomEvent('sigma:scope'));
}
let knownProjects=[];
export const projectList=async()=>{knownProjects=(await db.getAll('projects')).filter(p=>p.kind!=='migration'&&p.kind!=='alias');return knownProjects;};
export const selectedProject=()=>knownProjects.find(p=>p.id===active)||null;
export function ownerFor(meta) {
  if(meta.projectId!==undefined)return meta.projectId||null;
  if(meta.optics)return OPTICS_PROJECT;
  if(meta.sample||meta.welcome||meta.sampleLegacy)return SIGMA_PROJECT;
  if(meta.project)return meta.project.identity||`repository-legacy-${encodeURIComponent(meta.project.name)}`;
  return active;
}
export async function initializeProjects(repository) {
  const time=Date.now();
  await db.projectUpdate((projects,files)=> {
    const builtins=[{id:SIGMA_PROJECT,name:'Sigma',description:'The design system behind Sigma’s interface: tokens, icons, and components.',kind:'builtin',source:'sigma',createdAt:time,updatedAt:time},{id:OPTICS_PROJECT,name:'Optics',description:'A sample design system inspired by Polaris, with reusable components, tokens, and icons.',kind:'builtin',source:'optics',createdAt:time,updatedAt:time}];
    const known=new Map(projects.map(p=>[p.id,p]));
    for(const p of builtins){if(!known.has(p.id))known.set(p.id,p);else if(known.get(p.id).description===undefined)known.set(p.id,{...known.get(p.id),description:p.description});}
    if(known.get(SIGMA_PROJECT)?.description==='The design system behind Sigma’s interface: tokens, foundations, components, icons, and example pages.')known.set(SIGMA_PROJECT,{...known.get(SIGMA_PROJECT),description:builtins[0].description});
    if(repository?.name) {
      const id=repository.identity||`repository-legacy-${encodeURIComponent(repository.name)}`;
      known.set(id,{...known.get(id),id,name:known.get(id)?.name||repository.name,kind:'repository',source:repository.identity||repository.name,createdAt:known.get(id)?.createdAt||time,updatedAt:time});
    }
    const changed=[];
    for(const f of files) {
      let id=f.projectId;
      if(id===undefined)id=f.optics?OPTICS_PROJECT:(f.sample||f.welcome||f.sampleLegacy)?SIGMA_PROJECT:f.project?(f.project.identity||(repository?.name===f.project.name?repository.identity:null)||`repository-legacy-${encodeURIComponent(f.project.name)}`):null;
      const upgrading=f.project&&repository?.name===f.project.name&&(!f.project.identity||f.project.identity.startsWith('repository-legacy-'))&&repository.identity;
      if(upgrading)id=repository.identity;
      if(f.project&&!id)id=f.project.identity||(repository?.name===f.project.name?repository.identity:null)||`repository-legacy-${encodeURIComponent(f.project.name)}`;
      if(f.project&&!known.has(id))known.set(id,{id,name:f.project.name,kind:'repository',source:f.project.identity||f.project.name,createdAt:time,updatedAt:time});
      const exampleKey=f.exampleKey||(f.welcome?'sigma:guide-examples':f.sigmaPages?'sigma:pages-and-ui':f.sampleIcons?'sigma:icons':f.sigmaSystem?`sigma:${f.kind==='tokens'?'tokens':f.name.toLowerCase()}`:undefined);
      if(f.projectId!==id||exampleKey!==f.exampleKey||upgrading&&f.project.identity!==id)changed.push({...f,projectId:id,...(upgrading?{project:{...f.project,identity:id}}:{}),...(exampleKey?{exampleKey}:{}),...(f.welcome?{name:'Guide examples'}:{})});
    }
    if(repository?.identity&&!repository.identity.startsWith('repository-legacy-'))for(const p of known.values())if(p.kind==='repository'&&p.id.startsWith('repository-legacy-')&&p.name===repository.name)known.set(p.id,{...p,kind:'alias',aliasTo:repository.identity});
    known.set('migration-projects-v1',{id:'migration-projects-v1',kind:'migration',version:1,completedAt:known.get('migration-projects-v1')?.completedAt||time});
    return {projects:[...known.values()],files:changed};
  });
  const available=await projectList();
  if(active){const record=await db.get('projects',active);if(record?.aliasTo)selectProject(record.aliasTo,{notify:false});}
  if(!hasPreference&&repository?.name)selectProject(repository.identity||`repository-legacy-${encodeURIComponent(repository.name)}`,{notify:false});
  if(active&&!available.some(p=>p.id===active))selectProject(null,{notify:false});
}
export async function createProject(name) {
  name=String(name||'').trim();if(!name)throw new Error('Enter a project name.');
  if(name.toLowerCase()==='drafts')throw new Error('Drafts is reserved for files without a project.');
  const id=`project-${crypto.randomUUID()}`,time=Date.now();
  await db.projectUpdate((projects)=> {
    if(projects.some(p=>p.kind!=='alias'&&p.name?.toLowerCase()===name.toLowerCase()))throw new Error('A project with this name already exists.');
    return {projects:[{id,name,kind:'user',createdAt:time,updatedAt:time}]};
  });
  changed();
  return id;
}
export async function moveDrafts(ids,destination) {
  return db.projectUpdate((projects,files)=> {
    const target=projects.find(p=>p.id===destination);
    if(!target||target.kind==='repository')throw new Error('Choose a user project.');
    const selected=ids.map(id=>files.find(f=>f.id===id));
    if(!selected.length||selected.some(f=>!f||f.projectId||f.project||f.archivedAt||f.sample||f.welcome))throw new Error('Only active Drafts can be moved to this project.');
    return {files:selected.map(f=>({...f,projectId:destination})),result:selected.length};
  }).then(n=>{changed();return n;});
}
export const scopeHref=(section='recents',id=active)=>id?`#/project/${encodeURIComponent(id)}/${section}`:`#/drafts/${section}`;

export async function resolveProjectId(id){return (await db.get('projects',id))?.aliasTo||id;}

export async function setProjectIcon(id,icon) {
  icon=validateProjectIcon(icon);
  await db.projectUpdate(projects=>{
    const p=projects.find(p=>p.id===id&&p.kind!=='migration'&&p.kind!=='alias');
    if(!p)throw new Error('This project is unavailable.');
    return {projects:[{...p,icon,updatedAt:Date.now()}]};
  });
  await projectList();changed();
}

export async function updateProjectDetails(id,patch) {
  await db.projectUpdate(projects=>{
    const p=projects.find(p=>p.id===id&&p.kind!=='migration'&&p.kind!=='alias');
    if(!p)throw new Error('This project is unavailable.');
    const next={...p,updatedAt:Date.now()};
    if(patch.name!==undefined){const name=String(patch.name).trim();if(!name||name.length>100||name.toLowerCase()==='drafts')throw new Error('Enter a project name of up to 100 characters.');if(projects.some(x=>x.id!==id&&x.kind!=='alias'&&x.name?.toLowerCase()===name.toLowerCase()))throw new Error('A project with this name already exists.');next.name=name;}
    if(patch.description!==undefined)next.description=String(patch.description).slice(0,2000);
    if(patch.cover!==undefined){if(patch.cover!==null&&(!/^data:image\/(jpeg|png|webp);base64,/.test(patch.cover)||patch.cover.length>3000000))throw new Error('Choose a smaller image.');next.cover=patch.cover;}
    return {projects:[next]};
  });await projectList();changed();
}
export async function recordFileOpened(id){await db.projectUpdate((projects,files)=>({files:files.filter(f=>f.id===id).map(f=>({...f,openedAt:Date.now()}))}));}
