// Libraries: a design file links
//   - token files (doc.libraries): published design tokens
//   - component libraries (doc.componentLibraries): components published by other design files
// and keeps a snapshot of the published version it accepted. Edits reach it only when the source file
// publishes a new version and this file accepts the update.
import { state, commit, emit, reindex, walk } from './store.js';
import {
  localCollections, snapshotForLibrary, diffCollections, collections, referencedIds, detachAliasesTo, dependencyLibraries,
  dependencyChanges,
} from './variables.js';
import { publishableComponents } from './components.js';
import { isAutoLayout } from './layout.js';
import {
  listTokenFiles, loadPublished, createTokenFileWith, appendToTokenFile, getCurrentFileId, listComponentLibraries,
  loadPublishedComponents,
} from './files.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const banner = (detail) => window.dispatchEvent(new CustomEvent('sigma:banner', { detail }));

export const libraries = () => state.doc?.libraries || [];
export const componentLibraries = () => state.doc?.componentLibraries || [];

// Does this design file use `fileId` as a token or component library?
export const usesLibrary = (fileId) => libraries().some((l) => l.fileId === fileId) || componentLibraries().some((l) => l.fileId === fileId);

function setLibrary(fileId, name, published) {
  const libs = (state.doc.libraries ||= []);
  const entry = { fileId, name, version: published.version, collections: snapshotForLibrary(published.collections, fileId) };
  // Token files it references (a "Brand" file aliasing "Core"), as published with it.
  const deps = (published.dependencies || []).filter((d) => d.fileId !== getCurrentFileId());
  if (deps.length) entry.dependencies = deps.map((d) => ({ ...d, collections: snapshotForLibrary(d.collections, d.fileId) }));
  const i = libs.findIndex((l) => l.fileId === fileId);
  if (i >= 0) libs[i] = entry;
  else libs.push(entry);
}

function setComponentLibrary(fileId, name, published) {
  const libs = (state.doc.componentLibraries ||= []);
  const entry = { fileId, name, version: published.version, components: structuredClone(published.components) };
  const i = libs.findIndex((l) => l.fileId === fileId);
  if (i >= 0) libs[i] = entry;
  else libs.push(entry);
  reindex(); // library components must be resolvable before the next sync
}

// Layers bound to any of the token `ids` (to warn before unlinking).
function usesOf(ids) {
  let n = 0;
  for (const pg of state.doc.pages || []) walk(pg.children, (x) => {
    if (x.bindings && Object.values(x.bindings).some((id) => ids.has(id))) n++;
  });
  return n;
}

// Instances of components from a component library.
function instancesFrom(lib) {
  const ids = new Set();
  walk(lib.components, (n) => void (n.type === 'component' && ids.add(n.id)));
  let n = 0;
  for (const pg of state.doc.pages) walk(pg.children, (x) => {
    if (x.type === 'instance') {
      if (ids.has(x.componentId)) n++;
      return false;
    }
  });
  return n;
}

export async function linkLibrary(fileId) {
  if (fileId === getCurrentFileId()) return toast('A token file can’t link itself.');
  if (libraries().some((l) => l.fileId === fileId)) return;
  const res = await loadPublished(fileId);
  if (!res?.published) return toast('That token file has no published version yet. Publish it from the token file first.');
  if ((res.published.dependencies || []).some((d) => d.fileId === getCurrentFileId())) {
    return toast(`“${res.meta.name}” already uses this file’s tokens, so this file can’t use its tokens in return.`);
  }
  setLibrary(fileId, res.meta.name, res.published);
  commit();
  toast(`Linked “${res.meta.name}” (v${res.published.version})`);
}

const tokenIds = () => new Set(collections().flatMap((c) => (c.variables || []).map((v) => v.id)));

export function unlinkLibrary(fileId) {
  const lib = libraries().find((l) => l.fileId === fileId);
  if (!lib) return;
  // Tokens that disappear with it: its own, and dependencies nothing else provides.
  const all = libraries();
  const before = tokenIds();
  state.doc.libraries = all.filter((l) => l !== lib);
  const lost = new Set([...before].filter((id) => !tokenIds().has(id)));
  state.doc.libraries = all;
  const layers = usesOf(lost);
  const aliases = [...referencedIds()].filter((id) => lost.has(id)).length;
  const parts = [layers && `${layers} layer${layers === 1 ? '' : 's'}`, aliases && `${aliases} token reference${aliases === 1 ? '' : 's'}`].filter(Boolean);
  const one = parts.length === 1 && (layers || aliases) === 1;
  if (parts.length && !confirm(`${parts.join(' and ')} use${one ? 's' : ''} tokens from “${lib.name}”. Unlink anyway? ${one ? 'It keeps its' : 'They keep their'} current value${one ? '' : 's'}.`)) return;
  detachAliasesTo(lost);
  state.doc.libraries = all.filter((l) => l !== lib);
  commit();
}

