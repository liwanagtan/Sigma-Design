// The design system use report (src/use-report.js): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useReport, formatShare } from '../../src/use-report.js';

const tokens = {
  name: 'Core tokens',
  collections: [{
    id: 'c', modes: [{ id: 'm', name: 'Default' }],
    variables: [
      { id: 'blue', name: 'color/blue', type: 'color', valuesByMode: { m: '#3B5BFF' } },
      { id: 'accent', name: 'accent', type: 'color', valuesByMode: { m: { alias: 'blue' } } },
      { id: 'space-2', name: 'space/2', type: 'number', valuesByMode: { m: 8 } },
      { id: 'unused', name: 'space/9', type: 'number', valuesByMode: { m: 72 } },
    ],
  }],
};
const button = {
  id: 'button', type: 'componentSet', name: 'Button',
  children: [
    { id: 'button-primary', type: 'component', name: 'Variant=Primary', fills: [{}], bindings: { 'fills.0.color': 'accent', 'layout.pl': 'space-2' }, layout: { mode: 'horizontal', pl: 8 }, children: [] },
    { id: 'button-danger', type: 'component', name: 'Variant=Danger', fills: [{ color: '#FF0000' }], layout: { mode: 'horizontal', pl: 8 }, children: [] },
  ],
};
const badge = { id: 'badge', type: 'component', name: 'Badge', fills: [{}], bindings: { 'fills.0.color': 'accent' }, children: [] };
const library = {
  name: 'Library',
  doc: { pages: [{ id: 'p', name: 'Components', children: [button, badge] }], libraries: [tokens] },
};
const page = (handoff) => ({
  id: handoff ? 'h' : 'w', name: handoff ? 'Home' : 'Drafts', ...(handoff ? { handoff: true } : {}),
  children: [{
    id: `frame-${handoff}`, type: 'frame', name: 'Screen', fills: [{}], bindings: { 'fills.0.color': 'blue' },
    layout: { mode: 'vertical', gap: 16 },
    children: [
      { id: `i1-${handoff}`, type: 'instance', name: 'Button', componentId: 'button-primary' },
      { id: `i2-${handoff}`, type: 'instance', name: 'Button', componentId: 'button-danger' },
      { id: `t-${handoff}`, type: 'text', name: 'Title', text: 'Hi', fills: [{ color: '#111111' }] },
    ],
  }],
});
const screens = {
  name: 'Screens', editedAt: Date.parse('2026-10-01'),
  doc: { pages: [page(true), page(false)], libraries: [tokens], componentLibraries: [{ name: 'Library', components: [button, badge] }] },
};

test('report: component share counts instances once, against the layers on pages', () => {
  const r = useReport([library, screens]);
  const s = r.files.find((f) => f.name === 'Screens');
  assert.equal(s.layers, 8, 'per page: the frame, two instances, the text');
  assert.equal(s.instances, 4);
  assert.equal(s.componentShare, 0.5);
  assert.equal(r.files.find((f) => f.name === 'Library').layers, 0, 'component definitions aren’t page layers');
});

test('report: token share by kind, components included, instances’ insides left out', () => {
  const r = useReport([library, screens]);
  const lib = r.files.find((f) => f.name === 'Library');
  assert.deepEqual(lib.kinds.color, { bound: 2, total: 3 }, 'the Danger fill is a one-off');
  assert.deepEqual(lib.kinds.spacing, { bound: 1, total: 2 });
  const s = r.files.find((f) => f.name === 'Screens');
  assert.deepEqual(s.kinds.color, { bound: 2, total: 4 }, 'frames bound, titles not');
  assert.deepEqual(s.kinds.type, { bound: 0, total: 8 }, 'each text layer has four eligible typography fields');
  assert.deepEqual(s.kinds.spacing, { bound: 0, total: 2 }, 'the gap of 16 is a one-off');
});

test('report: most-used and unused components and tokens; a token another points at is used', () => {
  const r = useReport([library, screens]);
  assert.deepEqual(r.components.map((c) => [c.name, c.uses]), [['Button', 4]]);
  assert.deepEqual(r.unusedComponents.map((c) => c.name), ['Badge']);
  assert.deepEqual(r.tokens.map((t) => [t.name, t.uses]), [['accent', 2], ['color/blue', 2], ['space/2', 1]]);
  assert.deepEqual(r.unusedTokens.map((t) => t.name), ['space/9'], 'color/blue is used, and accent points at it too');
});

test('report: only handoff pages, only recently edited files', () => {
  const handoff = useReport([library, screens], { handoff: true }).files.find((f) => f.name === 'Screens');
  assert.equal(handoff.layers, 4);
  const recent = useReport([library, screens], { since: Date.parse('2026-10-05') });
  assert.deepEqual(recent.files.map((f) => f.name), [], 'old files and unknown edit dates are excluded');
  assert.equal(recent.scope.unknownDates,1);
});

