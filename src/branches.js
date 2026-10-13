// Branches (Part D, "Later": branching and review, in the browser): try a change to a design file on a copy,
// review it, and merge it back. A branch remembers the file it came from and that file as it was (its base),
// so merging is a three-way merge (changesets.js → mergeFiles): the branch's changes go onto the main file
// token by token, component by component, even when the main file changed meanwhile. Review is Compare… (the
// visual review of the merge) on this machine; reviews between people need a backend. In a project, git
// branches and Propose change do this instead.
import { state, commit } from './store.js';
import { getCurrentFileId, saveNow, loadFile, createFile, openFile, replaceFile, saveNamedVersion, isCurrentSample } from './files.js';
import { toProjectFile, fromProjectFile } from './project-format.js';
import { mergeFiles, projectChanges, summarize } from './changesets.js';
import { modal } from './libraries.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const LINKS = ['libraries', 'componentLibraries', 'iconLibraries'];
const PATH = 'file';

// A design document in the project format, with linked files named by their ids: what merging compares. The
// name isn't (a branch is named after its file; merging keeps the main file's).
function asFile(doc) {
  const { branch, ...rest } = doc;
  return { ...toProjectFile(rest, { pathOf: (id) => `id:${id}` }).file, name: '' };
}

export const isBranch = (doc = state.doc) => !!doc?.branch;
export const canBranch = (doc = state.doc) => !!doc && !doc.project && !doc.kind && !isBranch(doc) && !isCurrentSample();

/** Make a branch of the open design file and open it. */
export async function createBranch(name) {
  name = String(name || '').trim();
  if (!name || !canBranch()) return null;
  await saveNow();
  const mainId = getCurrentFileId();
  const main = await loadFile(mainId);
  if (!main) return null;
  const doc = structuredClone(main.doc);
  delete doc.published; // a branch isn't a library: it publishes when it's merged back
  delete doc.publishedComponents;
  doc.branch = { of: mainId, ofName: main.meta.name, name, base: asFile(main.doc), createdAt: Date.now() };
  doc.name = `${main.meta.name} · ${name}`;
  const id = await createFile(doc, structuredClone(main.views || {}));
  openFile(id);
  return id;
}

/**
 * The main document with the branch merged in: { doc, conflicts, branchChanges, mainChanges }. On a conflict
 * (an item both changed differently), `prefer` says whose wins: 'branch' or 'main'.
 */
export function mergeBranch(mainDoc, branchDoc, { prefer = 'branch' } = {}) {
  const base = branchDoc.branch.base;
  const mainF = asFile(mainDoc), branchF = asFile(branchDoc);
  const r = prefer === 'branch' ? mergeFiles(PATH, base, branchF, mainF) : mergeFiles(PATH, base, mainF, branchF);
  const merged = fromProjectFile(r.file).doc;
  // Back into the main file's document: its pages, local tokens and the rest from the merge; the copies of
  // linked files from the main file (or the branch, for one it linked).
  const doc = structuredClone(mainDoc);
  const keep = new Set([...LINKS, 'published', 'publishedComponents', 'name', 'version', 'variables', 'currentPageId']);
  for (const k of Object.keys(doc)) if (!keep.has(k)) delete doc[k];
  for (const [k, v] of Object.entries(merged)) if (!keep.has(k) && v !== undefined) doc[k] = v;
  const linked = { libraries: r.file.uses?.tokens, componentLibraries: r.file.uses?.components, iconLibraries: r.file.uses?.icons };
  for (const k of LINKS) {
    const ids = (linked[k] || []).map((p) => p.replace(/^id:/, ''));
    const from = (d) => (d[k] || []).filter((l) => ids.includes(l.fileId));
    const list = ids.map((id) => from(mainDoc).find((l) => l.fileId === id) || from(branchDoc).find((l) => l.fileId === id)).filter(Boolean);
    if (list.length) doc[k] = structuredClone(list);
    else delete doc[k];
  }
  doc.variables = { ...(mainDoc.variables || {}), collections: [...(mainDoc.variables?.collections || []).filter((c) => c.fromLibrary), ...(merged.variables?.collections || [])] };
  if (!doc.pages.some((p) => p.id === doc.currentPageId)) doc.currentPageId = doc.pages[0]?.id || null;
  return {
    doc, conflicts: r.conflicts,
    branchChanges: projectChanges({ [PATH]: base }, { [PATH]: branchF }),
    mainChanges: projectChanges({ [PATH]: base }, { [PATH]: mainF }),
  };
}

