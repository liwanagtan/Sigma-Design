// Projects: Sigma files that live in a codebase's .sigma/ folder (docs/schema/README.md), so the repo is the
// source of truth and git does the versioning.
//
// Sigma runs inside a project: it reaches it through the project server it was started with (npm run sigma,
// that is sigma-design dev: tools/server.mjs), never by opening a folder itself. Each project file Sigma opens is
// kept in the browser like any other file (with meta.project = { name, path, mtime, hash }), so editing,
// autosave, undo and version history work as usual. Saving to the project (⌘S) writes the project format;
// when an agent or git changes a file on disk, Sigma reloads it (or asks, if it has changes not saved to
// the project).
import { state, commit, reindex } from './store.js';
import {
  listFiles, createFile, loadFile, replaceFile, updateFileMeta, openFile, getCurrentFileId, fileKind,
} from './files.js';
import { fromProjectFile, toProjectFile, serializeForProject, projectPath, KIND_DIRS } from './project-format.js';
import { validateFile } from './validate.js';

const POLL_MS = 2000;
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const banner = (detail) => window.dispatchEvent(new CustomEvent('sigma:banner', { detail }));

// The connected project: { name, via: 'server', files: [{ path, kind, name, mtime, size }], config }.
export const project = { connected: false, name: null, via: null, files: [], config: null };
let adapter = null;
const listeners = new Set();
export const onProjectChange = (fn) => listeners.add(fn);
const changed = () => listeners.forEach((fn) => fn());

// A short fingerprint of a file's text (FNV-1a, plus the length).
export function textHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

// ---------- reaching the project ----------
class Conflict extends Error {
  constructor(message, mtime) {
    super(message);
    this.conflict = true;
    this.mtime = mtime;
  }
}

