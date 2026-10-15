import {test,eq,ok} from './harness.js';
import {icons,layerIcon,UI_ICON_NAMES} from '../src/icons.js';
import {lucideBody,LUCIDE_VERSION} from '../src/lucide.js';
import {LUCIDE_GLYPHS} from '../src/lucide-ui-data.js';
import {sampleIconsDocument,sigmaIconId} from '../src/sample-icons.js';
import {ICON_SETS,loadIconSet} from '../src/icon-library.js';
import {refreshOpticsIconDocument,refreshStoredOpticsIcons} from '../src/optics-icon-migration.js';
import {sigmaTokenDocument,sigmaFoundationsDocument} from '../src/sigma-design-system.js';
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

test('Sigma reference project: Lucide names are searchable and iconography uses linked icons and theme tokens',()=>{
  const icons=sampleIconsDocument().icons;
  const radius=icons.find(i=>i.id===sigmaIconId('radius'));
  eq(radius.name,'square-round-corner');ok(radius.keywords.includes('radius'));
  const collections=sigmaTokenDocument().collections;
  const doc=sigmaFoundationsDocument(collections);
  const pages=doc.pages.filter(p=>p.name==='Iconography');eq(pages.length,2);
  const ids=new Set(icons.map(i=>i.id));
  for(const page of pages){const surface=page.children[0];ok(surface.bindings['fills.0.color']);ok(surface.modes);const glyphs=surface.children.filter(n=>n.type==='icon');eq(glyphs.length,16);for(const glyph of glyphs){ok(ids.has(glyph.iconId));ok(glyph.bindings['fills.0.color']);ok(glyph.bindings.w);ok(glyph.bindings.h);}}
});
