import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNode,loadDocument,state} from '../../src/store.js';
import {applyLayouts,DEFAULT_LAYOUT,distributeFill} from '../../src/layout.js';
import {toProjectFile,fromProjectFile} from '../../src/project-format.js';
const load=root=>loadDocument({name:'Layout regression',pages:[{id:'p',name:'Page',children:[root]}],currentPageId:'p'});
for(const axis of ['w','h'])test(`intrinsic ${axis}: hug/fill growth and shrink survives project save/reopen`,()=>{
  const sizing=axis==='w'?'sizingH':'sizingV',mode=axis==='w'?'vertical':'horizontal';
  const fixed=createNode('rect',{w:20,h:20,[axis]:200});
  const fill=createNode('rect',{w:20,h:20,[axis]:40,[sizing]:'fill'});
  const parent=createNode('frame',{[sizing]:'hug',layout:{...DEFAULT_LAYOUT,mode,gap:0},children:[fixed,fill]});load(parent);applyLayouts();assert.equal(parent[axis],200);
  fixed[axis]=80;applyLayouts();assert.deepEqual([parent[axis],fill[axis]],[80,80]);fixed.visible=false;applyLayouts();assert.equal(parent[axis],40);
  const disk=toProjectFile(state.doc).file;loadDocument(fromProjectFile(disk).doc);applyLayouts();assert.equal(state.doc.pages[0].children[0][axis],40);
});
test('constrained fill conserves feasible space and is permutation invariant across varied limits',()=>{
  let seed=412;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
  for(let trial=0;trial<150;trial++){
    const nodes=Array.from({length:2+Math.floor(random()*6)},()=>{const minW=1+Math.floor(random()*100);return {minW,maxW:minW+Math.floor(random()*200)};});
    const minimum=nodes.reduce((s,n)=>s+n.minW,0),maximum=nodes.reduce((s,n)=>s+n.maxW,0),available=minimum+random()*(maximum-minimum);
    const sizes=distributeFill(nodes,'w',available);assert.ok(Math.abs(sizes.reduce((a,b)=>a+b,0)-available)<.00001);
    sizes.forEach((s,i)=>assert.ok(s>=nodes[i].minW&&s<=nodes[i].maxW));
    assert.deepEqual(distributeFill([...nodes].reverse(),'w',available).reverse().map(n=>Math.round(n*10000)),sizes.map(n=>Math.round(n*10000)));
  }
});
test('nested intrinsic fill frames ignore their old allocations and respect padding',()=>{
  const content=createNode('rect',{w:100,h:20});const inner=createNode('frame',{w:300,sizingH:'fill',layout:{...DEFAULT_LAYOUT,pl:10,pr:10},children:[content]});const outer=createNode('frame',{sizingH:'hug',layout:{...DEFAULT_LAYOUT,pl:20,pr:20},children:[inner]});load(outer);applyLayouts();assert.deepEqual([outer.w,inner.w],[160,120]);const first=JSON.stringify(state.doc);applyLayouts();assert.equal(JSON.stringify(state.doc),first);
});
