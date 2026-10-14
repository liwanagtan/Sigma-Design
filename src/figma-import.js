import { parseFigBinary, resolveVectorNodePaths, resolveGradientGeometry } from './vendor/figma-parser.js';
import { createNode, uid } from './store.js';
import { unzipSync } from './vendor/figma-fflate.js';

const MAX_ARCHIVE_BYTES=256*1024*1024;
const MAX_ARTWORK_BYTES=64*1024*1024;
function parseArchive(bytes) {
  // Reject oversized expanded archives before unzip allocates their entries.
  // Ignore thumbnails and unrelated files instead of eagerly copying them all.
  let total=0;
  const archive=unzipSync(bytes,{filter:entry=> {
    total+=entry.originalSize;
    if(total>MAX_ARCHIVE_BYTES) throw new Error('This .fig archive expands beyond 256 MB. Export fewer pages or remove unused images.');
    return entry.name.endsWith('canvas.fig') || entry.name.endsWith('meta.json') || entry.name.includes('images/');
  }});
  const canvas=Object.keys(archive).find(key=>key.endsWith('canvas.fig'));
  if(!canvas) throw new Error('No canvas.fig was found in the Figma archive.');
  const parsed=parseFigBinary(archive[canvas]);
  const meta=Object.keys(archive).find(key=>key.endsWith('meta.json'));
  if(meta) try {parsed.meta=JSON.parse(new TextDecoder().decode(archive[meta]));}catch{}
  for(const key of Object.keys(archive)) if(key.includes('images/')) parsed.images.set(key.split('/').pop(),archive[key]);
  return parsed;
}

