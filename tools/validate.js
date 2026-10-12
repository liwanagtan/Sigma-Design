#!/usr/bin/env node
// Check Sigma project files: node tools/validate.js [project folder | file.sigma.json …] [--json]
//
// With a folder, checks every .sigma/**/*.sigma.json in it (links between files included) and
// sigma.config.json. Prints one line per problem, errors first, and exits with 1 when there are errors.
// No dependencies: Node 18 or later. The same checks run in the browser (src/validate.js).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { validateProject, formatIssues } from '../src/validate.js';
import { validateConfig } from '../src/project-config.js';

const args = process.argv.slice(2);
const asJSON = args.includes('--json');
const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) targets.push('.');

const files = {};
const issues = [];
const toPosix = (p) => p.split(sep).join('/');
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.sigma.json')) out.push(p);
  }
  return out;
};

for (const target of targets) {
  const abs = resolve(target);
  if (!existsSync(abs)) {
    issues.push({ file: target, at: '', level: 'error', message: 'doesn’t exist' });
    continue;
  }
  if (statSync(abs).isDirectory()) {
    // A project: paths are relative to its root, as files write them in "uses".
    const sigmaDir = join(abs, '.sigma');
    const found = existsSync(sigmaDir) ? walk(sigmaDir) : walk(abs);
    for (const f of found) files[toPosix(relative(abs, f))] = readFileSync(f, 'utf8');
    const config = join(abs, 'sigma.config.json');
    if (existsSync(config)) {
      try {
        issues.push(...validateConfig(JSON.parse(readFileSync(config, 'utf8')), { files: Object.keys(files) })
          .map((i) => ({ ...i, file: 'sigma.config.json' })));
      } catch (e) {
        issues.push({ file: 'sigma.config.json', at: '', level: 'error', message: `isn’t valid JSON: ${e.message}` });
      }
    }
    if (!found.length) issues.push({ file: target, at: '', level: 'warning', message: 'has no .sigma.json files' });
  } else {
    files[toPosix(relative(process.cwd(), abs))] = readFileSync(abs, 'utf8');
  }
}

issues.push(...validateProject(files));
const errors = issues.filter((i) => i.level === 'error').length;
if (asJSON) console.log(JSON.stringify({ files: Object.keys(files).length, errors, warnings: issues.length - errors, issues }, null, 2));
else {
  if (issues.length) console.log(formatIssues(issues));
  console.log(`${Object.keys(files).length} file${Object.keys(files).length === 1 ? '' : 's'} checked: ${errors} error${errors === 1 ? '' : 's'}, ${issues.length - errors} warning${issues.length - errors === 1 ? '' : 's'}`);
}
process.exit(errors ? 1 : 0);
