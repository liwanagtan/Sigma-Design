// Check a library built from captures against the captures (Part E, Phase 28): lay each component out in
// Sigma (text measured, auto layout applied) and compare every layer's size and position with the real
// render. Runs in the browser, with the project server: tools/capture/compare.html shows the report.
import { state, reindex, walk, worldBounds, fixGroups } from './store.js';
import { syncInstances } from './components.js';
import { resolveVariables, normalizeTokenGroups } from './variables.js';
import { applyLayouts } from './layout.js';
import { measureText } from './text.js';
import { fromProjectFile } from './project-format.js';
import { compareBoxes } from './capture-to-sigma.js';
import { parseVariantName } from './components.js';

const get = async (path) => {
  const r = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

// A laid-out layer as { name, box (relative to the component), children }.
function boxes(node, origin) {
  const b = worldBounds(node);
  return {
    name: node.name, box: { x: b.x - origin.x, y: b.y - origin.y, w: b.w, h: b.h },
    children: (node.children || []).filter((c) => c.visible !== false).map((c) => boxes(c, origin)),
  };
}

// The project's files, and a document from one of them laid out as the editor would (text measured, the
// normalize pipeline run twice: instances size from their laid-out main components). `fn(doc)` runs while
// it is the open document.
async function withLaidOut(path, files, fn) {
  const ids = Object.fromEntries(Object.keys(files).map((p, i) => [p, `cmp-${i}`]));
  const { doc } = fromProjectFile(files[path], { path, resolve: (p) => (files[p] ? { fileId: ids[p], file: files[p] } : null) });
  const saved = { doc: state.doc, selection: state.selection };
  try {
    state.doc = doc;
    state.selection = [];
    reindex();
    for (const pg of doc.pages) walk(pg.children, (n) => void (n.type === 'text' && measureText(n)));
    for (let i = 0; i < 2; i++) {
      normalizeTokenGroups();
      syncInstances();
      resolveVariables();
      fixGroups();
      applyLayouts();
      fixGroups();
    }
    return await fn(doc);
  } finally {
    state.doc = saved.doc;
    state.selection = saved.selection;
    reindex();
  }
}
async function projectFiles() {
  const project = await (await fetch('/api/project', { cache: 'no-store' })).json();
  const files = {};
  for (const f of project.files) files[f.path] = await get(f.path);
  return files;
}
const exists = async (path) => (await fetch(`/api/project/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })).ok;
const relBoxes = (node) => {
  const b = worldBounds(node);
  return boxes(node, { x: b.x, y: b.y });
};

// { [component / variant]: [{ layer, what, code, sigma }] } for the components in captures/manifest.json.
export async function compareLibrary({ captures = '.sigma/captures', tolerance = 1.5, files = null } = {}) {
  const manifest = await get(`${captures}/manifest.json`);
  files ||= await projectFiles();
  if (!files[manifest.library]) throw new Error(`${manifest.library} isn’t in the project`);
  const report = {};
  await withLaidOut(manifest.library, files, async (doc) => {
    const hosts = [];
    for (const pg of doc.pages) walk(pg.children, (n) => void ((n.type === 'component' || n.type === 'componentSet') && hosts.push(n)));
    for (const spec of manifest.components) {
      const host = hosts.find((h) => h.name === spec.name);
      for (const cap of spec.captures) {
        const want = Object.entries(cap.variant || {});
        const key = want.length ? `${spec.name} / ${want.map(([k, v]) => `${k}=${v}`).join(', ')}` : spec.name;
        const node = host?.type === 'componentSet' ? host.children.find((c) => want.every(([k, v]) => parseVariantName(c.name)[k] === v)) : host;
        if (!node) {
          report[key] = [{ layer: key, what: 'missing', code: 'captured', sigma: 'not in the library' }];
          continue;
        }
        report[key] = compareBoxes(relBoxes(node), (await get(`${captures}/${cap.file}`)).tree, { tolerance });
      }
    }
  });
  return report;
}

// The same for the pages in captures/pages.json (Phase 29): { [page — breakpoint]: [...] }.
export async function comparePages({ captures = '.sigma/captures', tolerance = 1.5, files = null } = {}) {
  if (!(await exists(`${captures}/pages.json`))) return {};
  const spec = await get(`${captures}/pages.json`);
  files ||= await projectFiles();
  if (!files[spec.file]) throw new Error(`${spec.file} isn’t in the project (run pages build)`);
  const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const report = {};
  await withLaidOut(spec.file, files, async (doc) => {
    for (const page of spec.pages) {
      for (const bp of spec.breakpoints) {
        const key = `${page.name} — ${bp.name}`;
        const file = `${captures}/page-${slug(page.name)}-${slug(bp.name)}.json`;
        if (!(await exists(file))) continue;
        const frame = doc.pages.find((p) => p.name === page.name)?.children.find((c) => c.name === key);
        if (!frame) {
          report[key] = [{ layer: key, what: 'missing', code: 'captured', sigma: 'not in the file' }];
          continue;
        }
        const capture = (await get(file)).tree;
        report[key] = compareBoxes(relBoxes(frame), { ...capture, name: key }, { tolerance });
      }
    }
  });
  return report;
}

// The report as text.
export function formatComparison(report) {
  const lines = [];
  let bad = 0;
  for (const [key, diffs] of Object.entries(report)) {
    if (!diffs.length) {
      lines.push(`✓ ${key}`);
      continue;
    }
    bad++;
    lines.push(`✗ ${key}`);
    for (const d of diffs) lines.push(`    ${d.layer}: ${d.what} ${d.sigma} in Sigma, ${d.code} in code`);
  }
  lines.push(`${Object.keys(report).length - bad} of ${Object.keys(report).length} match the code${bad ? `; fix the ${bad} that don’t (in the captures’ manifest, the capture page or the Sigma file) and build again` : ''}.`);
  return lines.join('\n');
}