export async function linkComponentLibrary(fileId) {
  if (fileId === getCurrentFileId()) return toast('A file can’t use its own components as a library.');
  if (componentLibraries().some((l) => l.fileId === fileId)) return;
  const res = await loadPublishedComponents(fileId);
  if (!res?.published) return toast('That file has no published components yet.');
  setComponentLibrary(fileId, res.meta.name, res.published);
  commit();
  toast(`Linked components from “${res.meta.name}” (v${res.published.version})`);
}

export function unlinkComponentLibrary(fileId) {
  const lib = componentLibraries().find((l) => l.fileId === fileId);
  if (!lib) return;
  const uses = instancesFrom(lib);
  if (uses && !confirm(`${uses} instance${uses === 1 ? ' uses' : 's use'} components from “${lib.name}”. Unlink anyway? They keep their current look but stop updating.`)) return;
  state.doc.componentLibraries = componentLibraries().filter((l) => l !== lib);
  reindex();
  commit();
}

// ---------- publishing tokens ----------
// Copies of the token files this file's tokens point at, to publish along with them: libraries (or their
// dependencies) that hold a referenced token, plus everything those depend on.
export function publishDependencies() {
  const used = referencedIds();
  const sources = [...libraries(), ...dependencyLibraries()];
  const out = new Map();
  const add = (d) => {
    const cur = out.get(d.fileId);
    if (!cur || d.version > cur.version) out.set(d.fileId, { fileId: d.fileId, name: d.name, version: d.version, collections: d.collections });
  };
  for (const src of sources) {
    if (!(src.collections || []).some((c) => (c.variables || []).some((v) => used.has(v.id)))) continue;
    add(src);
    for (const d of src.dependencies || []) add(d);
  }
  return [...out.values()].map((d) => ({ ...d, collections: structuredClone(d.collections).map(({ fromLibrary, ...c }) => c) }));
}

// ---------- publishing components ----------
const componentSnapshot = () => structuredClone(publishableComponents());

// A component's content without geometry that layout and text measurement derive (hug and fill sizes,
// auto-width text, positions in an auto layout flow), so re-measuring text never looks like an edit.
// Moving a component around the canvas isn't a change either.
function signature(node) {
  const strip = (n, flow) => {
    const out = { ...n };
    if (flow && !n.absolute) {
      delete out.x;
      delete out.y;
    }
    if (n.sizingH === 'hug' || n.sizingH === 'fill' || (n.type === 'text' && n.autoResize === 'width')) delete out.w;
    if (n.sizingV === 'hug' || n.sizingV === 'fill' || (n.type === 'text' && n.autoResize && n.autoResize !== 'fixed')) delete out.h;
    if (n.children) out.children = n.children.map((k) => strip(k, isAutoLayout(n)));
    return out;
  };
  return JSON.stringify(strip(node, true));
}

// Component (and component set) names that were added, changed or removed between two snapshots.
export function diffComponents(before, after) {
  const index = (list) => new Map((list || []).map((n) => [n.id, { name: n.name, sig: signature(n) }]));
  const a = index(before), b = index(after);
  const added = [], changed = [], removed = [];
  for (const [k, v] of b) {
    if (!a.has(k)) added.push(v.name);
    else if (a.get(k).sig !== v.sig) changed.push(v.name);
  }
  for (const [k, v] of a) if (!b.has(k)) removed.push(v.name);
  return { added, changed, removed };
}

export function componentPublishStatus() {
  const pub = state.doc?.publishedComponents;
  const now = publishableComponents();
  const d = diffComponents(pub?.components || [], now);
  const dirty = !pub || d.added.length + d.changed.length + d.removed.length > 0;
  return { pub, count: now.length, dirty };
}

