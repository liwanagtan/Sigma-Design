// File management: every Sigma file is a record in IndexedDB (see db.js). This module owns
// the currently open file, autosave, thumbnails, cross-tab notifications and migration.
import { db } from './db.js';
import {
  state, uid, setPersistence, flushSave, hasUnsavedChanges, LEGACY_STORAGE_KEY, migrateDocument,
} from './store.js';
import { buildSVG, download, toast } from './io.js';
import { libraryEntry } from './variables.js';
import { welcomeDocument, WELCOME_VERSION, WELCOME_ICONS } from './welcome.js';
import { newIconsDocument, sanitizeIcons, iconMarkup, usedIconIds, ICON_SETS, loadIconSet } from './icon-library.js';
import { sampleIconsDocument, SAMPLE_ICONS_NAME, SAMPLE_ICONS_VERSION, sampleIconId } from './sample-icons.js';
import { sigmaPagesDocument, SIGMA_PAGES_VERSION } from './sigma-pages.js';
import { opticsTokenDocument } from './optics-tokens.js';
import { opticsComponentsDocument, opticsFoundationsDocument, opticsIconsDocument, OPTICS_ICON_NAMES } from './optics.js';

// The sample files (the guide, its sample tokens and its sample icons) live in the files home's Welcome to
// Sigma folder rather than with your own files.
export const isSampleFile = (meta) => !!(meta?.welcome || meta?.sample || meta?.sampleLegacy);
const LEGACY_SAMPLE_TOKENS_NAME = 'Sample design tokens';
// What the sample tokens and icons were called before the file kinds lost their "Sigma" (2026-10).
const PREVIOUS_SAMPLE_NAMES = { tokens: 'Sigma Tokens', icons: 'Sigma Icons' };
// Names earlier versions gave their sample files, before they were marked as samples.
const LEGACY_SAMPLE_NAMES = { design: ['Welcome to Sigma', 'Sample design file'], tokens: ['Welcome to Sigma tokens', LEGACY_SAMPLE_TOKENS_NAME] };

// Once: sample files from before samples were marked move to the Welcome to Sigma folder (by their exact
// sample names). Nothing is renamed or changed otherwise.
async function migrateLegacySamples() {
  const KEY = 'sigma.samplesMarked';
  try {
    if (localStorage.getItem(KEY)) return;
  } catch {
    return;
  }
  for (const f of await db.getAll('files')) {
    if (isSampleFile(f) || !LEGACY_SAMPLE_NAMES[fileKind(f)]?.includes(f.name)) continue;
    await db.updateFile(f.id, (meta) => ({ meta: { ...meta, sampleLegacy: true } }));
  }
  try {
    localStorage.setItem(KEY, '1');
  } catch {}
}

// Only the current sample files stay in the folder. Older ones (earlier guides, replaced sample tokens,
// samples from older versions of Sigma) go to the Archive, never deleted: they may hold your edits, and
// files that used old sample tokens keep working. `keep`: ids of the current guide and its tokens.
async function archiveSamples(keep) {
  let n = 0;
  for (const m of await listFiles()) {
    if (isSampleFile(m) && !keep.has(m.id) && (await archiveFile(m.id))) n++;
  }
  return n;
}

const currentGuide = async () => (await listFiles())
  .filter((m) => m.welcome === WELCOME_VERSION && !m.sigmaSystem && fileKind(m) === 'design')
  .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;

// Once per guide version: make the Welcome to Sigma folder hold exactly the current guide
// and the sample tokens it uses. If you've had sample files before but there's no current guide, one is
// made with the current interface system; then older sample files move to the Archive.
// A browser that never had sample files is left alone (the first visit makes them).
async function setUpWelcomeFolder() {
  const KEY = 'sigma.welcomeFolder';
  try {
    if (localStorage.getItem(KEY) === String(WELCOME_VERSION)) return;
  } catch {
    return;
  }
  if ((await db.getAll('files')).some(isSampleFile)) {
    const guide = await currentGuide();
    if (!guide) await welcomeFile(); // makes the current pair and archives the rest
    else {
      const keep = new Set([guide.id, ...(await listFiles()).filter(m => (m.sigmaSystem === SIGMA_SYSTEM_VERSION || m.sigmaPages === SIGMA_PAGES_VERSION)).map(m => m.id)]);
      const doc = (await loadFile(guide.id))?.doc;
      for (const l of doc?.libraries || []) {
        keep.add(l.fileId);
      }
      for (const l of doc?.iconLibraries || []) keep.add(l.fileId);
      await archiveSamples(keep);
    }
  }
  try {
    localStorage.setItem(KEY, String(WELCOME_VERSION));
  } catch {}
}