const serverAdapter = {
  via: 'server',
  async list() {
    const r = await fetch('/api/project', { cache: 'no-store' });
    if (r.status === 404) return null; // the server runs without a project
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return r.json();
  },
  async read(path) {
    const r = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return { text: await r.text(), mtime: r.headers.get('X-Sigma-Mtime') };
  },
  // A file as committed in git (null if it isn't there); undefined when the project has no git.
  async base(path, rev = 'HEAD') {
    const r = await fetch(`/api/project/base?path=${encodeURIComponent(path)}&rev=${encodeURIComponent(rev)}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) return undefined;
    return r.text();
  },
  async changesets() {
    const r = await fetch('/api/project/changesets', { cache: 'no-store' });
    return r.ok ? r.json() : [];
  },
  async write(path, text, base) {
    const r = await fetch(`/api/project/file?path=${encodeURIComponent(path)}&base=${encodeURIComponent(base || '')}`, {
      method: 'PUT', headers: { 'X-Sigma': '1', 'Content-Type': 'application/json' }, body: text,
    });
    const body = await r.json().catch(() => ({}));
    if (r.status === 409) throw new Conflict(body.error, body.mtime);
    if (!r.ok) throw new Error(body.error || r.statusText);
    return body;
  },
};

function apply(info, via) {
  project.connected = true;
  project.via = via;
  project.name = info.name;
  project.files = info.files || [];
  project.config = info.config || null;
  changed();
}

// The server's project, if Sigma runs with one. Called once at startup.
export async function connectProject() {
  try {
    const info = await serverAdapter.list();
    if (info) {
      adapter = serverAdapter;
      apply(info, 'server');
    }
  } catch (err) {
    console.warn('No project server', err);
  }
  setInterval(poll, POLL_MS);
  // Coming back to the tab: check at once (checks pause while it's hidden).
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && poll());
}

// Check the project for changes on disk now.
export const checkProjectNow = () => poll({ force: true });

// Use any adapter ({ via, list(), read(path), write(path, text, base) }): an in-memory project in tests.
export async function connectWith(custom) {
  adapter = custom;
  apply(await adapter.list(), custom.via || 'custom');
}

// ---------- files in the browser ----------
const isProjectMeta = (m) => m?.project?.name && m.project.name === project.name;
export const projectMetaOf = async (id) => (await listFiles()).find((m) => m.id === id) || null;
async function cachedFiles() {
  return (await listFiles()).filter(isProjectMeta);
}
// fileId → project path, for saving (links are written as paths).
async function pathMap() {
  const map = new Map((await cachedFiles()).map((m) => [m.id, m.project.path]));
  return (id) => map.get(id) || null;
}
const linksOf = (file) => [...(file?.uses?.tokens || []), ...(file?.uses?.icons || []), ...(file?.uses?.components || [])];

// Does the stored copy have changes that aren't in the project? (Saving is exact: an unchanged file saves
// as the same text, so comparing fingerprints is enough.)
export async function hasUnsavedProjectChanges(id, doc = null) {
  const meta = await projectMetaOf(id);
  if (!meta?.project) return false;
  doc ||= (await loadFile(id))?.doc;
  if (!doc) return false;
  const { text } = serializeForProject(doc, { pathOf: await pathMap(), path: meta.project.path });
  return textHash(text) !== meta.project.hash;
}

// Bring a project file (and the files it uses) into the browser, from disk. Returns its file id.
// `force`: replace a stored copy even if it has changes not saved to the project.
async function bring(path, { force = false, texts = new Map(), seen = new Set() } = {}) {
  seen.add(path);
  if (!texts.has(path)) texts.set(path, await adapter.read(path));
  const { text, mtime } = texts.get(path);
  const hash = textHash(text);
  const meta = (await cachedFiles()).find((m) => m.project.path === path);
  if (meta && meta.project.hash === hash && !force) {
    if (meta.project.mtime !== mtime) await updateFileMeta(meta.id, { project: { ...meta.project, mtime } });
    // Its links may have changed on disk even if it didn't.
    for (const p of linksOf(JSON.parse(text))) if (!seen.has(p)) await bring(p, { texts, seen }).catch(() => {});
    return meta.id;
  }
  let file;
  try {
    file = JSON.parse(text);
  } catch (e) {
    throw new Error(`${path} isn’t valid JSON: ${e.message}`);
  }
  // Linked files first, so the links point at their stored copies.
  const resolved = {};
  for (const p of linksOf(file)) {
    if (seen.has(p)) continue;
    try {
      const fileId = await bring(p, { texts, seen });
      resolved[p] = { fileId, file: JSON.parse(texts.get(p).text) };
    } catch (err) {
      console.warn(`Couldn’t bring ${p}`, err);
    }
  }
  for (const m of await cachedFiles()) {
    if (!resolved[m.project.path] && linksOf(file).includes(m.project.path) && texts.has(m.project.path)) {
      resolved[m.project.path] = { fileId: m.id, file: JSON.parse(texts.get(m.project.path).text) };
    }
  }
  const { doc, warnings } = fromProjectFile(file, { path, resolve: (p) => resolved[p] || null });
  for (const w of warnings) console.warn(`${path}: ${w}`);
  const projectMeta = { name: project.name, path, mtime, hash };
  if (meta) {
    if (!force && (await hasUnsavedProjectChanges(meta.id))) return meta.id; // keep the changes made here
    await replaceFile(meta.id, doc, { project: projectMeta });
    if (meta.id === getCurrentFileId()) window.dispatchEvent(new CustomEvent('sigma:reopen'));
    return meta.id;
  }
  return createFile(doc, {}, { project: projectMeta });
}

// Bring a project file into the browser without opening it (tests, and files other files use).
export const bringProjectFile = (path, options) => bring(path, options);

// Open a project file in the editor.
export async function openProjectFile(path) {
  if (!adapter) return toast('The project isn’t connected.');
  try {
    const meta = (await cachedFiles()).find((m) => m.project.path === path);
    const disk = project.files.find((f) => f.path === path);
    if (meta && disk && disk.mtime !== meta.project.mtime && (await hasUnsavedProjectChanges(meta.id))) {
      const { text } = await adapter.read(path);
      if (textHash(text) !== meta.project.hash && confirm(`“${meta.name}” changed on disk, and it has changes here that aren’t saved to the project.\n\nOK loads the version on disk (the changes here are lost). Cancel keeps the changes here.`)) {
        openFile(await bring(path, { force: true }));
        return;
      }
    }
    openFile(await bring(path));
  } catch (err) {
    toast(`Couldn’t open ${path}: ${err.message}`);
  }
}

// ---------- saving ----------
// A free path for a new file of this kind and name.
function freePath(kind, name) {
  const base = projectPath(kind, name);
  const taken = new Set(project.files.map((f) => f.path));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const p = base.replace(/\.sigma\.json$/, `-${i}.sigma.json`);
    if (!taken.has(p)) return p;
  }
}

// Save the open file to the project (adding it if it isn't there yet). `force`: write over a version that
// changed on disk.
export async function saveToProject({ force = false } = {}) {
  if (!adapter) return toast('Sigma isn’t running in a project. Run it in one: npx sigma-design init, then npm run sigma.');
  const id = getCurrentFileId();
  if (!id || !state.doc) return;
  if (state.readOnly) return toast('You’re viewing an older version. Restore it first.');
  const meta = await projectMetaOf(id);
  const inProject = isProjectMeta(meta);
  const path = inProject ? meta.project.path : freePath(fileKind(state.doc), state.doc.name);
  const { text, warnings } = serializeForProject(state.doc, { pathOf: await pathMap(), path });
  // Check it the way an agent would before it goes in the repo.
  const files = {};
  for (const m of await cachedFiles()) {
    if (m.id === id) continue;
    const d = (await loadFile(m.id))?.doc;
    if (d) files[m.project.path] = JSON.parse(serializeForProject(d, { pathOf: await pathMap(), path: m.project.path }).text);
  }
  files[path] = JSON.parse(text);
  const errors = validateFile(files[path], { path, files }).filter((i) => i.level === 'error');
  if (errors.length) console.warn(`${path} has problems:\n${errors.map((e) => `${e.at}: ${e.message}`).join('\n')}`);
  try {
    const base = force ? (await adapter.read(path).catch(() => null))?.mtime || 'new' : inProject ? meta.project.mtime : 'new';
    const { mtime, code } = await adapter.write(path, text, base);
    await updateFileMeta(id, { project: { name: project.name, path, mtime, hash: textHash(text) } });
    state.doc.project = { path };
    window.dispatchEvent(new CustomEvent('sigma:project-saved'));
    banner(null);
    toast(`Saved to ${path}${warnings.length ? ` (${warnings.join(' ')})` : ''}${errors.length ? ` · ${errors.length} problem${errors.length === 1 ? '' : 's'} (see the console)` : ''}${codeNote(code)}`);
    await refresh();
  } catch (err) {
    if (!err.conflict) return toast(`Couldn’t save to the project: ${err.message}`);
    banner({
      text: `${path} changed on disk since it was opened (an agent or git changed it).`,
      label: 'Load the disk version', action: () => reloadFromDisk(path),
      extra: [{ label: 'Save mine over it', action: () => saveToProject({ force: true }) }],
    });
  }
}

// What live sync did with the code after a save (Phase 34), for the save message.
function codeNote(code) {
  if (!code) return '';
  if (code.problem) return ` · the code wasn’t written: ${code.problem}`;
  if (code.manual) return ' · the code needs your coding agent (sigma-design tokens diff)';
  const agent = code.agent?.length ? ` · ${code.agent.length} change${code.agent.length === 1 ? '' : 's'} for your coding agent (sigma-design components diff)` : '';
  if (code.written?.length) return ` · wrote ${code.written.map((f) => f.path).join(', ')}${agent}`;
  return agent;
}

export async function reloadFromDisk(path) {
  banner(null);
  try {
    await bring(path, { force: true });
    toast('Loaded the version on disk');
  } catch (err) {
    toast(`Couldn’t reload: ${err.message}`);
  }
}

// Create a new file in the project and open it.
// A new file in the project, opened unless `open` is false. Returns its path (null if it couldn't be made).
// `paths`: where linked files are when they aren't project files yet ({ fileId: path }, for moving several).
export async function newProjectFile(doc, { open = true, paths = {} } = {}) {
  if (!adapter) return null;
  const path = freePath(fileKind(doc), doc.name);
  const known = await pathMap();
  const { text } = serializeForProject(doc, { pathOf: (id) => paths[id] || known(id), path });
  try {
    await adapter.write(path, text, 'new');
    await refresh();
    if (open) openFile(await bring(path));
    return path;
  } catch (err) {
    toast(`Couldn’t create ${path}: ${err.message}`);
    return null;
  }
}

// ---------- watching the project ----------
async function refresh() {
  if (!adapter) return;
  const info = await adapter.list();
  if (info) apply(info, adapter.via);
}

let polling = false;
async function poll({ force = false } = {}) {
  if (!adapter || polling || (document.visibilityState === 'hidden' && !force)) return;
  polling = true;
  try {
    const before = JSON.stringify(project.files);
    const info = await adapter.list();
    if (!info) return;
    project.files = info.files || [];
    project.config = info.config || null;
    if (JSON.stringify(project.files) !== before) changed();
    await checkOpenFile();
  } catch (err) {
    if (project.connected) {
      project.connected = false;
      changed();
    }
  } finally {
    polling = false;
  }
}

// The open file, or a file it uses, changed on disk: reload it, or ask if it has changes here.
let asked = null;
async function checkOpenFile() {
  const id = getCurrentFileId();
  if (!id || !state.doc || state.readOnly) return;
  const meta = await projectMetaOf(id);
  if (!isProjectMeta(meta)) return;
  const byPath = new Map(project.files.map((f) => [f.path, f]));
  const metas = await cachedFiles();
  const stale = [meta.project.path, ...linkPaths(state.doc)].filter((p) => {
    const disk = byPath.get(p);
    const m = metas.find((x) => x.project.path === p);
    return disk && m && disk.mtime !== m.project.mtime;
  });
  if (!stale.length) return;
  // Only the modification time changed (a checkout of the same content, or our own save): note it.
  const texts = new Map();
  const really = [];
  for (const p of stale) {
    const r = await adapter.read(p);
    texts.set(p, r);
    const m = metas.find((x) => x.project.path === p);
    if (textHash(r.text) === m.project.hash) await updateFileMeta(m.id, { project: { ...m.project, mtime: r.mtime } });
    else really.push(p);
  }
  if (!really.length) return;
  const key = really.map((p) => `${p}@${texts.get(p).mtime}`).join();
  if (!really.includes(meta.project.path)) {
    // Only files it uses changed (new tokens or icons): update its copies of them, keeping its own edits.
    await refreshLinks(texts);
    toast(`${really.join(', ')} changed on disk: updated`);
    return;
  }
  if (!(await hasUnsavedProjectChanges(id, state.doc))) {
    await bring(meta.project.path, { force: true, texts });
    toast(`${really.join(', ')} changed on disk: reloaded`);
    return;
  }
  if (asked === key) return;
  asked = key;
  banner({
    text: `${really.length === 1 ? really[0] : `${really.length} project files`} changed on disk, and this file has changes not saved to the project.`,
    label: 'Load the disk version', action: () => reloadFromDisk(meta.project.path),
    extra: [{ label: 'Keep mine', action: () => banner(null) }],
  });
}

// Read the files a project file uses, and the ones they use, into `texts`.
async function readLinks(file, texts, seen = new Set()) {
  for (const p of linksOf(file)) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (!texts.has(p)) texts.set(p, await adapter.read(p));
    await readLinks(JSON.parse(texts.get(p).text), texts, seen);
  }
}

// Rebuild the open file's copies of the files it uses from the project, keeping everything else.
async function refreshLinks(texts = new Map()) {
  const doc = state.doc;
  const path = doc.project.path;
  for (const p of linkPaths(doc)) await bring(p, { texts }).catch((err) => console.warn(`Couldn’t bring ${p}`, err));
  const { file } = toProjectFile(doc, { pathOf: await pathMap() });
  await readLinks(file, texts);
  const metas = await cachedFiles();
  const resolve = (p) => {
    const m = metas.find((x) => x.project.path === p);
    return m && texts.has(p) ? { fileId: m.id, file: JSON.parse(texts.get(p).text) } : null;
  };
  const fresh = fromProjectFile(file, { path, resolve }).doc;
  if (state.doc !== doc) return; // another file opened meanwhile
  for (const k of ['libraries', 'iconLibraries', 'componentLibraries']) {
    if (fresh[k]) doc[k] = fresh[k];
    else delete doc[k];
  }
  reindex();
  commit();
}

// When a project file opens: its copies of the files it uses come from the project as it is now.
export async function syncOpenProjectFile() {
  if (!adapter || !project.connected || !state.doc?.project?.path || state.readOnly || !linkPaths(state.doc).length) return;
  try {
    await refreshLinks();
  } catch (err) {
    console.warn('Couldn’t update linked project files', err);
  }
}

const linkPaths = (doc) => [...(doc.libraries || []), ...(doc.iconLibraries || []), ...(doc.componentLibraries || [])].map((l) => l.path).filter(Boolean);

// ---------- for proposing changes ----------
// Every project file as it is in Sigma now (stored copies, with the open file's unsaved edits) and as it
// is in the base (git HEAD; the disk, without git): { current, base, comparedWith }.
export async function projectSnapshot() {
  const metas = await cachedFiles();
  const pathOf = await pathMap();
  const current = {}, base = {};
  let comparedWith = 'HEAD';
  for (const f of project.files) {
    if (f.kind === 'invalid') continue;
    const meta = metas.find((m) => m.project.path === f.path);
    let text;
    if (meta) {
      const doc = meta.id === getCurrentFileId() && state.doc ? state.doc : (await loadFile(meta.id))?.doc;
      text = doc ? serializeForProject(doc, { pathOf, path: f.path }).text : null;
    }
    text ||= (await adapter.read(f.path)).text;
    current[f.path] = JSON.parse(text);
    const b = await adapter.base(f.path);
    if (b === undefined) {
      comparedWith = 'disk';
      base[f.path] = JSON.parse((await adapter.read(f.path)).text);
    } else base[f.path] = b ? JSON.parse(b) : null;
  }
  return { current, base, comparedWith };
}
export const listChangesets = () => (adapter ? adapter.changesets() : []);
// Write any project file Sigma may write (a changeset, its renders).
export async function writeProjectFile(path, text) {
  const existing = await adapter.read(path).catch(() => null);
  return adapter.write(path, text, existing ? existing.mtime : 'new');
}

// ---------- for the files home and the editor ----------
// Project files with their stored copies (for thumbnails): [{ ...file, meta }].
export async function projectListing() {
  const metas = await cachedFiles();
  return project.files.map((f) => ({ ...f, meta: metas.find((m) => m.project.path === f.path) || null }));
}

// Is the open document a file of the connected project?
export const inProject = () => !!state.doc?.project?.path && project.connected;
export const projectStatus = async () => {
  const id = getCurrentFileId();
  if (!id || !state.doc?.project) return null;
  return { path: state.doc.project.path, unsaved: await hasUnsavedProjectChanges(id, state.doc), connected: project.connected };
};
export { KIND_DIRS };
