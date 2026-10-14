// Regenerate after changing styles.css: node tools/design-system/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { cssNumber, cssPadding } from '../../src/sigma-css.js';
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = {};
for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const selector of selectors.trim().split(/\s*,\s*/)) {
    const declarations = Object.fromEntries(body.split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));
    rules[selector] = { ...rules[selector], ...declarations };
  }
}
const selectors = ['.btn', '.btn.primary', '.btn.primary.destructive', '.icon-btn', '.rail-btn', '.tb-btn', '.field', '.select', '.seg', '.seg-item', '.page-row', '.page-group', '.layer-row', '.menu', '.menu-item', '.panel-head', '.file-name', '.preset', '.check-row', '.rail-badge'];
for (const s of selectors) {
  if (s.startsWith('.btn.') && rules[s]) rules[s] = { ...rules['.btn'], ...(s.includes('.destructive') ? rules['.btn.primary'] : {}), ...rules[s] };
}
// Normalize the native-control cascade into explicit specimen states. Later,
// more specific rules win just as they do for Sigma's live controls.
const merge=(target,...sources)=>{rules[target]=Object.assign({},rules[target],...sources.map(s=>rules[s]||{}));};
merge('.select','select:not([multiple])');
merge('.select:hover','select:not([multiple]):hover:not(:disabled)');
merge('.select:focus','select:not([multiple]):focus-visible','select[aria-expanded="true"]');
merge('.select.disabled','select:disabled');
merge('.field:focus','.field:focus-within');
merge('.menu-item:hover','.menu-item:hover:not(.disabled)');
merge('.menu-item:focus','.menu-item:focus-visible');
merge('.menu-item.selected','.menu-item[aria-selected="true"]');
merge('.btn.disabled','.btn:disabled');
merge('.btn.primary.disabled','.btn:disabled');
merge('.btn.primary.destructive.disabled','.btn:disabled');
merge('.seg-item','.icon-btn','.seg .icon-btn');
merge('.seg-item.selected','.seg .icon-btn.on');
for(const selector of Object.keys(rules)) {
  const rule=rules[selector];
  if(rule['background-color']) rule.background=rule['background-color'];
  if(rule.padding || Object.keys(rule).some(k=>k.startsWith('padding-'))) {
    const padding=cssPadding(rule);
    if(padding) ['top','right','bottom','left'].forEach((side,i)=>rule[`padding-${side}`]=`${padding[i]}px`);
  }
  const h=cssNumber(rule.height), min=cssNumber(rule['min-height']);
  if(min!==null && h!==null && min>h) rule.height=`${min}px`;
}
const source = { palette: [...new Set(Object.values(rules).flatMap(rule=>Object.values(rule).flatMap(value=>value.match(/#[\da-f]{3,8}\b/gi) || [])))].sort(), foundations: [...new Set(Object.values(rules).map(r => Object.fromEntries(Object.entries(r).filter(([k]) => ['font-size', 'font-weight', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'border-radius', 'box-shadow', 'height', 'min-height', 'width'].includes(k)))).filter(r => Object.keys(r).length).map(r => JSON.stringify(r)))].map(r => JSON.parse(r)), root: rules[':root'], dark: rules[':root[data-theme="dark"]'], rules: Object.fromEntries(selectors.flatMap(s => [s, `${s}:hover`, `${s}:focus`, `${s}.active`, `${s}.selected`, `${s}.disabled`]).filter(s => rules[s]).map(s => [s, rules[s]])) };
const target = new URL('../../src/sigma-ui-source.js', import.meta.url);
const output = `// Generated from styles.css by tools/design-system/build.mjs. Do not edit.\nexport const UI_SOURCE = ${JSON.stringify(source, null, 2)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Welcome UI source is stale. Run npm run build:welcome and bump SIGMA_SYSTEM_VERSION and WELCOME_VERSION.');
} else writeFileSync(target, output);
