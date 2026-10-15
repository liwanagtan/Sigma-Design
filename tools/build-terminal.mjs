// Browser assets are checked in so standalone/static Sigma doesn't need a JS bundler.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url), target = new URL('../src/vendor/terminal/', import.meta.url);
mkdirSync(target, { recursive: true });
for (const [pkg, source, output] of [
  ['@xterm/xterm', 'lib/xterm.mjs', 'xterm.mjs'], ['@xterm/xterm', 'css/xterm.css', 'xterm.css'], ['@xterm/xterm', 'LICENSE', 'LICENSE.xterm'],
  ['@xterm/addon-fit', 'lib/addon-fit.mjs', 'addon-fit.mjs'], ['@xterm/addon-fit', 'LICENSE', 'LICENSE.fit'],
]) {
  const root = dirname(require.resolve(pkg + '/package.json'));
  const content = readFileSync(join(root, source), 'utf8').replace(/^\/\/# sourceMappingURL=.*$/gm, '');
  writeFileSync(new URL(output, target), content);
}
