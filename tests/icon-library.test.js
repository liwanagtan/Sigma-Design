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