import { sampleTokenDocument } from './sample-tokens.js';
import { sigmaTokenDocument, sigmaFoundationsDocument, sigmaComponentsDocument, SIGMA_SYSTEM_VERSION } from './sigma-design-system.js';
import { importTokens } from './tokens-io.js';

const TAB_ID = uid();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('sigma-files') : null;

let currentFileId = null;
let currentDeleted = false; // the open file was deleted or archived in another tab: stop writing it
// Welcome files are temporary playgrounds. Edits stay in memory and never replace their originals.
// Make an editable copy keeps the current session as a regular saved file.
let currentSample = false;
export const isCurrentSample = () => currentSample;
const SAMPLE_READONLY = 'Sample files keep their original content. Duplicate it to make your own copy.';
let saving = Promise.resolve();
let inFlight = 0; // autosaves started but not yet written

// IndexedDB writes can't finish while a page unloads, so unsaved work is also stashed synchronously in
// localStorage when the page is hidden or closed, and applied the next time the file is opened.
const PENDING_KEY = 'sigma.pending';

function stashPending() {
  if (!currentFileId || currentDeleted || currentSample || !state.doc || state.readOnly) return;
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
    if ((msg.type === 'deleted' || msg.type === 'archived') && msg.id === currentFileId) currentDeleted = true;
    handlers.onRemoteChange?.(msg);
  });
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('pagehide', stashPending);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && stashPending());
  await migrateLegacyDocument();
  await migrateLegacySamples();
  await setUpWelcomeFolder();
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
// Files in use (not in the Archive).
export async function listFiles() {
  return (await db.getAll('files')).filter((f) => !f.archivedAt);
}

// ---------- the Archive ----------
// Deleting a file moves it to the Archive (soft delete): it keeps everything, including its version history,
// but leaves Recents, the file lists and library pickers until it's restored. Only "Delete forever" in the
// Archive erases a file.
export const isArchived = (meta) => !!meta?.archivedAt;

export async function listArchivedFiles() {
  return (await db.getAll('files')).filter((f) => f.archivedAt);
}

export async function archiveFile(id) {
  if (id === currentFileId) await flushSave();
  const done = await db.updateFile(id, (meta) => ({ meta: { ...meta, archivedAt: Date.now() } }));
  if (done) broadcast('archived', id);
  return done;
}

export async function restoreFile(id) {
  const done = await db.updateFile(id, (meta) => {
    const { archivedAt, ...rest } = meta;
    return { meta: rest };
  });
  if (done) broadcast('restored', id);
  return done;
}

export async function emptyArchive() {
  const files = await listArchivedFiles();
  for (const f of files) await deleteFile(f.id);
  return files.length;
}

