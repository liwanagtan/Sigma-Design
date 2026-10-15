// Preserve strings, data URLs and conditional rules; never merge responsive declarations into desktop defaults.
export function splitCSS(text,delimiter){
  const out=[];let start=0,quote='',depth=0;
  for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===delimiter&&depth===0){out.push(text.slice(start,i));start=i+1;}}
  out.push(text.slice(start));return out;
}
export function parseStylesheet(source,file,condition=''){
  const text=source.replace(/\/\*[\s\S]*?\*\//g,''),out=[];let start=0;
  while(start<text.length){let i=start,quote='',parens=0;
    for(;i<text.length;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='(')parens++;else if(c===')')parens--;if(!parens&&(c===';'||c==='{'))break;}
    if(i>=text.length)break;if(text[i]===';'){start=i+1;continue;}
    const selector=text.slice(start,i).trim();let j=i+1,depth=1;quote='';
    for(;j<text.length;j++){const c=text[j];if(quote){if(c==='\\')j++;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='{')depth++;if(c==='}'){depth--;if(!depth)break;}}
    const body=text.slice(i+1,j);start=j+1;
    if(selector.startsWith('@')){if(/^@(media|supports|layer)\b/.test(selector))out.push(...parseStylesheet(body,file,[condition,selector].filter(Boolean).join(' / ')));continue;}
    const declarations=Object.fromEntries(splitCSS(body,';').map(s=>{const at=s.indexOf(':');return at<0?null:[s.slice(0,at).trim(),s.slice(at+1).trim()];}).filter(Boolean));
    for(const s of splitCSS(selector,','))if(s.trim())out.push({selector:s.trim(),declarations,file,condition});
  }
  return out;
}
