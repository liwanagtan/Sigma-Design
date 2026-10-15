import { layOutDocument } from './lay-out.js';
import { focusToken, openVariablesEditor, closeVariablesEditor } from './variables-ui.js';
import { setTerminalContext } from './terminal.js';
import { recordFileOpened, initializeProjects, selectedProjectId, selectProject, projectList, resolveProjectId, scopeHref } from './projects.js';
import './select.js';
import { applyWelcomeAppearance } from './welcome-appearance.js';
import { appearanceButtonHTML, appearance } from './appearance.js';
import {
  state, page, view, subscribe, emit, normalizeDocument, addNormalizer, loadDocument, unloadDocument, walk, cancelPendingSave,
  commit, forgetUndo, select, getNode, pageOf,
} from './store.js';
import { collections } from './variables.js';
import { renderScene, applyViewTransform, renderOverlay } from './render.js';
import { initInteractions, refreshCursor } from './interact.js';
import { initTextEditor, positionEditor, measureText, stopEditing } from './text.js';
import { setViewportElement, zoomToFit, zoomToSelection } from './commands.js';
import {
  initPanels, renderLayers, renderProps, renderPages, renderToolbar, renderZoomLabel, renderFileHeader, highlightLayerHover,
  renderAssets, renderCommentsList,
} from './panels.js';
import { initRail, renderRail } from './rail.js';
import { resizerHTML } from './columns.js';
import { initComments, renderCommentPins } from './comments.js';
import {
  initFiles, loadFile, setCurrentFile, closeCurrentFile, discardCurrentFile, saveNow, getCurrentFileId, goHome, fileKind, isArchived,
  welcomeOnFirstVisit, welcomeFile, refreshSigmaPages, openFile, isSampleFile, isCurrentSample,
} from './files.js';
import { initHome, renderHome, setHomeNotice, showHomeSection } from './home.js';
import { initTokensScreen, showTokensScreen, hideTokensScreen } from './tokens-screen.js';
import { initIconsScreen, showIconsScreen, hideIconsScreen } from './icons-screen.js';
import { checkLibraryUpdates, migrateLegacyTokens, usesLibrary, repairIcons } from './libraries.js';
import { hideContextMenu } from './menu.js';
import { arrangeWelcome } from './welcome.js';
import { clearViewing, resetHistory } from './history.js';
import { connectProject, saveToProject, project, syncOpenProjectFile } from './project.js';

const appEl = document.getElementById('app');
document.querySelector('#design-appearance').innerHTML = appearanceButtonHTML();
appEl.insertAdjacentHTML('beforeend', resizerHTML('left') + resizerHTML('right')); // drag a panel's edge to resize it
const homeEl = document.getElementById('home');
const tokensEl = document.getElementById('tokens');
const iconsEl = document.getElementById('icons');
const canvas = document.getElementById('canvas');
const world = document.getElementById('world');
const overlay = document.getElementById('overlay');
const banner = document.getElementById('file-banner');

const dirty = { scene: true, view: true, overlay: true, panels: true, layers: true, tool: true };
let scheduled = false;

subscribe((kind) => {
  if (kind === 'doc') Object.assign(dirty, { scene: true, overlay: true, panels: true, layers: true });
  else if (kind === 'selection') Object.assign(dirty, { overlay: true, panels: true, layers: true });
  else if (kind === 'view') Object.assign(dirty, { view: true, overlay: true });
  else if (kind === 'overlay') Object.assign(dirty, { overlay: true, hover: true });
  else if (kind === 'tool') Object.assign(dirty, { tool: true, panels: true, overlay: true });
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(frame);
  }
});

function frame() {
  scheduled = false;
  if (state.screen !== 'editor' || !state.doc) return; // keep dirty flags for when a file opens
  if (dirty.scene) {
    normalizeDocument();
    renderScene(world);
  }
  if (dirty.view || dirty.scene) {
    applyViewTransform(world);
    renderZoomLabel();
  }
  if (dirty.overlay) renderOverlay(overlay);
  if (dirty.view || dirty.scene || dirty.tool) renderCommentPins();
  if (dirty.view || dirty.scene) positionEditor();
  if (dirty.layers) {
    renderLayers();
    renderPages();
    renderFileHeader();
    renderAssets();
    renderCommentsList();
  } else if (dirty.hover) {
    highlightLayerHover();
  }
  if (dirty.panels) renderProps();
  if (dirty.layers || dirty.panels) renderRail();
  if (dirty.tool) {
    renderToolbar();
    refreshCursor();
  }
  for (const k of Object.keys(dirty)) dirty[k] = false;
}

