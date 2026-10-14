import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { importFigmaBytes, convertFigmaDocument } from '../../src/figma-import.js';
import { localMatrix } from '../../src/store.js';
const fixture=name=>new Uint8Array(readFileSync(new URL(`../../tests/fixtures/${name}`,import.meta.url)));
const guid=localID=>({sessionID:1,localID});
const raw=(id,type,parent=1,extra={})=>({guid:guid(id),parentIndex:{guid:guid(parent),position:'!'},type,name:type,size:{x:100,y:50},...extra});
const document=nodes=>({nodes:[raw(1,'CANVAS',0,{name:'Page'}),...nodes],images:new Map(),message:{blobs:[]}});

test('Figma: genuine Figma export preserves vector artwork and hides internal pages',()=>{
  const {doc,report}=importFigmaBytes(fixture('figma-openfig.fig'),{name:'OpenFig import'});
  assert.equal(doc.name,'OpenFig import'); assert.equal(doc.pages.length,1);
  assert.ok(report.counts.vectors>0);
  const images=[]; const visit=n=>{if(n.type==='image')images.push(n);(n.children||[]).forEach(visit);};doc.pages[0].children.forEach(visit);
  assert.ok(images.some(n=>n.src.startsWith('data:image/svg+xml') && decodeURIComponent(n.src).includes('<path')));
});
test('Figma: binary archive imports an editable frame, text and basic shapes in order',()=>{
  const {doc}=importFigmaBytes(fixture('figma-basic.fig'));
  assert.equal(doc.pages.length,1);
  const frame=doc.pages[0].children[0]; assert.equal(frame.type,'frame');assert.equal(frame.w,640);assert.equal(frame.x,80);
  assert.deepEqual(frame.children.map(n=>n.name),['Headline','Description','Action button','Button label','Accent','Triangle']);
  assert.equal(frame.children[0].text,'Imported from Figma');assert.equal(frame.children[0].fontWeight,700);assert.equal(frame.children[0].fontSize,32);
  assert.equal(frame.children[2].type,'rect');assert.equal(frame.children[2].radius,8);
  assert.equal(frame.children[4].type,'ellipse');assert.equal(frame.children[5].type,'image');
});
test('Figma: rejects invalid or truncated archives instead of opening a blank file',()=>{
  for(const bytes of [new Uint8Array(3),new TextEncoder().encode('{"pages":[]}                 '),fixture('figma-basic.fig').slice(0,80)]) assert.throws(()=>importFigmaBytes(bytes),/valid|decoded/);
});
test('Figma: removed layers, hidden layers, ordering and rotated coordinates',()=>{
  const d=document([raw(2,'RECTANGLE',1,{name:'Removed',phase:'REMOVED'}),raw(3,'RECTANGLE',1,{name:'Top',visible:false,parentIndex:{guid:guid(1),position:'z'}}),raw(4,'RECTANGLE',1,{name:'Bottom',transform:{m00:0,m01:-1,m02:20,m10:1,m11:0,m12:30}})]);
  const {doc}=convertFigmaDocument(d), nodes=doc.pages[0].children;
  assert.deepEqual(nodes.map(n=>n.name),['Bottom','Top']);assert.equal(nodes[1].visible,false);
  const matrix=localMatrix(nodes[0]);assert.ok(Math.abs(matrix[4]-20)<.001);assert.ok(Math.abs(matrix[5]-30)<.001);assert.equal(nodes[0].rotation,90);
});
test('Figma: instances expand symbol content and text overrides into editable frames',()=>{
  const d=document([raw(2,'SYMBOL',99),raw(3,'TEXT',2,{overrideKey:guid(30),textData:{characters:'Default'}}),raw(4,'INSTANCE',1,{symbolData:{symbolID:guid(2),symbolOverrides:[{guidPath:{guids:[guid(30)]},textData:{characters:'Custom'}}]}})]);
  const {doc,report}=convertFigmaDocument(d);assert.equal(doc.pages[0].children[0].type,'frame');assert.equal(doc.pages[0].children[0].children[0].text,'Custom');assert.equal(report.counts.instances,1);
});
test('Figma: image bytes are embedded and absent assets are reported',()=>{
  const bytes=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=','base64'));
  const d=document([raw(2,'RECTANGLE',1,{fillPaints:[{type:'IMAGE',image:{hash:'picture'}}]})]);d.images.set('picture',bytes);
  const {doc,report}=convertFigmaDocument(d);assert.equal(report.counts.images,1);assert.ok(decodeURIComponent(doc.pages[0].children[0].src).includes('data:image/png;base64'));
  d.images.clear();assert.ok(convertFigmaDocument(d).report.warnings.some(w=>/Missing/.test(w.message)));
});
test('Figma: unsupported content is reported and definition cycles do not recurse forever',()=>{
  const d=document([raw(2,'INSTANCE',1,{symbolData:{symbolID:guid(3)}}),raw(3,'SYMBOL',99),raw(4,'INSTANCE',3,{symbolData:{symbolID:guid(3)}}),raw(5,'UNKNOWN_SHAPE')]);
  const r=convertFigmaDocument(d);assert.ok(r.report.warnings.some(w=>/Cyclic/.test(w.message)));assert.ok(r.report.warnings.some(w=>/Unsupported shapes/.test(w.message)));
});
test('Figma: vendored parser matches pinned dependencies',()=>{
  execFileSync(process.execPath,['tools/figma/build.mjs','--check'],{cwd:new URL('../../',import.meta.url)});
});

