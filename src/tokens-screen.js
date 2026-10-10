// The screen for token files: no canvas, just the design token editor full-screen.
import { state, commit, subscribe, undo, redo } from './store.js';
import { mountTokenEditor, unmountTokenEditor } from './variables-ui.js';
import { goHome } from './files.js';
import { saveFile } from './io.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

let root = null;

export function initTokensScreen(el) {
  root = el;
  el.innerHTML = `
    <header class="tokens-header">
      <button class="logo-btn" data-tokens-menu title="Main menu">${icons.logo}${icons.chevronDown}</button>
      <input class="file-name tokens-file-name" spellcheck="false" aria-label="Token file name">
      <span class="kind-badge tokens-kind">Token file</span>
      <div class="tokens-header-actions">
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
      { label: 'Download a copy (.sigma.json)', action: saveFile },
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
}

subscribe((kind) => {
  if (kind === 'doc') renderHeader();
});