export function openPublishComponentsDialog() {
  const { pub, count } = componentPublishStatus();
  if (!count) return toast('This file has no components to publish yet. Select layers and press ⌥⌘K to create one.');
  const d = diffComponents(pub?.components || [], componentSnapshot());
  const version = (pub?.version || 0) + 1;
  const body = `<p class="muted">Publishes this file's ${count} component${count === 1 ? '' : 's'} as version ${version}. ` +
    'Design files that use them as a library will be offered the update.</p>' +
    (diffList('Added', d.added, 'added') + diffList('Changed', d.changed, 'changed') + diffList('Removed', d.removed, 'removed') || '<div class="muted">No changes since the last version.</div>') +
    '<label class="inspector-label">Notes (optional)</label><textarea class="desc publish-notes" rows="3" placeholder="What changed and why?"></textarea>';
  const wrap = modal('Publish components', body, `<button class="btn" data-close>Cancel</button><button class="btn primary" data-confirm>Publish v${version}</button>`);
  wrap.querySelector('.publish-notes').focus();
  wrap.addEventListener('click', (e) => {
    if (!e.target.closest('[data-confirm]')) return;
    state.doc.publishedComponents = {
      version, publishedAt: Date.now(), notes: wrap.querySelector('.publish-notes').value.trim(), components: componentSnapshot(),
    };
    commit();
    wrap.remove();
    toast(`Published components v${version}`);
  });
}

// ---------- updates ----------
let pending = []; // [{ kind: 'tokens' | 'components', lib, meta, published }]

export async function checkLibraryUpdates() {
  if ((state.screen !== 'editor' && state.screen !== 'tokens') || (!libraries().length && !componentLibraries().length)) return [];
  const fileId = getCurrentFileId();
  const found = [];
  for (const lib of libraries()) {
    const res = await loadPublished(lib.fileId);
    if (res?.published && res.published.version > lib.version) found.push({ kind: 'tokens', lib, meta: res.meta, published: res.published });
  }
  for (const lib of componentLibraries()) {
    const res = await loadPublishedComponents(lib.fileId);
    if (res?.published && res.published.version > lib.version) found.push({ kind: 'components', lib, meta: res.meta, published: res.published });
  }
  if (getCurrentFileId() !== fileId) return []; // the file changed while we were checking
  pending = found;
  if (found.length) {
    const names = found.map((u) => `${esc(u.meta.name)} ${u.kind === 'components' ? 'components ' : ''}v${u.published.version}`).join(', ');
    banner({ text: `Library updates available: ${names}`, label: 'Review', action: reviewUpdates });
  }
  return found;
}

export function acceptUpdate(u) {
  if (u.kind === 'components') setComponentLibrary(u.lib.fileId, u.meta.name, u.published);
  else setLibrary(u.lib.fileId, u.meta.name, u.published);
}

function diffList(label, items, cls) {
  if (!items.length) return '';
  return `<div class="diff-group ${cls}"><div class="diff-label">${label} (${items.length})</div>${items.slice(0, 12).map((n) => `<div>${esc(n)}</div>`).join('')}` +
    `${items.length > 12 ? `<div class="muted">and ${items.length - 12} more</div>` : ''}</div>`;
}

function reviewUpdates() {
  if (!pending.length) return;
  const rows = pending.map((u, i) => {
    const comps = u.kind === 'components';
    const d = comps ? diffComponents(u.lib.components, u.published.components) : diffCollections(u.lib.collections, u.published.collections);
    const deps = comps ? [] : dependencyChanges(u.lib.dependencies, u.published.dependencies);
    return `<div class="update-card"><div class="update-head"><b>${esc(u.meta.name)}${comps ? ' · components' : ' · tokens'}</b><span class="muted">v${u.lib.version} → v${u.published.version}</span></div>` +
      (u.published.notes ? `<div class="update-notes">“${esc(u.published.notes)}”</div>` : '') +
      (diffList('Added', d.added, 'added') + diffList('Changed', d.changed, 'changed') + diffList('Removed', d.removed, 'removed') +
        diffList('Token files it points at', deps, 'changed') || '<div class="muted">No changes.</div>') +
      (d.removed.length ? `<div class="muted">${comps ? 'Instances of removed components keep their current look.' : 'Layers using removed tokens keep their current values.'}</div>` : '') +
      `<button class="btn primary" data-accept="${i}">Accept update</button></div>`;
  }).join('');
  const wrap = modal('Review library updates', rows, '<button class="btn" data-close>Later</button>' + (pending.length > 1 ? '<button class="btn primary" data-accept-all>Accept all</button>' : ''));
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
    toast(accepted.length === 1 ? `Updated “${accepted[0].meta.name}” to v${accepted[0].published.version}` : 'Libraries updated');
    window.dispatchEvent(new CustomEvent('sigma:banner', { detail: null }));
    if (pending.length) checkLibraryUpdates();
  });
}

