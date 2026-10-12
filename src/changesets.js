// Changesets (Part E, Phase 25): the edits a designer proposes for a pull request. Pure functions, no DOM.
//
// A change is one item: a token, an icon, a component (or component set), a page's own content (its layers
// other than components), or a file's other settings (name, links, collections and modes). Each item holds
// its version before (in the base, usually git HEAD) and after (in Sigma now), in the project format, so a
// changeset can be applied onto the base by itself: one session's edits can become separate pull requests.
//
//   changeset = { id, title, note, author, createdAt, status, base, changes: [item], renders: { [key]: { before, after } },
//                 ticket?, pr? }
//   item = { key, file, kind: 'token' | 'icon' | 'component' | 'page' | 'file', id, name, change: 'added' | 'changed' | 'removed',
//            before, after, where? }
export const CHANGESET_DIR = '.sigma/changesets';
export const STATUSES = { draft: 'Draft', proposed: 'Proposed', 'in-review': 'In review', 'changes-requested': 'Changes requested', merged: 'Merged', closed: 'Closed' };

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const same = (a, b) => stable(a) === stable(b);
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const isComponent = (n) => n?.type === 'component' || n?.type === 'componentSet';

// ---------- what changed ----------
// Tokens by id, with the collection each is in: Map(id → { token, collectionId }).
function tokensOf(file) {
  const out = new Map();
  for (const c of file?.collections || []) for (const v of c.variables || []) out.set(v.id, { token: v, collectionId: c.id });
  return out;
}
// A tokens file without its tokens (collections, modes, groups, name, links): the 'file' item.
const shellOf = (file) => file && { ...file, collections: (file.collections || []).map(({ variables, ...c }) => c), icons: undefined, pages: undefined };

// Main components (and sets) anywhere in a design file: Map(id → { node, page, parent, index }).
function componentsOf(file) {
  const out = new Map();
  for (const pg of file?.pages || []) {
    const visit = (nodes, parent) => nodes.forEach((n, index) => {
      if (isComponent(n)) {
        out.set(n.id, { node: n, page: pg.id, parent, index });
        return; // a set's variants come with it
      }
      if (n.children) visit(n.children, n.id);
    });
    visit(pg.children || [], null);
  }
  return out;
}
// A page with its components left as placeholders: the 'page' item (what's on the page besides components).
function pageContent(pg) {
  const strip = (nodes) => nodes.map((n) => (isComponent(n) ? { $component: n.id } : n.children ? { ...n, children: strip(n.children) } : n));
  return { ...pg, children: strip(pg.children || []) };
}
const designShell = (file) => file && { ...file, pages: undefined, comments: undefined, collections: file.collections };

// Every change between the base and the current project files: { [path]: file | null } each.
export function projectChanges(base, current) {
  const items = [];
  const push = (file, kind, id, name, before, after, extra = {}) => {
    if (same(before ?? null, after ?? null)) return;
    items.push({ key: `${file}#${kind}:${id}`, file, kind, id, name, change: before == null ? 'added' : after == null ? 'removed' : 'changed', before: clone(before ?? null), after: clone(after ?? null), ...extra });
  };
  for (const path of new Set([...Object.keys(base), ...Object.keys(current)])) {
    const a = base[path] || null, b = current[path] || null;
    const kind = (b || a).kind || 'design';
    if (kind === 'tokens') {
      push(path, 'file', 'file', (b || a).name, shellOf(a), shellOf(b));
      const ta = tokensOf(a), tb = tokensOf(b);
      for (const id of new Set([...ta.keys(), ...tb.keys()])) {
        const x = ta.get(id), y = tb.get(id);
        const at = y && b.collections.find((c) => c.id === y.collectionId).variables.indexOf(y.token);
        push(path, 'token', id, (y || x).token.name, x && { ...x.token, $collection: x.collectionId }, y && { ...y.token, $collection: y.collectionId }, { where: y ? { index: at } : undefined });
      }
    } else if (kind === 'icons') {
      push(path, 'file', 'file', (b || a).name, a && { ...a, icons: undefined }, b && { ...b, icons: undefined });
      const ia = new Map((a?.icons || []).map((i) => [i.id, i])), ib = new Map((b?.icons || []).map((i) => [i.id, i]));
      for (const id of new Set([...ia.keys(), ...ib.keys()])) push(path, 'icon', id, (ib.get(id) || ia.get(id)).name, ia.get(id), ib.get(id), { where: ib.has(id) ? { index: b.icons.indexOf(ib.get(id)) } : undefined });
    } else {
      push(path, 'file', 'file', (b || a).name, designShell(a), designShell(b));
      const ca = componentsOf(a), cb = componentsOf(b);
      for (const id of new Set([...ca.keys(), ...cb.keys()])) {
        const x = ca.get(id), y = cb.get(id);
        push(path, 'component', id, (y || x).node.name, x?.node, y?.node, { where: y ? { page: y.page, parent: y.parent, index: y.index } : undefined });
      }
      const ma = new Map((a?.comments || []).map((c) => [c.id, c])), mb = new Map((b?.comments || []).map((c) => [c.id, c]));
      for (const id of new Set([...ma.keys(), ...mb.keys()])) {
        const c = mb.get(id) || ma.get(id);
        push(path, 'comment', id, `${c.author}: ${String(c.text).slice(0, 60)}`, ma.get(id), mb.get(id));
      }
      const pa = new Map((a?.pages || []).map((p) => [p.id, p])), pb = new Map((b?.pages || []).map((p) => [p.id, p]));
      for (const id of new Set([...pa.keys(), ...pb.keys()])) {
        const x = pa.get(id), y = pb.get(id);
        push(path, 'page', id, (y || x).name, x && pageContent(x), y && pageContent(y), { where: y ? { index: b.pages.indexOf(y) } : undefined });
      }
    }
  }
  const order = { file: 0, token: 1, icon: 2, component: 3, page: 4, comment: 5 };
  return items.sort((x, y) => x.file.localeCompare(y.file) || order[x.kind] - order[y.kind]);
}

