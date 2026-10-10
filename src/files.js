// File management: every Sigma file is a record in IndexedDB (see db.js). This module owns
// the currently open file, autosave, thumbnails, cross-tab notifications and migration.
import { db } from './db.js';
import { state, uid, setPersistence, flushSave, LEGACY_STORAGE_KEY, migrateDocument } from './store.js';
import { buildSVG, download, toast } from './io.js';

const TAB_ID = uid();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('sigma-files') : null;

let currentFileId = null;
let currentDeleted = false; // the open file was deleted in another tab: stop writing it
let saving = Promise.resolve();
let thumbTimer = null;

export const getCurrentFileId = () => currentFileId;

// ---------- navigation ----------
export const fileHref = (id) => `#/file/${id}`;
export function openFile(id) {
  location.hash = fileHref(id);
}
export function goHome() {
  location.hash = '#/';
}

// ---------- setup ----------
// `handlers.onRemoteChange({ type, id })` is called when another tab saves, renames or deletes a file.
export async function initFiles(handlers = {}) {
  setPersistence(persistCurrent);
  channel?.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.from === TAB_ID) return;
    if (msg.type === 'deleted' && msg.id === currentFileId) currentDeleted = true;
    handlers.onRemoteChange?.(msg);
  });
  navigator.storage?.persist?.().catch(() => {});
  await migrateLegacyDocument();
}

function broadcast(type, id) {
  channel?.postMessage({ type, id, from: TAB_ID });
}

// The single document from before the files home becomes the first file. The old key is only
// removed after the new record is safely written.
async function migrateLegacyDocument() {
  let raw;
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const { doc, views } = JSON.parse(raw);
    if (doc?.pages?.length) await createFile(doc, views || {});
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.error('Could not migrate the previous document', err);
  }
}

// ---------- queries ----------
export async function listFiles() {
  return db.getAll('files');
}

export async function loadFile(id) {
  const [meta, rec] = await Promise.all([db.get('files', id), db.get('docs', id)]);
  if (!meta || !rec?.doc) return null;
  return { meta, doc: rec.doc, views: rec.views || {} };
}

export async function storageSummary() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (!est?.usage) return '';
  const mb = est.usage / (1024 * 1024);
  return `${mb < 0.1 ? '<0.1' : mb.toFixed(mb < 10 ? 1 : 0)} MB used in this browser`;
}

// ---------- mutations ----------
const metaFor = (id, doc, extra = {}) => ({
  id,
  name: doc.name || 'Untitled',
  background: doc.pages?.[0]?.background || '#F5F5F5',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  thumbnail: null,
  ...extra,
});

export async function createFile(doc, views = {}, extra = {}) {
  const id = uid() + uid();
  migrateDocument(doc);
  await db.putFile(metaFor(id, doc, extra), { id, doc, views });
  broadcast('created', id);
  return id;
}

export async function renameFile(id, name) {
  name = name.trim() || 'Untitled';
  if (id === currentFileId && state.doc) {
    state.doc.name = name; // the open editor saves it (and the meta) on its next autosave
  }
  const file = await loadFile(id);
  if (!file) return;
  file.doc.name = name;
  await db.putFile({ ...file.meta, name }, { id, doc: file.doc, views: file.views });
  broadcast('renamed', id);
}

export async function duplicateFile(id) {
  if (id === currentFileId) await flushSave();
  const file = await loadFile(id);
  if (!file) return null;
  const doc = structuredClone(file.doc);
  doc.name = `${file.meta.name} (copy)`;
  return createFile(doc, structuredClone(file.views), { thumbnail: file.meta.thumbnail });
}

export async function deleteFile(id) {
  await db.deleteFile(id);
  broadcast('deleted', id);
}

