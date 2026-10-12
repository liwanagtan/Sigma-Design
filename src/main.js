import {
  state, page, view, subscribe, emit, normalizeDocument, addNormalizer, loadDocument, unloadDocument, walk, cancelPendingSave,
  fixGroups, commit, forgetUndo,
} from './store.js';
import { applyLayouts } from './layout.js';
import { syncInstances } from './components.js';
import { resolveVariables, normalizeTokenGroups } from './variables.js';
import { renderScene, applyViewTransform, renderOverlay } from './render.js';
import { initInteractions, refreshCursor } from './interact.js';
import { initTextEditor, positionEditor, measureText, stopEditing } from './text.js';
import { setViewportElement, zoomToFit } from './commands.js';
import {
  initPanels, renderLayers, renderProps, renderPages, renderToolbar, renderZoomLabel, renderFileHeader, highlightLayerHover,
  renderAssets,
} from './panels.js';
import {
  initFiles, loadFile, setCurrentFile, closeCurrentFile, discardCurrentFile, saveNow, getCurrentFileId, goHome, fileKind, isArchived,
  welcomeOnFirstVisit, openFile, isSampleFile, duplicateCurrent, updateThumbnail,
} from './files.js';
import { initHome, renderHome, setHomeNotice, showHomeSection } from './home.js';
import { initTokensScreen, showTokensScreen, hideTokensScreen } from './tokens-screen.js';
import { initIconsScreen, showIconsScreen, hideIconsScreen } from './icons-screen.js';
import { checkLibraryUpdates, migrateLegacyTokens, usesLibrary } from './libraries.js';
import { hideContextMenu } from './menu.js';
import { arrangeWelcome } from './welcome.js';
import { clearViewing, resetHistory } from './history.js';

const appEl = document.getElementById('app');
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
    canvas.style.backgroundColor = page().background || '#F5F5F5';
    renderZoomLabel();
  }
  if (dirty.overlay) renderOverlay(overlay);
  if (dirty.view || dirty.scene) positionEditor();
  if (dirty.layers) {
    renderLayers();
    renderPages();
    renderFileHeader();
    renderAssets();
  } else if (dirty.hover) {
    highlightLayerHover();
  }
  if (dirty.panels) renderProps();
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

// A sample file (Welcome to Sigma) is a playground: edits work but are never saved.
function sampleBanner() {
  showBanner('Sample file: try anything. Nothing is saved; it resets when you reopen it.', 'Duplicate to keep changes', async () => {
    const copy = await duplicateCurrent();
    if (!copy) return;
    window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Made a copy of your changes in Sigma Design' }));
    openFile(copy);
  }, [{ label: 'Dismiss', action: () => hideBanner() }]);
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

// ---------- screens ----------
// `discard`: drop unsaved local changes instead of writing them (reloading another tab's version).
async function leaveEditor({ discard = false } = {}) {
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
  state.screen = 'home';
  appEl.hidden = true;
  tokensEl.hidden = true;
  iconsEl.hidden = true;
  homeEl.hidden = false;
  document.title = 'Sigma – Files';
  await renderHome();
}

async function showFile(id, { force = false, discard = false } = {}) {
  if (!force && state.screen !== 'home' && getCurrentFileId() === id) return;
  const file = await loadFile(id);
  if (!file) {
    setHomeNotice('That file could not be found. It may have been deleted.');
    return goHome();
  }
  if (isArchived(file.meta)) {
    setHomeNotice(`“${file.meta.name}” is in the Archive. Restore it to open it.`);
    showHomeSection('archive');
    return goHome();
  }
  if (id !== getCurrentFileId()) resetHistory();
  await leaveEditor({ discard });
  const sample = isSampleFile(file.meta);
  setCurrentFile(id, { sample });
  homeEl.hidden = true;
  if (fileKind(file.meta) === 'icons') {
    // Icon files have no canvas either: a grid of their icons.
    state.screen = 'icons';
    appEl.hidden = true;
    tokensEl.hidden = true;
    iconsEl.hidden = false;
    loadDocument(file.doc, file.views);
    showIconsScreen();
    if (sample) sampleBanner();
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
    if (sample) sampleBanner();
    checkLibraryUpdates(); // token files it points at may have published new versions
    return;
  }
  state.screen = 'editor';
  tokensEl.hidden = true;
  appEl.hidden = false;
  const wasVersion = file.doc.version || 1;
  loadDocument(file.doc, file.views);
  remeasureAllText();
  // "Welcome to Sigma": place its examples by their real sizes (each time it opens, since a sample is
  // never saved).
  if (arrangeWelcome(state.doc)) {
    commit();
    forgetUndo();
  }
  if (sample) {
    sampleBanner();
    setTimeout(() => getCurrentFileId() === id && updateThumbnail(), 1500); // of the original, once
  }
  if (!state.pageViews[page().id]) requestAnimationFrame(() => getCurrentFileId() === id && state.screen === 'editor' && zoomToFit()); // unless you've left already
  emit('view');
  emit('tool');
  await migrateLegacyTokens(wasVersion);
  checkLibraryUpdates();
}

let routing = Promise.resolve();
function route() {
  // Serialize navigations so a fast back/forward can't interleave saves and loads.
  routing = routing.then(() => {
    const m = location.hash.match(/^#\/file\/([\w-]+)/);
    return m ? showFile(m[1]) : showHome();
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
addNormalizer(normalizeTokenGroups);
addNormalizer(syncInstances);
addNormalizer(resolveVariables);
addNormalizer(fixGroups);
addNormalizer(applyLayouts);
addNormalizer(fixGroups);
initTextEditor(canvas);
setViewportElement(canvas);
initPanels();
initInteractions(canvas);
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

initFiles({ onRemoteChange })
  .then(async () => {
    // A first visit opens "Welcome to Sigma".
    const welcome = await welcomeOnFirstVisit().catch((err) => console.error('Could not create Welcome to Sigma', err));
    if (welcome && !/^#\/file\//.test(location.hash)) return openFile(welcome);
    return route();
  })
  .catch((err) => {
    console.error(err);
    homeEl.hidden = false;
    homeEl.innerHTML = `<div class="home-empty"><div class="home-empty-title">Sigma can't open its storage</div><p>${err.message}</p></div>`;
  });

// Handy for debugging from the console.
window.sigma = { state, view, emit };
