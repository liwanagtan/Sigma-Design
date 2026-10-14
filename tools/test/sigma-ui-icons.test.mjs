import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sigmaUIIcons,sigmaIconId,sampleIconsDocument} from '../../src/sample-icons.js';
import {icons} from '../../src/icons.js';
import {readFileSync} from 'node:fs';
test('Sigma UI icons: actual app glyphs are published with stable IDs and inherited paints',()=> {
  const published=sampleIconsDocument(JSON.parse(readFileSync(new URL('../../icon-sets/lucide.json',import.meta.url)))).published.icons;
  assert.equal(published.length,sigmaUIIcons().length);
  assert.ok(published.every(i=>i.id.startsWith('sigma-ui-')&&i.group==='Sigma UI'));
  for(const [name,svg] of Object.entries(icons)) {
    if(name==='logo')continue; // brand mark is multicolor, outside the monochrome icon model
    const icon=published.find(i=>i.id===sigmaIconId(name));assert.ok(icon,name);
    assert.equal(icon.viewBox,/viewBox="([^"]+)"/.exec(svg)[1]);
  }
  assert.match(sigmaUIIcons().find(i=>i.name==='appearance').body,/fill="none" stroke="currentColor"/);
});

test('icon library: instance icon-property choices are retained in linked assets',async()=> {
  const {usedIconIds}=await import('../../src/icon-library.js');
  const ids=usedIconIds([{type:'component',props:{glyph:{type:'icon',default:'sigma-ui-plus'}},children:[]},{type:'instance',propValues:{glyph:'sigma-ui-eye',label:'Some text'},children:[]}]);
  assert.deepEqual([...ids].sort(),['sigma-ui-eye','sigma-ui-plus']);
});
