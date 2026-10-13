// The files home. Standalone, it lists the Sigma files stored in this browser. In a project (Part F, Phase 31)
// the same sections list the project's files (its .sigma/ folder), proposals get a section of their own, and
// files kept only in the browser are hidden (they can be moved into the project).
import {
  listFiles, createFile, renameFile, duplicateFile, deleteFile, downloadFile, importFiles, pickFilesToImport,
  listArchivedFiles, archiveFile, restoreFile, emptyArchive,
  storageSummary, openFile, fileHref, fileKind, newTokenDocument, newIconsDocument, welcomeFile, sampleTokenFile, isSampleFile,
  loadFile, addOptics,
} from './files.js';
import { blankDocument } from './sample.js';
import { ICON_SETS, iconSetDocument, loadIconSet } from './icon-library.js';
import {
  project, onProjectChange, projectListing, openProjectFile, newProjectFile,
} from './project.js';
import { openProposeDialog, changesetListing } from './propose.js';
import { buildLibraryFromCode } from './code-check.js';
import { useReport, REPORT_KINDS, formatShare } from './use-report.js';
import { fromProjectFile } from './project-format.js';
import { showContextMenu } from './menu.js';
import { modal } from './libraries.js';
import { icons } from './icons.js';
import { toast } from './io.js';

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

const SECTIONS = { report: 'Design system report', proposals: 'Proposals', recents: 'Recents', design: 'Sigma Design', tokens: 'Sigma Tokens', icons: 'Sigma Icons', welcome: 'Welcome to Sigma', archive: 'Archive' };

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
  root.innerHTML = `
    <aside class="home-side">
      <div class="home-brand">${icons.logo}<span>Sigma</span></div>
      <div class="home-project" id="home-project"></div>
      <nav class="home-nav">
        <button class="nav-item" data-section="recents">Recents</button>
        <div class="nav-label">Files</div>
        <button class="nav-item" data-section="design">${NAV_DESIGN} Sigma Design</button>
        <button class="nav-item" data-section="tokens">${NAV_TOKENS} Sigma Tokens</button>
        <button class="nav-item" data-section="icons">${NAV_ICONS} Sigma Icons</button>
        <button class="nav-item" data-section="proposals" id="nav-proposals" title="Changes proposed from Sigma, and their pull requests" hidden>${NAV_PROPOSALS} Proposals</button>
        <button class="nav-item" data-section="report" title="How much of the design files comes from the design system">${NAV_REPORT} Report</button>
        <div class="nav-spacer"></div>
        <button class="nav-item nav-welcome" data-section="welcome" title="The guide to Sigma and its sample tokens">${NAV_WELCOME} Welcome to Sigma</button>
        <button class="nav-item" data-section="archive" id="nav-archive" title="Deleted files, until you delete them forever">${NAV_ARCHIVE} Archive</button>
      </nav>
      <div class="home-storage" id="home-storage"></div>
    </aside>
    <main class="home-main">
      <header class="home-header">
        <h1 id="home-title"></h1>
        <div class="home-tools">
          <input type="search" id="home-search" class="home-search" placeholder="Search files" spellcheck="false">
          <select id="home-sort" class="select" title="Sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <div class="seg home-layout">
            <button class="icon-btn" data-layout="grid" title="Grid view">${GRID_ICON}</button>
            <button class="icon-btn" data-layout="list" title="List view">${LIST_ICON}</button>
          </div>
          <button class="btn" id="home-import">Import</button>
          <span class="split-btn"><button class="btn" id="home-new-icons" title="New Sigma Icons file">${icons.plus} Sigma Icons</button><button class="btn split-more" id="home-new-icons-more" title="More Sigma Icons options">${icons.chevronDown}</button></span>
          <span class="split-btn"><button class="btn" id="home-new-tokens" title="New Sigma Tokens file">${icons.plus} Sigma Tokens</button><button class="btn split-more" id="home-new-tokens-more" title="More Sigma Tokens options">${icons.chevronDown}</button></span>
          <button class="btn primary" id="home-new" title="New Sigma Design file">${icons.plus} Sigma Design</button>
        </div>
      </header>
      <div id="home-notice"></div>
      <div id="home-files"></div>
    </main>
    <div class="home-drop" id="home-drop" hidden><div>Drop <b>.sigma.json</b> or <b>tokens.json</b> files to import them</div></div>`;

  root.querySelector('.home-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (!b) return;
    prefs.section = b.dataset.section;
    savePrefs();
    renderHome();
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
  root.querySelector('#home-new').addEventListener('click', () => newBlankFile());
  root.querySelector('#home-new-tokens').addEventListener('click', () => newTokenFile());
  root.querySelector('#home-new-icons').addEventListener('click', () => newIconsFile());
  onProjectChange(() => !root.hidden && renderHome());
  window.addEventListener('sigma:changesets', () => !root.hidden && renderHome());
  root.querySelector('#home-new-icons-more').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showContextMenu(r.right - 240, r.bottom + 4, [
      { label: 'Blank Sigma Icons file', action: newIconsFile },
      '-',
      ...ICON_SETS.map((set) => ({ label: `${set.name} (${set.note})`, action: () => newIconSetFile(set) })),
    ]);
  });
  root.querySelector('#home-new-tokens-more').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showContextMenu(r.right - 220, r.bottom + 4, [
      { label: 'Blank Sigma Tokens file', action: newTokenFile },
      { label: 'Open sample tokens', action: openSampleTokenFile },
      '-',
      { label: 'Add Optics design system', action: addOpticsFiles },
    ]);
  });
  root.querySelector('#home-import').addEventListener('click', async () => {
    const ids = await pickFilesToImport();
    afterImport(ids);
  });

  const list = root.querySelector('#home-files');
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-propose-change]')) return openProposeDialog();
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
      if (act === 'sample-tokens') return openSampleTokenFile();
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
    if (e.target.closest('input')) e.preventDefault(); // typing a new name must not open the file
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
    if (projectMode()) return toast('In a project, Sigma files live in its .sigma/ folder: add them there (or have the sync skill import tokens and icons).');
    const files = [...e.dataTransfer.files].filter((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
    if (!files.length) return toast('Only .sigma.json and tokens.json files can be imported here.');
    afterImport(await importFiles(files));
  });

  setInterval(() => !root.hidden && renderHome(), 60_000); // keep "Edited … ago" fresh
}

