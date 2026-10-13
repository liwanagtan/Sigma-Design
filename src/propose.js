// Propose change (Part E, Phase 25): pick some of the edits made since the last commit, give them a title
// and a note, and save them as a changeset in .sigma/changesets/, with each changed component and page
// rendered before and after. The sync skill turns a changeset into a ticket and a pull request (Phase 26);
// nothing goes to the repo's history from here.
import { state, reindex, normalizeDocument, walk } from './store.js';
import { measureText } from './text.js';
import { buildSVG } from './io.js';
import { modal } from './libraries.js';
import { fromProjectFile, formatProjectJSON } from './project-format.js';
import { projectChanges, unproposed, newChangeset, summarize, CHANGESET_DIR, STATUSES } from './changesets.js';
import { project, projectSnapshot, listChangesets, writeProjectFile } from './project.js';
import { iconMarkup } from './icon-library.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const KINDS = { file: 'File', token: 'Token', icon: 'Icon', component: 'Component', page: 'Page', comment: 'Comment' };

// Render layers of a project file version (another document than the open one): load it into the editor's
// state for a moment, rebuild its derived data, draw, and put the open document back.
function renderVersion(files, path, pick) {
  const file = files[path];
  if (!file) return null;
  const ids = Object.fromEntries(Object.keys(files).map((p, i) => [p, `render-${i}`]));
  const { doc } = fromProjectFile(file, { path, resolve: (p) => (files[p] ? { fileId: ids[p], file: files[p] } : null) });
  const saved = { doc: state.doc, selection: state.selection, editing: state.editingTextId };
  try {
    state.doc = doc;
    state.selection = [];
    state.editingTextId = null;
    reindex();
    for (const pg of doc.pages) walk(pg.children, (n) => void (n.type === 'text' && measureText(n)));
    normalizeDocument();
    normalizeDocument(); // instances size from their laid-out main components
    const nodes = pick(doc);
    if (!nodes?.length) return null;
    return buildSVG(nodes, { ordered: true }).svg;
  } catch (err) {
    console.warn(`Couldn’t render ${path}`, err);
    return null;
  } finally {
    state.doc = saved.doc;
    state.selection = saved.selection;
    state.editingTextId = saved.editing;
    reindex();
  }
}

const nodeById = (doc, id) => {
  let hit = null;
  for (const pg of doc.pages) walk(pg.children, (n) => void (n.id === id && (hit = n)));
  return hit;
};

function renderItem(item, which, files) {
  const version = item[which];
  if (!version) return null;
  if (item.kind === 'icon') return `<svg xmlns="http://www.w3.org/2000/svg" ${iconMarkup(version, { w: 48, h: 48, color: '#1E1E1E' }).slice(5)}`;
  if (item.kind === 'component') return renderVersion(files, item.file, (doc) => [nodeById(doc, item.id)].filter(Boolean));
  if (item.kind === 'page') return renderVersion(files, item.file, (doc) => doc.pages.find((p) => p.id === item.id)?.children.filter((n) => n.visible));
  return null;
}

const describe = (i) => `<span class="kind-badge">${KINDS[i.kind]}</span><span class="propose-name">${esc(i.kind === 'file' ? 'Name, links, collections and modes' : i.name)}</span><span class="propose-change ${i.change}">${i.change}</span>`;

export async function openProposeDialog() {
  if (!project.connected) return toast('Propose change works in a project: run Sigma in one (npx sigma-design init, then npm run sigma).');
  toast('Looking for changes…');
  const [{ current, base, comparedWith }, changesets] = await Promise.all([projectSnapshot(), listChangesets()]);
  const all = projectChanges(base, current);
  const items = unproposed(all, changesets);
  const already = all.length - items.length;
  const byFile = new Map();
  for (const i of items) byFile.set(i.file, [...(byFile.get(i.file) || []), i]);
  const body = items.length
    ? `<p class="muted lib-intro">Changes since ${comparedWith === 'HEAD' ? 'the last commit' : 'the files on disk'}${already ? `, besides ${already} already proposed` : ''}. Pick the ones that belong together: the rest can go in another proposal. Sigma saves the proposal in <code>${CHANGESET_DIR}/</code> with before and after pictures; the sync skill turns it into a ticket and a pull request.</p>` +
      [...byFile].map(([file, list]) => `<div class="propose-file"><div class="propose-file-head"><b>${esc(current[file]?.name || base[file]?.name || file)}</b><span class="muted">${esc(file)}</span></div>` +
        list.map((i) => `<label class="propose-item"><input type="checkbox" data-key="${esc(i.key)}" checked>${describe(i)}</label>`).join('') + '</div>').join('') +
      '<label class="inspector-label">Title</label><input class="desc propose-title" placeholder="What this changes, in a few words" spellcheck="true">' +
      '<label class="inspector-label">Note (optional)</label><textarea class="desc propose-note" rows="3" placeholder="Why, and anything reviewers should look at"></textarea>'
    : `<div class="muted lib-empty">No changes to propose${already ? ` (${already} already proposed)` : ''}: the project files in Sigma are the same as ${comparedWith === 'HEAD' ? 'the last commit' : 'on disk'}.</div>`;
  const wrap = modal('Propose change', body, items.length ? '<span class="propose-count muted"></span><span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-propose>Propose</button>' : '<button class="btn" data-close>Done</button>');
  wrap.querySelector('.modal').classList.add('propose-modal');
  const count = () => {
    const n = wrap.querySelectorAll('[data-key]:checked').length;
    const c = wrap.querySelector('.propose-count');
    if (c) c.textContent = `${n} of ${items.length} change${items.length === 1 ? '' : 's'}`;
  };
  count();
  wrap.addEventListener('change', count);
  wrap.querySelector('.propose-title')?.focus();
  wrap.querySelector('[data-propose]')?.addEventListener('click', async () => {
    const title = wrap.querySelector('.propose-title').value.trim();
    if (!title) return toast('Give the proposal a title.');
    const keys = new Set([...wrap.querySelectorAll('[data-key]:checked')].map((x) => x.dataset.key));
    const changes = items.filter((i) => keys.has(i.key));
    if (!changes.length) return toast('Pick at least one change.');
    const cs = newChangeset({ title, note: wrap.querySelector('.propose-note').value, changes, base: comparedWith });
    // Before and after pictures for components, pages and icons.
    let n = 0;
    for (const it of changes) {
      if (!['component', 'page', 'icon'].includes(it.kind)) continue;
      n++;
      const r = {};
      for (const [which, files] of [['before', base], ['after', current]]) {
        const svg = renderItem(it, which, files);
        if (!svg) continue;
        const path = `${CHANGESET_DIR}/${cs.id}/${n}-${it.kind}-${which}.svg`;
        await writeProjectFile(path, svg);
        r[which] = path;
      }
      if (Object.keys(r).length) cs.renders[it.key] = r;
    }
    await writeProjectFile(`${CHANGESET_DIR}/${cs.id}.json`, formatProjectJSON(cs));
    wrap.querySelector('[data-close]').click();
    toast(`Proposed “${title}”: ${summarize(changes)} (${CHANGESET_DIR}/${cs.id}.json)`);
    window.dispatchEvent(new CustomEvent('sigma:changesets'));
  });
}

// The project's proposals, for the files home: [{ id, title, status, summary, createdAt, pr, ticket }].
export async function changesetListing() {
  return (await listChangesets()).map((c) => ({ ...c, summary: summarize(c.changes || []), statusLabel: STATUSES[c.status] || c.status }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
