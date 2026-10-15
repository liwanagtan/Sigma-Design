import {lucideIcon} from './lucide.js';
import { initializeProjects, projectList, selectedProjectId, selectedProject, selectProject, createProject, setProjectIcon, updateProjectDetails, inScope, moveDrafts, scopeHref, SIGMA_PROJECT } from './projects.js';
import {PROJECT_GLYPHS,PROJECT_EMOJI,projectIconMarkup} from './project-icons.js';
import { guideHTML } from './welcome-guide.js';
import { appearanceButtonHTML } from './appearance.js';
// The files home. Standalone, it lists the Sigma files stored in this browser. In a project (Part F, Phase 31)
// the same sections list the project's files (its .sigma/ folder), proposals get a section of their own, and
// files kept only in the browser are hidden (they can be moved into the project).
import {
  listFiles, createFile, renameFile, duplicateFile, deleteFile, downloadFile, importFiles, pickFilesToImport,
  listArchivedFiles, archiveFile, restoreFile, emptyArchive,
  storageSummary, openFile, fileHref, fileKind, newTokenDocument, newIconsDocument, welcomeFile, isSampleFile,
  loadFile,
} from './files.js';
import { blankDocument } from './sample.js';
import {
  project, onProjectChange, projectListing, openProjectFile, newProjectFile,
} from './project.js';
import { openProposeDialog, changesetListing } from './propose.js';
import { buildLibraryFromCode } from './code-check.js';
import { renderReportDashboard } from './report-ui.js';
import { fromProjectFile } from './project-format.js';
import { ICON_SETS, iconSetDocument, loadIconSet } from './icon-library.js';
import { showContextMenu } from './menu.js';
import { modal } from './libraries.js';
import { icons } from './icons.js';
import { toast } from './io.js';
import { ask } from './dialogs.js';
import { resizerHTML } from './columns.js';

const PREFS_KEY = 'sigma.home.prefs';
const KIND_ORDER = ['design', 'tokens', 'icons']; // the Welcome to Sigma folder: the guide, then its libraries
const SORTS = { edited: 'Last edited', name: 'Name', created: 'Date created' };

let root = null;
let prefs = { section: 'recents', sort: 'edited', layout: 'grid' };
let query = '';
let thumbURLs = [];
let notice = '';
let renaming = null; // file id being renamed inline

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
  if (prefs.section === 'all') prefs.section = 'design'; // "All files" became "Design files"
  if (prefs.section === 'project') prefs.section = 'recents'; // the Project section's files are in the kind sections now
} catch {}

const SECTIONS = { report: 'Design system report', proposals: 'Proposals', workspace: 'Project', recents: 'Recents', drafts: 'Drafts', design: 'Design', tokens: 'Tokens', icons: 'Icons', welcome: 'Documentation', archive: 'Archive' };

// Open the files home on a section (e.g. the Archive, when an archived file's link is opened).
export function showHomeSection(section) {
  if (!SECTIONS[section]) return;
  prefs.section = section;
  savePrefs();
}
const savePrefs = () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
};

// "just now", "5 minutes ago", "3 days ago", then a date after ~a month.
export function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const units = [['minute', 60, 3600], ['hour', 3600, 86400], ['day', 86400, 604800], ['week', 604800, 2592000]];
  for (const [unit, size, limit] of units) {
    if (s < limit) {
      const n = Math.max(1, Math.round(s / size));
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
  }
  return new Date(t).toLocaleDateString();
}

