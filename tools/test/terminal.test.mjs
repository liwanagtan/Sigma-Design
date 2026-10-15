import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server.mjs';
import { WebSocket } from 'ws';
import { request as httpRequest } from 'node:http';

async function fixture(t, options = {}) {
  const { server, url } = await startServer({ port: 0, project: process.cwd(), shell: '/bin/bash', ...options });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const headers = { Origin: url, 'X-Sigma': '1', 'Content-Type': 'application/json' };
  const request = (path, method = 'POST', body, extra = {}) => fetch(url + '/api/terminal/' + path, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const connection = await (await request('connect')).json();
  headers.Authorization = `Bearer ${connection.capability}`;
  const create = async () => { const r = await request('sessions', 'POST', { workspaceId: connection.workspace.id }); assert.equal(r.status, 201); return r.json(); };
  const attach = async (id, override = {}) => {
    const ws = new WebSocket(url.replace('http:', 'ws:') + '/api/terminal/socket', { origin: url });
    t.after(() => ws.terminate());
    const messages = [];
    ws.on('message', data => { const m = JSON.parse(data); messages.push(m); if (m.bytes && !override.noAck) ws.send(JSON.stringify({ type: 'ack', bytes: m.bytes })); });
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    ws.send(JSON.stringify({ type: 'attach', id, ...connection, workspaceId: connection.workspace.id, ...override }));
    return { ws, messages };
  };
  return { request, connection, create, attach, server, url };
}
async function until(fn) {
  const start = Date.now();
  while (!fn()) { if (Date.now() - start > 5000) throw Error('Timed out'); await new Promise(r => setTimeout(r, 20)); }
}
test('terminal requires local origin, capability, and workspace identity', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('connect', 'POST', undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('sessions', 'GET', undefined, { Authorization: '' })).status, 403);
  assert.equal((await f.request('sessions', 'POST', { workspaceId: 'another-project' })).status, 409);
  const s = await f.create();
  const { ws } = await f.attach(s.id, { capability: 'incorrect' });
  const code = await new Promise(r => ws.once('close', r));
  assert.equal(code, 1008);
  await f.request('end', 'POST', { id: s.id, workspaceId: f.connection.workspace.id });
});
test('real PTY input, resize, reconnect transcript, and explicit termination', async t => {
  const f = await fixture(t);
  const s = await f.create();
  const a = await f.attach(s.id);
  await until(() => a.messages.some(x => x.type === 'attached'));
  a.ws.send(JSON.stringify({ type: 'resize', cols: 97, rows: 31 }));
  a.ws.send(JSON.stringify({ type: 'input', data: "printf '\\nSIGMA_%s\\n' READY; stty size\r" }));
  await until(() => a.messages.some(x => x.data?.includes('SIGMA_READY')));
  await until(() => a.messages.some(x => x.data?.includes('31 97')));
  a.ws.close();
  const b = await f.attach(s.id);
  await until(() => b.messages.some(x => x.type === 'attached'));
  assert.match(b.messages[0].output, /SIGMA_READY/);
  assert.equal((await f.request('end', 'POST', { id: s.id, workspaceId: f.connection.workspace.id })).status, 200);
  assert.deepEqual((await (await f.request('sessions', 'GET')).json()).sessions, []);
});

