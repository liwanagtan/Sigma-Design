import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {LUCIDE_GLYPHS,LUCIDE_VERSION} from '../../src/lucide-ui-data.js';
import {UI_ICON_NAMES} from '../../src/ui-icon-map.js';
test('Lucide UI registry is an exact, reproducible subset of the licensed bundled catalogue',()=>{
  execFileSync(process.execPath,['tools/icons/build-ui.mjs','--check'],{cwd:new URL('../../',import.meta.url)});
  const catalogue=JSON.parse(readFileSync(new URL('../../icon-sets/lucide.json',import.meta.url),'utf8'));
  assert.equal(LUCIDE_VERSION,catalogue.version);const byName=new Map(catalogue.icons.map(i=>[i[0],i[3]]));
  for(const [name,body]of Object.entries(LUCIDE_GLYPHS))assert.equal(body,byName.get(name),name);
  for(const name of Object.values(UI_ICON_NAMES))assert.ok(LUCIDE_GLYPHS[name],name);
  assert.ok(Object.keys(LUCIDE_GLYPHS).length<150,'the app loads a UI subset, not the full catalogue');
});
