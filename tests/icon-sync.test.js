// Icons between code and Sigma (src/icon-sync.js).
import { test, eq, ok } from './harness.js';
import { iconsFromFiles, mergeIcons, iconChanges, iconSVG, svgStyleOf, sameIcon, iconFilePath } from '../src/icon-sync.js';
import { parseSVGIcon } from '../src/icon-library.js';

const LUCIDE_STYLE = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 12h14" />
  <path d="m12 5 7 7-7 7" />
</svg>
`;

test('icon sync: a folder becomes icons named after their files, grouped by their folders', () => {
  const { icons, skipped } = iconsFromFiles([
    { path: 'arrows/arrow-right.svg', text: LUCIDE_STYLE },
    { path: 'logo.svg', text: '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#f00"/></svg>' },
    { path: 'broken.svg', text: '<svg><text>x</text></svg>' },
    { path: 'readme.md', text: '#' },
  ]);
  eq(icons.map((i) => [i.id, i.group, i.name, i.style]), [['logo', '', 'logo', 'filled'], ['arrows-arrow-right', 'arrows', 'arrow-right', 'outline']]);
  eq(skipped.map((s) => s.path), ['broken.svg']);
  eq(iconFilePath(icons[1]), 'arrows/arrow-right.svg');
});

test('icon sync: importing again changes nothing; new icons are added, Sigma-only icons are kept unless pruned', () => {
  const first = iconsFromFiles([{ path: 'arrows/arrow-right.svg', text: LUCIDE_STYLE }]).icons;
  const { icons } = mergeIcons([], first);
  icons[0].keywords = 'next';
  const again = mergeIcons(icons, iconsFromFiles([{ path: 'arrows/arrow-right.svg', text: LUCIDE_STYLE }]).icons);
  eq([again.report.added, again.report.changed, again.icons[0].keywords], [[], [], 'next']);
  const thinner = LUCIDE_STYLE.replace('stroke-width="2"', 'stroke-width="1.5"');
  eq(mergeIcons(icons, iconsFromFiles([{ path: 'arrows/arrow-right.svg', text: thinner }]).icons).report.changed, ['arrows/arrow-right']);
  const extra = [...icons, { ...icons[0], id: 'mine', name: 'mine' }];
  eq(mergeIcons(extra, first).report.onlyInSigma, ['arrows/mine']);
  eq(mergeIcons(extra, first, { prune: true }).icons.map((i) => i.name), ['arrow-right']);
});

test('icon sync: written files keep the project’s style, so a change shows only where it changed', () => {
  const icon = parseSVGIcon(LUCIDE_STYLE, { name: 'arrow-right' });
  eq(iconSVG(icon, { style: svgStyleOf(LUCIDE_STYLE) }), LUCIDE_STYLE, 'written back exactly as it was');
  const thinner = { ...icon, strokeWidth: 1.5 };
  const out = iconSVG(thinner, { style: svgStyleOf(LUCIDE_STYLE) });
  eq(out.split('\n').filter((l, i) => l !== LUCIDE_STYLE.split('\n')[i]), ['  stroke-width="1.5"']);
  ok(sameIcon(parseSVGIcon(out), thinner), 'and it reads back as the same icon');
  ok(iconSVG(icon).startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="24"'), 'one line without a style to follow');
  const filled = { ...icon, style: 'filled', strokeWidth: 0 };
  ok(iconSVG(filled).includes('fill="currentColor"') && !iconSVG(filled).includes('stroke='), 'filled icons have no stroke');
});

test('icon sync: changes between two versions', () => {
  const a = [{ id: 'x', name: 'x', group: '', viewBox: '0 0 24 24', style: 'outline', body: '<path d="M0 0"/>' }, { id: 'y', name: 'y', group: '', viewBox: '0 0 24 24', style: 'outline', body: '' }];
  const b = [{ ...a[0], body: '<path d="M1 1"/>' }, { id: 'z', name: 'z', group: 'g', viewBox: '0 0 24 24', style: 'filled', body: '' }];
  eq(iconChanges(a, b).map((c) => `${c.change} ${c.name}`), ['changed x', 'added z', 'removed y']);
});