function remeasureAllText() {
  if (!state.doc) return;
  for (const pg of state.doc.pages) walk(pg.children, (n) => void (n.type === 'text' && measureText(n)));
  normalizeDocument();
  emit('doc');
}

// ---------- banner (changes from other tabs) ----------
// `extra`: more buttons after the main one, [{ label, action }].
function showBanner(text, actionLabel, action, extra = []) {
  const actions = [{ label: actionLabel, action }, ...extra];
  banner.innerHTML = `<span>${text}</span>${actions.map((a) => `<button class="btn">${a.label}</button>`).join('')}`;
  banner.querySelectorAll('button').forEach((b, i) => (b.onclick = actions[i].action));
  banner.hidden = false;
}
const hideBanner = () => void (banner.hidden = true);
// Other modules raise or clear the banner with a 'sigma:banner' event ({ text, label, action, extra } or null).
window.addEventListener('sigma:banner', (e) => (e.detail ? showBanner(e.detail.text, e.detail.label, e.detail.action, e.detail.extra) : hideBanner()));

// Version history swapped the document for an older version (read-only) …
window.addEventListener('sigma:doc-replaced', () => {
  if (state.screen === 'tokens') showTokensScreen();
  else if (state.screen === 'icons') showIconsScreen();
  else remeasureAllText();
  emit('view');
});
// … or needs the open file reloaded from storage (back to current, after a restore).
window.addEventListener('sigma:reopen', (e) => {
  const id = getCurrentFileId();
  routing = routing.then(() => id && showFile(id, { force: true, discard: true })).finally(e.detail);
});

function syncWelcomeAppearance({ initial = false } = {}) {
  if (!isCurrentSample() || state.screen !== 'editor' || !state.doc || state.readOnly) return;
  if (!applyWelcomeAppearance(state.doc, collections(), appearance())) return;
  commit();
  if (initial) forgetUndo();
}
window.addEventListener('sigma:appearance', () => syncWelcomeAppearance());
window.addEventListener('sigma:figma-imported', async event => {
  const { showFigmaImportReport } = await import('./figma-import-ui.js');
  showFigmaImportReport(event.detail);
});

// ---------- screens ----------
// `discard`: drop unsaved local changes instead of writing them (reloading another tab's version).
async function leaveEditor({ discard = false } = {}) {
  setTerminalContext(null);
  closeVariablesEditor();
  document.querySelectorAll('[data-report-return]').forEach(el=>el.remove());
  if (!getCurrentFileId()) return;
  clearViewing(); // an older version on screen is never saved over the file
  if (state.editingTextId) stopEditing();
  hideContextMenu();
  if (discard) {
    cancelPendingSave();
    discardCurrentFile();
  } else {
    await closeCurrentFile();
  }
  hideTokensScreen();
  hideIconsScreen();
  unloadDocument();
  hideBanner();
}

async function showHome() {
  resetHistory();
  await leaveEditor();
  state.viewOnly = false;
  document.body.classList.remove('view-only');
  state.screen = 'home';
  appEl.hidden = true;
  tokensEl.hidden = true;
  iconsEl.hidden = true;
  homeEl.hidden = false;
  document.title = 'Sigma – Files';
  await renderHome();
}

