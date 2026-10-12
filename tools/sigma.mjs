#!/usr/bin/env node
// Sigma's command line, for the sync skill (skills/sigma-sync) and for people. Node 18+, no dependencies.
//
//   node tools/sigma.mjs validate [project]                 check the project's Sigma files
//   node tools/sigma.mjs check [project]                    validate, and check code and Sigma agree
//   node tools/sigma.mjs tokens import [project] [--from tokens.json] [--entry N] [--prune] [--dry-run]
//   node tools/sigma.mjs tokens diff [project] [--base REV] [--entry N] [--json]
//   node tools/sigma.mjs tokens write [project] [--base REV] [--entry N] [--dry-run]
//   node tools/sigma.mjs tokens export [project] --format dtcg|css [--entry N]
//   node tools/sigma.mjs icons import [project] [--from FOLDER] [--entry N] [--prune] [--dry-run]
//   node tools/sigma.mjs icons diff [project] [--base REV] [--entry N]
//   node tools/sigma.mjs icons write [project] [--base REV] [--entry N] [--dry-run]
//
// [project] is the folder with sigma.config.json (default: the current folder). Token commands work on
// the config's "tokens" entries (all of them, or --entry N). --json prints machine-readable output.
import { resolve, basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { readProject, readText, exists, writeText, gitShow, removeFile, listFilesIn } from './lib/project.mjs';
import { join } from 'node:path';
import { iconsFromFiles, mergeIcons, iconChanges, iconFilePath, iconSVG, sameIcon, svgStyleOf } from '../src/icon-sync.js';
import { parseSVGIcon } from '../src/icon-library.js';
import { check as validate } from './validate.js';
import { formatIssues } from '../src/validate.js';
import { withDefaults } from '../src/project-config.js';
import { formatProjectJSON } from '../src/project-format.js';
import { importTokens, exportDTCG, exportCSS } from '../src/tokens-io.js';
import {
  parseCSSVariables, cssToCollections, mergeTokenCollections, tokenChanges, applyToCSS, codeNameFor,
} from '../src/token-sync.js';

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) flags[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--') && ['from', 'entry', 'base', 'format'].includes(k)) flags[k] = argv[++i];
    else flags[k] = true;
  } else pos.push(a);
}
const json = !!flags.json;
const out = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));
const fail = (msg) => {
  console.error(`sigma: ${msg}`);
  process.exit(2);
};

function project(dir) {
  const root = resolve(dir || '.');
  const { config, configError } = readProject(root);
  if (configError) fail(`sigma.config.json isn’t valid JSON: ${configError}`);
  if (!config) fail(`no sigma.config.json in ${root}. The sync skill writes one on its first run (skills/sigma-sync/SKILL.md).`);
  return { root, config: withDefaults(config) };
}

const entriesOf = (config, key = 'tokens') => {
  const list = (config[key] || []).map((e, i) => ({ ...e, index: i }));
  if (flags.entry === undefined) return list;
  const e = list[Number(flags.entry)];
  if (!e) fail(`there is no ${key} entry ${flags.entry} in sigma.config.json`);
  return [e];
};
const cssOpts = (e) => ({ modes: e.modes || { Default: ':root' }, naming: e.naming || 'kebab', prefix: e.prefix || '', map: e.map || {}, remBase: e.remBase || 16 });
const cssSources = (e) => (e.sources || []).filter((s) => s.format === 'css-variables');
const readSigma = (root, path) => (exists(root, path) ? JSON.parse(readText(root, path)) : null);

// Token code names from tokens.json ($extensions["app.sigma"].codeSyntax), by token name.
function codeSyntaxIn(dtcg) {
  const found = {};
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if ('$value' in node) {
      const cs = node.$extensions?.['app.sigma']?.codeSyntax;
      if (cs) found[path.join('/')] = cs;
      return;
    }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) visit(v, [...path, k]);
  };
  for (const [set, tree] of Object.entries(dtcg)) if (!set.startsWith('$')) visit(tree, []);
  return found;
}

