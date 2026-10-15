import {LUCIDE_GLYPHS,LUCIDE_VERSION} from './lucide-ui-data.js';
export {LUCIDE_VERSION};
export function lucideBody(name) {
  const body=LUCIDE_GLYPHS[name];if(!body)throw new Error(`Unregistered Lucide UI icon: ${name}`);return body;
}
export function lucideIcon(name,size=16,{className='',rotate=0}={}) {
  const safeClass=String(className).replace(/[^a-z0-9 _-]/gi,'');
  const body=lucideBody(name),length=Number(size)||16;
  return `<svg data-lucide="${name}"${safeClass?` class="${safeClass}"`:''} width="${length}" height="${length}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${rotate?`<g transform="rotate(${Number(rotate)||0} 12 12)">${body}</g>`:body}</svg>`;
}
