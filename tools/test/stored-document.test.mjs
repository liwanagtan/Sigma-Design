import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertStoredDocumentShape} from '../../src/document-storage.js';

test('stored document guard rejects damaged structure while preserving legacy scalar values',()=>{
  const legacy={pages:[{children:[{type:'rect',w:'old invalid number'}]}]};
  assert.equal(assertStoredDocumentShape(legacy),legacy);
  for(const doc of [undefined,{}, {pages:'bad'}, {pages:[null]}, {pages:[{children:{}}]}, {pages:[{children:[null]}]}, {kind:'tokens',pages:[]}, {kind:'icons',pages:[],icons:{}}])assert.throws(()=>assertStoredDocumentShape(doc),/Saved/);
  const node={children:[]};node.children.push(node);
  assert.throws(()=>assertStoredDocumentShape({pages:[{children:[node]}]}),/structure/);
});