// The tokens the code has now, as collections (from CSS, or from a tokens.json the agent wrote).
function importedCollections(root, e) {
  if (flags.from) {
    const dtcg = JSON.parse(readFileSync(resolve(flags.from), 'utf8'));
    const { collections, skipped } = importTokens(dtcg);
    const cs = codeSyntaxIn(dtcg);
    for (const c of collections) for (const v of c.variables || []) if (cs[v.name]) v.codeSyntax = cs[v.name];
    return { collections, skipped: skipped ? [{ why: `${skipped} tokens of types Sigma doesn’t hold` }] : [] };
  }
  const css = cssSources(e);
  const dtcgSources = (e.sources || []).filter((s) => s.format === 'dtcg');
  if (dtcgSources.length) {
    const dtcg = JSON.parse(readText(root, dtcgSources[0].path));
    return { collections: importTokens(dtcg).collections, skipped: [] };
  }
  if (!css.length) {
    fail(`tokens entry ${e.index} has no css-variables or dtcg source, so Sigma can’t read it by itself. Write the tokens as tokens.json (skills/sigma-sync/reference/tokens.md) and pass --from <file>.`);
  }
  const decls = css.flatMap((s) => parseCSSVariables(readText(root, s.path)));
  return cssToCollections(decls, cssOpts(e));
}

function tokensImport(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config)) {
    const { collections, skipped } = importedCollections(root, e);
    const existing = readSigma(root, e.sigma);
    const { collections: merged, report } = mergeTokenCollections(existing?.collections || [], collections, { prune: !!flags.prune });
    const file = existing ? { ...existing, collections: merged } : { format: 1, kind: 'tokens', name: e.name || basename(e.sigma, '.sigma.json'), collections: merged };
    const text = formatProjectJSON(file);
    const changed = !existing || formatProjectJSON(existing) !== text;
    if (changed && !flags['dry-run']) writeText(root, e.sigma, text);
    results.push({ sigma: e.sigma, written: changed && !flags['dry-run'], ...report, skipped });
  }
  if (json) return out(results);
  for (const r of results) {
    out(`${r.sigma}: ${r.added.length} added, ${r.changed.length} changed, ${r.unchanged.length} unchanged${r.onlyInSigma.length ? `, ${r.onlyInSigma.length} only in Sigma (kept; --prune removes them)` : ''}${r.written ? ' — written' : flags['dry-run'] ? ' (dry run)' : ' — no changes'}`);
    for (const n of r.added) out(`  + ${n}`);
    for (const n of r.changed) out(`  ~ ${n}`);
    for (const n of r.onlyInSigma) out(`  ? ${n} (only in Sigma)`);
    for (const s of r.skipped) out(`  skipped ${s.name || ''}${s.selector ? ` in ${s.selector}` : ''}: ${s.why}`);
  }
}

const show = (x) => (x === undefined ? '—' : x && typeof x === 'object' && x.alias ? `{${x.alias}}`
  : x && typeof x === 'object' && !Array.isArray(x) ? `{ ${Object.entries(x).map(([k, y]) => `${k}: ${show(y)}`).join(', ')} }` : JSON.stringify(x));
// One mode's change, field by field for typography and shadows ("lineHeight 150 → 160").
const showChange = (before, after) => {
  const obj = (x) => x && typeof x === 'object' && !Array.isArray(x) && !x.alias;
  if (obj(before) && obj(after)) {
    return Object.keys({ ...before, ...after }).filter((k) => show(before[k]) !== show(after[k])).map((k) => `${k} ${show(before[k])} → ${show(after[k])}`).join(', ');
  }
  return `${show(before)} → ${show(after)}`;
};

function changesFor(root, e) {
  const base = flags.base || 'HEAD';
  const now = readSigma(root, e.sigma);
  if (!now) fail(`${e.sigma} doesn’t exist yet: run tokens import first`);
  const then = gitShow(root, base, e.sigma);
  return { base, changes: tokenChanges(then ? JSON.parse(then).collections : [], now.collections, cssOpts(e)), now, then };
}