export async function downloadFile(id) {
  if (id === currentFileId) await flushSave();
  const file = await loadFile(id);
  if (!file) return;
  const name = (file.meta.name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-');
  download(new Blob([JSON.stringify(file.doc)], { type: 'application/json' }), `${name}.sigma.json`);
}

// Import .sigma.json files as new files. Returns the new ids.
export async function importFiles(fileList) {
  const ids = [];
  for (const f of fileList) {
    try {
      const doc = JSON.parse(await f.text());
      if (!doc?.pages?.length) throw new Error('not a Sigma file');
      doc.name = f.name.replace(/(\.sigma)?\.json$/i, '') || doc.name || 'Untitled'; // the name you see in Finder wins
      ids.push(await createFile(doc));
    } catch (err) {
      toast(`Couldn't import ${f.name}: ${err.message}`);
    }
  }
  return ids;
}

export function pickFilesToImport() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = true;
    input.onchange = async () => resolve(await importFiles([...input.files]));
    input.click();
  });
}

// ---------- the open file ----------
export function setCurrentFile(id) {
  currentFileId = id;
  currentDeleted = false;
}

// Called (debounced) by the store whenever the open document changes.
function persistCurrent(doc, views, { edited }) {
  const id = currentFileId;
  if (!id || currentDeleted) return saving;
  saving = saving.then(async () => {
    const meta = await db.get('files', id);
    if (!meta) {
      currentDeleted = true; // deleted elsewhere; don't resurrect it
      return;
    }
    if (!edited) {
      // View-only change (pan/zoom): never rewrite the document, which another tab may have updated.
      const rec = await db.get('docs', id);
      if (rec) await db.put('docs', { ...rec, views });
      return;
    }
    meta.name = doc.name || 'Untitled';
    meta.background = doc.pages?.[0]?.background || meta.background;
    if (edited) meta.updatedAt = Date.now();
    await db.putFile(meta, { id, doc, views });
    if (edited) {
      broadcast('saved', id);
      scheduleThumbnail();
    }
  }).catch((err) => {
    console.error(err);
    toast(`Autosave failed: ${err.message}. Use Save file… to keep a copy.`);
  });
  return saving;
}

// Write pending changes and refresh the thumbnail right away (tab hidden, leaving the file).
export async function saveNow() {
  if (!currentFileId) return;
  await flushSave();
  await saving;
  clearTimeout(thumbTimer);
  if (!currentDeleted) await updateThumbnail();
}

// Forget the open file without saving (reloading after another tab changed it).
export function discardCurrentFile() {
  clearTimeout(thumbTimer);
  currentFileId = null;
}

// Save, then forget the open file (when going back to the files home).
export async function closeCurrentFile() {
  if (!currentFileId) return;
  await saveNow();
  currentFileId = null;
}

// ---------- thumbnails ----------
function scheduleThumbnail() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => void updateThumbnail(), 2000);
}

const THUMB_W = 480, THUMB_H = 360;

// Render the first page of the open document to a PNG blob (null for an empty page).
async function renderThumbnail() {
  const pg = state.doc?.pages?.[0];
  const nodes = pg?.children.filter((n) => n.visible) || [];
  if (!nodes.length) return null;
  const { svg, box } = buildSVG(nodes, { ordered: true });
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = THUMB_W;
  cv.height = THUMB_H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = pg.background || '#F5F5F5';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  const pad = 24;
  const s = Math.min((THUMB_W - pad * 2) / box.w, (THUMB_H - pad * 2) / box.h, 2);
  const w = box.w * s, h = box.h * s;
  ctx.drawImage(img, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);
  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}

export async function updateThumbnail() {
  const id = currentFileId;
  if (!id || !state.doc) return;
  let thumbnail = null;
  try {
    thumbnail = await renderThumbnail();
  } catch (err) {
    console.warn('Thumbnail failed', err);
    return;
  }
  const meta = await db.get('files', id);
  if (!meta) return;
  meta.thumbnail = thumbnail;
  await db.put('files', meta);
  broadcast('thumbnail', id);
}
