// Small CSS-value helpers shared by the welcome generator and its specimens.
export const cssNumber = value => value === '0' ? 0 : /^-?\d+(?:\.\d+)?px$/.test(value || '') ? parseFloat(value) : null;
export function cssPadding(rule) {
  const parts=(rule.padding||'0').split(/\s+/).map(cssNumber);
  if(parts.some(n=>n===null)) return null;
  const [a,b=a,c=a,d=b]=parts;
  return ['top','right','bottom','left'].map((side,i)=>cssNumber(rule[`padding-${side}`]) ?? [a,b,c,d][i]);
}
export function cssShadow(value) {
  const m=/^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?\s+(#[\da-f]{6,8}|var\(--[\w-]+\)|rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\))$/i.exec(value||'');
  if(!m) return null;
  const color=m[5].startsWith('var(')?m[5]:m[5].startsWith('#')?m[5].toUpperCase():'#'+[+m[6],+m[7],+m[8],Math.round(+m[9]*255)].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
  return {color,x:+m[1],y:+m[2],blur:+m[3],spread:+(m[4]||0)};
}
