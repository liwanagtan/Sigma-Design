// Reading a project's Sigma files from disk (Node), shared by tools/validate.js and tools/sigma.mjs.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export const toPosix = (p) => p.split(sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') && name !== '.sigma') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.sigma.json')) out.push(p);
  }
  return out;
}

// { files: { 'project/relative/path': text }, config: object | null, configError }
export function readProject(root) {
  const files = {};
  const sigmaDir = join(root, '.sigma');
  const found = existsSync(sigmaDir) ? walk(sigmaDir) : [];
  for (const f of found) files[toPosix(relative(root, f))] = readFileSync(f, 'utf8');
  let config = null, configError = null;
  const cfg = join(root, 'sigma.config.json');
  if (existsSync(cfg)) {
    try {
      config = JSON.parse(readFileSync(cfg, 'utf8'));
    } catch (e) {
      configError = e.message;
    }
  }
  return { files, config, configError };
}

export const readText = (root, path) => readFileSync(join(root, path), 'utf8');
export const exists = (root, path) => existsSync(join(root, path));
export function writeText(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

// A file as it is in a git revision (null if it isn't there, or this isn't a git repo).
export function gitShow(root, rev, path) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const rel = toPosix(relative(top, join(root, path)));
    return execFileSync('git', ['show', `${rev}:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}
