// The screen for token files: no canvas, just the design token editor full-screen.
import { state, commit, subscribe, undo, redo } from './store.js';
import { openHistory, openSaveVersionDialog } from './history.js';
import { openLibrariesDialog, publishDependencies } from './libraries.js';
import { diffCollections, libraryCollections, dependencyChanges } from './variables.js';
import { mountTokenEditor, unmountTokenEditor } from './variables-ui.js';
import { goHome } from './files.js';
import { saveFile, download } from './io.js';
import { exportDTCG, exportCSS, importTokens, mergeCollections } from './tokens-io.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

let root = null;

export function initTokensScreen(el) {
  root = el;
  el.innerHTML = `
    <header class="tokens-header">
      <button class="logo-btn" data-tokens-menu title="Main menu">${icons.logo}${icons.chevronDown}</button>
      <input class="file-name tokens-file-name" spellcheck="false" aria-label="Sigma Tokens file name">
      <span class="kind-badge tokens-kind">Sigma Tokens</span>
      <div class="tokens-header-actions">
        <span class="publish-status" data-publish-status></span>
        <button class="btn primary" data-publish>Publish…</button>
        <button class="icon-btn" data-undo title="Undo  ⌘Z"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M5 3L2 6l3 3"/><path d="M2 6h7.5a4 4 0 0 1 0 8H7"/></svg></button>
        <button class="icon-btn" data-redo title="Redo  ⇧⌘Z"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M11 3l3 3-3 3"/><path d="M14 6H6.5a4 4 0 0 0 0 8H9"/></svg></button>
      </div>
    </header>
    <div class="tokens-editor"></div>`;

  el.querySelector('[data-tokens-menu]').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showContextMenu(r.left, r.bottom + 4, [
      { label: 'Back to files', action: goHome },
      '-',
      { label: 'Export tokens.json (W3C format)', action: exportJSONFile },
      { label: 'Export CSS variables', action: exportCSSFile },
      { label: 'Import tokens.json…', action: importIntoThisFile },
      '-',
      { label: 'Download a copy (.sigma.json)', action: saveFile },
      '-',
      { label: 'Libraries…', action: () => openLibrariesDialog() },
      '-',
      { label: 'Save to version history…', shortcut: '⌥⌘S', action: () => openSaveVersionDialog() },
      { label: 'Show version history', action: () => openHistory() },
      '-',
      { label: 'Undo', shortcut: '⌘Z', action: undo },
      { label: 'Redo', shortcut: '⇧⌘Z', action: redo },
    ]);
  });
  const name = el.querySelector('.tokens-file-name');
  name.addEventListener('change', () => {
    state.doc.name = name.value.trim() || 'Untitled tokens';
    commit();
  });
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') name.blur();
  });
  el.querySelector('[data-publish]').addEventListener('click', openPublishDialog);
  el.querySelector('[data-undo]').addEventListener('click', undo);
  el.querySelector('[data-redo]').addEventListener('click', redo);

  // Undo/redo shortcuts while a token file is open (the canvas shortcuts only run in design files).
  window.addEventListener('keydown', (e) => {
    if (state.screen !== 'tokens' || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    const t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  });
}