function tokensDiff(dir) {
  const { root, config } = project(dir);
  const all = entriesOf(config).map((e) => ({ sigma: e.sigma, ...changesFor(root, e) }));
  if (json) return out(all.map(({ sigma, base, changes }) => ({ sigma, base, changes })));
  for (const { sigma, base, changes } of all) {
    out(`${sigma} since ${base}: ${changes.length} change${changes.length === 1 ? '' : 's'}`);
    for (const c of changes) {
      const sign = { added: '+', changed: '~', removed: '-' }[c.change];
      out(`  ${sign} ${c.name}  (${c.code}${c.codeBefore ? `, was ${c.codeBefore}` : ''})${c.renamedFrom ? ` renamed from ${c.renamedFrom}` : ''}`);
      for (const [m, { before, after }] of Object.entries(c.modes)) out(`      ${m}: ${showChange(before, after)}`);
    }
  }
}

function tokensWrite(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config)) {
    const sigma = readSigma(root, e.sigma);
    if (!sigma) fail(`${e.sigma} doesn’t exist yet: run tokens import first`);
    const css = cssSources(e);
    if (!css.length) {
      const { changes, base } = changesFor(root, e);
      results.push({ sigma: e.sigma, manual: true, base, changes });
      continue;
    }
    const { changes } = changesFor(root, e);
    const remove = changes.filter((c) => c.change === 'removed').map((c) => c.code);
    css.forEach((s, i) => {
      const before = readText(root, s.path);
      // New declarations go in the first source; the others only get their existing ones updated.
      const cols = i === 0 ? sigma.collections : sigma.collections.map((c) => ({ ...c, variables: (c.variables || []).filter((v) => parseCSSVariables(before).some((d) => d.name === (v.codeSyntax?.web || codeNameFor(v.name, cssOpts(e))))) }));
      const { text, edits, missing } = applyToCSS(before, cols, { ...cssOpts(e), remove });
      if (text !== before && !flags['dry-run']) writeText(root, s.path, text);
      results.push({ sigma: e.sigma, source: s.path, written: text !== before && !flags['dry-run'], edits, missing });
    });
  }
  if (json) return out(results);
  for (const r of results) {
    if (r.manual) {
      out(`${r.sigma}: its sources aren’t CSS variables, so apply these ${r.changes.length} change${r.changes.length === 1 ? '' : 's'} (since ${r.base}) to the code yourself, then run tokens import --from and check that nothing changes:`);
      for (const c of r.changes) out(`  ${c.change} ${c.name} (${c.code}): ${Object.entries(c.modes).map(([m, x]) => `${m}: ${showChange(x.before, x.after)}`).join('; ')}`);
      continue;
    }
    out(`${r.source}: ${r.edits.length} edit${r.edits.length === 1 ? '' : 's'}${r.written ? ' — written' : flags['dry-run'] ? ' (dry run)' : ''}`);
    for (const ed of r.edits) out(`  ${ed.after === null ? '-' : ed.before === null ? '+' : '~'} ${ed.name} in ${ed.selector}: ${ed.before ?? ''}${ed.before !== null && ed.after !== null ? ' → ' : ''}${ed.after ?? ''}`);
    for (const m of r.missing) out(`  ! ${m.name}: no "${m.selector}" block to add it to`);
  }
}

function tokensExport(dir) {
  const { root, config } = project(dir);
  for (const e of entriesOf(config)) {
    const sigma = readSigma(root, e.sigma);
    if (!sigma) fail(`${e.sigma} doesn’t exist`);
    if (flags.format === 'css') out(exportCSS(sigma.collections, { title: sigma.name }));
    else out(exportDTCG(sigma.collections));
  }
}

// ---------- icons ----------
// The icons the code has now: SVG files in the entry's folder (or in --from, a folder of SVGs the agent
// extracted from icon components).
function importedIcons(root, e) {
  const dir = flags.from ? resolve(flags.from) : join(root, e.source);
  const files = listFilesIn(dir, '.svg').map((p) => ({ path: p, text: readFileSync(join(dir, p), 'utf8') }));
  return iconsFromFiles(files);
}
const svgOutput = (e) => (e.output || 'svg') === 'svg' && !flags.from;

