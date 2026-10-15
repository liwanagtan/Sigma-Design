// Open /tools/design-system/capture-pages.html and capture the built-in screens first.
// Save its JSON as work/sigma-pages-captures.json, then run npm run build:pages.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {captureSourceText} from './source-fingerprint.js';
const input = process.argv[2] || '../work/sigma-pages-captures.json';
const data = JSON.parse(readFileSync(input, 'utf8'));
const hash = createHash('sha256').update(await captureSourceText(path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8'))).digest('hex');
if (data.sourceHash !== hash) throw new Error('Capture the current UI sources before building Pages and UI.');
if (data.captures.length !== 4 || new Set(data.captures.map(p=>p.name)).size !== 4) throw new Error('Expected four different Sigma screens.');
const required = { 'Files home':'Home-main', 'Design editor':'File name', Tokens:'Vars-work', Icons:'Icons-body' };
for (const { name, capture } of data.captures) {
  const names = [];
  const visit = node => { if(node.tag === 'img' && !node.src?.startsWith('data:')) throw new Error(`Unbundled image in ${name}`); names.push(node.name); (node.children || []).forEach(visit); };
  visit(capture.tree);
  if (!required[name] || !names.includes(required[name])) throw new Error(`Wrong screen captured for ${name}: expected ${required[name]}.`);
  if (JSON.stringify(capture.tree).includes('That file could not be found')) throw new Error(`Missing file in ${name} capture.`);
}
// Deduplicate computed styles shared by the captured UI elements.
const styles = [], authored = [], styleIds = new Map(), authoredIds = new Map();
const intern = (value, values, ids) => {
  const key = JSON.stringify(value || {});
  if (!ids.has(key)) { ids.set(key, values.length); values.push(value || {}); }
  return ids.get(key);
};
const styleKeys = new Set(['display','background-color','background-image','color','opacity','overflow','box-shadow','font-family','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','text-overflow','padding-top','padding-right','padding-bottom','padding-left','outline-width','outline-style','outline-color','outline-offset', ...['top','right','bottom','left'].flatMap(side=>[`border-${side}-width`,`border-${side}-style`,`border-${side}-color`]), ...['top-left','top-right','bottom-right','bottom-left'].map(corner=>`border-${corner}-radius`)]);
const authoredKeys = new Set(['background','background-color','color','border','border-color','border-radius','font','font-family','font-size','font-weight','line-height','letter-spacing','box-shadow','opacity','outline','outline-color']);
const pack = node => {
  node.style = Object.fromEntries(Object.entries(node.style || {}).filter(([key])=>styleKeys.has(key)));
  node.authored = Object.fromEntries(Object.entries(node.authored || {}).filter(([key])=>authoredKeys.has(key)));
  node.style = intern(node.style, styles, styleIds);
  node.authored = intern(node.authored, authored, authoredIds);
  (node.children || []).forEach(pack);
};
data.captures.forEach(p => pack(p.capture.tree));
const packed = { ...data, styles, authored };
const captureHash = createHash('sha256').update(JSON.stringify(packed)).digest('hex');
const output = `// Generated from rendered Sigma screens by tools/design-system/capture-pages.html.\nconst packed = ${JSON.stringify(packed)};\nconst expand = n => { n.style = packed.styles[n.style]; n.authored = packed.authored[n.authored]; (n.children || []).forEach(expand); };\npacked.captures.forEach(p => expand(p.capture.tree));\nexport const PAGE_CAPTURES = { sourceHash:packed.sourceHash, captureHash:'${captureHash}', captures:packed.captures };\n`;
writeFileSync(new URL('../../src/sigma-page-captures.js', import.meta.url), output);
