// The files home: lists every Sigma file stored in this browser.
import {
  listFiles, createFile, renameFile, duplicateFile, deleteFile, downloadFile, importFiles, pickFilesToImport,
  storageSummary, openFile, fileHref, fileKind, newTokenDocument, createSampleFiles, createSampleTokenFile,
} from './files.js';
import { blankDocument } from './sample.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';
import { toast } from './io.js';

const PREFS_KEY = 'sigma.home.prefs';
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
} catch {}

const SECTIONS = { recents: 'Recents', design: 'Design files', tokens: 'Design tokens' };
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
      <nav class="home-nav">
        <button class="nav-item" data-section="recents">Recents</button>
        <div class="nav-label">Files</div>
        <button class="nav-item" data-section="design">${NAV_DESIGN} Design files</button>
        <button class="nav-item" data-section="tokens">${NAV_TOKENS} Design tokens</button>
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
          <span class="split-btn"><button class="btn" id="home-new-tokens">${icons.plus} New token file</button><button class="btn split-more" id="home-new-tokens-more" title="More token files">${icons.chevronDown}</button></span>
          <button class="btn primary" id="home-new">${icons.plus} New design file</button>
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
  root.querySelector('#home-new-tokens-more').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showContextMenu(r.right - 220, r.bottom + 4, [
      { label: 'Blank token file', action: newTokenFile },
      { label: 'Sample token file', action: newSampleTokenFile },
    ]);
  });
  root.querySelector('#home-import').addEventListener('click', async () => {
    const ids = await pickFilesToImport();
    afterImport(ids);
  });

  const list = root.querySelector('#home-files');
  list.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    const action = e.target.closest('[data-empty-action]');
    if (action) {
      e.preventDefault();
      const act = action.dataset.emptyAction;
      if (act === 'sample-tokens') return newSampleTokenFile();
      return act === 'sample' ? newSampleFile() : act === 'tokens' ? newTokenFile() : newBlankFile();
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

// ---------- actions ----------
async function newTokenFile() {
  openFile(await createFile(newTokenDocument()));
}

async function newBlankFile() {
  openFile(await createFile(blankDocument()));
}

// The sample comes as the sample token file plus a design file that links it.
async function newSampleFile() {
  openFile(await createSampleFiles());
}

// A complete sample design system: primitives, semantic Light/Dark colors, a brand, text styles and
// component tokens, published so design files can link it right away.
async function newSampleTokenFile() {
  const lib = await createSampleTokenFile();
  openFile(lib.id);
}

function afterImport(ids) {
  if (!ids.length) return;
  toast(ids.length === 1 ? 'Imported 1 file' : `Imported ${ids.length} files`);
  renderHome();
}

function fileMenu(id, x, y) {
  showContextMenu(x, y, [
    { label: 'Open', action: () => openFile(id) },
    { label: 'Open in new tab', action: () => window.open(fileHref(id), '_blank') },
    '-',
    { label: 'Rename', action: () => startRename(id) },
    { label: 'Duplicate', action: async () => {
      await duplicateFile(id);
      renderHome();
    } },
    { label: 'Download .sigma.json', action: () => downloadFile(id) },
    '-',
    { label: 'Delete…', action: () => confirmDelete(id) },
  ]);
}

async function confirmDelete(id) {
  const meta = (await listFiles()).find((f) => f.id === id);
  if (!meta || !confirm(`Delete “${meta.name}”? This can't be undone. Download it first if you want a copy.`)) return;
  await deleteFile(id);
  toast(`Deleted “${meta.name}”`);
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
  if (!SECTIONS[prefs.section]) prefs.section = 'recents';
  let files = await listFiles();
  const total = files.length;
  const section = prefs.section;
  if (section !== 'recents') files = files.filter((f) => fileKind(f) === section);
  const inSection = files.length;

  root.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.section === section));
  root.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === prefs.layout));
  const recents = section === 'recents';
  root.querySelector('#home-title').textContent = SECTIONS[section];
  // The primary "New" button matches the section you're in.
  root.querySelector('#home-new').classList.toggle('primary', section !== 'tokens');
  root.querySelector('#home-new-tokens').classList.toggle('primary', section === 'tokens');
  root.querySelector('#home-new-tokens-more').classList.toggle('primary', section === 'tokens');
  const sortSel = root.querySelector('#home-sort');
  sortSel.hidden = recents;
  sortSel.value = prefs.sort;

  const q = query.trim().toLowerCase();
  if (q) files = files.filter((f) => f.name.toLowerCase().includes(q));
  const sort = recents ? 'edited' : prefs.sort;
  files.sort((a, b) => sort === 'name'
    ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt);
  if (recents && !q) files = files.slice(0, 24);

  root.querySelector('#home-notice').innerHTML = notice
    ? `<div class="home-notice">${esc(notice)} <button class="icon-btn" data-dismiss>${icons.close}</button></div>`
    : '';
  root.querySelector('[data-dismiss]')?.addEventListener('click', () => {
    notice = '';
    renderHome();
  });

  for (const u of thumbURLs) URL.revokeObjectURL(u);
  thumbURLs = [];
  const list = root.querySelector('#home-files');
  list.className = `home-files ${prefs.layout}`;

  if (!total) {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">Create your first file</div>
      <p>Files are saved in this browser. You can also drag <b>.sigma.json</b> files here to import them.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="blank">${icons.plus} New design file</button>
      <button class="btn" data-empty-action="sample">Open the sample file</button></div></div>`;
  } else if (!inSection && section === 'tokens') {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No token files yet</div>
      <p>A token file holds your design tokens — colors, spacing, type — for design files to use. It has no canvas.</p>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="tokens">${icons.plus} New token file</button>
      <button class="btn" data-empty-action="sample-tokens">Open the sample token file</button></div></div>`;
  } else if (!inSection) {
    list.innerHTML = `<div class="home-empty"><div class="home-empty-title">No design files yet</div>
      <div class="home-empty-actions"><button class="btn primary" data-empty-action="blank">${icons.plus} New design file</button>
      <button class="btn" data-empty-action="sample">Open the sample file</button></div></div>`;
  } else if (!files.length) {
    list.innerHTML = `<div class="home-empty"><p>No files match “${esc(query)}”.</p></div>`;
  } else {
    list.innerHTML = files.map(card).join('');
  }
  root.querySelector('#home-storage').textContent = await storageSummary();
}