// ---------- export / import ----------
const fileBase = () => (state.doc.name || 'tokens').replace(/[\\/:*?"<>|]+/g, '-');

function exportJSONFile() {
  const json = exportDTCG(state.doc.variables.collections, { external: libraryCollections() });
  download(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `${fileBase()}.tokens.json`);
}

function exportCSSFile() {
  const css = exportCSS(state.doc.variables.collections, { title: state.doc.name, external: libraryCollections() });
  download(new Blob([css], { type: 'text/css' }), `${fileBase()}.css`);
}

// Merge a tokens.json into this token file: tokens match by collection, name and type; modes by name.
function importIntoThisFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const { collections, skipped } = importTokens(JSON.parse(await file.text()), { external: libraryCollections() });
      const n = mergeCollections(state.doc.variables.collections, collections);
      commit();
      window.dispatchEvent(new CustomEvent('sigma:toast', {
        detail: `Imported ${n} token${n === 1 ? '' : 's'}${skipped ? ` (${skipped} of unsupported types skipped)` : ''}`,
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('sigma:toast', { detail: `Couldn't import ${file.name}: ${err.message}` }));
    }
  };
  input.click();
}

export function showTokensScreen() {
  mountTokenEditor(root.querySelector('.tokens-editor'));
  renderHeader();
}

export function hideTokensScreen() {
  unmountTokenEditor();
}

function renderHeader() {
  if (!root || state.screen !== 'tokens' || !state.doc) return;
  const name = root.querySelector('.tokens-file-name');
  if (document.activeElement !== name) name.value = state.doc.name || 'Untitled tokens';
  document.title = `${state.doc.name || 'Untitled tokens'} – Sigma`;
  const pub = state.doc.published;
  const dirty = hasUnpublishedChanges();
  root.querySelector('[data-publish-status]').innerHTML = !pub
    ? '<span class="status-chip">Not published</span>'
    : dirty ? `<span class="status-chip warn">Unpublished changes · v${pub.version} live</span>`
      : `<span class="status-chip ok">v${pub.version} published</span>`;
  root.querySelector('[data-publish]').disabled = !!pub && !dirty;
}

const current = () => state.doc?.variables?.collections || [];
// Which versions of the token files this file points at would be published with it.
const depVersions = (deps) => JSON.stringify((deps || []).map((d) => [d.fileId, d.version]).sort());
const hasUnpublishedChanges = () => JSON.stringify(current()) !== JSON.stringify(state.doc?.published?.collections || []) ||
  depVersions(publishDependencies()) !== depVersions(state.doc?.published?.dependencies);

// ---------- publishing ----------
// Publishing makes the current tokens a new numbered version. Design files that link this token file
// see "Token updates available" and choose when to accept it.
function openPublishDialog() {
  const pub = state.doc.published;
  const d = diffCollections(pub?.collections || [], current());
  const deps = publishDependencies();
  const depChanges = dependencyChanges(pub?.dependencies, deps);
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const list = (label, items) => (items.length ? `<div class="diff-group"><div class="diff-label">${label} (${items.length})</div>${items.slice(0, 10).map((n) => `<div>${esc(n)}</div>`).join('')}${items.length > 10 ? `<div class="muted">and ${items.length - 10} more</div>` : ''}</div>` : '');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal lib-modal"><div class="modal-head">Publish ${esc(state.doc.name)}<button class="icon-btn" data-close>${icons.close}</button></div>
    <div class="lib-body">
      <p class="muted">This becomes version ${(pub?.version || 0) + 1}. Sigma Design files that use this file will be offered the update.</p>
      ${list('Added', d.added) + list('Changed', d.changed) + list('Removed', d.removed) + list('Sigma Tokens files it points at', depChanges) || '<div class="muted">No changes since the last version.</div>'}
      ${deps.length ? `<p class="muted">Includes the tokens it points at from ${deps.map((x) => `${esc(x.name)} v${x.version}`).join(', ')}, so Sigma Design files resolve them.</p>` : ''}
      <label class="inspector-label">Notes (optional)</label>
      <textarea class="desc publish-notes" rows="3" placeholder="What changed and why?"></textarea>
    </div>
    <div class="lib-footer"><button class="btn" data-close>Cancel</button><button class="btn primary" data-confirm>Publish v${(pub?.version || 0) + 1}</button></div></div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) return close();
    if (!e.target.closest('[data-confirm]')) return;
    const dependencies = publishDependencies();
    state.doc.published = {
      version: (pub?.version || 0) + 1, publishedAt: Date.now(),
      notes: wrap.querySelector('.publish-notes').value.trim(), collections: structuredClone(current()),
    };
    if (dependencies.length) state.doc.published.dependencies = dependencies;
    commit();
    close();
    window.dispatchEvent(new CustomEvent('sigma:toast', { detail: `Published v${state.doc.published.version}` }));
  });
  wrap.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  document.body.appendChild(wrap);
  wrap.querySelector('.publish-notes').focus();
}

subscribe((kind) => {
  if (kind === 'doc') renderHeader();
});
