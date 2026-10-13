// Optics (Phases 36–37): a working design system that ships with Sigma, inspired by Shopify's Polaris.
//   Optics Foundations  color, typography, spacing, radius, elevation, motion and icons, as specimens built
//                       from the tokens themselves
//   Optics Components   every Polaris component (the web components and the older library's), a page each: the
//                       component with its variants, states and properties, documented and Ready, and its usage,
//                       a Do and a Don't; an Overview page lists them by category. Built by the modules in optics/.
// Every value comes from Optics Tokens (optics-tokens.js) and every icon from Optics Icons, so the
// files pass Sigma's own checks: the token audit, the use report, the accessibility check and readiness.
import { createNode, makePaint } from './store.js';
import { newIconsDocument } from './icon-library.js';
import { I, kit, ready, registry } from './optics/kit.js';
import { buildContent } from './optics/content.js';
import { buildActions } from './optics/actions.js';
import { buildFeedback } from './optics/feedback.js';
import { buildForms, buildIndexFilters } from './optics/forms.js';
import { buildLayout } from './optics/layout.js';
import { buildNavigation } from './optics/navigation.js';
import { buildLists } from './optics/lists.js';
import { buildOverlays } from './optics/overlays.js';

export const OPTICS_FOUNDATIONS_NAME = 'Optics Foundations';
export const OPTICS_COMPONENTS_NAME = 'Optics Components';
export const OPTICS_ICONS_NAME = 'Optics Icons';
// The icons Optics' components use (all in Sigma Icons, so in Optics Icons; a test keeps this list complete).
export const OPTICS_ICON_NAMES = [
  'arrow-down', 'arrow-left', 'arrow-up-down', 'calendar', 'chart-column', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'circle-alert', 'circle-check', 'circle-question-mark', 'copy', 'ellipsis', 'eye', 'house', 'image', 'inbox', 'info', 'loader', 'mail', 'minus', 'palette', 'pencil', 'play', 'plus', 'search', 'settings', 'share-2', 'star', 'store', 'tag', 'trash', 'triangle-alert', 'truck', 'upload', 'users', 'x',
];
export const OPTICS_ICONS = OPTICS_ICON_NAMES.map((n) => I(n));
// The categories, in the order the Overview lists them.
export const OPTICS_CATEGORIES = ['Actions', 'Feedback and status', 'Forms', 'Layout and structure', 'Lists and tables', 'Media and visuals', 'Navigation', 'Overlays', 'Typography and content', 'Utilities'];

