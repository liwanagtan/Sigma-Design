import {
  state, page, view, subscribe, emit, normalizeDocument, addNormalizer, loadDocument, unloadDocument, walk, cancelPendingSave,
} from './store.js';
import { applyLayouts } from './layout.js';
import { renderScene, applyViewTransform, renderOverlay } from './render.js';
import { initInteractions, refreshCursor } from './interact.js';
import { initTextEditor, positionEditor, measureText, stopEditing } from './text.js';
import { setViewportElement, zoomToFit } from './commands.js';
import {
  initPanels, renderLayers, renderProps, renderPages, renderToolbar, renderZoomLabel, renderFileHeader, highlightLayerHover,
} from './panels.js';
import {
  initFiles, loadFile, setCurrentFile, closeCurrentFile, discardCurrentFile, saveNow, getCurrentFileId, goHome,
} from './files.js';
import { initHome, renderHome, setHomeNotice } from './home.js';
import { hideContextMenu } from './menu.js';

const appEl = document.getElementById('app');
const homeEl = document.getElementById('home');
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

// ---------- banner (changes from other tabs) ----------
function showBanner(text, actionLabel, action) {
  banner.innerHTML = `<span>${text}</span><button class="btn">${actionLabel}</button>`;
  banner.querySelector('button').onclick = action;
  banner.hidden = false;
}
const hideBanner = () => void (banner.hidden = true);

// ---------- screens ----------
// `discard`: drop unsaved local changes instead of writing them (reloading another tab's version).
async function leaveEditor({ discard = false } = {}) {
  if (!getCurrentFileId()) return;
  if (state.editingTextId) stopEditing();
  hideContextMenu();
  if (discard) {
    cancelPendingSave();
    discardCurrentFile();
  } else {
    await closeCurrentFile();
  }
  unloadDocument();
  hideBanner();
}

async function showHome() {
  await leaveEditor();
  state.screen = 'home';
  appEl.hidden = true;
  homeEl.hidden = false;
  document.title = 'Sigma – Files';
  await renderHome();
}

async function showFile(id, { force = false, discard = false } = {}) {
  if (!force && state.screen === 'editor' && getCurrentFileId() === id) return;
  const file = await loadFile(id);
  if (!file) {
    setHomeNotice('That file could not be found. It may have been deleted.');
    return goHome();
  }
  await leaveEditor({ discard });
  setCurrentFile(id);
  state.screen = 'editor';
  homeEl.hidden = true;
  appEl.hidden = false;
  loadDocument(file.doc, file.views);
  remeasureAllText();
  if (!state.pageViews[page().id]) requestAnimationFrame(() => zoomToFit());
  emit('view');
  emit('tool');
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
  if (state.screen === 'home') return void renderHome();
  if (msg.id !== current) return;
  if (msg.type === 'saved') {
    showBanner('This file was changed in another tab.', 'Reload', () => {
      hideBanner();
      routing = routing.then(() => showFile(current, { force: true, discard: true }));
    });
  } else if (msg.type === 'deleted') {
    showBanner('This file was deleted in another tab. Changes here are no longer saved.', 'Back to files', goHome);
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
addNormalizer(applyLayouts);
initTextEditor(canvas);
setViewportElement(canvas);
initPanels();
initInteractions(canvas);
initHome(homeEl);

document.fonts?.ready.then(remeasureAllText);
document.fonts?.addEventListener?.('loadingdone', remeasureAllText);
window.addEventListener('resize', () => emit('view'));
window.addEventListener('hashchange', route);
// Save promptly when the tab is hidden or closed.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void saveNow();
});

initFiles({ onRemoteChange })
  .then(route)
  .catch((err) => {
    console.error(err);
    homeEl.hidden = false;
    homeEl.innerHTML = `<div class="home-empty"><div class="home-empty-title">Sigma can't open its storage</div><p>${err.message}</p></div>`;
  });

// Handy for debugging from the console.
window.sigma = { state, view, emit };
