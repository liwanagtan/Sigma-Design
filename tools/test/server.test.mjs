// The project server (tools/server.mjs): node --test tools/test/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { execFileSync } from 'node:child_process';
import { startServer } from '../server.mjs';

let dir, server, base;
const logs = [];

test('standalone CSP: editor blocks dynamic evaluation and the decoder alone has a restricted worker policy',async()=>{
  const editor=await fetch(base+'/index.html');const html=await editor.text();
  const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(policy.includes("script-src 'self';"));assert.ok(!policy.includes('unsafe-eval'));
  const worker=await fetch(base+'/src/figma-import-worker.js?protocol=2');
  assert.equal(worker.status,200);assert.ok(worker.headers.get('content-security-policy').includes("script-src 'self' 'unsafe-eval'"));
  assert.ok(worker.headers.get('content-security-policy').includes("connect-src 'none'"));
  assert.ok(worker.headers.get('content-security-policy').includes("worker-src 'none'"));
  assert.equal(worker.headers.get('x-content-type-options'),'nosniff');
  const encoded=await fetch(base+'/src/%66igma-import-worker.js');
  assert.equal(encoded.headers.get('content-security-policy'),worker.headers.get('content-security-policy'));
  assert.equal((await fetch(base+'/api/project')).headers.get('x-content-type-options'),'nosniff');
});

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sigma-server-'));
  mkdirSync(join(dir, '.sigma', 'tokens'), { recursive: true });
  mkdirSync(join(dir, '.sigma', 'changesets'), { recursive: true });
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, '.sigma', 'tokens', 'core.sigma.json'), JSON.stringify({ format: 1, kind: 'tokens', name: 'Core tokens', collections: [] }));
  writeFileSync(join(dir, '.sigma', 'changesets', 'a.json'), JSON.stringify({ id: 'a', title: 'A' }));
  writeFileSync(join(dir, 'sigma.config.json'), JSON.stringify({ schema: 1 }));
  writeFileSync(join(dir, 'src', 'app.js'), 'secret');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'], { cwd: dir });
  ({ server, url: base } = await startServer({ port: 0, strictPort: true, project: dir, log: (l) => logs.push(l) }));
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

