import {test,ok,eq} from './harness.js';
import {nodeSVG} from '../src/render.js';
import {importFiles,loadFile,deleteFile} from '../src/files.js';

test('security: hostile imported paints stay inert SVG attributes',async()=>{
  const marker='__sigmaImportExecuted';delete window[marker];
  const attack=`red" onpointerenter="window.${marker}=true`;
  const node={id:'safe-id',type:'rect',x:0,y:0,w:80,h:30,rotation:0,opacity:1,visible:true,strokeWidth:0,fills:[{color:attack,opacity:1}]};
  const file=new File([JSON.stringify({name:'Security test',pages:[{id:'p',children:[node]}]})],'security.sigma.json');
  const ids=await importFiles([file]);eq(ids.length,1);
  const host=document.createElementNS('http://www.w3.org/2000/svg','svg');
  try {
    const stored=await loadFile(ids[0]);host.innerHTML=nodeSVG(stored.doc.pages[0].children[0]);document.body.append(host);
    const rect=host.querySelector('rect');ok(rect);ok(!rect.hasAttribute('onpointerenter'));
    rect.dispatchEvent(new Event('pointerenter'));eq(window[marker],undefined);
  }finally{host.remove();for(const id of ids)await deleteFile(id);delete window[marker];}
});

test('security: malformed clipboard-equivalent geometry and remote image imports are refused',async()=>{
  for(const node of [{id:'x',type:'rect',w:'1" onload="bad()'},{id:'x',type:'image',src:'https://example.com/image.png'}]){
    const ids=await importFiles([new File([JSON.stringify({pages:[{id:'p',children:[node]}]})],'bad.sigma.json')]);
    eq(ids,[]);
  }
});
