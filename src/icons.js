import {UI_ICON_SIZES} from './ui-component-registry.js';
import { findIcon, iconMarkup } from './icon-library.js';
import {lucideIcon,lucideBody} from './lucide.js';
import {UI_ICON_NAMES} from './ui-icon-map.js';
export {UI_ICON_NAMES};
const TOOL_SIZE=new Set(['move','hand','frame','rect','ellipse','line','text','image','comment']);
export const icons=Object.fromEntries(Object.entries(UI_ICON_NAMES).map(([key,name])=>[key,lucideIcon(name,TOOL_SIZE.has(key)?UI_ICON_SIZES.tool:key==='home'?20:key.startsWith('chevron')?8:key==='selectChevron'?12:16)]));
// The Sigma brand mark is artwork, separate from the Lucide interface glyphs.
Object.assign(icons,{
  logo: `<svg width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="5" fill="#0D99FF"/><path d="M14 5.5H6.5L11 10l-4.5 4.5H14" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
});
// Legacy 12-unit canvas wrappers retain their coordinate system.
export const componentSetSymbol=`<g transform="scale(.5)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${lucideBody('layout-grid')}</g>`;
export function layerIcon(n) {
  if(n.type==='icon'){const icon=findIcon(n.iconId);return icon?iconMarkup(icon,{w:12,h:12}):lucideIcon('square-dashed',12);}
  const key=n.type==='frame'?(n.layout?.mode==='horizontal'?'frameHorizontal':n.layout?.mode==='vertical'?'frameVertical':'frame'):n.type;
  return UI_ICON_NAMES[key]?lucideIcon(UI_ICON_NAMES[key],12):'';
}