function iconsImport(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config, 'icons')) {
    const { icons, skipped } = importedIcons(root, e);
    const existing = readSigma(root, e.sigma);
    const { icons: merged, report } = mergeIcons(existing?.icons || [], icons, { prune: !!flags.prune });
    const file = existing ? { ...existing, icons: merged } : { format: 1, kind: 'icons', name: e.name || basename(e.sigma, '.sigma.json'), icons: merged };
    const text = formatProjectJSON(file);
    const changed = !existing || formatProjectJSON(existing) !== text;
    if (changed && !flags['dry-run']) writeText(root, e.sigma, text);
    results.push({ sigma: e.sigma, written: changed && !flags['dry-run'], ...report, skipped });
  }
  if (json) return out(results);
  for (const r of results) {
    out(`${r.sigma}: ${r.added.length} added, ${r.changed.length} changed, ${r.unchanged.length} unchanged${r.onlyInSigma.length ? `, ${r.onlyInSigma.length} only in Sigma (kept; --prune removes them)` : ''}${r.written ? ' — written' : flags['dry-run'] ? ' (dry run)' : ' — no changes'}`);
    for (const n of r.added) out(`  + ${n}`);
    for (const n of r.changed) out(`  ~ ${n}`);
    for (const n of r.onlyInSigma) out(`  ? ${n} (only in Sigma)`);
    for (const sk of r.skipped) out(`  skipped ${sk.path}: ${sk.why}`);
  }
}

function iconChangesFor(root, e) {
  const base = flags.base || 'HEAD';
  const now = readSigma(root, e.sigma);
  if (!now) fail(`${e.sigma} doesn’t exist yet: run icons import first`);
  const then = gitShow(root, base, e.sigma);
  return { base, now, changes: iconChanges(then ? JSON.parse(then).icons : [], now.icons) };
}

function iconsDiff(dir) {
  const { root, config } = project(dir);
  const all = entriesOf(config, 'icons').map((e) => ({ sigma: e.sigma, source: e.source, ...iconChangesFor(root, e) }));
  if (json) return out(all.map(({ sigma, base, changes }) => ({ sigma, base, changes: changes.map(({ before, ...c }) => ({ ...c, file: iconFilePath(c.icon || before) })) })));
  for (const { sigma, source, base, changes } of all) {
    out(`${sigma} since ${base}: ${changes.length} change${changes.length === 1 ? '' : 's'}`);
    for (const c of changes) out(`  ${{ added: '+', changed: '~', removed: '-' }[c.change]} ${c.group ? `${c.group}/` : ''}${c.name}  (${source}/${iconFilePath(c.icon || c.before)})`);
  }
}

function iconsWrite(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config, 'icons')) {
    const { now, changes, base } = iconChangesFor(root, e);
    if (!svgOutput(e)) {
      results.push({ sigma: e.sigma, manual: true, base, output: e.output, changes });
      continue;
    }
    const written = [], removed = [], same = [];
    // New files are written like the project's others; a changed file keeps its own style.
    const sample = listFilesIn(join(root, e.source), '.svg')[0];
    const projectStyle = sample ? svgStyleOf(readText(root, `${e.source}/${sample}`)) : null;
    for (const icon of now.icons) {
      const path = `${e.source}/${iconFilePath(icon)}`;
      let style = projectStyle;
      if (exists(root, path)) {
        const text = readText(root, path);
        let disk = null;
        try {
          disk = parseSVGIcon(text, { name: icon.name, group: icon.group });
        } catch {}
        if (disk && sameIcon(disk, icon)) {
          same.push(path);
          continue;
        }
        style = svgStyleOf(text);
      }
      if (!flags['dry-run']) writeText(root, path, iconSVG(icon, { style }));
      written.push(path);
    }
    for (const c of changes.filter((x) => x.change === 'removed' || (x.change === 'changed' && iconFilePath(x.before) !== iconFilePath(x.icon)))) {
      const path = `${e.source}/${iconFilePath(c.before)}`;
      if (exists(root, path) && !now.icons.some((i) => `${e.source}/${iconFilePath(i)}` === path)) {
        if (!flags['dry-run']) removeFile(root, path);
        removed.push(path);
      }
    }
    results.push({ sigma: e.sigma, written, removed, unchanged: same.length });
  }
  if (json) return out(results);
  for (const r of results) {
    if (r.manual) {
      out(`${r.sigma}: icons are ${r.output} in this project, so write these ${r.changes.length} change${r.changes.length === 1 ? '' : 's'} (since ${r.base}) the way the project's other icons are written, then extract them again and check that icons import --from changes nothing:`);
      for (const c of r.changes) {
        out(`  ${c.change} ${c.group ? `${c.group}/` : ''}${c.name}`);
        if (c.icon) out(iconSVG(c.icon).split('\n').map((l) => `      ${l}`).join('\n'));
      }
      continue;
    }
    out(`${r.sigma}: ${r.written.length} written, ${r.removed.length} removed, ${r.unchanged} unchanged${flags['dry-run'] ? ' (dry run)' : ''}`);
    for (const p of r.written) out(`  + ${p}`);
    for (const p of r.removed) out(`  - ${p}`);
  }
}