async function showFile(id, { force = false, discard = false } = {}) {
  if (!force && state.screen !== 'home' && getCurrentFileId() === id) { applyReportTarget(); return; }
  const file = await loadFile(id);
  if (!file) {
    setHomeNotice('That file could not be found. It may have been deleted.');
    return goHome();
  }
  selectProject(file.meta.projectId||null,{notify:false});
  showHomeSection(fileKind(file.meta));
  if (isArchived(file.meta)) {
    setHomeNotice(`“${file.meta.name}” is in the Archive. Restore it to open it.`);
    showHomeSection('archive');
    return goHome();
  }
  if (id !== getCurrentFileId()) resetHistory();
  await leaveEditor({ discard });
  await recordFileOpened(id);
  const sample = isSampleFile(file.meta);
  if(sample&&file.meta.welcome)file.doc.name=file.meta.name;
  state.viewOnly = false; // Welcome files allow temporary edits; persistence skips samples.
  document.body.classList.remove('view-only');
  setCurrentFile(id, { sample });
  setTerminalContext(file.meta);
  homeEl.hidden = true;
  if (fileKind(file.meta) === 'icons') {
    // Icon files have no canvas either: a grid of their icons.
    state.screen = 'icons';
    appEl.hidden = true;
    tokensEl.hidden = true;
    iconsEl.hidden = false;
    loadDocument(file.doc, file.views);
    showIconsScreen();
    applyReportTarget();
    syncOpenProjectFile();
    return;
  }
  iconsEl.hidden = true;
  if (fileKind(file.meta) === 'tokens') {
    // Token files have no canvas: the design token editor fills the screen.
    state.screen = 'tokens';
    appEl.hidden = true;
    tokensEl.hidden = false;
    loadDocument(file.doc, file.views);
    showTokensScreen();
    applyReportTarget();
    syncOpenProjectFile();
    checkLibraryUpdates(); // token files it points at may have published new versions
    return;
  }
  state.screen = 'editor';
  tokensEl.hidden = true;
  appEl.hidden = false;
  const wasVersion = file.doc.version || 1;
  loadDocument(file.doc, file.views);
  const requestedPage=new URLSearchParams(location.hash.split('?')[1]||'').get('page');
  const target=state.doc.pages.find(p=>p.name===requestedPage);if(target)state.doc.currentPageId=target.id;
  syncWelcomeAppearance({ initial:true });
  remeasureAllText();
  // "Welcome to Sigma": place its examples by their real sizes (each time it opens, since a sample is
  // never saved).
  if (arrangeWelcome(state.doc)) {
    commit();
    forgetUndo();
  }
  if (!state.pageViews[page().id]) requestAnimationFrame(() => getCurrentFileId() === id && state.screen === 'editor' && zoomToFit()); // unless you've left already
  emit('view');
  emit('tool');
  await migrateLegacyTokens(wasVersion);
  checkLibraryUpdates();
  await syncOpenProjectFile();
  repairIcons(); // icons in use the file has no copy of (pasted from another file)
  applyReportTarget();
}

// Report links select the actual page/layer and retain a direct route back to the measured scope.
function applyReportTarget() {
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  document.querySelectorAll('[data-report-return]').forEach(el=>el.remove());
  const owner=params.get('report');
  if(owner&&/^[\w-]{1,128}$/.test(owner)){
    const host=state.screen==='editor'?appEl.querySelector('.file-header'):state.screen==='tokens'?tokensEl.querySelector('.tokens-header'):iconsEl.querySelector('.tokens-header');
    if(host){const button=document.createElement('button');button.className='btn';button.dataset.reportReturn='';button.textContent='Back to Report';button.onclick=()=>{location.hash=scopeHref('report',owner==='drafts'?null:owner);};host.insertBefore(button,host.firstElementChild?.nextSibling||null);}
  }
  if(params.get('tokenId')&&state.doc){if(state.screen==='editor')openVariablesEditor();focusToken(params.get('tokenId'));}
  if(state.screen!=='editor'||!state.doc)return;
  const id=params.get('nodeId'),targetPage=state.doc.pages.find(p=>p.id===params.get('pageId'))||pageOf(id);
  if(targetPage&&state.doc.pages.includes(targetPage)){state.doc.currentPageId=targetPage.id;emit('doc');}
  if(id&&getNode(id)&&pageOf(id)===page()){
    select([id]);const file=getCurrentFileId();requestAnimationFrame(()=>{if(file===getCurrentFileId()&&state.screen==='editor')zoomToSelection();});
  }
}

