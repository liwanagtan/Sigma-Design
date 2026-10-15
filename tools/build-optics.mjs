#!/usr/bin/env node
// Write Optics (Phase 36), the working design system that ships with Sigma, as a project (examples/optics/.sigma/…),
// in the project format:
//   node tools/build-optics.mjs
// Optics Tokens, Optics Icons (the sample icons with Optics ids), Optics Foundations and Optics Components,
// built by the same code that adds Optics in the browser (src/optics-tokens.js, src/optics.js). They must pass
// `sigma-design check` (CI runs it on every example). Open them with: npx sigma-design dev examples/optics
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lucideIconsDocument } from '../src/sample-icons.js';
import { opticsTokenDocument } from '../src/optics-tokens.js';
import { opticsIconsDocument, opticsComponentsDocument, opticsFoundationsDocument } from '../src/optics.js';
import { validateFile } from '../src/validate.js';
import { OPTICS_ICONS } from '../src/optics.js';
import { serializeForProject, projectPath } from '../src/project-format.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputIndex=process.argv.indexOf('--output');
const out = outputIndex>=0 ? resolve(process.argv[outputIndex+1]) : join(root, 'examples', 'optics');
const lucide = JSON.parse(readFileSync(join(root, 'icon-sets', 'lucide.json'), 'utf8'));

const tokens = opticsTokenDocument();
const tokensDoc = { kind: 'tokens', name: tokens.name, pages: [], variables: { collections: tokens.collections } };
const sample = lucideIconsDocument(lucide);
const iconsDoc = opticsIconsDocument(sample.icons, sample.source);
const components = opticsComponentsDocument(tokens.collections);
const foundations = opticsFoundationsDocument(tokens.collections, { icons: iconsDoc.icons });
for (const doc of [components, foundations]) {
  doc.libraries = [{ fileId: 'tokens', name: tokensDoc.name }];
  doc.iconLibraries = [{ fileId: 'icons', name: iconsDoc.name }];
}
const paths = {
  tokens: projectPath('tokens', tokensDoc.name), icons: projectPath('icons', iconsDoc.name),
  components: projectPath('design', components.name), foundations: projectPath('design', foundations.name),
};
const pathOf = (id) => paths[id] || null;

const outputs=[[tokensDoc, paths.tokens], [iconsDoc, paths.icons], [foundations, paths.foundations], [components, paths.components]].map(([doc,path])=>({path,...serializeForProject(doc,{pathOf,path})}));
const files=Object.fromEntries(outputs.map(o=>[o.path,JSON.parse(o.text)]));
const ids=new Set(iconsDoc.icons.map(i=>i.id));
if(ids.size!==iconsDoc.icons.length || OPTICS_ICONS.some(id=>!ids.has(id))) throw new Error('Optics icons must have unique IDs and resolve every required glyph.');
for(const {path} of outputs){const errors=validateFile(files[path],{path,files}).filter(i=>i.level==='error');if(errors.length)throw new Error(`${path}: ${JSON.stringify(errors.slice(0,5))}`);}
for (const {path,text,warnings} of outputs) {
  for (const w of warnings) console.warn(`${path}: ${w}`);
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), text);
  console.log(`${path}  ${(text.length / 1024).toFixed(0)} KB, ${text.split('\n').length} lines`);
}
writeFileSync(join(out, 'sigma.config.json'), `${JSON.stringify({
  schema: 1,
  notes: 'Optics, a working design system made in Sigma and inspired by Shopify’s Polaris. There is no code here: tokens, icons and components have no sources. Rebuild with node tools/build-optics.mjs.',
  stack: {},
  tokens: [], icons: [], components: [],
}, null, 2)}\n`);