// Changes not already in an open changeset (one that isn't merged or closed) with the same result.
export function unproposed(items, changesets = []) {
  const open = changesets.filter((c) => c.status !== 'merged' && c.status !== 'closed');
  return items.filter((i) => !open.some((c) => (c.changes || []).some((x) => x.key === i.key && same(x.after, i.after))));
}

// ---------- applying ----------
// The project files that result from applying `items` onto `base` ({ [path]: file | null }). Only the
// files the items touch are returned; null means the file is deleted.
export function applyChanges(base, items) {
  const out = {};
  const files = [...new Set(items.map((i) => i.file))];
  for (const path of files) {
    const mine = items.filter((i) => i.file === path);
    let file = clone(base[path]) || null;
    const fileItem = mine.find((i) => i.kind === 'file');
    if (fileItem) {
      if (fileItem.after === null) {
        out[path] = null;
        continue;
      }
      file = applyShell(file, fileItem.after);
    }
    if (!file) {
      // A new file whose settings weren't included: start from the first item's file kind.
      const kind = mine[0].kind === 'token' ? 'tokens' : mine[0].kind === 'icon' ? 'icons' : 'design';
      file = { format: 1, kind, name: path.split('/').pop().replace(/\.sigma\.json$/, ''), ...(kind === 'tokens' ? { collections: [] } : kind === 'icons' ? { icons: [] } : { pages: [] }) };
    }
    for (const it of mine.filter((i) => i.kind === 'token')) applyToken(file, it);
    for (const it of mine.filter((i) => i.kind === 'icon')) applyIcon(file, it);
    const included = new Set(mine.filter((i) => i.kind === 'component').map((i) => i.id));
    for (const it of mine.filter((i) => i.kind === 'page')) applyPage(file, it, base[path], included, mine);
    for (const it of mine.filter((i) => i.kind === 'component')) applyComponent(file, it);
    for (const it of mine.filter((i) => i.kind === 'comment')) {
      const list = (file.comments ||= []);
      const at = list.findIndex((c) => c.id === it.id);
      if (!it.after) at >= 0 && list.splice(at, 1);
      else if (at >= 0) list[at] = clone(it.after);
      else list.push(clone(it.after));
      if (!list.length) delete file.comments;
    }
    out[path] = file;
  }
  return out;
}

function applyShell(file, shell) {
  const next = clone(shell);
  if (shell.kind === 'tokens' || file?.kind === 'tokens') {
    const tokens = new Map((file?.collections || []).map((c) => [c.id, c.variables || []]));
    next.collections = (shell.collections || []).map((c) => ({ ...c, variables: tokens.get(c.id) || [] }));
  } else if (shell.kind === 'icons') next.icons = file?.icons || [];
  else next.pages = file?.pages || [];
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  return next;
}