function card(f) {
  let thumb = '';
  if (f.thumbnail instanceof Blob) {
    const url = URL.createObjectURL(f.thumbnail);
    thumbURLs.push(url);
    thumb = `<img src="${url}" alt="" draggable="false">`;
  }
  const tokens = fileKind(f) === 'tokens';
  if (!thumb && tokens) thumb = `<span class="thumb-placeholder">${NAV_TOKENS}</span>`;
  const name = renaming === f.id
    ? `<input class="rename-input" value="${esc(f.name)}" spellcheck="false">`
    : `<div class="card-name" title="${esc(f.name)}">${esc(f.name)}</div>`;
  return `<a class="file-card${tokens ? ' tokens' : ''}" href="${fileHref(f.id)}" data-id="${f.id}" draggable="false">
    <div class="file-thumb" style="background:${tokens ? '#FFFFFF' : esc(f.background || '#F5F5F5')}">${thumb}</div>
    <div class="file-info">${name}<div class="file-time">${tokens ? '<span class="kind-badge">Tokens</span>' : ''}Edited ${ago(f.updatedAt)}</div></div>
    <div class="file-created">${new Date(f.createdAt).toLocaleDateString()}</div>
    <button class="icon-btn file-more" data-more title="More actions">${MORE_ICON}</button>
  </a>`;
}

const NAV_DESIGN = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M4.5 1.5v11M9.5 1.5v11M1.5 4.5h11M1.5 9.5h11"/></svg>';
const NAV_TOKENS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M7 1.2l5 2.9v5.8L7 12.8 2 9.9V4.1z"/><circle cx="7" cy="7" r="1.6"/></svg>';

const MORE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="12.5" cy="8" r="1.25"/></svg>';
