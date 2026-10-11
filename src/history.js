// Version history: a side panel listing the open file's versions (named, published and autosave).
// Clicking one shows it read-only in place; it can then be restored, copied to a new file, named or
// deleted. Versions live in this browser's storage alongside the file (see files.js).
import { state, loadDocument, emit } from './store.js';
import {
  getCurrentFileId, listVersions, loadVersionDoc, saveNamedVersion, restoreVersion, duplicateVersion, updateVersion,
  deleteVersion, openFile, saveNow,
} from './files.js';
import { modal } from './libraries.js';
import { showContextMenu } from './menu.js';
import { icons } from './icons.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const banner = (detail) => window.dispatchEvent(new CustomEvent('sigma:banner', { detail }));
// main.js reloads the open file from storage (leaving a preview, after a restore).
const reopen = () => new Promise((resolve) => window.dispatchEvent(new CustomEvent('sigma:reopen', { detail: resolve })));

let panel = null;
let versions = [];
let showAutosaves = true;
let viewing = null; // the version shown read-only, or null for the current state

const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function day(t) {
  const d = new Date(t), today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
const label = (v) => v.title || 'Autosave';

export const isHistoryOpen = () => !!panel;
export const viewingVersion = () => viewing;

export async function openHistory() {
  if (!getCurrentFileId()) return;
  if (!panel) {
    panel = document.createElement('aside');
    panel.className = 'history-panel';
    panel.addEventListener('click', onClick);
    document.body.appendChild(panel);
  }
  await refreshHistory();
}

export async function closeHistory() {
  if (viewing) await backToCurrent();
  panel?.remove();
  panel = null;
}

// Stop showing a version without reloading anything (the file is being closed or reloaded).
export function clearViewing() {
  if (!viewing && !state.readOnly) return;
  viewing = null;
  state.readOnly = false;
  document.body.classList.remove('previewing');
  if (panel) render();
}

// Close the panel without reloading anything (another file or the home screen is opening).
export function resetHistory() {
  clearViewing();
  panel?.remove();
  panel = null;
}

export async function refreshHistory() {
  if (!panel) return;
  const fileId = getCurrentFileId();
  versions = await listVersions(fileId);
  if (!panel || fileId !== getCurrentFileId()) return;
  render();
}

function render() {
  const shown = versions.filter((v) => showAutosaves || v.kind !== 'auto');
  let lastDay = '';
  const rows = shown.map((v) => {
    const d = day(v.createdAt);
    const head = d !== lastDay ? `<div class="history-day">${d}</div>` : '';
    lastDay = d;
    const badge = v.kind === 'publish' ? '<span class="history-badge">Published</span>' : '';
    return `${head}<div class="history-row ${v.kind} ${viewing?.id === v.id ? 'active' : ''}" data-version="${v.id}">` +
      `<div class="history-dot"></div><div class="history-text"><div class="history-title">${esc(label(v))}${badge}</div>` +
      `<div class="history-meta">${time(v.createdAt)}</div>` +
      (v.description ? `<div class="history-desc">${esc(v.description)}</div>` : '') +
      `</div><button class="icon-btn history-more" data-more="${v.id}" title="More">⋯</button></div>`;
  }).join('');
  panel.innerHTML = `<div class="history-head"><span>Version history</span><button class="icon-btn" data-close title="Close">${icons.close}</button></div>` +
    '<div class="history-actions"><button class="btn primary wide" data-save>Save version…</button>' +
    `<label class="history-toggle"><input type="checkbox" data-autosaves ${showAutosaves ? 'checked' : ''}> Show autosave versions</label></div>` +
    `<div class="history-list"><div class="history-row current ${viewing ? '' : 'active'}" data-current><div class="history-dot"></div>` +
    '<div class="history-text"><div class="history-title">Current version</div><div class="history-meta">What you see when you edit</div></div></div>' +
    (rows || '<div class="muted history-empty">No versions yet. Sigma keeps one before each editing session and every 10 minutes while you work, and one for every publish.</div>') +
    '</div><div class="history-foot muted">Versions are stored in this browser with the file.</div>';
}

async function onClick(e) {
  if (e.target.closest('[data-close]')) return closeHistory();
  if (e.target.closest('[data-save]')) return openSaveVersionDialog();
  const toggle = e.target.closest('[data-autosaves]');
  if (toggle) {
    showAutosaves = toggle.checked;
    return render();
  }
  const more = e.target.closest('[data-more]');
  if (more) {
    const v = versions.find((x) => x.id === more.dataset.more);
    const r = more.getBoundingClientRect();
    return showContextMenu(r.right - 180, r.bottom + 4, [
      { label: 'Restore this version', action: () => restore(v) },
      { label: 'Duplicate as new file', action: () => duplicate(v) },
      '-',
      { label: v.kind === 'auto' ? 'Name this version…' : 'Edit name and description…', action: () => openSaveVersionDialog(v) },
      { label: 'Delete version', action: () => remove(v) },
    ]);
  }
  if (e.target.closest('[data-current]')) return backToCurrent();
  const row = e.target.closest('[data-version]');
  if (row) return view(versions.find((x) => x.id === row.dataset.version));
}

// Show a version read-only in place of the current state.
async function view(v) {
  if (!v || viewing?.id === v.id) return;
  const doc = await loadVersionDoc(v.id);
  if (!doc) return toast('That version could not be loaded.');
  if (!viewing) await saveNow(); // the current state is safely stored before it's swapped out
  viewing = v;
  state.readOnly = true;
  document.body.classList.add('previewing');
  loadDocument(structuredClone(doc), state.pageViews);
  window.dispatchEvent(new CustomEvent('sigma:doc-replaced'));
  banner({
    text: `Viewing “${esc(label(v))}” · ${day(v.createdAt)}, ${time(v.createdAt)}`,
    label: 'Restore this version', action: () => restore(v),
    extra: [{ label: 'Back to current', action: backToCurrent }],
  });
  render();
}

async function backToCurrent() {
  if (!viewing) return;
  viewing = null;
  state.readOnly = false;
  document.body.classList.remove('previewing');
  banner(null);
  await reopen();
  render();
}

async function restore(v) {
  if (!confirm(`Restore “${label(v)}” from ${day(v.createdAt)}, ${time(v.createdAt)}? The current state is kept in the version history first.`)) return;
  try {
    await restoreVersion(getCurrentFileId(), v);
  } catch (err) {
    return toast(err.message);
  }
  viewing = null;
  state.readOnly = false;
  document.body.classList.remove('previewing');
  banner(null);
  await reopen();
  await refreshHistory();
  toast(`Restored “${label(v)}”`);
}

async function duplicate(v) {
  try {
    const id = await duplicateVersion(v);
    toast('Copied the version to a new file');
    window.open(`#/file/${id}`, '_blank') || openFile(id);
  } catch (err) {
    toast(err.message);
  }
}

async function remove(v) {
  if (!confirm(`Delete “${label(v)}” from the version history? This can’t be undone.`)) return;
  if (viewing?.id === v.id) await backToCurrent();
  await deleteVersion(v);
  await refreshHistory();
}

// Save the current state as a named version, or (with `v`) rename an existing one.
export function openSaveVersionDialog(v = null) {
  if (!getCurrentFileId()) return;
  if (!v && viewing) return toast('Go back to the current version to save it.');
  const body = '<label class="inspector-label">Title</label><input class="prop-input version-title" spellcheck="false" placeholder="e.g. Before the redesign">' +
    '<label class="inspector-label">Description (optional)</label><textarea class="desc version-desc" rows="3" placeholder="What does this version contain?"></textarea>';
  const wrap = modal(v ? 'Edit version' : 'Save to version history', body,
    `<button class="btn" data-close>Cancel</button><button class="btn primary" data-confirm>${v ? 'Save' : 'Save version'}</button>`);
  const title = wrap.querySelector('.version-title'), desc = wrap.querySelector('.version-desc');
  title.value = v?.title || '';
  desc.value = v?.description || '';
  title.focus();
  const submit = async () => {
    if (!title.value.trim()) return title.focus();
    wrap.remove();
    if (v) await updateVersion(v, { title: title.value.trim(), description: desc.value.trim() });
    else {
      await saveNamedVersion(getCurrentFileId(), title.value, desc.value);
      toast('Saved to version history');
    }
    await refreshHistory();
  };
  title.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  wrap.querySelector('[data-confirm]').addEventListener('click', submit);
}

window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.code !== 'KeyS') return;
  if (state.screen !== 'editor' && state.screen !== 'tokens') return;
  e.preventDefault();
  openSaveVersionDialog();
});
window.addEventListener('sigma:versions', (e) => e.detail === getCurrentFileId() && refreshHistory());
