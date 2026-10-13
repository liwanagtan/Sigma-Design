// A library's changelog (Part D, Phase 18): one "What's new" history per library, exportable as Markdown to
// start release notes. In a project, it's the proposals (changesets) that changed the file, with their pull
// requests; in the browser, its publishes (version history), each with its notes and what changed since the
// one before.
import { projectChanges } from './changesets.js';

const STATUS = { draft: 'Draft', proposed: 'Proposed', 'in-review': 'In review', 'changes-requested': 'Changes requested', merged: 'Merged', closed: 'Closed' };
const KIND = { token: 'token', icon: 'icon', component: 'component', page: 'page', file: 'file settings', comment: 'comment' };

const itemsOf = (changes, path) => changes.filter((c) => !path || c.file === path).map((c) => ({ kind: c.kind, name: c.kind === 'file' ? 'Name, links, collections and modes' : c.name, change: c.change }));

/** Entries from the project's changesets that changed `path` (newest first). */
export function changelogFromChangesets(changesets, path) {
  return changesets
    .filter((c) => c.status !== 'closed' && (c.changes || []).some((ch) => ch.file === path))
    .map((c) => ({
      date: c.mergedAt || c.updatedAt || c.createdAt, title: c.title, note: c.note || '', status: c.status,
      pr: c.pr?.url ? { url: c.pr.url, number: c.pr.number } : null, ticket: c.ticket?.url || null,
      changes: itemsOf(c.changes, path),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * Entries from a file's publishes: versions = [{ title, description, createdAt, file }] (the published state, as
 * a project-format file), oldest first. What changed is computed against the publish before.
 */
export function changelogFromPublishes(versions) {
  const out = [];
  versions.forEach((v, i) => {
    const before = i ? versions[i - 1].file : null;
    const changes = before ? projectChanges({ f: before }, { f: v.file }) : [];
    out.push({ date: new Date(v.createdAt).toISOString(), title: v.title, note: v.description || '', status: 'published', pr: null, ticket: null, changes: itemsOf(changes), first: !before });
  });
  return out.reverse();
}

/** The changelog as Markdown. */
export function changelogMarkdown(name, entries) {
  const lines = [`# What's new in ${name}`, ''];
  if (!entries.length) lines.push('Nothing yet.');
  for (const e of entries) {
    const when = String(e.date || '').slice(0, 10);
    const status = e.status === 'merged' || e.status === 'published' ? '' : ` (${STATUS[e.status] || e.status})`;
    lines.push(`## ${e.title}${status}`, '', `${when}${e.pr ? ` · [pull request #${e.pr.number || ''}](${e.pr.url})` : ''}${e.ticket ? ` · [ticket](${e.ticket})` : ''}`, '');
    if (e.note) lines.push(e.note, '');
    if (e.first) lines.push('- First version.');
    for (const c of e.changes) lines.push(`- ${c.change} ${KIND[c.kind] || c.kind} **${c.name}**`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

// ---------- the dialog (main menu → Changelog…) ----------
export async function openChangelog() {
  const [{ state }, { project, listChangesets }, files, { modal }, { toProjectFile }] = await Promise.all([
    import('./store.js'), import('./project.js'), import('./files.js'), import('./libraries.js'), import('./project-format.js'),
  ]);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const name = state.doc?.name || 'Untitled';
  const path = state.doc?.project?.path;
  let entries;
  let source;
  if (path && project.connected) {
    entries = changelogFromChangesets(await listChangesets(), path);
    source = `the proposals that changed ${path}`;
  } else {
    const id = files.getCurrentFileId();
    const versions = (await files.listVersions(id)).filter((v) => v.kind === 'publish').sort((a, b) => a.createdAt - b.createdAt);
    const withFiles = [];
    for (const v of versions) {
      const doc = await files.loadVersionDoc(v.id);
      if (doc) withFiles.push({ ...v, file: toProjectFile(doc).file });
    }
    entries = changelogFromPublishes(withFiles);
    source = 'its publishes (version history)';
  }
  const md = changelogMarkdown(name, entries);
  const body = `<p class="muted lib-intro">From ${esc(source)}. Copy it to start release notes or a newsletter.</p>` +
    (entries.length ? entries.map((e) => `<div class="changelog-entry"><div class="changelog-head"><b>${esc(e.title)}</b><span class="muted">${esc(String(e.date || '').slice(0, 10))}</span>` +
      `${e.status !== 'published' ? `<span class="status-chip ${e.status === 'merged' ? 'ok' : ''}">${esc(STATUS[e.status] || e.status)}</span>` : ''}${e.pr ? `<a href="${esc(e.pr.url)}" target="_blank" rel="noopener">PR${e.pr.number ? ` #${esc(e.pr.number)}` : ''}</a>` : ''}</div>` +
      `${e.note ? `<div>${esc(e.note)}</div>` : ''}<ul>${e.first ? '<li>First version.</li>' : ''}${e.changes.map((c) => `<li>${esc(c.change)} ${esc(KIND[c.kind] || c.kind)} <b>${esc(c.name)}</b></li>`).join('')}</ul></div>`).join('')
      : `<div class="muted lib-empty">Nothing yet: ${path ? 'no proposal has changed this file.' : 'this file hasn’t been published.'}</div>`);
  const wrap = modal(`What's new in ${esc(name)}`, body, '<span class="spacer"></span><button class="btn" data-copy>Copy as Markdown</button><button class="btn" data-download>Download .md</button><button class="btn primary" data-close>Done</button>');
  wrap.querySelector('.modal').classList.add('changelog-modal');
  wrap.querySelector('[data-copy]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(md);
    window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Copied the changelog as Markdown' }));
  });
  wrap.querySelector('[data-download]').addEventListener('click', () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([md], { type: 'text/markdown' })), download: `${name.replace(/[^\w-]+/g, '-').toLowerCase()}-changelog.md` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
