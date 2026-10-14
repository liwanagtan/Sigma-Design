// Code handoff (Phase 24): code names, the Inspect panel's CSS and component usage.
import { test, eq, ok } from './harness.js';
import { useDoc } from './core.test.js';
import { state, createNode, makePaint } from '../src/store.js';
import { syncInstances, createInstance } from '../src/components.js';
import { resolveVariables, snapshotForLibrary } from '../src/variables.js';
import { applyLayouts } from '../src/layout.js';
import { defaultTokenCode, tokenCode, cssVar, setTokenCode, componentCode, propCode, variantValueCode } from '../src/code-names.js';
import { inspectHTML, layerCSS, instanceUsage, layerTokens } from '../src/inspect.js';
import { exportCSS } from '../src/tokens-io.js';

const tokens = [{
  id: 'c', name: 'Core', modes: [{ id: 'l', name: 'Light' }, { id: 'd', name: 'Dark' }], defaultModeId: 'l',
  variables: [
    { id: 'bg', name: 'surface/default', type: 'color', valuesByMode: { l: '#FFFFFF', d: '#1E1E1E' } },
    { id: 'pad', name: 'space/4', type: 'number', valuesByMode: { l: 16, d: 16 } },
    { id: 'brand', name: 'brand/primary', type: 'color', valuesByMode: { l: '#1976D2', d: '#90CAF9' }, codeSyntax: { web: 'palette.primary.main', ios: 'Brand.primary' } },
    { id: 'acc', name: 'accent', type: 'color', valuesByMode: { l: { alias: 'bg' }, d: '#4DB5FF' }, codeSyntax: { web: '--app-accent' } },
  ],
}];

test('code names: defaults from token paths, per platform; set ones win', () => {
  eq(defaultTokenCode('color/blue/500'), '--color-blue-500');
  eq(defaultTokenCode('color/blue/500', 'ios'), 'colorBlue500');
  eq(defaultTokenCode('color/blue/500', 'android'), 'color_blue_500');
  eq(defaultTokenCode('font/fontSize'), '--font-fontsize', 'the same variable Export CSS writes');
  const v = tokens[0].variables[2];
  eq([tokenCode(v), tokenCode(v, 'ios'), tokenCode(v, 'android')], ['palette.primary.main', 'Brand.primary', 'brand_primary']);
  eq(cssVar(v), 'var(--brand-primary)', 'a theme path isn’t a CSS variable');
  eq(cssVar(tokens[0].variables[3]), 'var(--app-accent)');
  const t = { name: 'space/4' };
  setTokenCode(t, 'web', '--space-4');
  eq(t.codeSyntax, undefined, 'the default isn’t stored');
  setTokenCode(t, 'web', '--gap-m');
  eq(t.codeSyntax, { web: '--gap-m' });
  eq([componentCode({ name: 'icon button' }), propCode({ name: 'Show icon' }), variantValueCode('Large Primary')], ['IconButton', 'showIcon', 'large-primary']);
  ok(exportCSS(tokens).includes('--app-accent: var(--surface-default);'), 'Export CSS uses code names');
});

test('inspect: CSS for a layer writes tokens as their variables', () => {
  const frame = createNode('frame', {
    name: 'Card', w: 200, h: 100, fills: [makePaint('#000000')], strokes: [makePaint('#DDDDDD')], strokeWidth: 1,
    radius: 8, layout: { mode: 'vertical', gap: 8, spacing: 'packed', pt: 16, pr: 16, pb: 16, pl: 16, alignP: 'start', alignC: 'center' },
    bindings: { 'fills.0.color': 'bg', 'layout.pt': 'pad', 'layout.pb': 'pad', 'layout.pl': 'pad', 'layout.pr': 'pad' },
    effects: [{ type: 'drop-shadow', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0, visible: true }],
  });
  const doc = useDoc([frame]);
  doc.variables = { collections: tokens };
  resolveVariables();
  const css = Object.fromEntries(layerCSS(frame));
  eq(css.background, 'var(--surface-default)');
  eq(css.padding, 'var(--space-4)');
  eq([css.display, css['flex-direction'], css.gap, css['align-items'], css['border-radius']], ['flex', 'column', '8px', 'center', '8px']);
  eq(css.border, '1px solid #dddddd');
  eq(css['box-shadow'], '0 2px 8px 0 #0000001a');
  eq(layerTokens(frame).map((t) => [t.variable.name, t.value]), [['surface/default', '#FFFFFF'], ['space/4', 16], ['space/4', 16], ['space/4', 16], ['space/4', 16]]);
});

