#!/usr/bin/env node
// Write Optics (Phase 36), the working design system that ships with Sigma, as a project (examples/optics/.sigma/…),
// in the project format:
//   node tools/build-optics.mjs
// Optics Tokens, Optics Icons (the Sigma Icons set with Optics ids), Optics Foundations and Optics Components,
// built by the same code that adds Optics in the browser (src/optics-tokens.js, src/optics.js). They must pass
// `sigma-design check` (CI runs it on every example). Open them with: npx sigma-design dev examples/optics
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleIconsDocument } from '../src/sample-icons.js';
import { opticsTokenDocument } from '../src/optics-tokens.js';
import { opticsIconsDocument, opticsComponentsDocument, opticsFoundationsDocument } from '../src/optics.js';
import { serializeForProject, projectPath } from '../src/project-format.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'examples', 'optics');
const lucide = JSON.parse(readFileSync(join(root, 'icon-sets', 'lucide.json'), 'utf8'));

const tokens = opticsTokenDocument();
const tokensDoc = { kind: 'tokens', name: tokens.name, pages: [], variables: { collections: tokens.collections } };
const sample = sampleIconsDocument(lucide);
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

for (const [doc, path] of [[tokensDoc, paths.tokens], [iconsDoc, paths.icons], [foundations, paths.foundations], [components, paths.components]]) {
  const { text, warnings } = serializeForProject(doc, { pathOf, path });
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
