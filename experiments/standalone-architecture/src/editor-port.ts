// The only untyped boundary: delegates to Sigma's real store/layout/history.
// No browser database and no second canonical document are created.
import * as legacy from '../../../src/store.js';
import {applyLayouts, DEFAULT_LAYOUT} from '../../../src/layout.js';
import {serializeDocument, deserializeDocument} from '../../../src/document-storage.js';
import {parseNumberExpression} from '../../../src/number-expression.js';

type Node = {id:string;type:string;name:string;x:number;y:number;w:number;h:number;children?:Node[]};
type Doc = {name:string;pages:{id:string;name:string;children:Node[]}[];currentPageId:string};
type Core = {
  state:{doc:Doc|null};
  createNode(type:string,props:Record<string,unknown>):Node;
  loadDocument(doc:Doc):void;
  getNode(id:string):Node|undefined;
  subscribe(listener:(kind:string)=>void):()=>void;
  addNormalizer(fn:()=>void):void;
  editNode(node:Node,keys:string[],mutate:(node:Node)=>void):boolean;
  commit():void;undo():void;redo():void;normalizeDocument():void;
};
const core=legacy as unknown as Core;
const first=core.createNode('rect',{id:'prototype-first',name:'First item',w:80,h:40});
const second=core.createNode('rect',{id:'prototype-fill',name:'Fill item',w:40,h:40,sizingH:'fill'});
const parent=core.createNode('frame',{id:'prototype-frame',name:'Hug row',w:400,h:64,sizingH:'hug',sizingV:'hug',layout:{...DEFAULT_LAYOUT,mode:'horizontal',gap:8,pl:12,pr:12,pt:12,pb:12},children:[first,second]});
// createNode deliberately generates IDs; assign stable fixture identities only here.
first.id='prototype-first';second.id='prototype-fill';parent.id='prototype-frame';
const fixture:Doc={name:'Architecture fixture',pages:[{id:'prototype-page',name:'Page',children:[parent]}],currentPageId:'prototype-page'};
core.addNormalizer(applyLayouts);core.loadDocument(fixture);core.normalizeDocument();
// Normalize once before the initial undo baseline, as the editor does on open.
core.loadDocument(deserializeDocument(serializeDocument(core.state.doc)) as Doc);
export type Snapshot=Readonly<{name:string;width:number;frameWidth:number;frameHeight:number;fillWidth:number;firstX:number;firstY:number;fillX:number;fillY:number;revision:number}>;
let revision=0;
function read():Snapshot {
  const first=core.getNode('prototype-first')!,frame=core.getNode('prototype-frame')!,fill=core.getNode('prototype-fill')!;
  return Object.freeze({name:first.name,width:first.w,frameWidth:frame.w,frameHeight:frame.h,fillWidth:fill.w,firstX:first.x,firstY:first.y,fillX:fill.x,fillY:fill.y,revision});
}
let snapshot=read();
const listeners=new Set<()=>void>();
core.subscribe(kind=>{if(kind!=='doc')return;revision++;snapshot=read();for(const listener of listeners)listener();});
export const editor={
  getSnapshot:()=>snapshot,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  setName(name:string){const node=core.getNode('prototype-first')!;if(core.editNode(node,['name'],node=>node.name=name))core.commit();},
  setWidth(expression:string){const width=parseNumberExpression(expression);if(width===null||width===undefined||width<1||width>1000)throw Error('Enter a width from 1 to 1000, or an arithmetic expression.');const node=core.getNode('prototype-first')!;if(core.editNode(node,['w'],node=>node.w=width))core.commit();},
  undo:()=>core.undo(),redo:()=>core.redo(),
  reopen(){const text=serializeDocument(core.state.doc);core.loadDocument(deserializeDocument(text) as Doc);return text;},
};
