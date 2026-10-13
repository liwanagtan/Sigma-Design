// The sample token file: a small but complete design system, showing what token files can do.
//
//   Primitives  raw values: a color palette (with transparent colors), spacing, radii, type scales, motion, text
//   Semantic    what colors and shadows mean, in Light and Dark modes; every value points at a primitive
//   Brand B     an extension of Semantic that only changes the accent colors
//   Typography  text styles whose parts point at the type primitives
//   Components  tokens for buttons, inputs and cards, pointing at semantic tokens (three levels deep)
import { uid } from './store.js';
import { normalizeGroups } from './token-groups.js';

export const ref = (id) => ({ alias: id });
export const modes = (...values) => ({ perMode: values }); // a different value in each mode, in order

export function collection(name, modeNames) {
  const ms = modeNames.map((n) => ({ id: uid(), name: n }));
  return { id: uid(), name, modes: ms, defaultModeId: ms[0].id, variables: [], groups: [] };
}

export function group(col, name, parentId = null, description = '') {
  const g = { id: uid(), name, parentId };
  if (description) g.description = description;
  col.groups.push(g);
  return g.id;
}

export function token(col, groupId, name, type, value, description = '') {
  const v = { id: uid(), name, type, valuesByMode: {} };
  if (groupId) v.groupId = groupId;
  if (description) v.description = description;
  col.modes.forEach((m, i) => {
    const x = value?.perMode ? value.perMode[i] ?? value.perMode[0] : value;
    v.valuesByMode[m.id] = structuredClone(x);
  });
  col.variables.push(v);
  return v.id;
}

