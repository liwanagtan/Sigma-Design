// Sigma files in a project: the format written to a repo's .sigma/ folder (docs/schema/README.md).
//
// The repo is the source of truth and git does the versioning, so a project file is what a person or an
// agent would write by hand, and a change shows as a small diff:
//   - files link other project files by path ("uses"), not by copying them
//   - derived data is left out and rebuilt on load: instances' children and the properties they copy
//     from their main component, the values of token-bound properties, positions and sizes set by auto
//     layout and text, copies of linked files, and published snapshots
//   - default values are left out (a layer with no `opacity` is fully opaque)
//   - keys are in a stable order, and small objects are written on one line
//
// Pure functions, no DOM: they run in the browser and in Node (tools/validate.js).
import { DOC_VERSION, migrateDocument, isFrameLike } from './store.js';
import { ROOT_PROPS, ROOT_FOLLOW, publishableComponents } from './components.js';
import { libraryEntry, typeForPath, TYPO_FIELDS, SHADOW_FIELDS } from './variables.js';
import { DEFAULT_LAYOUT } from './layout.js';
import { usedIconIds } from './icon-library.js';

export const FORMAT = 1;
export const PROJECT_DIR = '.sigma';
// Where each kind of file goes in a project.
export const KIND_DIRS = { tokens: `${PROJECT_DIR}/tokens`, icons: `${PROJECT_DIR}/icons`, design: `${PROJECT_DIR}/design` };
export const FILE_EXT = '.sigma.json';

export const kindOf = (doc) => (doc?.kind === 'tokens' || doc?.kind === 'icons' ? doc.kind : 'design');

// "Brand Colors" → ".sigma/tokens/brand-colors.sigma.json"
export function projectPath(kind, name) {
  const slug = String(name || 'untitled').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
  return `${KIND_DIRS[kind] || KIND_DIRS.design}/${slug}${FILE_EXT}`;
}

// ---------- defaults ----------
export const NODE_DEFAULTS = { x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false, strokeWidth: 1, strokeAlign: 'inside', radius: 0 };
export const TEXT_DEFAULTS = { text: '', fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeight: null, letterSpacing: 0, textAlign: 'left', autoResize: 'width' };
export const PAINT_DEFAULTS = { opacity: 1, visible: true };
const EFFECT_DEFAULTS = { color: '#000000', opacity: 1, x: 0, y: 0, blur: 0, spread: 0, visible: true };
const CONTAINERS = new Set(['frame', 'group', 'component', 'componentSet', 'instance']);
const clipsByDefault = (n) => isFrameLike(n) && n.type !== 'instance';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function dropDefaults(obj, defaults) {
  for (const [k, v] of Object.entries(defaults)) if (k in obj && same(obj[k], v)) delete obj[k];
}

// ---------- saving ----------
// Delete what a token binding writes (the value is the token's, rebuilt on load).
function dropBoundValues(n) {
  for (const path of Object.keys(n.bindings || {})) {
    const type = typeForPath(path);
    const parts = path.split('.');
    if (type === 'color') {
      const paint = n[parts[0]]?.[+parts[1]];
      if (paint) {
        delete paint.color;
        delete paint.opacity;
      }
    } else if (type === 'typography') {
      for (const f of Object.keys(TYPO_FIELDS)) delete n[f];
    } else if (type === 'shadow') {
      const fx = n.effects?.[+parts[1]];
      if (fx) for (const f of [...Object.keys(SHADOW_FIELDS), 'opacity']) delete fx[f];
    } else if (type) {
      let obj = n;
      for (let i = 0; i < parts.length - 1 && obj; i++) obj = obj[parts[i]];
      if (!obj || typeof obj !== 'object') continue;
      const last = parts[parts.length - 1];
      if (Array.isArray(obj)) obj[+last] = null; // a corner of radii: keep the others in place
      else delete obj[last];
    }
  }
}

// What auto layout and text decide: positions in a flow, and hug, fill and auto-sized lengths.
function dropLaidOut(n, parent) {
  if (parent?.layout?.mode && !n.absolute) {
    delete n.x;
    delete n.y;
  }
  const autoText = n.type === 'text' && n.autoResize && n.autoResize !== 'fixed';
  if (n.sizingH === 'hug' || n.sizingH === 'fill' || (n.type === 'text' && n.autoResize === 'width')) delete n.w;
  if (n.sizingV === 'hug' || n.sizingV === 'fill' || autoText) delete n.h;
}

