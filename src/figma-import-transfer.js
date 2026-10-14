// Transfer UTF-8 JSON chunks, not a structured clone of the expanded layer graph.
// Bounded chunks avoid a second giant JSON string/buffer in the decoding worker.
export const MAX_FIG_BYTES = 128 * 1024 * 1024;
export const FIG_TRANSFER_VERSION = 2;
export const MAX_FIG_RESULT_BYTES = 256 * 1024 * 1024;
const LIMIT_MESSAGE = 'This Figma design expands beyond the 256 MB import memory budget after sharing repeated artwork. Export fewer pages or reduce embedded images and try again.';
const STRING_REF = '$sigmaFigString';

export function encodeFigmaResult(value, {maxBytes=MAX_FIG_RESULT_BYTES}={}) {
  const encoder=new TextEncoder(), chunks=[];
  let length=0, pending='';
  const ancestors=new Set();
  const strings=[], stringIds=new Map();
  function flush() {
    if(!pending) return;
    const bytes=encoder.encode(pending); length+=bytes.length;
    if(length>maxBytes) throw new Error(LIMIT_MESSAGE);
    chunks.push(bytes.buffer); pending='';
  }
  function write(text) { pending+=text; if(pending.length>=32768) flush(); }
  function string(text) {
    write('"');
    for(let i=0;i<text.length;i+=16384) write(JSON.stringify(text.slice(i,i+16384)).slice(1,-1));
    write('"');
  }
  function visit(item) {
    if(item===null || typeof item!=='object') {
      if(typeof item==='string' && item.length>=4096) {
        // Symbols and instances often reuse the same multi-megabyte image.
        // Send its source once, rather than charging every use against the budget.
        let id=stringIds.get(item);
        if(id===undefined) {id=strings.length;strings.push(item);stringIds.set(item,id);}
        write('{');string(STRING_REF);write(':');write(String(id));write('}');
      } else if(typeof item==='string') string(item);
      else write(JSON.stringify(item) ?? 'null');
      return;
    }
    if(ancestors.has(item)) throw new Error('The imported document contains a circular reference.');
    ancestors.add(item);
    if(Array.isArray(item)) {
      write('['); for(let i=0;i<item.length;i++) {if(i)write(',');visit(item[i]);} write(']');
    } else {
      write('{'); let separator=false;
      for(const key of Object.keys(item)) {
        if(item[key]===undefined || typeof item[key]==='function') continue;
        if(separator)write(',');separator=true; string(key);write(':');visit(item[key]);
      }
      write('}');
    }
    ancestors.delete(item);
  }
  write('{"format":"sigma-fig-transfer-2","value":');visit(value);
  write(',"strings":[');
  for(let i=0;i<strings.length;i++) {if(i)write(',');string(strings[i]);}
  write(']}');flush();
  return chunks;
}

export function decodeFigmaResult(chunks, {maxBytes=MAX_FIG_RESULT_BYTES}={}) {
  if(!Array.isArray(chunks) || chunks.some(chunk=>!(chunk instanceof ArrayBuffer))) throw new Error('The Figma worker returned no readable transfer buffers. Refresh Sigma and retry.');
  const length=chunks.reduce((sum,chunk)=>sum+chunk.byteLength,0);
  if(length>maxBytes) throw new Error(LIMIT_MESSAGE);
  const decoder=new TextDecoder();
  const parts=chunks.map(chunk=>decoder.decode(chunk,{stream:true})); parts.push(decoder.decode());
  const packed=JSON.parse(parts.join(''));
  // A tab can retain the earlier decoder while newly started workers load new
  // code. Accept the earlier plain JSON payload, as well as the shared format.
  const shared=packed?.format==='sigma-fig-transfer-2';
  if(!shared && packed?.format) throw new Error('The Figma importer versions do not match. Refresh Sigma and retry.');
  if(shared && (!Array.isArray(packed.strings) || packed.strings.some(s=>typeof s!=='string'))) throw new Error('The Figma worker returned an invalid shared artwork table.');
  function restore(item) {
    if(!item || typeof item!=='object') return item;
    if(Object.hasOwn(item,STRING_REF)) {
      const id=item[STRING_REF];
      if(Object.keys(item).length!==1 || !Number.isInteger(id) || id<0 || id>=packed.strings.length) throw new Error('Invalid Figma artwork reference.');
      return packed.strings[id];
    }
    for(const key of Object.keys(item)) item[key]=restore(item[key]);
    return item;
  }
  const result=shared ? restore(packed.value) : packed;
  if(!Array.isArray(result?.doc?.pages) || !result.doc.pages.length || !result?.report) throw new Error('The Figma worker returned no readable Design pages.');
  return result;
}

export function figmaImportError(error) {
  if(/out of memory|cannot be cloned|allocation|array buffer allocation/i.test(error?.message || '')) return 'This Figma design needs more browser memory than is available. Export fewer pages or reduce embedded images and try again.';
  return error?.message || 'This .fig file could not be imported.';
}