export function sampleTokenDocument() {
  // ---------- Primitives ----------
  const p = collection('Primitives', ['Value']);
  const color = group(p, 'color', null, 'The raw palette. Designs should use the Semantic tokens, which point here.');
  const palette = {};
  const scale = (name, steps, description = '') => {
    const g = group(p, name, color, description);
    palette[name] = {};
    for (const [step, hex] of Object.entries(steps)) palette[name][step] = token(p, g, step, 'color', hex);
  };
  scale('gray', {
    0: '#FFFFFF', 50: '#F7F7F8', 100: '#EEEFF1', 200: '#DCDEE3', 300: '#BFC3CB', 400: '#9AA0AB',
    500: '#767D8A', 600: '#5A616D', 700: '#434852', 800: '#2C3038', 900: '#1A1D22', 1000: '#0E1013',
  }, 'Neutrals for text, surfaces and borders.');
  scale('blue', { 100: '#E5F3FF', 200: '#BDE0FF', 300: '#85C6FF', 400: '#47A8FF', 500: '#0D99FF', 600: '#007BE5', 700: '#0062B8', 800: '#004A8A' });
  scale('violet', { 100: '#F1E8FF', 300: '#C9A3FF', 400: '#B07AFF', 500: '#9747FF', 600: '#7B2EE6', 700: '#6020BF', 800: '#3F1580' });
  scale('green', { 100: '#E3F9EA', 400: '#3DCB7E', 500: '#14AE5C', 700: '#0A6E39' });
  scale('amber', { 100: '#FFF4D6', 400: '#FFC933', 500: '#FFB800', 700: '#9E6A00' });
  scale('red', { 100: '#FFE8E6', 400: '#FF7559', 500: '#F24822', 700: '#A82A12' });
  scale('alpha', { 'black-10': '#0000001A', 'black-40': '#00000066', 'white-10': '#FFFFFF1A', 'white-60': '#FFFFFF99' },
    'Colors with opacity, for shadows, overlays and scrims.');

  const space = group(p, 'space', null, 'A 4-point spacing scale: the name is the number of 4px steps.');
  const sp = {};
  for (const [k, px] of [[0, 0], [1, 4], [2, 8], [3, 12], [4, 16], [5, 20], [6, 24], [8, 32], [10, 40], [12, 48], [16, 64]]) sp[k] = token(p, space, String(k), 'number', px);

  const layout = group(p, 'layout', null, 'The column grid pages are laid out on. Its gutter and margin come from the spacing scale.');
  token(p, layout, 'columns', 'number', 12);
  token(p, layout, 'gutter', 'number', ref(sp[6]));
  token(p, layout, 'margin', 'number', ref(sp[8]));

  const radius = group(p, 'radius', null, 'Corner radii.');
  const rad = {};
  for (const [k, px] of [['none', 0], ['sm', 4], ['md', 8], ['lg', 12], ['xl', 16], ['full', 9999]]) rad[k] = token(p, radius, k, 'number', px);

  const border = group(p, 'border-width');
  token(p, border, 'thin', 'number', 1);
  token(p, border, 'thick', 'number', 2);

  const font = group(p, 'font', null, 'Type primitives. The Typography collection combines them into text styles.');
  const fam = group(p, 'family', font);
  const family = { sans: token(p, fam, 'sans', 'string', 'Inter'), mono: token(p, fam, 'mono', 'string', 'JetBrains Mono'), display: token(p, fam, 'display', 'string', 'Space Grotesk') };
  const sizes = group(p, 'size', font);
  const size = {};
  for (const [k, px] of [['xs', 12], ['sm', 14], ['md', 16], ['lg', 20], ['xl', 24], ['2xl', 32], ['3xl', 40]]) size[k] = token(p, sizes, k, 'number', px);
  const weights = group(p, 'weight', font);
  const weight = {};
  for (const [k, w] of [['regular', 400], ['medium', 500], ['semibold', 600], ['bold', 700]]) weight[k] = token(p, weights, k, 'number', w);
  const lines = group(p, 'line-height', font, 'Percent of the font size.');
  const line = { tight: token(p, lines, 'tight', 'number', 120), normal: token(p, lines, 'normal', 'number', 150) };
  const tracks = group(p, 'letter-spacing', font);
  const track = { tight: token(p, tracks, 'tight', 'number', -0.5), normal: token(p, tracks, 'normal', 'number', 0), wide: token(p, tracks, 'wide', 'number', 0.5) };

  const opacity = group(p, 'opacity');
  token(p, opacity, 'disabled', 'number', 40, 'Opacity of disabled controls, in percent.');

  const motion = group(p, 'motion', null, 'Durations and easing curves for transitions and animations.');
  const durations = group(p, 'duration', motion, 'Short for small elements and short distances, longer for big ones.');
  const dur = { fast: token(p, durations, 'fast', 'duration', 100), normal: token(p, durations, 'normal', 'duration', 200), slow: token(p, durations, 'slow', 'duration', 300) };
  const easings = group(p, 'easing', motion);
  const ease = {
    standard: token(p, easings, 'standard', 'easing', [0.2, 0, 0, 1], 'Most transitions.'),
    enter: token(p, easings, 'enter', 'easing', [0, 0, 0, 1], 'Elements coming into view.'),
    exit: token(p, easings, 'exit', 'easing', [0.3, 0, 1, 1], 'Elements leaving the view.'),
  };

  const content = group(p, 'content', null, 'Text that appears in products.');
  token(p, content, 'product-name', 'string', 'Sigma');
  token(p, content, 'tagline', 'string', 'Design on an infinite canvas');
  token(p, null, 'rounded-corners', 'boolean', true, 'A top-level token: no group needed.');

  const g = palette.gray, b = palette.blue;

  // ---------- Semantic ----------
  const s = collection('Semantic', ['Light', 'Dark']);
  const surface = group(s, 'surface', null, 'Backgrounds, from the page up.');
  token(s, surface, 'page', 'color', modes(ref(g[50]), ref(g[1000])));
  const surfaceDefault = token(s, surface, 'default', 'color', modes(ref(g[0]), ref(g[900])));
  const raised = token(s, surface, 'raised', 'color', modes(ref(g[0]), ref(g[800])), 'Cards, menus and popovers.');
  token(s, surface, 'sunken', 'color', modes(ref(g[100]), ref(g[1000])));
  token(s, surface, 'overlay', 'color', modes(ref(palette.alpha['black-40']), ref(palette.alpha['black-40'])), 'The scrim behind dialogs.');

  const text = group(s, 'text');
  const tPrimary = token(s, text, 'primary', 'color', modes(ref(g[900]), ref(g[0])));
  const tSecondary = token(s, text, 'secondary', 'color', modes(ref(g[600]), ref(g[400])));
  token(s, text, 'disabled', 'color', modes(ref(g[400]), ref(g[600])));
  token(s, text, 'link', 'color', modes(ref(b[600]), ref(b[400])));
  const onAccent = token(s, text, 'on-accent', 'color', ref(g[0]), 'Text on accent backgrounds.');

  const borderG = group(s, 'border');
  const bDefault = token(s, borderG, 'default', 'color', modes(ref(g[200]), ref(g[700])));
  const bStrong = token(s, borderG, 'strong', 'color', modes(ref(g[400]), ref(g[500])));
  const bFocus = token(s, borderG, 'focus', 'color', modes(ref(b[500]), ref(b[400])));

  const accent = group(s, 'accent', null, 'The brand color and its states. Brand B changes only these.');
  const aDefault = token(s, accent, 'default', 'color', modes(ref(b[500]), ref(b[400])));
  const aHover = token(s, accent, 'hover', 'color', modes(ref(b[600]), ref(b[300])));
  const aPressed = token(s, accent, 'pressed', 'color', modes(ref(b[700]), ref(b[200])));
  const aSubtle = token(s, accent, 'subtle', 'color', modes(ref(b[100]), ref(b[800])));

  const status = group(s, 'status', null, 'Feedback colors.');
  for (const [name, hue] of [['success', 'green'], ['warning', 'amber'], ['danger', 'red']]) {
    const sg = group(s, name, status);
    token(s, sg, 'default', 'color', modes(ref(palette[hue][500]), ref(palette[hue][400])));
    token(s, sg, 'subtle', 'color', modes(ref(palette[hue][100]), ref(palette[hue][700])));
  }

  const elevation = group(s, 'elevation', null, 'Shadows that lift surfaces off the page; darker in Dark mode, where light shadows don’t show.');
  const raisedShadow = token(s, elevation, 'raised', 'shadow',
    modes({ color: ref(palette.alpha['black-10']), x: 0, y: 2, blur: 8, spread: 0 }, { color: ref(palette.alpha['black-40']), x: 0, y: 2, blur: 8, spread: 0 }),
    'Cards and other raised surfaces.');
  token(s, elevation, 'overlay', 'shadow',
    modes({ color: ref(palette.alpha['black-10']), x: 0, y: 12, blur: 32, spread: -4 }, { color: ref(palette.alpha['black-40']), x: 0, y: 12, blur: 32, spread: -4 }),
    'Menus, popovers and dialogs.');

  // Colors meant to be used together, checked for contrast in every mode (see the token inspector).
  const pair = (fg, ...bgs) => (s.variables.find((v) => v.id === fg).contrastWith = bgs);
  pair(tPrimary, surfaceDefault, raised);
  pair(tSecondary, surfaceDefault, raised);
  pair(onAccent, aDefault, aHover);

  // ---------- Brand B: Semantic with a violet accent ----------
  const brand = {
    id: uid(), name: 'Brand B', extends: s.id, variables: [], overrides: {},
    modes: s.modes.map((m) => ({ id: uid(), name: m.name, parentModeId: m.id })),
  };
  brand.defaultModeId = brand.modes[0].id;
  const v = palette.violet;
  for (const [id, light, dark] of [[aDefault, v[500], v[400]], [aHover, v[600], v[300]], [aPressed, v[700], v[300]], [aSubtle, v[100], v[800]]]) {
    brand.overrides[id] = { [brand.modes[0].id]: ref(light), [brand.modes[1].id]: ref(dark) };
  }

  // ---------- Typography ----------
  const t = collection('Typography', ['Default']);
  const style = (groupId, name, fam, sz, wt, lh, ls, description) => token(t, groupId, name, 'typography', {
    fontFamily: ref(family[fam]), fontWeight: ref(weight[wt]), fontSize: ref(size[sz]), lineHeight: ref(line[lh]), letterSpacing: ref(track[ls]),
  }, description);
  const heading = group(t, 'heading');
  style(heading, 'display', 'display', '3xl', 'bold', 'tight', 'tight', 'Hero titles.');
  style(heading, 'h1', 'sans', '2xl', 'bold', 'tight', 'tight');
  style(heading, 'h2', 'sans', 'xl', 'semibold', 'tight', 'normal');
  style(heading, 'h3', 'sans', 'lg', 'semibold', 'normal', 'normal');
  const body = group(t, 'body');
  style(body, 'default', 'sans', 'md', 'regular', 'normal', 'normal');
  style(body, 'small', 'sans', 'sm', 'regular', 'normal', 'normal');
  style(body, 'strong', 'sans', 'md', 'semibold', 'normal', 'normal');
  const label = group(t, 'label');
  const labelDefault = style(label, 'default', 'sans', 'sm', 'medium', 'normal', 'wide', 'Buttons and form labels.');
  style(label, 'small', 'sans', 'xs', 'medium', 'normal', 'wide');
  style(null, 'code', 'mono', 'sm', 'regular', 'normal', 'normal');

  // ---------- Components ----------
  const c = collection('Components', ['Default']);
  const button = group(c, 'button', null, 'Button tokens point at Semantic tokens, which point at Primitives.');
  const primary = group(c, 'primary', button);
  token(c, primary, 'background', 'color', ref(aDefault));
  token(c, primary, 'background-hover', 'color', ref(aHover));
  token(c, primary, 'background-pressed', 'color', ref(aPressed));
  token(c, primary, 'text', 'color', ref(onAccent));
  const secondary = group(c, 'secondary', button);
  token(c, secondary, 'background', 'color', ref(surfaceDefault));
  token(c, secondary, 'border', 'color', ref(bStrong));
  token(c, secondary, 'text', 'color', ref(tPrimary));
  token(c, button, 'radius', 'number', ref(rad.md));
  token(c, button, 'padding-x', 'number', ref(sp[4]));
  token(c, button, 'padding-y', 'number', ref(sp[2]));
  token(c, button, 'gap', 'number', ref(sp[2]));
  token(c, button, 'label', 'typography', ref(labelDefault));
  token(c, button, 'transition-duration', 'duration', ref(dur.fast), 'Hover and press feedback.');
  token(c, button, 'transition-easing', 'easing', ref(ease.standard));

  const input = group(c, 'input');
  token(c, input, 'background', 'color', ref(surfaceDefault));
  token(c, input, 'border', 'color', ref(bDefault));
  token(c, input, 'border-focus', 'color', ref(bFocus));
  token(c, input, 'text', 'color', ref(tPrimary));
  token(c, input, 'placeholder', 'color', ref(tSecondary));
  token(c, input, 'radius', 'number', ref(rad.sm));
  token(c, input, 'padding', 'number', ref(sp[3]));

  const card = group(c, 'card');
  token(c, card, 'background', 'color', ref(raised));
  token(c, card, 'border', 'color', ref(bDefault));
  token(c, card, 'shadow', 'shadow', ref(raisedShadow));
  token(c, card, 'radius', 'number', ref(rad.lg));
  token(c, card, 'padding', 'number', ref(sp[6]));

  const collections = [p, s, brand, t, c];
  for (const col of collections) normalizeGroups(col); // token names become full paths
  return { name: 'Sigma Tokens', collections }; // shown in the files home's Welcome to Sigma folder
}
