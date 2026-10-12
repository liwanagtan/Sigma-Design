// The project format (src/project-format.js) and the validator (src/validate.js).
import { test, eq, ok } from './harness.js';
import { state, loadDocument, normalizeDocument, walk, createNode, makePaint } from '../src/store.js';
import { syncInstances } from '../src/components.js';
import { resolveVariables } from '../src/variables.js';
import { applyLayouts } from '../src/layout.js';
import { measureText } from '../src/text.js';
import { sampleTokenDocument } from '../src/sample-tokens.js';
import { sampleIconsDocument } from '../src/sample-icons.js';
import { welcomeDocument } from '../src/welcome.js';
import { ICON_SETS, loadIconSet, parseXML } from '../src/icon-library.js';
import {
  toProjectFile, fromProjectFile, formatProjectJSON, serializeForProject, projectPath,
} from '../src/project-format.js';
import { validateProject, validateFile } from '../src/validate.js';
import { validateConfig } from '../src/project-config.js';

// Sigma's samples as a project: { files: { path: file }, docs }.
async function sampleProject() {
  const tokens = sampleTokenDocument();
  const tokensDoc = { kind: 'tokens', name: tokens.name, pages: [], variables: { collections: tokens.collections } };
  const iconsDoc = sampleIconsDocument(await loadIconSet(ICON_SETS[0]));
  const guide = welcomeDocument(tokens.collections, { icons: iconsDoc.icons });
  const paths = { tokens: projectPath('tokens', tokensDoc.name), icons: projectPath('icons', iconsDoc.name), guide: projectPath('design', guide.name) };
  guide.libraries = [{ fileId: 'tokens', name: tokensDoc.name }];
  guide.iconLibraries = [{ fileId: 'icons', name: iconsDoc.name }];
  const pathOf = (id) => paths[id] || null;
  const files = {};
  for (const [doc, p] of [[tokensDoc, paths.tokens], [iconsDoc, paths.icons], [guide, paths.guide]]) files[p] = toProjectFile(doc, { pathOf }).file;
  return { files, paths };
}

// Open a project file the way the editor does: load it, then rebuild what was left out.
function open(files, path) {
  const ids = Object.fromEntries(Object.keys(files).map((p, i) => [p, `f${i}`]));
  const { doc, warnings } = fromProjectFile(files[path], { path, resolve: (p) => (files[p] ? { fileId: ids[p], file: files[p] } : null) });
  loadDocument(doc);
  for (const pg of state.doc.pages) walk(pg.children, (n) => void (n.type === 'text' && measureText(n)));
  syncInstances();
  resolveVariables();
  normalizeDocument();
  applyLayouts();
  return { doc: state.doc, warnings, pathOf: (id) => Object.keys(ids).find((p) => ids[p] === id) || null };
}

test('project format: the samples validate', async () => {
  const { files } = await sampleProject();
  const issues = validateProject(files);
  eq(issues.filter((i) => i.level === 'error'), []);
});

test('project format: saving, opening and saving again gives the same file (derived data is rebuilt, not stored)', async () => {
  const { files, paths } = await sampleProject();
  for (const p of Object.values(paths)) {
    const { doc, warnings, pathOf } = open(files, p);
    eq(warnings, []);
    const again = toProjectFile(doc, { pathOf }).file;
    eq(formatProjectJSON(again), formatProjectJSON(files[p]), `${p} round-trips`);
  }
});

test('project format: an opened file looks right: instances, token values and layout are rebuilt', async () => {
  const { files, paths } = await sampleProject();
  const { doc } = open(files, paths.guide);
  const pg = doc.pages.find((x) => x.name === '5 Tokens in designs');
  const card = (name) => pg.children.find((n) => n.name === name).children[0];
  eq(card('Light').fills[0].color, '#FFFFFF');
  eq(card('Dark').fills[0].color, '#2C3038', 'modes resolve');
  ok(card('Light').children.length > 1, 'instance layers are rebuilt from the main component');
  const icons = doc.pages.find((x) => x.name === '10 Sigma Icons');
  let iconLayers = 0;
  walk(icons.children, (n) => void (n.type === 'icon' && iconLayers++));
  ok(iconLayers > 15 && doc.iconLibraries[0].icons.length > 5, 'icons are linked by path and copied in');
});

test('project format: a token change touches only the token file', async () => {
  const { files, paths } = await sampleProject();
  const before = formatProjectJSON(files[paths.guide]);
  const tokens = structuredClone(files[paths.tokens]);
  const blue = tokens.collections.find((c) => c.name === 'Primitives').variables.find((v) => v.name === 'color/blue/500');
  const mode = Object.keys(blue.valuesByMode)[0];
  blue.valuesByMode[mode] = '#FF0000';
  const changed = { ...files, [paths.tokens]: tokens };
  const { doc, pathOf } = open(changed, paths.guide);
  let red = 0;
  for (const pgx of doc.pages) walk(pgx.children, (n) => void ((n.fills || []).some((f) => f.color === '#FF0000') && red++));
  ok(red > 3, 'layers using the token show the new value');
  eq(formatProjectJSON(toProjectFile(doc, { pathOf }).file), before, 'the design file is unchanged');
  const diff = formatProjectJSON(tokens).split('\n').filter((l, i) => l !== formatProjectJSON(files[paths.tokens]).split('\n')[i]);
  eq(diff.length, 1, 'one line changed in the token file');
});

