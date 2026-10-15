import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
test('welcome design system source matches the repository stylesheet', () => {
  execFileSync(process.execPath, ['tools/design-system/build.mjs', '--check'], { cwd: new URL('../../', import.meta.url) });
});

test('Pages and UI captures match current UI sources and include four desktop screens', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { default:assert } = await import('node:assert/strict');
  const { PAGE_CAPTURES } = await import('../../src/sigma-page-captures.js');
  const {captureSourceText}=await import('../design-system/source-fingerprint.js');
  assert.equal(PAGE_CAPTURES.sourceHash, createHash('sha256').update(await captureSourceText(path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8'))).digest('hex'));
  const text=[];const scan=n=>{if(n.text)text.push(n.text);(n.children||[]).forEach(scan);};scan(PAGE_CAPTURES.captures.find(c=>c.name==='Icons').capture.tree);
  assert.ok(text.includes('Lucide · Sigma UI'));assert.ok(text.includes('sun-moon'));assert.ok(!text.includes('selectChevron'));
  assert.match(PAGE_CAPTURES.captureHash, /^[a-f0-9]{64}$/, 'capture content has an identity independent of CSS');
  const { SIGMA_PAGES_SOURCE_HASH } = await import('../../src/sigma-pages.js');
  assert.equal(SIGMA_PAGES_SOURCE_HASH, `${PAGE_CAPTURES.sourceHash}:${PAGE_CAPTURES.captureHash}`);
  const required = { 'Files home':'Home-main', 'Design editor':'File name', Tokens:'Vars-work', Icons:'Icons-body' };
  for (const {name,capture} of PAGE_CAPTURES.captures) {
    const names = [];
    const visit = node => { names.push(node.name); (node.children || []).forEach(visit); };
    visit(capture.tree);
    assert.ok(names.includes(required[name]), `${name} contains its actual screen`);
    assert.equal(names.filter(n => n === 'Terminal').length, ['Design editor', 'Tokens'].includes(name) ? 1 : 0, `${name} has the correct terminal rail tool`);
    assert.ok(!JSON.stringify(capture.tree).includes('That file could not be found'));
  }
  assert.deepEqual(PAGE_CAPTURES.captures.map(p=>[p.name,p.capture.viewport]), [
    ['Files home',{w:1280,h:900}], ['Design editor',{w:1280,h:900}], ['Tokens',{w:1280,h:900}], ['Icons',{w:1280,h:900}],
  ]);
});
