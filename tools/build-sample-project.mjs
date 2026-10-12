#!/usr/bin/env node
// Write Sigma's sample files as a project (examples/sample-project/.sigma/…), in the project format:
//   node tools/build-sample-project.mjs
// They're the reference for the schema docs (docs/schema/README.md) and must pass tools/validate.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleTokenDocument } from '../src/sample-tokens.js';
import { sampleIconsDocument } from '../src/sample-icons.js';
import { welcomeDocument } from '../src/welcome.js';
import { serializeForProject, projectPath } from '../src/project-format.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'examples', 'sample-project');
const lucide = JSON.parse(readFileSync(join(root, 'icon-sets', 'lucide.json'), 'utf8'));

const tokens = sampleTokenDocument();
const tokensDoc = { kind: 'tokens', name: tokens.name, pages: [], variables: { collections: tokens.collections } };
const iconsDoc = sampleIconsDocument(lucide);
const guide = welcomeDocument(tokens.collections, { icons: iconsDoc.icons });
const paths = { tokens: projectPath('tokens', tokensDoc.name), icons: projectPath('icons', iconsDoc.name), guide: projectPath('design', guide.name) };
guide.libraries = [{ fileId: 'tokens', name: tokensDoc.name }];
guide.iconLibraries = [{ fileId: 'icons', name: iconsDoc.name }];
const pathOf = (id) => paths[id] || null;

for (const [doc, path] of [[tokensDoc, paths.tokens], [iconsDoc, paths.icons], [guide, paths.guide]]) {
  const { text, warnings } = serializeForProject(doc, { pathOf, path });
  for (const w of warnings) console.warn(`${path}: ${w}`);
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), text);
  console.log(`${path}  ${(text.length / 1024).toFixed(0)} KB, ${text.split('\n').length} lines`);
}
writeFileSync(join(out, 'sigma.config.json'), `${JSON.stringify({
  schema: 1,
  notes: 'Sigma’s sample files as a project. There is no code here: tokens, icons and components have no sources.',
  stack: {},
  tokens: [], icons: [], components: [],
}, null, 2)}\n`);
