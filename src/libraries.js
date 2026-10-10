// Token libraries: design files link token files and keep a snapshot of the published version they
// accepted (doc.libraries). A token file's edits reach design files only when it publishes a new version
// and the design file accepts the update.
import { state, commit, emit } from './store.js';
import {
  localCollections, snapshotForLibrary, diffCollections, collections,
} from './variables.js';
import {
  listTokenFiles, loadPublished, createTokenFileWith, appendToTokenFile, getCurrentFileId,
} from './files.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const banner = (detail) => window.dispatchEvent(new CustomEvent('sigma:banner', { detail }));

export const libraries = () => state.doc?.libraries || [];

function setLibrary(fileId, name, published) {
  const libs = (state.doc.libraries ||= []);
  const entry = { fileId, name, version: published.version, collections: snapshotForLibrary(published.collections, fileId) };
  const i = libs.findIndex((l) => l.fileId === fileId);
  if (i >= 0) libs[i] = entry;
  else libs.push(entry);
}

// Layers bound to tokens from a library (to warn before unlinking).
function usesOf(lib) {
  const ids = new Set(lib.collections.flatMap((c) => (c.variables || []).map((v) => v.id)));
  let n = 0;
  const visit = (nodes) => {
    for (const x of nodes) {
      if (x.bindings && Object.values(x.bindings).some((id) => ids.has(id))) n++;
      if (x.children) visit(x.children);
    }
  };
  for (const pg of state.doc.pages) visit(pg.children);
  return n;
}

export async function linkLibrary(fileId) {
  if (libraries().some((l) => l.fileId === fileId)) return;
  const res = await loadPublished(fileId);
  if (!res?.published) return toast('That token file has no published version yet. Publish it from the token file first.');
  setLibrary(fileId, res.meta.name, res.published);
  commit();
  toast(`Linked “${res.meta.name}” (v${res.published.version})`);
}

export function unlinkLibrary(fileId) {
  const lib = libraries().find((l) => l.fileId === fileId);
  if (!lib) return;
  const uses = usesOf(lib);
  if (uses && !confirm(`${uses} layer${uses === 1 ? ' uses' : 's use'} tokens from “${lib.name}”. Unlink anyway? They keep their current values.`)) return;
  state.doc.libraries = libraries().filter((l) => l !== lib);
  commit();
}

// ---------- updates ----------
let pending = []; // [{ lib, meta, published }]

export async function checkLibraryUpdates() {
  if (state.screen !== 'editor' || !libraries().length) return [];
  const fileId = getCurrentFileId();
  const found = [];
  for (const lib of libraries()) {
    const res = await loadPublished(lib.fileId);
    if (res?.published && res.published.version > lib.version) found.push({ lib, meta: res.meta, published: res.published });
  }
  if (getCurrentFileId() !== fileId) return []; // the file changed while we were checking
  pending = found;
  if (found.length) {
    const names = found.map((u) => `${esc(u.meta.name)} v${u.published.version}`).join(', ');
    banner({ text: `Token updates available: ${names}`, label: 'Review', action: reviewUpdates });
  }
  return found;
}

export function acceptUpdate(u) {
  setLibrary(u.lib.fileId, u.meta.name, u.published);
}

function reviewUpdates() {
  if (!pending.length) return;
  const rows = pending.map((u, i) => {
    const d = diffCollections(u.lib.collections, u.published.collections);
    const list = (label, items, cls) => (items.length
      ? `<div class="diff-group ${cls}"><div class="diff-label">${label} (${items.length})</div>${items.slice(0, 12).map((n) => `<div>${esc(n)}</div>`).join('')}${items.length > 12 ? `<div class="muted">and ${items.length - 12} more</div>` : ''}</div>`
      : '');
    return `<div class="update-card"><div class="update-head"><b>${esc(u.meta.name)}</b><span class="muted">v${u.lib.version} → v${u.published.version}</span></div>` +
      (u.published.notes ? `<div class="update-notes">“${esc(u.published.notes)}”</div>` : '') +
      (list('Added', d.added, 'added') + list('Changed', d.changed, 'changed') + list('Removed', d.removed, 'removed') || '<div class="muted">No token changes.</div>') +
      (d.removed.length ? '<div class="muted">Layers using removed tokens keep their current values.</div>' : '') +
      `<button class="btn primary" data-accept="${i}">Accept update</button></div>`;
  }).join('');
  const wrap = modal('Review token updates', rows, '<button class="btn" data-close>Later</button>' + (pending.length > 1 ? '<button class="btn primary" data-accept-all>Accept all</button>' : ''));
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-accept-all')) pending.forEach(acceptUpdate);
    else if (b.dataset.accept !== undefined) acceptUpdate(pending[+b.dataset.accept]);
    else return;
    const accepted = b.hasAttribute('data-accept-all') ? pending : [pending[+b.dataset.accept]];
    pending = pending.filter((u) => !accepted.includes(u));
    commit();
    wrap.remove();
    toast(accepted.length === 1 ? `Updated “${accepted[0].meta.name}” to v${accepted[0].published.version}` : 'Token libraries updated');
    window.dispatchEvent(new CustomEvent('sigma:banner', { detail: null }));
    if (pending.length) checkLibraryUpdates();
  });
}

