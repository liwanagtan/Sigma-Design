import { encodeFigmaResult, decodeFigmaResult } from './figma-import-transfer.js';

// IndexedDB otherwise clones a repeated image source for every layer using it.
// Keep the public document shape unchanged; share artwork in stored records.
export function encodeDocumentRecord(record) {
  if(!record?.doc?.figmaImport) return record;
  const {doc,...rest}=record;
  return {...rest,figmaDocumentChunks:encodeFigmaResult({doc,report:doc.figmaImport})};
}
export function decodeDocumentRecord(record) {
  if(!record?.figmaDocumentChunks) return record;
  const {figmaDocumentChunks,...rest}=record;
  return {...rest,doc:decodeFigmaResult(figmaDocumentChunks).doc};
}

export function serializeDocument(doc) {
  if(!doc?.figmaImport) return JSON.stringify(doc);
  const decoder=new TextDecoder();
  const parts=encodeFigmaResult({doc,report:doc.figmaImport}).map(chunk=>decoder.decode(chunk,{stream:true}));
  parts.push(decoder.decode());
  return parts.join('');
}
export function deserializeDocument(text) {
  if(text.startsWith('{"format":"sigma-fig-transfer-2",')) return decodeFigmaResult([new TextEncoder().encode(text).buffer]).doc;
  return JSON.parse(text);
}
