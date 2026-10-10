import { state, page, view, subscribe, emit, fixGroups, loadFromStorage, loadDocument, walk } from './store.js';
import { renderScene, applyViewTransform, renderOverlay } from './render.js';
import { initInteractions, refreshCursor } from './interact.js';
import { initTextEditor, positionEditor, measureText } from './text.js';
import { setViewportElement, zoomToFit } from './commands.js';
import {
  initPanels, renderLayers, renderProps, renderPages, renderToolbar, renderZoomLabel, renderFileHeader, highlightLayerHover,
} from './panels.js';
import { sampleDocument } from './sample.js';

const canvas = document.getElementById('canvas');
const world = document.getElementById('world');
const overlay = document.getElementById('overlay');

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
  if (dirty.scene) {
    fixGroups();
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
  for (const pg of state.doc.pages) walk(pg.children, (n) => void (n.type === 'text' && measureText(n)));
  emit('doc');
}

// ---------- boot ----------
initTextEditor(canvas);
setViewportElement(canvas);
initPanels();
initInteractions(canvas);

const restored = loadFromStorage();
if (!restored) loadDocument(sampleDocument());
remeasureAllText();
if (!state.pageViews[page().id]) requestAnimationFrame(() => zoomToFit());

document.fonts?.ready.then(remeasureAllText);
document.fonts?.addEventListener?.('loadingdone', remeasureAllText);
window.addEventListener('resize', () => emit('view'));
emit('tool');

// Handy for debugging from the console.
window.sigma = { state, view, emit };
