// Optics Tokens (Phase 36): the token file of Optics, the working design system in Welcome to Sigma, shaped
// like Shopify's Polaris (its structure, not its values or brand):
//
//   Primitives  raw values on numbered steps: color scales, space (100 = 4px), font, radius, border width,
//               motion; nothing in a design points here directly
//   Semantic    what things are, by role and state (bg/surface/hover, text/critical, border/focus,
//               icon/secondary, shadow/300), in Light and Dark; every value points at a primitive
//   Typography  the text styles (heading/xl, body/md…), made of font primitives
//
// Every token has a CSS variable (--optics-…) and the groups say what they're for.
import { collection, group, token, ref, modes } from './token-builders.js';
import { normalizeGroups } from './token-groups.js';
import { defaultTokenCode } from './code-names.js';

export const OPTICS_TOKENS_NAME = 'Optics Tokens';

export function opticsTokenDocument() {
  // ---------- Primitives ----------
  const p = collection('Primitives', ['Value']);
  const colorG = group(p, 'color', null, 'The raw palette, in steps from light (50) to dark (900). Designs use Semantic tokens, which point here.');
  const c = {};
  const scale = (name, steps, description) => {
    const g = group(p, name, colorG, description);
    c[name] = {};
    for (const [step, hex] of Object.entries(steps)) c[name][step] = token(p, g, step, 'color', hex);
  };
  scale('gray', {
    0: '#FFFFFF', 50: '#F7F7F7', 100: '#F1F1F1', 200: '#E3E3E3', 300: '#D4D4D4', 400: '#B5B5B5', 500: '#8A8A8A',
    600: '#616161', 700: '#4A4A4A', 800: '#303030', 900: '#1F1F1F', 950: '#171717', 1000: '#0C0C0C',
  }, 'Neutrals: text, surfaces and borders.');
  scale('brand', { 50: '#EEF0FF', 100: '#E0E4FF', 200: '#C4CBFF', 300: '#9DA8FF', 400: '#7383F8', 500: '#4F63EC', 600: '#3549D6', 700: '#2A3AB0', 800: '#212E8A', 900: '#18205E' },
    'Optics indigo: primary actions, selection and focus.');
  scale('red', { 50: '#FFF1EF', 100: '#FFE2DE', 200: '#FFC5BD', 300: '#FF9C8F', 400: '#F86A57', 500: '#E5432E', 600: '#C4291B', 700: '#A01F13', 800: '#7A180F', 900: '#4D0F09' },
    'Critical: errors and destructive actions.');
  scale('green', { 50: '#EDFAF2', 100: '#D6F5E2', 200: '#A9EAC3', 300: '#6FD89D', 400: '#36BF76', 500: '#17A05C', 600: '#0D8049', 700: '#0B6B3C', 800: '#0A4F2E', 900: '#07331E' },
    'Success.');
  scale('orange', { 50: '#FFF4EB', 100: '#FFE6D1', 200: '#FFC9A0', 300: '#FFA666', 400: '#FA8231', 500: '#E5680F', 600: '#BF5208', 700: '#8F3E06', 800: '#6B2E05', 900: '#451D03' },
    'Warning: something needs attention soon.');
  scale('yellow', { 50: '#FFFAE6', 100: '#FFF2C2', 200: '#FFE38A', 300: '#FFD04D', 400: '#F5B915', 500: '#D99E00', 600: '#A87A00', 700: '#7A5800', 800: '#5C4200', 900: '#3D2C00' },
    'Caution: worth knowing, not urgent.');
  scale('azure', { 50: '#EBF6FF', 100: '#D4ECFF', 200: '#A8D8FF', 300: '#6DBDFF', 400: '#2E9CF5', 500: '#0A80DB', 600: '#0066B3', 700: '#00528F', 800: '#003D6B', 900: '#002847' },
    'Info.');
  scale('purple', { 50: '#F6F1FF', 100: '#ECE2FF', 200: '#D8C4FF', 300: '#BC9BFF', 400: '#9D6DFC', 500: '#8048EB', 600: '#6A31D1', 700: '#5524AB', 800: '#401B80', 900: '#2A1255' },
    'Magic: suggestions and AI.');
  scale('alpha', {
    transparent: '#00000000', 'black-5': '#0000000D', 'black-10': '#0000001A', 'black-15': '#00000026', 'black-20': '#00000033',
    'black-30': '#0000004D', 'black-50': '#00000080', 'white-10': '#FFFFFF1A', 'white-20': '#FFFFFF33',
  }, 'Colors with opacity: overlays, hover washes and shadows.');

  const spaceG = group(p, 'space', null, 'Spacing on a 4px grid: the step is in hundredths of 4px (100 = 4px, 400 = 16px).');
  const sp = {};
  for (const [k, px] of [['0', 0], ['025', 1], ['050', 2], ['100', 4], ['150', 6], ['200', 8], ['300', 12], ['400', 16], ['500', 20], ['600', 24], ['800', 32], ['1000', 40], ['1200', 48], ['1600', 64]]) {
    sp[k] = token(p, spaceG, k, 'number', px);
  }

  const fontG = group(p, 'font', null, 'Type primitives. The Typography collection combines them into text styles.');
  const famG = group(p, 'family', fontG);
  const fam = { sans: token(p, famG, 'sans', 'string', 'Inter'), mono: token(p, famG, 'mono', 'string', 'JetBrains Mono') };
  const sizeG = group(p, 'size', fontG, 'Font sizes in px; the step is in hundredths of 4px (350 = 14px).');
  const size = {};
  for (const [k, px] of [['300', 12], ['350', 14], ['400', 16], ['500', 20], ['600', 24], ['750', 30], ['900', 36]]) size[k] = token(p, sizeG, k, 'number', px);
  const weightG = group(p, 'weight', fontG);
  const weight = {};
  for (const [k, w] of [['regular', 400], ['medium', 500], ['semibold', 600], ['bold', 700]]) weight[k] = token(p, weightG, k, 'number', w);
  const lineG = group(p, 'line-height', fontG, 'Line heights in percent of the font size.');
  const line = {};
  for (const [k, pc] of [['120', 120], ['125', 125], ['133', 133], ['143', 143], ['150', 150]]) line[k] = token(p, lineG, k, 'number', pc);
  const trackG = group(p, 'letter-spacing', fontG);
  const track = { dense: token(p, trackG, 'dense', 'number', -0.2), normal: token(p, trackG, 'normal', 'number', 0) };

  const radiusG = group(p, 'radius', null, 'Corner radii; the step is in hundredths of 4px (200 = 8px).');
  const rad = {};
  for (const [k, px] of [['0', 0], ['100', 4], ['150', 6], ['200', 8], ['300', 12], ['400', 16], ['500', 20], ['full', 9999]]) rad[k] = token(p, radiusG, k, 'number', px);
  const borderWG = group(p, 'border-width');
  const bw = { '025': token(p, borderWG, '025', 'number', 1), '050': token(p, borderWG, '050', 'number', 2), '100': token(p, borderWG, '100', 'number', 4) };

  const motionG = group(p, 'motion', null, 'How things move: durations and easing curves.');
  const durG = group(p, 'duration', motionG, 'Short for small changes (hover), longer for big ones (a dialog opening).');
  for (const ms of [0, 50, 100, 150, 200, 250, 300, 400, 500]) token(p, durG, String(ms), 'duration', ms);
  const easeG = group(p, 'easing', motionG);
  token(p, easeG, 'ease', 'easing', [0.25, 0.1, 0.25, 1], 'Most transitions.');
  token(p, easeG, 'ease-in', 'easing', [0.42, 0, 1, 1], 'Elements leaving the view.');
  token(p, easeG, 'ease-out', 'easing', [0, 0, 0.58, 1], 'Elements coming into view.');
  token(p, easeG, 'ease-in-out', 'easing', [0.42, 0, 0.58, 1], 'Elements moving within the view.');
  token(p, easeG, 'linear', 'easing', [0, 0, 1, 1], 'Spinners and progress.');

  // ---------- Semantic ----------
  const s = collection('Semantic', ['Light', 'Dark']);
  const g = c.gray, b = c.brand, a = c.alpha;
  const both = (light, dark) => modes(ref(light), ref(dark));
  const tone = { critical: 'red', success: 'green', warning: 'orange', caution: 'yellow', info: 'azure', magic: 'purple' };

  const bgG = group(s, 'bg', null, 'Backgrounds: the page, surfaces on it, and fills for controls.');
  token(s, bgG, 'page', 'color', both(g[100], g[950]), 'The page behind everything.');
  const surfaceG = group(s, 'surface', bgG, 'Cards, panels and inputs: what content sits on.');
  token(s, surfaceG, 'default', 'color', both(g[0], g[900]));
  token(s, surfaceG, 'hover', 'color', both(g[50], g[800]));
  token(s, surfaceG, 'active', 'color', both(g[100], g[700]));
  token(s, surfaceG, 'secondary', 'color', both(g[50], g[800]), 'A surface set back from the default one.');
  token(s, surfaceG, 'tertiary', 'color', both(g[100], g[700]));
  token(s, surfaceG, 'disabled', 'color', both(a['black-5'], a['white-10']));
  token(s, surfaceG, 'selected', 'color', both(b[50], b[900]));
  token(s, surfaceG, 'inverse', 'color', both(g[900], g[50]), 'Tooltips and toasts: the opposite of the page.');
  for (const [t, hue] of Object.entries(tone)) token(s, surfaceG, t, 'color', both(c[hue][50], c[hue][900]), `Tinted surface for ${t} messages.`);
  const fillG = group(s, 'fill', bgG, 'Fills for controls: buttons, badges, checkboxes.');
  token(s, fillG, 'default', 'color', both(g[0], g[800]), 'Secondary buttons.');
  token(s, fillG, 'hover', 'color', both(g[50], g[700]));
  token(s, fillG, 'active', 'color', both(g[100], g[600]));
  token(s, fillG, 'disabled', 'color', both(g[100], g[800]));
  token(s, fillG, 'transparent', 'color', both(a.transparent, a.transparent), 'Tertiary and plain buttons: no fill until hovered.');
  token(s, fillG, 'transparent-hover', 'color', both(a['black-5'], a['white-10']));
  token(s, fillG, 'transparent-active', 'color', both(a['black-10'], a['white-20']));
  token(s, fillG, 'brand', 'color', both(b[600], b[500]), 'Primary buttons and selected controls.');
  token(s, fillG, 'brand-hover', 'color', both(b[700], b[600]));
  token(s, fillG, 'brand-active', 'color', both(b[800], b[700]));
  token(s, fillG, 'critical', 'color', both(c.red[600], c.red[600]), 'Destructive buttons.');
  token(s, fillG, 'critical-hover', 'color', both(c.red[700], c.red[700]));
  token(s, fillG, 'critical-active', 'color', both(c.red[800], c.red[800]));
  token(s, fillG, 'neutral', 'color', both(g[100], g[800]), 'Neutral badges.');
  for (const [t, hue] of Object.entries(tone)) if (t !== 'critical') token(s, fillG, t, 'color', both(c[hue][100], c[hue][800]), `Badges for ${t}.`);
  token(s, fillG, 'critical-subtle', 'color', both(c.red[100], c.red[800]), 'Badges for critical.');

  const textG = group(s, 'text', null, 'Text, by role.');
  token(s, textG, 'default', 'color', both(g[900], g[50]));
  token(s, textG, 'secondary', 'color', both(g[600], g[400]), 'Help text and supporting copy.');
  token(s, textG, 'disabled', 'color', both(g[400], g[600]));
  token(s, textG, 'link', 'color', both(b[700], b[300]));
  token(s, textG, 'link-hover', 'color', both(b[800], b[200]));
  token(s, textG, 'on-fill', 'color', both(g[0], g[0]), 'Text on brand and critical fills.');
  token(s, textG, 'inverse', 'color', both(g[50], g[900]), 'Text on inverse surfaces.');
  for (const [t, hue] of Object.entries(tone)) token(s, textG, t, 'color', both(c[hue][700], c[hue][300]), `Text for ${t} messages, on their tinted surface or the default one.`);

  const borderG = group(s, 'border', null, 'Borders and dividers.');
  token(s, borderG, 'default', 'color', both(g[200], g[800]), 'Cards and dividers.');
  token(s, borderG, 'strong', 'color', both(g[500], g[500]), 'Inputs and checkboxes: 3:1 against the surface.');
  token(s, borderG, 'hover', 'color', both(g[600], g[400]));
  token(s, borderG, 'disabled', 'color', both(g[200], g[800]));
  token(s, borderG, 'focus', 'color', both(b[500], b[300]), 'The focus ring of every control.');
  token(s, borderG, 'brand', 'color', both(b[600], b[400]));
  for (const [t, hue] of Object.entries(tone)) token(s, borderG, t, 'color', both(c[hue][500], c[hue][400]));

  const iconG = group(s, 'icon', null, 'Icons, by role.');
  token(s, iconG, 'default', 'color', both(g[700], g[300]));
  token(s, iconG, 'secondary', 'color', both(g[500], g[400]));
  token(s, iconG, 'disabled', 'color', both(g[400], g[600]));
  token(s, iconG, 'on-fill', 'color', both(g[0], g[0]));
  token(s, iconG, 'inverse', 'color', both(g[50], g[900]));
  token(s, iconG, 'brand', 'color', both(b[600], b[300]));
  for (const [t, hue] of Object.entries(tone)) token(s, iconG, t, 'color', both(c[hue][600], c[hue][400]));

  const shadowG = group(s, 'shadow', null, 'Elevation: 100 sits on the page, 600 floats above everything. Darker in Dark mode, where light shadows don’t show.');
  for (const [k, y, blur, spread, light, dark] of [
    ['100', 1, 0, 0, 'black-5', 'black-30'], ['200', 1, 2, 0, 'black-10', 'black-30'], ['300', 4, 6, -2, 'black-15', 'black-50'],
    ['400', 8, 16, -4, 'black-15', 'black-50'], ['500', 12, 20, -8, 'black-20', 'black-50'], ['600', 20, 20, -8, 'black-30', 'black-50'],
  ]) token(s, shadowG, k, 'shadow', modes({ color: ref(a[light]), x: 0, y, blur, spread }, { color: ref(a[dark]), x: 0, y, blur, spread }));

  // ---------- Typography ----------
  const t = collection('Typography', ['Default']);
  const style = (gid, name, fm, sz, wt, lh, ls, description = '') => token(t, gid, name, 'typography', {
    fontFamily: ref(fam[fm]), fontSize: ref(size[sz]), fontWeight: ref(weight[wt]), lineHeight: ref(line[lh]), letterSpacing: ref(track[ls]),
  }, description);
  const heading = group(t, 'heading', null, 'Titles, from page titles (2xl) to card titles (sm).');
  style(heading, '2xl', 'sans', '900', 'bold', '120', 'dense');
  style(heading, 'xl', 'sans', '750', 'bold', '133', 'dense');
  style(heading, 'lg', 'sans', '600', 'semibold', '133', 'dense');
  style(heading, 'md', 'sans', '500', 'semibold', '120', 'normal');
  style(heading, 'sm', 'sans', '400', 'semibold', '150', 'normal');
  style(heading, 'xs', 'sans', '350', 'semibold', '143', 'normal');
  const body = group(t, 'body', null, 'Running text and controls.');
  style(body, 'lg', 'sans', '400', 'regular', '150', 'normal');
  style(body, 'md', 'sans', '350', 'regular', '143', 'normal', 'The default: most text and controls.');
  style(body, 'md-medium', 'sans', '350', 'medium', '143', 'normal', 'Button labels and emphasis.');
  style(body, 'md-semibold', 'sans', '350', 'semibold', '143', 'normal');
  style(body, 'sm', 'sans', '300', 'regular', '133', 'normal', 'Captions and help text.');
  style(body, 'sm-medium', 'sans', '300', 'medium', '133', 'normal', 'Badges.');
  style(null, 'code', 'mono', '350', 'regular', '143', 'normal');

  const collections = [p, s, t];
  for (const col of collections) {
    normalizeGroups(col); // token names become full paths
    for (const v of col.variables) v.codeSyntax = { web: `--optics-${defaultTokenCode(v.name).slice(2)}` };
  }
  return { name: OPTICS_TOKENS_NAME, collections };
}
