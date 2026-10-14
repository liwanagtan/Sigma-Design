// Page groups (Part H, Phase 38): a design file's pages, grouped. A page belongs to a group by name
// (`page.group`); the pages stay one ordered list, so everything that walks `doc.pages` keeps working, and a
// group's pages are kept together (keepTogether, run when a document loads and after every change here).
// Pure functions on the pages array: the pages list (panels.js) calls them and commits.

const nameOf = (pg) => (typeof pg?.group === 'string' && pg.group.trim() ? pg.group.trim() : null);

/** The pages as runs: [{ group: name | null, pages }], a run per group and per stretch of ungrouped pages. */
export function pageRuns(pages) {
  const runs = [];
  for (const pg of pages) {
    const g = nameOf(pg);
    const last = runs.at(-1);
    if (last && g && last.group === g) last.pages.push(pg);
    else if (last && !g && !last.group) last.pages.push(pg);
    else runs.push({ group: g, pages: [pg] });
  }
  return runs;
}

/** The groups' names, in order. */
export const groupNames = (pages) => [...new Set(pages.map(nameOf).filter(Boolean))];

/**
 * Keep each group's pages together, where its first page is (in place; stable otherwise), and tidy names
 * (blank ones go). Idempotent. Returns true when it changed anything.
 */
export function keepTogether(pages) {
  let changed = false;
  for (const pg of pages) {
    if ('group' in pg && nameOf(pg) !== pg.group) {
      if (nameOf(pg)) pg.group = nameOf(pg);
      else delete pg.group;
      changed = true;
    }
  }
  const out = [];
  const placed = new Set();
  for (const pg of pages) {
    const g = nameOf(pg);
    if (!g) out.push(pg);
    else if (!placed.has(g)) {
      placed.add(g);
      out.push(...pages.filter((p) => nameOf(p) === g));
    }
  }
  if (out.some((p, i) => p !== pages[i])) {
    pages.splice(0, pages.length, ...out);
    changed = true;
  }
  return changed;
}

/** "Group / Page", or the page's name. */
export const pageLabel = (pg) => (nameOf(pg) ? `${nameOf(pg)} / ${pg.name}` : pg.name);

/** A name for a new group: Group 1, Group 2… (one not used yet). */
export function newGroupName(pages, base = 'Group') {
  const used = new Set(groupNames(pages));
  for (let i = 1; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
}

/**
 * Move a page: into `group` (a name, or null for none), before the page `beforeId` (or, with no beforeId, to
 * the end of its group, or of the list). Then keeps groups together.
 */
export function movePage(pages, pageId, { group, beforeId = null } = {}) {
  const pg = pages.find((p) => p.id === pageId);
  if (!pg) return false;
  if (group !== undefined) {
    if (group) pg.group = String(group).trim();
    else delete pg.group;
  }
  pages.splice(pages.indexOf(pg), 1);
  let at = beforeId ? pages.findIndex((p) => p.id === beforeId) : -1;
  if (at < 0) {
    const g = nameOf(pg);
    const lastOfGroup = g ? pages.map(nameOf).lastIndexOf(g) : -1;
    at = lastOfGroup >= 0 ? lastOfGroup + 1 : pages.length;
  }
  pages.splice(at, 0, pg);
  keepTogether(pages);
  return true;
}

/** Move a whole group before the page `beforeId` (null: to the end). */
export function moveGroup(pages, group, beforeId = null) {
  const members = pages.filter((p) => nameOf(p) === group);
  if (!members.length || members.some((p) => p.id === beforeId)) return false;
  const rest = pages.filter((p) => nameOf(p) !== group);
  let at = beforeId ? rest.findIndex((p) => p.id === beforeId) : rest.length;
  if (at < 0) at = rest.length;
  // Not into the middle of another group: before that group's first page.
  const g = nameOf(rest[at]);
  if (g) at = rest.findIndex((p) => nameOf(p) === g);
  rest.splice(at, 0, ...members);
  pages.splice(0, pages.length, ...rest);
  return true;
}

/** Rename a group (merging into another of that name, if there is one). */
export function renameGroup(pages, from, to) {
  to = String(to || '').trim();
  if (!to || to === from) return false;
  for (const p of pages) if (nameOf(p) === from) p.group = to;
  keepTogether(pages);
  return true;
}

/** Ungroup: its pages stay where they are, in no group. */
export function ungroup(pages, group) {
  let n = 0;
  for (const p of pages) if (nameOf(p) === group) {
    delete p.group;
    n++;
  }
  return n > 0;
}

/** Collapsed groups are remembered per person and file, in this browser (not in the file). */
const KEY = 'sigma.collapsedPageGroups';
export function collapsedGroups(fileId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '{}')[fileId || ''] || []);
  } catch {
    return new Set();
  }
}
export function setCollapsedGroups(fileId, set) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (set.size) all[fileId || ''] = [...set];
    else delete all[fileId || ''];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // no storage: groups just open again next time
  }
}
