// Reading a project's Sigma files from disk (Node), shared by tools/validate.js and tools/sigma.mjs.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from 'node:fs';
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
  // The design system packages it uses (config.packages): their .sigma/ files, read-only, under
  // node_modules/<package>/.sigma/ (a workspace link may lead outside the project; that's fine to read).
  const packages = packagesOf(root, config);
  for (const p of packages) for (const f of walk(join(p.dir, '.sigma'))) files[toPosix(relative(root, f))] = readFileSync(f, 'utf8');
  return { files, config, configError, packages };
}

/** The packages in config.packages that are installed and have Sigma files: [{ name, version, dir }]. */
export function packagesOf(root, config) {
  return (Array.isArray(config?.packages) ? config.packages : []).map((name) => {
    const dir = join(root, 'node_modules', ...String(name).split('/'));
    if (!existsSync(join(dir, '.sigma'))) return null;
    let version = null;
    try {
      version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version || null;
    } catch {}
    return { name, version, dir };
  }).filter(Boolean);
}

/** Whether a project path is a package's file (read-only). */
export const isPackagePath = (path) => String(path).startsWith('node_modules/');

export const readText = (root, path) => readFileSync(join(root, path), 'utf8');
export const exists = (root, path) => existsSync(join(root, path));
export function writeText(root, path, text) {
  if (isPackagePath(path)) throw new Error(`${path} comes from a design system package: change it in that package`);
  writeAtomic(join(root, path), text);
}

/** Write a file all at once (a temporary file, then a rename), so nothing (Sigma's polling, a watcher, an
 * agent) ever reads half of it. */
export function writeAtomic(full, text) {
  mkdirSync(dirname(full), { recursive: true });
  const tmp = join(dirname(full), `.sigma-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  writeFileSync(tmp, text);
  renameSync(tmp, full);
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

export const removeFile = (root, path) => unlinkSync(join(root, path));

// Files under a folder with an extension, as paths relative to that folder (skips node_modules and dot folders).
export function listFilesIn(dir, ext) {
  const out = [];
  if (!existsSync(dir)) return out;
  const visit = (d, prefix) => {
    for (const name of readdirSync(d).sort()) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) visit(p, `${prefix}${name}/`);
      else if (name.toLowerCase().endsWith(ext)) out.push(`${prefix}${name}`);
    }
  };
  visit(dir, '');
  return out;
}
