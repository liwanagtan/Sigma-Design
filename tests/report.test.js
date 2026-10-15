import {test,eq,ok} from './harness.js';
import {renderReportDashboard} from '../src/report-ui.js';
import {fileHref} from '../src/files.js';
const fixture=()=>[{id:'file',name:'Design <img src=x>',doc:{pages:[{id:'page',name:'Home',children:[{id:'node',type:'rect',name:'Card <svg onload=bad>',fills:[{color:'#fff'}]}]}]}}];
test('report UI: scope, findings, direct targets, search and filter controls remain usable',()=>{
  const host=document.createElement('div');document.body.append(host);const changes=[],opened=[];
  try{
    renderReportDashboard(host,fixture(),{projectName:'Project',onOpen:t=>opened.push(t),onChange:(patch,recompute)=>changes.push({patch,recompute})});
    ok(!host.querySelector('img'));ok(!host.querySelector('svg'));ok(host.textContent.includes('0%'));ok(host.textContent.includes('Values without tokens'));
    host.querySelector('[data-report-open-finding]').click();eq(opened[0].fileId,'file');eq(opened[0].pageId,'page');eq(opened[0].nodeId,'node');
    const input=host.querySelector('[data-report-search]');input.value='no match';input.dispatchEvent(new Event('input'));ok(host.querySelector('[data-report-files]').textContent.includes('No files match'));eq(document.activeElement===input,false);
    input.value='';input.dispatchEvent(new Event('input'));ok(host.querySelector('[data-report-open-finding]'));
    const kind=host.querySelector('[data-report-kind="color"]');kind.click();eq(host.querySelector('[data-report-findings]').value,'color');eq(kind.getAttribute('aria-pressed'),'true');ok(host.querySelector('[data-report-active-filters]').textContent.includes('Colors'));
    host.querySelector('[data-report-clear-details]').click();eq(host.querySelector('[data-report-findings]').value,'all');eq(kind.getAttribute('aria-pressed'),'false');eq(host.querySelector('[data-report-search]').value,'');
    host.querySelector('[data-report-reset-scope]').click();eq(changes.at(-1),{patch:{fileId:'',days:0,handoff:false,includeHidden:false,includeSamples:true},recompute:true});
    const handoff=host.querySelector('[data-report-handoff]');handoff.checked=true;handoff.dispatchEvent(new Event('change'));eq(changes.at(-1),{patch:{handoff:true},recompute:true});
  }finally{host.remove();}
});
test('report UI: empty scope distinguishes no data and keeps filters wired',()=>{
  const host=document.createElement('div');const changes=[];
  try{
    renderReportDashboard(host,fixture(),{options:{handoff:true},onChange:patch=>changes.push(patch)});
    ok(host.querySelector('.report-empty').textContent.includes('No pages match'));ok(host.querySelector('.report-cards').textContent.includes('—'));
    host.querySelector('[data-report-handoff]').dispatchEvent(new Event('change'));eq(changes.length,1);
    renderReportDashboard(host,[],{onChange:patch=>changes.push(patch)});ok(host.textContent.includes('No design files yet'));host.querySelector('[data-report-days]').dispatchEvent(new Event('change'));eq(changes.length,2);
  }finally{host.remove();}
});
test('report deep links retain file/page/layer/token identity and return scope',()=>{
  const hash=fileHref('file',{pageId:'page / one',nodeId:'node?&',tokenId:'token',reportProjectId:'project-sigma'});
  const params=new URLSearchParams(hash.split('?')[1]);eq(params.get('pageId'),'page / one');eq(params.get('nodeId'),'node?&');eq(params.get('tokenId'),'token');eq(params.get('report'),'project-sigma');eq(fileHref('file'),'#/file/file');
});
test('Proposals is discoverable and stays project-scoped when a repository is offline',async()=>{
  const {db}=await import('../src/db.js');
  const {initializeProjects,selectProject,selectedProjectId,SIGMA_PROJECT}=await import('../src/projects.js');
  const {project}=await import('../src/project.js');
  const {initHome,renderHome,showHomeSection}=await import('../src/home.js');
  const previous=selectedProjectId(),repository={connected:true,identity:'repository-report-test',name:'Report repository',files:[]};
  const oldProject={...project},hash=location.hash,pref=localStorage.getItem('sigma.home.prefs');
  const host=document.createElement('div');host.hidden=true;document.body.append(host);
  try{
    await initializeProjects(repository);Object.assign(project,{connected:false});selectProject(repository.identity,{notify:false});initHome(host);showHomeSection('workspace');await renderHome();
    ok(!host.querySelector('#home-proposals').hidden);showHomeSection('proposals');await renderHome();
    ok(host.querySelector('#home-files').textContent.includes('Repository offline'));ok(host.querySelector('#home-title').textContent.includes('Proposals'));ok(host.querySelector('#home-report').textContent.includes('Go back to Files'));
    selectProject(SIGMA_PROJECT,{notify:false});showHomeSection('workspace');await renderHome();ok(host.querySelector('#home-proposals').hidden);
  }finally{host.remove();for(const key of Object.keys(project))if(!(key in oldProject))delete project[key];Object.assign(project,oldProject);selectProject(previous,{notify:false});await db.delete('projects',repository.identity);if(pref===null)localStorage.removeItem('sigma.home.prefs');else localStorage.setItem('sigma.home.prefs',pref);location.hash=hash;}
});
test('report loading: unavailable designs fail explicitly; missing libraries remain visible warnings',async()=>{
  const {db}=await import('../src/db.js');
  const {initializeProjects,selectProject,selectedProjectId}=await import('../src/projects.js');
  const {project}=await import('../src/project.js');
  const {reportFiles,initHome,showHomeSection,renderHome}=await import('../src/home.js');
  const {useReport}=await import('../src/use-report.js');
  const before={...project},previous=selectedProjectId(),oldFetch=window.fetch,hash=location.hash,pref=localStorage.getItem('sigma.home.prefs');
  const identity='repository-report-errors',host=document.createElement('div');host.hidden=true;document.body.append(host);
  const design={path:'.sigma/design/good.sigma.json',name:'Measured design',kind:'design',mtime:'1000000'};
  let broken=true;
  try{
    Object.assign(project,{connected:true,identity,name:'Report errors',files:[design]});await initializeProjects(project);selectProject(identity,{notify:false});
    window.fetch=async(url,options)=>{
      if(!String(url).startsWith('/api/project/file?'))return oldFetch(url,options);
      const path=new URL(url,location.href).searchParams.get('path');
      if(broken||path!==design.path)return new Response('{}',{status:503});
      return new Response(JSON.stringify({format:1,kind:'design',name:'Measured design',uses:{tokens:['.sigma/tokens/missing.sigma.json']},pages:[{id:'p',name:'Page',children:[{id:'n',type:'rect',fills:[{type:'solid',color:'#FFFFFF'}],bindings:{'fills.0.color':'missing'}}]}]}));
    };
    let failed=false;try{await reportFiles();}catch(error){failed=error.message.includes('503');}ok(failed,'unavailable designs cannot disappear silently');
    initHome(host);showHomeSection('report');await renderHome();ok(host.textContent.includes('Could not measure this project'));ok(!host.querySelector('.report-cards'));
    broken=false;project.files.push({path:'.sigma/tokens/missing.sigma.json',name:'Missing tokens',kind:'tokens',mtime:'1000000'});
    const files=await reportFiles();ok(files.warnings.length>=1);eq(useReport(files).overall.unresolvedBindings,1);
    await renderHome();ok(host.querySelector('.report-notice').textContent.includes('Some source data is unavailable'));
  }finally{window.fetch=oldFetch;host.remove();for(const key of Object.keys(project))if(!(key in before))delete project[key];Object.assign(project,before);selectProject(previous,{notify:false});await db.delete('projects',identity);if(pref===null)localStorage.removeItem('sigma.home.prefs');else localStorage.setItem('sigma.home.prefs',pref);location.hash=hash;}
});

test('report UI prioritizes broken links while preserving exact finding targets',()=>{
  const host=document.createElement('div'),opened=[];
  const files=fixture();files[0].doc.pages[0].children.push({id:'broken',type:'rect',name:'Broken binding',fills:[{color:'#fff'}],bindings:{'fills.0.color':'missing'}});
  try{
    renderReportDashboard(host,files,{onOpen:t=>opened.push(t)});
    ok(host.querySelector('.report-finding').textContent.includes('Missing token link'));
    host.querySelector('[data-report-open-finding]').click();eq(opened[0].nodeId,'broken');
  }finally{host.remove();}
});
