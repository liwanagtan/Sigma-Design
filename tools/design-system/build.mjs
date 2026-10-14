// Regenerate after changing styles.css: node tools/design-system/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = {};
for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const selector of selectors.trim().split(/\s*,\s*/)) {
    const declarations = Object.fromEntries(body.split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));
    rules[selector] = { ...rules[selector], ...declarations };
  }
}
const selectors = ['.btn', '.btn.primary', '.btn.primary.destructive', '.icon-btn', '.rail-btn', '.tb-btn', '.field', '.select', '.seg', '.page-row', '.page-group', '.layer-row', '.menu', '.menu-item', '.panel-head', '.file-name', '.preset', '.check-row', '.rail-badge'];
for (const s of selectors) {
  if (s.startsWith('.btn.') && rules[s]) rules[s] = { ...rules['.btn'], ...(s.includes('.destructive') ? rules['.btn.primary'] : {}), ...rules[s] };
}
const source = { palette: [...new Set(Object.values(rules).flatMap(rule=>Object.values(rule).flatMap(value=>value.match(/#[\da-f]{3,8}\b/gi) || [])))].sort(), foundations: [...new Set(Object.values(rules).map(r => Object.fromEntries(Object.entries(r).filter(([k]) => ['font-size', 'font-weight', 'padding', 'gap', 'border-radius', 'box-shadow'].includes(k)))).filter(r => Object.keys(r).length).map(r => JSON.stringify(r)))].map(r => JSON.parse(r)), root: rules[':root'], dark: rules[':root[data-theme="dark"]'], rules: Object.fromEntries(selectors.flatMap(s => [s, `${s}:hover`, `${s}:focus`, `${s}.active`, `${s}.selected`]).filter(s => rules[s]).map(s => [s, rules[s]])) };
const target = new URL('../../src/sigma-ui-source.js', import.meta.url);
const output = `// Generated from styles.css by tools/design-system/build.mjs. Do not edit.\nexport const UI_SOURCE = ${JSON.stringify(source, null, 2)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Welcome UI source is stale. Run npm run build:welcome and bump SIGMA_SYSTEM_VERSION and WELCOME_VERSION.');
} else writeFileSync(target, output);