// ---------- dialogs ----------
export function modal(title, body, footer = '') {
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

function libraryRow(icon, name, status, actions) {
  return `<div class="lib-row"><span class="lib-icon">${icon}</span><div class="lib-info"><div class="lib-name">${esc(name)}</div>${status}</div>${actions}</div>`;
}

// Link or unlink token files and component libraries for this design file.
export async function openLibrariesDialog() {
  const tokenFile = state.doc?.kind === 'tokens';
  const tokenFiles = (await listTokenFiles()).filter((f) => f.id !== getCurrentFileId());
  const compFiles = tokenFile ? [] : (await listComponentLibraries()).filter((f) => f.id !== getCurrentFileId());
  const versionStatus = (published, lib) => (!published ? '<span class="muted">Not published yet</span>'
    : lib ? `<span class="muted">Using v${lib.version}${published > lib.version ? ` · <b class="update-dot">v${published} available</b>` : ''}</span>`
      : `<span class="muted">Published v${published}</span>`);
  const openBtn = (id) => `<button class="btn" data-open="${id}" title="Open the file">Open</button>`;

  const linkedTokens = new Map(libraries().map((l) => [l.fileId, l]));
  const tokenRows = tokenFiles.map((f) => {
    const lib = linkedTokens.get(f.id);
    const action = lib ? `<button class="btn" data-unlink="${f.id}">Unlink</button>`
      : `<button class="btn primary" data-link="${f.id}" ${f.tokenVersion ? '' : 'disabled'}>Link</button>`;
    const dep = !lib && dependencyLibraries().find((d) => d.fileId === f.id);
    const status = dep ? `<span class="muted">Included with “${esc(dep.via)}” (v${dep.version}) · link it to choose the version yourself</span>` : versionStatus(f.tokenVersion, lib);
    return libraryRow(TOKEN_ICON, f.name, status, openBtn(f.id) + action);
  }).join('') + libraries().filter((l) => !tokenFiles.some((f) => f.id === l.fileId)).map((l) =>
    libraryRow(TOKEN_ICON, l.name, `<span class="muted">Token file deleted · using v${l.version}</span>`, `<button class="btn" data-unlink="${l.fileId}">Unlink</button>`)).join('');

  const linkedComps = new Map(componentLibraries().map((l) => [l.fileId, l]));
  const compRows = compFiles.map((f) => {
    const lib = linkedComps.get(f.id);
    const action = lib ? `<button class="btn" data-unlink-components="${f.id}">Unlink</button>`
      : `<button class="btn primary" data-link-components="${f.id}">Link</button>`;
    return libraryRow(COMPONENT_ICON, f.name, versionStatus(f.componentVersion, lib), openBtn(f.id) + action);
  }).join('') + componentLibraries().filter((l) => !compFiles.some((f) => f.id === l.fileId)).map((l) =>
    libraryRow(COMPONENT_ICON, l.name, `<span class="muted">File deleted · using v${l.version}</span>`, `<button class="btn" data-unlink-components="${l.fileId}">Unlink</button>`)).join('');

  const body = (tokenFile
    ? '<p class="muted lib-intro">Link other token files to point this file’s tokens at theirs, e.g. brand colors that use core colors. When you publish, the token files you point at go along, so design files resolve them too.</p>'
    : '<p class="muted lib-intro">Linked libraries provide design tokens and components to this file. Changes arrive when the source file publishes a new version and you accept it.</p>') +
    '<div class="lib-section">Design tokens</div>' +
    (tokenRows || '<div class="muted lib-empty">No other token files yet. Create one from the home page and publish it.</div>') +
    (tokenFile ? '' : '<div class="lib-section">Components</div>' +
    (compRows || '<div class="muted lib-empty">No other design file has published components yet. Use <b>Publish components…</b> in a design file’s main menu.</div>'));
  const wrap = modal('Libraries', body);
  wrap.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.link) await linkLibrary(b.dataset.link);
    else if (b.dataset.unlink) unlinkLibrary(b.dataset.unlink);
    else if (b.dataset.linkComponents) await linkComponentLibrary(b.dataset.linkComponents);
    else if (b.dataset.unlinkComponents) unlinkComponentLibrary(b.dataset.unlinkComponents);
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
  // Tokens that point at linked token files keep pointing at them from their new home.
  const dependencies = publishDependencies();
  const links = structuredClone(libraries().filter((l) => dependencies.some((d) => d.fileId === l.fileId)));
  const result = target
    ? await appendToTokenFile(target, cols, `Added from “${state.doc.name}”`, { libraries: links, dependencies })
    : await createTokenFileWith(`${state.doc.name} tokens`, cols, undefined, { libraries: links, dependencies });
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
const COMPONENT_ICON = '<svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M6 1.2l1.9 1.9L6 5 4.1 3.1zM6 7l1.9 1.9L6 10.8 4.1 8.9zM3.1 4.1L5 6 3.1 7.9 1.2 6zM8.9 4.1L10.8 6 8.9 7.9 7 6z"/></svg>';

