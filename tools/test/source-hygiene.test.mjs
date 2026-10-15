import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('app modules resolve local imports and never ship regression fixture dependencies',()=>{
  const files=[];const visit=dir=>{for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())visit(p);else if(/\.(js|mjs)$/.test(e.name))files.push(p);}};visit(join(root,'src'));
  for(const file of files){const text=readFileSync(file,'utf8');for(const [,ref] of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)){
    if(!ref.startsWith('.'))continue;
    const target=resolve(dirname(file),ref);assert.ok(existsSync(target),`${file}: missing ${ref}`);assert.ok(!target.startsWith(join(root,'tests')+'/'),`${file} imports a test fixture`);
  }}
  for(const retired of ['src/welcome.js','src/sample-tokens.js','src/sigma-pages.js','src/sigma-page-captures.js','src/ui-component-fixtures.js','tools/design-system/build-pages.mjs'])assert.ok(!existsSync(join(root,retired)),`${retired} must not return to the app`);
});