// ---------- dialogs ----------
function modal(title, body, footer = '') {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal lib-modal"><div class="modal-head">${title}<button class="icon-btn" data-close>${icons.close}</button></div>` +
    `<div class="lib-body">${body}</div>${footer ? `<div class="lib-footer">${footer}</div>` : ''}</div>`;
  const close = () => {
    wrap.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      close();
    }
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(wrap);
  return wrap;
}

// Link or unlink token files for this design file.
export async function openLibrariesDialog() {
  const files = await listTokenFiles();
  const linked = new Map(libraries().map((l) => [l.fileId, l]));
  const missing = libraries().filter((l) => !files.some((f) => f.id === l.fileId));
  const rows = files.map((f) => {
    const lib = linked.get(f.id);
    const status = !f.tokenVersion ? '<span class="muted">Not published yet</span>'
      : lib ? `<span class="muted">Using v${lib.version}${f.tokenVersion > lib.version ? ` · <b class="update-dot">v${f.tokenVersion} available</b>` : ''}</span>`
        : `<span class="muted">Published v${f.tokenVersion}</span>`;
    const action = lib ? `<button class="btn" data-unlink="${f.id}">Unlink</button>`
      : `<button class="btn primary" data-link="${f.id}" ${f.tokenVersion ? '' : 'disabled'}>Link</button>`;
    return `<div class="lib-row"><span class="lib-icon">${TOKEN_ICON}</span><div class="lib-info"><div class="lib-name">${esc(f.name)}</div>${status}</div>` +
      `<button class="btn" data-open="${f.id}" title="Open the token file">Open</button>${action}</div>`;
  }).join('') + missing.map((l) => `<div class="lib-row"><span class="lib-icon">${TOKEN_ICON}</span><div class="lib-info"><div class="lib-name">${esc(l.name)}</div>` +
    `<span class="muted">Token file deleted · using v${l.version}</span></div><button class="btn" data-unlink="${l.fileId}">Unlink</button></div>`).join('');
  const body = rows || '<div class="muted lib-empty">No token files yet. Create one from the home page, publish it, then link it here.</div>';
  const wrap = modal('Token libraries', `<p class="muted lib-intro">Linked token files provide design tokens to this file. Changes arrive when the token file publishes a new version and you accept it.</p>${body}`);
  wrap.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.link) await linkLibrary(b.dataset.link);
    else if (b.dataset.unlink) unlinkLibrary(b.dataset.unlink);
    else if (b.dataset.open) {
      wrap.remove();
      return window.open(`#/file/${b.dataset.open}`, '_blank');
    } else return;
    wrap.remove();
    openLibrariesDialog();
  });
}

// ---------- local tokens → token file ----------
async function moveLocal(target) {
  const cols = localCollections();
  if (!cols.length) return toast('This file has no local tokens to move.');
  const result = target
    ? await appendToTokenFile(target, cols, `Added from “${state.doc.name}”`)
    : await createTokenFileWith(`${state.doc.name} tokens`, cols);
  // Token ids don't change, so every binding keeps working through the library snapshot.
  state.doc.variables.collections = [];
  setLibrary(result.id, result.name, result.published);
  commit();
  emit('doc');
  toast(`Moved ${cols.length} collection${cols.length === 1 ? '' : 's'} to “${result.name}”`);
}

export async function moveLocalTokensMenu(anchor) {
  const files = await listTokenFiles();
  const r = anchor.getBoundingClientRect();
  showContextMenu(r.left, r.bottom + 4, [
    { label: 'New token file', action: () => moveLocal(null) },
    ...(files.length ? ['-', ...files.map((f) => ({ label: f.name, action: () => moveLocal(f.id) }))] : []),
  ]);
}

// Files saved before token files existed keep their variables as local tokens. The first time one is
// opened, they move to a new linked token file (once).
export async function migrateLegacyTokens(wasVersion) {
  if (wasVersion >= 3 || !localCollections().length || state.screen !== 'editor') return;
  await moveLocal(null);
  toast(`Your design tokens now live in the token file “${state.doc.name} tokens”, linked to this file.`);
}

export const hasLibraries = () => libraries().length > 0;
export const libraryTokenCount = () => collections().filter((c) => c.fromLibrary).reduce((n, c) => n + (c.variables || []).length, 0);

const TOKEN_ICON = '<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="M7 1.2l5 2.9v5.8L7 12.8 2 9.9V4.1z"/><circle cx="7" cy="7" r="1.6"/></svg>';

