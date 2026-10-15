import {test,eq,ok} from './harness.js';
import {icons,layerIcon,UI_ICON_NAMES} from '../src/icons.js';
import {lucideBody,LUCIDE_VERSION} from '../src/lucide.js';
import {LUCIDE_GLYPHS} from '../src/lucide-ui-data.js';
import {sampleIconsDocument,sigmaIconId} from '../src/sample-icons.js';
import {ICON_SETS,loadIconSet} from '../src/icon-library.js';
import {refreshOpticsIconDocument,refreshStoredOpticsIcons} from '../src/optics-icon-migration.js';
import {sigmaTokenDocument} from '../src/sigma-design-system.js';
import {db} from '../src/db.js';
import {createFile} from '../src/files.js';
test('Lucide UI: all semantic glyphs and layer markers use the canonical shared provider',()=>{
  for(const [key,name]of Object.entries(UI_ICON_NAMES)){ok(icons[key].includes(`data-lucide="${name}"`),key);ok(icons[key].includes(lucideBody(name)),key);}
  for(const type of ['frame','group','component','componentSet','instance','rect','ellipse','text','image','line'])ok(layerIcon({type}).includes('data-lucide='),type);
  const doc=sampleIconsDocument();eq(doc.source.version,LUCIDE_VERSION);ok(doc.source.name.includes('Lucide'));ok(doc.icons.some(i=>i.id===sigmaIconId('radius')));ok(doc.icons.length>=Object.keys(LUCIDE_GLYPHS).length);
});
test('Optics icon migration: canonical artwork updates in place, preserving custom content and publishing snapshots',async()=>{
  const catalogue=await loadIconSet(ICON_SETS.find(s=>s.id==='lucide'));
  const icon={id:'optics-plus',name:'plus',body:'<path d="M0 0h1"/>',style:'outline',viewBox:'0 0 10 10',strokeWidth:1};
  const original={kind:'icons',name:'My Optics Icons',icons:[icon,{id:'custom',name:'Custom art',body:'<circle cx="1" cy="1" r="1"/>'}],published:{version:7,icons:[structuredClone(icon)]}};
  const updated=refreshOpticsIconDocument(original,catalogue);ok(updated.changed);eq(updated.doc.icons[0].id,icon.id);eq(updated.doc.icons[0].body,catalogue.icons.find(i=>i[0]==='plus')[3]);eq(updated.doc.icons[1],original.icons[1]);eq(updated.doc.published.version,8);eq(updated.doc.published.icons[0].body,updated.doc.icons[0].body);eq(original.icons[0].body,icon.body);eq(refreshOpticsIconDocument(updated.doc,catalogue).changed,false);
});
test('Optics storage migration updates existing file IDs and consumer snapshots, and runs once',async()=>{
  const catalogue=await loadIconSet(ICON_SETS.find(s=>s.id==='lucide'));
  const icon={id:'optics-check',name:'check',body:'<path d="M0 0h1"/>',style:'outline',viewBox:'0 0 10 10',strokeWidth:1};
  const source={kind:'icons',pages:[],name:'Optics migration fixture',icons:[icon],published:{version:3,icons:[structuredClone(icon)]}};
  const id=await createFile(source,{},{optics:1,projectId:null});
  const design={name:'Edited Optics fixture',pages:[{id:'p',name:'Keep me',children:[{id:'layer',name:'Custom layer',type:'icon',iconId:icon.id,w:31,h:37,x:42,y:52}]}],iconLibraries:[{fileId:id,version:3,icons:[structuredClone(icon)]}],publishedComponents:{icons:[structuredClone(icon)],iconFiles:[{fileId:id,version:3,icons:[structuredClone(icon)]}]}};
  const consumer=await createFile(design,{},{optics:1,projectId:null});
  try{
    const first=await refreshStoredOpticsIcons(db,catalogue);ok(first.includes(id));ok(first.includes(consumer));
    const doc=(await db.get('docs',consumer)).doc;eq(doc.name,design.name);eq(doc.pages[0].children[0],design.pages[0].children[0]);eq(doc.iconLibraries[0].version,4);eq(doc.publishedComponents.iconFiles[0].version,4);ok(doc.publishedComponents.icons[0].body!==icon.body);
    const second=await refreshStoredOpticsIcons(db,catalogue);ok(!second.includes(id)&&!second.includes(consumer));
  }finally{await db.deleteFile(id);await db.deleteFile(consumer);}
});

test('Lucide canvas chrome and menu checks render SVG glyphs instead of font symbols',async()=>{
  const {createNode}=await import('../src/store.js');const {useDoc}=await import('./core.test.js');const {renderOverlay}=await import('../src/render.js');
  const main=createNode('component',{name:'Main',w:120,h:40,children:[]});
  useDoc([main,createNode('instance',{name:'Instance',componentId:main.id,x:160,w:120,h:40,children:[]}),createNode('componentSet',{name:'Variants',y:100,w:120,h:80,children:[]})]);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');renderOverlay(svg);
  for(const name of ['component','diamond','layout-grid'])ok(svg.querySelector(`[data-lucide="${name}"]`),name);
  ok(!/[❖◇]/.test(svg.textContent));
  const {showContextMenu,hideContextMenu}=await import('../src/menu.js');
  try{showContextMenu(20,20,[{label:'Checked',checked:true,action:()=>{}}]);ok(document.querySelector('.menu-check [data-lucide="check"]'));eq(document.querySelector('.menu-check').textContent,'');}finally{hideContextMenu();}
});
