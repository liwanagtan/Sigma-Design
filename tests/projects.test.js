import {test,eq,ok} from './harness.js';
import {db} from '../src/db.js';
import {createFile,loadFile,deleteFile,duplicateFile,newTokenDocument,newIconsDocument} from '../src/files.js';
import {initializeProjects,projectList,createProject,setProjectIcon,updateProjectDetails,moveDrafts,inScope,selectProject,selectedProjectId,SIGMA_PROJECT,OPTICS_PROJECT} from '../src/projects.js';
import {blankDocument} from '../src/sample.js';
import {guideHTML,GUIDE_CHAPTERS} from '../src/welcome-guide.js';

test('projects: migration is idempotent and metadata-only, with built-ins and no personal project',async()=> {
  const before=selectedProjectId();selectProject(null,{notify:false});
  const id=await createFile(blankDocument(),{}, {optics:1});
  try {
    const file=await loadFile(id);await db.put('files',{...file.meta,projectId:undefined});
    await initializeProjects();await initializeProjects();
    eq((await loadFile(id)).meta.projectId,OPTICS_PROJECT);
    eq((await loadFile(id)).doc,file.doc);
    const ps=await projectList();eq(ps.filter(p=>p.id===SIGMA_PROJECT).length,1);eq(ps.filter(p=>p.id===OPTICS_PROJECT).length,1);
    ok(!ps.some(p=>p.name==='My Project'));
  }finally {await deleteFile(id);selectProject(before,{notify:false});}
});
test('projects: Drafts move atomically, preserve links and history, and creation follows the selected project',async()=> {
  const before=selectedProjectId();selectProject(null,{notify:false});
  const projectId=await createProject('Project test '+crypto.randomUUID());
  const id=await createFile(blankDocument());let extra;
  try {
    const file=await loadFile(id);ok(inScope(file.meta));
    await db.putVersion({id:'project-history-'+id,fileId:id},file.doc);
    eq(await moveDrafts([id],projectId),1);
    const moved=await loadFile(id);eq(moved.meta.id,id);eq(moved.doc,file.doc);eq(moved.meta.projectId,projectId);ok(!inScope(moved.meta));
    eq((await db.versionsOf(id)).length,1);
    selectProject(projectId,{notify:false});extra=await createFile(blankDocument());eq((await loadFile(extra)).meta.projectId,projectId);
    let rejected=false;try{await moveDrafts([id,'missing'],SIGMA_PROJECT);}catch{rejected=true;}ok(rejected);eq((await loadFile(id)).meta.projectId,projectId);
    const copy=await duplicateFile(id);try{eq((await loadFile(copy)).meta.projectId,projectId);}finally{await deleteFile(copy);}
  }finally{await deleteFile(id);if(extra)await deleteFile(extra);selectProject(before,{notify:false});await db.delete('projects',projectId);}
});
test('projects: names are validated and scope preferences remain independent of document links',async()=> {
  const id=await createProject('Unique project '+crypto.randomUUID());const p=(await projectList()).find(p=>p.id===id);
  for(const name of ['',p.name.toUpperCase(),'Drafts']){let bad=false;try{await createProject(name);}catch{bad=true;}ok(bad);}
  await db.delete('projects',id);
});
test('projects: icons persist across initialization and reject invalid values without changing ownership',async()=>{
  const id=await createProject('Icon test '+crypto.randomUUID());
  try{
    await setProjectIcon(id,{type:'emoji',value:'👩🏽‍🎨'});await initializeProjects();eq((await db.get('projects',id)).icon,{type:'emoji',value:'👩🏽‍🎨'});
    await setProjectIcon(id,{type:'glyph',value:'ellipse'});eq((await db.get('projects',id)).icon.value,'ellipse');
    for(const icon of [{type:'emoji',value:'text'},{type:'emoji',value:'🚀🎨'},{type:'glyph',value:'<svg>'}]){let bad=false;try{await setProjectIcon(id,icon);}catch{bad=true;}ok(bad);}
    await updateProjectDetails(id,{description:'A project description',cover:'data:image/png;base64,aGVsbG8='});await initializeProjects();eq((await db.get('projects',id)).description,'A project description');ok((await db.get('projects',id)).cover);await updateProjectDetails(id,{cover:null});eq((await db.get('projects',id)).cover,null);
    eq((await db.get('projects',id)).icon.value,'ellipse');await setProjectIcon(id,null);eq((await db.get('projects',id)).icon,null);
  }finally{await db.delete('projects',id);}
});
test('Welcome Guide: chapters are documentation with stable example links, not file cards',()=> {
  eq(GUIDE_CHAPTERS.length,10);
  const text=guideHTML('projects');ok(text.includes('Drafts'));ok(text.includes('Move to project'));ok(!text.includes('file-card'));
  ok(guideHTML('tokens').includes('sigma:tokens'));
});

