// Vendor browser-native ESM. Imports require no CDN or Figma credentials.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const files = {'figma-parser.js':'node_modules/openfig-core/dist/index.js','figma-fflate.js':'node_modules/fflate/esm/browser.js','figma-kiwi.js':'node_modules/kiwi-schema/kiwi-esm.js','figma-fzstd.js':'node_modules/fzstd/esm/index.mjs'};
mkdirSync(new URL('src/vendor/',root), {recursive:true});
for (const [target, source] of Object.entries(files)) {
  const code=readFileSync(new URL(source,root),'utf8').replace(/from "fflate"/g,'from "./figma-fflate.js"').replace(/from "kiwi-schema"/g,'from "./figma-kiwi.js"').replace(/from "fzstd"/g,'from "./figma-fzstd.js"');
  const output='// Vendored MIT code. See figma-parser.NOTICE.txt. Regenerate with npm run build:figma.\n'+code;
  const path=new URL(`src/vendor/${target}`,root);
  if(process.argv.includes('--check')) { if(readFileSync(path,'utf8')!==output) throw Error(`Stale Figma parser: ${target}`); }
  else writeFileSync(path,output);
}
