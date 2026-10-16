// Run after build. Playwright is a development/CI prerequisite only.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {preview} from 'vite';
import {chromium} from 'playwright';
const server=await preview({root:dirname(fileURLToPath(import.meta.url)),preview:{host:'127.0.0.1',port:0,strictPort:true}});
let browser;
try {
  browser=await chromium.launch();const page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  const width=page.getByRole('textbox',{name:'Width expression'});
  await width.fill('60 * 2');await page.getByRole('button',{name:'Apply width',exact:true}).click();
  assert.equal(await page.getByLabel('Parent width',{exact:true}).textContent(),'192');
  assert.match(await page.getByLabel('Legacy subscriber').textContent(),/120px/);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  assert.equal(await page.getByLabel('Parent width',{exact:true}).textContent(),'152');
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  assert.equal(await page.getByLabel('Parent width',{exact:true}).textContent(),'192');
  await page.getByRole('button',{name:'Unmount inspector',exact:true}).click();
  assert.equal(await page.getByRole('region',{name:'React inspector'}).count(),0);
  await page.getByRole('button',{name:'Mount inspector',exact:true}).click();
  assert.equal(await page.getByLabel('Parent width',{exact:true}).textContent(),'192');
  await page.getByRole('button',{name:'Serialize and reopen',exact:true}).click();
  assert.equal(await page.getByLabel('Parent width',{exact:true}).textContent(),'192');
  await page.getByRole('button',{name:'Toggle appearance',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await width.fill('1/0');await page.getByRole('button',{name:'Apply width',exact:true}).click();
  assert.match(await page.getByRole('alert').textContent(),/Enter a width/);
  assert.equal(await page.getByLabel('Parent width',{exact:true}).textContent(),'192');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/renderers.html`);
  await page.getByRole('combobox',{name:'Rectangle count'}).selectOption('1000');
  await page.getByRole('button',{name:'Run comparison',exact:true}).click();
  await page.getByText('Comparison passed: all hit identities and exports present; shared fixture unchanged.',{exact:true}).waitFor({state:'visible',timeout:30000});
  const report=JSON.parse(await page.locator('#results').textContent());
  assert.equal(report.count,1000);assert.equal(report.rows.length,3);
  assert.equal(report.freshSceneObjects,true);assert.equal(report.svgCacheReset,true);
  for(const row of report.rows){assert.equal(row.hitIdentity,'benchmark-0');assert.ok(row.exportCharacters>0);assert.equal(row.samples,20);}
  assert.deepEqual(errors,[]);console.log('React/store and renderer prototype browser checks passed.');
} finally {await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