// ---------- setup ----------
export function initHome(el) {
  root = el;
  root.innerHTML = `${resizerHTML('home-side')}
    <aside class="home-side">
      <div class="home-brand">${icons.logo}<span>Sigma</span></div>
      <input type="search" id="home-search" class="home-search" placeholder="Search all files" aria-label="Search all files" spellcheck="false">
      <button class="btn primary" id="home-create" aria-haspopup="menu" aria-expanded="false">${icons.plus} Create New ${icons.selectChevron}</button>
      <nav class="home-nav">
        <button class="nav-item" data-section="recents">${NAV_RECENTS} Recents</button>
        <button class="nav-item" data-section="drafts">${NAV_DRAFTS} Drafts</button>
        <button class="nav-item" data-section="archive" id="nav-archive" title="Deleted files, until you delete them forever">${NAV_ARCHIVE} Archive</button>
        <section class="home-project" id="home-project" aria-label="Projects"></section>
      </nav>
      <div class="home-storage" id="home-storage"></div>
      <button class="nav-item nav-welcome" data-section="welcome" title="Documentation">${NAV_WELCOME} Documentation</button>
    </aside>
    <main class="home-main">
      <header class="home-header">
        <div class="home-heading"><button class="icon-btn project-header-icon" id="project-header-icon" aria-label="Change project icon" hidden></button><h1 id="home-title"></h1></div>
        <div class="home-tools">
          <button class="btn" id="home-proposals" hidden>Proposals</button>
          <button class="btn" id="home-report" title="Design system report" hidden>${NAV_REPORT} Report</button>
          <select id="home-sort" class="select" title="Sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <div class="seg home-layout">
            <button class="icon-btn" data-layout="grid" title="Grid view">${GRID_ICON}</button>
            <button class="icon-btn" data-layout="list" title="List view">${LIST_ICON}</button>
          </div>
          ${appearanceButtonHTML()}
        </div>
      </header>
      <div class="project-description-area" id="project-description-area" hidden><textarea id="project-description" aria-label="Project description" placeholder="Add a project description…" maxlength="2000" rows="1"></textarea></div>
      <div id="home-notice"></div>
      <div id="home-files"></div>
    </main>
    <div class="home-drop" id="home-drop" hidden><div>Drop <b>.fig</b>, <b>.sigma.json</b> or <b>tokens.json</b> files to import them</div></div>`;

  root.querySelector('.home-side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (!b) return;
    query='';
    prefs.section = b.dataset.section;
    savePrefs();
    location.hash=b.dataset.section==='welcome'?'#/guide/getting-started':b.dataset.section==='drafts'?'#/drafts/drafts':b.dataset.section==='recents'?'#/recents':scopeHref(b.dataset.section);
  });
  root.querySelector('#home-search').addEventListener('input', (e) => {
    query = e.target.value;
    renderHome();
  });
  root.querySelector('#home-sort').addEventListener('change', (e) => {
    prefs.sort = e.target.value;
    savePrefs();
    renderHome();
  });
  root.querySelector('.home-layout').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    prefs.layout = b.dataset.layout;
    savePrefs();
    renderHome();
  });
  root.querySelector('#home-report').onclick=()=>{query='';location.hash=scopeHref(['report','proposals'].includes(prefs.section)?'workspace':'report');};
  root.querySelector('#home-proposals').onclick=()=>{query='';location.hash=scopeHref('proposals');};
  root.querySelector('#home-create').onclick=()=>{
    const button=root.querySelector('#home-create'),box=button.getBoundingClientRect();
    const prepare=prepareCreationScope;
    showContextMenu(box.left,box.bottom+4,[
      {label:'Design file',action:()=>{prepare();newBlankFile();}},
      {label:'Tokens file',action:()=>{prepare();newTokenFile();}},
      {label:'Icons file',action:()=>{prepare();newIconsFile();}},'-',
      {label:'Import…',action:async()=>{prepare();afterImport(await pickFilesToImport());}}
    ],{trigger:button,minWidth:180});
  };
  onProjectChange(async()=>{if(!root?.isConnected)return;await initializeProjects(project);if(!root.hidden)renderHome();});
  window.addEventListener('sigma:scope',()=>!root.hidden&&renderHome());
  window.addEventListener('sigma:projects',()=>!root.hidden&&renderHome());
  window.addEventListener('sigma:changesets', () => !root.hidden && renderHome());
  const list = root.querySelector('#home-files');
  list.addEventListener('click', async (e) => {
    const example=e.target.closest('[data-guide-example]');
    if(example){await welcomeFile();await initializeProjects(project);const file=(await listFiles()).find(f=>f.exampleKey===example.dataset.guideExample);if(!file)return toast('This example is unavailable.');selectProject(SIGMA_PROJECT);location.hash=`#/file/${file.id}${example.dataset.examplePage?'?page='+encodeURIComponent(example.dataset.examplePage):''}`;return;}
    if (e.target.closest('[data-propose-change]')&&project.connected&&selectedProjectId()===project.identity) return openProposeDialog();
    if (e.target.closest('[data-move-into-project]')) return moveIntoProjectDialog();
    const build = e.target.closest('[data-build-library]');
    if (build) return buildLibraryFromCode((project.config?.components || []).find((c) => c.sigma === build.dataset.buildLibrary));
    if (e.target.closest('[data-not-now]')) {
      prefs.notNow = { ...(prefs.notNow || {}), [project.name]: true };
      savePrefs();
      return renderHome();
    }
    const projectFile = e.target.closest('[data-project-path]');
    if (projectFile) {
      e.preventDefault();
      return openProjectFile(projectFile.dataset.projectPath);
    }
    const archived = e.target.closest('[data-archived]');
    if (archived) {
      e.preventDefault();
      if (e.target.closest('[data-restore]')) return restore(archived.dataset.archived);
      if (e.target.closest('[data-empty-archive]')) return confirmEmptyArchive();
      const r = (e.target.closest('[data-more]') || archived).getBoundingClientRect();
      return archivedMenu(archived.dataset.archived, e.target.closest('[data-more]') ? r.left : e.clientX, e.target.closest('[data-more]') ? r.bottom + 4 : e.clientY);
    }
    if (e.target.closest('[data-empty-archive]')) return confirmEmptyArchive();
    const more = e.target.closest('[data-more]');
    const action = e.target.closest('[data-empty-action]');
    if (action) {
      e.preventDefault();
      const act = action.dataset.emptyAction;
      if (act === 'icons') return newIconsFile();
      if (act === 'icon-set') return newIconSetFile(ICON_SETS.find((s) => s.id === action.dataset.set));
      return act === 'welcome' ? openWelcome() : act === 'tokens' ? newTokenFile() : newBlankFile();
    }
    if (more) {
      e.preventDefault();
      e.stopPropagation();
      const r = more.getBoundingClientRect();
      fileMenu(more.closest('[data-id]').dataset.id, r.left, r.bottom + 4);
    }
    if (e.target.closest('[data-id]')&&e.target.closest('input')) e.preventDefault(); // only file-card renaming suppresses its link
  });
  list.addEventListener('contextmenu', (e) => {
    const archived = e.target.closest('[data-archived]');
    if (archived) {
      e.preventDefault();
      return archivedMenu(archived.dataset.archived, e.clientX, e.clientY);
    }
    const card = e.target.closest('[data-id]');
    if (!card) return;
    e.preventDefault();
    fileMenu(card.dataset.id, e.clientX, e.clientY);
  });

  // Drag .sigma.json files anywhere on the page to import them.
  const drop = root.querySelector('#home-drop');
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  root.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    drop.hidden = false;
  });
  root.addEventListener('dragleave', () => {
    if (--depth <= 0) {
      depth = 0;
      drop.hidden = true;
    }
  });
  root.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
  root.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    drop.hidden = true;
    prepareCreationScope();
    const files = [...e.dataTransfer.files].filter((f) => /\.(json|fig)$/i.test(f.name) || f.type === 'application/json');
    if (!files.length) return toast('Import .fig, .sigma.json or tokens.json files here.');
    afterImport(await importFiles(files));
  });

  setInterval(() => !root.hidden && renderHome(), 60_000); // keep "Edited … ago" fresh
}

const GRID_ICON = lucideIcon('layout-grid',16);
const LIST_ICON = lucideIcon('list',16);

export function setHomeNotice(msg) {
  notice = msg || '';
}

// ---------- the project ----------
const NAV_PROJECT = lucideIcon('folder-check',14);

// In a project, Sigma works on its files: the sections list them, and new files go into it.
const projectMode=()=>selectedProject()?.kind==='repository';