test('project format: defaults and derived values are left out; small objects stay on one line', () => {
  const rect = createNode('rect', { name: 'Box', fills: [makePaint('#0D99FF')], bindings: { radius: 'r1' }, radius: 8 });
  const doc = { name: 'D', pages: [{ id: 'p', name: 'Page', background: '#F5F5F5', children: [rect] }], libraries: [{ fileId: 'x', name: 'T' }] };
  const { file, warnings } = toProjectFile(doc, { pathOf: () => null });
  const saved = file.pages[0].children[0];
  eq(Object.keys(saved).sort(), ['bindings', 'fills', 'h', 'id', 'name', 'type', 'w']);
  eq(saved.fills, [{ color: '#0D99FF' }]);
  ok(!('radius' in saved), 'a bound value comes from its token');
  eq(warnings.length, 1, 'a link to a file outside the project is reported');
  const text = formatProjectJSON(file);
  ok(text.includes('"fills": [{ "color": "#0D99FF" }]'), text);
  const node = formatProjectJSON(saved);
  ok(node.indexOf('"id"') < node.indexOf('"name"'), 'id before name');
  eq(projectPath('tokens', 'Brand Colors'), '.sigma/tokens/brand-colors.sigma.json');
});

test('project format: written text is stable and stays valid JSON for any text', () => {
  const tricky = { format: 1, kind: 'icons', name: 'a,"b": {c}', icons: [] };
  const text = formatProjectJSON(tricky);
  eq(JSON.parse(text), tricky);
  eq(formatProjectJSON(JSON.parse(text)), text);
});

test('validator: says what’s wrong in words an agent can act on', () => {
  const tokens = {
    format: 1, kind: 'tokens', name: 'Core',
    collections: [{
      id: 'c', name: 'Core', modes: [{ id: 'light', name: 'Light' }], defaultModeId: 'light',
      variables: [
        { id: 'a', name: 'color/a', type: 'color', valuesByMode: { light: { alias: 'b' } } },
        { id: 'b', name: 'color/b', type: 'color', valuesByMode: { light: { alias: 'a' } } },
        { id: 'c1', name: 'color/bad', type: 'color', valuesByMode: { light: 'blue' } },
        { id: 'n', name: 'space/1', type: 'number', valuesByMode: { light: { alias: 'missing' } } },
        { id: 's', name: 'space/2', type: 'number', valuesByMode: { light: { alias: 'c1' } } },
      ],
    }],
  };
  const design = {
    format: 1, kind: 'design', name: 'App', uses: { tokens: ['.sigma/tokens/core.sigma.json'] },
    pages: [{ id: 'p', name: 'Page', children: [
      { id: 'r', type: 'rect', name: 'Box', bindings: { 'fills.0.color': 'nope', radius: 'c1' }, fills: [{}] },
      { id: 'i', type: 'instance', name: 'Button', componentId: 'ghost', children: [] },
      { id: 'r', type: 'blob', name: 'Twin' },
    ] }],
  };
  const issues = validateProject({ '.sigma/tokens/core.sigma.json': tokens, '.sigma/design/app.sigma.json': design });
  const text = issues.map((i) => i.message).join('\n');
  for (const want of [
    'tokens point at each other in a loop: color/a → color/b → color/a',
    'should be a color like "#0D99FF" or "#0D99FF80", not "blue"',
    'points at token missing, which doesn’t exist',
    'points at “color/bad”, a color token; it needs a number token',
    'uses token nope, which isn’t in this file or the Sigma Tokens files it uses',
    'uses “color/bad”, a color token; radius needs a number token',
    'an instance’s layers come from its main component',
    'ghost isn’t a component in this file',
    'r is used by another layer',
    'should be one of frame',
  ]) ok(text.includes(want), `missing: ${want}\n---\n${text}`);
  eq(validateFile({ format: 1, kind: 'design', name: 'x', pages: [], uses: { tokens: ['nowhere.sigma.json'] } }, { path: 'a' })[0].message, 'nowhere.sigma.json isn’t in the project');
});

test('validator: icons and the project config', () => {
  const icons = { format: 1, kind: 'icons', name: 'I', icons: [
    { id: 'a', name: 'ok', style: 'outline', viewBox: '0 0 24 24', strokeWidth: 2, body: '<path d="M0 0h24"/>' },
    { id: 'a', name: 'twin', style: 'bold', viewBox: '0 0 24', body: '<script>x</script><path d="M0 0"/>' },
  ] };
  const text = validateFile(icons, { path: 'i' }).map((i) => i.message).join('\n');
  for (const want of ['a is used by another icon', 'should be "outline" or "filled"', 'should be four numbers', 'has markup Sigma removes on load']) ok(text.includes(want), want);
  const cfg = validateConfig({ schema: 1, tokens: [{ sigma: '.sigma/tokens/core.sigma.json', sources: [{ path: 'a.css', format: 'css' }] }] }, { files: [] });
  ok(cfg.some((i) => i.message.startsWith('should be one of css-variables')), 'unknown token source format');
  eq(validateConfig({ schema: 1, tokens: [{ sigma: '.sigma/tokens/core.sigma.json', sources: [{ path: 'a.css', format: 'css-variables' }] }] }, { files: ['.sigma/tokens/core.sigma.json'] }), []);
});

