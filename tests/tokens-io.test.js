import { test, eq, ok } from './harness.js';
import { exportDTCG, exportCSS, importTokens, mergeCollections } from '../src/tokens-io.js';

// A token system using every feature: modes, alpha, aliases, typography with an aliased field,
// px and unitless numbers, strings, booleans, descriptions and an extended collection.
function system() {
  const light = 'm-light', dark = 'm-dark';
  const color = {
    id: 'c-color', name: 'Color', modes: [{ id: light, name: 'Light' }, { id: dark, name: 'Dark' }], defaultModeId: light,
    variables: [
      { id: 'v-blue', name: 'blue/500', type: 'color', valuesByMode: { [light]: '#0D99FF', [dark]: '#3DADFF' } },
      { id: 'v-primary', name: 'brand/primary', type: 'color', description: 'Main brand color', valuesByMode: { [light]: { alias: 'v-blue' }, [dark]: { alias: 'v-blue' } } },
      { id: 'v-glass', name: 'surface/glass', type: 'color', valuesByMode: { [light]: '#FFFFFF80', [dark]: '#00000080' } },
    ],
  };
  const base = {
    id: 'c-base', name: 'Base', modes: [{ id: 'm-def', name: 'Default' }], defaultModeId: 'm-def',
    variables: [
      { id: 'v-size', name: 'font/size/xl', type: 'number', valuesByMode: { 'm-def': 32 } },
      { id: 'v-op', name: 'opacity/disabled', type: 'number', valuesByMode: { 'm-def': 40 } },
      { id: 'v-fam', name: 'font/family/display', type: 'string', valuesByMode: { 'm-def': 'Playfair Display' } },
      { id: 'v-flag', name: 'feature/rounded', type: 'boolean', valuesByMode: { 'm-def': true } },
      { id: 'v-h1', name: 'text/h1', type: 'typography', valuesByMode: { 'm-def': { fontFamily: { alias: 'v-fam' }, fontWeight: 700, fontSize: { alias: 'v-size' }, lineHeight: null, letterSpacing: -0.5 } } },
    ],
  };
  const brand = {
    id: 'c-brand', name: 'Brand B', extends: 'c-color', defaultModeId: 'e-light', variables: [],
    modes: [{ id: 'e-light', name: 'Light', parentModeId: light }, { id: 'e-dark', name: 'Dark', parentModeId: dark }],
    overrides: { 'v-blue': { 'e-light': '#F24822' } },
  };
  return [color, base, brand];
}

// Describe collections by names only, so systems with different ids can be compared.
function describe(cols) {
  const nameOf = new Map();
  for (const c of cols) for (const v of c.variables || []) nameOf.set(v.id, v.name);
  const norm = (x) => {
    if (x && typeof x === 'object' && x.alias) return `→${nameOf.get(x.alias)}`;
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, norm(y)]));
    return x;
  };
  return cols.map((c) => {
    const modeName = (id) => c.modes.find((m) => m.id === id)?.name;
    return {
      name: c.name, extends: c.extends ? cols.find((p) => p.id === c.extends)?.name : null,
      modes: c.modes.map((m) => m.name), defaultMode: modeName(c.defaultModeId),
      tokens: (c.variables || []).map((v) => ({
        name: v.name, type: v.type, description: v.description || '',
        values: Object.fromEntries(Object.entries(v.valuesByMode).map(([m, x]) => [modeName(m), norm(x)])),
      })),
      overrides: Object.fromEntries(Object.entries(c.overrides || {}).map(([vid, byMode]) => [nameOf.get(vid),
        Object.fromEntries(Object.entries(byMode).map(([m, x]) => [modeName(m), norm(x)]))])),
    };
  });
}

test('tokens.json: export then import round-trips without loss', () => {
  const original = system();
  const json = JSON.parse(JSON.stringify(exportDTCG(original)));
  const { collections, skipped } = importTokens(json);
  eq(skipped, 0);
  eq(describe(collections), describe(original));
  ok(collections[0].id !== original[0].id, 'imported collections get fresh ids');
});

