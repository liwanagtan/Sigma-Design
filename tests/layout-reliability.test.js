import {test,eq,ok} from './harness.js';
import {useDoc} from './core.test.js';
import {state,createNode,loadDocument,commit,undo,redo} from '../src/store.js';
import {applyLayouts,DEFAULT_LAYOUT,setSizing} from '../src/layout.js';
import {toProjectFile,fromProjectFile} from '../src/project-format.js';
const box=(w,extra={})=>createNode('rect',{w,h:20,...extra});
const frame=(children,extra={})=>createNode('frame',{w:200,h:100,layout:{...DEFAULT_LAYOUT,gap:0},children,...extra});
test('layout reliability: hug shrinks with content instead of retaining a fill allocation',()=>{
  const anchor=box(200),fill=box(40,{sizingH:'fill'}),parent=frame([anchor,fill],{sizingH:'hug'});useDoc([parent]);applyLayouts();eq([parent.w,fill.w],[200,200]);anchor.w=80;applyLayouts();eq([parent.w,fill.w],[80,80]);
});
test('layout reliability: intrinsic nested fill content measures a hug parent',()=>{
  const child=frame([box(100)],{w:300,sizingH:'fill',layout:{...DEFAULT_LAYOUT,pl:10,pr:10}}),parent=frame([child],{sizingH:'hug',layout:{...DEFAULT_LAYOUT,pl:20,pr:20}});useDoc([parent]);applyLayouts();eq([parent.w,child.w],[160,120]);const before=JSON.stringify(state.doc);applyLayouts();eq(JSON.stringify(state.doc),before);
});
test('layout reliability: simultaneous min and max limits conserve feasible space in either order',()=>{
  for(const reverse of [false,true]){const a=box(10,{sizingH:'fill',minW:150}),b=box(10,{sizingH:'fill',maxW:80}),parent=frame(reverse?[b,a]:[a,b],{layout:{...DEFAULT_LAYOUT,mode:'horizontal',gap:0}});useDoc([parent]);applyLayouts();eq([a.w,b.w],[150,50]);}
});
test('layout reliability: impossible minimums overflow deterministically and hidden/absolute children do not inflate hug',()=>{
  const a=box(10,{sizingH:'fill',minW:150}),b=box(10,{sizingH:'fill',minW:100}),row=frame([a,b],{layout:{...DEFAULT_LAYOUT,mode:'horizontal',gap:0}});useDoc([row]);applyLayouts();eq([a.w,b.w],[150,100]);
  const parent=frame([box(70),box(900,{visible:false}),box(800,{absolute:true})],{sizingH:'hug'});useDoc([parent]);applyLayouts();eq(parent.w,70);
});
test('layout reliability: empty fill preferred size survives growth, shrink and serialization',()=>{
  const fill=box(40,{sizingH:'fill'}),anchor=box(200),parent=frame([fill,anchor],{sizingH:'hug'});useDoc([parent]);applyLayouts();anchor.visible=false;applyLayouts();eq(parent.w,40);
  const snapshot=JSON.stringify(state.doc);loadDocument(JSON.parse(snapshot));applyLayouts();eq(state.doc.pages[0].children[0].w,40);
  const disk=toProjectFile(state.doc).file;loadDocument(fromProjectFile(disk).doc);applyLayouts();eq(state.doc.pages[0].children[0].w,40);
});
test('layout reliability: deep fill-width/hug-height text settles in one normalization and stays stable',()=>{
  const text=createNode('text',{text:'Long text that wraps across a narrow column. '.repeat(8),sizingH:'fill',autoResize:'height',w:400,fontSize:16});
  let root=text;const frames=[];
  for(let i=0;i<12;i++){root=frame([root],{w:400,sizingH:'fill',sizingV:'hug'});frames.push(root);}
  const container=frame([root],{w:120});useDoc([container]);applyLayouts();eq(text.w,120);ok(text.h>100);for(const f of frames)eq(f.h,text.h);
  const before=JSON.stringify(state.doc);applyLayouts();eq(JSON.stringify(state.doc),before);
});

test('layout reliability: cyclic hug/breakpoint geometry is detected instead of silently retried',()=>{
  const parent=frame([box(100)],{w:200,sizingH:'hug',layout:{...DEFAULT_LAYOUT,gap:0,breakpoints:[{maxW:150,pl:100,pr:100}]}});useDoc([parent]);applyLayouts();ok(state.layoutWarnings.some(w=>w.includes('cycle')));
});

test('layout reliability: undo and redo restore authored sizes and recompute fill geometry',()=>{
  const anchor=box(200),fill=box(40,{sizingH:'fill'}),parent=frame([anchor,fill],{sizingH:'hug'});useDoc([parent]);applyLayouts();commit();anchor.w=80;applyLayouts();commit();undo();applyLayouts();eq(state.doc.pages[0].children[0].w,200);redo();applyLayouts();eq(state.doc.pages[0].children[0].w,80);
});