// Project navigation stays alongside Recents, Drafts, and file filters.
async function renderProjectNav() {
  const el=root.querySelector('#home-project');
  const projects=await projectList();
  el.innerHTML=`<div class="project-group-heading"><span class="nav-label">Projects</span><button class="icon-btn" data-new-project title="New project" aria-label="New project">${icons.plus}</button></div>${projects.map(p=>`<div class="project-nav-row ${p.id===selectedProjectId()?'active':''}"><button class="icon-btn project-icon" data-project-icon="${esc(p.id)}" title="Change icon for ${esc(p.name)}" aria-label="Change icon for ${esc(p.name)}">${projectIconMarkup(p.icon)}</button><button class="nav-item project-nav-item ${p.id===selectedProjectId()?'active':''}" data-project-id="${esc(p.id)}" ${p.id===selectedProjectId()?'aria-current="true"':''}>${esc(p.name)}${p.kind==='repository'&&(!project.connected||p.id!==project.identity)?'<span class="muted"> · Offline</span>':''}</button></div>`).join('')}`;
  el.querySelectorAll('[data-project-icon]').forEach(button=>button.onclick=()=>projectIconDialog(projects.find(p=>p.id===button.dataset.projectIcon)));
  el.querySelector('[data-new-project]').onclick=()=>newProjectDialog();
  el.querySelectorAll('[data-project-id]').forEach(button=>button.onclick=()=>{
    selectProject(button.dataset.projectId);query='';
    location.hash=scopeHref('workspace');
  });
  root.querySelector('#nav-proposals')?.setAttribute('hidden','');
  root.querySelector('#nav-archive').hidden=false;
}
function projectIconDialog(project) {
  const wrap=modal(`Icon for ${esc(project.name)}`,`<div class="project-icon-picker"><p class="muted">Emoji</p><div class="project-icon-grid">${PROJECT_EMOJI.map(value=>`<button class="icon-btn" data-emoji="${value}" aria-label="Use ${value}">${value}</button>`).join('')}</div><form data-custom-emoji><label>Custom emoji<input class="select" data-emoji-input placeholder="Paste an emoji" maxlength="32" aria-label="Custom emoji"></label><button class="btn" type="submit">Use emoji</button></form><p class="muted">Sigma icons</p><div class="project-icon-grid">${PROJECT_GLYPHS.map(value=>`<button class="icon-btn" data-glyph="${value}" aria-label="Use ${value} icon">${projectIconMarkup({type:'glyph',value})}</button>`).join('')}</div><p role="alert" data-error></p></div>`,'<button class="btn" data-reset-icon>Reset icon</button><span class="spacer"></span><button class="btn" data-close>Cancel</button>');
  const dialog=wrap.querySelector('.modal');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',`Icon for ${project.name}`);wrap.querySelector('[data-emoji]').focus();
  let saving=false;
  const save=async icon=>{if(saving)return;saving=true;try{await setProjectIcon(project.id,icon);wrap.querySelector('[data-close]').click();}catch(error){wrap.querySelector('[data-error]').textContent=error.message;}finally{saving=false;}};
  wrap.querySelectorAll('[data-emoji]').forEach(button=>button.onclick=()=>save({type:'emoji',value:button.dataset.emoji}));
  wrap.querySelectorAll('[data-glyph]').forEach(button=>button.onclick=()=>save({type:'glyph',value:button.dataset.glyph}));
  wrap.querySelector('[data-custom-emoji]').onsubmit=e=>{e.preventDefault();save({type:'emoji',value:wrap.querySelector('[data-emoji-input]').value});};
  wrap.querySelector('[data-reset-icon]').onclick=()=>save(null);
}
export async function newProjectDialog({select=true,onCreated}={}) {
  const wrap=modal('New project','<label class="project-name-label">Project name<input class="select" data-project-name placeholder="Project name" maxlength="100"></label><p role="alert" data-error></p>','<button class="btn" data-close>Cancel</button><button class="btn primary" data-create-project>Create</button>');
  const input=wrap.querySelector('input');input.focus();
  const submit=async()=>{const button=wrap.querySelector('[data-create-project]');button.disabled=true;try {
    const id=await createProject(input.value);wrap.remove();
    if(select){selectProject(id);prefs.section='workspace';location.hash=scopeHref('workspace');await renderHome();}
    await onCreated?.(id);
  }catch(error){wrap.querySelector('[data-error]').textContent=error.message;button.disabled=false;}};
  wrap.querySelector('[data-create-project]').onclick=submit;
  input.onkeydown=e=>{if(e.key==='Enter')submit();};
}
async function moveDraftDialog(only) {
  const files=(await listFiles()).filter(f=>!f.projectId&&!f.project&&!isSampleFile(f));
  const projects=await projectList();
  const body=`<p>Choose files to move from Drafts. You can include related token and icon libraries; links keep working if you leave them in Drafts.</p>${files.map(f=>`<label class="propose-item"><input type="checkbox" data-draft="${f.id}" ${!only||only.includes(f.id)?'checked':''}>${esc(f.name)}</label>`).join('')}<label>Destination<select class="select" data-destination>${projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><button class="btn" data-new-destination>New project…</button><p role="alert" data-error></p>`;
  const wrap=modal('Move to project',body,'<button class="btn" data-close>Cancel</button><button class="btn primary" data-move-drafts>Move</button>');
  wrap.querySelector('[data-new-destination]').onclick=()=>newProjectDialog({select:false,onCreated:async id=>{const p=(await projectList()).find(p=>p.id===id);const option=new Option(p.name,id);wrap.querySelector('select').add(option);wrap.querySelector('select').value=id;}});
  wrap.querySelector('[data-move-drafts]').onclick=async()=> {
    const button=wrap.querySelector('[data-move-drafts]');button.disabled=true;
    try {
      const ids=[...wrap.querySelectorAll('[data-draft]:checked')].map(n=>n.dataset.draft);
      const target=projects.concat(await projectList()).find(p=>p.id===wrap.querySelector('select').value);
      if(!ids.length||!target)throw new Error('Choose files and a destination project.');
      if(target.kind==='repository') {
        if(!project.connected||target.id!==project.identity)throw new Error('This repository is offline.');
        const paths={},loaded=new Map();for(const id of ids)loaded.set(id,await loadFile(id));
        const ordered=[],visiting=new Set(),done=new Set();
        const visit=id=>{if(done.has(id))return;if(visiting.has(id))throw new Error('These files have circular library links; keep them in a browser project.');visiting.add(id);const doc=loaded.get(id).doc;for(const lib of [...(doc.libraries||[]),...(doc.iconLibraries||[]),...(doc.componentLibraries||[])])if(loaded.has(lib.fileId))visit(lib.fileId);visiting.delete(id);done.add(id);ordered.push(id);};ids.forEach(visit);
        for(const id of ordered){const path=await newProjectFile(loaded.get(id).doc,{open:false,paths});if(!path)throw new Error('The move did not finish; drafts were retained.');paths[id]=path;}
        for(const id of ids)await archiveFile(id);
      }else await moveDrafts(ids,target.id);
      wrap.remove();notice=`Moved ${ids.length} file${ids.length===1?'':'s'} to ${target.name}.`;await renderHome();
      const node=root.querySelector('#home-notice .home-notice');const open=document.createElement('button');open.className='btn';open.textContent='Open project';open.onclick=()=>{selectProject(target.id);location.hash=scopeHref('workspace');};node?.append(open);
    }catch(error){wrap.querySelector('[data-error]').textContent=error.message;button.disabled=false;}
  };
}