test('terminal rejects spoofed Host, missing Origin and cross-origin socket handshakes', async t => {
  const f = await fixture(t);
  const hostStatus = await new Promise(resolve => {
    const req = httpRequest(f.url + '/api/terminal/connect', { method: 'POST', headers: { Host: 'evil.example', Origin: f.url, 'X-Sigma': '1' } }, res => { resolve(res.statusCode); res.resume(); }); req.end();
  });
  assert.equal(hostStatus, 403);
  assert.equal((await f.request('connect', 'POST', undefined, { Origin: '' })).status, 403);
  assert.equal((await f.request('connect', 'POST', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const ws = new WebSocket(f.url.replace('http:', 'ws:') + '/api/terminal/socket', { origin: 'https://evil.example' });
  ws.on('error', () => {}); t.after(() => ws.terminate());
  const status = await new Promise(resolve => ws.once('unexpected-response', (_, res) => { resolve(res.statusCode); res.resume(); ws.terminate(); }));
  assert.equal(status, 403);
});
test('malformed socket messages do not crash server; wrong workspace cannot attach', async t => {
  const f = await fixture(t), s = await f.create();
  const wrong = await f.attach(s.id, { workspaceId: 'wrong-project' });
  assert.equal(await new Promise(r => wrong.ws.once('close', r)), 1008);
  const good = await f.attach(s.id);
  await until(() => good.messages.some(x => x.type === 'attached'));
  good.ws.send('null');
  assert.equal(await new Promise(r => good.ws.once('close', r)), 1008);
  assert.equal((await f.request('sessions', 'GET')).status, 200);
});
test('Ctrl+C interrupts the foreground command and shell remains usable; exit reports code', async t => {
  const f = await fixture(t), s = await f.create(), a = await f.attach(s.id);
  await until(() => a.messages.some(x => x.type === 'attached'));
  a.ws.send(JSON.stringify({ type: 'input', data: "printf 'RUN_%s\\n' START; sleep 60\r" }));
  await until(() => a.messages.some(x => x.data?.includes('RUN_START')));
  a.ws.send(JSON.stringify({ type: 'input', data: '\x03' }));
  a.ws.send(JSON.stringify({ type: 'input', data: "printf 'AFTER_%s\\n' INTERRUPT\r" }));
  await until(() => a.messages.some(x => x.data?.includes('AFTER_INTERRUPT')));
  a.ws.send(JSON.stringify({ type: 'input', data: 'exit 7\r' }));
  await until(() => a.messages.some(x => x.type === 'exit'));
  assert.equal(a.messages.find(x => x.type === 'exit').exitCode, 7);
});
test('concurrent session requests respect limit and missing shells provide useful errors', async t => {
  const f = await fixture(t, { terminalLimits: { sessions: 2 } });
  const results = await Promise.all(Array.from({ length: 5 }, () => f.request('sessions', 'POST', { workspaceId: f.connection.workspace.id })));
  assert.equal(results.filter(r => r.status === 201).length, 2);
  assert.equal(results.filter(r => r.status === 409).length, 3);
  const broken = await fixture(t, { shell: '/missing/bash' });
  const r = await broken.request('sessions', 'POST', { workspaceId: broken.connection.workspace.id });
  assert.equal(r.status, 503); assert.match((await r.json()).error, /Could not start/);
});
test('reconnect output is bounded; slow consumers are disconnected', async t => {
  const f = await fixture(t, { terminalLimits: { output: 1024, backlog: 32768 } }), s = await f.create();
  const a = await f.attach(s.id);
  await until(() => a.messages.some(x => x.type === 'attached'));
  a.ws.send(JSON.stringify({ type: 'input', data: "printf '%5000s' x; printf 'OUTPUT_%s\\n' DONE\r" }));
  await until(() => a.messages.some(x => x.data?.includes('OUTPUT_DONE')));
  a.ws.close();
  const b = await f.attach(s.id, { noAck: true });
  await until(() => b.messages.some(x => x.type === 'attached'));
  assert.ok(Buffer.byteLength(b.messages[0].output) <= 1024);
  const closed = new Promise(r => b.ws.once('close', r));
  b.ws.send(JSON.stringify({ type: 'input', data: "printf '%80000s' x\r" }));
  assert.equal(await closed, 1013);
});
test('detached sessions expire and standalone never creates a shell', async t => {
  const f = await fixture(t, { terminalLimits: { retention: 80 } });
  await f.create();
  await new Promise(r => setTimeout(r, 200));
  assert.deepEqual((await (await f.request('sessions', 'GET')).json()).sessions, []);
  const standalone = await fixture(t, { project: null });
  assert.equal(standalone.connection.workspace, null);
  assert.equal((await standalone.request('sessions', 'POST', { workspaceId: 'invented' })).status, 409);
});
test('ending a terminal and closing server kill shell and child jobs', async t => {
  const { execFileSync } = await import('node:child_process');
  const alive = pid => {
    try { process.kill(Number(pid), 0); } catch { return false; }
    try { const stat = execFileSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' }).trim(); return stat && !stat.startsWith('Z'); } catch { return true; }
  };
  for (const stop of ['end', 'close']) {
    const f = await fixture(t), s = await f.create(), a = await f.attach(s.id);
    await until(() => a.messages.some(x => x.type === 'attached'));
    a.ws.send(JSON.stringify({ type: 'input', data: "sleep 60 & printf 'PID:%s JOB:%s\\n' $$ $!\r" }));
    let match;
    await until(() => match = a.messages.map(x => x.data || '').join('').match(/PID:(\d+) JOB:(\d+)/));
    const [, shellPid, jobPid] = match;
    assert.ok(alive(shellPid)); assert.ok(alive(jobPid));
    if (stop === 'end') await f.request('end', 'POST', { id: s.id, workspaceId: f.connection.workspace.id });
    else f.server.close();
    await until(() => !alive(shellPid) && !alive(jobPid));
  }
});
test('foreground command status is visible while a job is running', async t => {
  const f = await fixture(t), s = await f.create(), a = await f.attach(s.id);
  await until(() => a.messages.some(x => x.type === 'attached'));
  a.ws.send(JSON.stringify({ type:'input', data:'sleep 60\r' }));
  await until(() => a.messages.some(x => x.type === 'status' && x.foreground === 'sleep'));
  a.ws.send(JSON.stringify({ type:'input', data:'\x03' }));
  await until(() => a.messages.some(x => x.type === 'status' && x.foreground === 'bash'));
});
test('shell-written files remain subject to the editor stale-save conflict check', async t => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const project = mkdtempSync(join(tmpdir(), 'sigma-terminal-sync-'));
  t.after(() => rmSync(project, { recursive:true, force:true }));
  mkdirSync(join(project, '.sigma'));
  writeFileSync(join(project, '.sigma/tokens.sigma.json'), '{"kind":"tokens","name":"Before"}');
  const f = await fixture(t, { project }), s = await f.create(), a = await f.attach(s.id);
  const path = '/api/project/file?path=.sigma/tokens.sigma.json';
  const before = await fetch(f.url + path), mtime = before.headers.get('X-Sigma-Mtime');
  await until(() => a.messages.some(x => x.type === 'attached'));
  a.ws.send(JSON.stringify({type:'input', data:`printf '%s' '{"kind":"tokens","name":"After shell command"}' > .sigma/tokens.sigma.json; printf 'SYNC_%s\\n' DONE\r`}));
  await until(() => a.messages.some(x => x.data?.includes('SYNC_DONE')));
  assert.equal((await (await fetch(f.url + path)).json()).name, 'After shell command');
  const saved = await fetch(f.url + path + '&base=' + mtime, { method:'PUT', headers:{'X-Sigma':'1'}, body:'{"name":"Unsaved editor change"}' });
  assert.equal(saved.status, 409, 'shell edits must never be silently overwritten by an older editor save');
});
