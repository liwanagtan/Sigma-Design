// Dedicated local terminal transport. No capability, input, or output is written to disk/logs.
import { randomBytes, createHash } from 'node:crypto';
import { realpathSync, accessSync, constants } from 'node:fs';
import { basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { WebSocketServer } from 'ws';

export const TERMINAL_LIMITS = Object.freeze({ sessions: 4, clients: 12, output: 256 * 1024, message: 16 * 1024, backlog: 512 * 1024, retention: 15 * 60 * 1000 });
export function terminalService(server, { project = null, shell = process.env.SHELL || '/bin/sh', terminalLimits = {} } = {}) {
  const limits = { ...TERMINAL_LIMITS, ...terminalLimits };
  const root = project ? realpathSync(project) : null;
  const workspace = root ? { id: 'repository-' + createHash('sha256').update(root).digest('hex').slice(0, 24), name: basename(root), path: root } : null;
  const supported = ['darwin', 'linux'].includes(process.platform);
  const capability = randomBytes(32).toString('hex'), instance = randomBytes(16).toString('hex');
  const sessions = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: limits.message, perMessageDeflate: false });
  let disposed = false, ptyModule;
  const valid = req => {
    const host = req.headers.host || '', port = server.address()?.port;
    return (host === `localhost:${port}` || host === `127.0.0.1:${port}`) &&
      (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin') &&
      (req.headers.origin === `http://${host}` || (req.method === 'GET' && !req.headers.upgrade && !req.headers.origin && req.headers['sec-fetch-site'] === 'same-origin'));
  };
  const send = (ws, value, bytes = 0) => {
    if (ws.readyState !== 1) return;
    if (ws.bufferedAmount + ws.inFlight + bytes > limits.backlog) { ws.close(1013, 'Slow consumer; reconnect for recent output'); return; }
    ws.inFlight += bytes;
    ws.send(JSON.stringify(value));
  };
  const describe = s => ({ id: s.id, shell: basename(shell), workspaceId: workspace.id, exited: s.exited, exitCode: s.exitCode, foreground: s.foreground || basename(shell) });
  const broadcast = (s, value, bytes = 0) => { for (const ws of s.clients) send(ws, value, bytes); };
  function killTree(s) {
    if (s.exited) return;
    // Interactive job control gives jobs their own process groups. Killing only the shell's group
    // leaves these running. Snapshot its descendants, kill leaves first, then reap the PTY shell.
    try {
      const rows = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8', timeout: 2000, maxBuffer: 4 * 1024 * 1024 }).trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
      const children = pid => rows.filter(([, parent]) => parent === pid).map(([child]) => child);
      const descendants = [], visit = pid => { for (const child of children(pid)) { visit(child); descendants.push(child); } };
      visit(s.pty.pid);
      for (const pid of descendants) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    } catch {}
    // HUP lets an interactive shell propagate termination to job-control groups, including
    // on hosts where process enumeration is restricted. Escalate if it does not exit.
    try { s.pty.kill('SIGHUP'); } catch {}
    const escalation = setTimeout(() => {
      if (!s.exited) { try { process.kill(-s.pty.pid, 'SIGKILL'); } catch {} try { s.pty.kill('SIGKILL'); } catch {} }
    }, 300);
    escalation.unref();
  }
  const terminate = s => {
    killTree(s);
    sessions.delete(s.id);
    for (const ws of s.clients) ws.close(1000, 'Session ended');
  };
  const reply = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  async function handle(req, res) {
    if (!valid(req) || req.headers['x-sigma'] !== '1') return reply(res, 403, { error: 'Terminal requires a same-origin local connection.' });
    if (req.url === '/api/terminal/connect' && req.method === 'POST') return reply(res, 200, { capability, instance, workspace, supported, limits });
    if (req.headers.authorization !== `Bearer ${capability}`) return reply(res, 403, { error: 'Invalid terminal capability.' });
    if (!workspace) return reply(res, 409, { error: 'Start Sigma with sigma-design dev /path/to/workspace to connect a local workspace.' });
    if (req.method === 'GET' && req.url === '/api/terminal/sessions') return reply(res, 200, { sessions: [...sessions.values()].filter(s => s.pty).map(describe) });
    const chunks = []; let size = 0, data;
    try {
      for await (const chunk of req) { size += chunk.length; if (size > limits.message) return reply(res, 413, { error: 'Request too large.' }); chunks.push(chunk); }
      data = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    } catch { return reply(res, 400, { error: 'Invalid terminal request.' }); }
    if (data.workspaceId !== workspace.id) return reply(res, 409, { error: 'Workspace identity changed. Reconnect explicitly.' });
    if (req.method === 'POST' && req.url === '/api/terminal/sessions') {
      if (!supported) return reply(res, 501, { error: 'Terminal currently supports macOS and Linux. Windows PTY validation is pending.' });
      // Reserve a slot before async module loading, so simultaneous requests cannot exceed the limit.
      if (sessions.size >= limits.sessions) return reply(res, 409, { error: 'Session limit reached. End an existing terminal first.' });
      const id = randomBytes(16).toString('hex'), s = { id, clients: new Set(), output: Buffer.alloc(0), exited: false, detachedAt: Date.now() };
      sessions.set(id, s);
      try {
        const { default: pty } = await (ptyModule ||= import('node-pty'));
        if (disposed) throw Error('Server stopped');
        accessSync(shell, constants.X_OK);
        const name = basename(shell);
        if (!['zsh', 'bash', 'sh', 'dash'].includes(name)) throw Error('Use zsh, bash, sh, or dash via SHELL');
        // Skip interactive startup scripts which can override HISTFILE and persist command history.
        const env = { ...process.env, TERM: 'xterm-256color', HISTFILE: '/dev/null', ENV: '/dev/null', ZDOTDIR: '/dev/null' };
        const args = name === 'zsh' ? ['-f', '-i'] : name === 'bash' ? ['--noprofile', '--norc', '-i'] : ['-i'];
        s.pty = pty.spawn(shell, args, { name: 'xterm-256color', cols: 80, rows: 24, cwd: root, env });
        s.pty.onData(text => {
          const bytes = Buffer.from(text);
          s.output = Buffer.concat([s.output, bytes]).subarray(-limits.output);
          broadcast(s, { type: 'output', data: text, bytes: bytes.length }, bytes.length);
        });
        s.pty.onExit(({ exitCode, signal }) => { s.exited = true; s.exitCode = exitCode; broadcast(s, { type: 'exit', exitCode, signal }); });
        return reply(res, 201, describe(s));
      } catch (error) { sessions.delete(id); return reply(res, 503, { error: `Could not start ${shell}: ${error.message}. Check your shell and node-pty installation (npm rebuild node-pty).` }); }
    }
    if (req.method === 'POST' && req.url === '/api/terminal/end') {
      const s = sessions.get(data.id);
      if (!s?.pty) return reply(res, 404, { error: 'Session ended or server restarted.' });
      terminate(s); return reply(res, 200, { ended: true });
    }
    return reply(res, 404, { error: 'Unknown terminal endpoint.' });
  }
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/api/terminal/socket' || !valid(req) || wss.clients.size >= limits.clients) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      let attached = null; ws.inFlight = 0;
      const deadline = setTimeout(() => ws.close(1008, 'Authentication required'), 3000);
      ws.on('error', () => {});
      ws.on('message', raw => {
        let m;
        try { m = JSON.parse(raw.toString()); if (!m || typeof m !== 'object') throw Error(); } catch { ws.close(1008, 'Invalid message'); return; }
        if (!attached) {
          const s = sessions.get(m.id);
          if (m.type !== 'attach' || m.capability !== capability || m.instance !== instance || m.workspaceId !== workspace?.id || !s?.pty) { ws.close(1008, 'Invalid session capability'); return; }
          clearTimeout(deadline); attached = s; s.clients.add(ws);
          send(ws, { type: 'attached', ...describe(s), output: s.output.toString(), bytes: s.output.length }, s.output.length);
          return;
        }
        if (m.type === 'ack' && Number.isInteger(m.bytes) && m.bytes > 0 && m.bytes <= ws.inFlight) { ws.inFlight -= m.bytes; return; }
        try {
          if (m.type === 'input' && typeof m.data === 'string' && !attached.exited) attached.pty.write(m.data);
          else if (m.type === 'resize' && Number.isInteger(m.cols) && Number.isInteger(m.rows) && m.cols >= 2 && m.cols <= 500 && m.rows >= 1 && m.rows <= 200 && !attached.exited) attached.pty.resize(m.cols, m.rows);
        } catch { ws.close(1011, 'Shell unavailable'); }
      });
      ws.on('close', () => { clearTimeout(deadline); if (attached) { attached.clients.delete(ws); attached.detachedAt = Date.now(); } });
    });
  });
  const timer = setInterval(() => {
    for (const s of sessions.values()) {
      if (!s.pty) continue;
      if (!s.clients.size && Date.now() - s.detachedAt > limits.retention) { terminate(s); continue; }
      if (!s.exited && s.clients.size) {
        try {
          const foreground = basename(s.pty.process || shell).slice(0, 100);
          if (foreground !== s.foreground) { s.foreground = foreground; broadcast(s, { type: 'status', foreground }); }
        } catch {}
      }
    }
  }, Math.min(1000, limits.retention));
  timer.unref();
  function dispose() {
    if (disposed) return; disposed = true; clearInterval(timer);
    for (const s of sessions.values()) if (s.pty) terminate(s);
    for (const ws of wss.clients) ws.terminate();
    wss.close(); process.removeListener('exit', dispose);
  }
  server.on('close', dispose);
  process.on('exit', dispose);
  return { handle, dispose };
}