let routing = Promise.resolve();
function route() {
  // Serialize navigations so a fast back/forward can't interleave saves and loads.
  routing = routing.then(async () => {
    const m=location.hash.match(/^#\/file\/([\w-]+)/);
    if(m)return showFile(m[1]);
    const scope=location.hash.match(/^#\/(drafts|project)\/(?:([^/]+)\/)?([^/?]*)/);
    if(scope){const id=scope[1]==='project'?await resolveProjectId(decodeURIComponent(scope[2]||'')):null;const valid=!id||(await projectList()).some(p=>p.id===id);selectProject(valid?id:null,{notify:false});showHomeSection(scope[1]==='drafts'?scope[2]||scope[3]||'drafts':scope[3]||'recents');}
    if(location.hash==='#/recents'){selectProject(null,{notify:false});showHomeSection('recents');}
    if(location.hash.startsWith('#/guide/'))showHomeSection('welcome');
    return showHome();
  }).catch((err) => {
    console.error(err);
    window.dispatchEvent(new CustomEvent('sigma:toast', { detail: `Something went wrong: ${err.message}` }));
  });
}

function onRemoteChange(msg) {
  const current = getCurrentFileId();
  if (msg.type === 'versions') return void window.dispatchEvent(new CustomEvent('sigma:versions', { detail: msg.id }));
  if (state.screen === 'home') return void renderHome();
  // A token file or component library this file uses published a new version.
  if (msg.type === 'published' && (state.screen === 'editor' || state.screen === 'tokens') && usesLibrary(msg.id)) {
    return void checkLibraryUpdates();
  }
  if (msg.id !== current) return;
  if (msg.type === 'saved') {
    showBanner('This file was changed in another tab.', 'Reload', () => {
      hideBanner();
      routing = routing.then(() => showFile(current, { force: true, discard: true }));
    });
  } else if (msg.type === 'deleted') {
    showBanner('This file was deleted in another tab. Changes here are no longer saved.', 'Back to files', goHome);
  } else if (msg.type === 'archived') {
    showBanner('This file was moved to the Archive in another tab. Changes here are no longer saved.', 'Back to files', goHome);
  } else if (msg.type === 'renamed') {
    loadFile(current).then((f) => {
      if (f && state.doc) {
        state.doc.name = f.meta.name;
        emit('selection');
      }
    });
  }
}

// ---------- boot ----------
// The normalize pipeline, in order (see store.normalizeDocument).
addNormalizer(layOutDocument);
initTextEditor(canvas);
setViewportElement(canvas);
initPanels();
initRail();
initInteractions(canvas);
initComments(canvas);
initHome(homeEl);
initTokensScreen(tokensEl);
initIconsScreen(iconsEl);

document.fonts?.ready.then(remeasureAllText);
document.fonts?.addEventListener?.('loadingdone', remeasureAllText);
window.addEventListener('resize', () => emit('view'));
window.addEventListener('hashchange', route);
// Save promptly when the tab is hidden or closed.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void saveNow();
});

// ⌘S saves the open file to the project (Sigma autosaves to the browser anyway).
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's') return;
  if (state.screen !== 'editor' && state.screen !== 'tokens' && state.screen !== 'icons') return;
  e.preventDefault(); // never the browser's "Save page"
  if (project.connected&&selectedProjectId()===project.identity) saveToProject();
  else window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Sigma saves as you work. To work on a codebase, run Sigma in it: npx sigma-design init, then npm run sigma.' }));
});

initFiles({ onRemoteChange })
  .then(async () => {
    await connectProject();
    const firstVisit=await welcomeOnFirstVisit();
    await welcomeFile();
    await initializeProjects(project);
    await refreshSigmaPages();
    if(firstVisit&&!/^#\/(file|project|drafts|guide)\//.test(location.hash))location.hash='#/guide/getting-started';
    return route();
  })
  .catch((err) => {
    console.error(err);
    homeEl.hidden = false;
    homeEl.innerHTML = `<div class="home-empty"><div class="home-empty-title">Sigma can't open its storage</div><p>${err.message}</p></div>`;
  });

// Handy for debugging from the console.
window.sigma = { state, view, emit };