test('tokens.json: export uses the W3C format for types, colors, sizes and aliases', () => {
  const json = exportDTCG(system());
  const light = json['Color/Light'];
  eq(light.brand.primary.$value, '{blue.500}');
  eq(light.brand.primary.$description, 'Main brand color');
  eq(light.surface.glass.$value.alpha, 0.5);
  eq(light.blue['500'].$value.hex, '#0d99ff');
  const base = json['Base/Default'];
  eq(base.font.size.xl, { $type: 'dimension', $value: { value: 32, unit: 'px' } });
  eq(base.opacity.disabled.$type, 'number');
  eq(base.text.h1.$value.fontSize, '{font.size.xl}');
  eq(json['Brand B/Light'].blue['500'].$value.hex, '#f24822');
  ok(json.$metadata.tokenSetOrder.includes('Brand B/Dark'), 'sets listed in order');
});

test('tokens.json: plain W3C files from other tools import', () => {
  const json = {
    color: {
      $type: 'color',
      brand: { $value: '#0d99ff', $description: 'Brand' },
      overlay: { $value: 'rgba(0, 0, 0, 0.5)' },
      link: { $value: '{color.brand}' },
    },
    space: { md: { $type: 'dimension', $value: '1rem' } },
    type: { heading: { $type: 'typography', $value: { fontFamily: ['Inter', 'sans-serif'], fontWeight: 'bold', fontSize: '{space.md}', lineHeight: 1.25, letterSpacing: '0px' } } },
    shadow: { card: { $type: 'shadow', $value: { offsetX: '0px' } } },
  };
  const { collections, skipped } = importTokens(json);
  eq(skipped, 1);
  const v = Object.fromEntries(collections[0].variables.map((x) => [x.name, x]));
  const mode = collections[0].defaultModeId;
  eq(v['color/brand'].valuesByMode[mode], '#0D99FF');
  eq(v['color/overlay'].valuesByMode[mode], '#00000080');
  eq(v['color/link'].valuesByMode[mode], { alias: v['color/brand'].id });
  eq(v['space/md'].valuesByMode[mode], 16);
  eq(v['type/heading'].valuesByMode[mode], { fontFamily: 'Inter', fontWeight: 700, fontSize: { alias: v['space/md'].id }, lineHeight: 125, letterSpacing: 0 });
});

test('CSS export: defaults on :root, other modes and brands as attribute selectors', () => {
  const css = exportCSS(system());
  ok(css.includes(':root {'), 'root block');
  ok(css.includes('--blue-500: #0d99ff;'), 'color');
  ok(css.includes('--brand-primary: var(--blue-500);'), 'alias as var()');
  ok(css.includes('--surface-glass: #ffffff80;'), 'alpha');
  ok(css.includes('[data-color="dark"] {'), 'mode selector');
  ok(css.includes('[data-color="brand-b-light"] {'), 'extension selector');
  ok(css.includes('--font-size-xl: 32px;') && css.includes('--opacity-disabled: 40;'), 'px vs unitless');
  ok(css.includes('--text-h1-font-size: var(--font-size-xl);') && css.includes('--text-h1-line-height: normal;'), 'typography parts');
});

test('import merge: matching tokens update, new ones are added, aliases point at merged tokens', () => {
  const target = [system()[0]];
  const incoming = importTokens({ 'Color/Light': {
    blue: { 500: { $type: 'color', $value: '#000000' } },
    brand: { secondary: { $type: 'color', $value: '{blue.500}' } },
  } }).collections;
  const n = mergeCollections(target, incoming);
  eq(n, 2);
  const blue = target[0].variables.find((v) => v.name === 'blue/500');
  const secondary = target[0].variables.find((v) => v.name === 'brand/secondary');
  eq([blue.id, blue.valuesByMode['m-light'], blue.valuesByMode['m-dark']], ['v-blue', '#000000', '#3DADFF']);
  eq(secondary.valuesByMode['m-light'], { alias: 'v-blue' });
});
