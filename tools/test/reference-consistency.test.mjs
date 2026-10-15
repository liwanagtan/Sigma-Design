import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {OPTICS_ICONS} from '../../src/optics.js';
import {sampleIconsDocument} from '../../src/sample-icons.js';
import {iconChoices,iconMatches} from '../../src/icon-library.js';
import {sigmaTokenDocument,sigmaComponentsDocument,sigmaFoundationsDocument} from '../../src/sigma-design-system.js';
import {useReport} from '../../src/use-report.js';
import {captureSourceText,CAPTURE_SOURCES} from '../design-system/source-fingerprint.js';
test('Optics real rebuild validates complete serialized libraries before writing',()=>{
  const output=mkdtempSync(join(tmpdir(),'sigma-optics-check-'));
  try{execFileSync(process.execPath,['tools/build-optics.mjs','--output',output],{cwd:new URL('../../',import.meta.url)});
    const doc=JSON.parse(readFileSync(join(output,'.sigma/icons/optics-icons.sigma.json'),'utf8'));
    const ids=new Set(doc.icons.map(i=>i.id));assert.equal(ids.size,doc.icons.length);assert.ok(ids.size>1800);for(const id of OPTICS_ICONS)assert.ok(ids.has(id),id);
  }finally{rmSync(output,{recursive:true,force:true});}
});
test('Sigma icon choices deduplicate compatibility aliases without removing IDs or custom artwork',()=>{
  const icons=sampleIconsDocument().icons,choices=iconChoices(icons);
  assert.equal(icons.length-choices.length,3);assert.equal(new Set(choices.map(i=>i.name)).size,choices.length);
  assert.ok(choices.some(i=>iconMatches(i,'aspectLocked')));assert.ok(choices.some(i=>iconMatches(i,'selectChevron')));
  const alias=icons.find(i=>i.id==='sigma-ui-aspectLocked');assert.ok(iconChoices(icons,alias.id).some(i=>i.id===alias.id));
  const edited={...alias,body:'<circle cx="12" cy="12" r="5"/>'};assert.equal(iconChoices([...icons.filter(i=>i.id!==alias.id),edited]).length,choices.length+1);
  assert.equal(icons.length,sampleIconsDocument().icons.length);
});
test('Sigma reusable Components and Foundations bind all measured design decisions',()=>{
  const t=sigmaTokenDocument();for(const make of [sigmaComponentsDocument,sigmaFoundationsDocument]){const doc=make(t.collections);doc.variables={collections:t.collections};const report=useReport([{name:doc.name,doc}]);assert.equal(report.files[0].tokenShare,1,doc.name);assert.deepEqual(report.findings,[]);}
});
test('capture fingerprint changes with icon data and UI JavaScript, not only CSS',async()=>{
  const base=await captureSourceText(path=>path);
  for(const changed of ['src/sample-icons.js','src/lucide-ui-data.js','src/icons-screen.js']){
    assert.ok(CAPTURE_SOURCES.includes(changed));assert.notEqual(await captureSourceText(path=>path===changed?path+' edited':path),base);
  }
});

test('app token extraction retains data URLs and conditional stylesheet provenance',async()=>{
  const {parseStylesheet}=await import('../design-system/css-source.mjs');
  const rows=parseStylesheet('@import url("x.css"); .control{background:url("data:image/svg+xml;a,b");height:28px;} @media(max-width:600px){.control{height:24px;}}','app.css');
  assert.equal(rows.length,2);assert.equal(rows[0].selector,'.control');assert.equal(rows[0].declarations.background,'url("data:image/svg+xml;a,b")');assert.equal(rows[0].declarations.height,'28px');assert.equal(rows[0].condition,'');assert.equal(rows[1].declarations.height,'24px');assert.ok(rows[1].condition.includes('@media'));assert.equal(rows[1].file,'app.css');
});