/** Optics Icons: a Sigma Icons file made from the Sigma Icons sample's icons (the whole Lucide set, outline and filled), published v1. */
export function opticsIconsDocument(sampleIcons, source = null) {
  const doc = newIconsDocument(OPTICS_ICONS_NAME);
  doc.icons = sampleIcons.map((icon) => ({ ...structuredClone(icon), id: I(icon.name, icon.style === 'filled') }));
  if (source) doc.source = { ...structuredClone(source), note: 'Optics’ icons: the whole Lucide set from Sigma Icons, outline and filled.' };
  doc.published = { version: 1, publishedAt: Date.now(), notes: 'Optics Icons v1', icons: structuredClone(doc.icons) };
  return doc;
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const codeNameOf = (name) => name.replace(/(^|\s)(\w)/g, (_, s, c) => c.toUpperCase());

/** Every Optics component, built and registered in dependency order: [{ name, category, node, extra, info, usage }]. */
export function opticsComponents(collections) {
  const K = kit(collections);
  const R = registry();
  buildContent(K, R);
  buildActions(K, R);
  buildFeedback(K, R);
  buildForms(K, R);
  buildLayout(K, R);
  buildNavigation(K, R);
  buildIndexFilters(K, R);
  buildLists(K, R);
  buildOverlays(K, R);
  return { K, list: R.list };
}

// ---------- Optics Components ----------
export function opticsComponentsDocument(collections) {
  const { K, list } = opticsComponents(collections);
  const { text, para, frame } = K;

  // A Do or Don't example: the verdict, a caption, and the example itself.
  const example = (name, doIt, [caption, make]) => frame(`${name} · ${doIt ? 'Do' : 'Don’t'}`, { dir: 'vertical', gap: '300', pad: '600', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', props: { minW: 360 } }, [
    text('Verdict', doIt ? 'Do' : 'Don’t', doIt ? 'text/success' : 'text/critical', 'heading/xs'),
    para('Caption', caption, 'text/secondary', 'body/md', { w: 320 }),
    frame('Example', { dir: 'horizontal', gap: '200', alignC: 'center' }, make()),
  ]);
  const section = (title, children, o = {}) => frame(title, { dir: 'vertical', gap: '400', ...o }, [text('Heading', title, 'text/default', 'heading/lg'), ...children]);

  // A page per component: its name and purpose, the component (and its parts), and its usage.
  const pages = list.map((e) => {
    const dos = example(e.name, true, e.usage.do), donts = example(e.name, false, e.usage.dont);
    const docs = { ...e.info, code: `components/${codeNameOf(e.name)}`, dos: [dos.id], donts: [donts.id] };
    ready(e.node, { codeName: codeNameOf(e.name), docs, a11y: e.a11y || null });
    for (const x of e.extra || []) ready(x.node, { codeName: x.codeName, docs: { ...docs, ...x.info, code: docs.code } });
    const sheet = frame(e.name, { dir: 'vertical', gap: '1000', pad: '1200', fill: 'bg/surface/default', radius: '400' }, [
      frame('Header', { dir: 'vertical', gap: '200', w: 720 }, [
        text('Category', e.category, 'text/secondary', 'body/sm-medium'),
        text('Title', e.name, 'text/default', 'heading/2xl', { a11y: { heading: 1 } }),
        para('Purpose', e.info.purpose, 'text/secondary', 'body/lg'),
      ]),
      section('Component', [e.node, ...(e.extra || []).map((x) => x.node)]),
      section('Guidelines', [
        para('Usage', e.info.usage, 'text/default', 'body/md', { w: 720, sizingH: 'fixed' }),
        para('Not for', `Not for: ${e.info.notFor}`, 'text/secondary', 'body/md', { w: 720, sizingH: 'fixed' }),
        para('Accessibility', `Keyboard and screen readers: ${e.info.keyboard}`, 'text/secondary', 'body/md', { w: 720, sizingH: 'fixed' }),
      ]),
      section('Usage', [frame('Examples', { dir: 'horizontal', gap: '600' }, [dos, donts])]),
    ]);
    return { id: `optics-c-${slug(e.name)}`, name: e.name, background: '#F1F1F1', children: [Object.assign(sheet, { x: 0, y: 0 })] };
  });

  // The Overview: every component by category, with what it's for.
  const byCategory = OPTICS_CATEGORIES.map((c) => [c, list.filter((e) => e.category === c)]).filter(([, l]) => l.length);
  const overview = frame('Optics Components', { dir: 'vertical', gap: '1000', pad: '1200', fill: 'bg/surface/default', radius: '400' }, [
    frame('Header', { dir: 'vertical', gap: '200', w: 720 }, [
      text('Title', 'Optics Components', 'text/default', 'heading/2xl', { a11y: { heading: 1 } }),
      para('Intro', `${list.length} components, inspired by Shopify’s Polaris, each on its own page with its variants, states and usage. Every value comes from Optics Tokens and every icon from Optics Icons.`, 'text/secondary', 'body/lg'),
    ]),
    ...byCategory.map(([c, l]) => section(c, l.map((e) => frame(e.name, { dir: 'horizontal', gap: '600', w: 960 }, [
      frame('Name', { dir: 'vertical', w: 240 }, [text('Name', e.name, 'text/default', 'body/md-semibold')]),
      para('Purpose', e.info.purpose, 'text/secondary', 'body/md'),
    ])), { gap: '300' })),
  ]);
  pages.unshift({ id: 'optics-overview', name: 'Overview', background: '#F1F1F1', children: [Object.assign(overview, { x: 0, y: 0 })] });
  return { name: OPTICS_COMPONENTS_NAME, pages, currentPageId: pages[0].id };
}

// ---------- Optics Foundations ----------
export function opticsFoundationsDocument(collections, { icons = [] } = {}) {
  const K = kit(collections);
  const { text, para, icon, box, frame, modeOf } = K;
  const prim = collections.find((c) => c.name === 'Primitives');
  const sem = collections.find((c) => c.name === 'Semantic');
  const typo = collections.find((c) => c.name === 'Typography');
  const value = (v) => Object.values(v.valuesByMode)[0];
  const sheet = (title, intro, sections, o = {}) => frame(title, { dir: 'vertical', gap: '1000', pad: '1200', fill: 'bg/surface/default', radius: '400', ...o }, [
    box('frame', 'Header', { dir: 'vertical', gap: '200', w: 720 }, [
      text('Title', title, 'text/default', 'heading/2xl'),
      para('Intro', intro, 'text/secondary', 'body/lg'),
    ]),
    ...sections,
  ]);
  const section = (title, children, o = {}) => box('frame', title, { dir: 'vertical', gap: '400', ...o }, [text('Heading', title, 'text/default', 'heading/lg'), ...children]);
  const label = (name, value2 = null) => box('frame', 'Label', { dir: 'vertical', gap: '050' }, [
    text('Name', name, 'text/default', 'body/sm-medium'), ...(value2 !== null ? [text('Value', String(value2), 'text/secondary', 'body/sm')] : []),
  ]);
  const page = (id, name, child) => ({ id, name, background: '#F1F1F1', children: [Object.assign(child, { x: 0, y: 0 })] });

  // ---------- Color ----------
  const scales = {};
  for (const v of prim.variables.filter((x) => x.type === 'color')) {
    const [, hue, step] = v.name.split('/');
    (scales[hue] ||= []).push({ step, v });
  }
  const palette = Object.entries(scales).map(([hue, steps]) => box('frame', hue, { dir: 'horizontal', gap: '300', alignC: 'center' }, [
    box('frame', 'Hue', { w: 96, dir: 'vertical' }, [text('Name', hue, 'text/default', 'body/md-semibold')]),
    ...steps.map(({ step, v }) => box('frame', `color/${hue}/${step}`, { dir: 'vertical', gap: '100', w: 64 }, [
      Object.assign(box('frame', 'Swatch', { w: 64, h: 48, radius: '200', stroke: 'border/default' }), {
        fills: [makePaint('#000000')], bindings: { ...{}, 'fills.0.color': v.id, radius: K.P('radius/200'), 'strokes.0.color': K.S('border/default') },
      }),
      label(step, String(value(v)).toUpperCase()),
    ])),
  ]));
  // Semantic roles in one mode: backgrounds and borders as swatches, text and icons as samples on their surface.
  const roles = (modeName) => {
    const of = (prefix) => sem.variables.filter((v) => v.type === 'color' && v.name.startsWith(prefix));
    const swatchRow = (v) => box('frame', v.name, { dir: 'horizontal', gap: '200', alignC: 'center' }, [
      Object.assign(box('frame', 'Swatch', { w: 32, h: 32, radius: '200', stroke: 'border/default' }), { fills: [makePaint('#000000')], bindings: { 'fills.0.color': v.id, radius: K.P('radius/200'), 'strokes.0.color': K.S('border/default') } }),
      text('Name', v.name, 'text/default', 'body/sm'),
    ]);
    // Text samples sit on the surface they're for, so their contrast is real.
    const surfaceFor = (name) => {
      const tone = name.split('/')[1];
      if (name === 'text/on-fill' || name === 'icon/on-fill') return 'bg/fill/brand';
      if (name.endsWith('/inverse')) return 'bg/surface/inverse';
      if (['critical', 'success', 'warning', 'caution', 'info', 'magic'].includes(tone)) return `bg/surface/${tone}`;
      return 'bg/surface/default';
    };
    const textRow = (v) => box('frame', v.name, { dir: 'horizontal', gap: '200', alignC: 'center' }, [
      box('frame', 'Sample', { dir: 'horizontal', px: '200', py: '100', radius: '200', fill: surfaceFor(v.name), stroke: 'border/default' }, [
        Object.assign(text('Aa', 'Aa', 'text/default', 'body/md-semibold'), { bindings: { 'fills.0.color': v.id, typography: K.T('body/md-semibold') } }),
      ]),
      text('Name', v.name, 'text/default', 'body/sm'),
    ]);
    const column = (title, rows) => box('frame', title, { dir: 'vertical', gap: '200', w: 260 }, [text('Heading', title, 'text/default', 'heading/xs'), ...rows]);
    return frame(modeName, { dir: 'vertical', gap: '400', pad: '600', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', modes: modeOf(modeName) }, [
      text('Mode', modeName, 'text/default', 'heading/md'),
      box('frame', 'Roles', { dir: 'horizontal', gap: '600' }, [
        column('Backgrounds', of('bg/').map(swatchRow)),
        column('Text', of('text/').map(textRow)),
        column('Borders', of('border/').map(swatchRow)),
        column('Icons', of('icon/').map(swatchRow)),
      ]),
    ]);
  };
  const color = sheet('Color', 'Optics colors come in two layers. Primitives are the palette; Semantic tokens say what a color is for (a surface, critical text, the focus ring) and change with Light and Dark. Designs only use Semantic tokens.', [
    section('Palette', palette),
    section('Semantic roles', [roles('Light'), roles('Dark')]),
  ]);

  // ---------- Typography ----------
  const typeRows = typo.variables.map((v) => {
    const val = value(v);
    const prim2 = (f) => {
      const a = val[f]?.alias;
      return a ? value(prim.variables.find((x) => x.id === a)) : val[f];
    };
    return box('frame', v.name, { dir: 'horizontal', gap: '600', alignC: 'center' }, [
      box('frame', 'Spec', { dir: 'vertical', gap: '050', w: 200 }, [
        text('Name', v.name, 'text/default', 'body/md-semibold'),
        text('Values', `${prim2('fontSize')}px · ${prim2('lineHeight')}% · ${prim2('fontWeight')}`, 'text/secondary', 'body/sm'),
      ]),
      Object.assign(text('Sample', 'Sell anywhere, from one place', 'text/default', 'body/md'), { bindings: { 'fills.0.color': K.S('text/default'), typography: v.id } }),
    ]);
  });
  const type = sheet('Typography', 'Text styles combine a font, size, weight, line height and letter spacing. Headings title pages and sections; body styles carry text and controls. Optics uses Inter.', [section('Text styles', typeRows)]);

  // ---------- Spacing and radius ----------
  const spaceRows = prim.variables.filter((v) => v.name.startsWith('space/') && value(v) > 0).map((v) => box('frame', v.name, { dir: 'horizontal', gap: '400', alignC: 'center' }, [
    box('frame', 'Spec', { dir: 'vertical', w: 160 }, [label(v.name, `${value(v)}px`)]),
    Object.assign(box('frame', 'Bar', { h: 16, fill: 'bg/fill/brand', radius: '100' }), { bindings: { 'fills.0.color': K.S('bg/fill/brand'), radius: K.P('radius/100'), 'layout.pl': v.id } }),
  ]));
  const spacing = sheet('Spacing', 'Spacing is a 4px grid. A step’s name is in hundredths of 4px: space/100 is 4px, space/400 is 16px. Use it for padding and gaps.', [section('Scale', spaceRows)]);
  const radiusTiles = prim.variables.filter((v) => v.name.startsWith('radius/')).map((v) => box('frame', v.name, { dir: 'vertical', gap: '200', alignC: 'center' }, [
    Object.assign(box('frame', 'Tile', { w: 72, h: 72, fill: 'bg/surface/selected', stroke: 'border/brand' }), { bindings: { 'fills.0.color': K.S('bg/surface/selected'), 'strokes.0.color': K.S('border/brand'), radius: v.id } }),
    label(v.name, value(v) === 9999 ? 'full' : `${value(v)}px`),
  ]));
  const radius = sheet('Radius', 'Corner radii, from square to fully round. Controls use radius/200; cards radius/300; dialogs radius/400.', [section('Scale', [box('frame', 'Tiles', { dir: 'horizontal', gap: '600' }, radiusTiles)])]);

  // ---------- Elevation ----------
  const shadows = sem.variables.filter((v) => v.type === 'shadow');
  const elevationRow = (modeName) => frame(`Elevation · ${modeName}`, { dir: 'horizontal', gap: '800', pad: '800', fill: 'bg/page', radius: '300', modes: modeOf(modeName) },
    shadows.map((v) => {
      const card = box('frame', v.name, { w: 140, h: 96, pad: '300', fill: 'bg/surface/default', radius: '300', shadow: '100' }, [text('Name', v.name, 'text/default', 'body/sm-medium')]);
      card.bindings['effects.0'] = v.id; // this level's shadow
      return card;
    }));
  const elevation = sheet('Elevation', 'Shadows lift surfaces off the page: shadow/100 for cards, 300 for menus and tooltips, 600 for dialogs. Dark mode uses darker shadows, so they still show.', [section('Light', [elevationRow('Light')]), section('Dark', [elevationRow('Dark')])]);

  // ---------- Motion ----------
  const motionRows = prim.variables.filter((v) => v.type === 'duration' || v.type === 'easing').map((v) => box('frame', v.name, { dir: 'horizontal', gap: '400', alignC: 'center' }, [
    box('frame', 'Spec', { dir: 'vertical', w: 200 }, [label(v.name, v.type === 'duration' ? `${value(v)}ms` : `cubic-bezier(${value(v).join(', ')})`)]),
    para('Use', v.description || (v.type === 'duration' ? (value(v) <= 100 ? 'Hover and press feedback.' : value(v) <= 250 ? 'Menus, tooltips and small movements.' : 'Dialogs and large movements.') : ''), 'text/secondary', 'body/sm', { w: 360, sizingH: 'fixed' }),
  ]));
  const motion = sheet('Motion', 'Durations and easing curves for transitions. Small changes are fast; big movements take longer. Respect reduced motion: skip movement, keep the change.', [section('Durations and easing', motionRows)]);

  // ---------- Icons ----------
  const groups = {};
  for (const ic of icons.filter((x) => x.style === 'outline')) (groups[ic.group] ||= []).push(ic);
  // A row of examples per group (the whole set is in Optics Icons, with search). Each is an instance of an Icon
  // tile component (icons go inside main components), choosing its icon and name.
  const SHOWN = 12;
  const tileIcon = 'optics-tile-icon', tileName = 'optics-tile-name';
  const first = icons.find((x) => x.style === 'outline');
  const tile = first && box('component', 'Icon tile', { dir: 'vertical', gap: '100', w: 112, pad: '200', alignC: 'center', radius: '200', stroke: 'border/default' }, [
    icon('Icon', first.id, 'icon/default', 24, { propRefs: { iconId: tileIcon } }),
    text('Name', first.name, 'text/secondary', 'body/sm', { propRefs: { text: tileName } }),
  ]);
  if (tile) {
    tile.props = { [tileIcon]: { name: 'Icon', type: 'icon', default: first.id }, [tileName]: { name: 'Name', type: 'text', default: first.name } };
    tile.description = 'One icon and its name, for the Icons page.';
  }
  const tileOf = (ic) => createNode('instance', { name: ic.name, componentId: tile.id, w: tile.w, h: tile.h, overrides: {}, children: [], propValues: { [tileIcon]: ic.id, [tileName]: ic.name } });
  const iconRows = Object.entries(groups).map(([g, list]) => box('frame', g, { dir: 'vertical', gap: '200' }, [
    text('Group', list.length > SHOWN ? `${g} · ${list.length} icons` : g, 'text/default', 'heading/xs'),
    box('frame', 'Icons', { dir: 'horizontal', gap: '200' }, list.slice(0, SHOWN).map(tileOf)),
  ]));
  const total = icons.filter((x) => x.style === 'outline').length;
  const iconSheet = sheet('Icons', `Optics Icons is the whole Lucide set from Sigma Icons: ${total.toLocaleString()} outline icons, 24px with a 2px stroke, colored with the icon tokens. Here are some from each group; open Optics Icons to see and search them all. Pick icons people already know, and name icon-only controls for screen readers.`,
    iconRows.length ? [section('Icon tile', [tile]), section('Optics Icons', iconRows)] : [para('None', 'Optics Icons couldn’t be made, so this page has no icons.', 'text/secondary', 'body/md')]);

  const pages = [
    page('optics-color', 'Color', color), page('optics-typography', 'Typography', type), page('optics-spacing', 'Spacing', spacing),
    page('optics-radius', 'Radius', radius), page('optics-elevation', 'Elevation', elevation), page('optics-motion', 'Motion', motion),
    page('optics-icons', 'Icons', iconSheet),
  ];
  return { name: OPTICS_FOUNDATIONS_NAME, pages, currentPageId: pages[0].id };
}