function saveNode(src, parent) {
  const n = structuredClone(src);
  if (n.type === 'instance' && !n.missingMain) {
    // An instance is its main component plus its own choices: overrides, property values, slots, size.
    delete n.children;
    for (const k of ROOT_PROPS) delete n[k];
    // A size is the instance's own only when it was resized; a hug or fill size comes from layout.
    const laidOut = { w: ['hug', 'fill'].includes(n.sizingH), h: ['hug', 'fill'].includes(n.sizingV) };
    const own = ROOT_FOLLOW.filter((k) => n.synced && k in n.synced && !same(n[k], n.synced[k]) && !laidOut[k]);
    for (const k of ROOT_FOLLOW) if (!own.includes(k)) delete n[k];
    if (own.length) n.synced = Object.fromEntries(own.map((k) => [k, n.synced[k]]));
    else delete n.synced;
    for (const entry of Object.values(n.slots || {})) entry.nodes = (entry.nodes || []).map((c) => saveNode(c, null));
    for (const k of ['overrides', 'propValues', 'slots']) if (n[k] && !Object.keys(n[k]).length) delete n[k];
  } else {
    dropBoundValues(n);
  }
  dropLaidOut(n, parent);
  delete n.pathKey;
  delete n.sourceId;
  dropDefaults(n, NODE_DEFAULTS);
  if (n.type === 'text') dropDefaults(n, TEXT_DEFAULTS);
  if (n.type === 'icon' && n.lockAspect === true) delete n.lockAspect;
  if (clipsByDefault(n) && n.clip === true) delete n.clip;
  for (const kind of ['fills', 'strokes']) {
    if (!(kind in n)) continue;
    if (!n[kind]?.length) delete n[kind];
    else n[kind] = n[kind].map((p) => {
      const q = { ...p };
      dropDefaults(q, PAINT_DEFAULTS);
      return q;
    });
  }
  if (Array.isArray(n.effects)) n.effects = n.effects.map((e) => {
    const q = { ...e };
    dropDefaults(q, { visible: true, opacity: 1, x: 0, y: 0, spread: 0 });
    return q;
  });
  if (n.layout) {
    dropDefaults(n.layout, Object.fromEntries(Object.entries(DEFAULT_LAYOUT).filter(([k]) => k !== 'mode')));
  }
  if (n.children && n.type !== 'instance') n.children = src.children.map((c) => saveNode(c, src));
  return n;
}

// A linked file's path in the project, or null (it isn't in the project).
const usesOf = (entries, pathOf, warnings, what) => (entries || []).map((l) => {
  const path = l.path || pathOf(l.fileId);
  if (!path) warnings.push(`“${l.name}” (${what}) isn’t in the project, so the link was left out.`);
  return path;
}).filter(Boolean);

// A document as a project file. `pathOf(fileId)`: the project path of a linked file, or null.
// Returns { file, warnings }.
export function toProjectFile(doc, { pathOf = () => null } = {}) {
  const kind = kindOf(doc);
  const warnings = [];
  const file = { format: FORMAT, kind, name: doc.name || 'Untitled' };
  const uses = {};
  const tokenLinks = usesOf(doc.libraries, pathOf, warnings, 'Sigma Tokens');
  if (tokenLinks.length) uses.tokens = tokenLinks;
  if (kind === 'design') {
    const comps = usesOf(doc.componentLibraries, pathOf, warnings, 'components');
    const icons = usesOf(doc.iconLibraries, pathOf, warnings, 'Sigma Icons');
    if (comps.length) uses.components = comps;
    if (icons.length) uses.icons = icons;
  }
  if (Object.keys(uses).length) file.uses = uses;
  const local = (doc.variables?.collections || []).filter((c) => !c.fromLibrary);
  if (kind === 'tokens' || local.length) file.collections = structuredClone(local);
  if (kind === 'icons') {
    if (doc.source) file.source = structuredClone(doc.source);
    file.icons = structuredClone(doc.icons || []);
  }
  if (kind === 'design') {
    file.pages = (doc.pages || []).map((pg) => {
      const { welcomeColumns, children, ...rest } = pg;
      return { ...structuredClone(rest), children: (children || []).map((c) => saveNode(c, null)) };
    });
  }
  // Anything else the document has (descriptions, comments, changesets…) goes along as it is.
  const handled = new Set(['kind', 'name', 'version', 'currentPageId', 'pages', 'variables', 'libraries', 'componentLibraries',
    'iconLibraries', 'published', 'publishedComponents', 'icons', 'source', 'project']);
  for (const [k, v] of Object.entries(doc)) if (!handled.has(k) && v !== undefined) file[k] = structuredClone(v);
  return { file, warnings };
}

