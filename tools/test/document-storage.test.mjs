import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeDocumentRecord,decodeDocumentRecord,serializeDocument,deserializeDocument} from '../../src/document-storage.js';

test('document storage: ordinary records retain their existing shape',()=> {
  const record={id:'plain',doc:{pages:[]},views:{}};
  assert.equal(encodeDocumentRecord(record),record);
  assert.equal(decodeDocumentRecord(record),record);
  assert.deepEqual(deserializeDocument(serializeDocument(record.doc)),record.doc);
});
test('document storage: Figma records and history share repeated sources',()=> {
  const src='data:image/svg+xml,'+'A'.repeat(65536);
  const doc={figmaImport:{warnings:[]},pages:[{children:Array.from({length:8192},()=>({src}))}]};
  const record={id:'large',doc,views:{p:{zoom:1}},extra:'preserved'};
  const stored=encodeDocumentRecord(record);
  assert.ok(!stored.doc);
  assert.ok(stored.figmaDocumentChunks.reduce((n,b)=>n+b.byteLength,0)<1024*1024);
  assert.deepEqual(decodeDocumentRecord(structuredClone(stored)),record);
  const snapshot=serializeDocument(doc);
  assert.ok(snapshot.length<1024*1024);
  assert.deepEqual(deserializeDocument(snapshot),doc);
});
