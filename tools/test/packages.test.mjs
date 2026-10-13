// Design system packages (monorepos and shared packages): an app uses the Sigma files a package ships, read-only,
// at the version it has installed. node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { startServer } from '../server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS = join(ROOT, 'tools/sigma.mjs');
const PKG = 'node_modules/@acme/ds/.sigma/tokens/core.sigma.json';

// A workspace: packages/ds (the design system, version 2.1.0) and apps/web, which links it through
// node_modules/@acme/ds → ../../../packages/ds, as npm, pnpm and yarn workspaces do.
function workspace() {
  const ws = mkdtempSync(join(tmpdir(), 'sigma-ws-'));
  const ds = join(ws, 'packages', 'ds');
  mkdirSync(join(ds, '.sigma', 'tokens'), { recursive: true });
  writeFileSync(join(ds, 'package.json'), JSON.stringify({ name: '@acme/ds', version: '2.1.0' }));
  writeFileSync(join(ds, '.sigma', 'tokens', 'core.sigma.json'), JSON.stringify({
    format: 1, kind: 'tokens', name: 'Acme core',
    collections: [{ id: 'c', name: 'Core', modes: [{ id: 'm', name: 'Default' }], defaultModeId: 'm', variables: [{ id: 'blue', name: 'color/blue', type: 'color', valuesByMode: { m: '#3B5BFF' } }] }],
  }));
  const app = join(ws, 'apps', 'web');
  mkdirSync(join(app, '.sigma', 'design'), { recursive: true });
  mkdirSync(join(app, 'node_modules', '@acme'), { recursive: true });
  symlinkSync(join('..', '..', '..', '..', 'packages', 'ds'), join(app, 'node_modules', '@acme', 'ds'));
  mkdirSync(join(app, 'node_modules', 'other', '.sigma'), { recursive: true });
  writeFileSync(join(app, 'node_modules', 'other', '.sigma', 'x.sigma.json'), '{}');
  writeFileSync(join(app, 'sigma.config.json'), JSON.stringify({ schema: 1, packages: ['@acme/ds'] }));
  writeFileSync(join(app, '.sigma', 'design', 'home.sigma.json'), JSON.stringify({
    format: 1, kind: 'design', name: 'Home', uses: { tokens: [PKG] },
    pages: [{ id: 'p', name: 'Home', children: [{ id: 'f', type: 'frame', name: 'Hero', w: 100, h: 100, fills: [{}], bindings: { 'fills.0.color': 'blue' } }] }],
  }));
  return { ws, app };
}

test('packages: the app’s files use the package’s tokens, and check finds them', () => {
  const { ws, app } = workspace();
  try {
    const r = spawnSync(process.execPath, [TOOLS, 'check', app], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /2 files: 0 errors/);
    writeFileSync(join(app, 'sigma.config.json'), JSON.stringify({ schema: 1 })); // without the package, the link is broken
    const broken = spawnSync(process.execPath, [TOOLS, 'check', app], { encoding: 'utf8' });
    assert.notEqual(broken.status, 0);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});

test('packages: Sigma lists and reads the package’s files through the workspace link, and never writes them', async () => {
  const { ws, app } = workspace();
  const { server, url } = await startServer({ port: 0, strictPort: true, project: app });
  try {
    const listing = await (await fetch(`${url}/api/project`)).json();
    const file = listing.files.find((f) => f.path === PKG);
    assert.deepEqual([file.kind, file.name, file.package, file.version, file.readOnly], ['tokens', 'Acme core', '@acme/ds', '2.1.0', true]);
    assert.ok(!listing.files.some((f) => f.path.startsWith('node_modules/other/')), 'only packages named in the config');
    const read = await fetch(`${url}/api/project/file?path=${encodeURIComponent(PKG)}`);
    assert.equal((await read.json()).name, 'Acme core');
    const write = await fetch(`${url}/api/project/file?path=${encodeURIComponent(PKG)}`, { method: 'PUT', headers: { 'X-Sigma': '1' }, body: '{}' });
    assert.equal(write.status, 403);
    assert.match((await write.json()).error, /comes from the package @acme\/ds \(2\.1\.0\)/);
    const other = await fetch(`${url}/api/project/file?path=${encodeURIComponent('node_modules/other/.sigma/x.sigma.json')}`);
    assert.equal(other.status, 400, 'a package that isn’t in the config stays out');
    const escape = await fetch(`${url}/api/project/file?path=${encodeURIComponent('node_modules/@acme/ds/package.json')}`);
    assert.equal(escape.status, 400, 'only its .sigma/ files');
  } finally {
    server.close();
    rmSync(ws, { recursive: true, force: true });
  }
});
