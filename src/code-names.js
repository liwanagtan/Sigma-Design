// Code names: what tokens, components and their properties are called in code, so designs speak the code
// library's language ("stack mirroring"). Each can be set; when it isn't, it comes from the Sigma name.
//
//   token.codeSyntax = { web: '--color-blue-500' | 'palette.primary.main', ios: 'colorBlue500', android: 'color_blue_500' }
//   component.codeName = 'Button'          (on the component, or on its component set for variants)
//   propDef.codeName = 'label'             (a component property)
//   set.codeNames = { Style: 'variant' }   (a component set's variant properties)
//
// The sync skill fills token code names in on import (Phase 22); people edit them in the token inspector
// and in the Inspect panel.
const words = (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
const lower = (s) => s.toLowerCase();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const PLATFORMS = { web: 'Web', ios: 'iOS', android: 'Android' };

// Default code names for a token path ("color/blue/500"). On the web it's the variable Export CSS writes.
const cssSlug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
export function defaultTokenCode(name, platform = 'web') {
  const segments = String(name || '').split('/').map((x) => x.trim().replace(/[.{}]/g, '-').replace(/^\$/, '')).filter(Boolean);
  const w = segments.flatMap(words);
  if (platform === 'ios') return w.map((x, i) => (i ? cap(x) : lower(x))).join('');
  if (platform === 'android') return w.map(lower).join('_');
  return `--${segments.map(cssSlug).join('-')}`;
}
// The CSS variable's name (without var()).
export const cssVarName = (v) => cssVar(v).slice(4, -1);

export const tokenCode = (v, platform = 'web') => v?.codeSyntax?.[platform] || defaultTokenCode(v?.name, platform);

// How a token is used in CSS: var(--x). A web code name that isn't a CSS variable (a theme path) gets the
// variable Export CSS would write.
export function cssVar(v) {
  const web = v?.codeSyntax?.web;
  return `var(${web && web.startsWith('--') ? web : defaultTokenCode(v?.name)})`;
}

export function setTokenCode(v, platform, value) {
  const name = String(value || '').trim();
  if (!name || name === defaultTokenCode(v.name, platform)) {
    if (v.codeSyntax) delete v.codeSyntax[platform];
    if (v.codeSyntax && !Object.keys(v.codeSyntax).length) delete v.codeSyntax;
  } else (v.codeSyntax ||= {})[platform] = name;
}

// Components: PascalCase of the component's (or set's) name; properties: camelCase.
export const defaultComponentCode = (name) => words(name).map(cap).join('') || 'Component';
export const defaultPropCode = (name) => words(name).map((x, i) => (i ? cap(x) : lower(x))).join('') || 'prop';
export const componentCode = (host) => host?.codeName || defaultComponentCode(host?.name);
export const propCode = (def) => def?.codeName || defaultPropCode(def?.name);
export const variantPropCode = (set, prop) => set?.codeNames?.[prop] || defaultPropCode(prop);
// A variant value in code: "Primary" → "primary".
export const variantValueCode = (value) => words(value).map(lower).join('-') || String(value);
