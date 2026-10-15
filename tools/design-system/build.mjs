// Regenerate after changing styles.css: node tools/design-system/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { cssNumber, cssPadding } from '../../src/sigma-css.js';
import {UI_COMPONENTS,UI_STYLESHEETS} from '../../src/ui-component-registry.js';
import {parseStylesheet} from './css-source.mjs';
const entries=UI_STYLESHEETS.flatMap(file=>parseStylesheet(readFileSync(new URL('../../'+file,import.meta.url),'utf8'),file));
const rules={};
for(const entry of entries)if(!entry.condition)rules[entry.selector]={...rules[entry.selector],...entry.declarations};
const selectors = UI_COMPONENTS.map(c=>c.selector);
for (const s of selectors) {
  if (s.startsWith('.btn.') && rules[s]) rules[s] = { ...rules['.btn'], ...(s.includes('.destructive') ? rules['.btn.primary'] : {}), ...rules[s] };
}
// Normalize the native-control cascade into explicit specimen states. Later,
// more specific rules win just as they do for Sigma's live controls.
const merge=(target,...sources)=>{rules[target]=Object.assign({},rules[target],...sources.map(s=>rules[s]||{}));};
merge('.icon-btn:hover','.icon-btn:hover:not(:disabled)');
merge('.icon-btn.disabled','.icon-btn:disabled');
merge('.icon-btn.selected','.icon-btn.on');
merge('.appearance-button','.icon-btn','.appearance-button');
merge('.appearance-button.disabled','.icon-btn:disabled');
merge('.appearance-button:hover','.icon-btn:hover');
merge('.rail-btn:focus','.rail-btn:focus-visible');
merge('.switch.selected','.switch');
merge('.switch:focus','.switch input:focus-visible + span');
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
merge('.seg-item:hover','.icon-btn:hover');
merge('.seg-item.disabled','.icon-btn.disabled');
for(const selector of Object.keys(rules)) {
  const rule=rules[selector];
  if(selectors.includes(selector) || selectors.some(s=>selector.startsWith(s+':')||selector.startsWith(s+'.'))) {
    const base=selectors.filter(s=>s!==selector&&(selector.startsWith(s+':')||selector.startsWith(s+'.'))).sort((a,b)=>b.length-a.length).map(s=>rules[s]).find(Boolean)||{};
    if(!rule['font-size']||rule['font-size']==='inherit')rule['font-size']=base['font-size']||rules[':root']['font-size'];
    if(!rule['font-weight']||rule['font-weight']==='inherit')rule['font-weight']=base['font-weight']||rules[':root']['font-weight']||'400';
  }
  if(rule['background-color']) rule.background=rule['background-color'];
  if(rule.padding || Object.keys(rule).some(k=>k.startsWith('padding-'))) {
    const padding=cssPadding(rule);
    if(padding) ['top','right','bottom','left'].forEach((side,i)=>rule[`padding-${side}`]=`${padding[i]}px`);
  }
  const h=cssNumber(rule.height), min=cssNumber(rule['min-height']);
  if(min!==null && h!==null && min>h) rule.height=`${min}px`;
}
const scoped=Object.fromEntries(Object.entries(rules).filter(([selector,rule])=>selector!==':root'&&selector!==':root[data-theme="dark"]'&&Object.keys(rule).some(k=>k.startsWith('--'))));
const motion=Object.entries(rules).flatMap(([selector,rule])=>['transition','animation','transition-duration','animation-duration'].filter(p=>rule[p]).map(property=>({selector,property,value:rule[property]})));
const parts=Object.fromEntries(['.field-label','.field input','.menu-check','.menu-label','.menu-shortcut','.switch span','.switch span::after','.switch input:checked + span','.switch input:checked + span::after','.switch input:focus-visible + span'].filter(s=>rules[s]).map(s=>[s,rules[s]]));
const source = { stylesheets:UI_STYLESHEETS,responsive:entries.filter(e=>e.condition),origins:entries.map(({selector,file,condition})=>({selector,file,condition})),scoped,motion,parts,palette: [...new Set(Object.values(rules).flatMap(rule=>Object.values(rule).flatMap(value=>value.match(/#[\da-f]{3,8}\b/gi) || [])))].sort(), foundations: [...new Set(Object.values(rules).map(r => Object.fromEntries(Object.entries(r).filter(([k]) => ['font-size', 'font-weight', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'border-radius', 'box-shadow', 'height', 'min-height', 'width'].includes(k)))).filter(r => Object.keys(r).length).map(r => JSON.stringify(r)))].map(r => JSON.parse(r)), root: rules[':root'], dark: rules[':root[data-theme="dark"]'], rules: Object.fromEntries(selectors.flatMap(s => [s, `${s}:hover`, `${s}:focus`, `${s}.active`, `${s}.selected`, `${s}.disabled`]).filter(s => rules[s]).map(s => [s, rules[s]])) };
const target = new URL('../../src/sigma-ui-source.js', import.meta.url);
const output = `// Generated from first-party app stylesheets by tools/design-system/build.mjs. Do not edit.\nexport const UI_SOURCE = ${JSON.stringify(source, null, 2)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Welcome UI source is stale. Run npm run build:welcome and bump SIGMA_SYSTEM_VERSION.');
} else writeFileSync(target, output);
