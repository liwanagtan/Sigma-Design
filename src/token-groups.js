// Token groups. A collection holds tokens and groups; a group holds tokens and other groups.
//
//   collection.groups = [{ id, name, parentId: groupId | null, description? }]   (array order = order shown)
//   variable.groupId  = the group a token is in (absent: the top level of the collection)
//
// Groups are the source of truth. A token's `name` is kept as its full path ("color/blue/500"): its
// groups' names and its own, derived here, so references, exports and pickers can use it directly.
// Renaming a group renames no token; only the paths shown for them change.
//
// Pure functions on plain collections (no imports), shared by the store's migration and the editor.

const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

// Groups made from paths get ids from the collection and the path, so the same file converts the same
// way everywhere: its tokens, its published copy, and the copies linked files keep of it.
function stableId(colId, path) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const ch of `${colId}\u0000${path}`) {
    const c = ch.codePointAt(0);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return `g${h1.toString(36)}${h2.toString(36)}`;
}

export const groupOf = (path) => {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
};
export const leafOf = (path) => path.slice(path.lastIndexOf('/') + 1);
export const cleanSegment = (s) => String(s ?? '').replace(/\//g, '-').trim();
export const cleanPath = (p) => String(p || '').split('/').map((s) => s.trim()).filter(Boolean).join('/');

// Do this collection's groups exist as objects (not just as paths in token names)?
export const hasGroupObjects = (col) => Array.isArray(col.groups) && col.groups.every((g) => g && typeof g === 'object');

// id → full path ("color/blue") for a list of group objects.
export function groupPaths(groups) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const paths = new Map();
  const pathOf = (g, depth = 0) => {
    if (paths.has(g.id)) return paths.get(g.id);
    const parent = g.parentId && depth < 64 ? byId.get(g.parentId) : null;
    const p = parent ? `${pathOf(parent, depth + 1)}/${g.name}` : g.name;
    paths.set(g.id, p);
    return p;
  };
  for (const g of groups) pathOf(g);
  return paths;
}

// Bring a collection to the group model: turn group paths (older files, imports, tokens named
// "a/b/c") into group objects, give every token a valid groupId, and derive token names from them.
// Returns true if anything changed. Extensions have no tokens or groups of their own.
// Groups made from paths get stable ids (see stableId).
export function normalizeGroups(col) {
  if (!col || col.extends) return false;
  const before = JSON.stringify([col.groups, (col.variables || []).map((v) => [v.name, v.groupId])]);
  const groups = (col.groups || []).filter((g) => g && typeof g === 'object');
  const legacy = (col.groups || []).filter((g) => typeof g === 'string');
  // Repair parents: missing ones and loops become top level.
  const ids = new Set(groups.map((g) => g.id));
  for (const g of groups) {
    g.name = cleanSegment(g.name) || 'Group';
    if (g.parentId && !ids.has(g.parentId)) g.parentId = null;
    const seen = new Set([g.id]);
    for (let p = g.parentId; p; p = groups.find((x) => x.id === p)?.parentId) {
      if (seen.has(p)) {
        g.parentId = null;
        break;
      }
      seen.add(p);
    }
  }
  let paths = groupPaths(groups);
  const byPath = new Map([...paths].map(([id, p]) => [p, id]));
  const ensure = (path) => {
    path = cleanPath(path);
    if (!path) return null;
    if (byPath.has(path)) return byPath.get(path);
    let id = stableId(col.id, path);
    if (ids.has(id)) id = rid(); // a group with that id was renamed since; don't reuse it
    const g = { id, name: leafOf(path), parentId: ensure(groupOf(path)) };
    groups.push(g);
    ids.add(g.id);
    byPath.set(path, g.id);
    paths.set(g.id, path);
    return g.id;
  };
  for (const v of col.variables || []) {
    // A token with a valid group keeps it (its name's path is derived); otherwise its name's path decides.
    if (!v.groupId || !ids.has(v.groupId)) {
      const gid = ensure(groupOf(cleanPath(v.name)));
      if (gid) v.groupId = gid;
      else delete v.groupId;
    }
  }
  for (const p of legacy) ensure(p); // empty groups from the older format, after those holding tokens
  paths = groupPaths(groups);
  for (const v of col.variables || []) {
    const leaf = cleanSegment(leafOf(v.name)) || 'token';
    v.name = v.groupId ? `${paths.get(v.groupId)}/${leaf}` : leaf;
  }
  col.groups = groups;
  return JSON.stringify([col.groups, (col.variables || []).map((v) => [v.name, v.groupId])]) !== before;
}

// The group structure of a collection without changing it (for read-only library snapshots that may
// predate group objects): { groups, groupIdOf(variable) }.
export function structureOf(col) {
  if (hasGroupObjects(col) && (col.variables || []).every((v) => !groupOf(v.name) || v.groupId)) {
    return { groups: col.groups || [], groupIdOf: (v) => v.groupId || null };
  }
  const copy = structuredClone({ id: col.id, groups: col.groups, variables: (col.variables || []).map((v) => ({ id: v.id, name: v.name, groupId: v.groupId })) });
  normalizeGroups(copy); // stable ids: the same groups every time
  const byVar = new Map(copy.variables.map((v) => [v.id, v.groupId || null]));
  return { groups: copy.groups, groupIdOf: (v) => byVar.get(v.id) ?? null };
}
