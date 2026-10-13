// Sigma's local server (Part F, Phase 32): serves the editor and, when Sigma runs in a project, the project
// API the editor uses to read and write its Sigma files. No dependencies (Node 18+). It replaces serve.py.
//
//   GET  /api/project                    the project: { name, files: [{ path, kind, name, mtime, size }], config }
//   GET  /api/project/file?path=P        a file's text (header X-Sigma-Mtime: its modification time)
//   PUT  /api/project/file?path=P&base=M write a file; M is the mtime it was read at ("new" for a new file).
//                                        409 if it changed on disk since (someone else wrote it)
//   GET  /api/project/base?path=P&rev=R  a file as committed in git (R defaults to HEAD), to compare with
//   GET  /api/project/changesets         the proposed changes in .sigma/changesets/
//
// Only .sigma/**/*.json, .sigma/**/*.svg and sigma.config.json can be read or written. The server listens on
// 127.0.0.1 only, answers only requests addressed to localhost, and writes only for requests that carry the
// X-Sigma header (which pages on other sites can't send), so other websites can't read or change a project.
// Every write is logged.
import { createServer as httpServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import { join, resolve, relative, dirname, extname, basename, sep, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const EDITOR_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 64 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

const toPosix = (p) => p.split(sep).join('/');
const mtimeOf = (full) => statSync(full, { bigint: true }).mtimeNs.toString();

/**
 * A request handler for Sigma: the editor's files from `root`, and the API for `project` (an absolute path,
 * or null when Sigma runs standalone). `log(line)` gets one line per write.
 */
export function sigmaHandler({ root = EDITOR_ROOT, project = null, log = () => {} } = {}) {
  project = project ? resolve(project) : null;
  const projectReal = project ? realpathSync(project) : null;
  const heads = new Map(); // path → [mtime, kind, name]: what a file is, cached by mtime

  // Every Sigma file in the project, with its kind and name.
  function projectFiles() {
    const out = [];
    const walk = (dir) => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
          if (!e.name.startsWith('.')) walk(full);
          continue;
        }
        if (!e.name.endsWith('.sigma.json')) continue;
        const rel = toPosix(relative(project, full));
        const st = statSync(full, { bigint: true });
        const mtime = st.mtimeNs.toString();
        let head = heads.get(rel);
        if (!head || head[0] !== mtime) {
          head = [mtime, 'design', e.name.slice(0, -'.sigma.json'.length)];
          try {
            const data = JSON.parse(readFileSync(full, 'utf8'));
            head = [mtime, data.kind || 'design', data.name || head[2]];
          } catch {
            head[1] = 'invalid';
          }
          heads.set(rel, head);
        }
        out.push({ path: rel, kind: head[1], name: head[2], mtime, size: Number(st.size) });
      }
    };
    walk(join(project, '.sigma'));
    return out;
  }

  // The absolute path for a project-relative path, or null if it's outside what Sigma may touch.
  function safePath(rel) {
    if (!rel || rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) return null;
    const full = resolve(project, rel);
    const lex = relative(project, full);
    if (!lex || lex.startsWith('..') || isAbsolute(lex)) return null;
    const norm = toPosix(lex);
    if (norm !== 'sigma.config.json' && !(norm.startsWith('.sigma/') && (norm.endsWith('.json') || norm.endsWith('.svg')))) return null;
    // A link can't lead outside the project: the file (or its nearest folder that exists) must be inside it.
    let near = full;
    while (!existsSync(near)) near = dirname(near);
    const real = realpathSync(near);
    if (real !== projectReal && !real.startsWith(projectReal + sep)) return null;
    return full;
  }

  const reply = (res, status, body = '', type = 'application/json', headers = {}) => {
    const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': data.length, 'Cache-Control': 'no-store', ...headers });
    res.end(data);
  };
  const isLocal = (req) => {
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  };
  const body = (req) => new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });

  async function api(req, res, url) {
    const q = url.searchParams;
    if (!isLocal(req)) return reply(res, 403, { error: 'Sigma only answers requests to localhost' });
    if (!project) return reply(res, 404, { error: 'No project: Sigma runs standalone. Run it in a project with npx sigma-design dev' });
    const method = req.method;
    if (url.pathname === '/api/project' && method === 'GET') {
      let config = null;
      const cfg = join(project, 'sigma.config.json');
      if (existsSync(cfg)) {
        try {
          config = JSON.parse(readFileSync(cfg, 'utf8'));
        } catch {
          config = { invalid: true };
        }
      }
      return reply(res, 200, { name: basename(projectReal), files: projectFiles(), config });
    }
    if (url.pathname === '/api/project/base' && method === 'GET') {
      // A file as committed in git (HEAD, or ?rev=): what changes are compared with.
      const rel = q.get('path') || '';
      const rev = q.get('rev') || 'HEAD';
      if (!safePath(rel) || rev.startsWith('-')) return reply(res, 400, { error: `Sigma doesn't read ${JSON.stringify(rel)}` });
      let top;
      try {
        top = execFileSync('git', ['-C', project, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        return reply(res, 501, { error: 'The project isn’t a git repository' });
      }
      const inside = toPosix(relative(realpathSync(top), join(projectReal, rel)));
      try {
        const shown = execFileSync('git', ['-C', project, 'show', `${rev}:${inside}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: MAX_BODY });
        return reply(res, 200, shown, 'application/json; charset=utf-8');
      } catch {
        return reply(res, 404, { error: `${rel} isn’t in ${rev}` });
      }
    }
    if (url.pathname === '/api/project/changesets' && method === 'GET') {
      const folder = join(project, '.sigma', 'changesets');
      const out = [];
      if (existsSync(folder)) {
        for (const f of readdirSync(folder).sort()) {
          if (!f.endsWith('.json')) continue;
          try {
            out.push(JSON.parse(readFileSync(join(folder, f), 'utf8')));
          } catch {}
        }
      }
      return reply(res, 200, out);
    }
    if (url.pathname !== '/api/project/file') return reply(res, 404, { error: 'Unknown API' });
    const rel = q.get('path') || '';
    const full = safePath(rel);
    if (!full) return reply(res, 400, { error: `Sigma doesn't read or write ${JSON.stringify(rel)} (only .sigma/ files and sigma.config.json)` });
    if (method === 'GET') {
      if (!existsSync(full)) return reply(res, 404, { error: `${rel} doesn't exist` });
      return reply(res, 200, readFileSync(full), 'application/json; charset=utf-8', { 'X-Sigma-Mtime': mtimeOf(full) });
    }
    if (method === 'PUT') {
      if (req.headers['x-sigma'] !== '1') return reply(res, 403, { error: 'Writes need the X-Sigma header' });
      const base = q.get('base') || '';
      const exists = existsSync(full);
      const current = exists ? mtimeOf(full) : null;
      if (base === 'new' && exists) return reply(res, 409, { error: `${rel} already exists`, mtime: current });
      if (base && base !== 'new' && base !== current) return reply(res, 409, { error: `${rel} changed on disk since it was read`, mtime: current });
      let data;
      try {
        data = await body(req);
      } catch {
        return reply(res, 413, { error: 'Too large' });
      }
      mkdirSync(dirname(full), { recursive: true });
      // All or nothing: an agent never reads half a file.
      const tmp = join(dirname(full), `.sigma-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
      writeFileSync(tmp, data);
      renameSync(tmp, full);
      const mtime = mtimeOf(full);
      log(`wrote ${rel} (${data.length} bytes)`);
      return reply(res, 200, { path: rel, mtime });
    }
    return reply(res, 405, { error: 'Method not allowed' });
  }

  // The editor's own files (no caching, so a new version shows on reload).
  function file(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Method not allowed' });
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return reply(res, 400, 'Bad path', 'text/plain');
    }
    let full = resolve(root, `.${path}`);
    if (full !== root && !full.startsWith(root + sep)) return reply(res, 404, 'Not found', 'text/plain');
    if (existsSync(full) && statSync(full).isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      full = join(full, 'index.html');
    }
    if (!existsSync(full) || !statSync(full).isFile()) return reply(res, 404, 'Not found', 'text/plain');
    const data = readFileSync(full);
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': TYPES[extname(full).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
      return res.end();
    }
    return reply(res, 200, data, TYPES[extname(full).toLowerCase()] || 'application/octet-stream');
  }

  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      return file(req, res, url);
    } catch (err) {
      if (!res.headersSent) reply(res, 500, { error: String(err.message || err) });
    }
  };
}

/**
 * Start Sigma's server on 127.0.0.1. `port` is tried first, then the next ones (up to `tries`), unless
 * `strictPort`. Resolves to { server, port, url }.
 */
export function startServer({ port = 6200, strictPort = false, tries = 20, ...options } = {}) {
  const handler = sigmaHandler(options);
  return new Promise((ok, fail) => {
    const attempt = (p, left) => {
      const server = httpServer(handler);
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && !strictPort && left > 0) attempt(p + 1, left - 1);
        else fail(err.code === 'EADDRINUSE' ? new Error(`port ${p} is in use (try --port)`) : err);
      });
      server.listen(p, '127.0.0.1', () => {
        const actual = server.address().port; // port 0: any free port
        ok({ server, port: actual, url: `http://localhost:${actual}` });
      });
    };
    attempt(port, tries);
  });
}
