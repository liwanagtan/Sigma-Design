import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareImportedDocument,inspectImportedData} from '../../src/document-safety.js';
import {nodeSVG} from '../../src/render.js';

const rect = extra => ({id:'box',type:'rect',x:0,y:0,w:100,h:40,rotation:0,visible:true,opacity:1,strokeWidth:0,fills:[],...extra});
const doc = node => ({name:'Import',pages:[{id:'page',children:[node]}]});
test('document safety: valid documents preserve content and typed geometry',()=>{
  const value=doc(rect({name:'Quotes " and <text> are content'}));
  assert.equal(prepareImportedDocument(value),value);
  assert.equal(value.pages[0].children[0].name,'Quotes " and <text> are content');
});
test('document safety: rejects malformed geometry, IDs, structure, remote assets and cycles',()=>{
  for(const node of [rect({w:'10" onload="bad'}),rect({id:'bad"'}),rect({children:{}}),rect({fontFamily:'Arial; background:url(https://example.com)'}),rect({type:'image',src:'https://example.com/tracker.png'})])assert.throws(()=>prepareImportedDocument(doc(node)));
  assert.throws(()=>prepareImportedDocument({pages:[{}]}));
  assert.throws(()=>inspectImportedData(JSON.parse('{"__proto__":{}}')));
  const circular={};circular.loop=circular;assert.throws(()=>inspectImportedData(circular));
});
test('document safety: cleans nested published component icon artwork without changing IDs',()=>{
  const icon={id:'glyph',name:'Glyph',viewBox:'0 0 24 24',body:'<path d="M0 0L10 10" onload="bad()"/><script>bad()</script>'};
  const value=doc(rect());value.componentLibraries=[{icons:{glyph:icon}}];
  prepareImportedDocument(value);
  assert.equal(icon.id,'glyph');assert.ok(!/script|onload/.test(icon.body));
});
test('renderer: legacy paints, effects, dimensions and IDs cannot break attributes',()=>{
  const payload='red" onpointerenter="globalThis.bad=1';
  const svg=nodeSVG(rect({id:payload,w:'40" onload="bad()',fills:[{color:payload}],effects:[{type:'drop-shadow',color:payload,opacity:1,x:0,y:0,blur:2}]}));
  assert.ok(!svg.includes('" onpointerenter="'));assert.ok(!svg.includes('" onload="'));
  assert.ok(svg.includes('&quot;'));
});

test('document safety: linked tokens and mode overrides cannot smuggle nonnumeric geometry',()=>{
  const value=doc(rect());value.libraries=[{collections:[{id:'core',variables:[{id:'size',type:'number',valuesByMode:{light:'100" onload="bad()'}}]}]}];
  assert.throws(()=>prepareImportedDocument(value),/Invalid number token/);
  value.libraries[0].collections[0].variables[0].valuesByMode.light=100;
  value.variables={collections:[{extends:'core',overrides:{size:{dark:'100" onload="bad()'}}}]};
  assert.throws(()=>prepareImportedDocument(value),/Invalid number token/);
});
