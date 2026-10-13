// sigma-design init (tools/init.mjs): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { detectProject, planInit, runInit } from '../init.mjs';
import { validateConfig } from '../../src/project-config.js';

// A throwaway project from { path: text }.
function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-init-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg>';
const TOKENS = `:root {
  --color-blue-500: #3b5bff;
  --color-gray-0: #ffffff;
  --color-gray-900: #1e1e1e;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --surface: var(--color-gray-0);
  --text: var(--color-gray-900);
}
[data-theme="dark"] {
  --surface: var(--color-gray-900);
  --text: var(--color-gray-0);
}
`;

test('init: CSS variables (with a dark mode), SVG icons and package.json', () => {
  const dir = project({
    'package.json': '{\n    "name": "@acme/web",\n    "dependencies": { "react": "^19.0.0" }\n}\n',
    'src/styles/tokens.css': TOKENS,
    'src/styles/app.css': '.button { color: var(--text); }',
    'src/assets/icons/arrows/arrow-right.svg': SVG,
    'src/assets/icons/plus.svg': SVG,
    'src/assets/icons/check.svg': SVG,
    'node_modules/lib/icons/a.svg': SVG,
  });
  const plan = runInit(dir, { version: '0.1.0' });
  const config = JSON.parse(readFileSync(join(dir, 'sigma.config.json'), 'utf8'));
  assert.deepEqual(config.tokens, [{
    sigma: '.sigma/tokens/web.sigma.json', name: 'Web tokens', sources: [{ path: 'src/styles/tokens.css', format: 'css-variables' }],
    naming: 'kebab', modes: { Light: ':root', Dark: '[data-theme="dark"]' },
  }]);
  assert.deepEqual(config.icons, [{ sigma: '.sigma/icons/web-icons.sigma.json', name: 'Web icons', source: 'src/assets/icons', output: 'svg' }]);
  assert.deepEqual(config.stack, { styling: ['css-variables'], framework: 'react' });
  assert.deepEqual(validateConfig(config).filter((i) => i.level === 'error'), []);
  assert.deepEqual(plan.forAgent, []);
  const pkg = readFileSync(join(dir, 'package.json'), 'utf8');
  assert.match(pkg, /\n {4}"devDependencies": \{\n {8}"sigma-design": "\^0\.1\.0"/, 'keeps the file’s 4-space indent');
  assert.equal(JSON.parse(pkg).scripts.sigma, 'sigma-design dev');
  assert.ok(existsSync(join(dir, '.sigma')));
  rmSync(dir, { recursive: true, force: true });
});

test('init: running it again changes nothing, and an existing config is left alone', () => {
  const dir = project({ 'package.json': '{ "name": "app" }\n', 'src/tokens.css': TOKENS });
  runInit(dir);
  const config = readFileSync(join(dir, 'sigma.config.json'), 'utf8');
  const pkg = readFileSync(join(dir, 'package.json'), 'utf8');
  const again = runInit(dir);
  assert.equal(again.config, null);
  assert.equal(again.packageJson, null);
  assert.equal(readFileSync(join(dir, 'sigma.config.json'), 'utf8'), config);
  assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), pkg);
  rmSync(dir, { recursive: true, force: true });
});

test('init: a stack Sigma doesn’t read itself goes to the agent; nothing is guessed', () => {
  const dir = project({
    'package.json': JSON.stringify({ name: 'tw', devDependencies: { tailwindcss: '^4.0.0' } }),
    'src/app.css': '@import "tailwindcss";\n@theme {\n  --color-brand: #3b5bff;\n  --spacing: 0.25rem;\n}\n',
    'src/theme.ts': 'export const theme = createTheme({ palette: {} });',
  });
  const plan = planInit(dir, detectProject(dir));
  assert.equal(plan.config.tokens, undefined);
  assert.ok(plan.forAgent.some((l) => /tailwind-theme/.test(l) && /sigma-sync skill/.test(l)));
  assert.ok(plan.config.stack.styling.includes('tailwind'));
  rmSync(dir, { recursive: true, force: true });
});

test('init: a DTCG tokens.json is read directly; no package.json is fine', () => {
  const dir = project({ 'design/tokens.json': JSON.stringify({ color: { brand: { $type: 'color', $value: '#3b5bff' } } }) });
  const plan = planInit(dir, detectProject(dir));
  assert.deepEqual(plan.config.tokens[0].sources, [{ path: 'design/tokens.json', format: 'dtcg' }]);
  assert.equal(plan.packageJson, null);
  assert.ok(plan.notes.some((n) => /npx sigma-design dev/.test(n)));
  rmSync(dir, { recursive: true, force: true });
});

test('init: modes from media queries; component-scoped variables aren’t modes', () => {
  const css = `${TOKENS.split('[data-theme')[0]}@media (prefers-color-scheme: dark) {\n  :root {\n    --surface: #000000;\n    --text: #ffffff;\n  }\n}\n.card { --surface: #fafafa; }\n`;
  const dir = project({ 'tokens.css': css });
  const plan = planInit(dir, detectProject(dir));
  assert.deepEqual(plan.config.tokens[0].modes, { Light: ':root', Dark: '@media (prefers-color-scheme: dark) :root' });
  rmSync(dir, { recursive: true, force: true });
});