test('inspect: an instance is written as code with its variant and changed properties', () => {
  const label = createNode('text', { name: 'Label', text: 'Button', propRefs: { text: 'lbl' } });
  const a = createNode('component', { name: 'Size=Small, Style=Primary', w: 80, h: 32, children: [label] });
  const b = createNode('component', { name: 'Size=Large, Style=Primary', w: 120, h: 40, children: [createNode('text', { name: 'Label', text: 'Button', propRefs: { text: 'lbl' } })] });
  const set = createNode('componentSet', { name: 'Button', children: [a, b], props: { lbl: { type: 'text', name: 'Label', default: 'Button' }, ic: { type: 'boolean', name: 'Show icon', default: true } }, codeNames: { Style: 'variant' } });
  useDoc([set]);
  const inst = createInstance(b, { x: 0, y: 100 });
  inst.propValues = { lbl: 'Get started', ic: false };
  syncInstances();
  eq(instanceUsage(inst), '<Button\n  size="large"\n  variant="primary"\n  label="Get started"\n  showIcon={false}\n/>', 'long ones go on several lines');
  set.codeName = 'PrimaryButton';
  inst.propValues = {};
  eq(instanceUsage(inst), '<PrimaryButton size="large" variant="primary" />', 'defaults are left out');
});

test('Code panel: collapsed docs, variant values distinct from code names, resolved labels and safe highlighted snippets',async()=>{
  const label=createNode('text',{name:'Label',text:'Continue'});
  const hidden=createNode('text',{text:'Hidden',visible:false});
  const main=createNode('component',{name:'Variant=Primary',children:[label,hidden]});
  const set=createNode('componentSet',{name:'Button',children:[main],docs:{purpose:'Use this button'},codeNames:{Variant:'variant'}});
  useDoc([set]);
  const host=document.createElement('div');host.innerHTML=inspectHTML([main]);
  ok(host.querySelector('details[data-component-docs]'));ok(!host.querySelector('details').open);
  eq(host.querySelector('.inspect-variant-values').textContent,'Primary');
  eq(host.querySelector('[aria-label="Variant code name"]').value,'variant');
  eq(host.querySelector('[data-a11y=label]').value,'Continue');
  ok(host.querySelector('.syntax-property'));ok(host.querySelector('.syntax-number'));
  const {docsHTML}=await import('../src/component-docs.js');set.docs.usage='- First step\n- <img src=x onerror=alert(1)>';const docs=document.createElement('div');docs.innerHTML=docsHTML(set);eq(docs.querySelectorAll('li').length,2);eq(docs.querySelector('img'),null);ok(docs.querySelector('h4'));
  const {codeBlock}=await import('../src/code-highlight.js');
  const source='<Button label="<img src=x onerror=alert(1)>" />';host.innerHTML=codeBlock(source);eq(host.querySelector('code').textContent,source);eq(host.querySelector('img'),null);ok(host.querySelector('.syntax-element'));
  const instance=createInstance(main,{x:100,y:0});instance.a11y={label:'Next step'};syncInstances();host.innerHTML=inspectHTML([instance]);eq(host.querySelector('[data-a11y=label]').value,'Next step');ok(host.querySelector('.inspect-property-head').textContent.includes('Primary'));
});
