import { icons } from '../../src/icons.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('appearance bootstrap restores a valid preference before styles and tolerates unavailable storage', () => {
  const source = readFileSync(new URL('../../src/appearance-init.js', import.meta.url), 'utf8');
  for (const systemDark of [false,true]) for (const value of ['dark','light','auto','invalid',null]) {
    const document = { documentElement:{ dataset:{} } };
    runInNewContext(source, { document, window:{matchMedia:()=>({matches:systemDark})}, localStorage:{ getItem:()=>value } });
    assert.equal(document.documentElement.dataset.theme, value==='dark' || (value!=='light' && systemDark) ? 'dark' : 'light');
  }
  const document = { documentElement:{ dataset:{} } };
  runInNewContext(source, { document, window:{matchMedia:()=>({matches:true})}, localStorage:{ getItem:()=>{ throw new Error('Unavailable'); } } });
  assert.equal(document.documentElement.dataset.theme, 'dark');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src/appearance-init.js') < html.indexOf('href="styles.css"'));
});


test('Auto follows live system changes; explicit preferences stay fixed and sync between tabs', () => {
  const source = readFileSync(new URL('../../src/appearance.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
  const document = { documentElement:{dataset:{appearance:'auto'}}, querySelectorAll:()=>[], addEventListener:()=>{} };
  const handlers = {}, saved = [];
  const system = {matches:false, addEventListener:(type, handler)=>{handlers.system=handler;}};
  const context = {icons, document, window:{matchMedia:()=>system, addEventListener:(type, handler)=>{handlers[type]=handler;},dispatchEvent:()=>{}},
    localStorage:{setItem:(key,value)=>saved.push(value)}, CustomEvent:class {}};
  runInNewContext(source, context);
  handlers.system({matches:true});
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(saved.length, 0);
  runInNewContext("setAppearance('light')", context);
  handlers.system({matches:true});
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.deepEqual(saved, ['light']);
  handlers.storage({key:'sigma.appearance',newValue:'auto'});
  assert.equal(document.documentElement.dataset.appearance, 'auto');
  handlers.system({matches:true});
  assert.equal(document.documentElement.dataset.theme, 'dark');
  handlers.system({matches:false});
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.deepEqual(saved, ['light']);
});
