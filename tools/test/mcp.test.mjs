// Sigma's MCP server (tools/mcp.mjs): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Talk to `npx sigma-design mcp examples/css-app` over stdio, as an MCP client does.
function session() {
  const child = spawn(process.execPath, [join(ROOT, 'bin/sigma-design.mjs'), 'mcp', join(ROOT, 'examples/css-app')], { stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map();
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiting.get(msg.id)?.(msg);
    }
  });
  let n = 0;
  const send = (method, params) => new Promise((ok) => {
    const id = ++n;
    waiting.set(id, ok);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  const notify = (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  return { send, notify, close: () => child.kill() };
}

test('mcp: initialize, list the tools, call them; only JSON-RPC on stdout', async () => {
  const s = session();
  try {
    const init = await s.send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.serverInfo.name, 'sigma-design');
    assert.deepEqual(init.result.capabilities, { tools: {} });
    s.notify('notifications/initialized');
    const { tools } = (await s.send('tools/list')).result;
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    for (const name of ['sigma_check', 'sigma_tokens_import', 'sigma_tokens_write', 'sigma_changeset_pr_body', 'sigma_comment_add']) assert.ok(byName[name], name);
    assert.equal(byName.sigma_check.annotations.readOnlyHint, true);
    assert.equal(byName.sigma_tokens_write.annotations.readOnlyHint, false);
    assert.deepEqual(byName.sigma_changeset_show.inputSchema.required, ['id']);

    const check = (await s.send('tools/call', { name: 'sigma_check', arguments: {} })).result;
    assert.equal(check.isError, false);
    assert.equal(JSON.parse(check.content[0].text).errors, 0);
    const dry = (await s.send('tools/call', { name: 'sigma_tokens_import', arguments: { dry_run: true } })).result;
    assert.match(dry.content[0].text, /0 added, 0 changed/);
    const missing = (await s.send('tools/call', { name: 'sigma_changeset_show', arguments: {} })).result;
    assert.deepEqual([missing.isError, missing.content[0].text], [true, 'sigma_changeset_show needs id.']);
    const log = (await s.send('tools/call', { name: 'sigma_changelog', arguments: {} })).result;
    assert.match(log.content[0].text, /^# What's new in Acme library/);
    assert.equal((await s.send('nope')).error.code, -32601);
  } finally {
    s.close();
  }
});
