import {icons} from './icons.js';
export const PROJECT_GLYPHS=['frame','rect','ellipse','image','text','home','comment','linkOn','appearance','fixedSize','radius','eye'];
export const PROJECT_EMOJI=['🎨','🚀','✨','💡','📁','📚','🧩','🔬','🌿','🌈','🪐','🎯','🛠️','💎','🌊','🔥','🍀','🦋','⚡','🏗️','🧠','📦','📝','🏠'];
export function validateProjectIcon(icon) {
  if(icon===null)return null;
  if(icon?.type==='glyph'&&PROJECT_GLYPHS.includes(icon.value))return {type:'glyph',value:icon.value};
  if(icon?.type==='emoji'){
    const value=String(icon.value||'').trim();
    if(value.length<=32&&[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].length===1&&/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value))return {type:'emoji',value};
  }
  throw new Error('Choose a Lucide icon or one emoji.');
}
export function projectIconMarkup(icon) {
  try{icon=validateProjectIcon(icon||null);}catch{icon=null;}
  return icon?.type==='emoji'?icon.value:icons[icon?.value||'frame'];
}
