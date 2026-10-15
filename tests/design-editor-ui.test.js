import {test,eq,ok} from './harness.js';
import {createNode} from '../src/store.js';
import {createFile} from '../src/files.js';
import {db} from '../src/db.js';
import {DEFAULT_LAYOUT} from '../src/layout.js';
const wait=async(fn)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw new Error('Design editor did not reach the expected state');};
test('Design editor UI: min/max clear, constraint pins, component colors and spacing previews work in the actual app',async()=>{
  const child=createNode('rect',{name:'Anchor',w:80,h:20}),fill=createNode('rect',{name:'Filler',w:40,h:20,sizingH:'fill'});
  const main=createNode('component',{name:'Layout fixture',sizingH:'hug',sizingV:'hug',layout:{...DEFAULT_LAYOUT,gap:12,pl:16,pr:16,pt:8,pb:8},children:[child,fill]});
  const pinned=createNode('rect',{name:'Pinned child',w:40,h:20});
  const plain=createNode('frame',{name:'Plain frame',x:400,w:200,h:100,children:[pinned]});
  const id=await createFile({name:'Disposable editor reliability fixture',pages:[{id:'ui-page',name:'Page',children:[main,plain]}],currentPageId:'ui-page'},{},{projectId:null});
  const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-5000px;width:1280px;height:900px';document.body.append(frame);
  try{
    frame.src=`/index.html?reliability-fixture=1#/file/${id}`;
    await wait(()=>frame.contentDocument?.querySelector(`.layer-row[data-id="${main.id}"]`));
    const d=frame.contentDocument,w=frame.contentWindow;
    const choose=async node=>{d.querySelector(`.layer-row[data-id="${node.id}"] .name`).click();await wait(()=>d.querySelector(`.layer-row.selected[data-id="${node.id}"]`));await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));};
    await choose(main);ok(!d.querySelector('[data-key="minW"]'),'limits start collapsed');d.querySelector('[data-action="show-limits"]').click();await wait(()=>d.querySelector('[data-key="minW"]'));
    const minimum=d.querySelector('[data-key="minW"]');eq(minimum.getAttribute('aria-label'),'Minimum width');minimum.value='140';minimum.dispatchEvent(new w.Event('change',{bubbles:true}));
    await wait(()=>d.querySelector('[data-key="w"]')?.value==='140');
    d.querySelector('[data-action="show-limits"]').click();await wait(()=>!d.querySelector('[data-key="minW"]'));ok(d.querySelector('[data-action="show-limits"]').textContent.includes('Active'),'configured limits remain discoverable');d.querySelector('[data-action="show-limits"]').click();await wait(()=>d.querySelector('[data-key="minW"]'));
    d.querySelector('[data-clear-limit="minW"]').click();await wait(()=>d.querySelector('[data-key="w"]')?.value==='112');
    d.querySelector('[data-spacing-pin]').click();await wait(()=>d.querySelector('[data-spacing-region="padH"]'));ok(d.querySelector('[data-spacing-region="gap"]'));
    d.querySelector('[data-spacing-pin]').click();await wait(()=>!d.querySelector('.layout-spacing-overlay'));
    const row=d.querySelector(`.layer-row[data-id="${child.id}"]`);eq(w.getComputedStyle(row.querySelector('.name')).color,w.getComputedStyle(row.querySelector('.licon')).color);
    await choose(pinned);d.querySelector('[data-pin-edge="right"]').click();await wait(()=>d.querySelector('[data-constraint="h"]')?.value==='leftRight');
    d.querySelector('[data-pin-center]').click();await wait(()=>d.querySelector('[data-constraint="h"]')?.value==='center'&&d.querySelector('[data-constraint="v"]')?.value==='center');
    d.querySelector(`.layer-row[data-id="${child.id}"]`).dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:100,clientY:100}));await wait(()=>[...d.querySelectorAll('.menu-item')].some(e=>e.textContent.includes('Go to main component')));
  }finally{frame.remove();await db.deleteFile(id);}
});