const finite = (n, fallback=0) => Number.isFinite(n) ? n : fallback;
const clamp = n => Math.max(0, Math.min(1, finite(n,1)));
const guid = g => g && Number.isFinite(g.sessionID) && Number.isFinite(g.localID) ? `${g.sessionID}:${g.localID}` : null;
const hex = c => '#' + ['r','g','b'].map(k => Math.round(clamp(c?.[k] ?? 0)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
const alpha = p => clamp(p.opacity ?? 1)*clamp(p.color?.a ?? 1);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svgData = body => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`;
const base64 = bytes => { let text=''; for(let i=0;i<bytes.length;i+=8192) text+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(text); };
const imageType = bytes => bytes[0]===137 && bytes[1]===80 ? 'image/png' : bytes[0]===255 && bytes[1]===216 ? 'image/jpeg' : String.fromCharCode(...bytes.subarray(0,4))==='RIFF' ? 'image/webp' : String.fromCharCode(...bytes.subarray(0,3))==='GIF' ? 'image/gif' : null;
const sorted = nodes => [...nodes].sort((a,b) => { const x=a.parentIndex?.position || '', y=b.parentIndex?.position || ''; return x<y ? -1 : x>y ? 1 : 0; });
const fontWeight = style => /black|heavy/i.test(style) ? 900 : /extra.?bold/i.test(style) ? 800 : /semi.?bold|demi/i.test(style) ? 600 : /bold/i.test(style) ? 700 : /medium/i.test(style) ? 500 : /extra.?light/i.test(style) ? 200 : /light/i.test(style) ? 300 : /thin/i.test(style) ? 100 : 400;

export function importFigmaBytes(bytes, { name='Imported Figma' }={}) {
  if (!(bytes instanceof Uint8Array) || bytes.length<16) throw new Error('This is not a valid Figma .fig file.');
  let parsed;
  try { parsed=bytes[0]===80 && bytes[1]===75 ? parseArchive(bytes) : parseFigBinary(bytes); }
  catch(error) {
    if(/beyond|memory|allocation/i.test(error.message)) throw error;
    throw new Error('The .fig file could not be decoded. Export a fresh local copy from Figma and try again.');
  }
  return convertFigmaDocument(parsed, {name});
}

export function convertFigmaDocument(parsed, {name=parsed.meta?.file_name || 'Imported Figma'}={}) {
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length>100000) throw new Error('This Figma file has too many layers or no readable document.');
  const warnings=new Map(), counts={pages:0,layers:0,images:0,vectors:0,instances:0};
  const warn = message => warnings.set(message,(warnings.get(message)||0)+1);
  const map=new Map(), children=new Map(), images=new Map(), artworkCache=new Map(), artworkSources=new Map();
  let artworkBytes=0, imageBytes=0;
  for(const raw of parsed.nodes) { const id=guid(raw.guid); if(id) map.set(id,map.has(id) ? {...map.get(id),...raw} : raw); }
  for(const raw of map.values()) {
    if(raw.phase==='REMOVED') continue;
    const parent=guid(raw.parentIndex?.guid);
    if(parent) { if(!children.has(parent)) children.set(parent,[]); children.get(parent).push(raw); }
  }
  const kids = raw => sorted(children.get(guid(raw.guid)) || []);
  function imageSource(paint) {
    const hash=paint.image?.hash;
    const key=typeof hash==='string' ? hash : hash ? [...hash].map(n=>n.toString(16).padStart(2,'0')).join('') : paint.image?.name;
    if(!key) { warn('Missing image assets'); return null; }
    if(images.has(key)) return images.get(key);
    const bytes=parsed.images?.get(key), mime=bytes && imageType(bytes);
    if(!mime) { warn('Missing or unsupported image assets'); return null; }
    imageBytes+=bytes.length;
    if(imageBytes>MAX_ARTWORK_BYTES) throw new Error('This design has more than 64 MB of embedded images. Reduce image sizes or export fewer pages.');
    const source=`data:${mime};base64,${base64(bytes)}`; images.set(key,source); counts.images++; return source;
  }
  function paints(list=[]) {
    return list.filter(p=>p.type==='SOLID').map(p=>({color:hex(p.color),opacity:alpha(p),visible:p.visible!==false}));
  }
  function svgArtwork(raw, paths=null) {
    const w=Math.max(0.01,finite(raw.size?.x,100)), h=Math.max(0.01,finite(raw.size?.y,100));
    const cacheKey=!paths ? JSON.stringify([raw.type,w,h,raw.cornerRadius,raw.strokeWeight,raw.fillPaints,raw.strokePaints]) : null;
    if(cacheKey && artworkCache.has(cacheKey)) return artworkCache.get(cacheKey);
    let defs='', serial=0;
    const shape = attrs => raw.type==='ELLIPSE' ? `<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" ${attrs}/>` : raw.type==='LINE' ? `<path d="M0 0 L${w} 0" ${attrs}/>` : `<rect width="${w}" height="${h}" rx="${finite(raw.cornerRadius)}" ${attrs}/>`;
    function painted(draw,list,stroke=false) {
      return (list||[]).filter(p=>p.visible!==false).map(p=> {
        let fill;
        if(p.type==='SOLID') fill=hex(p.color);
        else if(p.type==='IMAGE') {
          const source=imageSource(p); if(!source) return '';
          const id=`clip${serial++}`; defs+=`<clipPath id="${id}">${draw('fill="black"')}</clipPath>`;
          if(p.imageScaleMode && !['FILL','FIT'].includes(p.imageScaleMode)) warn('Image cropping or tiling simplified');
          return `<image href="${source}" width="${w}" height="${h}" opacity="${clamp(p.opacity??1)}" preserveAspectRatio="xMidYMid ${p.imageScaleMode==='FIT'?'meet':'slice'}" clip-path="url(#${id})"/>`;
        } else if(['GRADIENT_LINEAR','GRADIENT_RADIAL'].includes(p.type)) {
          const geometry=resolveGradientGeometry(p,w,h), stops=p.stops || p.stopsVar || [];
          if(!geometry || !stops.length) { warn('Unsupported gradient fills'); return ''; }
          const id=`gradient${serial++}`;
          const content=stops.map(s=>`<stop offset="${clamp(s.position)}" stop-color="${hex(s.color)}" stop-opacity="${clamp(s.color?.a??1)}"/>`).join('');
          if(geometry.type==='linear') defs+=`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${geometry.start.x}" y1="${geometry.start.y}" x2="${geometry.end.x}" y2="${geometry.end.y}">${content}</linearGradient>`;
          else defs+=`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${geometry.center.x} ${geometry.center.y}) rotate(${geometry.angle}) scale(${geometry.radiusX} ${geometry.radiusY})">${content}</radialGradient>`;
          fill=`url(#${id})`;
        } else { warn('Unsupported paint types'); return ''; }
        if(p.blendMode && p.blendMode!=='NORMAL') warn('Blend modes simplified');
        return draw(stroke ? `fill="none" stroke="${fill}" stroke-width="${finite(raw.strokeWeight,1)}" opacity="${alpha(p)}"` : `fill="${fill}" opacity="${alpha(p)}"`);
      }).join('');
    }
    let body;
    if(paths) body=[...paths.fill,...paths.stroke].map(path=>painted(attrs=>`<path d="${esc(path.svgPath)}" fill-rule="${path.windingRule==='EVENODD'?'evenodd':'nonzero'}" ${attrs}/>`,path.paints)).join('');
    else body=painted(shape,raw.fillPaints)+painted(shape,raw.strokePaints,true);
    let result=body ? svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`) : null;
    // Vector definitions can repeat across thousands of detached instances too.
    // Account for unique sources and reuse their strings, just as for bitmaps.
    if(result && artworkSources.has(result)) result=artworkSources.get(result);
    else if(result) {artworkBytes+=result.length;artworkSources.set(result,result);}
    if(artworkBytes>MAX_ARTWORK_BYTES) throw new Error('This design expands beyond 64 MB of embedded artwork. Reduce images or export fewer pages.');
    if(cacheKey) artworkCache.set(cacheKey,result);
    return result;
  }
  function convert(raw, ancestors=new Set(), overrides=[], trail=[], depth=0) {
    const id=guid(raw.guid);
    if(raw.phase==='REMOVED') return null;
    if(depth>100 || ancestors.has(id)) { warn('Cyclic or excessively nested layers skipped'); return null; }
    if(++counts.layers>100000) throw new Error('This file expands to too many layers.');
    const next=new Set(ancestors); next.add(id);
    const key=guid(raw.overrideKey)||id, path=[...trail,key];
    const override=overrides.find(o=>o.guidPath?.guids?.map(guid).join('/')===path.join('/'));
    if(override) raw={...raw,...override,textData:override.textData ? {...raw.textData,...override.textData} : raw.textData};
    const symbol=raw.type==='INSTANCE' && map.get(guid(raw.symbolData?.symbolID));
    const source=symbol ? {...symbol,...raw,fillPaints:raw.fillPaints??symbol.fillPaints,strokePaints:raw.strokePaints??symbol.strokePaints} : raw;
    const types={FRAME:'frame',GROUP:'group',SYMBOL:'component',COMPONENT:'component',COMPONENT_SET:'componentSet',ROUNDED_RECTANGLE:'rect',RECTANGLE:'rect',ELLIPSE:'ellipse',LINE:'line',TEXT:'text',INSTANCE:'frame',SECTION:'frame'};
    let type=source.isStateGroup ? 'componentSet' : types[raw.type];
    const paths=['VECTOR','BOOLEAN_GROUP','STAR','REGULAR_POLYGON','POLYGON'].includes(raw.type) ? resolveVectorNodePaths(parsed,source) : null;
    if(paths && (paths.fill.length || paths.stroke.length)) type='image';
    const actualChildren=kids(raw);
    if(!type) {
      if(['VARIABLE','VARIABLE_SET','STYLE'].includes(raw.type)) { warn('Figma variables and styles baked into layer values'); return null; }
      if(actualChildren.length) { type='frame'; warn('Unsupported containers imported as frames'); }
      else { type='rect'; warn('Unsupported shapes imported as placeholders'); }
    }
    const w=Math.max(0,finite(source.size?.x,100)), h=Math.max(0,finite(source.size?.y,type==='line'?0:100));
    const t=source.transform || {m00:1,m01:0,m02:0,m10:0,m11:1,m12:0};
    const angle=Math.atan2(finite(t.m10),finite(t.m00,1)), cos=Math.cos(angle), sin=Math.sin(angle);
    if(Math.abs(Math.hypot(t.m00??1,t.m10??0)-1)>0.001 || Math.abs(Math.hypot(t.m01??0,t.m11??1)-1)>0.001 || (t.m00??1)*(t.m11??1)-(t.m01??0)*(t.m10??0)<0) warn('Scaled, skewed or reflected transforms approximated');
    const n=createNode(type,{name:raw.name||raw.type,x:finite(t.m02)-w/2+cos*w/2-sin*h/2,y:finite(t.m12)-h/2+sin*w/2+cos*h/2,w,h,rotation:angle*180/Math.PI,opacity:clamp(source.opacity??1),visible:source.visible!==false,locked:!!source.locked,fills:paints(source.fillPaints),strokes:paints(source.strokePaints),strokeWidth:Math.max(0,finite(source.strokeWeight,1)),strokeAlign:({INSIDE:'inside',OUTSIDE:'outside',CENTER:'center'})[source.strokeAlign]||'inside',radius:Math.max(0,finite(source.cornerRadius)),clip:source.frameMaskDisabled!==true});
    const corners=['rectangleTopLeftCornerRadius','rectangleTopRightCornerRadius','rectangleBottomRightCornerRadius','rectangleBottomLeftCornerRadius'];
    if(corners.some(k=>Number.isFinite(source[k]))) n.radii=corners.map(k=>Math.max(0,finite(source[k],n.radius)));
    if(source.blendMode && !['NORMAL','PASS_THROUGH'].includes(source.blendMode)) warn('Blend modes simplified');
    if(source.isMask) warn('Masks are imported as ordinary layers');
    n.effects=(source.effects||[]).filter(e=>e.visible!==false).flatMap(e=> {
      if(!['DROP_SHADOW','INNER_SHADOW'].includes(e.type)) { warn('Unsupported effects omitted'); return []; }
      return [{type:e.type==='DROP_SHADOW'?'drop-shadow':'inner-shadow',color:hex(e.color),opacity:clamp(e.opacity??1)*clamp(e.color?.a??1),x:finite(e.offset?.x),y:finite(e.offset?.y),blur:Math.max(0,finite(e.radius)),spread:finite(e.spread),visible:true}];
    });
    if(type==='text') {
      n.text=source.textData?.characters || ''; n.fontFamily=(source.fontName?.family || 'Inter').replace(/[^\p{L}\p{N} _-]/gu,''); n.fontSize=Math.max(1,finite(source.fontSize,16));
      n.fontWeight=fontWeight(source.fontName?.style); n.fontStyle=/italic|oblique/i.test(source.fontName?.style||'')?'italic':'normal';
      if (n.fontStyle==='italic' || source.textDecoration && source.textDecoration!=='NONE') warn('Italic or decorated text simplified');
      n.autoResize='fixed'; n.textAlign=({LEFT:'left',CENTER:'center',RIGHT:'right',JUSTIFIED:'justify'})[source.textAlignHorizontal]||'left';
      n.lineHeight=source.lineHeight?.units==='PIXELS' ? source.lineHeight.value/n.fontSize*100 : source.lineHeight?.units==='RAW' ? source.lineHeight.value*100 : source.lineHeight?.units==='PERCENT' ? source.lineHeight.value : null;
      n.letterSpacing=source.letterSpacing?.units==='PERCENT' ? source.letterSpacing.value*n.fontSize/100 : finite(source.letterSpacing?.value);
      if(source.textData?.styleOverrideTable?.length) warn('Mixed text formatting simplified to the base style');
      if(!n.fills.length) n.fills=[{color:'#000000',opacity:1,visible:true}];
    }
    const complex=[...(source.fillPaints||[]), ...(source.strokePaints||[])].some(p=>p.visible!==false && p.type!=='SOLID');
    if(type==='image') {
      n.src=svgArtwork(source,paths); n.fills=[]; n.strokes=[];
      if(n.src) { counts.vectors++; warn('Vector paths preserved as SVG artwork'); }
      else { n.type='rect'; delete n.src; n.fills=[{color:'#E6E6E6',opacity:1,visible:true}]; warn('Vector artwork without usable paints imported as placeholders'); }
    }
    else if(complex && type!=='text') {
      const src=svgArtwork(source);
      if(src) {
        warn('Image and gradient fills preserved as embedded artwork');
        if(['frame','component','componentSet','group'].includes(type)) { n.fills=[]; n.strokes=[]; n.children=[createNode('image',{name:'Figma background',w,h,src,fills:[],strokes:[],locked:true})]; }
        else { n.type='image'; n.src=src; n.fills=[]; n.strokes=[]; }
      } else if(!n.fills.length) n.fills=[{color:'#E6E6E6',opacity:1,visible:true}];
    } else if(complex) warn('Unsupported text paints simplified');
    if(source.stackMode && source.stackMode!=='NONE') warn('Auto layout imported as editable positioned layers');
    if(raw.type==='INSTANCE') {
      counts.instances++; warn('Component instances detached as editable frames');
      if(!symbol && !actualChildren.length) warn('Missing component definitions');
      if(raw.symbolData?.symbolOverrides?.length) warn('Component overrides may need review');
    }
    let descendants=actualChildren;
    let childOverrides=overrides, childTrail=path;
    if(symbol && !descendants.length) { descendants=kids(symbol); childOverrides=source.symbolData?.symbolOverrides || []; childTrail=[]; next.add(guid(symbol.guid)); }
    if(['frame','group','component','componentSet'].includes(n.type)) n.children=[...(n.children||[]), ...descendants.map(child=>convert(child,next,childOverrides,childTrail,depth+1)).filter(Boolean)];
    if(n.type==='componentSet') {
      n.variantProps={};
      for(const component of n.children.filter(c=>c.type==='component')) {
        if(!component.name.includes('=')) component.name=`Variant=${component.name}`;
        for(const pair of component.name.split(',')) {
          const index=pair.indexOf('='); if(index<0) continue;
          const key=pair.slice(0,index).trim(), value=pair.slice(index+1).trim();
          if(!n.variantProps[key]) n.variantProps[key]=[];
          if(!n.variantProps[key].includes(value)) n.variantProps[key].push(value);
        }
      }
    }
    return n;
  }
  if([...map.values()].some(n=>['VARIABLE','VARIABLE_SET'].includes(n.type))) warn('Figma variables and styles baked into layer values');
  const sourcePages=sorted([...map.values()].filter(n=>n.type==='CANVAS' && n.phase!=='REMOVED' && n.name!=='Internal Only Canvas'));
  if(!sourcePages.length) throw new Error('No Figma Design pages were found in this file.');
  const pages=sourcePages.map(raw=>({id:uid(),name:raw.name || 'Page',background:hex(raw.backgroundColor || parsed.meta?.client_meta?.background_color || {r:0.96,g:0.96,b:0.96}),children:kids(raw).map(n=>convert(n)).filter(Boolean)}));
  counts.pages=pages.length;
  const report={source:'Figma .fig',name,counts,warnings:[...warnings].map(([message,count])=>({message,count}))};
  const doc={name,pages,currentPageId:pages[0].id,variables:{collections:[]},version:4,figmaImport:report,description:`Imported from Figma .fig. ${report.warnings.map(w=>w.message).join('; ')}`};
  return {doc,report};
}
