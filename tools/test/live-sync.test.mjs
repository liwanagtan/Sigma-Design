// Live sync (tools/live-sync.mjs, with the server's afterSave): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
import { startLiveSync } from '../live-sync.mjs';

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'sigma.mjs');
const CSS = `:root {
  --color-brand: #3b5bff;
  --color-ink: #1e1e1e;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --radius: 8px;
}
`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>\n';

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-live-'));
  const put = (p, t) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), t);
  };
  put('src/tokens.css', CSS);
  put('src/icons/minus.svg', SVG);
  put('sigma.config.json', JSON.stringify({
    schema: 1,
    tokens: [{ sigma: '.sigma/tokens/app.sigma.json', name: 'App tokens', sources: [{ path: 'src/tokens.css', format: 'css-variables' }], naming: 'kebab', modes: { Default: ':root' } }],
    icons: [{ sigma: '.sigma/icons/app-icons.sigma.json', name: 'App icons', source: 'src/icons', output: 'svg' }],
  }));
  for (const kind of ['tokens', 'icons']) assert.equal(spawnSync(process.execPath, [TOOLS, kind, 'import', dir]).status, 0);
  return dir;
}
const sigmaPath = (dir) => join(dir, '.sigma/tokens/app.sigma.json');
const tokenValue = (dir, name) => {
  const f = JSON.parse(readFileSync(sigmaPath(dir), 'utf8'));
  for (const c of f.collections) for (const v of c.variables) if (v.name === name) return Object.values(v.valuesByMode)[0];
};
// Sigma's save: the file with one token changed, PUT like the editor does.
async function saveInSigma(url, dir, rel, edit) {
  const r0 = await fetch(`${url}/api/project/file?path=${rel}`);
  const file = await r0.json();
  edit(file);
  const r = await fetch(`${url}/api/project/file?path=${rel}&base=${r0.headers.get('x-sigma-mtime')}`, { method: 'PUT', headers: { 'X-Sigma': '1' }, body: JSON.stringify(file, null, 2) });
  return r.json();
}
const setToken = (name, value) => (file) => {
  for (const c of file.collections) for (const v of c.variables) if (v.name === name) v.valuesByMode[Object.keys(v.valuesByMode)[0]] = value;
};
const until = async (fn, ms = 5000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

test('live sync: saving a token in Sigma writes the CSS at once; editing the CSS updates Sigma by itself', async () => {
  const dir = project();
  const sync = startLiveSync({ root: dir, interval: 200 });
  await sync.ready;
  const { server, url } = await startServer({ port: 0, strictPort: true, project: dir, afterSave: sync.afterSave });
  try {
    const reply = await saveInSigma(url, dir, '.sigma/tokens/app.sigma.json', setToken('color/brand', '#1F4AE0'));
    assert.deepEqual(reply.code.written, [{ path: 'src/tokens.css', lines: 1 }]);
    assert.equal(readFileSync(join(dir, 'src/tokens.css'), 'utf8'), CSS.replace('#3b5bff', '#1f4ae0'), 'one value, in the file’s own case');
    // Code → Sigma: an edit in the CSS (no command run).
    writeFileSync(join(dir, 'src/tokens.css'), readFileSync(join(dir, 'src/tokens.css'), 'utf8').replace('--radius: 8px', '--radius: 12px'));
    assert.ok(await until(() => tokenValue(dir, 'radius') === 12), 'Sigma follows the code');
    assert.equal(tokenValue(dir, 'color/brand'), '#1F4AE0', 'and keeps what was saved');
  } finally {
    sync.stop();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live sync: a save writes only what it changed, never over a code change Sigma hasn’t read yet', async () => {
  const dir = project();
  const sync = startLiveSync({ root: dir, interval: 60000 }); // no checks during the test: the edit stays unread
  await sync.ready;
  const { server, url } = await startServer({ port: 0, strictPort: true, project: dir, afterSave: sync.afterSave });
  try {
    writeFileSync(join(dir, 'src/tokens.css'), CSS.replace('--color-ink: #1e1e1e', '--color-ink: #000000'));
    await saveInSigma(url, dir, '.sigma/tokens/app.sigma.json', setToken('space/4', 24));
    const css = readFileSync(join(dir, 'src/tokens.css'), 'utf8');
    assert.match(css, /--color-ink: #000000/, 'the code’s own change is kept');
    assert.match(css, /--space-4: 1\.5rem/, 'the saved change is written, in rem like before');
  } finally {
    sync.stop();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live sync: saving an icon writes its SVG file', async () => {
  const dir = project();
  const sync = startLiveSync({ root: dir, interval: 60000 });
  await sync.ready;
  const { server, url } = await startServer({ port: 0, strictPort: true, project: dir, afterSave: sync.afterSave });
  try {
    const reply = await saveInSigma(url, dir, '.sigma/icons/app-icons.sigma.json', (file) => {
      file.icons[0].body = '<path d="M5 12h14"/><path d="M12 5v14"/>';
    });
    assert.deepEqual(reply.code.written.map((f) => f.path), ['src/icons/minus.svg']);
    assert.match(readFileSync(join(dir, 'src/icons/minus.svg'), 'utf8'), /M12 5v14/);
  } finally {
    sync.stop();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