const GRID_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>';
const LIST_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg>';

export function setHomeNotice(msg) {
  notice = msg || '';
}

// ---------- the project ----------
const NAV_PROJECT = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path d="M5 8.5l1.5-1.5L5 5.5M7.5 9.5h2"/></svg>';

// In a project, Sigma works on its files: the sections list them, and new files go into it.
const projectMode = () => !!project.name;

// The top of the sidebar: the project Sigma runs in (nothing, standalone: Sigma doesn't open projects itself).
function renderProjectNav() {
  const el = root.querySelector('#home-project');
  el.hidden = !projectMode();
  if (projectMode()) {
    el.innerHTML = `<div class="project-chip" title="${project.connected ? 'The Sigma files are in this project’s .sigma/ folder' : 'Sigma’s server for this project stopped: run npm run sigma in the project again'}">${NAV_PROJECT}<span class="project-name">${esc(project.name)}</span><span class="project-state ${project.connected ? 'ok' : 'off'}">${project.connected ? 'Connected' : 'Offline'}</span></div>`;
  }
  root.querySelector('#nav-proposals').hidden = !projectMode();
  root.querySelector('#nav-archive').hidden = projectMode(); // git is the history of project files
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
    <div class="file-time">${kindBadge(f.kind)}${f.package ? `<span class="kind-badge sample" title="From the design system package ${esc(f.package)}: read-only here; change it in the package">${esc(f.package)}${f.version ? ` ${esc(f.version)}` : ''}</span>` : ''}${f.kind === 'invalid' ? '<span class="kind-badge sample">Not readable</span>' : ''}${when || `<span>${esc(f.path.replace(/^\.sigma\//, ''))}</span>`}</div></div>
    <div class="file-created muted">${esc(f.path.replace(/^\.sigma\//, ''))}</div>
  </a>`;
}

const EMPTY_PROJECT = {
  design: ['No Sigma Design files in this project yet', 'Design pages and components on the project’s tokens and icons. The sync skill can also build them from the code (its components and pages).', 'blank', 'New Sigma Design file'],
  tokens: ['No Sigma Tokens files in this project yet', 'The project’s design tokens, kept in step with the code. The sync skill sets this up from the code’s tokens (skills/sigma-sync).', 'tokens', 'New Sigma Tokens file'],
  icons: ['No Sigma Icons files in this project yet', 'The project’s icons, kept in step with its icon folder. The sync skill sets this up (skills/sigma-sync).', 'icons', 'New Sigma Icons file'],
};

// Recents and the kind sections, in a project: the project's files.
async function renderProjectFiles(list, section, q) {
  let items = (await projectListing()).filter((f) => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  const recents = section === 'recents';
  if (!recents) items = items.filter((f) => f.kind === section);
  const edited = (f) => f.meta?.updatedAt || 0;
  const sort = recents ? 'edited' : prefs.sort;
  items.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    : sort === 'created' ? (b.meta?.createdAt || 0) - (a.meta?.createdAt || 0) : edited(b) - edited(a) || a.path.localeCompare(b.path)));
  if (recents && !q) items = items.slice(0, 24);
  const move = (await moveNotice()) + (section === 'design' || recents ? unbuiltLibraries() : '');
  if (items.length) {
    list.innerHTML = move + items.map(projectCard).join('');
    return;
  }
  if (q) {
    list.innerHTML = move + `<div class="home-empty"><p>No project files match “${esc(query)}”.</p></div>`;
    return;
  }
  const [title, text, act, label] = EMPTY_PROJECT[section] || ['No Sigma files in this project yet', 'Create one with the buttons above, or let the sync skill set the project up from its code (skills/sigma-sync).', 'blank', 'New Sigma Design file'];
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
  return (await listFiles()).filter((f) => !isSampleFile(f) && !f.project);
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
  if (projectMode() && project.connected) {
    const texts = {};
    for (const f of project.files.filter((x) => x.kind !== 'invalid')) {
      const r = await fetch(`/api/project/file?path=${encodeURIComponent(f.path)}`, { cache: 'no-store' });
      if (r.ok) texts[f.path] = await r.json();
    }
    const resolve = (p) => (texts[p] ? { fileId: p, file: texts[p] } : null);
    return project.files.filter((f) => f.kind === 'design' && texts[f.path]).map((f) => ({
      id: f.path, name: f.name, path: f.path, editedAt: Number(BigInt(f.mtime) / 1000000n),
      doc: fromProjectFile(structuredClone(texts[f.path]), { path: f.path, resolve }).doc,
    }));
  }
  const out = [];
  for (const meta of (await listFiles()).filter((f) => fileKind(f) === 'design' && !isSampleFile(f) && !f.project)) {
    const file = await loadFile(meta.id);
    if (file) out.push({ id: meta.id, name: meta.name, editedAt: meta.updatedAt, doc: file.doc });
  }
  return out;
}

let reportRun = 0;
async function renderReport(list) {
  const mine = ++reportRun;
  list.innerHTML = '<div class="home-empty"><p class="muted">Measuring…</p></div>';
  const files = await reportFiles();
  if (mine !== reportRun || prefs.section !== 'report') return; // a newer report (or another section) is showing
  const days = Number(prefs.reportDays || 0);
  const r = useReport(files, { since: days ? Date.now() - days * 86400000 : null, handoff: !!prefs.reportHandoff });
  const bar = (x) => `<span class="report-bar"><span style="width:${x === null ? 0 : Math.round(x * 100)}%"></span></span>`;
  const kinds = Object.entries(r.overall.kinds).filter(([, x]) => x.total);
  const filters = `<div class="report-filters">
      <label>Edited <select class="select" data-report-days>${[[0, 'any time'], [7, 'in the last 7 days'], [30, 'in the last 30 days'], [90, 'in the last 90 days']].map(([v, l]) => `<option value="${v}"${v === days ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-report-handoff${prefs.reportHandoff ? ' checked' : ''}> Only pages marked for handoff</label>
    </div>`;
  if (!files.length) {
    list.innerHTML = `<div class="report">${filters}<div class="home-empty"><p>No Sigma Design files to measure${projectMode() ? ' in this project' : ' in this browser'} yet.</p></div></div>`;
    return;
  }
  const rows = (items, cols) => items.map((it) => `<tr>${cols.map((c) => `<td${c.num ? ' class="num"' : ''}>${c.get(it)}</td>`).join('')}</tr>`).join('');
  list.innerHTML = `<div class="report">
    <p class="muted">How much of the design comes from the design system${projectMode() ? ` in ${esc(project.name)}` : ' in this browser'}: ${files.length} design file${files.length === 1 ? '' : 's'}. The same report on the command line: <code>npx sigma-design report</code>.</p>
    ${filters}
    <div class="report-cards">
      <div class="report-card"><div class="report-big">${formatShare(r.overall.componentShare)}</div><div>of layers are library components</div><div class="muted">${r.overall.instances} instances of ${r.overall.layers} layers on pages</div></div>
      <div class="report-card"><div class="report-big">${formatShare(r.overall.tokenShare)}</div><div>of values use tokens</div>
        <div class="report-kinds">${kinds.map(([k, x]) => `<div><span>${REPORT_KINDS[k]}</span>${bar(x.total ? x.bound / x.total : null)}<span class="num">${formatShare(x.total ? x.bound / x.total : null)}</span></div>`).join('')}</div></div>
    </div>
    <h3>Files</h3>
    <table class="report-table"><tr><th>File</th><th class="num">Library components</th><th class="num">Tokens</th><th class="num">Layers</th></tr>
      ${rows(r.files, [{ get: (f) => `${esc(f.name)}${f.path ? ` <span class="muted">${esc(f.path.replace(/^\.sigma\//, ''))}</span>` : ''}` }, { num: true, get: (f) => formatShare(f.componentShare) }, { num: true, get: (f) => formatShare(f.tokenShare) }, { num: true, get: (f) => f.layers }])}</table>
    <div class="report-columns">
      <div><h3>Most-used components</h3>${r.components.length ? `<table class="report-table">${rows(r.components.slice(0, 12), [{ get: (c) => esc(c.name) }, { num: true, get: (c) => c.uses }])}</table>` : '<p class="muted">None used yet.</p>'}
        <h3>Components nobody uses</h3>${r.unusedComponents.length ? `<table class="report-table">${rows(r.unusedComponents, [{ get: (c) => `${esc(c.name)} <span class="muted">${esc(c.library)}</span>` }])}</table>` : '<p class="muted">Every component is used.</p>'}</div>
      <div><h3>Most-used tokens</h3>${r.tokens.length ? `<table class="report-table">${rows(r.tokens.slice(0, 12), [{ get: (t) => esc(t.name) }, { num: true, get: (t) => t.uses }])}</table>` : '<p class="muted">None used yet.</p>'}
        <h3>Tokens nobody uses</h3>${r.unusedTokens.length ? `<table class="report-table">${rows(r.unusedTokens.slice(0, 40), [{ get: (t) => `${esc(t.name)} <span class="muted">${esc(t.file)}</span>` }])}</table>${r.unusedTokens.length > 40 ? `<p class="muted">…and ${r.unusedTokens.length - 40} more</p>` : ''}` : '<p class="muted">Every token is used (directly, or by another token).</p>'}</div>
    </div>
  </div>`;
  list.querySelector('[data-report-days]').addEventListener('change', (e) => {
    prefs.reportDays = Number(e.target.value);
    savePrefs();
    renderHome();
  });
  list.querySelector('[data-report-handoff]').addEventListener('change', (e) => {
    prefs.reportHandoff = e.target.checked;
    savePrefs();
    renderHome();
  });
}

// The Proposals section: changes proposed from Sigma, with their status, pull request and ticket.
async function renderProposals(list, q) {
  const all = project.connected ? await changesetListing() : [];
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
const inProjectSection = () => projectMode() && project.connected;
const create = async (doc) => {
  if (projectMode() && !project.connected) return toast('The project isn’t connected, so new files can’t be added to it.');
  return inProjectSection() ? newProjectFile(doc) : openFile(await createFile(doc));
};

async function newTokenFile() {
  await create(newTokenDocument());
}

async function newIconsFile() {
  await create(newIconsDocument());
}

// A Sigma Icons file with a free icon set (Lucide), published so Sigma Design files can link it.
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
async function openWelcome() {
  openFile(await welcomeFile());
}

// A complete sample design system: primitives, semantic Light/Dark colors, a brand, text styles and
// component tokens, published so design files can link it right away. Opens the existing one if there is one.
// Optics, the working design system, as three files of your own (Sigma Tokens ▾ → Add Optics design system).
async function addOpticsFiles() {
  toast('Adding Optics…');
  const ids = await addOptics();
  toast(`Added Optics: Optics Tokens, Optics Icons, Optics Foundations and Optics Components (${ids.length} files)`);
  renderHome();
}

async function openSampleTokenFile() {
  const lib = await sampleTokenFile();
  openFile(lib.id);
}

function afterImport(ids) {
  if (!ids.length) return;
  toast(ids.length === 1 ? 'Imported 1 file' : `Imported ${ids.length} files`);
  renderHome();
}

async function fileMenu(id, x, y) {
  const sample = isSampleFile((await listFiles()).find((f) => f.id === id));
  showContextMenu(x, y, [
    { label: 'Open', action: () => openFile(id) },
    { label: 'Open in new tab', action: () => window.open(fileHref(id), '_blank') },
    '-',
    ...(sample ? [] : [{ label: 'Rename', action: () => startRename(id) }]), // samples keep their names
    { label: 'Duplicate', action: async () => {
      await duplicateFile(id);
      renderHome();
    } },
    { label: 'Download .sigma.json', action: () => downloadFile(id) },
    '-',
    { label: 'Move to Archive', action: () => moveToArchive(id) },
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
  if (!meta || !confirm(`Delete “${meta.name}” forever? It and its version history are erased from this browser. This can't be undone; download it first if you want a copy.`)) return;
  await deleteFile(id);
  toast(`Deleted “${meta.name}” forever`);
  renderHome();
}

async function confirmEmptyArchive() {
  const n = (await listArchivedFiles()).length;
  if (!n || !confirm(`Delete all ${n} file${n === 1 ? '' : 's'} in the Archive forever? They and their version history are erased from this browser. This can't be undone.`)) return;
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

// ---------- render ----------
export async function renderHome() {
  if (!root) return;
  const pm = projectMode();
  // Proposals only exist in a project; the Archive only standalone (git is the history of project files).
  if (!SECTIONS[prefs.section] || (prefs.section === 'proposals' && !pm) || (prefs.section === 'archive' && pm)) prefs.section = 'recents';
  const section = prefs.section;
  const archive = section === 'archive';
  let files = await listFiles();
  const total = files.length;
  const welcome = section === 'welcome';
  const proposals = section === 'proposals';
  const report = section === 'report';
  const projectFiles = pm && !welcome && !proposals && !report; // Recents and the kind sections list the project's files
  if (archive) files = await listArchivedFiles();
  else if (welcome) files = files.filter(isSampleFile);
  else if (projectFiles || proposals || report) files = [];
  else if (section !== 'recents') files = files.filter((f) => fileKind(f) === section && !isSampleFile(f) && !f.project); // samples have their own section
  renderProjectNav();
  const inSection = files.length;

  root.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.section === section));
  root.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === prefs.layout));
  const recents = section === 'recents';
  root.querySelector('#home-title').textContent = SECTIONS[section];
  root.querySelector('#home-search').placeholder = proposals ? 'Search proposals' : 'Search files';
  root.querySelector('#home-import').hidden = pm; // imports land in the browser; a project's files come from the project
  root.querySelector('.home-layout').hidden = proposals || report;
  root.querySelector('#home-search').hidden = report;
  // The primary "New" button matches the section you're in.
  root.querySelector('#home-new').classList.toggle('primary', section !== 'tokens' && section !== 'icons');
  root.querySelector('#home-new-icons').classList.toggle('primary', section === 'icons');
  root.querySelector('#home-new-icons-more').classList.toggle('primary', section === 'icons');
  root.querySelector('#home-new-tokens').classList.toggle('primary', section === 'tokens');
  root.querySelector('#home-new-tokens-more').classList.toggle('primary', section === 'tokens');
  const sortSel = root.querySelector('#home-sort');
  sortSel.hidden = recents || archive || proposals || welcome || report;
  sortSel.value = prefs.sort;

  const q = query.trim().toLowerCase();
  if (q) files = files.filter((f) => f.name.toLowerCase().includes(q));
  const sort = recents ? 'edited' : archive ? 'archived' : prefs.sort;
  files.sort((a, b) => sort === 'archived' ? b.archivedAt - a.archivedAt : sort === 'name'
    ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt);
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

  if (report) {
    await renderReport(list);
  } else if (proposals) {
    await renderProposals(list, q);
  } else if (projectFiles) {
    await renderProjectFiles(list, section, q);
  } else if (welcome) {
    list.innerHTML = WELCOME_INTRO +
      (files.length ? files.sort((a, b) => KIND_ORDER.indexOf(fileKind(a)) - KIND_ORDER.indexOf(fileKind(b))).map((f) => card(f, { describe: true })).join('')
        : `<div class="home-empty"><div class="home-empty-title">Welcome to Sigma</div><p>The guide isn’t here (it may be in the Archive).</p>
          <div class="home-empty-actions"><button class="btn primary" data-empty-action="welcome">Open Welcome to Sigma</button></div></div>`);
  } else if (archive) {
    list.innerHTML = `<div class="archive-intro"><p class="muted">Deleted files wait here until you delete them forever. Restore one to open it again.</p>` +
      (files.length ? '<button class="btn" data-empty-archive>Empty Archive…</button>' : '') + '</div>' +
      (files.length ? files.map(archivedCard).join('') : `<div class="home-empty"><p>${q ? `No archived files match “${esc(query)}”.` : 'The Archive is empty.'}</p></div>`);
  } else if (!total) {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">Create your first file</div>
      <p>Files are saved in this browser. You can also drag <b>.sigma.json</b> files here to import them.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="blank">${icons.plus} New Sigma Design file</button>
      <button class="btn" data-empty-action="welcome">Open Welcome to Sigma</button></div></div>`;
  } else if (!inSection && section === 'tokens') {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No Sigma Tokens files yet</div>
      <p>A Sigma Tokens file holds your design tokens (colors, spacing, type, shadows, motion) for Sigma Design files to use. It has no canvas.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="tokens">${icons.plus} New Sigma Tokens file</button>
      <button class="btn" data-empty-action="sample-tokens">Open the sample tokens</button></div></div>`;
  } else if (!inSection && section === 'icons') {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No Sigma Icons files yet</div>
      <p>A Sigma Icons file holds icons imported from SVG (from a free icon set, for example). Components in Sigma Design files pick their icons from it. It has no canvas.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="icons">${icons.plus} New Sigma Icons file</button>
      ${ICON_SETS.map((s) => `<button class="btn" data-empty-action="icon-set" data-set="${s.id}">Add ${esc(s.name)} icons</button>`).join('')}</div></div>`;
  } else if (!inSection) {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No Sigma Design files yet</div>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="blank">${icons.plus} New Sigma Design file</button>
      <button class="btn" data-empty-action="welcome">Open Welcome to Sigma</button></div></div>`;
  } else if (!files.length) {
    list.innerHTML = `<div class="home-empty"><p>No files match “${esc(query)}”.</p></div>`;
  } else {
    list.innerHTML = files.map(card).join('');
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
    <div class="file-info"><div class="card-name" title="${esc(f.name)}">${esc(f.name)}</div><div class="file-time">${kindBadge(kind)}Archived ${ago(f.archivedAt)}</div></div>
    <button class="btn archive-restore" data-restore>Restore</button>
    <button class="icon-btn file-more" data-more title="More actions">${MORE_ICON}</button>
  </div>`;
}

// The Welcome to Sigma folder: what it's for, and (on each card) what each sample file holds.
const WELCOME_INTRO = `<div class="welcome-intro">
  <p><b>Welcome to Sigma</b> is where to learn Sigma: a guide, and the small design system it's built with. Open <b>Sigma Design</b> first; it explains everything, page by page, with examples to try.</p>
  <p class="muted">These are sample files: open them and try anything. Nothing in them is saved, so they're back to the original whenever you open them again. <b>Duplicate to keep changes</b> (in the banner) makes a copy of your own, which goes with your files.</p>
</div>`;
const SAMPLE_DESCRIPTIONS = {
  design: 'The guide. Ten pages, each with a short explanation and examples: the canvas, layout, components, design tokens, style, quality checks, libraries and versions, Sigma Tokens and Sigma Icons.',
  tokens: 'The design tokens the guide is built with: primitives, semantic colors in Light and Dark, a Brand B, text styles and component tokens.',
  icons: 'The icons the guide’s components use: a selection of Lucide icons in groups, outline and filled.',
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
    <div class="file-info">${name}<div class="file-time">${kindBadge(kind)}${sample
      ? `<span class="kind-badge sample" title="A sample file: try anything; nothing is saved, and it resets when reopened">Sample</span>${tokens ? 'For the guide' : 'Guide to Sigma'}` // never edited, so no "Edited … ago"
      : `Edited ${ago(f.updatedAt)}`}</div>${describe && sample && SAMPLE_DESCRIPTIONS[kind] ? `<div class="card-desc">${SAMPLE_DESCRIPTIONS[kind]}</div>` : ''}</div>
    <div class="file-created">${sample ? '' : new Date(f.createdAt).toLocaleDateString()}</div>
    <button class="icon-btn file-more" data-more title="More actions">${MORE_ICON}</button>
  </a>`;
}

const NAV_DESIGN = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M4.5 1.5v11M9.5 1.5v11M1.5 4.5h11M1.5 9.5h11"/></svg>';
const NAV_WELCOME = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><circle cx="7" cy="7" r="5.5"/><path d="M5.6 5.4a1.5 1.5 0 1 1 2 1.4c-.4.2-.6.5-.6.9v.4M7 10v.1"/></svg>';
const NAV_REPORT = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M2 12.5h10M3.5 10V7M7 10V3.5M10.5 10V5.5"/></svg>';
const NAV_PROPOSALS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><circle cx="3.5" cy="3" r="1.5"/><circle cx="3.5" cy="11" r="1.5"/><circle cx="10.5" cy="11" r="1.5"/><path d="M3.5 4.5v5M10.5 9.5V6a2 2 0 0 0-2-2H6.5M8 2.5 6.5 4 8 5.5"/></svg>';
const NAV_ARCHIVE = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><rect x="1.5" y="2" width="11" height="3" rx=".5"/><path d="M2.5 5v6.5h9V5M5.5 7.5h3"/></svg>';
const kindBadge = (kind) => (kind === 'tokens' ? '<span class="kind-badge">Tokens</span>' : kind === 'icons' ? '<span class="kind-badge">Icons</span>' : '');

const NAV_ICONS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M7 1.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.7l-3.2 1.7.6-3.6L1.8 5.3l3.6-.5z" stroke-linejoin="round"/></svg>';
const NAV_TOKENS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M7 1.2l5 2.9v5.8L7 12.8 2 9.9V4.1z"/><circle cx="7" cy="7" r="1.6"/></svg>';

const MORE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="12.5" cy="8" r="1.25"/></svg>';