export async function loadFile(id) {
  const [meta, rec] = await Promise.all([db.get('files', id), db.get('docs', id)]);
  if (!meta || !rec?.doc) return null;
  const pending = readPending();
  if (pending?.id === id) {
    if (pending.t > meta.updatedAt && !isSampleFile(meta)) { // a sample is never saved, not even this way
      // Changes from the last session that didn't reach IndexedDB before the page closed.
      meta.updatedAt = pending.t;
      localStorage.removeItem(PENDING_KEY);
      const exists = await db.updateFile(id, (cur) => ({ meta: { ...cur, updatedAt: pending.t }, doc: { id, doc: pending.doc, views: pending.views || {} } }));
      if (!exists) return null;
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
// Files are design files (a canvas), tokens files (Design tokens only, no canvas) or Sigma
// Icons files (icons imported from SVG, no canvas).
export const fileKind = (metaOrDoc) => (metaOrDoc?.kind === 'tokens' || metaOrDoc?.kind === 'icons' ? metaOrDoc.kind : 'design');
export { newIconsDocument };

export function newTokenDocument(name = 'Untitled tokens') {
  return { kind: 'tokens', name, pages: [], currentPageId: null, variables: { collections: [] } };
}

const metaFor = (id, doc, extra = {}) => ({
  id,
  kind: fileKind(doc),
  tokenVersion: doc.published?.version || 0,
  componentVersion: doc.publishedComponents?.version || 0,
  name: doc.name || 'Untitled',
  background: doc.pages?.[0]?.background || '#F5F5F5',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  thumbnail: null,
  ...extra,
});

// Replace a stored file's document (a project file reloaded from disk), keeping its views and history.
export async function replaceFile(id, doc, metaPatch = {}) {
  migrateDocument(doc);
  const ok = await db.updateFile(id, (meta, rec) => meta && {
    meta: { ...meta, kind: fileKind(doc), name: doc.name || 'Untitled', background: doc.pages?.[0]?.background || meta.background,
      tokenVersion: doc.published?.version || 0, componentVersion: doc.publishedComponents?.version || 0, ...metaPatch, updatedAt: Date.now() },
    doc: { id, doc, views: rec?.views || {} },
  });
  if (ok) broadcast('saved', id);
  return ok;
}

// Change a stored file's metadata only.
export async function updateFileMeta(id, patch) {
  return db.updateFile(id, (meta) => meta && { meta: { ...meta, ...patch } });
}

export async function createFile(doc, views = {}, extra = {}) {
  const id = uid() + uid();
  migrateDocument(doc);
  await db.putFile(metaFor(id, doc, extra), { id, doc, views });
  broadcast('created', id);
  return id;
}

export async function renameFile(id, name) {
  name = name.trim() || 'Untitled';
  if (isSampleFile(await db.get('files', id))) return toast(SAMPLE_READONLY);
  if (id === currentFileId && state.doc) {
    state.doc.name = name; // the open editor saves it (and the meta) on its next autosave
  }
  const renamed = await db.updateFile(id, (meta, rec) => ({ meta: { ...meta, name }, doc: rec && { ...rec, doc: { ...rec.doc, name } } }));
  if (renamed) broadcast('renamed', id);
}

export async function duplicateFile(id) {
  if (id === currentFileId) await flushSave();
  const file = await loadFile(id);
  if (!file) return null;
  const doc = structuredClone(file.doc);
  doc.name = `${file.meta.name} (copy)`;
  return createFile(doc, structuredClone(file.views), { thumbnail: file.meta.thumbnail });
}

// Erase a file for good (with its versions). The files home only does this from the Archive.
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
// format (tokens.json), which become a token file; .fig files become design files. Returns new ids.
export async function importFiles(fileList) {
  const ids = [], figReports = [];
  for (const f of fileList) {
    try {
      if (/\.fig$/i.test(f.name)) {
        toast(`Importing ${f.name}…`);
        const { readFigmaFile } = await import('./figma-import-file.js');
        const { doc, report } = await readFigmaFile(f);
        ids.push(await createFile(doc));
        figReports.push(report);
        if (report.warnings.length) toast('Figma file imported. Review simplified features in Σ → Figma import report.');
        continue;
      }
      const json = JSON.parse(await f.text());
      const name = f.name.replace(/(\.sigma|\.tokens)?\.json$/i, ''); // the name you see in Finder wins
      let doc = json;
      if (fileKind(json) === 'icons') {
        json.icons = sanitizeIcons(json.icons); // icons from elsewhere go through the SVG filter
        if (json.published) json.published.icons = sanitizeIcons(json.published.icons);
      } else if (fileKind(json) !== 'tokens' && !json?.pages?.length) {
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
  if (ids.length === 1 && figReports[0]?.warnings.length) window.dispatchEvent(new CustomEvent('sigma:figma-imported', {detail:figReports[0]}));
  return ids;
}

export function pickFilesToImport() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fig,.json,application/json';
    input.multiple = true;
    input.onchange = async () => resolve(await importFiles([...input.files]));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

// ---------- design files as component libraries ----------
// Design files that have published components.
export async function listComponentLibraries() {
  return (await listFiles()).filter((f) => fileKind(f) === 'design' && f.componentVersion > 0);
}

// The latest published components of a design file: { meta, published } or null.
export async function loadPublishedComponents(id) {
  const file = await loadFile(id);
  if (!file || fileKind(file.meta) !== 'design') return null;
  return { meta: file.meta, published: file.doc.publishedComponents || null };
}

// ---------- icon files as libraries ----------
export async function listIconFiles() {
  return (await listFiles()).filter((f) => fileKind(f) === 'icons');
}

// The latest published icons of an icons file: { meta, published } or null.
export async function loadPublishedIcons(id) {
  const file = await loadFile(id);
  if (!file || fileKind(file.meta) !== 'icons') return null;
  return { meta: file.meta, published: file.doc.published || null };
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

// Create a token file holding `collections`, already published as v1. `libraries` / `dependencies`: token
// files those collections point at (linked in the new file, and published with it). `meta`: extra file metadata.
export async function createTokenFileWith(name, collections, notes = 'Initial version', { libraries = [], dependencies = [], meta = {} } = {}) {
  const doc = newTokenDocument(name);
  doc.variables.collections = structuredClone(collections);
  doc.published = publishedFrom(collections, null, notes);
  if (libraries.length) doc.libraries = structuredClone(libraries);
  if (dependencies.length) doc.published.dependencies = structuredClone(dependencies);
  const id = await createFile(doc, {}, meta);
  return { id, name, published: doc.published };
}

// Add collections to an existing (closed) token file and publish a new version.
export async function appendToTokenFile(id, collections, notes, { libraries = [], dependencies = [] } = {}) {
  const file = await loadFile(id);
  if (!file) throw new Error('That tokens file no longer exists.');
  if (isSampleFile(file.meta)) throw new Error('The sample tokens keep their original content. Pick another file.');
  const doc = file.doc;
  doc.variables ||= { collections: [] };
  doc.variables.collections.push(...structuredClone(collections));
  const deps = new Map((doc.published?.dependencies || []).map((d) => [d.fileId, d]));
  for (const d of dependencies) if (d.fileId !== id && (!deps.has(d.fileId) || d.version > deps.get(d.fileId).version)) deps.set(d.fileId, structuredClone(d));
  for (const l of libraries) if (l.fileId !== id && !(doc.libraries ||= []).some((x) => x.fileId === l.fileId)) doc.libraries.push(structuredClone(l));
  doc.published = publishedFrom(doc.variables.collections, doc.published, notes);
  if (deps.size) doc.published.dependencies = [...deps.values()];
  let name = file.meta.name;
  const exists = await db.updateFile(id, (meta) => {
    name = meta.name;
    return { meta: { ...meta, updatedAt: Date.now(), tokenVersion: doc.published.version }, doc: { id, doc, views: file.views } };
  });
  if (!exists) throw new Error('That tokens file no longer exists.');
  broadcast('saved', id);
  broadcast('published', id);
  return { id, name, published: doc.published };
}

// Sigma’s built-in UI Tokens: reuse only the current generated system. Old teaching token
// files and editable copies are never used as its source. Returns { id, name, published }.
export async function sampleTokenFile() {
  const expected = sigmaTokenDocument().collections;
  const candidates = (await listTokenFiles()).filter(m => m.sample && m.sigmaSystem === SIGMA_SYSTEM_VERSION);
  for (const meta of candidates) {
    const published = (await loadPublished(meta.id))?.published;
    if (published && expected.every(c => {
      const actual = published.collections.find(x => x.name === c.name);
      return actual && actual.variables.length === c.variables.length && actual.modes.map(m => m.name).join(',') === 'Light,Dark' && c.variables.every(v => actual.variables.some(x => x.name === v.name && x.type === v.type));
    })) return { id: meta.id, name: meta.name, published };
  }
  const { name, collections } = sigmaTokenDocument();
  return createTokenFileWith(name, collections, 'Sigma interface tokens; Light and Dark from styles.css.', { meta: { sample: true, sigmaSystem: SIGMA_SYSTEM_VERSION } });
}

// The sample icons (the whole Lucide set, made the first time). Reuses one of the current kind
// (SAMPLE_ICONS_VERSION) that still has every icon the guide uses; null if the Lucide data can't be read (the
// guide is then made without icons).
export async function sampleIconFile() {
  for (const meta of (await listIconFiles()).filter((m) => m.sample && m.sampleIcons === SAMPLE_ICONS_VERSION).sort((a, b) => b.updatedAt - a.updatedAt)) {
    const published = (await loadPublishedIcons(meta.id))?.published;
    if (!published) continue;
    const ids = new Set(published.icons.map((x) => x.id));
    if (![...WELCOME_ICONS, ...OPTICS_ICON_NAMES.map((n) => sampleIconId(n))].every((id) => ids.has(id))) continue; // icons the guide or Optics use are missing
    if ([PREVIOUS_SAMPLE_NAMES.icons, 'Sample icons'].includes(meta.name)) {
      // Earlier built-in names become Icons in place; keep the same file and icon IDs.
      await db.updateFile(meta.id, (m, rec) => ({ meta: { ...m, name: SAMPLE_ICONS_NAME }, doc: rec && { ...rec, doc: { ...rec.doc, name: SAMPLE_ICONS_NAME } } }));
      broadcast('renamed', meta.id);
      meta.name = SAMPLE_ICONS_NAME;
    }
    return { id: meta.id, name: meta.name, published };
  }
  let doc;
  try {
    doc = sampleIconsDocument(await loadIconSet(ICON_SETS.find((s) => s.id === 'lucide')));
  } catch (err) {
    console.warn('Could not make the sample icons', err);
    return null;
  }
  const id = await createFile(doc, {}, { sample: true, sampleIcons: SAMPLE_ICONS_VERSION });
  return { id, name: SAMPLE_ICONS_NAME, published: doc.published };
}

// "Welcome to Sigma": the guide file a new user starts with, linking the sample tokens and icons. Reopens the most
// recently edited copy of the current version (WELCOME_VERSION); otherwise makes a new one and moves the
// older sample files to the Archive.
export async function welcomeFile() {
  const current = await currentGuide();
  if (current) return current.id;
  const lib = await sampleTokenFile();
  const icons = await sampleIconFile();
  // The Guide retains its educational alias/extension examples as local tokens.
  // The shipped Tokens library now contains only Sigma's interface design system.
  const teaching = sampleTokenDocument().collections;
  const doc = welcomeDocument(teaching, { icons: icons?.published.icons || null });
  doc.variables = { collections: teaching };
  doc.libraries = [libraryEntry(lib.id, lib.name, lib.published)];
  if (icons) {
    // Like any design file, the guide keeps copies of just the icons it uses.
    const used = usedIconIds(doc.pages.flatMap((pg) => pg.children));
    doc.iconLibraries = [{
      fileId: icons.id, name: icons.name, version: icons.published.version, count: icons.published.icons.length,
      icons: structuredClone(icons.published.icons.filter((x) => used.has(x.id))),
    }];
  }
  const systemIds = [];
  for (const make of [sigmaFoundationsDocument, sigmaComponentsDocument]) {
    const systemDoc = make(lib.published.collections);
    systemDoc.libraries = [libraryEntry(lib.id, lib.name, lib.published)];
    if (icons) {
      const used = usedIconIds(systemDoc.pages.flatMap(pg => pg.children));
      if (used.size) systemDoc.iconLibraries = [{ fileId: icons.id, name: icons.name, version: icons.published.version, count: icons.published.icons.length, icons: structuredClone(icons.published.icons.filter(x => used.has(x.id))) }];
    }
    systemIds.push(await createFile(systemDoc, {}, { sample: true, sigmaSystem: SIGMA_SYSTEM_VERSION }));
  }
  const pagesDoc = sigmaPagesDocument(lib.published.collections);
  pagesDoc.libraries = [libraryEntry(lib.id, lib.name, lib.published)];
  systemIds.push(await createFile(pagesDoc, {}, { sample:true, sigmaPages:SIGMA_PAGES_VERSION }));
  // Create the Guide last: an interrupted setup can safely retry without a partial current guide.
  const id = await createFile(doc, {}, { welcome: WELCOME_VERSION });
  await opticsOnce(icons);
  // The new guide replaces the old one: older sample files go to the Archive.
  const moved = await archiveSamples(new Set([id, lib.id, ...systemIds, ...(icons ? [icons.id] : [])]));
  if (moved) toast(`Moved ${moved === 1 ? 'the previous sample file' : `${moved} older sample files`} to the Archive`);
  return id;
}

// Optics (Phase 36): a working design system as your own files (saved like any other): Optics Tokens, Optics
// Icons (made from the sample icons), Optics Components (published, so other files can link it) and Optics
// Foundations. Made once, with the first Welcome to Sigma in this browser (not again if you've deleted them).
const OPTICS_KEY = 'sigma.optics';
async function opticsOnce(icons) {
  try {
    if (localStorage.getItem(OPTICS_KEY)) return [];
  } catch {
    return []; // no storage to remember it in: don't make them every time
  }
  if ((await listFiles()).some((m) => m.optics && !isSampleFile(m))) return [];
  const ids = await opticsFiles(icons);
  try {
    localStorage.setItem(OPTICS_KEY, '1');
  } catch {}
  return ids;
}
async function opticsFiles(icons) {
  const meta = { optics: 1 };
  const { name, collections } = opticsTokenDocument();
  const tokens = await createTokenFileWith(name, collections, 'Optics v1', { meta });
  // Optics Icons: the sample icons as Optics' own file (with Lucide's license and credit).
  let opticsIcons = null;
  if (icons) {
    const doc = opticsIconsDocument(icons.published.icons, (await loadFile(icons.id))?.doc.source || null);
    opticsIcons = { id: await createFile(doc, {}, meta), name: doc.name, published: doc.published };
  }
  const link = (doc) => {
    doc.libraries = [libraryEntry(tokens.id, tokens.name, tokens.published)];
    if (!opticsIcons) return doc;
    // Like any design file, it keeps copies of just the icons it uses.
    const used = usedIconIds(doc.pages.flatMap((pg) => pg.children));
    doc.iconLibraries = [{
      fileId: opticsIcons.id, name: opticsIcons.name, version: opticsIcons.published.version, count: opticsIcons.published.icons.length,
      icons: structuredClone(opticsIcons.published.icons.filter((x) => used.has(x.id))),
    }];
    return doc;
  };
  const components = link(opticsComponentsDocument(tokens.published.collections));
  // Published as v1, laid out as it opens, so a file linking it gets components at their real sizes.
  const [{ withDocument }, { layOutDocument }, { publishRecord }] = await Promise.all([import('./store.js'), import('./lay-out.js'), import('./libraries.js')]);
  const laidOut = withDocument(structuredClone(components), () => {
    layOutDocument();
    return publishRecord(1, 'Optics v1');
  });
  components.publishedComponents = laidOut;
  const componentsId = await createFile(components, {}, meta);
  const foundationsId = await createFile(link(opticsFoundationsDocument(tokens.published.collections, { icons: opticsIcons?.published.icons || [] })), {}, meta);
  return [tokens.id, ...(opticsIcons ? [opticsIcons.id] : []), componentsId, foundationsId];
}

// The first visit to Sigma in this browser (no files at all) starts with "Welcome to Sigma". Returns its
// id, or null when this isn't a first visit. Remembered, so it never happens again.
const WELCOMED_KEY = 'sigma.welcomed';
export async function welcomeOnFirstVisit() {
  try {
    if (localStorage.getItem(WELCOMED_KEY)) return null;
    localStorage.setItem(WELCOMED_KEY, '1');
  } catch {
    return null; // no storage to remember it in: don't create a file on every visit
  }
  if ((await db.getAll('files')).length) return null; // files already here (archived ones too)
  return welcomeFile();
}

// ---------- the open file ----------
export function setCurrentFile(id, { sample = false } = {}) {
  currentFileId = id;
  currentDeleted = false;
  currentSample = sample;
}

// A copy of the open file as a file of your own (Make an editable copy, for a Welcome to Sigma file).
export async function duplicateCurrent() {
  if (!state.doc) return null;
  const doc = structuredClone(state.doc);
  delete doc.published;
  delete doc.publishedComponents;
  doc.name = `${doc.name || 'Untitled'} (copy)`;
  return createFile(doc, structuredClone(state.pageViews || {}));
}

/** Keep the current temporary edits as a regular file, and open it. */
export async function makeEditableCopy() {
  const copy = await duplicateCurrent();
  if (!copy) return;
  window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Made an editable copy, with your files' }));
  openFile(copy);
}

// Called (debounced) by the store whenever the open document changes.
function persistCurrent(doc, views, { edited }) {
  const id = currentFileId;
  if (!id || currentDeleted || state.readOnly) return saving; // read-only: viewing an older version
  if (currentSample) return saving; // a sample is never saved: it's the same every time it opens
  inFlight++;
  saving = saving.then(async () => {
    // Every write below checks, in the same transaction, that the file still exists: a file deleted
    // elsewhere (or just now) is never brought back.
    const gone = () => void (currentDeleted = true);
    if (!edited) {
      // View-only change (pan/zoom): never rewrite the document, which another tab may have updated.
      if (!(await db.updateFile(id, (meta, rec) => rec && { doc: { ...rec, views } }))) gone();
      return;
    }
    const before = await db.get('files', id);
    if (!before) return gone();
    await autosaveVersion(id, before);
    let publishedBefore = '0/0';
    const written = await db.updateFile(id, (meta) => {
      publishedBefore = `${meta.tokenVersion || 0}/${meta.componentVersion || 0}`;
      const next = {
        ...meta, name: doc.name || 'Untitled', background: doc.pages?.[0]?.background || meta.background,
        tokenVersion: doc.published?.version || 0, componentVersion: doc.publishedComponents?.version || 0,
        updatedAt: Date.now(), lastVersionAt: before.lastVersionAt,
      };
      if (`${next.tokenVersion}/${next.componentVersion}` !== publishedBefore) next.lastVersionAt = Date.now();
      return { meta: next, doc: { id, doc, views } };
    });
    if (!written) return gone();
    broadcast('saved', id);
    scheduleThumbnail();
    const tokenVersion = doc.published?.version || 0, componentVersion = doc.publishedComponents?.version || 0;
    if (`${tokenVersion}/${componentVersion}` !== publishedBefore) {
      // Every publish is kept in the version history.
      const tokens = tokenVersion !== +publishedBefore.split('/')[0];
      const pub = tokens ? doc.published : doc.publishedComponents;
      if (pub) { // (none when a publish was undone)
        const what = fileKind(doc) === 'icons' ? 'icons' : tokens ? 'tokens' : 'components';
        await addVersion(id, doc, { kind: 'publish', title: `Published ${what} v${pub.version}`, description: pub.notes || '' });
      }
      broadcast('published', id);
    }
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

// ---------- version history ----------
// Autosave versions: when a file is edited and its newest version is at least AUTO_INTERVAL old, the
// state before this edit is kept, stamped with when it was last edited. So there's a version before
// every editing session, and one every 10 minutes during a long one. Named versions come from "Save to
// version history…", and every publish adds one. The newest MAX_AUTO autosave versions are kept.
const AUTO_INTERVAL = 10 * 60 * 1000;
const MAX_AUTO = 50;

export async function listVersions(fileId) {
  return (await db.versionsOf(fileId)).sort((a, b) => b.createdAt - a.createdAt);
}

export const loadVersionDoc = (versionId) => db.versionDoc(versionId);

async function addVersion(fileId, doc, { kind = 'auto', title = '', description = '', createdAt = Date.now() } = {}) {
  const record = { id: uid() + uid(), fileId, kind, title, description, createdAt, name: doc.name || 'Untitled' };
  await db.putVersion(record, doc);
  if (kind === 'auto') {
    const autos = (await listVersions(fileId)).filter((v) => v.kind === 'auto');
    if (autos.length > MAX_AUTO) await db.deleteVersions(autos.slice(MAX_AUTO).map((v) => v.id));
  }
  versionsChanged(fileId);
  return record;
}

function versionsChanged(fileId) {
  broadcast('versions', fileId);
  window.dispatchEvent(new CustomEvent('sigma:versions', { detail: fileId }));
}

// Before writing an edit (inside the save queue): keep the stored state as an autosave version if due.
async function autosaveVersion(id, meta) {
  const due = Date.now() - (meta.lastVersionAt || 0) >= AUTO_INTERVAL;
  if (!due) return;
  // A brand-new file has nothing worth keeping yet.
  const edited = meta.lastVersionAt || meta.updatedAt - meta.createdAt > 2000;
  meta.lastVersionAt = Date.now();
  if (!edited) return;
  const rec = await db.get('docs', id);
  if (rec?.doc) await addVersion(id, rec.doc, { createdAt: meta.updatedAt });
}

// Run `fn` in the open file's save queue, after any pending change is written.
async function afterSave(fn) {
  await flushSave();
  const run = saving.then(fn);
  saving = run.catch(() => {});
  return run;
}

// "Save to version history…": keep the current state with a title and description.
export async function saveNamedVersion(fileId, title, description = '') {
  const write = async () => {
    const [meta, rec] = await Promise.all([db.get('files', fileId), db.get('docs', fileId)]);
    if (!meta || !rec?.doc || isSampleFile(meta)) return null; // samples have no history to add to
    const version = await addVersion(fileId, rec.doc, { kind: 'named', title: title.trim() || 'Untitled version', description: description.trim() });
    await db.updateFile(fileId, (m) => ({ meta: { ...m, lastVersionAt: Date.now() } }));
    return version;
  };
  return fileId === currentFileId ? afterSave(write) : write();
}

export async function updateVersion(version, changes) {
  const record = { ...version, ...changes };
  if (record.kind === 'auto' && record.title) record.kind = 'named'; // naming an autosave keeps it for good
  await db.putVersion(record);
  versionsChanged(version.fileId);
  return record;
}

export async function deleteVersion(version) {
  await db.deleteVersions([version.id]);
  versionsChanged(version.fileId);
}

const versionLabel = (v) => (v.title ? `“${v.title}”`
  : `the autosave from ${new Date(v.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);

// Make `version` the file's current state. The state it replaces is kept as a version first, and
// publish records stay as they are (consumers' version numbers never go backwards): restored
// content that differs from the last publish simply shows as unpublished changes.
export async function restoreVersion(fileId, version) {
  const write = async () => {
    const [meta, rec, old] = await Promise.all([db.get('files', fileId), db.get('docs', fileId), loadVersionDoc(version.id)]);
    if (!meta || !rec?.doc || !old) throw new Error('That version could not be found.');
    if (isSampleFile(meta)) throw new Error(SAMPLE_READONLY);
    await addVersion(fileId, rec.doc, { kind: 'auto', title: `Before restoring ${versionLabel(version)}` });
    const doc = migrateDocument(structuredClone(old));
    doc.name = rec.doc.name;
    for (const key of ['published', 'publishedComponents']) {
      if (rec.doc[key]) doc[key] = rec.doc[key];
      else delete doc[key];
    }
    const now = Date.now();
    const exists = await db.updateFile(fileId, (m, cur) => ({ meta: { ...m, updatedAt: now, lastVersionAt: now }, doc: { id: fileId, doc, views: cur?.views || {} } }));
    if (!exists) throw new Error('This file was deleted.');
    broadcast('saved', fileId);
  };
  return fileId === currentFileId ? afterSave(write) : write();
}

// Copy a version into a new file. The copy is not a library: publish records are left out.
export async function duplicateVersion(version) {
  const doc = structuredClone(await loadVersionDoc(version.id));
  if (!doc) throw new Error('That version could not be found.');
  delete doc.published;
  delete doc.publishedComponents;
  doc.name = `${doc.name || 'Untitled'} (${version.title || new Date(version.createdAt).toLocaleDateString()})`;
  return createFile(doc);
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

// Icon files: their first icons in a grid.
async function renderIconThumbnail() {
  const shown = (state.doc.icons || []).slice(0, 24);
  if (!shown.length) return null;
  const cols = Math.min(6, shown.length), rows = Math.ceil(shown.length / cols);
  const pad = 48, cell = Math.min((THUMB_W - pad * 2) / cols, (THUMB_H - pad * 2) / rows), size = Math.min(cell * 0.55, 48);
  const x0 = (THUMB_W - cols * cell) / 2, y0 = (THUMB_H - rows * cell) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${THUMB_H}"><rect width="100%" height="100%" fill="#FFFFFF"/>` +
    shown.map((icon, i) => iconMarkup(icon, {
      x: x0 + (i % cols) * cell + (cell - size) / 2, y: y0 + Math.floor(i / cols) * cell + (cell - size) / 2, w: size, h: size, color: '#1E1E1E',
    })).join('') + '</svg>';
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = THUMB_W;
  cv.height = THUMB_H;
  cv.getContext('2d').drawImage(img, 0, 0);
  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}

async function renderThumbnail() {
  if (fileKind(state.doc) === 'tokens') return renderTokenThumbnail();
  if (fileKind(state.doc) === 'icons') return renderIconThumbnail();
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
  // Temporary edits must never overwrite the built-in thumbnail either.
  if (currentSample) return;
  let thumbnail = null;
  try {
    thumbnail = await renderThumbnail();
  } catch (err) {
    console.warn('Thumbnail failed', err);
    return;
  }
  if (await db.updateFile(id, (meta) => ({ meta: { ...meta, thumbnail } }))) broadcast('thumbnail', id);
}