const design=(children,extra={})=>({id:'file',name:'Design',doc:{pages:[{id:'page',name:'Page',children}],...extra}});
test('report distinguishes linked, local and unresolved instances without counting expanded children',()=>{
  const f=design([{id:'local',type:'component',name:'Local',children:[]},{id:'a',type:'instance',componentId:'local'},{id:'b',type:'instance',componentId:'remote',children:[{type:'rect',fills:[{}]}]},{id:'c',type:'instance',componentId:'missing'}],{componentLibraries:[{fileId:'lib',name:'Library',components:[{id:'remote',name:'Remote',type:'component',children:[]}]}]});
  const r=useReport([f]);assert.equal(r.overall.instances,3);assert.equal(r.overall.layers,3);assert.equal(r.overall.linkedInstances,1);assert.equal(r.overall.localInstances,1);assert.equal(r.overall.unresolvedInstances,1);assert.equal(r.overall.tokenTotal,0);assert.equal(r.findings[0].nodeId,'c');assert.equal(r.findings[0].type,'missing-component');
});
test('report counts only resolved tokens, excludes property-driven fields, and finds missing bindings',()=>{
  const f=design([{id:'a',type:'rect',fills:[{}],bindings:{'fills.0.color':'missing'}},{id:'b',type:'rect',fills:[{}],propRefs:{'fills.0.color':'Color'}},{id:'c',type:'rect',fills:[{}],bindings:{'fills.0.color':'blue'}}],{libraries:[tokens]});
  const r=useReport([f]);assert.deepEqual(r.overall.kinds.color,{bound:1,total:2});assert.equal(r.overall.propertyValues,1);assert.equal(r.overall.unresolvedBindings,1);assert.deepEqual(r.findings.map(f=>[f.type,f.nodeId]),[['missing-token','a']]);
});
test('report measures partial typography binding honestly and full typography tokens as four fields',()=>{
  const f=design([{id:'a',type:'text',bindings:{fontSize:'size'}},{id:'b',type:'text',bindings:{typography:'body'}}],{variables:{collections:[{variables:[{id:'size',type:'number'},{id:'body',type:'typography'}]}]}});
  assert.deepEqual(useReport([f]).overall.kinds.type,{bound:5,total:8});
});
test('report handles individual corners and ignores gradient/image paints and blur effects',()=>{
  const f=design([{id:'a',type:'rect',fills:[{type:'image'},{type:'linear-gradient'}],radii:[2,4,0,8],bindings:{'radii.0':'radius'},effects:[{type:'background-blur'}]}],{variables:{collections:[{variables:[{id:'radius',type:'number'}]}]}});
  const r=useReport([f]);assert.equal(r.overall.unsupported,1);assert.deepEqual(r.overall.kinds.color,{bound:0,total:0});assert.deepEqual(r.overall.kinds.radius,{bound:1,total:3});assert.deepEqual(r.overall.kinds.shadow,{bound:0,total:0});
});
test('report hidden subtree, handoff, reference and file filters alter measured scope',()=>{
  const f=design([{id:'hidden',type:'frame',visible:false,children:[{id:'child',type:'rect',fills:[{}]}]},{id:'shown',type:'rect',fills:[{}]}]);
  assert.equal(useReport([f]).overall.layers,1);assert.equal(useReport([f],{includeHidden:true}).overall.layers,3);
  assert.equal(useReport([f],{handoff:true}).overall.pages,0);assert.equal(useReport([f],{handoff:true}).overall.tokenShare,null);
  assert.equal(useReport([{...f,sample:true}],{includeSamples:false}).files.length,0);assert.equal(useReport([f],{fileId:'other'}).files.length,0);
});
test('report cannot resolve a local token or component using an unrelated file definition',()=>{
  const a=design([{id:'i',type:'instance',componentId:'only-in-other-file'},{id:'r',type:'rect',fills:[{}],bindings:{'fills.0.color':'only-in-other-file'}}]);
  const b={...design([{id:'only-in-other-file',name:'Other',type:'component'}],{variables:{collections:[{variables:[{id:'only-in-other-file',name:'Other',type:'color'}]}]}}),id:'other'};
  const r=useReport([a,b]);assert.equal(r.overall.unresolvedInstances,1);assert.equal(r.overall.unresolvedBindings,1);assert.equal(r.overall.tokenBound,0);
});
test('report filtered-out catalogs do not produce misleading unused inventories; aliases remain used',()=>{
  const r=useReport([library,screens],{fileId:'unknown'});assert.equal(r.unusedTokens.length,0);assert.equal(r.unusedComponents.length,0);
  const alias=useReport([library]);assert.ok(!alias.unusedTokens.some(t=>t.id==='blue'));assert.ok(alias.unusedTokens.some(t=>t.id==='unused'));
});
test('report bounds finding detail without truncating totals and distinguishes zero from no data',()=>{
  const f=design(Array.from({length:80},(_,i)=>({id:String(i),type:'rect',fills:[{}]})));
  const r=useReport([f],{maxFindings:5});assert.equal(r.findings.length,5);assert.equal(r.findingsTotal,80);assert.equal(r.overall.tokenTotal,80);assert.equal(r.overall.tokenShare,0);assert.equal(formatShare(0),'0%');assert.equal(formatShare(null),'—');assert.equal(formatShare(2/3),'67%');assert.equal(formatShare(1/500),'<1%');assert.equal(formatShare(499/500),'>99%');
});
test('report flags known tokens with incompatible types rather than claiming coverage',()=>{
  const f=design([{id:'bad',type:'rect',fills:[{}],bindings:{'fills.0.color':'space-2'}}],{libraries:[tokens]});
  const r=useReport([f]);assert.equal(r.overall.tokenShare,0);assert.equal(r.overall.unresolvedBindings,1);assert.equal(r.findings[0].type,'invalid-token');
});
test('report inventory identifies definitions available both locally and through a linked library',()=>{
  const shared={id:'shared',name:'Shared',type:'component',children:[]};
  const own={...design([shared]),id:'library'};
  const consumer={...design([{id:'use',type:'instance',componentId:'shared'}],{componentLibraries:[{fileId:'library',name:'Library',components:[shared]}]}),id:'consumer'};
  for(const files of [[own,consumer],[consumer,own]]){const r=useReport(files);assert.deepEqual(r.components[0].sources,['linked','local']);assert.equal(r.overall.linkedInstances,1);}
});
