import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProjectBackup,prepareProjectRestore,linkedFileIds} from '../../src/project-backup.js';
const document=(name='Design')=>({name,pages:[{id:'page',children:[]}],currentPageId:'page'});
const snapshot=()=>({project:{name:'Example',description:'Saved description',icon:{type:'emoji',value:'🌟'}},files:[
  {meta:{id:'design',name:'Design',sample:true,project:{path:'old'},archivedAt:123},doc:{...document(),project:{path:'old'},libraries:[{fileId:'tokens',collections:[]}],branch:{of:'tokens',base:{uses:{tokens:['id:tokens']}}}},views:{page:{zoom:2}},versions:[{record:{id:'history',fileId:'design',kind:'named',title:'Before',createdAt:1},doc:{...document('Before'),libraries:[{fileId:'tokens'}]}}]},
  {meta:{id:'tokens'},doc:{...document('Tokens'),kind:'tokens',variables:{collections:[]}},views:{},versions:[]},
]});
test('backup format: retains content/history and remaps library, branch and historical file links',()=>{
  const backup=buildProjectBackup(snapshot()),before=JSON.stringify(backup);let id=0;
  const restored=prepareProjectRestore(backup,()=>`new-${++id}`);
  const [design,tokens]=restored.files;
  assert.equal(design.doc.libraries[0].fileId,tokens.meta.id);assert.equal(design.doc.branch.of,tokens.meta.id);
  assert.equal(design.doc.branch.base.uses.tokens[0],'id:'+tokens.meta.id);
  assert.equal(design.versions[0].doc.libraries[0].fileId,tokens.meta.id);
  assert.equal(design.meta.archivedAt,123);assert.equal(design.views.page.zoom,2);
  assert.equal(design.meta.sample,undefined);assert.equal(design.doc.project,undefined);
  assert.equal(restored.project.icon.value,'🌟');assert.equal(JSON.stringify(backup),before);
});
test('backup format: malformed versions and hostile documents fail before persistence',()=>{
  for(const mutate of [b=>b.version=99,b=>b.files.push(b.files[0]),b=>b.files[0].versions[0].record.fileId='wrong',b=>b.files[0].document='{"pages":[{}]}']){
    const backup=buildProjectBackup(snapshot());mutate(backup);assert.throws(()=>prepareProjectRestore(backup));
  }
});
test('backup dependencies include nested published libraries and branch source',()=>{
  assert.deepEqual([...linkedFileIds({componentLibraries:[{fileId:'library',tokens:{dependencies:[{fileId:'tokens'}]}}],branch:{of:'main'}})],['main','library','tokens']);
});
test('backup format: shared Figma artwork and layer identities survive restore',()=>{
  const source=snapshot();source.files[0].doc.figmaImport={warnings:[]};source.files[0].doc.pages[0].children=Array.from({length:100},(_,i)=>({id:'image'+i,type:'image',src:'data:image/png;base64,'+'A'.repeat(10000),w:10,h:10}));
  const backup=buildProjectBackup(source);assert.ok(backup.files[0].document.length<50000);
  const restored=prepareProjectRestore(backup);assert.equal(restored.files[0].doc.pages[0].children[99].id,'image99');
});

test('backup format: unavailable sources stay isolated instead of binding to unrelated existing files',()=>{
  const source=snapshot();source.files[0].doc.iconLibraries=[{fileId:'missing-source',icons:[]}];
  const restored=prepareProjectRestore(buildProjectBackup(source));
  assert.ok(restored.files[0].doc.iconLibraries[0].fileId.startsWith('unavailable-'));
  assert.ok(restored.missingDependencies.includes('missing-source'));
});

test('backup format: Figma vector image data with its UTF-8 charset restores unchanged',()=>{
  const source=snapshot();const image='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L5 5"/></svg>');
  source.files[0].doc.figmaImport={warnings:[]};source.files[0].doc.pages[0].children=[{id:'vector',type:'image',src:image}];
  const restored=prepareProjectRestore(buildProjectBackup(source));assert.equal(restored.files[0].doc.pages[0].children[0].src,image);
});
