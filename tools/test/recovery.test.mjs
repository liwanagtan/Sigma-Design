import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeRecovery,recoveryEntries,recoveredDocument,removeRecovery} from '../../src/recovery.js';
function storage(){const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i],getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
const doc=name=>({name,pages:[{id:'page',children:[]}],project:{path:'original'},published:{version:1},branch:{of:'main'}});
test('recovery: different tabs and files retain independent entries without applying any edits',()=>{
  const s=storage();writeRecovery(s,'tab-a',{id:'file',doc:doc('A')});writeRecovery(s,'tab-b',{id:'file',doc:doc('B')});writeRecovery(s,'tab-a',{id:'other',doc:doc('C')});
  assert.equal(recoveryEntries(s).length,3);assert.equal(recoveryEntries(s,{fileId:'file'}).length,2);
  writeRecovery(s,'tab-a',{id:'file',doc:doc('A updated')});assert.equal(s.length,3);
  assert.ok(recoveryEntries(s).some(e=>e.record.name==='B'));
});
test('recovery: legacy and corrupt entries stay available, and recovered documents are independent drafts',()=>{
  const s=storage();s.setItem('sigma.pending',JSON.stringify({id:'file',doc:doc('Legacy')}));s.setItem('sigma.pending.bad','not JSON');
  const entries=recoveryEntries(s);assert.equal(entries.length,2);assert.equal(s.length,2);
  const restored=recoveredDocument(entries.find(e=>e.record).record);
  assert.equal(restored.name,'Legacy (recovered)');assert.equal(restored.project,undefined);assert.equal(restored.published,undefined);assert.equal(restored.branch,undefined);
});
test('recovery: discard compares the exact reviewed entry and never removes newer edits',()=>{
  const s=storage(),key=writeRecovery(s,'tab',{id:'file',doc:doc('Before')});const entry=recoveryEntries(s)[0];
  writeRecovery(s,'tab',{id:'file',doc:doc('After')});assert.equal(removeRecovery(s,key,entry.raw),false);assert.equal(s.length,1);
  assert.equal(removeRecovery(s,key,s.getItem(key)),true);assert.equal(s.length,0);
});
test('recovery: shared artwork stays compact and blocked storage fails visibly to callers',()=>{
  const s=storage(),image='data:image/png;base64,'+'A'.repeat(10000),d=doc('Images');d.figmaImport={warnings:[]};d.pages[0].children=Array.from({length:100},(_,i)=>({id:'img'+i,type:'image',src:image}));
  const key=writeRecovery(s,'tab',{id:'file',doc:d});assert.ok(s.getItem(key).length<50000);assert.equal(recoveredDocument(recoveryEntries(s)[0].record).pages[0].children.length,100);
  assert.throws(()=>writeRecovery({setItem(){throw Error('Quota exceeded');}},'tab',{id:'file',doc:d}),/Quota/);
});
