// Ingestion boundary for browser documents and clipboard layers. No persistence or DOM access.
import { sanitizeIcons } from './icon-library.js';
import {checkValue} from './validate.js';

export const MAX_JSON_IMPORT_BYTES = 64 * 1024 * 1024;
const NODE_TYPES = new Set(['frame','group','rect','ellipse','line','text','image','component','componentSet','instance','icon']);
const NUMBERS = ['x','y','w','h','rotation','opacity','strokeWidth','radius','fontSize','fontWeight','lineHeight','letterSpacing','minW','maxW','minH','maxH','iconStroke'];
const unsafeId = /[<>"'&`\u0000-\u001f]/;
const imageSource = value => typeof value === 'string' && /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)(?:;charset=utf-8)?(?:;base64)?,/i.test(value);

export function prepareImportedDocument(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.pages)) throw new Error('Not a Sigma document: pages must be a list.');
  inspectImportedData(doc);
  const ids=new Set();
  const identify=value=>{if(typeof value.id!=='string'||!value.id||ids.has(value.id))throw new Error('Pages and layers must have unique, nonempty IDs.');ids.add(value.id);};
  function layers(nodes) {
    for(const node of nodes){
      if(!node||typeof node!=='object'||!NODE_TYPES.has(node.type))throw new Error('Document contains an unsupported layer type.');
      identify(node);
      if(['frame','component','componentSet','instance','group'].includes(node.type)&&node.children===undefined)node.children=[];
      if(node.children)layers(node.children);
    }
  }
  for (const pg of doc.pages) {
    if (!pg || !Array.isArray(pg.children)) throw new Error('Every page must have a children list.');
    identify(pg);layers(pg.children);
  }
  return doc;
}

export function inspectImportedData(data) {
  let objects = 0, layers = 0;
  const ancestors = new Set();
  const tokenTypes=new Map(),overrides=[];
  const tokenValue=(type,value)=>checkValue(type,value,message=>{throw new Error(`Invalid ${type} token: ${message}`);});
  function visit(value, depth) {
    if (!value || typeof value !== 'object') return;
    if (depth > 256 || ++objects > 2000000) throw new Error('Document structure is too large or deeply nested.');
    if (ancestors.has(value)) throw new Error('Document contains a circular reference.');
    ancestors.add(value);
    if (Object.hasOwn(value, '__proto__')) throw new Error('Document contains an unsafe object key.');
    if (value.id !== undefined && (typeof value.id !== 'string' || unsafeId.test(value.id))) throw new Error('Document contains an invalid identifier.');
    if(value.valuesByMode!==undefined){
      if(!['color','number','boolean','string','typography','shadow','duration','easing'].includes(value.type)||!value.valuesByMode||typeof value.valuesByMode!=='object'||Array.isArray(value.valuesByMode))throw new Error('Invalid token definition.');
      tokenTypes.set(value.id,value.type);for(const item of Object.values(value.valuesByMode))tokenValue(value.type,item);
    }
    if(value.overrides&&value.extends)overrides.push(value.overrides);
    if (NODE_TYPES.has(value.type)) {
      if (++layers > 100000) throw new Error('Document contains more than 100,000 layers. Import fewer pages.');
      for (const key of NUMBERS) if (value[key] != null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) throw new Error(`Layer ${key} must be a finite number.`);
      if (value.children !== undefined && !Array.isArray(value.children)) throw new Error('Layer children must be a list.');
      if(value.layout){
        if(typeof value.layout!=='object'||Array.isArray(value.layout))throw new Error('Layer layout must be an object.');
        for(const layout of [value.layout,...(value.layout.breakpoints||[])])for(const key of ['gap','pt','pr','pb','pl','maxW'])if(layout[key]!=null&&(typeof layout[key]!=='number'||!Number.isFinite(layout[key])))throw new Error(`Layout ${key} must be a finite number.`);
      }
      if (value.fontFamily && (typeof value.fontFamily !== 'string' || /[;{}<>]/.test(value.fontFamily))) throw new Error('Invalid font family.');
      if (value.type === 'image' && value.src && !imageSource(value.src)) throw new Error('Images must be embedded image data. External image URLs are not imported.');
    }
    // Icons can live in the file, published snapshots, or nested token/component libraries.
    if (typeof value.body === 'string' && value.viewBox !== undefined) {
      const clean = sanitizeIcons([value])[0];
      if (!clean) throw new Error('Document contains invalid icon artwork.');
      Object.assign(value, clean);
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
    ancestors.delete(value);
  }
  visit(data, 0);
  for(const byToken of overrides)for(const [id,byMode]of Object.entries(byToken))if(tokenTypes.has(id))for(const item of Object.values(byMode||{}))tokenValue(tokenTypes.get(id),item);
  return data;
}
