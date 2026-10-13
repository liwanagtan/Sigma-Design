// Sigma Icons files: importing SVGs safely, outline vs filled, drawing icons, groups, search and versions.
import { test, eq, ok } from './harness.js';
import {
  parseSVGIcon, iconMarkup, iconGroups, iconMatches, iconNameFrom, diffIcons, sanitizeIcons, newIconsDocument,
} from '../src/icon-library.js';
import { fileKind } from '../src/files.js';

const LUCIDE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
const MATERIAL = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M0 0h24v24H0z" fill="none"/><path fill="#5f6368" d="M480-160 160-480l320-320 42 42-248 248h526v60H274l248 248-42 42Z"/></svg>`;

test('icons: an outline SVG keeps its shapes and stroke width; colors become currentColor', () => {
  const icon = parseSVGIcon(LUCIDE, { name: 'arrow-right', group: 'Arrows' });
  eq(icon.style, 'outline');
  eq(icon.strokeWidth, 2);
  eq(icon.cap, 'round');
  eq(icon.viewBox, '0 0 24 24');
  eq(icon.group, 'Arrows');
  eq(icon.body, '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');
  const md = parseSVGIcon(MATERIAL, { name: 'arrow-back' });
  eq(md.style, 'filled');
  eq(md.viewBox, '0 -960 960 960');
  ok(md.body.includes('fill="currentColor"') && !md.body.includes('#5f6368'), 'its color follows the layer');
  ok(md.body.includes('fill="none"'), '"none" stays none');
});