// ---------- the dialogs ----------
export function openCreateBranch() {
  if (!canBranch()) return toast(state.doc?.project ? 'In a project, branch with git: Propose change turns edits into a branch and a pull request.' : 'Branches are for design files (not branches, samples, or token and icon files).');
  const wrap = modal('Create branch', '<p class="muted lib-intro">A copy of this file to try a change on. Merge it back when it’s ready: your changes go in even if this file changed meanwhile.</p><label class="inspector-label">Branch name</label><input class="prop-input branch-name" placeholder="New navigation" spellcheck="true">',
    '<span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-create>Create branch</button>');
  const input = wrap.querySelector('.branch-name');
  input.focus();
  const go = async () => {
    if (!input.value.trim()) return input.focus();
    wrap.remove();
    await createBranch(input.value);
  };
  wrap.querySelector('[data-create]').addEventListener('click', go);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
}

export async function openMergeBranch() {
  if (!isBranch()) return;
  await saveNow();
  const b = state.doc.branch;
  const main = await loadFile(b.of);
  if (!main) return toast(`“${b.ofName}” isn’t in this browser any more, so there’s nothing to merge into.`);
  let prefer = 'branch';
  let result = mergeBranch(main.doc, state.doc, { prefer });
  const list = (items) => items.map((i) => `<li>${esc(i.change)} ${esc(i.kind === 'file' ? 'file settings' : i.kind)} <b>${esc(i.kind === 'file' ? '' : i.name)}</b></li>`).join('');
  const body = () => `<p class="muted lib-intro">Merges “${esc(b.name)}” into “${esc(main.meta.name)}”. A version of “${esc(main.meta.name)}” is saved first, so the merge can be undone from its version history.</p>` +
    (result.branchChanges.length ? `<div class="changelog-entry"><b>This branch: ${esc(summarize(result.branchChanges))}</b><ul>${list(result.branchChanges)}</ul></div>` : '<div class="muted lib-empty">This branch has no changes yet.</div>') +
    (result.mainChanges.length ? `<div class="changelog-entry"><b>“${esc(main.meta.name)}” changed meanwhile: ${esc(summarize(result.mainChanges))}</b><div class="muted">Those stay; the branch's changes go in with them.</div></div>` : '') +
    (result.conflicts.length ? `<div class="warn">Both changed ${result.conflicts.map((c) => `${esc(c.kind)} <b>${esc(c.name)}</b>`).join(', ')}. Keep <select class="prop-input branch-prefer"><option value="branch" ${prefer === 'branch' ? 'selected' : ''}>this branch’s</option><option value="main" ${prefer === 'main' ? 'selected' : ''}>“${esc(main.meta.name)}”’s</option></select></div>` : '');
  const wrap = modal(`Merge into “${esc(main.meta.name)}”`, body(),
    '<button class="btn" data-compare title="The main file as it is, and merged">Compare…</button><span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-merge>Merge</button>');
  wrap.querySelector('.modal').classList.add('changelog-modal');
  wrap.addEventListener('change', (e) => {
    if (!e.target.classList.contains('branch-prefer')) return;
    prefer = e.target.value;
    result = mergeBranch(main.doc, state.doc, { prefer });
    wrap.querySelector('.lib-body').innerHTML = body();
  });
  wrap.addEventListener('click', async (e) => {
    if (e.target.closest('[data-compare]')) {
      const vr = await import('./visual-review.js');
      return vr.openVisualReview(`“${main.meta.name}” merged with “${b.name}”`, vr.visualChanges(vr.renderOther(main.doc), vr.renderOther(result.doc)),
        { intro: `“${esc(main.meta.name)}” as it is, and with this branch merged. Nothing changes until you merge.`, selectable: false });
    }
    if (!e.target.closest('[data-merge]')) return;
    await saveNamedVersion(b.of, `Before merging “${b.name}”`);
    await replaceFile(b.of, result.doc);
    // The branch continues from here: its base is what it was just merged into.
    state.doc.branch = { ...b, base: asFile(result.doc) };
    commit();
    wrap.remove();
    toast(`Merged “${b.name}” into “${main.meta.name}”${result.conflicts.length ? ` (${result.conflicts.length} conflict${result.conflicts.length === 1 ? '' : 's'}: kept ${prefer === 'branch' ? 'this branch’s' : 'theirs'})` : ''}`);
  });
}