// A project file's card: opens it from the project.
function projectCard(f) {
  let thumb = '';
  if (f.meta?.thumbnail instanceof Blob) {
    const url = URL.createObjectURL(f.meta.thumbnail);
    thumbURLs.push(url);
    thumb = `<img src="${url}" alt="" draggable="false">`;
  }
  const plain = f.kind !== 'design';
  if (!thumb) thumb = `<span class="thumb-placeholder">${f.kind === 'icons' ? NAV_ICONS : f.kind === 'tokens' ? NAV_TOKENS : NAV_DESIGN}</span>`;
  const when = f.meta?.updatedAt ? `Edited ${ago(f.meta.updatedAt)}` : '';
  return `<a class="file-card${plain ? ' tokens' : ''}" href="#" data-project-path="${esc(f.path)}" draggable="false" title="${esc(f.path)}">
    <div class="file-thumb" style="background:${plain ? '#FFFFFF' : esc(f.meta?.background || '#F5F5F5')}">${thumb}</div>
    <div class="file-info"><div class="card-name" title="${esc(f.name)}">${esc(f.name)}</div>
    <div class="file-time">${f.package ? `<span class="kind-badge sample" title="From the design system package ${esc(f.package)}: read-only here; change it in the package">${esc(f.package)}${f.version ? ` ${esc(f.version)}` : ''}</span>` : ''}${f.kind === 'invalid' ? '<span class="kind-badge sample">Not readable</span>' : ''}${when || `<span>${esc(f.path.replace(/^\.sigma\//, ''))}</span>`}</div></div>
    <div class="file-created muted">${esc(f.path.replace(/^\.sigma\//, ''))}</div>
  </a>`;
}

const EMPTY_PROJECT = {
  design: ['No design files in this project yet', 'Design pages and components on the project’s tokens and icons. The sync skill can also build them from the code (its components and pages).', 'blank', 'New design file'],
  tokens: ['No tokens files in this project yet', 'The project’s design tokens, kept in step with the code. The sync skill sets this up from the code’s tokens (skills/sigma-sync).', 'tokens', 'New tokens file'],
  icons: ['No icons files in this project yet', 'The project’s icons, kept in step with its icon folder. The sync skill sets this up (skills/sigma-sync).', 'icons', 'New icons file'],
};

// Recents and the kind sections, in a project: the project's files.
async function renderProjectFiles(list, section, q) {
  if(!project.connected||selectedProjectId()!==project.identity){list.innerHTML='<div class="home-empty"><p>This repository is offline. Reconnect its Sigma server to browse or create files.</p></div>';return;}
  let items = (await projectListing()).filter((f) => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  const recents = section === 'recents';
  if (!recents && section!=='workspace') items = items.filter((f) => f.kind === section);
  const edited = (f) => f.meta?.updatedAt || 0;
  const sort = recents ? 'edited' : prefs.sort;
  items.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    : sort === 'created' ? (b.meta?.createdAt || 0) - (a.meta?.createdAt || 0) : edited(b) - edited(a) || a.path.localeCompare(b.path)));
  if (recents && !q) items = items.slice(0, 24);
  const move = (await moveNotice()) + (section === 'design' || recents ? unbuiltLibraries() : '');
  if (items.length) {
    list.className='project-file-sections';list.innerHTML = move + groupedFiles(items,projectCard);
    return;
  }
  if (q) {
    list.innerHTML = move + `<div class="home-empty"><p>No project files match “${esc(query)}”.</p></div>`;
    return;
  }
  const [title, text, act, label] = EMPTY_PROJECT[section] || ['No Sigma files in this project yet', 'Create one with the buttons above, or let the sync skill set the project up from its code (skills/sigma-sync).', 'blank', 'New design file'];
  list.innerHTML = move + `<div class="home-empty"><div class="home-empty-title">${title}</div><p>${text}</p>
    ${project.connected ? `<div class="home-empty-actions"><button class="btn primary" data-empty-action="${act}">${icons.plus} ${label}</button></div>` : ''}</div>`;
}

// Component libraries sigma.config.json lists that aren't built yet: build them from the code (Phase 35).
function unbuiltLibraries() {
  if (!project.connected) return '';
  return (project.config?.components || []).filter((c) => !project.files.some((f) => f.path === c.sigma)).map((c) =>
    `<div class="home-notice move-notice"><span>The component library <code>${esc(c.sigma)}</code> isn’t built yet. Sigma can capture the components${c.page ? ` from <code>${esc(c.page)}</code>` : ''} and build it.</span><button class="btn primary" data-build-library="${esc(c.sigma)}">Build from code…</button></div>`).join('');
}

// Files kept only in this browser aren't part of the project: offer, once, to move them in.
async function browserOnlyFiles() {
  return (await listFiles()).filter((f) => !isSampleFile(f)&&!f.project&&inScope(f));
}
async function moveNotice() {
  if (!project.connected || prefs.notNow?.[project.name]) return '';
  const n = (await browserOnlyFiles()).length;
  if (!n) return '';
  return `<div class="home-notice move-notice">${n === 1 ? '1 file is' : `${n} files are`} saved in this browser, not in this project.
    <button class="btn" data-move-into-project>Move into project…</button><button class="btn" data-not-now>Not now</button></div>`;
}

async function moveIntoProjectDialog() {
  const files = await browserOnlyFiles();
  if (!files.length) return renderHome();
  const order = { tokens: 0, icons: 1, design: 2 };
  files.sort((a, b) => order[fileKind(a)] - order[fileKind(b)] || a.name.localeCompare(b.name));
  const body = `<p class="muted lib-intro">Moved files are written to the project’s <code>.sigma/</code> folder (git keeps their history from there) and leave this browser’s files for its Archive. Links between moved files are kept.</p>` +
    files.map((f) => `<label class="propose-item"><input type="checkbox" data-id="${f.id}" checked>${kindBadge(fileKind(f))}<span class="propose-name">${esc(f.name)}</span><span class="muted">Edited ${ago(f.updatedAt)}</span></label>`).join('');
  const wrap = modal('Move into project', body, '<span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-move>Move</button>');
  wrap.querySelector('[data-move]').addEventListener('click', async () => {
    const ids = [...wrap.querySelectorAll('input[data-id]:checked')].map((i) => i.dataset.id);
    wrap.remove();
    const paths = {};
    let moved = 0;
    // Token and icon files first, so the design files that link them keep their links.
    for (const id of ids) {
      const file = await loadFile(id);
      if (!file) continue;
      const path = await newProjectFile(file.doc, { open: false, paths });
      if (!path) continue;
      paths[id] = path;
      await archiveFile(id);
      moved++;
    }
    toast(moved === 1 ? 'Moved 1 file into the project' : `Moved ${moved} files into the project`);
    renderHome();
  });
}

// ---------- the design system use report (Part D, Phase 17) ----------
// The design files to measure: the project's (as Sigma opens them), or this browser's.
// The design files (the project's, or this browser's), as { id, name, path?, editedAt, doc }: the report, and the
// files a library change reaches (visual change review).
export async function reportFiles() {
  if (projectMode()&&project.connected&&selectedProjectId()===project.identity) {
    const texts = {},warnings=[];
    for (const f of project.files.filter((x) => x.kind !== 'invalid')) {
      const r = await fetch(`/api/project/file?path=${encodeURIComponent(f.path)}`, { cache: 'no-store' });
      if (r.ok) { try { texts[f.path]=await r.json(); } catch { if(f.kind==='design')throw Error(`Could not read ${f.name}: invalid design JSON.`);warnings.push(`${f.name}: invalid library JSON.`); } }
      else if(f.kind==='design')throw Error(`Could not read ${f.name} (${r.status}).`);
      else warnings.push(`${f.name}: library unavailable (${r.status}).`);
    }
    const resolve = (p) => (texts[p] ? { fileId: p, file: texts[p] } : null);
    const out=project.files.filter(f=>f.kind==='design'&&texts[f.path]).map(f=>{
      const parsed=fromProjectFile(structuredClone(texts[f.path]),{path:f.path,resolve});
      warnings.push(...parsed.warnings.map(w=>`${f.name}: ${w}`));
      return {id:f.path,name:f.name,path:f.path,editedAt:Number(BigInt(f.mtime)/1000000n),doc:parsed.doc};
    });
    const invalid=project.files.filter(f=>f.kind==='invalid');if(invalid.length)warnings.push(`${invalid.length} invalid repository files could not be measured.`);
    out.warnings=warnings;return out;
  }
  const out = [];
  for (const meta of (await listFiles()).filter((f) => fileKind(f)==='design'&&!f.project&&inScope(f))) {
    const file = await loadFile(meta.id);
    if (!file) throw Error(`Could not read ${meta.name}. Refresh the project and try again.`);
    out.push({id:meta.id,name:meta.name,editedAt:meta.updatedAt,sample:isSampleFile(meta),doc:file.doc});
  }
  return out;
}

let reportRun = 0;
async function renderReport(list) {
  const mine=++reportRun,owner=selectedProjectId();
  const current=()=>mine===reportRun&&prefs.section==='report'&&selectedProjectId()===owner&&!query.trim();
  list.className='report-host';
  list.innerHTML='<div class="home-empty" role="status"><p>Measuring design system usage…</p></div>';
  if(projectMode()&&(!project.connected||owner!==project.identity)){list.innerHTML='<div class="home-empty"><h2>Repository offline</h2><p>Reconnect this repository’s Sigma server to measure its files. Unavailable data is not shown as zero.</p></div>';return;}
  try {
    const files=await reportFiles();if(!current())return;
    prefs.reportViews ||= {};
    const key=owner||'drafts',settings=prefs.reportViews[key] ||= {days:prefs.reportDays||0,handoff:!!prefs.reportHandoff};
    const options={...settings,since:settings.days?Date.now()-settings.days*86400000:null};
    renderReportDashboard(list,files,{options,projectName:selectedProject()?.name||'Drafts',repository:projectMode(),warnings:files.warnings||[],
      onChange:(patch,recompute)=>{Object.assign(settings,patch);savePrefs();if(recompute)renderReport(list);},
      onRefresh:()=>renderReport(list),
      onOpen:async target=>{
        const fileId=target.fileId||target.id;
        const navigation={pageId:target.pageId,nodeId:target.nodeId,tokenId:target.tokenId,reportProjectId:owner||'drafts'};
        const path=target.path||(projectMode()&&project.files.some(f=>f.path===fileId)?fileId:null);
        if(path){if(!project.connected||project.identity!==owner)throw Error('Reconnect the repository to open this design.');await openProjectFile(path,navigation);}
        else {if(!await loadFile(fileId))throw Error('This file is unavailable. Refresh the report to update its findings.');openFile(fileId,navigation);}
      }
    });
  } catch(error){if(!current())return;list.innerHTML=`<div class="home-empty"><h2>Could not measure this project</h2><p>${esc(error.message)}</p><p>Unavailable files are not counted as zero.</p><button class="btn" data-report-retry>Try again</button></div>`;list.querySelector('[data-report-retry]').onclick=()=>renderReport(list);}
}

// The Proposals section: changes proposed from Sigma, with their status, pull request and ticket.
async function renderProposals(list, q) {
  const owner=selectedProjectId();
  if(!project.connected||owner!==project.identity){list.innerHTML='<div class="home-empty"><h2>Repository offline</h2><p>Reconnect this repository’s Sigma server to view its Proposals.</p></div>';return;}
  let all;
  try { all=await changesetListing(); }
  catch(error){if(prefs.section==='proposals'&&selectedProjectId()===owner)list.innerHTML=`<div class="home-empty"><h2>Could not load Proposals</h2><p>${esc(error.message)}</p><button class="btn" data-proposals-retry>Try again</button></div>`;list.querySelector('[data-proposals-retry]')?.addEventListener('click',()=>renderProposals(list,q));return;}
  if(prefs.section!=='proposals'||selectedProjectId()!==owner||query.trim())return;
  const changesets = all.filter((c) => !q || `${c.title} ${c.note || ''}`.toLowerCase().includes(q));
  const intro = `<div class="welcome-intro"><p>Changes proposed from Sigma. <b>Propose change</b> picks edits that belong together; the sync skill turns each proposal into a ticket and a pull request, and its status follows the pull request.</p>
    ${project.connected ? '<button class="btn primary" data-propose-change>Propose change…</button>' : '<p class="muted">The project isn’t connected.</p>'}</div>`;
  const row = (c) => `<div class="changeset-row" title="${esc(c.note || '')}">
      <span class="status-chip ${c.status === 'merged' ? 'ok' : c.status === 'changes-requested' ? 'warn' : ''}">${esc(c.statusLabel)}</span>
      <span class="changeset-title">${esc(c.title)}</span><span class="muted">${esc(c.summary)}</span>
      ${c.pr?.url ? `<a href="${esc(c.pr.url)}" target="_blank" rel="noopener">PR${c.pr.number ? ` #${esc(c.pr.number)}` : ''}</a>` : ''}
      ${c.ticket?.url ? `<a href="${esc(c.ticket.url)}" target="_blank" rel="noopener">Ticket</a>` : ''}
      <span class="muted changeset-date">${esc(String(c.createdAt || '').slice(0, 10))}</span></div>`;
  list.innerHTML = intro + (changesets.length ? `<div class="changesets">${changesets.map(row).join('')}</div>`
    : `<div class="home-empty"><p>${q ? `No proposals match “${esc(query)}”.` : 'No proposals yet.'}</p></div>`);
}

// ---------- actions ----------
// In a project, new files are made in the project (.sigma/), otherwise in the browser.
const inProjectSection = () => projectMode()&&project.connected&&selectedProjectId()===project.identity;
function prepareCreationScope(){if(query||!selectedProjectId()||prefs.section!=='workspace'){query='';selectProject(null,{notify:false});prefs.section='drafts';location.hash='#/drafts/drafts';}}
const create = async (doc) => {
  if(projectMode()&&(!project.connected||selectedProjectId()!==project.identity)) return toast('The project isn’t connected, so new files can’t be added to it.');
  return inProjectSection() ? newProjectFile(doc) : openFile(await createFile(doc));
};

async function newTokenFile() {
  await create(newTokenDocument());
}

async function newIconsFile() {
  await create(newIconsDocument());
}

// An icons file with a free icon set (Lucide), published so design files can link it. Offered when
// there are no icons files yet; in a project it's the way to get Lucide as a project file.
let creatingSet = false;
async function newIconSetFile(set) {
  if (!set || creatingSet) return;
  creatingSet = true;
  toast(`Adding ${set.name}…`);
  try {
    const data = await loadIconSet(set);
    const doc = iconSetDocument(set, data);
    if (inProjectSection()) {
      delete doc.published; // in a project, git does the versioning
      await newProjectFile(doc);
    } else openFile(await createFile(doc));
    toast(`${data.name} ${data.version}: ${doc.icons.length.toLocaleString()} icons, published and ready to link`);
  } catch (err) {
    toast(`Couldn’t add ${set.name}: ${err.message}`);
  } finally {
    creatingSet = false;
  }
}

async function newBlankFile() {
  await create(blankDocument());
}

// "Welcome to Sigma", the guide file (made the first time, and again when its content is newer).
async function openWelcome(){location.hash='#/guide/getting-started';}

// A complete sample design system: primitives, semantic Light/Dark colors, a brand, text styles and
// component tokens, published so design files can link it right away. Opens the existing one if there is one.


function afterImport(ids) {
  if (!ids.length) return;
  toast(ids.length === 1 ? 'Imported 1 file' : `Imported ${ids.length} files`);
  if (ids.length === 1) openFile(ids[0]);
  else renderHome();
}

async function fileMenu(id, x, y) {
  const sample = isSampleFile((await listFiles()).find((f) => f.id === id));
  showContextMenu(x, y, [
    { label: 'Open', action: () => openFile(id) },
    { label: 'Open in new tab', action: () => window.open(fileHref(id), '_blank') },
    '-',
    // Built-in originals cannot be renamed or archived from the home; their open sessions are editable.
    ...(!sample&&!selectedProjectId()?[{label:'Move to project…',action:()=>moveDraftDialog([id])}]:[]),
    ...(sample ? [] : [{ label: 'Rename', action: () => startRename(id) }]),
    { label: sample ? 'Make an editable copy' : 'Duplicate', action: async () => {
      await duplicateFile(id);
      renderHome();
    } },
    { label: 'Download .sigma.json', action: () => downloadFile(id) },
    ...(sample ? [] : ['-', { label: 'Move to Archive', action: () => moveToArchive(id) }]),
  ]);
}

// Deleting a file moves it to the Archive; it can be restored from there.
async function moveToArchive(id) {
  const meta = (await listFiles()).find((f) => f.id === id);
  if (!meta || !(await archiveFile(id))) return;
  toast(`Moved “${meta.name}” to the Archive`);
  renderHome();
}

function archivedMenu(id, x, y) {
  showContextMenu(x, y, [
    { label: 'Restore', action: () => restore(id) },
    { label: 'Download .sigma.json', action: () => downloadFile(id) },
    '-',
    { label: 'Delete forever…', action: () => deleteForever(id) },
  ]);
}

async function restore(id) {
  const meta = (await listArchivedFiles()).find((f) => f.id === id);
  if (!meta || !(await restoreFile(id))) return;
  toast(`Restored “${meta.name}”`);
  renderHome();
}

async function deleteForever(id) {
  const meta = (await listArchivedFiles()).find((f) => f.id === id);
  if (!meta || !(await ask(`“${meta.name}” and its version history are erased from this browser. This can’t be undone; download it first if you want a copy.`, { title: `Delete “${meta.name}” forever?`, ok: 'Delete forever', danger: true }))) return;
  await deleteFile(id);
  toast(`Deleted “${meta.name}” forever`);
  renderHome();
}

async function confirmEmptyArchive() {
  const n = (await listArchivedFiles()).filter(f=>inScope(f)).length;
  if (!n || !(await ask(`${n === 1 ? 'The file' : `All ${n} files`} in the Archive and ${n === 1 ? 'its' : 'their'} version history are erased from this browser. This can’t be undone.`, { title: 'Empty the Archive?', ok: `Delete ${n === 1 ? '1 file' : `${n} files`} forever`, danger: true }))) return;
  await emptyArchive();
  toast('The Archive is empty');
  renderHome();
}

async function startRename(id) {
  renaming = id;
  await renderHome();
  const input = root.querySelector(`[data-id="${id}"] .rename-input`);
  if (!input) return;
  input.focus();
  input.select();
  let done = false;
  const finish = async (ok) => {
    if (done) return;
    done = true;
    renaming = null;
    if (ok && input.value.trim()) await renameFile(id, input.value);
    renderHome();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function groupedFiles(files,renderCard) {
  const sections=['design','tokens','icons'].map(kind=>{
    const items=files.filter(f=>fileKind(f)===kind);
    return items.length?`<section class="project-file-group" data-file-group="${kind}"><h2>${SECTIONS[kind]} <span class="muted">${items.length}</span></h2><div class="home-files ${prefs.layout}">${items.map(renderCard).join('')}</div></section>`:'';
  }).join('');
  return sections||'<div class="home-empty"><p>No files yet. Use Create New in the sidebar to start this project.</p></div>';
}
function renderProjectDescription(p) {
  const area=root.querySelector('#project-description-area'),field=root.querySelector('#project-description');
  area.hidden=!p;
  if(!p)return;
  const resize=()=>{field.style.height='auto';field.style.height=`${Math.min(field.scrollHeight,132)}px`;};
  if(document.activeElement!==field){
    field.value=p.description||'';
    field.onchange=()=>updateProjectDetails(p.id,{description:field.value}).catch(error=>{toast(error.message);renderHome();});
  }
  field.oninput=resize;resize();
}

function renderProjectHeader(p,editable=true) {
  const icon=root.querySelector('#project-header-icon'),title=root.querySelector('#home-title');
  icon.hidden=!p;
  title.contentEditable=p&&editable?'plaintext-only':'false';
  if(!p){title.removeAttribute('aria-label');title.onblur=null;title.onkeydown=null;return;}
  icon.innerHTML=projectIconMarkup(p.icon);icon.onclick=()=>projectIconDialog(p);
  if(!editable){title.removeAttribute('aria-label');title.onblur=null;title.onkeydown=null;return;}
  title.setAttribute('aria-label','Project title');
  title.onblur=()=>{if(title.textContent.trim()!==p.name)updateProjectDetails(p.id,{name:title.textContent}).catch(error=>{toast(error.message);renderHome();});};
  title.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();title.blur();}if(e.key==='Escape'){title.textContent=p.name;title.blur();}};
}

// ---------- render ----------
export async function renderHome() {
  if (!root) return;
  if(selectedProjectId()&&['design','tokens','icons','recents'].includes(prefs.section))prefs.section='workspace';
  const drafts=prefs.section==='drafts';
  const q=query.trim().toLowerCase();
  const workspace=prefs.section==='workspace'&&selectedProjectId()&&!q;
  const pm = workspace&&projectMode();
  // Proposals only exist in a project; the Archive only standalone (git is the history of project files).
  if (!SECTIONS[prefs.section] || (prefs.section === 'proposals' && !projectMode()) || (prefs.section === 'archive' && pm)) prefs.section = 'recents';
  const section = prefs.section;
  const archive = !q&&section === 'archive';
  let files = await listFiles();
  files=files.filter(f=>q||prefs.section==='recents'||inScope(f,drafts?null:selectedProjectId()));
  const total = files.length;
  const welcome = !q&&section === 'welcome';
  const proposals = !q&&section === 'proposals';
  const report = !q&&section === 'report';
  const projectFiles = pm && !welcome && !proposals && !report; // Recents and the kind sections list the project's files
  if (archive) files=(await listArchivedFiles()).filter(f=>inScope(f));
  else if(welcome) files=[];
  else if (projectFiles || proposals || report) files = [];
  else if (section !== 'recents' && !drafts && !workspace && !q) files = files.filter(f=>fileKind(f)===section&&inScope(f)); // samples have their own section
  await renderProjectNav();
  const inSection = files.length;

  root.querySelectorAll('.nav-item[data-section]').forEach((b) => b.classList.toggle('active', b.dataset.section === section));
  root.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === prefs.layout));
  const recents = section === 'recents';
  const selected=(await projectList()).find(p=>p.id===selectedProjectId());
  root.querySelector('#home-title').textContent=q?'Search results':welcome?'Documentation':drafts?'Drafts':workspace?selected.name:(report||proposals)&&selected?`${selected.name} · ${report?'Report':'Proposals'}`:SECTIONS[section];
  root.querySelector('.home-layout').hidden = proposals || report || welcome;
  root.querySelector('#home-search').hidden=false;
  root.querySelector('#home-search').value=query;
  renderProjectHeader((workspace||report||proposals)&&!q?selected:null,!!workspace);
  renderProjectDescription(workspace?selected:null);
  const reportButton=root.querySelector('#home-report');reportButton.hidden=!selected||!!q||!(workspace||report||proposals);
  root.querySelector('#home-proposals').hidden=!selected||selected.kind!=='repository'||!!q||!(workspace||report);
  reportButton.innerHTML=(report||proposals)?`${NAV_DESIGN} Go back to Files`:`${NAV_REPORT} Report`;
  reportButton.title=(report||proposals)?'Back to project files':'Design system report';
  const sortSel = root.querySelector('#home-sort');
  sortSel.hidden = recents || archive || proposals || welcome || report;
  sortSel.value = prefs.sort;

  if (q) files = files.filter((f) => f.name.toLowerCase().includes(q));
  const sort = recents ? 'edited' : archive ? 'archived' : prefs.sort;
  files.sort((a, b) => sort === 'archived' ? b.archivedAt - a.archivedAt : sort === 'name'
    ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    : sort === 'created' ? b.createdAt - a.createdAt : (b.openedAt||b.updatedAt) - (a.openedAt||a.updatedAt));
  if (recents && !q) files = files.slice(0, 24);

  root.querySelector('#home-notice').innerHTML = notice
    ? `<div class="home-notice">${esc(notice)} <button class="icon-btn" data-dismiss>${icons.close}</button></div>`
    : pm && !project.connected
      ? `<div class="home-notice"><span>Sigma’s server for ${esc(project.name)} stopped, so its files can’t be opened or saved. Run <code>npm run sigma</code> (or <code>npx sigma-design dev</code>) in the project again.</span></div>`
      : '';
  root.querySelector('[data-dismiss]')?.addEventListener('click', () => {
    notice = '';
    renderHome();
  });

  for (const u of thumbURLs) URL.revokeObjectURL(u);
  thumbURLs = [];
  const list = root.querySelector('#home-files');
  list.className = `home-files ${prefs.layout}`;

  if(drafts&&!welcome&&!archive&&!report&&files.length){const move=document.createElement('button');move.className='btn';move.textContent='Move drafts…';move.onclick=()=>moveDraftDialog();root.querySelector('#home-notice').append(move);}
  if (report) {
    await renderReport(list);
  } else if (proposals) {
    await renderProposals(list, q);
  } else if (workspace&&!pm) {
    list.className='project-file-sections';list.innerHTML=groupedFiles(files,card);
  } else if (projectFiles) {
    await renderProjectFiles(list, section, q);
  } else if(welcome) {
    list.className='';list.innerHTML=guideHTML(location.hash.split('/')[2]||'getting-started');
  } else if (archive) {
    list.innerHTML = `<div class="archive-intro"><p class="muted">Deleted files wait here until you delete them forever. Restore one to open it again.</p>` +
      (files.length ? '<button class="btn" data-empty-archive>Empty Archive…</button>' : '') + '</div>' +
      (files.length ? files.map(archivedCard).join('') : `<div class="home-empty"><p>${q ? `No archived files match “${esc(query)}”.` : 'The Archive is empty.'}</p></div>`);
  } else if(q) {
    const ps=await projectList();list.innerHTML=files.length?files.map(f=>card({...f,sourceName:ps.find(p=>p.id===f.projectId)?.name||'Drafts'})).join(''):'<div class="home-empty">No matching files.</div>';
  } else if (!total) {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">Create your first file</div>
      <p>Files are saved in this browser. You can also drag <b>.sigma.json</b> files here to import them.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="blank">${icons.plus} New design file</button>
      <button class="btn" data-empty-action="welcome">Open Documentation</button></div></div>`;
  } else if (!inSection && section === 'tokens') {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No tokens files yet</div>
      <p>A tokens file holds your design tokens (colors, spacing, type, shadows, motion) for design files to use. It has no canvas.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="tokens">${icons.plus} New tokens file</button></div></div>`;
  } else if (!inSection && section === 'icons') {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No icons files yet</div>
      <p>An icons file holds icons imported from SVG (from a free icon set, for example). Components in design files pick their icons from it. It has no canvas.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="icons">${icons.plus} New icons file</button>
      ${ICON_SETS.map((s) => `<button class="btn" data-empty-action="icon-set" data-set="${s.id}">Add ${esc(s.name)} icons</button>`).join('')}</div></div>`;
  } else if (!inSection) {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No design files yet</div>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="blank">${icons.plus} New design file</button>
      <button class="btn" data-empty-action="welcome">Open Documentation</button></div></div>`;
  } else if (!files.length) {
    list.innerHTML = `<div class="home-empty"><p>No files match “${esc(query)}”.</p></div>`;
  } else {
    const ps=await projectList();list.innerHTML = files.map(f=>card(recents?{...f,sourceName:ps.find(p=>p.id===f.projectId)?.name||'Drafts'}:f)).join('');
  }
  root.querySelector('#home-storage').textContent = pm
    ? `${project.files.length} Sigma file${project.files.length === 1 ? '' : 's'} in the project’s .sigma/ folder`
    : await storageSummary();
}

function archivedCard(f) {
  let thumb = '';
  if (f.thumbnail instanceof Blob) {
    const url = URL.createObjectURL(f.thumbnail);
    thumbURLs.push(url);
    thumb = `<img src="${url}" alt="" draggable="false">`;
  }
  const kind = fileKind(f), tokens = kind !== 'design';
  if (!thumb && tokens) thumb = `<span class="thumb-placeholder">${kind === 'icons' ? NAV_ICONS : NAV_TOKENS}</span>`;
  return `<div class="file-card archived${tokens ? ' tokens' : ''}" data-archived="${f.id}" title="Click for Restore or Delete forever">
    <div class="file-thumb" style="background:${tokens ? '#FFFFFF' : esc(f.background || '#F5F5F5')}">${thumb}</div>
    <div class="file-info"><div class="card-name" title="${esc(f.name)}">${esc(f.name)}</div><div class="file-time">Archived ${ago(f.archivedAt)}</div></div>
    <button class="btn archive-restore" data-restore>Restore</button>
    <button class="icon-btn file-more" data-more title="More actions">${MORE_ICON}</button>
  </div>`;
}

// The Welcome to Sigma folder: what it's for, and (on each card) what each sample file holds.
const WELCOME_INTRO = `<div class="welcome-intro">
  <p><b>Welcome to Sigma</b> is where to learn Sigma: a guide, and the design system used by Sigma’s interface. Tokens, Foundations and Components document its Light and Dark appearances. Pages and UI shows complete Sigma screens on a design canvas. Open the <b>Guide</b> first; it explains everything, page by page, with examples to try.</p>
  <p class="muted">These files are playgrounds: try editing their designs, tokens and icons. Changes reset when you leave the file or refresh. <b>Make an editable copy</b> in the Σ menu keeps your current edits as a file of your own; the card’s ⋯ menu copies the original.</p>
</div>`;
const WELCOME_DESIGN_DESCRIPTIONS = {
  Foundations: 'Sigma’s interface foundations: colors, typography, spacing, radii and sizing, bound to Tokens.',
  Components: 'Sigma’s UI components, with states and Light/Dark specimens bound to Tokens.',
  'Pages and UI': 'Complete Sigma desktop screens on a design canvas: files home, design editor, Tokens and Icons. Interface layers are editable in a copy; SVG artwork is embedded.',
};
const SAMPLE_DESCRIPTIONS = {
  design: 'The guide. Ten pages, each with a short explanation and examples: the canvas, layout, components, design tokens, style, quality checks, libraries and versions, tokens files and icons files.',
  tokens: 'Sigma’s interface tokens from styles.css: colors, typography, spacing, radii and component values, in Light and Dark modes.',
  icons: 'Sigma’s own UI glyphs, used by the interface and Welcome components.',
};

// `describe`: a sample file's card also says what the file holds (in the Welcome to Sigma folder).
function card(f, { describe = false } = {}) {
  let thumb = '';
  if (f.thumbnail instanceof Blob) {
    const url = URL.createObjectURL(f.thumbnail);
    thumbURLs.push(url);
    thumb = `<img src="${url}" alt="" draggable="false">`;
  }
  const kind = fileKind(f), tokens = kind !== 'design'; // no canvas: shown on white
  const sample = isSampleFile(f);
  if (!thumb && tokens) thumb = `<span class="thumb-placeholder">${kind === 'icons' ? NAV_ICONS : NAV_TOKENS}</span>`;
  const name = renaming === f.id
    ? `<input class="rename-input" value="${esc(f.name)}" spellcheck="false">`
    : `<div class="card-name" title="${esc(f.name)}">${esc(f.name)}</div>`;
  return `<a class="file-card${tokens ? ' tokens' : ''}" href="${fileHref(f.id)}" data-id="${f.id}" draggable="false">
    <div class="file-thumb" style="background:${tokens ? '#FFFFFF' : esc(f.background || '#F5F5F5')}">${thumb}</div>
    <div class="file-info">${name}${f.sourceName?`<div class="file-source">${esc(f.sourceName)}</div>`:''}${sample ? '' // Welcome to Sigma's files: just the name and what they are (no badges; never edited)
      : `<div class="file-time">Edited ${ago(f.updatedAt)}</div>`}${describe && sample && SAMPLE_DESCRIPTIONS[kind] ? `<div class="card-desc">${(WELCOME_DESIGN_DESCRIPTIONS[f.name] || SAMPLE_DESCRIPTIONS[kind])}</div>` : ''}</div>
    <div class="file-created">${sample ? '' : new Date(f.createdAt).toLocaleDateString()}</div>
    <button class="icon-btn file-more" data-more title="More actions">${MORE_ICON}</button>
  </a>`;
}

const NAV_DESIGN = lucideIcon('frame',14);
const NAV_WELCOME = lucideIcon('book-open',14);
const NAV_REPORT = lucideIcon('chart-no-axes-column',14);
const NAV_PROPOSALS = lucideIcon('git-pull-request',14);
const NAV_RECENTS = lucideIcon('rotate-ccw-clock',14);
const NAV_DRAFTS = lucideIcon('file',14);
const NAV_ARCHIVE = lucideIcon('archive',14);
const kindBadge = (kind) => (kind === 'tokens' ? '<span class="kind-badge">Tokens</span>' : kind === 'icons' ? '<span class="kind-badge">Icons</span>' : '');

const NAV_ICONS = lucideIcon('shapes',14);
const NAV_TOKENS = lucideIcon('variable',14);

const MORE_ICON = lucideIcon('ellipsis',16);