// ---------- loading ----------
function loadNode(src) {
  const n = { ...NODE_DEFAULTS, ...(src.type === 'text' ? TEXT_DEFAULTS : {}), ...structuredClone(src) };
  if (clipsByDefault(n) && !('clip' in src)) n.clip = true;
  if (n.type === 'icon') {
    if (!('lockAspect' in src)) n.lockAspect = true;
    if (!('iconId' in src)) n.iconId = null;
  }
  // Placeholders until layout, text measurement and the instance's main component set them.
  if (!('w' in src)) n.w = n.type === 'icon' ? 24 : 100;
  if (!('h' in src)) n.h = n.type === 'icon' ? 24 : n.type === 'line' ? 0 : 100;
  // Paints without a color are bound to a token, which sets it.
  n.fills = (src.fills || []).map((p) => ({ color: '#000000', ...PAINT_DEFAULTS, ...p }));
  n.strokes = (src.strokes || []).map((p) => ({ color: '#000000', ...PAINT_DEFAULTS, ...p }));
  if (Array.isArray(src.effects)) n.effects = src.effects.map((e) => ({ ...EFFECT_DEFAULTS, ...e }));
  if (Array.isArray(n.radii)) n.radii = n.radii.map((r) => r ?? 0);
  if (src.layout) n.layout = { ...DEFAULT_LAYOUT, ...src.layout };
  if (n.type === 'instance') {
    n.children = n.missingMain ? (src.children || []).map(loadNode) : [];
    n.overrides ||= {};
    for (const entry of Object.values(n.slots || {})) entry.nodes = (entry.nodes || []).map(loadNode);
  } else if (CONTAINERS.has(n.type)) n.children = (src.children || []).map(loadNode);
  return n;
}

// A project file as a document Sigma can open. `resolve(path)`: { fileId, file } for a linked project
// file (already read), or null. Linked files are copied in, as Sigma keeps them in memory; instances,
// token values and layout are rebuilt by the editor's normalize pipeline when it opens.
// Returns { doc, warnings }.
export function fromProjectFile(file, { resolve = () => null, path = null } = {}) {
  const warnings = [];
  const kind = file.kind === 'tokens' || file.kind === 'icons' ? file.kind : 'design';
  const { format, kind: _k, name, uses, collections, pages, icons, source, ...rest } = structuredClone(file);
  if (format > FORMAT) warnings.push(`Written by a newer Sigma (format ${format}); some of it may not load.`);
  const doc = { ...rest, kind: kind === 'design' ? undefined : kind, name: name || 'Untitled', version: DOC_VERSION };
  if (kind === 'design') delete doc.kind;
  doc.project = path ? { path } : undefined;
  if (!path) delete doc.project;
  doc.variables = { collections: collections || [] };
  doc.pages = kind === 'design' ? (pages || []).map((pg) => ({ background: '#F5F5F5', ...pg, children: (pg.children || []).map(loadNode) })) : [];
  doc.currentPageId = doc.pages[0]?.id || null;
  const linked = (p, want) => {
    const r = resolve(p);
    if (!r) warnings.push(`${p} isn’t in the project.`);
    else if ((r.file.kind || 'design') !== want) warnings.push(`${p} is a ${r.file.kind || 'design'} file, not ${want}.`);
    else return r;
    return null;
  };
  // Sigma Tokens files used, with the Sigma Tokens files they use in turn (aliases can point into them).
  const tokenEntry = (p, seen = new Set()) => {
    const r = linked(p, 'tokens');
    if (!r) return null;
    const deps = [];
    for (const dp of r.file.uses?.tokens || []) {
      if (seen.has(dp) || dp === p) continue;
      seen.add(dp);
      const d = tokenEntry(dp, seen);
      if (d) deps.push({ fileId: d.fileId, name: d.name, version: 0, collections: d.collections }, ...(d.dependencies || []));
    }
    const entry = libraryEntry(r.fileId, r.file.name, { version: 0, collections: r.file.collections || [], dependencies: deps });
    entry.path = p;
    return entry;
  };
  doc.libraries = (uses?.tokens || []).map((p) => tokenEntry(p)).filter(Boolean);
  if (!doc.libraries.length) delete doc.libraries;
  if (kind === 'tokens') {
    // Inside a project the file as checked out is what other files use (git does the versioning).
    doc.published = { version: 0, live: true, collections: structuredClone(doc.variables.collections) };
  }
  if (kind === 'icons') {
    doc.icons = icons || [];
    if (source) doc.source = source;
    doc.published = { version: 0, live: true, icons: structuredClone(doc.icons) };
  }
  if (kind === 'design') {
    const used = usedIconIds(doc.pages.flatMap((pg) => pg.children));
    const iconFiles = (uses?.icons || []).map((p) => [p, linked(p, 'icons')]).filter(([, r]) => r);
    doc.iconLibraries = iconFiles.map(([p, r]) => ({
      fileId: r.fileId, name: r.file.name, version: 0, path: p, count: (r.file.icons || []).length,
      icons: structuredClone((r.file.icons || []).filter((x) => used.has(x.id))),
    }));
    if (!doc.iconLibraries.length) delete doc.iconLibraries;
    doc.componentLibraries = (uses?.components || []).map((p) => {
      const r = linked(p, 'design');
      if (!r) return null;
      const lib = fromProjectFile(r.file, { resolve, path: p }).doc;
      const components = publishableComponents(lib);
      const entry = { fileId: r.fileId, name: r.file.name, version: 0, path: p, components };
      // The tokens and icons its components use, by name (see libraries.js relinkLibraryTokens).
      const names = {};
      for (const l of lib.libraries || []) for (const c of [l, ...(l.dependencies || [])]) {
        for (const col of c.collections || []) for (const v of col.variables || []) names[v.id] = `${v.type}:${v.name}`;
      }
      entry.tokens = { files: (lib.libraries || []).map((l) => ({ fileId: l.fileId, name: l.name, version: 0 })), names };
      const iconIds = usedIconIds(components);
      entry.icons = {};
      for (const l of lib.iconLibraries || []) for (const x of l.icons) if (iconIds.has(x.id)) entry.icons[x.id] = x;
      return entry;
    }).filter(Boolean);
    if (!doc.componentLibraries.length) delete doc.componentLibraries;
    // A library file's own components, as files that use it see them.
    doc.publishedComponents = { version: 0, live: true, components: structuredClone(publishableComponents(doc)) };
    if (!doc.publishedComponents.components.length) delete doc.publishedComponents;
  }
  migrateDocument(doc);
  return { doc, warnings };
}

