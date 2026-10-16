// Compare against Sigma's actual layout implementation, not a second expected model.
import assert from 'node:assert/strict';
import Yoga from 'yoga-layout';
import {createNode,loadDocument,state} from '../../src/store.js';
import {applyLayouts,DEFAULT_LAYOUT} from '../../src/layout.js';
const fixtures=[
  {name:'Hug row / fixed children',hug:true,children:[{w:80},{w:40}]},
  {name:'Fixed row / equal Fill allocation',width:300,children:[{w:80,fill:true},{w:40,fill:true}]},
  {name:'Fixed row / clamped Fill allocation',width:300,children:[{w:80,fill:true,max:90},{w:40,fill:true}]},
  {name:'Hug row / intrinsic Fill preference',hug:true,children:[{w:80},{w:40,fill:true}]},
];
function sigma(fixture){
  const children=fixture.children.map((child,i)=>createNode('rect',{id:'child-'+i,w:child.w,h:40,sizingH:child.fill?'fill':'fixed',...(child.max?{maxW:child.max}:{})}));
  const frame=createNode('frame',{id:'frame',w:fixture.width||400,h:64,sizingH:fixture.hug?'hug':'fixed',sizingV:'hug',layout:{...DEFAULT_LAYOUT,mode:'horizontal',gap:8,pl:12,pr:12,pt:12,pb:12},children});
  loadDocument({name:'Yoga comparison',pages:[{id:'page',children:[frame]}],currentPageId:'page'});applyLayouts();
  return [frame.w,...frame.children.map(child=>child.w)];
}
function yoga(fixture,aware){
  const frame=Yoga.Node.create();frame.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);frame.setGap(Yoga.GUTTER_COLUMN,8);frame.setPadding(Yoga.EDGE_ALL,12);frame.setAlignItems(Yoga.ALIGN_FLEX_START);
  if(!fixture.hug)frame.setWidth(fixture.width);
  try {
    fixture.children.forEach((child,i)=>{
      const node=Yoga.Node.create();node.setWidth(child.w);node.setHeight(40);node.setFlexShrink(0);
      if(child.fill&&!(aware&&fixture.hug)){node.setFlexGrow(1);node.setFlexBasis(0);}
      if(child.max)node.setMaxWidth(child.max);frame.insertChild(node,i);
    });
    frame.calculateLayout(undefined,undefined,Yoga.DIRECTION_LTR);
    return [frame.getComputedWidth(),...fixture.children.map((_,i)=>frame.getChild(i).getComputedWidth())];
  }finally{frame.freeRecursive();}
}
const rows=fixtures.map(fixture=>{
  const baseline=sigma(fixture),naive=yoga(fixture,false),aware=yoga(fixture,true);
  assert.deepEqual(aware,baseline,fixture.name+' needs a Sigma-aware adapter');
  return {fixture:fixture.name,sigma:baseline,naiveYoga:naive,sigmaAwareYoga:aware,naiveMatches:JSON.stringify(baseline)===JSON.stringify(naive)};
});
console.log(JSON.stringify({yogaVersion:'3.2.1',units:'pixels; [parent width, ...child widths]',rows,note:'Four rectangular rows only. No text, nesting, variants, breakpoints, RTL, undo or browser performance proof.'},null,2));
state.doc=null;
