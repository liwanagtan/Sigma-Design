// Deterministic HTML/CSS adapter. Reads the normalized document; never edits it.
import {state,page,isAncestor} from './store.js';
import {layerCSS} from './inspect.js';
import {collections,modeContextOf,resolveValue,findVariable} from './variables.js';
import {exportCSS} from './tokens-io.js';
import {isAutoLayout} from './layout.js';
import {a11yOf,roleOf,accessibleLabel} from './a11y.js';
import {findIcon,iconMarkup,parseSVGIcon} from './icon-library.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number.isFinite(Number(n))?Number(n):0;
const px=n=>`${num(n)}px`;
export function generateHTMLCode(nodes,{scope='selection'}={}) {
  if(!state.doc)throw new Error('Open a Design file first.');
  const roots=scope==='page'?page().children:nodes.filter(n=>!nodes.some(other=>other!==n&&isAncestor(other,n)));
  if(!roots.length)throw new Error('Select a layer or choose Current page.');
  const warnings=new Set(['HTML/CSS has no application behavior. Review semantics, fonts, and responsive behavior before use.','Token values are resolved snapshots of the design’s current modes; regenerate after changing modes.']);
  const rules=[],responsive=[],contexts=new Map(),classes=new Map(),needed=new Set();let count=0;
  const collect=(list,depth=0)=>{if(depth>100)throw new Error('Layer nesting is too deep. Choose a smaller scope.');for(const n of list){if(n.visible===false)continue;for(const id of Object.values(n.bindings||{}))needed.add(id);collect(n.children||[],depth+1);}};collect(roots);
  const cols=collections().filter(c=>!c.extends);
  const tokensFor=n=>{
    const context=modeContextOf(n);if(contexts.has(context.key))return contexts.get(context.key).name;
    const name=`sigma-mode-${contexts.size+1}`;
    const resolved=cols.map(c=>({...c,modes:[{id:'snapshot',name:'Snapshot'}],defaultModeId:'snapshot',variables:(c.variables||[]).filter(v=>needed.has(v.id)).map(v=>({...v,valuesByMode:{snapshot:resolveValue(v.id,context.pick)}}))}));
    const css=exportCSS(resolved,{title:'Resolved project tokens'}).replace(/^[\s\S]*?\*\/\s*/,'').replace(':root',`.${name}`);
    contexts.set(context.key,{name,css});return name;
  };
  const visit=(n,parent=null,depth=0)=>{
    if(n.visible===false)return '';
    if(++count>5000||depth>100)throw new Error('This scope is too large. Generate one frame or component at a time (up to 5,000 layers).');
    const cls=`sigma-layer-${count}`,mode=tokensFor(n),a=a11yOf(n),role=roleOf(n);classes.set(n.id,cls);
    let tag=n.type==='text'?(a.heading?`h${Math.max(1,Math.min(6,num(a.heading)))}`:'span'):role==='button'?'button':n.type==='image'?'img':'div';
    const attrs=[`class="${cls} ${mode}"`,`data-sigma-layer="${esc(n.id)}"`];
    if(tag==='button')attrs.push('type="button"');
    if(a.decorative)attrs.push('aria-hidden="true"');
    else if(tag!=='img'&&accessibleLabel(n)&&role)attrs.push(`aria-label="${esc(accessibleLabel(n))}"`);
    if(role&&!['button','img','heading','none'].includes(role))attrs.push(`role="${esc(role)}"`);
    const safe={...n,fills:(n.fills||[]).filter(p=>!p.type||p.type==='solid'),strokes:(n.strokes||[]).filter(p=>!p.type||p.type==='solid')};
    if((n.fills||[]).some(p=>p.visible!==false&&p.type&&p.type!=='solid'))warnings.add(`${n.name}: non-solid fills are omitted.`);
    const css=new Map(layerCSS(safe));
    css.set('box-sizing','border-box');
    if(n.type==='text'){css.set('white-space','pre-wrap');css.set('display','block');css.set('margin','0');}
    if(tag==='button'){css.set('font','inherit');if(!css.has('border'))css.set('border','0');css.set('cursor','pointer');}
    if(!isAutoLayout(n)&&n.children?.length)css.set('position','relative');
    if(parent&&(!isAutoLayout(parent)||n.absolute)){css.set('position','absolute');css.set('left',px(n.x));css.set('top',px(n.y));}
    if(n.rotation){css.set('transform',`rotate(${num(n.rotation)}deg)`);css.set('transform-origin','center');}
    if(n.blendMode&&n.blendMode!=='normal')warnings.add(`${n.name}: blend mode requires visual review.`);
    if((n.children||[]).some(c=>c.layout?.breakpoints?.length))css.set('container-type','inline-size');
    for(const id of Object.values(n.bindings||{}))if(!findVariable(id))warnings.add(`${n.name}: a token binding is unavailable; the current literal value is used.`);
    let body='';
    if(n.type==='text')body=esc(n.text);
    else if(n.type==='icon'){
      const icon=findIcon(n.iconId);
      if(icon){const clean=parseSVGIcon(`<svg viewBox="${esc(icon.viewBox)}">${icon.body}</svg>`);body=iconMarkup({...icon,body:clean.body},{w:num(n.w),h:num(n.h),color:'currentColor',strokeWidth:n.iconStroke});}
      else warnings.add(`${n.name}: missing icon; reconnect its icon library.`);
    }else if(tag==='img'){
      const src=String(n.src||'');
      if(/^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(src))attrs.push(`src="${esc(src)}"`);
      else warnings.add(`${n.name}: image source is not an embedded raster asset and was omitted.`);
      attrs.push(`alt="${esc(a.decorative?'':a.alt||'')}"`);css.set('object-fit','cover');
    }else body=(n.children||[]).map(c=>visit(c,n,depth+1)).join('\n');
    if(n.type==='instance')warnings.add('Component instances are expanded into HTML. Framework imports and interactive component APIs are a later increment.');
    if(n.type==='componentSet')warnings.add('Component sets export their visible variants as examples, not interactive state switching.');
    for(const bp of [...(n.layout?.breakpoints||[])].sort((a,b)=>b.maxW-a.maxW)){
      const declarations=[];if(bp.mode)declarations.push(`flex-direction: ${bp.mode==='horizontal'?'row':'column'};`);
      if(bp.gap!==undefined)declarations.push(`gap: ${px(bp.gap)};`);
      for(const [key,prop]of [['pt','padding-top'],['pr','padding-right'],['pb','padding-bottom'],['pl','padding-left']])if(bp[key]!==undefined)declarations.push(`${prop}: ${px(bp[key])};`);
      const align={start:'flex-start',center:'center',end:'flex-end'};if(bp.alignP)declarations.push(`justify-content: ${align[bp.alignP]||'flex-start'};`);if(bp.alignC)declarations.push(`align-items: ${align[bp.alignC]||'flex-start'};`);
      const hidden=(n.children||[]).filter(c=>(bp.hide||[]).includes(c.sourceId||c.id)&&classes.has(c.id)).map(c=>`.${classes.get(c.id)} { display: none; }`).join('\n');
      responsive.push(`${parent?'@container':'@media'} (max-width: ${num(bp.maxW)}px) {\n.${cls} { ${declarations.join(' ')} }\n${hidden}\n}`);
    }
    rules.push(`.${cls} {\n${[...css].map(([k,v])=>`  ${k}: ${v};`).join('\n')}\n}`);
    return tag==='img'?`<img ${attrs.join(' ')}>`:`<${tag} ${attrs.join(' ')}>${body}</${tag}>`;
  };
  const html=roots.map(n=>visit(n)).join('\n');
  const css=`/* Generated by Sigma. Edit freely; regeneration creates a new draft. */\nbody { margin: 0; padding: 24px; font-family: system-ui, sans-serif; }\n.sigma-output { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }\n${[...contexts.values()].map(c=>c.css).join('\n')}\n${rules.join('\n\n')}\n${responsive.join('\n\n')}\n`;
  return {html:`<main class="sigma-output">\n${html}\n</main>`,css,warnings:[...warnings],layers:count,name:roots.length===1?roots[0].name:page().name};
}
// Source editing is deliberately HTML/CSS only, including after download.
function staticHTML(html) {
  const template=document.createElement('template');template.innerHTML=String(html);
  for(const node of template.content.querySelectorAll('script,meta,base,iframe,object,embed,link,template'))node.remove();
  for(const node of template.content.querySelectorAll('*'))for(const attr of [...node.attributes]){
    const name=attr.name.toLowerCase(),value=attr.value;
    if(name.startsWith('on')||['srcdoc','action','formaction','srcset','ping','autofocus'].includes(name))node.removeAttribute(attr.name);
    else if(['src','href','xlink:href','poster','background','data'].includes(name)&&!value.startsWith('#')&&!/^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(value))node.removeAttribute(attr.name);
  }
  return template.innerHTML;
}
// CSP and an opaque sandbox provide additional preview isolation.
export function codeDocument({html,css,name='Sigma export'}) {
  const safeCSS=String(css).replace(/<\/style/gi,'<\\/style');
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>${esc(name)}</title><style>${safeCSS}</style></head><body>${staticHTML(html)}</body></html>`;
}