// ---------- writing ----------
// Keys in a stable order: identity first, then the rest A–Z, then the long lists.
const FIRST = ['$schema', 'format', 'kind', 'id', 'type', 'name', 'description'];
const LAST = ['uses', 'source', 'collections', 'icons', 'pages', 'children'];
// Maps whose key order means something (a component's properties are listed in that order).
const ORDERED = new Set(['props']);

function sortKeys(value, parentKey = null) {
  if (Array.isArray(value)) return value.map((v) => sortKeys(v));
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value);
  if (!ORDERED.has(parentKey)) {
    const rank = (k) => (FIRST.includes(k) ? FIRST.indexOf(k) - 100 : LAST.includes(k) ? 100 + LAST.indexOf(k) : 0);
    keys.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  }
  return Object.fromEntries(keys.map((k) => [k, sortKeys(value[k], k)]));
}

// JSON with sorted keys, two-space indents, and objects or arrays that fit in `width` on one line.
export function formatProjectJSON(value, width = 100) {
  const sorted = sortKeys(value);
  // One line: { "a": 1, "b": [2, 3] }.
  const inline = (v) => {
    if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
    if (v && typeof v === 'object') {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined);
      return entries.length ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
    }
    return JSON.stringify(v) ?? 'null';
  };
  const write = (v, indent, room) => {
    if (!v || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    const flat = inline(v);
    if (flat.length <= room) return flat;
    const pad = `${indent}  `;
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return `[\n${v.map((x) => pad + write(x, pad, width - pad.length)).join(',\n')}\n${indent}]`;
    }
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, x]) => {
      const head = `${pad}${JSON.stringify(k)}: `;
      return head + write(x, pad, width - head.length);
    }).join(',\n')}\n${indent}}`;
  };
  return `${write(sorted, '', width)}\n`;
}

// A document, ready to write to the project: { text, path, warnings }.
export function serializeForProject(doc, { pathOf, path } = {}) {
  const { file, warnings } = toProjectFile(doc, { pathOf });
  return { text: formatProjectJSON(file), path: path || doc.project?.path || projectPath(file.kind, file.name), warnings };
}
