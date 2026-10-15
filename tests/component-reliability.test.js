import {test,eq,ok} from './harness.js';
import {useDoc} from './core.test.js';
import {createNode,state,loadDocument,select} from '../src/store.js';
import {createInstance,syncInstances,addComponentProp,bindLayerProp,nestedInstances,componentContext,mainTarget} from '../src/components.js';
import {componentPanel,onComponentChange} from '../src/component-ui.js';
import {spacingRegions,spacingOverlay} from '../src/layout-overlay.js';
import {DEFAULT_LAYOUT,applyLayouts} from '../src/layout.js';
import {togglePin} from '../src/constraints.js';
import {layOutDocument} from '../src/lay-out.js';
const text=()=>createNode('text',{name:'Label',text:'Default',autoResize:'fixed',w:60,h:20});
test('component reliability: exposure is scoped to a variant and nested edits survive sync and reopen',()=>{
  const main=createNode('component',{name:'Button',children:[text()]});useDoc([main]);const prop=addComponentProp(main,'text',{name:'Label',value:'Default'});bindLayerProp(main.children[0],'text',prop);
  const one=createNode('component',{name:'Type=One',children:[]}),two=createNode('component',{name:'Type=Two',children:[]});
  const nested=createInstance(main,{parent:one});nested.exposed=true;
  const other=createInstance(main,{parent:two});other.name='Other variant';
  const set=createNode('componentSet',{name:'Container',children:[one,two]});useDoc([main,set]);syncInstances();
  eq(nestedInstances(one).map(n=>n.id),[nested.id]);eq(nestedInstances(two).map(n=>n.id),[other.id]);
  const inst=createInstance(one);syncInstances();select([inst.id]);const host=document.createElement('div');host.innerHTML=componentPanel([inst]);
  const input=host.querySelector(`[data-instance-prop="${prop}"]`);ok(input,'outer instance exposes nested property');input.value='Custom';onComponentChange(input);syncInstances();eq(inst.children[0].children[0].text,'Custom');eq(main.children[0].text,'Default');
  const saved=JSON.stringify(state.doc);loadDocument(JSON.parse(saved));syncInstances();const reopened=state.doc.pages[0].children.find(n=>n.id===inst.id);eq(reopened.children[0].children[0].text,'Custom');
  host.innerHTML=componentPanel([state.doc.pages[0].children.find(n=>n.id===set.id).children[0]]);ok(host.textContent.includes('Edit component properties'));ok(!host.querySelector('[data-prop-add]'),'variant does not edit shared schema implicitly');
});
test('component reliability: ownership colors include definition and instance descendants; navigation uses nearest main',()=>{
  const inner=createNode('component',{name:'Inner',children:[text()]}),outer=createNode('component',{name:'Outer',children:[]});useDoc([inner,outer]);createInstance(inner,{parent:outer});syncInstances();const instance=createInstance(outer);syncInstances();
  eq(componentContext(inner.children[0]).kind,'definition-child');eq(componentContext(instance.children[0].children[0]).kind,'instance-child');eq(mainTarget(instance.children[0]).id,inner.id);eq(mainTarget(instance.children[0].children[0]).id,inner.id);
});
test('layout spacing feedback uses actual padding/gaps and excludes absolute/hidden layers',()=>{
  const a=createNode('rect',{w:30,h:20}),b=createNode('rect',{w:30,h:20});
  const parent=createNode('frame',{w:100,h:80,rotation:25,layout:{...DEFAULT_LAYOUT,mode:'horizontal',gap:10,pt:12,pr:10,pb:12,pl:10},children:[a,b,createNode('rect',{w:900,visible:false}),createNode('rect',{absolute:true,w:900})]});useDoc([parent]);applyLayouts();const regions=spacingRegions(parent);eq(regions.filter(r=>r.kind==='gap').map(r=>r.w),[10]);eq(regions.filter(r=>r.kind==='padV').map(r=>r.h),[12,12]);ok(spacingOverlay(parent,p=>p).includes('data-spacing-region'));ok(!spacingOverlay(parent,p=>p,'gap').includes('data-spacing-region="padV"'));
});
test('constraint pins combine, unpin and center deterministically',()=>{eq(togglePin(undefined,'h','right'),'leftRight');eq(togglePin('left','h','right'),'leftRight');eq(togglePin('leftRight','h','left'),'right');eq(togglePin('right','h','right'),'center');eq(togglePin('center','v','bottom'),'bottom');});
test('shared layout pipeline resolves component-dependent sizing and is idempotent',()=>{
  const child=createNode('rect',{w:80,h:20}),main=createNode('component',{w:400,h:100,sizingH:'hug',sizingV:'hug',layout:{...DEFAULT_LAYOUT,gap:0},children:[child]});useDoc([main]);const inst=createInstance(main);layOutDocument();eq([main.w,inst.w],[80,80]);child.w=120;layOutDocument();eq([main.w,inst.w],[120,120]);const before=JSON.stringify(state.doc);layOutDocument();eq(JSON.stringify(state.doc),before);
});