test('Figma: transfer chunks preserve Unicode and shared artwork without cloning the graph', async()=>{
  const {encodeFigmaResult,decodeFigmaResult}=await import('../../src/figma-import-transfer.js');
  const value={doc:{pages:[{name:'Unicode',children:[{text:'🟣 "Hello"\n'.repeat(10000),src:'data:image/png;base64,ABCD'}]}]},report:{warnings:[]}};
  const chunks=encodeFigmaResult(value);
  assert.ok(chunks.length>1);
  const received=structuredClone({chunks},{transfer:chunks});
  assert.ok(chunks.every(chunk=>chunk.byteLength===0),'buffers transfer ownership rather than copy');
  assert.deepEqual(decodeFigmaResult(received.chunks),value);
});
test('Figma: oversized expanded results fail with an actionable memory-budget error',async()=>{
  const {encodeFigmaResult,decodeFigmaResult,figmaImportError}=await import('../../src/figma-import-transfer.js');
  assert.throws(()=>encodeFigmaResult({text:'x'.repeat(65536)},{maxBytes:1000}),/memory budget/);
  assert.throws(()=>decodeFigmaResult([new ArrayBuffer(1001)],{maxBytes:1000}),/memory budget/);
  assert.match(figmaImportError(new Error('Data cannot be cloned, out of memory.')),/Export fewer pages/);
});
test('Figma: repeated artwork exceeding 128 MB travels once and restores every layer',async()=>{
  const {encodeFigmaResult,decodeFigmaResult}=await import('../../src/figma-import-transfer.js');
  const src='data:image/svg+xml;charset=utf-8,'+'A'.repeat(65536);
  const children=Array.from({length:4096},(_,i)=>({id:String(i),type:'image',src}));
  assert.ok(src.length*children.length>256*1024*1024);
  const value={doc:{pages:[{children}]},report:{warnings:[]}};
  const chunks=encodeFigmaResult(value,{maxBytes:1024*1024});
  assert.ok(chunks.reduce((sum,chunk)=>sum+chunk.byteLength,0)<1024*1024);
  assert.deepEqual(decodeFigmaResult(chunks),value);
});
test('Figma: corrupt shared artwork references are rejected',async()=>{
  const {decodeFigmaResult}=await import('../../src/figma-import-transfer.js');
  const packed={format:'sigma-fig-transfer-2',strings:[],value:{doc:{pages:[{src:{$sigmaFigString:0}}]},report:{}}};
  assert.throws(()=>decodeFigmaResult([new TextEncoder().encode(JSON.stringify(packed)).buffer]),/artwork reference/);
});
test('Figma: decoder accepts the earlier worker format during app updates',async()=>{
  const {decodeFigmaResult}=await import('../../src/figma-import-transfer.js');
  const value={doc:{pages:[{children:[]}]},report:{warnings:[]}};
  assert.deepEqual(decodeFigmaResult([new TextEncoder().encode(JSON.stringify(value)).buffer]),value);
});
test('Figma: 100 MB input archive can skip unrelated payloads and import a small design',async()=>{
  const {unzipSync,zipSync}=await import('fflate');
  const original=unzipSync(fixture('figma-basic.fig'));
  const bytes=zipSync({...original,'unrelated-cache.bin':new Uint8Array(100*1024*1024)},{level:0});
  assert.ok(bytes.length>100*1024*1024);
  const {doc}=importFigmaBytes(bytes);
  assert.equal(doc.pages[0].children[0].name,'Product card');
});