test('icons: importing removes anything that could run or load something', () => {
  const evil = `<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script><style>*{}</style>
    <defs><linearGradient id="g"/></defs><image href="https://x/y.png"/><foreignObject><div>x</div></foreignObject>
    <path d="M0 0h24" onclick="alert(1)" fill="url(#g)" style="fill:red" href="javascript:alert(1)"/>
    <g transform="translate(2 2)" filter="url(#f)"><circle cx="5" cy="5" r="2"/><use href="#x"/></g>
    <rect x="1" y="1" width="2" height="2" rx="javascript:1"/></svg>`;
  const icon = parseSVGIcon(evil);
  ok(!/script|onload|onclick|style|href|image|foreignObject|defs|use|filter|url\(/i.test(icon.body), icon.body);
  ok(icon.body.includes('<path d="M0 0h24" fill="currentColor"/>'), 'the path stays, with its color as currentColor');
  ok(icon.body.includes('<g transform="translate(2 2)"><circle cx="5" cy="5" r="2"/></g>'), 'groups keep their transform');
  ok(icon.body.includes('<rect x="1" y="1" width="2" height="2"/>'), 'unsafe values are dropped');
  let threw = false;
  try { parseSVGIcon('<html><body>hi</body></html>'); } catch { threw = true; }
  ok(threw, 'not an SVG');
  threw = false;
  try { parseSVGIcon('<svg viewBox="0 0 24 24"><text>A</text></svg>'); } catch { threw = true; }
  ok(threw, 'no shapes');
});

test('icons: drawn at any size and color; outline icons use their stroke width', () => {
  const icon = parseSVGIcon(LUCIDE);
  const svg = iconMarkup(icon, { w: 16, h: 16, color: '#FF0000' });
  ok(svg.startsWith('<svg width="16" height="16" viewBox="0 0 24 24"'), svg);
  ok(svg.includes('stroke="#FF0000" stroke-width="2"') && svg.includes('fill="none"'), svg);
  ok(iconMarkup(icon, { strokeWidth: 1.5 }).includes('stroke-width="1.5"'));
  ok(iconMarkup(icon, { x: 10, y: 20 }).startsWith('<svg x="10" y="20"'));
  const filled = parseSVGIcon(MATERIAL);
  ok(iconMarkup(filled, { color: '#00FF00' }).includes('fill="#00FF00" stroke="none"'));
  eq(iconMarkup(null), '');
});

test('icons: names from file names, groups, search', () => {
  eq(iconNameFrom('Arrow Right.svg'), 'arrow-right');
  eq(iconNameFrom('chevron_down.SVG'), 'chevron-down');
  const list = [
    { name: 'arrow-right', group: 'Arrows', keywords: 'next, forward' },
    { name: 'home', group: '' },
    { name: 'arrow-left', group: 'Arrows' },
  ];
  eq(iconGroups(list), [{ name: 'Arrows', count: 2 }, { name: '', count: 1 }]);
  ok(iconMatches(list[0], 'forward'));
  ok(iconMatches(list[0], 'arrows right'));
  ok(!iconMatches(list[1], 'arrow'));
  ok(iconMatches(list[1], ''));
});

test('icons: versions show what was added, changed and removed; files are their own kind', () => {
  const a = { id: 'a', name: 'a', body: '<path d="M0 0"/>' }, b = { id: 'b', name: 'b', body: '' }, c = { id: 'c', name: 'c', body: '' };
  eq(diffIcons([a, b], [{ ...a, body: '<path d="M1 1"/>' }, c]), { added: ['c'], changed: ['a'], removed: ['b'] });
  const doc = newIconsDocument('Lucide');
  eq(fileKind(doc), 'icons');
  eq(fileKind({ kind: 'tokens' }), 'tokens');
  eq(fileKind({}), 'design');
  eq(doc.icons, []);
});

test('icons: icons in an imported file are cleaned again', () => {
  const [icon, ...rest] = sanitizeIcons([
    { id: 'x', name: 'bad', viewBox: '0 0 24 24', style: 'outline', strokeWidth: 2, cap: 'round" onload="x', body: '<path d="M0 0" onclick="alert(1)"/><script>alert(1)</script>' },
    { id: 'y', name: 'empty', viewBox: '0 0 24 24', body: '<text>x</text>' },
  ]);
  eq(rest.length, 0, 'icons without shapes are dropped');
  eq(icon.body, '<path d="M0 0"/>');
  eq(icon.cap, 'round');
  eq(icon.id, 'x');
  eq(sanitizeIcons(null), []);
});

// ---------- icons in Sigma Design files ----------
import { useDoc } from './core.test.js';
import { state, createNode, editNode, makePaint, getNode, select } from '../src/store.js';
import { syncInstances, createInstance, publishableComponents, listComponents } from '../src/components.js';
import { acceptUpdate, componentPublishStatus, unlinkIconLibrary } from '../src/libraries.js';
import { findIcon, iconLibraryOf } from '../src/icon-library.js';
import { insertIcon, iconTarget, availableIcons } from '../src/icon-ui.js';
import { nodeSVG } from '../src/render.js';
import { buildSVG } from '../src/io.js';

const ARROW = parseSVGIcon(LUCIDE, { name: 'arrow-right', group: 'Arrows' });
const STAR = parseSVGIcon(MATERIAL, { name: 'star' });
const linkIcons = (icons = [ARROW, STAR], version = 1, lib = { fileId: 'icons-1' }) =>
  acceptUpdate({ kind: 'icons', lib, meta: { name: 'Lucide' }, published: { version, icons: structuredClone(icons) } });

test('icon layers: show a linked icon in their fill color and size', () => {
  useDoc([]);
  linkIcons();
  eq(findIcon(ARROW.id).name, 'arrow-right');
  eq(iconLibraryOf(ARROW.id).name, 'Lucide');
  eq(availableIcons({ groups: ['Arrows'] }).map((x) => x.icon.name), ['arrow-right']);
  eq(availableIcons().length, 2);
  const n = createNode('icon', { iconId: ARROW.id, fills: [makePaint('#FF0000')], w: 32, h: 32 });
  const svg = nodeSVG(n);
  ok(svg.includes('width="32" height="32" viewBox="0 0 24 24"') && svg.includes('stroke="#FF0000" stroke-width="2"'), svg);
  n.iconStroke = 1.5;
  ok(nodeSVG(n).includes('stroke-width="1.5"'));
  ok(nodeSVG(createNode('icon', { iconId: 'gone' })).includes('stroke-dasharray'), 'a missing icon shows a placeholder');
  ok(buildSVG([n]).svg.includes('viewBox="0 0 24 24"'), 'exports');
});

test('icon layers: go inside main components; instances copy them and can’t override them', () => {
  const btn = createNode('component', { name: 'Button', w: 120, h: 40, children: [createNode('rect', { name: 'Bg', w: 120, h: 40 })] });
  const loose = createNode('frame', { name: 'Loose', x: 300, w: 100, h: 100 });
  useDoc([btn, loose]);
  linkIcons();
  select([loose.id]);
  eq(iconTarget(), null, 'not outside components');
  select([btn.children[0].id]);
  const icon = insertIcon(ARROW.id);
  ok(icon && btn.children[1] === icon, 'goes next to the selected layer');
  eq([icon.x, icon.y, icon.w, icon.name], [48, 8, 24, 'arrow-right']);
  const inst = createInstance(getNode(btn.id), { x: 0, y: 100 });
  const copy = inst.children[1];
  eq([copy.type, copy.iconId], ['icon', ARROW.id]);
  editNode(copy, ['fills'], (n) => void (n.fills = [makePaint('#00FF00')]));
  syncInstances();
  eq(inst.children[1].fills[0].color, '#1E1E1E', 'its color comes from the main component');
  editNode(getNode(icon.id), ['iconId'], (n) => void (n.iconId = STAR.id));
  syncInstances();
  eq(inst.children[1].iconId, STAR.id, 'follows the main component');
});

test('icon libraries: updates keep icons in use, and components publish the icons they use', () => {
  const comp = createNode('component', { name: 'Fav', w: 24, h: 24, children: [createNode('icon', { name: 'star', iconId: STAR.id })] });
  useDoc([comp]);
  linkIcons();
  const changed = { ...ARROW, body: '<path d="M1 1h2"/>' };
  linkIcons([changed], 2, state.doc.iconLibraries[0]);
  const lib = state.doc.iconLibraries[0];
  eq(lib.version, 2);
  eq(findIcon(ARROW.id).body, '<path d="M1 1h2"/>');
  ok(findIcon(STAR.id)?.removed, 'a removed icon in use stays, marked removed');
  eq(availableIcons().map((x) => x.icon.name), ['arrow-right'], 'but isn’t offered');
  unlinkIconLibrary(lib.fileId);
  eq(state.doc.iconLibraries.length, 1, 'can’t unlink while its icons are in use');
  // Publishing components carries their icons, so files using the component library can show them.
  const published = { version: 1, components: structuredClone(publishableComponents()) };
  state.doc.publishedComponents = { ...published, icons: { [STAR.id]: structuredClone(findIcon(STAR.id)) } };
  ok(!componentPublishStatus().dirty, 'nothing to publish');
  state.doc.iconLibraries[0].icons.find((x) => x.id === STAR.id).body = '<path d="M2 2h2"/>';
  ok(componentPublishStatus().dirty, 'a newer icon is a change');
  useDoc([]);
  acceptUpdate({ kind: 'components', lib: { fileId: 'lib-c' }, meta: { name: 'Kit' }, published: { ...published, icons: { [STAR.id]: STAR } } });
  const inst = createInstance(listComponents()[0].node);
  ok(findIcon(STAR.id), 'icons come with library components');
  ok(nodeSVG(inst).includes('fill="#1E1E1E" stroke="none"'), 'and show');
});

// ---------- the Icon property ----------
import { addComponentProp, bindLayerProp, setInstanceProp, updateComponentProp, propsOf, PROP_TARGET } from '../src/components.js';

test('icon property: instances choose the icon; size, color and stroke stay the main component’s', () => {
  const glyph = createNode('icon', { name: 'Icon', iconId: ARROW.id, fills: [makePaint('#0D99FF')], w: 20, h: 20, iconStroke: 1.5 });
  const btn = createNode('component', { name: 'Button', w: 120, h: 40, children: [glyph] });
  useDoc([btn]);
  linkIcons();
  eq(PROP_TARGET.icon, 'iconId');
  const pid = addComponentProp(btn, 'icon', { name: 'Icon', value: STAR.id });
  bindLayerProp(glyph, 'iconId', pid);
  eq(glyph.iconId, STAR.id, 'the main component shows the default');
  const inst = createInstance(getNode(btn.id));
  eq(inst.children[0].iconId, STAR.id);
  setInstanceProp(inst, pid, ARROW.id);
  syncInstances();
  const copy = inst.children[0];
  eq([copy.iconId, copy.fills[0].color, copy.w, copy.iconStroke], [ARROW.id, '#0D99FF', 20, 1.5]);
  // Choosing the icon on the layer inside the instance sets the property too.
  editNode(copy, ['iconId'], (n) => void (n.iconId = STAR.id));
  syncInstances();
  eq([inst.propValues[pid], inst.children[0].iconId], [STAR.id, STAR.id]);
  // Swapping the main component's icon changes the default; instances that chose one keep theirs.
  const other = createInstance(getNode(btn.id));
  editNode(glyph, ['iconId'], (n) => void (n.iconId = ARROW.id));
  syncInstances();
  eq(propsOf(btn)[pid].default, ARROW.id);
  eq([other.children[0].iconId, inst.children[0].iconId], [ARROW.id, STAR.id]);
});

test('icon property: allowed groups limit the choice (all by default)', () => {
  const btn = createNode('component', { name: 'B', w: 40, h: 40, children: [createNode('icon', { iconId: ARROW.id })] });
  useDoc([btn]);
  linkIcons();
  const pid = addComponentProp(btn, 'icon', { value: ARROW.id });
  eq(propsOf(btn)[pid].groups, undefined);
  updateComponentProp(btn, pid, { groups: ['Arrows', 'Arrows'] });
  eq(propsOf(btn)[pid].groups, ['Arrows']);
  eq(availableIcons({ groups: propsOf(btn)[pid].groups }).map((x) => x.icon.name), ['arrow-right']);
  updateComponentProp(btn, pid, { groups: [] });
  eq(propsOf(btn)[pid].groups, undefined, 'none means all');
});

import { importSVGTexts } from '../src/icons-screen.js';

test('icons: an outline and a filled icon can share a name; re-importing updates the one of the same style', () => {
  useDoc([]);
  state.doc.icons = [];
  const heartLine = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21 3 12a5 5 0 0 1 9-6 5 5 0 0 1 9 6z"/></svg>`;
  const heartFill = `<svg viewBox="0 0 24 24"><path d="M12 21 3 12a5 5 0 0 1 9-6 5 5 0 0 1 9 6z"/></svg>`;
  importSVGTexts([{ text: heartLine, name: 'heart' }, { text: heartFill, name: 'heart' }], { group: 'Social' });
  eq(state.doc.icons.map((i) => i.style), ['outline', 'filled']);
  const outlineId = state.doc.icons[0].id;
  const r = importSVGTexts([{ text: heartLine.replace('stroke-width="2"', 'stroke-width="1.5"'), name: 'heart' }], { group: 'Social' });
  eq([r.added, r.updated, state.doc.icons.length, state.doc.icons[0].id, state.doc.icons[0].strokeWidth], [0, 1, 2, outlineId, 1.5]);
});

// ---------- icon sets, and keeping only the icons in use ----------
import { iconSetDocument, ICON_SETS } from '../src/icon-library.js';
import { keepIcons } from '../src/libraries.js';

test('icon sets: become a published Sigma Icons file with stable ids and credit', () => {
  const data = {
    name: 'Lucide', version: '1.0.0', url: 'https://lucide.dev', license: 'ISC', licenseText: 'ISC License…', viewBox: '0 0 24 24',
    style: 'outline', strokeWidth: 2, cap: 'round', join: 'round',
    icons: [['arrow-right', 'Arrows', 'next', '<path d="M5 12h14"/>'], ['bad', '', '', '<script>alert(1)</script><path d="M0 0" onclick="x"/>']],
  };
  const doc = iconSetDocument(ICON_SETS[0], data);
  eq(doc.icons.map((i) => [i.id, i.name, i.group, i.style, i.strokeWidth]), [['lucide-arrow-right', 'arrow-right', 'Arrows', 'outline', 2], ['lucide-bad', 'bad', '', 'outline', 2]]);
  eq(doc.icons[1].body, '<path d="M0 0"/>', 'cleaned like any import');
  eq([doc.published.version, doc.published.icons.length, doc.source.license], [1, 2, 'ISC']);
});

test('icon libraries: a design file keeps copies of only the icons it uses', () => {
  const btn = createNode('component', { name: 'B', w: 40, h: 40, children: [createNode('icon', { iconId: STAR.id })] });
  useDoc([btn]);
  linkIcons();
  const lib = state.doc.iconLibraries[0];
  eq([lib.count, lib.icons.map((x) => x.name)], [2, ['star']]);
  eq(availableIcons().length, 2, 'the picker offers the whole set');
  select([btn.children[0].id]);
  insertIcon(ARROW.id);
  eq(lib.icons.map((x) => x.name), ['star', 'arrow-right'], 'an icon placed is copied');
  keepIcons([ARROW.id, 'nope']);
  eq(lib.icons.length, 2);
});

import { iconScore } from '../src/icon-library.js';

test('icons: search ranks the exact name first, then names that start with it', () => {
  const names = ['file-heart', 'heart-crack', 'activity', 'heart'];
  const icons = names.map((name) => ({ name, keywords: name === 'activity' ? 'heart, pulse' : '' }));
  eq(icons.map((i) => iconScore(i, 'heart')), [2, 1, 3, 0]);
  eq(iconScore({ name: 'arrow-right' }, 'arrow right'), 0);
});

// ---------- the sample Sigma Icons and the guide's icons page ----------
import { sampleIconsDocument, sampleIconId } from '../src/sample-icons.js';
import { welcomeDocument, WELCOME_ICONS } from '../src/welcome.js';
import { sampleTokenDocument } from '../src/sample-tokens.js';
import { snapshotForLibrary, resolveVariables } from '../src/variables.js';
import { loadDocument, walk } from '../src/store.js';
import { loadIconSet } from '../src/icon-library.js';

test('sample icons: the whole Lucide set, outline and filled, the guide’s icons in its groups', async () => {
  const lucide = await loadIconSet(ICON_SETS[0]);
  const doc = sampleIconsDocument(lucide);
  const ids = new Set(doc.icons.map((i) => i.id));
  eq(doc.icons.filter((i) => i.style === 'outline').length, lucide.icons.length, 'every Lucide icon');
  eq(ids.size, doc.icons.length, 'no icon twice');
  eq(doc.icons.find((i) => i.id === sampleIconId('trash')).group, 'Actions', 'the guide’s icons keep its groups');
  eq(doc.icons.find((i) => i.id === sampleIconId('pizza')).group, 'Food & beverage', 'the rest keep Lucide’s categories');
  ok(WELCOME_ICONS.every((id) => ids.has(id)), 'the guide’s icons are there');
  ok(doc.icons.some((i) => i.style === 'filled') && doc.icons.some((i) => i.style === 'outline'), 'both styles');
  const heart = doc.icons.find((i) => i.id === sampleIconId('heart', true));
  eq([heart.name, heart.group, heart.style, heart.strokeWidth], ['heart', 'Social', 'filled', 2]);
  ok(iconMarkup(heart, { color: '#FF0000' }).includes('fill="#FF0000" stroke="#FF0000" stroke-width="2"'), 'filled with its outline, so it keeps its size');
  eq(doc.source.license, 'ISC');
  eq(doc.published.icons.length, doc.icons.length);
});

test('Welcome to Sigma: the Sigma Icons page’s components and instances show sample icons', async () => {
  const icons = sampleIconsDocument(await loadIconSet(ICON_SETS[0])).published.icons;
  const tokens = sampleTokenDocument();
  const doc = welcomeDocument(tokens.collections, { icons });
  doc.libraries = [{ fileId: 'lib', name: tokens.name, version: 1, collections: snapshotForLibrary(tokens.collections, 'lib') }];
  doc.iconLibraries = [{ fileId: 'icons', name: 'Sigma Icons', version: 1, count: icons.length, icons }];
  loadDocument(doc);
  syncInstances();
  resolveVariables();
  const pg = state.doc.pages.find((p) => p.name === '10 Sigma Icons');
  ok(pg, 'page 10');
  const layers = [];
  walk(pg.children, (n) => void (n.type === 'icon' && layers.push(n)));
  ok(layers.length > 15, 'icons in components and instances');
  ok(layers.every((n) => findIcon(n.iconId)), 'every icon is a sample icon');
  const buttons = pg.children.find((n) => n.name === 'Icon buttons');
  const used = [];
  walk(buttons.children, (n) => void (n.type === 'icon' && used.push(n.iconId)));
  eq(used, ['search', 'pencil', 'copy', 'share-2', 'trash'].map((n) => sampleIconId(n)), 'each instance chose its icon');
  ok(layers.every((n) => /^#[0-9A-F]{6}/i.test(n.fills[0].color)), 'colors come from tokens');
});
