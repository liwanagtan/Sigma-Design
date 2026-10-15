// Overlay geometry uses final layout boxes; it does not change hit-testing or export.
import {worldMatrix} from './store.js';
import {apply} from './geom.js';
import {layoutOf,isAutoLayout,inFlow} from './layout.js';
import {findVariable} from './variables.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function spacingRegions(frame) {
  if(!isAutoLayout(frame))return [];
  const L=layoutOf(frame),w=frame.w,h=frame.h,regions=[];
  const add=(kind,label,x,y,w,h,path)=>{if(w>0&&h>0)regions.push({kind,label,x,y,w,h,path});};
  add('padV',`Top ${L.pt}px`,0,0,w,Math.min(h,L.pt),'layout.pt');
  add('padV',`Bottom ${L.pb}px`,0,Math.max(0,h-L.pb),w,Math.min(h,L.pb),'layout.pb');
  add('padH',`Left ${L.pl}px`,0,L.pt,Math.min(w,L.pl),Math.max(0,h-L.pt-L.pb),'layout.pl');
  add('padH',`Right ${L.pr}px`,Math.max(0,w-L.pr),L.pt,Math.min(w,L.pr),Math.max(0,h-L.pt-L.pb),'layout.pr');
  const horizontal=L.mode==='horizontal',pos=horizontal?'x':'y',axis=horizontal?'w':'h';
  const kids=frame.children.filter(inFlow).sort((a,b)=>a[pos]-b[pos]);
  for(let i=1;i<kids.length;i++){
    const start=kids[i-1][pos]+kids[i-1][axis],gap=kids[i][pos]-start;
    if(horizontal)add('gap',`Gap ${Math.round(gap*100)/100}px`,start,L.pt,gap,Math.max(0,h-L.pt-L.pb),'layout.gap');
    else add('gap',`Gap ${Math.round(gap*100)/100}px`,L.pl,start,Math.max(0,w-L.pl-L.pr),gap,'layout.gap');
  }
  return regions;
}
export function spacingOverlay(frame,toScreen,kind='all') {
  const M=worldMatrix(frame);let out='';
  for(const r of spacingRegions(frame).filter(r=>kind==='all'||r.kind===kind)){
    const points=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]].map(([x,y])=>toScreen(apply(M,{x,y})));
    const center=toScreen(apply(M,{x:r.x+r.w/2,y:r.y+r.h/2}));
    const token=frame.bindings?.[r.path]&&findVariable(frame.bindings[r.path])?.variable;
    const label=r.label+(token?` · ${token.name}`:'');
    const badge=r.label.replace(/^[A-Za-z]+ /,'').replace('px','');
    out+=`<polygon data-spacing-region="${r.kind}" points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="#F24822" fill-opacity=".15" stroke="#F24822" stroke-opacity=".5" stroke-width="1"><title>${esc(label)}</title></polygon>`;
    const wide=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),tall=Math.hypot(points[3].x-points[0].x,points[3].y-points[0].y);
    if(wide>=20&&tall>=5)out+=`<g transform="translate(${center.x},${center.y})"><rect x="-${badge.length*2.7+4}" y="-8" width="${badge.length*5.4+8}" height="16" rx="3" fill="#AF2817"/><text text-anchor="middle" y="3" fill="white" font-size="10" font-family="Inter,system-ui,sans-serif">${esc(badge)}</text></g>`;
  }
  return `<g class="layout-spacing-overlay" pointer-events="none">${out}</g>`;
}