test('projects Home: selector, scoped cards, creation dialog and documentation replace the Welcome file section',async()=> {
  const {initHome,renderHome,showHomeSection,reportFiles}=await import('../src/home.js');
  const before=selectedProjectId(),prefs=localStorage.getItem('sigma.home.prefs'),hash=location.hash;
  const el=document.createElement('div');document.body.append(el);
  const p=await createProject('Home scope '+crypto.randomUUID());selectProject(null,{notify:false});
  const draft=await createFile(blankDocument()),tokenDraft=await createFile(newTokenDocument()),iconDraft=await createFile(newIconsDocument());selectProject(p,{notify:false});const file=await createFile(blankDocument());
  let created,createdDraft;
  try {
    initHome(el);showHomeSection('design');await renderHome();
    ok(!el.querySelector('#project-select'));ok(el.querySelector(`[data-project-id="${p}"]`).matches('[aria-current=true]'));ok(!el.querySelector('#home-project').textContent.includes('Drafts'));eq(el.querySelector('[data-section=recents]').nextElementSibling.dataset.section,'drafts');ok(el.querySelector('.home-side').lastElementChild.matches('[data-section=welcome]'));ok(el.querySelector(`[data-id="${file}"]`));ok(!el.querySelector(`[data-id="${draft}"]`));
    ok(el.querySelector('[data-file-group=design]'));ok(el.querySelector('.home-side #home-search'));ok(el.querySelector('.home-side #home-create'));ok(!el.querySelector('[data-section=tokens]'));ok(el.querySelector('.home-header [aria-label="Project title"]'));ok(el.querySelector('.home-header #home-sort'));ok(el.querySelector('.home-header .home-layout'));ok(el.querySelector('#project-header-icon').nextElementSibling.id==='home-title');ok(!el.querySelector('#project-overview')); 
    ok(!el.querySelector('.home-header #home-report').hidden);eq((await reportFiles()).map(f=>f.id),[file]);showHomeSection('report');await renderHome();ok(el.querySelector('.report'));ok(el.querySelector('#home-title').textContent.includes('Report'));ok(el.querySelector('#home-report').textContent.includes('Go back to Files'));
    el.querySelector('[data-report-handoff]').click();
    for(let i=0;i<100&&!el.querySelector('[data-report-handoff]')?.checked;i++)await new Promise(r=>setTimeout(r,10));
    ok(el.querySelector('[data-report-handoff]').checked,'Home must not cancel report checkbox clicks');
    ok(el.querySelector('.report-empty').textContent.includes('No pages match'));
    showHomeSection('workspace');await renderHome();
    const description=el.querySelector('#project-description');ok(!el.querySelector('#project-description-area').hidden);description.value='Saved from the project page';description.dispatchEvent(new Event('change'));for(let i=0;i<50&&(await db.get('projects',p)).description!==description.value;i++)await new Promise(r=>setTimeout(r,10));eq((await db.get('projects',p)).description,'Saved from the project page');await renderHome();eq(el.querySelector('#project-description').value,'Saved from the project page');
    const search=el.querySelector('#home-search');search.value=(await loadFile(draft)).meta.name;search.dispatchEvent(new Event('input'));for(let i=0;i<50&&!el.querySelector(`[data-id="${draft}"]`);i++)await new Promise(r=>setTimeout(r,10));ok(el.querySelector(`[data-id="${draft}"]`));search.value='';search.dispatchEvent(new Event('input'));await renderHome();
    el.querySelector(`[data-project-icon="${p}"]`).click();
    const picker=document.querySelector('.modal-backdrop');ok(picker.querySelector('[data-emoji]'));picker.querySelector('[data-emoji="🚀"]').click();
    for(let i=0;i<100&&document.body.contains(picker);i++)await new Promise(r=>setTimeout(r,10));
    eq((await db.get('projects',p)).icon,{type:'emoji',value:'🚀'});await renderHome();ok(el.querySelector(`[data-project-icon="${p}"]`).textContent.includes('🚀'));
    el.querySelector('[data-new-project]').click();
    const wrap=document.querySelector('.modal-backdrop');ok(wrap);
    const name='Created through dialog '+crypto.randomUUID();wrap.querySelector('input').value=name;wrap.querySelector('[data-create-project]').click();
    for(let i=0;i<100;i++){created=(await projectList()).find(x=>x.name===name)?.id;if(created&&!document.body.contains(wrap))break;await new Promise(r=>setTimeout(r,10));}
    ok(created);eq(selectedProjectId(),created);
    selectProject(null,{notify:false});showHomeSection('drafts');await renderHome();ok(el.querySelector(`[data-id="${draft}"]`));ok(!el.querySelector(`[data-id="${file}"]`));eq(el.querySelector('#home-title').textContent,'Drafts');ok(el.querySelector(`[data-id="${tokenDraft}"]`));ok(el.querySelector(`[data-id="${iconDraft}"]`));
    selectProject(null,{notify:false});showHomeSection('recents');await renderHome();ok(el.querySelector(`[data-id="${file}"]`));ok(el.querySelector(`[data-id="${draft}"]`));const existing=new Set((await db.getAll('files')).map(f=>f.id));el.querySelector('#home-create').click();[...document.querySelectorAll('.menu-item')].find(b=>b.textContent.includes('Tokens file')).click();for(let i=0;i<100;i++){createdDraft=(await db.getAll('files')).find(f=>!existing.has(f.id)&&f.kind==='tokens')?.id;if(createdDraft)break;await new Promise(r=>setTimeout(r,10));}ok(createdDraft);eq((await loadFile(createdDraft)).meta.projectId,null);
    showHomeSection('welcome');await renderHome();ok(el.querySelector('.welcome-docs article'));ok(!el.querySelector('.file-card'));eq(el.querySelector('#home-title').textContent,'Documentation');
  }finally{
    el.hidden=true;el.remove();if(createdDraft)await deleteFile(createdDraft);await deleteFile(file);await deleteFile(draft);await deleteFile(tokenDraft);await deleteFile(iconDraft);await db.delete('projects',p);if(created)await db.delete('projects',created);
    selectProject(before,{notify:false});if(prefs===null)localStorage.removeItem('sigma.home.prefs');else localStorage.setItem('sigma.home.prefs',prefs);location.hash=hash;
  }
});
