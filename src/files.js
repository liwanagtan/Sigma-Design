// File management: every Sigma file is a record in IndexedDB (see db.js). This module owns
// the currently open file, autosave, thumbnails, cross-tab notifications and migration.
import { db } from './db.js';
import {
  state, uid, setPersistence, flushSave, hasUnsavedChanges, LEGACY_STORAGE_KEY, migrateDocument,
} from './store.js';
import { buildSVG, download, toast } from './io.js';
import { snapshotForLibrary } from './variables.js';
import { importTokens } from './tokens-io.js';

const TAB_ID = uid();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('sigma-files') : null;

let currentFileId = null;
let currentDeleted = false; // the open file was deleted in another tab: stop writing it
let saving = Promise.resolve();
let inFlight = 0; // autosaves started but not yet written

// IndexedDB writes can't finish while a page unloads, so unsaved work is also stashed synchronously in
// localStorage when the page is hidden or closed, and applied the next time the file is opened.
const PENDING_KEY = 'sigma.pending';

function stashPending() {
  if (!currentFileId || currentDeleted || !state.doc) return;
  if (!hasUnsavedChanges() && !inFlight) return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id: currentFileId, doc: state.doc, views: state.pageViews, t: Date.now() }));
  } catch {
    // Too large for localStorage (e.g. big images); the regular autosave is still attempted.
  }
}

function readPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    return null;
  }
}
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
  window.addEventListener('pagehide', stashPending);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && stashPending());
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
  const pending = readPending();
  if (pending?.id === id) {
    if (pending.t > meta.updatedAt) {
      // Changes from the last session that didn't reach IndexedDB before the page closed.
      meta.updatedAt = pending.t;
      await db.putFile(meta, { id, doc: pending.doc, views: pending.views || {} });
      localStorage.removeItem(PENDING_KEY);
      return { meta, doc: pending.doc, views: pending.views || {} };
    }
    localStorage.removeItem(PENDING_KEY);
  }
  return { meta, doc: rec.doc, views: rec.views || {} };
}

export async function storageSummary() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (!est?.usage) return '';
  const mb = est.usage / (1024 * 1024);
  return `${mb < 0.1 ? '<0.1' : mb.toFixed(mb < 10 ? 1 : 0)} MB used in this browser`;
}

// ---------- mutations ----------
// Files are design files (a canvas) or token files (design tokens only, no canvas).
export const fileKind = (metaOrDoc) => (metaOrDoc?.kind === 'tokens' ? 'tokens' : 'design');

export function newTokenDocument(name = 'Untitled tokens') {
  return { kind: 'tokens', name, pages: [], currentPageId: null, variables: { collections: [] } };
}

