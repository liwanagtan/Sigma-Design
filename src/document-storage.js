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

// Compatibility for user-owned designs imported from older Sigma versions.
// The first time the file is opened (when its text is measured and its layouts are done), stack each page's
// example columns by their real heights. Returns whether anything moved.
const COLUMN_GAP = 64;
export function arrangeLegacyGuideColumns(doc) {
  let moved = false;
  for (const pg of doc.pages) {
    if (!pg.welcomeColumns) continue;
    const byId = new Map(pg.children.map((n) => [n.id, n]));
    for (const column of pg.welcomeColumns) {
      const nodes = column.map((id) => byId.get(id)).filter(Boolean);
      for (let i = 1; i < nodes.length; i++) {
        const y = nodes[i - 1].y + nodes[i - 1].h + COLUMN_GAP;
        if (nodes[i].y !== y) {
          nodes[i].y = y;
          moved = true;
        }
      }
    }
    delete pg.welcomeColumns;
    moved = true;
  }
  return moved;
}