// A request with full control of the headers (fetch can't set Host).
function call(method, path, { body = null, headers = {} } = {}) {
  const url = new URL(path, base);
  return new Promise((ok, fail) => {
    const req = request({ method, hostname: '127.0.0.1', port: url.port, path: url.pathname + url.search, headers: { host: `localhost:${url.port}`, ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        ok({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', fail);
    if (body !== null) req.write(body);
    req.end();
  });
}

test('lists the project: its name, Sigma files with kind and name, and config', async () => {
  const r = await call('GET', '/api/project');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.files.map((f) => [f.path, f.kind, f.name]), [['.sigma/tokens/core.sigma.json', 'tokens', 'Core tokens']]);
  assert.match(r.json.files[0].mtime, /^\d+$/);
  assert.deepEqual(r.json.config, { schema: 1 });
});

test('reads Sigma files, but nothing else in the project', async () => {
  const r = await call('GET', '/api/project/file?path=.sigma/tokens/core.sigma.json');
  assert.equal(r.status, 200);
  assert.match(r.headers['x-sigma-mtime'], /^\d+$/);
  for (const path of ['src/app.js', '../etc/passwd', '.sigma/../src/app.js', '/etc/passwd', '.sigma\\x.json']) {
    assert.equal((await call('GET', `/api/project/file?path=${encodeURIComponent(path)}`)).status, 400, path);
  }
});

test('answers only requests addressed to localhost', async () => {
  const r = await call('GET', '/api/project', { headers: { host: 'evil.example' } });
  assert.equal(r.status, 403);
});

test('writes only with the X-Sigma header, and never over a change it hasn’t read', async () => {
  const path = '.sigma/tokens/core.sigma.json';
  const { headers } = await call('GET', `/api/project/file?path=${path}`);
  const mtime = headers['x-sigma-mtime'];
  assert.equal((await call('PUT', `/api/project/file?path=${path}&base=${mtime}`, { body: '{}' })).status, 403, 'no header');
  const ok = await call('PUT', `/api/project/file?path=${path}&base=${mtime}`, { body: '{"format":1,"kind":"tokens","name":"Core"}', headers: { 'x-sigma': '1' } });
  assert.equal(ok.status, 200);
  assert.notEqual(ok.json.mtime, mtime);
  assert.equal(readFileSync(join(dir, path), 'utf8'), '{"format":1,"kind":"tokens","name":"Core"}');
  const stale = await call('PUT', `/api/project/file?path=${path}&base=${mtime}`, { body: '{}', headers: { 'x-sigma': '1' } });
  assert.equal(stale.status, 409, 'written from an old read');
  assert.equal((await call('PUT', `/api/project/file?path=${path}&base=new`, { body: '{}', headers: { 'x-sigma': '1' } })).status, 409, 'new over an existing file');
  assert.ok(logs.some((l) => l.includes(path)), 'writes are logged');
});

test('new files go in new folders; files outside .sigma can’t be written', async () => {
  const r = await call('PUT', '/api/project/file?path=.sigma/design/new.sigma.json&base=new', { body: '{}', headers: { 'x-sigma': '1' } });
  assert.equal(r.status, 200);
  assert.ok(existsSync(join(dir, '.sigma', 'design', 'new.sigma.json')));
  assert.equal((await call('PUT', '/api/project/file?path=src/app.js', { body: 'x', headers: { 'x-sigma': '1' } })).status, 400);
  assert.equal(readFileSync(join(dir, 'src', 'app.js'), 'utf8'), 'secret');
});

test('a link inside .sigma can’t lead outside the project', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'sigma-outside-'));
  symlinkSync(outside, join(dir, '.sigma', 'linked'));
  const r = await call('PUT', '/api/project/file?path=.sigma/linked/x.json&base=new', { body: '{}', headers: { 'x-sigma': '1' } });
  assert.equal(r.status, 400);
  assert.ok(!existsSync(join(outside, 'x.json')));
  rmSync(outside, { recursive: true, force: true });
});

test('the committed version comes from git; proposals are listed', async () => {
  const r = await call('GET', '/api/project/base?path=.sigma/tokens/core.sigma.json');
  assert.equal(r.status, 200);
  assert.equal(r.json.name, 'Core tokens');
  assert.equal((await call('GET', '/api/project/base?path=.sigma/tokens/core.sigma.json&rev=--output=x')).status, 400);
  assert.equal((await call('GET', '/api/project/base?path=.sigma/design/new.sigma.json')).status, 404, 'not committed');
  assert.deepEqual((await call('GET', '/api/project/changesets')).json, [{ id: 'a', title: 'A' }]);
});

test('serves the editor, without caching, and nothing outside it', async () => {
  const r = await call('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.match((await call('GET', '/src/store.js')).headers['content-type'], /javascript/);
  assert.equal((await call('GET', '/%2e%2e/%2e%2e/etc/passwd')).status, 404, 'encoded ../');
  assert.equal((await call('GET', '/..%2f..%2fetc%2fpasswd')).status, 404, 'encoded slashes');
});

test('standalone (no project): the project API says so', async () => {
  const { server: s, url } = await startServer({ port: 0, strictPort: true, project: null });
  const res = await fetch(`${url}/api/project`);
  assert.equal(res.status, 404);
  s.close();
});

test('actions: only named ones, only with Sigma’s header', async () => {
  const { server: s, url } = await startServer({ port: 0, strictPort: true, project: dir, actions: { hello: async () => ({ ok: true, said: 'hi' }) } });
  try {
    assert.equal((await fetch(`${url}/api/project/action?name=hello`, { method: 'POST' })).status, 403, 'no header');
    assert.equal((await fetch(`${url}/api/project/action?name=rm`, { method: 'POST', headers: { 'X-Sigma': '1' } })).status, 404, 'not an action');
    assert.deepEqual(await (await fetch(`${url}/api/project/action?name=hello`, { method: 'POST', headers: { 'X-Sigma': '1' } })).json(), { ok: true, said: 'hi' });
  } finally {
    s.close();
  }
});