test('icons: SVG is read without the DOM, the same in every environment', () => {
  const el = parseXML('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><!-- hi --><svg a="1 &amp; 2"><g><path d="M0 0"/></g></svg>');
  eq([el.nodeName, el.getAttribute('a'), el.children[0].children[0].getAttribute('d')], ['svg', '1 & 2', 'M0 0']);
  for (const bad of ['<svg>', '<svg></g>', '<svg a=1/>', '<a/><b/>']) {
    let threw = false;
    try { parseXML(bad); } catch { threw = true; }
    ok(threw, bad);
  }
});

test('project format: serializeForProject names new files by kind and name', () => {
  const { path } = serializeForProject({ kind: 'icons', name: 'App Icons', icons: [] });
  eq(path, '.sigma/icons/app-icons.sigma.json');
});

// ---------- projects (src/project.js), with an in-memory project ----------
import { connectWith, bringProjectFile, hasUnsavedProjectChanges, textHash, project } from '../src/project.js';
import { loadFile, deleteFile, listFiles, replaceFile } from '../src/files.js';

function memoryProject(files) {
  const disk = new Map(Object.entries(files).map(([p, f]) => [p, { text: formatProjectJSON(f), mtime: '1' }]));
  let clock = 1;
  return {
    disk,
    via: 'memory',
    async list() {
      return { name: `test-project-${Date.now()}`, files: [...disk].map(([path, { text, mtime }]) => ({ path, kind: JSON.parse(text).kind, name: JSON.parse(text).name, mtime, size: text.length })), config: null };
    },
    async read(path) {
      if (!disk.has(path)) throw new Error(`${path} doesn’t exist`);
      return { ...disk.get(path) };
    },
    async write(path, text, base) {
      const cur = disk.get(path);
      if ((base === 'new' && cur) || (base && base !== 'new' && cur && cur.mtime !== base)) throw Object.assign(new Error('changed'), { conflict: true, mtime: cur.mtime });
      disk.set(path, { text, mtime: String(++clock) });
      return { path, mtime: String(clock) };
    },
    touch(path, edit) { // an agent edits the file on disk
      const file = JSON.parse(disk.get(path).text);
      edit(file);
      disk.set(path, { text: formatProjectJSON(file), mtime: String(++clock) });
    },
  };
}

test('projects: a project file and the files it uses come into the browser, linked by path; unchanged files stay as they are', async () => {
  const { files, paths } = await sampleProject();
  const mem = memoryProject(files);
  await connectWith(mem);
  const made = [];
  try {
    const id = await bringProjectFile(paths.guide);
    const metas = (await listFiles()).filter((m) => m.project?.name === project.name);
    made.push(...metas.map((m) => m.id));
    eq(metas.map((m) => m.project.path).sort(), Object.values(paths).sort(), 'the guide and the files it uses');
    const guide = (await loadFile(id)).doc;
    eq(guide.project.path, paths.guide);
    eq([guide.libraries[0].path, guide.iconLibraries[0].path], [paths.tokens, paths.icons]);
    ok(!(await hasUnsavedProjectChanges(id)), 'a file just brought in has nothing to save');
    eq(await bringProjectFile(paths.guide), id, 'bringing it again reuses the stored copy');
    // An agent changes the token file on disk: bringing the guide brings the new tokens too.
    mem.touch(paths.tokens, (f) => (f.name = 'Renamed tokens'));
    await bringProjectFile(paths.guide);
    const tokens = (await loadFile(metas.find((m) => m.project.path === paths.tokens).id)).doc;
    eq(tokens.name, 'Renamed tokens');
    // Changes made in the browser are kept when the disk version hasn't changed.
    const edited = structuredClone(guide);
    edited.pages[0].name = 'Edited here';
    await replaceFile(id, edited);
    ok(await hasUnsavedProjectChanges(id), 'an edit here is a change not saved to the project');
    await bringProjectFile(paths.guide);
    eq((await loadFile(id)).doc.pages[0].name, 'Edited here', 'not overwritten by an unchanged disk file');
    await bringProjectFile(paths.guide, { force: true });
    ok((await loadFile(id)).doc.pages[0].name !== 'Edited here', 'force loads the disk version');
    eq(textHash('abc'), textHash('abc'));
    ok(textHash('abc') !== textHash('abd'));
  } finally {
    for (const m of await listFiles()) if (m.project?.name === project.name) await deleteFile(m.id);
  }
});