// Changed tokens and icons stay where they are; new ones go where they are in Sigma's version.
function applyToken(file, it) {
  const home = (file.collections || []).find((c) => (c.variables || []).some((v) => v.id === it.id));
  const { $collection, ...token } = it.after ? clone(it.after) : {};
  const col = it.after && file.collections.find((c) => c.id === $collection);
  if (it.after && !col) return; // its collection is new and its settings weren't included
  // A group the base doesn't have: the token's name (a path) makes it again when the file loads.
  if (col && token.groupId && !(col.groups || []).some((g) => g.id === token.groupId)) delete token.groupId;
  if (home && home === col) {
    home.variables[home.variables.findIndex((v) => v.id === it.id)] = token;
    return;
  }
  if (home) home.variables = home.variables.filter((v) => v.id !== it.id);
  if (col) (col.variables ||= []).splice(Math.min(it.where?.index ?? col.variables.length, col.variables.length), 0, token);
}

function applyIcon(file, it) {
  const list = (file.icons ||= []);
  const i = list.findIndex((x) => x.id === it.id);
  if (!it.after) {
    if (i >= 0) list.splice(i, 1);
  } else if (i >= 0) list[i] = clone(it.after);
  else list.splice(Math.min(it.where?.index ?? list.length, list.length), 0, clone(it.after));
}

function findNode(pages, id) {
  for (const pg of pages) {
    const stack = [{ list: pg.children, parent: null, page: pg }];
    while (stack.length) {
      const { list, page } = stack.pop();
      for (let i = 0; i < (list || []).length; i++) {
        if (list[i].id === id) return { list, index: i, page };
        if (list[i].children) stack.push({ list: list[i].children, page });
      }
    }
  }
  return null;
}

function applyComponent(file, it) {
  const pages = (file.pages ||= []);
  const hit = findNode(pages, it.id);
  if (!it.after) {
    if (hit) hit.list.splice(hit.index, 1);
    return;
  }
  if (hit) {
    hit.list[hit.index] = clone(it.after);
    return;
  }
  // New: where it is now, if that place exists; else at the top of its page (or the first page).
  const page = pages.find((p) => p.id === it.where?.page) || pages[0];
  if (!page) return;
  const parent = it.where?.parent ? findNode(pages, it.where.parent) : null;
  const list = parent ? (parent.list[parent.index].children ||= []) : (page.children ||= []);
  list.splice(Math.min(it.where?.index ?? list.length, list.length), 0, clone(it.after));
}

// A page's content: its layers from `after`, with each component either the base's version or, if its
// change is included, left for applyComponent.
function applyPage(file, it, baseFile, included, items) {
  const pages = (file.pages ||= []);
  const at = pages.findIndex((p) => p.id === it.id);
  if (!it.after) {
    if (at >= 0) pages.splice(at, 1);
    return;
  }
  const baseComponents = componentsOf(baseFile);
  const fill = (nodes) => nodes.flatMap((n) => {
    if (n.$component) {
      if (included.has(n.$component)) {
        const comp = items.find((x) => x.kind === 'component' && x.id === n.$component);
        return comp?.after ? [clone(comp.after)] : [];
      }
      const b = baseComponents.get(n.$component);
      return b ? [clone(b.node)] : [];
    }
    return [n.children ? { ...n, children: fill(n.children) } : n];
  });
  const page = { ...clone(it.after), children: fill(it.after.children || []) };
  if (at >= 0) pages[at] = page;
  else pages.splice(Math.min(it.where?.index ?? pages.length, pages.length), 0, page);
  // Components placed by this page are now in it; applyComponent will just replace them in place.
}

// ---------- changesets ----------
const rid = () => Math.random().toString(36).slice(2, 8);
export function slugOf(title) {
  return String(title || 'change').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'change';
}
export function newChangeset({ title, note = '', author = '', changes, base = 'HEAD', renders = {} }) {
  const id = `${new Date().toISOString().slice(0, 10)}-${slugOf(title)}-${rid()}`;
  return { id, title: String(title).trim(), note: String(note).trim(), author, createdAt: new Date().toISOString(), status: 'proposed', base, changes, renders };
}

// A short summary: "3 tokens, 1 component, 1 page".
export function summarize(changes) {
  const n = {};
  for (const c of changes) n[c.kind] = (n[c.kind] || 0) + 1;
  const words = { token: 'token', icon: 'icon', component: 'component', page: 'page', file: 'file setting', comment: 'comment' };
  return Object.entries(n).map(([k, v]) => `${v} ${words[k]}${v === 1 ? '' : 's'}`).join(', ') || 'no changes';
}
