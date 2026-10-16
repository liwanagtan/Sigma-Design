#!/usr/bin/env node
// Check Sigma project files: node tools/validate.js [project folder | file.sigma.json …] [--json]
//
// With a folder, checks every .sigma/**/*.sigma.json in it (links between files included) and
// sigma.config.json. Prints one line per problem, errors first, and exits with 1 when there are errors.
// No dependencies: Node 22 or later. The same checks run in the browser (src/validate.js).
import { readFileSync, statSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { validateProject, formatIssues } from '../src/validate.js';
import { validateConfig } from '../src/project-config.js';
import { readProject, toPosix } from './lib/project.mjs';

// { errors, issues, files }: the checks for one or more targets (project folders or files).
export function check(targets) {
  const files = {};
  const issues = [];
  for (const target of targets) {
    const abs = resolve(target);
    if (!existsSync(abs)) {
      issues.push({ file: target, at: '', level: 'error', message: 'doesn’t exist' });
      continue;
    }
    if (statSync(abs).isDirectory()) {
      // A project: paths are relative to its root, as files write them in "uses".
      const { files: found, config, configError } = readProject(abs);
      Object.assign(files, found);
      if (configError) issues.push({ file: 'sigma.config.json', at: '', level: 'error', message: `isn’t valid JSON: ${configError}` });
      else if (config) issues.push(...validateConfig(config, { files: Object.keys(found) }).map((i) => ({ ...i, file: 'sigma.config.json' })));
      if (!Object.keys(found).length) issues.push({ file: target, at: '', level: 'warning', message: 'has no .sigma/**/*.sigma.json files' });
    } else {
      files[toPosix(relative(process.cwd(), abs))] = readFileSync(abs, 'utf8');
    }
  }
  issues.push(...validateProject(files));
  return { files, issues, errors: issues.filter((i) => i.level === 'error').length };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate.js')) {
  const args = process.argv.slice(2);
  const asJSON = args.includes('--json');
  const targets = args.filter((a) => !a.startsWith('--'));
  const { files, issues, errors } = check(targets.length ? targets : ['.']);
  const n = Object.keys(files).length;
  if (asJSON) console.log(JSON.stringify({ files: n, errors, warnings: issues.length - errors, issues }, null, 2));
  else {
    if (issues.length) console.log(formatIssues(issues));
    console.log(`${n} file${n === 1 ? '' : 's'} checked: ${errors} error${errors === 1 ? '' : 's'}, ${issues.length - errors} warning${issues.length - errors === 1 ? '' : 's'}`);
  }
  process.exit(errors ? 1 : 0);
}
