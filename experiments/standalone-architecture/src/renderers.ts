import {Canvas,Rect} from 'fabric';
import Konva from 'konva';
import * as store from '../../../src/store.js';
import {renderScene} from '../../../src/render.js';
import {hitPath} from '../../../src/hit.js';
import '../../../styles.css';
import './renderer.css';

type Box={id:string;type:string;name:string;x:number;y:number;w:number;h:number;rotation:number;visible:boolean;opacity:number;locked:boolean;fills:{color:string;opacity:number;visible:boolean}[];strokes:unknown[]};
type Surface={update:(x:number)=>void;pick:()=>string|null;export:()=>string;dispose:()=>void|Promise<unknown>};
const width=640,height=460,ns='http://www.w3.org/2000/svg';
const core=store as unknown as {createNode(type:string,props:Record<string,unknown>):Box;loadDocument(doc:unknown):void};
const makeBoxes=(count:number)=>Array.from({length:count},(_,index)=>{
  const node=core.createNode('rect',{x:(index%80)*8,y:Math.floor(index/80)*7,w:6,h:5,fill:index%2?'#0D99FF':'#9747FF'});
  node.id='benchmark-'+index;return node;
});
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
function targetSection(name:string){const section=document.createElement('section');const title=document.createElement('h2');title.textContent=name;section.append(title);document.querySelector('#surfaces')!.append(section);return section;}
function svgSurface(nodes:Box[],section:HTMLElement):Surface {
  core.loadDocument({name:'Renderer benchmark',pages:[{id:'benchmark-page',name:'Page',children:nodes}],currentPageId:'benchmark-page'});
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
  const world=document.createElementNS(ns,'g');svg.append(world);section.append(svg);renderScene(world);
  return {update(x){nodes[0].x=x;renderScene(world);},pick(){const path=hitPath({x:3,y:2});return path?.at(-1)?.id||null;},export:()=>new XMLSerializer().serializeToString(svg),dispose(){svg.remove();}};
}
function fabricSurface(nodes:Box[],section:HTMLElement):Surface {
  const el=document.createElement('canvas');section.append(el);
  const canvas=new Canvas(el,{width,height,renderOnAddRemove:false,enableRetinaScaling:true,selection:false});
  const objects=nodes.map(node=>{
    const object=new Rect({left:node.x,top:node.y,width:node.w,height:node.h,originX:'left',originY:'top',fill:node.fills[0].color,strokeWidth:0,objectCaching:false});
    object.set('sigmaId',node.id);return object;
  });canvas.add(...objects);canvas.renderAll();
  return {update(x){objects[0].set({left:x});objects[0].setCoords();canvas.renderAll();},pick(){const bounds=canvas.upperCanvasEl.getBoundingClientRect();const result=canvas.findTarget(new MouseEvent('mousemove',{clientX:bounds.left+3,clientY:bounds.top+2}));return result.target?.get('sigmaId')||null;},export:()=>canvas.toSVG(),dispose:()=>canvas.dispose()};
}
function konvaSurface(nodes:Box[],section:HTMLElement):Surface {
  const el=document.createElement('div');section.append(el);const stage=new Konva.Stage({container:el,width,height}),layer=new Konva.Layer();stage.add(layer);
  const objects=nodes.map(node=>new Konva.Rect({id:node.id,x:node.x,y:node.y,width:node.w,height:node.h,fill:node.fills[0].color}));
  layer.add(...objects);layer.draw();
  return {update(x){objects[0].x(x);layer.draw();},pick:()=>stage.getIntersection({x:3,y:2})?.id()||null,export:()=>stage.toDataURL({pixelRatio:1}),dispose(){stage.destroy();}};
}
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const button=document.querySelector<HTMLButtonElement>('#run')!,status=document.querySelector<HTMLElement>('#status')!;
let report='';
button.onclick=async()=>{
  button.disabled=true;document.querySelector('#surfaces')!.textContent='';document.querySelector<HTMLButtonElement>('#download')!.disabled=true;
  report='';document.querySelector('#results')!.textContent='';
  const count=Number(document.querySelector<HTMLSelectElement>('#count')!.value),rows=[];
  try {
    const baseline=makeBoxes(count),canonical=JSON.stringify(baseline);
    for(const [name,create] of [['Sigma SVG',svgSurface],['Fabric 7.4.0',fabricSurface],['Konva 10.9.0',konvaSurface]] as const) {
      status.textContent='Measuring '+name+'…';await frame();
      // renderScene keeps a module-level cache across roots. Reset it outside
      // timing so repeated runs don't compare cached SVG objects to fresh canvases.
      if(name==='Sigma SVG') {
        core.loadDocument({name:'Empty cache reset',pages:[{id:'empty',children:[]}],currentPageId:'empty'});
        renderScene(document.createElementNS(ns,'g'));
      }
      const section=targetSection(name),nodes=structuredClone(baseline);
      const start=performance.now(),surface=create(nodes,section),initial=performance.now()-start;
      try {
        const picked=surface.pick();if(picked!=='benchmark-0')throw new Error(name+' hit test returned '+picked);
        const hits=[];for(let sample=0;sample<20;sample++){const started=performance.now();surface.pick();hits.push(performance.now()-started);}
        const updates=[];for(let sample=0;sample<20;sample++){const started=performance.now();surface.update((sample%2)+1);updates.push(performance.now()-started);await frame();}
        const exported=surface.export();if(!exported.length)throw new Error(name+' export was empty');
        rows.push({renderer:name,initialSetupAndDrawMs:initial,medianUpdateCallMs:median(updates),medianPickMs:median(hits),exportFormat:name.startsWith('Konva')?'PNG data URL':'SVG',exportCharacters:exported.length,hitIdentity:picked,samples:20});
      }finally{await surface.dispose();section.remove();}
    }
    if(JSON.stringify(baseline)!==canonical)throw new Error('Renderer mutated shared fixture');
    report=JSON.stringify({count,width,height,freshSceneObjects:true,svgCacheReset:true,devicePixelRatio:devicePixelRatio,browser:navigator.userAgent,measuredAt:new Date().toISOString(),rows,scope:'One mount per renderer, 20 update/pick samples. Synchronous call times only; SVG browser paint is deferred, canvas drawing differs. No end-to-end latency, memory or renderer ranking claim. No text, nesting, clipping, icons or interaction/editor parity proof.'},null,2);
    document.querySelector('#results')!.textContent=report;status.textContent='Comparison passed: all hit identities and exports present; shared fixture unchanged.';document.querySelector<HTMLButtonElement>('#download')!.disabled=false;
  }catch(error){status.textContent='Comparison failed: '+(error as Error).message;}
  finally{button.disabled=false;}
};
// Measurement download is explicit and local; no result is sent anywhere.
(document.querySelector('#download') as HTMLButtonElement).onclick=()=>{
  const url=URL.createObjectURL(new Blob([report],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='sigma-renderer-measurements.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