// validate + every CSS-sourced token file matches its code (an import would change nothing).
function checkAll(dir) {
  const { root, config } = project(dir);
  const v = validate([root]);
  const drift = [];
  for (const e of config.tokens) {
    if (!cssSources(e).length || !exists(root, e.sigma)) continue;
    const { collections } = importedCollections(root, { ...e, index: config.tokens.indexOf(e) });
    const existing = readSigma(root, e.sigma);
    const { report } = mergeTokenCollections(existing.collections, collections);
    if (report.added.length || report.changed.length) drift.push({ sigma: e.sigma, added: report.added, changed: report.changed });
  }
  for (const e of config.icons) {
    if ((e.output || 'svg') !== 'svg' || !exists(root, e.sigma)) continue;
    const { icons } = importedIcons(root, e);
    const { report } = mergeIcons(readSigma(root, e.sigma).icons, icons);
    if (report.added.length || report.changed.length) drift.push({ sigma: e.sigma, added: report.added, changed: report.changed });
  }
  if (json) out({ errors: v.errors, issues: v.issues, drift });
  else {
    if (v.issues.length) out(formatIssues(v.issues));
    for (const d of drift) out(`drift  ${d.sigma}: the code has ${d.added.length} that Sigma doesn’t and ${d.changed.length} that differ (${[...d.added, ...d.changed].slice(0, 6).join(', ')}${d.added.length + d.changed.length > 6 ? '…' : ''}). Run import, or write if Sigma is right.`);
    out(`${Object.keys(v.files).length} files: ${v.errors} errors, ${v.issues.length - v.errors} warnings, ${drift.length ? `${drift.length} file${drift.length === 1 ? '' : 's'} out of step with the code` : 'tokens and icons match the code'}`);
  }
  process.exit(v.errors || drift.length ? 1 : 0);
}

const [cmd, sub, dir] = pos;
if (cmd === 'validate') {
  const { issues, errors, files } = validate([sub || '.']);
  if (json) out({ errors, issues });
  else {
    if (issues.length) out(formatIssues(issues));
    out(`${Object.keys(files).length} files checked: ${errors} errors, ${issues.length - errors} warnings`);
  }
  process.exit(errors ? 1 : 0);
} else if (cmd === 'check') checkAll(sub);
else if (cmd === 'tokens' && sub === 'import') tokensImport(dir);
else if (cmd === 'tokens' && sub === 'diff') tokensDiff(dir);
else if (cmd === 'tokens' && sub === 'write') tokensWrite(dir);
else if (cmd === 'tokens' && sub === 'export') tokensExport(dir);
else if (cmd === 'icons' && sub === 'import') iconsImport(dir);
else if (cmd === 'icons' && sub === 'diff') iconsDiff(dir);
else if (cmd === 'icons' && sub === 'write') iconsWrite(dir);
else {
  out(`Usage:
  node tools/sigma.mjs validate [project]
  node tools/sigma.mjs check [project]
  node tools/sigma.mjs tokens import [project] [--from tokens.json] [--entry N] [--prune] [--dry-run]
  node tools/sigma.mjs tokens diff [project] [--base REV] [--entry N]
  node tools/sigma.mjs tokens write [project] [--base REV] [--entry N] [--dry-run]
  node tools/sigma.mjs tokens export [project] --format dtcg|css [--entry N]
  node tools/sigma.mjs icons import [project] [--from FOLDER] [--entry N] [--prune] [--dry-run]
  node tools/sigma.mjs icons diff [project] [--base REV] [--entry N]
  node tools/sigma.mjs icons write [project] [--base REV] [--entry N] [--dry-run]
Add --json for machine-readable output. See skills/sigma-sync/SKILL.md.`);
  process.exit(cmd ? 2 : 0);
}