const metaFor = (id, doc, extra = {}) => ({
  id,
  kind: fileKind(doc),
  tokenVersion: doc.published?.version || 0,
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

// Import files as new files: Sigma design or token files (.sigma.json), or design tokens in the W3C
// format (tokens.json), which become a token file. Returns the new ids.
export async function importFiles(fileList) {
  const ids = [];
  for (const f of fileList) {
    try {
      const json = JSON.parse(await f.text());
      const name = f.name.replace(/(\.sigma|\.tokens)?\.json$/i, ''); // the name you see in Finder wins
      let doc = json;
      if (fileKind(json) !== 'tokens' && !json?.pages?.length) {
        const { collections, skipped } = importTokens(json);
        if (!collections.some((c) => c.variables.length)) throw new Error('no Sigma file or design tokens found');
        doc = newTokenDocument(name || 'Imported tokens');
        doc.variables.collections = collections;
        if (skipped) toast(`${skipped} token${skipped === 1 ? '' : 's'} of unsupported types (like shadows) were skipped.`);
      }
      doc.name = name || doc.name || 'Untitled';
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

// ---------- token files as libraries ----------
export async function listTokenFiles() {
  return (await listFiles()).filter((f) => fileKind(f) === 'tokens');
}

// The latest published version of a token file: { meta, published } or null.
export async function loadPublished(id) {
  const file = await loadFile(id);
  if (!file || fileKind(file.meta) !== 'tokens') return null;
  return { meta: file.meta, published: file.doc.published || null };
}

const publishedFrom = (collections, prev, notes) => ({
  version: (prev?.version || 0) + 1, publishedAt: Date.now(), notes: notes || '', collections: structuredClone(collections),
});

// Create a token file holding `collections`, already published as v1.
export async function createTokenFileWith(name, collections, notes = 'Initial version') {
  const doc = newTokenDocument(name);
  doc.variables.collections = structuredClone(collections);
  doc.published = publishedFrom(collections, null, notes);
  const id = await createFile(doc);
  return { id, name, published: doc.published };
}

// Add collections to an existing (closed) token file and publish a new version.
export async function appendToTokenFile(id, collections, notes) {
  const file = await loadFile(id);
  if (!file) throw new Error('That token file no longer exists.');
  const doc = file.doc;
  doc.variables ||= { collections: [] };
  doc.variables.collections.push(...structuredClone(collections));
  doc.published = publishedFrom(doc.variables.collections, doc.published, notes);
  const meta = { ...file.meta, updatedAt: Date.now(), tokenVersion: doc.published.version };
  await db.putFile(meta, { id, doc, views: file.views });
  broadcast('saved', id);
  broadcast('published', id);
  return { id, name: meta.name, published: doc.published };
}

// The sample: a token file with the design-system tokens, and a design file that links it.
export async function createSampleFiles(doc) {
  const cols = doc.variables?.collections || [];
  if (!cols.length) return createFile(doc);
  doc.variables.collections = [];
  const lib = await createTokenFileWith(`${doc.name} tokens`, cols);
  doc.libraries = [{
    fileId: lib.id, name: lib.name, version: lib.published.version,
    collections: snapshotForLibrary(cols, lib.id),
  }];
  return createFile(doc);
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
  inFlight++;
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
    const publishedBefore = meta.tokenVersion || 0;
    meta.tokenVersion = doc.published?.version || 0;
    if (edited) meta.updatedAt = Date.now();
    await db.putFile(meta, { id, doc, views });
    if (edited) {
      broadcast('saved', id);
      scheduleThumbnail();
    }
    if (meta.tokenVersion !== publishedBefore) broadcast('published', id);
  }).catch((err) => {
    console.error(err);
    toast(`Autosave failed: ${err.message}. Use Save file… to keep a copy.`);
  }).finally(() => {
    inFlight--;
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
// Token files: a palette of their color tokens (first mode), or nothing if they have none yet.
async function renderTokenThumbnail() {
  const colors = [];
  for (const c of state.doc.variables?.collections || []) {
    for (const v of c.variables || []) {
      const val = v.valuesByMode?.[c.defaultModeId];
      if (v.type === 'color' && typeof val === 'string') colors.push(val);
    }
  }
  if (!colors.length) return null;
  const cv = document.createElement('canvas');
  cv.width = THUMB_W;
  cv.height = THUMB_H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  const shown = colors.slice(0, 24);
  const cols = Math.min(6, shown.length), rows = Math.ceil(shown.length / cols);
  const pad = 32, gap = 12;
  const size = Math.min((THUMB_W - pad * 2 - gap * (cols - 1)) / cols, (THUMB_H - pad * 2 - gap * (rows - 1)) / rows);
  const x0 = (THUMB_W - (cols * size + (cols - 1) * gap)) / 2, y0 = (THUMB_H - (rows * size + (rows - 1) * gap)) / 2;
  shown.forEach((hex, i) => {
    const x = x0 + (i % cols) * (size + gap), y = y0 + Math.floor(i / cols) * (size + gap);
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, size * 0.22);
    ctx.fillStyle = hex; // #RRGGBB or #RRGGBBAA
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.stroke();
  });
  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}

async function renderThumbnail() {
  if (fileKind(state.doc) === 'tokens') return renderTokenThumbnail();
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
