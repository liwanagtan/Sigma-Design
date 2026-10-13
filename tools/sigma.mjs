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
//   node tools/sigma.mjs changeset list [project]
//   node tools/sigma.mjs changeset show <id> [project]
//   node tools/sigma.mjs changeset apply <id> [project] --to DIR [--base REV]
//   node tools/sigma.mjs changeset status <id> <status> [project] [--pr URL] [--pr-number N] [--ticket URL] [--branch NAME]
//   node tools/sigma.mjs changeset branch <id> [project]          the branch name (workflow.branch)
//   node tools/sigma.mjs changeset prepare <id> [project] --to DIR  apply it, write the code, copy it in, check
//   node tools/sigma.mjs changeset pr-body <id> [project] [--images-base URL]
//   node tools/sigma.mjs changeset ticket <id> [project]
//   node tools/sigma.mjs changeset sync [project]                 statuses from GitHub (gh pr view)
//   node tools/sigma.mjs library build [project] --from DIR [--library PATH] [--dry-run]   components from captures
//   node tools/sigma.mjs pages build [project] --from DIR [--dry-run]                       pages from captures, as library instances
//   node tools/sigma.mjs components diff|write [project] [--base REV] [--dry-run]           library changes → code
//   node tools/sigma.mjs comment list [project] [--all]
//   node tools/sigma.mjs comment add [project] --file PATH --layer ID|NAME --text TEXT [--author NAME] [--reply-to ID]
//   node tools/sigma.mjs comment resolve <id> [project] [--author NAME]
//
// [project] is the folder with sigma.config.json (default: the current folder). Token commands work on
// the config's "tokens" entries (all of them, or --entry N). --json prints machine-readable output.
import { resolve, basename } from 'node:path';
import { readFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative } from 'node:path';
import { readProject, readText, exists, writeText, gitShow, removeFile, listFilesIn } from './lib/project.mjs';
import { join } from 'node:path';
import { iconsFromFiles, mergeIcons, iconChanges, iconFilePath, iconSVG, sameIcon, svgStyleOf } from '../src/icon-sync.js';
import { parseSVGIcon } from '../src/icon-library.js';
import { applyChanges, summarize, STATUSES, CHANGESET_DIR } from '../src/changesets.js';
import { buildComponent, buildPage, tokenIndex } from '../src/capture-to-sigma.js';
import { componentDiff, formatComponentDiff } from '../src/component-diff.js';
import { loadAdapter, adapterContext, Snapshot, changedLines } from './lib/adapters.mjs';
import { parseRules, findRule, editRules } from '../src/css-rules.js';
import { useReport, formatUseReport } from '../src/use-report.js';
import { defaultTokenCode } from '../src/code-names.js';
import { parseVariantName } from '../src/components.js';
import { validateProject } from '../src/validate.js';
import { check as validate } from './validate.js';
import { formatIssues } from '../src/validate.js';
import { withDefaults } from '../src/project-config.js';
import { formatProjectJSON, fromProjectFile, toProjectFile } from '../src/project-format.js';
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
    else if (argv[i + 1] && !argv[i + 1].startsWith('--') && ['from', 'entry', 'base', 'format', 'to', 'pr', 'pr-number', 'ticket', 'tracker', 'branch', 'images-base', 'file', 'layer', 'text', 'author', 'reply-to', 'library', 'kind', 'base-file', 'days'].includes(k)) flags[k] = argv[++i];
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
  // Like importTokens: top-level keys are token sets only when one is "Collection/Mode" or $metadata lists
  // them; otherwise they're groups (part of each token's name).
  const keys = Object.keys(dtcg).filter((k) => !k.startsWith('$'));
  const sets = !!(dtcg.$metadata?.tokenSetOrder || dtcg.$extensions?.['app.sigma'] || keys.some((k) => k.includes('/')));
  if (sets) for (const set of keys) visit(dtcg[set], []);
  else visit(dtcg, []);
  return found;
}

// DTCG → collections, with each token's code name from its $extensions.
function dtcgCollections(dtcg) {
  const { collections, skipped } = importTokens(dtcg);
  const cs = codeSyntaxIn(dtcg);
  for (const c of collections) for (const v of c.variables || []) if (cs[v.name]) v.codeSyntax = cs[v.name];
  return { collections, skipped: skipped ? [{ why: `${skipped} tokens of types Sigma doesn’t hold` }] : [] };
}

// The tokens the code has now, as collections: from CSS, a DTCG source, the project's adapter, or a tokens.json
// the agent wrote (--from).
async function importedCollections(root, e) {
  if (flags.from) return dtcgCollections(JSON.parse(readFileSync(resolve(flags.from), 'utf8')));
  if (e.adapter) {
    const adapter = await loadAdapter(root, e.adapter);
    return dtcgCollections(await adapter.read(adapterContext(root, e)));
  }
  const css = cssSources(e);
  const dtcgSources = (e.sources || []).filter((s) => s.format === 'dtcg');
  if (dtcgSources.length) return dtcgCollections(JSON.parse(readText(root, dtcgSources[0].path)));
  if (!css.length) {
    fail(`tokens entry ${e.index} has no css-variables or dtcg source and no adapter, so Sigma can’t read it by itself. Write an adapter (skills/sigma-sync/reference/adapters.md), or the tokens as tokens.json (reference/tokens.md) and pass --from <file>.`);
  }
  const decls = css.flatMap((s) => parseCSSVariables(readText(root, s.path)));
  return cssToCollections(decls, cssOpts(e));
}

async function tokensImport(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config)) {
    const { collections, skipped } = await importedCollections(root, e);
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

// The Sigma file to compare with: --base-file (the version before one save, from live sync), else git (--base).
function baseText(root, e) {
  if (flags['base-file']) return readFileSync(resolve(flags['base-file']), 'utf8');
  return gitShow(root, flags.base || 'HEAD', e.sigma);
}

function changesFor(root, e) {
  const base = flags['base-file'] ? 'the last save' : flags.base || 'HEAD';
  const now = readSigma(root, e.sigma);
  if (!now) fail(`${e.sigma} doesn’t exist yet: run tokens import first`);
  const then = baseText(root, e);
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

// Write Sigma's changes through the project's adapter, then read back: the code must now hold what Sigma has.
// If it doesn't, the files the adapter changed are put back. Dry run: write, report, put back.
async function writeThroughAdapter(root, e, changes, collectionsNow) {
  const adapter = await loadAdapter(root, e.adapter);
  const snapshot = new Snapshot(root);
  const ctx = adapterContext(root, e, snapshot);
  let problem = null;
  try {
    await adapter.write(ctx, changes);
    const { collections } = dtcgCollections(await adapter.read(adapterContext(root, e)));
    const { report } = mergeTokenCollections(collectionsNow, collections);
    if (report.added.length || report.changed.length) problem = `after writing, the code still differs from Sigma: ${[...report.added, ...report.changed].slice(0, 6).join(', ')}`;
  } catch (err) {
    problem = `the adapter failed: ${err.message}`;
  }
  const files = snapshot.changed().map((f) => ({ path: f.path, lines: changedLines(f.before, f.after) }));
  if (problem || flags['dry-run']) snapshot.restore();
  return { files, problem };
}

async function tokensWrite(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config)) {
    const sigma = readSigma(root, e.sigma);
    if (!sigma) fail(`${e.sigma} doesn’t exist yet: run tokens import first`);
    if (e.adapter) {
      const { changes, base } = changesFor(root, e);
      if (!changes.length) {
        results.push({ sigma: e.sigma, adapter: e.adapter, base, changes, files: [] });
        continue;
      }
      results.push({ sigma: e.sigma, adapter: e.adapter, base, changes, ...(await writeThroughAdapter(root, e, changes, sigma.collections)) });
      continue;
    }
    const css = cssSources(e);
    if (!css.length) {
      const { changes, base } = changesFor(root, e);
      results.push({ sigma: e.sigma, manual: true, base, changes });
      continue;
    }
    const { changes } = changesFor(root, e);
    const remove = changes.filter((c) => c.change === 'removed').map((c) => c.code);
    // One save's changes (live sync): only those tokens are written, so a change in the code that Sigma hasn't
    // read yet is never written over.
    const only = flags['base-file'] ? new Set(changes.filter((c) => c.change !== 'removed').map((c) => c.id)) : null;
    const scoped = only ? sigma.collections.map((c) => ({ ...c, variables: (c.variables || []).filter((v) => only.has(v.id)) })) : sigma.collections;
    css.forEach((s, i) => {
      const before = readText(root, s.path);
      // New declarations go in the first source; the others only get their existing ones updated.
      const cols = i === 0 ? scoped : scoped.map((c) => ({ ...c, variables: (c.variables || []).filter((v) => parseCSSVariables(before).some((d) => d.name === (v.codeSyntax?.web || codeNameFor(v.name, cssOpts(e))))) }));
      const { text, edits, missing } = applyToCSS(before, cols, { ...cssOpts(e), remove });
      if (text !== before && !flags['dry-run']) writeText(root, s.path, text);
      results.push({ sigma: e.sigma, source: s.path, written: text !== before && !flags['dry-run'], edits, missing });
    });
  }
  if (json) {
    out(results);
    if (results.some((r) => r.problem)) process.exit(1);
    return;
  }
  for (const r of results) {
    if (r.adapter) {
      if (!r.changes.length) {
        out(`${r.sigma}: no changes since ${r.base}`);
        continue;
      }
      if (r.problem) {
        out(`${r.sigma}: not written — ${r.problem}. The files were put back. Fix the adapter (${r.adapter}; skills/sigma-sync/reference/adapters.md), then write again.`);
        process.exitCode = 1;
        continue;
      }
      out(`${r.sigma}: ${r.changes.length} change${r.changes.length === 1 ? '' : 's'} written through ${r.adapter}${flags['dry-run'] ? ' (dry run: put back)' : ''}, and read back the same`);
      for (const f of r.files) out(`  ~ ${f.path} (${f.lines} line${f.lines === 1 ? '' : 's'})`);
      continue;
    }
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
async function importedIcons(root, e) {
  if (e.adapter && !flags.from) {
    const adapter = await loadAdapter(root, e.adapter);
    return iconsFromFiles(await adapter.read(adapterContext(root, e)));
  }
  const dir = flags.from ? resolve(flags.from) : join(root, e.source);
  const files = listFilesIn(dir, '.svg').map((p) => ({ path: p, text: readFileSync(join(dir, p), 'utf8') }));
  return iconsFromFiles(files);
}
const svgOutput = (e) => (e.output || 'svg') === 'svg' && !flags.from;

async function iconsImport(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config, 'icons')) {
    const { icons, skipped } = await importedIcons(root, e);
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
  const base = flags['base-file'] ? 'the last save' : flags.base || 'HEAD';
  const now = readSigma(root, e.sigma);
  if (!now) fail(`${e.sigma} doesn’t exist yet: run icons import first`);
  const then = baseText(root, e);
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

async function iconsWrite(dir) {
  const { root, config } = project(dir);
  const results = [];
  for (const e of entriesOf(config, 'icons')) {
    const { now, changes, base } = iconChangesFor(root, e);
    if (e.adapter) {
      if (!changes.length) {
        results.push({ sigma: e.sigma, adapter: e.adapter, base, changes, files: [] });
        continue;
      }
      // Through the project's adapter, then read back: the code must hold Sigma's icons.
      const adapter = await loadAdapter(root, e.adapter);
      const snapshot = new Snapshot(root);
      let problem = null;
      try {
        await adapter.write(adapterContext(root, e, snapshot), changes);
        const { icons } = iconsFromFiles(await adapter.read(adapterContext(root, e)));
        const { report } = mergeIcons(now.icons, icons);
        if (report.added.length || report.changed.length) problem = `after writing, the code still differs from Sigma: ${[...report.added, ...report.changed].slice(0, 6).join(', ')}`;
      } catch (err) {
        problem = `the adapter failed: ${err.message}`;
      }
      const files = snapshot.changed().map((f) => ({ path: f.path, lines: changedLines(f.before, f.after) }));
      if (problem || flags['dry-run']) snapshot.restore();
      results.push({ sigma: e.sigma, adapter: e.adapter, base, changes, files, problem });
      continue;
    }
    if (!svgOutput(e)) {
      results.push({ sigma: e.sigma, manual: true, base, output: e.output, changes });
      continue;
    }
    const written = [], removed = [], same = [];
    // New files are written like the project's others; a changed file keeps its own style.
    const sample = listFilesIn(join(root, e.source), '.svg')[0];
    const projectStyle = sample ? svgStyleOf(readText(root, `${e.source}/${sample}`)) : null;
    const only = flags['base-file'] ? new Set(changes.filter((c) => c.change !== 'removed').map((c) => c.id)) : null;
    for (const icon of now.icons) {
      if (only && !only.has(icon.id)) continue; // live sync: only what this save changed
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
    if (r.adapter) {
      if (!r.changes.length) out(`${r.sigma}: no changes since ${r.base}`);
      else if (r.problem) {
        out(`${r.sigma}: not written — ${r.problem}. The files were put back. Fix the adapter (${r.adapter}), then write again.`);
        process.exitCode = 1;
      } else {
        out(`${r.sigma}: ${r.changes.length} change${r.changes.length === 1 ? '' : 's'} written through ${r.adapter}${flags['dry-run'] ? ' (dry run: put back)' : ''}, and read back the same`);
        for (const f of r.files) out(`  ~ ${f.path} (${f.lines} line${f.lines === 1 ? '' : 's'})`);
      }
      continue;
    }
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

// ---------- changesets (Propose change) ----------
function changesets(root) {
  const dir = join(root, CHANGESET_DIR);
  return listFilesIn(dir, '.json').filter((p) => !p.includes('/')).map((p) => ({ path: `${CHANGESET_DIR}/${p}`, ...JSON.parse(readFileSync(join(dir, p), 'utf8')) }));
}
function changeset(root, id) {
  const all = changesets(root);
  const exact = all.find((c) => c.id === id);
  if (exact) return exact;
  const some = all.filter((c) => c.id.includes(id)); // any unique part of the id ("darker-hover")
  if (some.length > 1) fail(`${id} matches ${some.length} changesets: ${some.map((c) => c.id).join(', ')}`);
  if (!some.length) fail(`no changeset ${id} in ${CHANGESET_DIR}/ (changeset list shows them)`);
  return some[0];
}

function changesetList(dir) {
  const root = resolve(dir || '.');
  const list = changesets(root).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (json) return out(list.map(({ changes, renders, ...c }) => ({ ...c, summary: summarize(changes || []) })));
  if (!list.length) return out('No proposed changes.');
  for (const c of list) out(`${c.id}  [${STATUSES[c.status] || c.status}]  ${c.title} — ${summarize(c.changes || [])}${c.pr?.url ? `  ${c.pr.url}` : ''}`);
}

function changesetShow(id, dir) {
  const root = resolve(dir || '.');
  const c = changeset(root, id);
  if (json) return out(c);
  out(`${c.title}  [${STATUSES[c.status] || c.status}]  ${c.id}`);
  if (c.note) out(c.note);
  out(`Compared with ${c.base}; ${summarize(c.changes)}:`);
  for (const ch of c.changes) {
    out(`  ${ch.change} ${ch.kind} ${ch.kind === 'file' ? '(settings)' : ch.name}  in ${ch.file}`);
    const r = c.renders?.[ch.key];
    if (r) out(`      pictures: ${[r.before && `before ${r.before}`, r.after && `after ${r.after}`].filter(Boolean).join(', ')}`);
  }
}

// The files of a pull request for this changeset: its changes applied onto the base (git), written in DIR
// (a worktree or a branch checkout), and checked.
function changesetApply(id, dir) {
  const root = resolve(dir || '.');
  if (!flags.to) fail('say where to write the files: --to <folder> (a git worktree of the base branch, say)');
  const to = resolve(flags.to);
  const c = changeset(root, id);
  const rev = flags.base || (c.base === 'disk' ? null : c.base) || 'HEAD';
  const base = {};
  for (const path of new Set(c.changes.map((x) => x.file))) {
    const text = rev ? gitShow(root, rev, path) : null;
    base[path] = text ? JSON.parse(text) : null;
  }
  const result = applyChanges(base, c.changes);
  // Check the result together with the other project files as they are in the target folder.
  const files = { ...readProject(to).files };
  for (const [p, f] of Object.entries(result)) {
    if (f) files[p] = formatProjectJSON(f);
    else delete files[p];
  }
  const issues = validateProject(files).filter((i) => i.level === 'error' && result[i.file] !== undefined);
  for (const [p, f] of Object.entries(result)) {
    if (f) writeText(to, p, formatProjectJSON(f));
    else if (exists(to, p)) removeFile(to, p);
  }
  if (json) return out({ written: Object.keys(result), errors: issues });
  out(`${c.title}: wrote ${Object.keys(result).length} file${Object.keys(result).length === 1 ? '' : 's'} in ${to}`);
  for (const p of Object.keys(result)) out(`  ${result[p] ? '~' : '-'} ${p}`);
  if (issues.length) {
    out(formatIssues(issues));
    process.exit(1);
  }
}

function changesetStatus(id, status, dir) {
  const root = resolve(dir || '.');
  if (!STATUSES[status]) fail(`status should be one of ${Object.keys(STATUSES).join(', ')}`);
  const c = changeset(root, id);
  const { path, ...data } = c;
  data.status = status;
  if (flags.pr) data.pr = { ...(data.pr || {}), host: 'github', url: flags.pr, ...(flags['pr-number'] ? { number: Number(flags['pr-number']) } : {}) };
  if (flags.ticket) data.ticket = { ...(data.ticket || {}), tracker: flags.tracker || 'notion', url: flags.ticket };
  if (flags.branch) data.branch = flags.branch;
  data.updatedAt = new Date().toISOString();
  writeText(root, path, formatProjectJSON(data));
  out(`${c.title}: ${STATUSES[status]}`);
}

// ---------- team workflow (Phase 26) ----------
const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'change';
function branchName(config, c) {
  const pattern = config.workflow?.branch || 'design/{slug}';
  const ticket = c.ticket?.id || c.ticket?.url?.match(/([0-9a-f]{32}|[A-Z]+-\d+)\/?$/i)?.[1]?.slice(0, 8) || '';
  return pattern.replace('{slug}', slugOf(c.title)).replace('{id}', c.id).replace('{ticket}', ticket).replace(/\/-|-\/|--+/g, (m) => (m.includes('/') ? '/' : '-')).replace(/-$/, '');
}

function changesetBranch(id, dir) {
  const { root, config } = project(dir);
  out(branchName(config, changeset(root, id)));
}

// One line per change, with token values before → after per mode (mode and token names from the project's
// files, when they're there).
function changeLines(c, root) {
  const modeNames = new Map(), tokenNames = new Map();
  for (const path of new Set(c.changes.filter((ch) => ch.kind === 'token').map((ch) => ch.file))) {
    for (const text of [root && exists(root, path) ? readText(root, path) : null, root ? gitShow(root, c.base === 'disk' ? 'HEAD' : c.base, path) : null]) {
      if (!text) continue;
      for (const col of JSON.parse(text).collections || []) {
        for (const m of col.modes || []) modeNames.set(m.id, m.name);
        for (const v of col.variables || []) tokenNames.set(v.id, v.name);
      }
    }
  }
  const show2 = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? (v.alias ? `{${tokenNames.get(v.alias) || v.alias}}` : JSON.stringify(v)) : String(v));
  return c.changes.map((ch) => {
    const what = ch.kind === 'file' ? `${ch.file}: name, links, collections or modes`
      : ch.kind === 'comment' ? `comment by ${ch.after?.author || ch.before?.author} on _${(ch.after || ch.before)?.layer || 'the page'}_${ch.after?.resolved && !ch.before?.resolved ? ' (resolved)' : ''}`
        : `${ch.kind} **${ch.name}**`;
    let detail = '';
    let sub = [];
    if (ch.kind === 'component' && ch.before && ch.after && root) {
      // What a reviewer needs: the design diff in CSS terms (Phase 30).
      const d = componentDiff(ch.before, ch.after, { entry: manifestEntry(root, ch.file, ch.name), codeOf: tokenCodeOf(root, ch.file) });
      if (!d.diff.length) detail = 'moved on the canvas only';
      sub = d.diff.map((l) => `  - ${l.replace(/^[^:]*?: /, (m) => (m.startsWith(`${ch.name}: `) ? '' : m))}`);
    }
    if (ch.kind === 'token') {
      const modes = new Set([...Object.keys(ch.before?.valuesByMode || {}), ...Object.keys(ch.after?.valuesByMode || {})]);
      detail = [...modes].filter((m) => show2(ch.before?.valuesByMode?.[m]) !== show2(ch.after?.valuesByMode?.[m]))
        .map((m) => `${modeNames.get(m) || m}: ${show2(ch.before?.valuesByMode?.[m])} → ${show2(ch.after?.valuesByMode?.[m])}`).join(', ');
      if (ch.after?.codeSyntax?.web) detail = `\`${ch.after.codeSyntax.web}\` ${detail}`;
    }
    return [`- ${ch.change} ${what}${detail ? ` — ${detail}` : ''}`, ...sub].join('\n');
  });
}

// The captures' manifest entry for a component of a library in sigma.config.json (or {}).
function manifestEntry(root, libPath, name) {
  const { config } = readProject(root);
  const e = (config?.components || []).find((x) => x.sigma === libPath);
  const path = e?.manifest || MANIFEST;
  if (!exists(root, path)) return { name };
  return JSON.parse(readText(root, path)).components.find((c) => c.name === name) || { name };
}
// Token id → CSS variable name, for the tokens a design file uses.
function tokenCodeOf(root, path) {
  const codes = new Map();
  const file = readSigma(root, path);
  for (const p of file?.uses?.tokens || []) {
    for (const c of readSigma(root, p)?.collections || []) for (const v of c.variables || []) codes.set(v.id, v.codeSyntax?.web?.startsWith('--') ? v.codeSyntax.web : defaultTokenCode(v.name));
  }
  return (id) => codes.get(id) || null;
}

function changesetPRBody(id, dir) {
  const root = resolve(dir || '.');
  const c = changeset(root, id);
  const img = (p) => (flags['images-base'] ? `${String(flags['images-base']).replace(/\/$/, '')}/${p}` : p);
  const lines = [];
  if (c.note) lines.push(c.note, '');
  lines.push(`**Design change from Sigma:** ${summarize(c.changes)}.`, '', '### What changed', '', ...changeLines(c, root), '');
  const pics = c.changes.filter((ch) => c.renders?.[ch.key]);
  if (pics.length) {
    lines.push('### Before and after', '', '| | Before | After |', '| --- | --- | --- |');
    for (const ch of pics) {
      const r = c.renders[ch.key];
      lines.push(`| ${ch.kind} ${ch.name} | ${r.before ? `<img src="${img(r.before)}" width="280">` : '—'} | ${r.after ? `<img src="${img(r.after)}" width="280">` : '—'} |`);
    }
    lines.push('');
  }
  // Comments on the design (made in Sigma), with the layer each is on.
  const notes = c.changes.filter((ch) => ch.kind === 'comment' && ch.after);
  if (notes.length) {
    lines.push('### Comments on the design', '');
    for (const ch of notes) {
      const m = ch.after;
      lines.push(`- ${m.resolved ? '✅ ' : ''}**${m.author}** on _${m.layer || 'the page'}_: ${m.text}`);
      for (const r of m.replies || []) lines.push(`  - **${r.author}**: ${r.text}`);
    }
    lines.push('');
  }
  if (c.ticket?.url) lines.push(`Ticket: ${c.ticket.url}`, '');
  lines.push(`<sub>Proposed in Sigma as \`${c.path}\`. Sigma files changed by this pull request were checked with \`tools/sigma.mjs check\`.</sub>`);
  out(lines.join('\n'));
}

function changesetTicket(id, dir) {
  const root = resolve(dir || '.');
  const c = changeset(root, id);
  const body = [c.note, '', `Design change proposed in Sigma (${summarize(c.changes)}):`, '', ...changeLines(c, root), '',
    ...Object.values(c.renders || {}).flatMap((r) => [r.before && `Before: ${r.before}`, r.after && `After: ${r.after}`].filter(Boolean)),
    '', `Changeset: ${c.path}`].filter((x) => x !== undefined);
  if (json) return out({ title: c.title, body: body.join('\n'), status: 'To do' });
  out(`# ${c.title}\n\n${body.join('\n')}`);
}

// Everything a pull request's branch needs, in DIR (a worktree of the base branch): the changeset applied
// to the Sigma files, the code written from them (tokens and icons), the changeset and its pictures copied
// in, and the checks run.
async function changesetPrepare(id, dir) {
  const root = resolve(dir || '.');
  if (!flags.to) fail('say where the branch is checked out: --to <folder> (git worktree add -b <branch> <folder> <base>)');
  const to = resolve(flags.to);
  if (to === root) fail('--to must be another checkout (a worktree), so your working copy isn’t touched');
  const c = changeset(root, id);
  changesetApply(id, dir);
  // The changeset and its pictures go in the branch, for reviewers.
  for (const p of [c.path, ...Object.values(c.renders || {}).flatMap((r) => [r.before, r.after]).filter(Boolean)]) {
    mkdirSync(dirname(join(to, p)), { recursive: true });
    copyFileSync(join(root, p), join(to, p));
  }
  // Code from the Sigma files this changeset touched.
  const { config } = project(to);
  const touched = new Set(c.changes.map((ch) => ch.file));
  const code = [];
  const keep = { ...flags };
  for (const [i, e] of config.tokens.entries()) {
    if (!touched.has(e.sigma)) continue;
    Object.assign(flags, { entry: String(i), json: false, 'dry-run': false });
    await tokensWrite(to);
    code.push(e.sigma);
  }
  for (const [i, e] of config.icons.entries()) {
    if (!touched.has(e.sigma)) continue;
    Object.assign(flags, { entry: String(i), json: false, 'dry-run': false });
    await iconsWrite(to);
    code.push(e.sigma);
  }
  // Components (Phase 30): exact CSS and code edits; what's left is listed for the agent.
  config.components.forEach((e, i) => {
    if (!touched.has(e.sigma) || !c.changes.some((ch) => ch.file === e.sigma && ch.kind === 'component')) return;
    Object.assign(flags, { entry: String(i), json: false, 'dry-run': false, base: 'HEAD' });
    componentsWrite(to);
    code.push(e.sigma);
  });
  for (const k of Object.keys(flags)) delete flags[k];
  Object.assign(flags, keep);
  out(`Branch files ready in ${to}. Run the project's own checks (tests, lint, build) there before committing.`);
  if (c.changes.some((ch) => ch.kind === 'component' || ch.kind === 'page')) {
    out('Components: finish what’s listed “For you”, then capture and compare before committing (skills/sigma-sync/reference/design-to-code.md).');
  }
}

// Statuses from GitHub for proposals with a pull request.
function changesetSync(dir) {
  const root = resolve(dir || '.');
  const updated = [];
  for (const c of changesets(root)) {
    if (!c.pr?.url || c.status === 'merged' || c.status === 'closed') continue;
    let pr;
    try {
      pr = JSON.parse(execFileSync('gh', ['pr', 'view', c.pr.url, '--json', 'state,isDraft,reviewDecision,mergedAt,number'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (err) {
      fail(`couldn’t read ${c.pr.url} with gh (is gh installed and signed in?): ${String(err.stderr || err.message).trim()}`);
    }
    const status = pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'closed' : pr.reviewDecision === 'CHANGES_REQUESTED' ? 'changes-requested' : 'in-review';
    if (status !== c.status) {
      const { path, ...data } = c;
      writeText(root, path, formatProjectJSON({ ...data, status, pr: { ...c.pr, number: pr.number }, updatedAt: new Date().toISOString(), ...(pr.mergedAt ? { mergedAt: pr.mergedAt } : {}) }));
      updated.push({ id: c.id, title: c.title, from: c.status, to: status, ticket: c.ticket?.url || null });
    }
  }
  if (json) return out(updated);
  if (!updated.length) return out('Statuses are up to date.');
  for (const u of updated) out(`${u.title}: ${STATUSES[u.from] || u.from} → ${STATUSES[u.to]}${u.to === 'merged' && u.ticket ? `  (move the ticket to Done: ${u.ticket})` : ''}`);
}

// ---------- component library onboarding (Phase 28) ----------
// Build (or rebuild) the library's components from captures: DIR has manifest.json and the capture files it
// lists (see skills/sigma-sync/reference/components.md). Components are matched by name: a rebuilt one
// keeps its place; new ones go below the others on the first page.
function libraryBuild(dir) {
  const root = resolve(dir || '.');
  if (!flags.from) fail('say where the captures are: --from <folder with manifest.json>');
  const from = resolve(flags.from);
  const manifest = JSON.parse(readFileSync(join(from, 'manifest.json'), 'utf8'));
  const libPath = flags.library || manifest.library;
  if (!libPath) fail('say which library file to build: --library .sigma/design/<name>.sigma.json (or "library" in manifest.json)');
  const files = Object.fromEntries(Object.entries(readProject(root).files).map(([p, t]) => [p, JSON.parse(t)]));
  const lib = files[libPath] || { format: 1, kind: 'design', name: manifest.name || 'Library', uses: manifest.uses || {}, pages: [{ id: 'components', name: 'Components', background: '#F5F5F5', children: [] }] };
  if (manifest.uses) lib.uses = { ...(lib.uses || {}), ...manifest.uses };
  // Tokens and icons this library can use.
  const tokenCols = (lib.uses?.tokens || []).flatMap((p) => files[p]?.collections || []);
  const tokens = tokenIndex(tokenCols, defaultTokenCode);
  const icons = (lib.uses?.icons || []).flatMap((p) => files[p]?.icons || []);
  const iconFor = (svg) => {
    try {
      const parsed = parseSVGIcon(svg);
      return icons.find((i) => i.body === parsed.body && i.viewBox === parsed.viewBox)?.id || null;
    } catch {
      return null;
    }
  };
  const built = new Map(); // component name → { node }
  const componentIdFor = (name, variant) => {
    const b = built.get(name);
    if (!b) return null;
    if (b.node.type === 'component') return b.node.id;
    const want = Object.entries(variant || {});
    return (b.node.children.find((c) => want.every(([k, v]) => parseVariantName(c.name)[k] === v)) || b.node.children[0]).id;
  };
  const ids = new Set();
  const notes = [];
  for (const spec of manifest.components) {
    const captures = spec.captures.map((c) => ({ variant: c.variant, capture: JSON.parse(readFileSync(join(from, c.file), 'utf8')) }));
    const { node, notes: n } = buildComponent({ ...spec, captures }, { tokens, iconFor, componentIdFor, ids });
    built.set(spec.name, { node });
    notes.push(...n);
  }
  // Into the library: replace by name (same place), or add below.
  const page = lib.pages[0] || (lib.pages[0] = { id: 'components', name: 'Components', children: [] });
  const report = { added: [], replaced: [] };
  const added = [];
  for (const [name, { node }] of built) {
    const at = page.children.findIndex((c) => (c.type === 'component' || c.type === 'componentSet') && c.name === name);
    if (at < 0) {
      added.push([name, node]);
      continue;
    }
    const old = page.children[at];
    Object.assign(node, { x: old.x, y: old.y });
    page.children[at] = node;
    report.replaced.push(name);
    // Grown taller: move what's below it down by as much, so nothing overlaps.
    const grew = (node.h || 0) - (old.h || 0);
    if (grew > 0) for (const c of page.children) if (c !== node && (c.y || 0) >= (old.y || 0) + (old.h || 0)) c.y = (c.y || 0) + grew;
  }
  let y = Math.max(40, ...page.children.map((c) => (c.y || 0) + (c.h || 120) + 60));
  for (const [name, node] of added) {
    Object.assign(node, { x: 40, y });
    y += (node.h || 120) + 60;
    page.children.push(node);
    report.added.push(name);
  }
  const text = formatProjectJSON(asSigmaSaves(lib, libPath, files));
  const check = validateProject({ ...Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f])), [libPath]: JSON.parse(text) }).filter((i) => i.file === libPath && i.level === 'error');
  if (!flags['dry-run']) writeText(root, libPath, text);
  if (json) return out({ library: libPath, ...report, notes, errors: check });
  out(`${libPath}: ${report.added.length} added, ${report.replaced.length} rebuilt${flags['dry-run'] ? ' (dry run)' : ' — written'}`);
  for (const n of report.added) out(`  + ${n}`);
  for (const n of report.replaced) out(`  ~ ${n}`);
  for (const n of [...new Set(notes)]) out(`  note: ${n}`);
  if (check.length) {
    out(formatIssues(check));
    process.exit(1);
  }
}

// A design file as Sigma itself saves it (defaults and values layout derives left out), so that opening it in
// Sigma and saving changes nothing, and diffs show only what a designer changed.
function asSigmaSaves(file, path, files) {
  const resolve = (p) => (files[p] ? { fileId: p, file: files[p] } : null);
  const { doc } = fromProjectFile(structuredClone(file), { path, resolve });
  return toProjectFile(doc, { pathOf: (id) => (files[id] ? id : null) }).file;
}

// ---------- pages (Phase 29) ----------
const pageSlug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// The capture file for a page at a breakpoint.
const pageCaptureFile = (page, bp) => `page-${pageSlug(page.name)}-${pageSlug(bp.name)}.json`;

function pagesBuild(dir) {
  const root = resolve(dir || '.');
  if (!flags.from) fail('say where the captures are: --from <folder with manifest.json and pages.json>');
  const from = resolve(flags.from);
  const manifest = JSON.parse(readFileSync(join(from, 'manifest.json'), 'utf8'));
  const spec = JSON.parse(readFileSync(join(from, 'pages.json'), 'utf8'));
  if (!spec.file) fail('pages.json needs "file": the Sigma Design file to build (.sigma/design/<name>.sigma.json)');
  const files = Object.fromEntries(Object.entries(readProject(root).files).map(([p, t]) => [p, JSON.parse(t)]));
  const libPath = manifest.library;
  const lib = files[libPath];
  if (!lib) fail(`${libPath} isn’t built yet: run library build first`);
  const out0 = files[spec.file] || { format: 1, kind: 'design', name: spec.name || 'Pages', pages: [] };
  out0.uses = { ...(lib.uses || {}), components: [libPath] };
  const tokens = tokenIndex((lib.uses?.tokens || []).flatMap((p) => files[p]?.collections || []), defaultTokenCode);
  const icons = (lib.uses?.icons || []).flatMap((p) => files[p]?.icons || []);
  const iconFor = (svg) => {
    try {
      const parsed = parseSVGIcon(svg);
      return icons.find((i) => i.body === parsed.body && i.viewBox === parsed.viewBox)?.id || null;
    } catch {
      return null;
    }
  };
  // An image's URL path → the project file it is (the longest tail of the path that exists).
  const iconForSrc = (src) => {
    const parts = String(src || '').split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const rel = parts.slice(i).join('/');
      if (exists(root, rel)) return iconFor(readText(root, rel));
    }
    return null;
  };
  const libNodes = lib.pages.flatMap((pg) => pg.children);
  const library = manifest.components.filter((c) => c.match).map((c) => ({ name: c.name, match: c.match, node: libNodes.find((n) => (n.type === 'component' || n.type === 'componentSet') && n.name === c.name) }));
  for (const e of library) if (!e.node) fail(`${e.name} isn’t in ${libPath}: run library build first`);
  const ids = new Set();
  const report = [];
  const notes = [];
  for (const page of spec.pages) {
    const id = pageSlug(page.name);
    let pg = out0.pages.find((x) => x.name === page.name);
    if (!pg) out0.pages.push((pg = { id, name: page.name, background: '#F5F5F5', children: [] }));
    let x = 0;
    for (const bp of spec.breakpoints) {
      const file = join(from, pageCaptureFile(page, bp));
      if (!existsSync(file)) {
        notes.push(`${page.name} — ${bp.name}: no capture (${relative(root, file)})`);
        continue;
      }
      const capture = JSON.parse(readFileSync(file, 'utf8'));
      const name = `${page.name} — ${bp.name}`;
      const built = buildPage(capture, { name, tokens, iconFor, iconForSrc, library, ids });
      const frame = built.node;
      Object.assign(frame, { x, y: 0 });
      x += (frame.w || bp.width) + 80;
      const at = pg.children.findIndex((c) => c.name === name);
      if (at >= 0) pg.children[at] = frame;
      else pg.children.push(frame);
      report.push({ frame: name, instances: built.instances, loose: built.loose });
      notes.push(...built.notes);
    }
  }
  const text = formatProjectJSON(asSigmaSaves(out0, spec.file, files));
  const check = validateProject({ ...files, [spec.file]: JSON.parse(text) }).filter((i) => i.file === spec.file && i.level === 'error');
  if (!flags['dry-run']) writeText(root, spec.file, text);
  if (json) return out({ file: spec.file, frames: report, notes: [...new Set(notes)], errors: check });
  out(`${spec.file}: ${report.length} frames${flags['dry-run'] ? ' (dry run)' : ' — written'}`);
  for (const r of report) {
    const texts = r.loose.filter((l) => l.what === 'text');
    const other = r.loose.filter((l) => l.what !== 'text');
    out(`  ${r.frame}: ${r.instances} library instances; not from the library: ${other.length} boxes and icons, ${texts.length} texts`);
    for (const l of other) out(`    ${l.what}: ${l.layer}`);
    if (texts.length) out(`    texts: ${texts.map((t) => `“${t.text.length > 30 ? `${t.text.slice(0, 29)}…` : t.text}”`).join(', ')}`);
  }
  for (const n of [...new Set(notes)]) out(`  note: ${n}`);
  if (check.length) {
    out(formatIssues(check));
    process.exit(1);
  }
}

// ---------- design to code for components (Phase 30) ----------
const MANIFEST = '.sigma/captures/manifest.json';
const topComponents = (file) => {
  const out = new Map();
  for (const pg of file?.pages || []) {
    const visit = (nodes) => nodes.forEach((n) => (n.type === 'component' || n.type === 'componentSet' ? out.set(n.id, n) : n.children && visit(n.children)));
    visit(pg.children || []);
  }
  return out;
};

// For each library in sigma.config.json's components: what changed since --base, and the code plan.
function componentPlans(root, config) {
  const base = flags['base-file'] ? 'the last save' : flags.base || 'HEAD';
  return entriesOf(config, 'components').map((e) => {
    const now = readSigma(root, e.sigma);
    if (!now) fail(`${e.sigma} doesn’t exist yet: build the library first (library build)`);
    const thenText = baseText(root, e);
    const then = thenText ? JSON.parse(thenText) : null;
    const manifestPath = e.manifest || MANIFEST;
    const manifest = exists(root, manifestPath) ? JSON.parse(readText(root, manifestPath)) : { components: [] };
    const tokenFiles = [...new Set([...(now.uses?.tokens || []), ...(then?.uses?.tokens || [])])];
    const codes = new Map();
    for (const p of tokenFiles) {
      const f = readSigma(root, p);
      for (const c of f?.collections || []) for (const v of c.variables || []) codes.set(v.id, v.codeSyntax?.web?.startsWith('--') ? v.codeSyntax.web : defaultTokenCode(v.name));
    }
    const a = topComponents(then), b = topComponents(now);
    const plans = [];
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(id) || null, y = b.get(id) || null;
      if (JSON.stringify(x) === JSON.stringify(y)) continue;
      const entry = manifest.components.find((c) => c.name === (y || x).name) || { name: (y || x).name };
      const source = entry.source && exists(root, entry.source) ? readText(root, entry.source) : null;
      const plan = componentDiff(x, y, { entry, codeOf: (tid) => codes.get(tid) || null, source });
      if (plan.diff.length || plan.css.length || plan.code.length || plan.agent.length) plans.push(plan); // not just moved on the canvas
    }
    return { entry: e, base, manifestPath, manifest, plans };
  });
}

function componentsDiff(dir) {
  const { root, config } = project(dir);
  if (!config.components.length) fail('no components in sigma.config.json: add { "sigma": ".sigma/design/<library>.sigma.json", "source": "src/components" } (skills/sigma-sync/reference/design-to-code.md)');
  const all = componentPlans(root, config);
  if (json) return out(all.map(({ entry, base, plans }) => ({ sigma: entry.sigma, base, plans })));
  for (const { entry, base, plans } of all) {
    out(`${entry.sigma} since ${base}: ${plans.length} component${plans.length === 1 ? '' : 's'} changed`);
    for (const p of plans) out(formatComponentDiff(p));
  }
}

// CSS files the component styles can be in: the entry's styles, else every .css file in the project.
const styleFiles = (root, e) => e.styles || listFilesIn(root, '.css').filter((p) => !p.startsWith('node_modules/'));

function componentsWrite(dir) {
  const { root, config } = project(dir);
  if (!config.components.length) fail('no components in sigma.config.json (skills/sigma-sync/reference/design-to-code.md)');
  const dry = !!flags['dry-run'];
  const report = [];
  for (const { entry: e, base, manifestPath, manifest, plans } of componentPlans(root, config)) {
    const styles = styleFiles(root, e).map((p) => ({ path: p, text: readText(root, p) }));
    const fileFor = (selector, fallback) => {
      const has = (sel) => styles.find((f) => findRule(parseRules(f.text), sel));
      return has(selector) || (fallback && has(fallback)) || styles[0];
    };
    let manifestChanged = false;
    for (const plan of plans) {
      const applied = [];
      for (const edit of plan.css) {
        const f = fileFor(edit.selector, plan.selector);
        if (!f) {
          plan.agent.push(`no CSS file to write ${edit.selector} { ${edit.prop}: ${edit.value} } in: set "styles" in sigma.config.json`);
          continue;
        }
        const r = editRules(f.text, [edit]);
        f.text = r.text;
        f.changed ||= r.applied.length > 0;
        applied.push(...r.applied.map((x) => ({ file: f.path, ...x })));
      }
      for (const c of plan.code) {
        const text = exists(root, c.file) ? readText(root, c.file) : null;
        if (!text || !text.includes(c.find)) {
          plan.agent.push(`${c.why}: couldn’t find ${c.find} in ${c.file}; change it by hand`);
          continue;
        }
        if (!dry) writeText(root, c.file, text.replace(c.find, c.replace));
        applied.push({ file: c.file, before: c.find, after: c.replace });
      }
      // The manifest learns the new variants' selectors and captures, so pages and compare cover them.
      const m = manifest.components.find((c) => c.name === plan.name);
      if (m) {
        for (const [p, vals] of Object.entries(plan.manifest.variants)) {
          m.match ||= { selector: plan.selector };
          m.match.variants ||= {};
          m.match.variants[p] = { ...vals, ...(m.match.variants[p] || {}) };
          manifestChanged = true;
        }
        for (const cap of plan.manifest.captures) {
          if ((m.captures || []).some((x) => JSON.stringify(x.variant) === JSON.stringify(cap.variant))) continue;
          (m.captures ||= []).push(cap);
          manifestChanged = true;
        }
      }
      report.push({ name: plan.name, applied, agent: plan.agent, diff: plan.diff });
    }
    if (!dry) {
      for (const f of styles) if (f.changed) writeText(root, f.path, f.text);
      if (manifestChanged) writeText(root, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    if (json) continue;
    out(`${e.sigma} since ${base}: ${report.length} component${report.length === 1 ? '' : 's'}${dry ? ' (dry run)' : ''}`);
    for (const r of report) {
      out(`  ${r.name}`);
      for (const a of r.applied) {
        if (a.selector) out(`    ${a.file}: ${a.selector} { ${a.prop}: ${a.before ?? '(new)'} → ${a.after ?? '(removed)'} }${a.added ? '  (new rule)' : ''}`);
        else out(`    ${a.file}: ${a.before} → ${a.after}`);
      }
      if (manifestChanged) out(`    ${manifestPath}: new variants and captures added`);
      if (r.agent.length) out('    For you:');
      for (const t of r.agent) out(`      - ${t}`);
    }
  }
  if (json) out(report);
}

// ---------- adapters (Phase 33) ----------
// Prove a project's adapter: it reads what Sigma has, and a change written through it reads back the same, as a
// small diff. Every file is put back afterwards.
async function adapterTest(dir) {
  const { root, config } = project(dir);
  const kinds = flags.kind ? [flags.kind] : ['tokens', 'icons'];
  const entries = kinds.flatMap((k) => (config[k] || []).map((e, index) => ({ kind: k, e: { ...e, index } }))).filter((x) => x.e.adapter);
  if (!entries.length) fail('no entry in sigma.config.json names an adapter ("adapter": ".sigma/adapters/tokens.mjs")');
  let failures = 0;
  for (const { kind, e } of entries) {
    out(`${e.adapter} (${kind}, ${e.sigma})`);
    const check = (ok, line) => {
      out(`  ${ok ? '✓' : '✗'} ${line}`);
      if (!ok) failures++;
      return ok;
    };
    let adapter;
    try {
      adapter = await loadAdapter(root, e.adapter);
    } catch (err) {
      check(false, err.message);
      continue;
    }
    const sigmaFile = readSigma(root, e.sigma);
    if (kind === 'tokens') {
      let collections;
      try {
        ({ collections } = dtcgCollections(await adapter.read(adapterContext(root, e))));
      } catch (err) {
        check(false, `read() failed: ${err.message}`);
        continue;
      }
      const count = collections.reduce((n, c) => n + (c.variables || []).length, 0);
      if (sigmaFile) {
        const { report } = mergeTokenCollections(sigmaFile.collections, collections);
        if (!check(!report.added.length && !report.changed.length, `read() gives what Sigma has: ${count} tokens${report.added.length || report.changed.length ? ` (but ${report.added.length} new and ${report.changed.length} different: ${[...report.added, ...report.changed].slice(0, 5).join(', ')})` : ''}`)) continue;
      } else check(count > 0, `read() gives ${count} tokens (no ${e.sigma} yet: tokens import makes it)`);
      // A round trip: one color and one number changed, written, read back.
      const base = sigmaFile ? sigmaFile.collections : collections;
      const changed = structuredClone(base);
      const picks = [];
      const literal = (x) => x !== undefined && x !== null && !(typeof x === 'object');
      for (const type of ['color', 'number']) {
        for (const c of changed) {
          if (picks.some((p) => p.type === type)) break;
          for (const v of c.variables || []) {
            if (v.type !== type) continue;
            const mode = (c.modes || []).find((m) => literal(v.valuesByMode?.[m.id]));
            if (!mode) continue;
            const old = v.valuesByMode[mode.id];
            v.valuesByMode[mode.id] = type === 'color'
              ? `${old.slice(0, 3)}${((parseInt(old.slice(3, 5), 16) + 0x22) % 256).toString(16).padStart(2, '0').toUpperCase()}${old.slice(5)}`
              : old + 1;
            picks.push({ type, name: v.name, mode: mode.name, before: old, after: v.valuesByMode[mode.id] });
            break;
          }
        }
      }
      if (!check(picks.length > 0, `a change to write: ${picks.map((p) => `${p.name} (${p.mode}) ${JSON.stringify(p.before)} → ${JSON.stringify(p.after)}`).join('; ') || 'no color or number token with a value'}`)) continue;
      const snapshot = new Snapshot(root);
      try {
        await adapter.write(adapterContext(root, e, snapshot), tokenChanges(base, changed, cssOpts(e)));
        const { collections: back } = dtcgCollections(await adapter.read(adapterContext(root, e)));
        const { report } = mergeTokenCollections(changed, back);
        check(!report.added.length && !report.changed.length, `write() then read() gives the change back${report.changed.length ? ` (but ${report.changed.join(', ')} differ)` : ''}`);
        const files = snapshot.changed();
        const lines = files.reduce((n, f) => n + changedLines(f.before, f.after), 0);
        check(files.length > 0 && lines <= picks.length * 2, `the diff is small: ${files.map((f) => `${f.path} ${changedLines(f.before, f.after)} line(s)`).join(', ') || 'nothing written'}`);
      } catch (err) {
        check(false, `write() failed: ${err.message}`);
      } finally {
        snapshot.restore();
      }
    } else {
      let icons;
      try {
        ({ icons } = iconsFromFiles(await adapter.read(adapterContext(root, e))));
      } catch (err) {
        check(false, `read() failed: ${err.message}`);
        continue;
      }
      if (sigmaFile) {
        const { report } = mergeIcons(sigmaFile.icons, icons);
        if (!check(!report.added.length && !report.changed.length, `read() gives what Sigma has: ${icons.length} icons${report.added.length || report.changed.length ? ` (but ${report.added.length} new and ${report.changed.length} different)` : ''}`)) continue;
      } else check(icons.length > 0, `read() gives ${icons.length} icons`);
      const base = sigmaFile ? sigmaFile.icons : icons;
      if (!check(base.length > 0, 'an icon to change')) continue;
      const changed = structuredClone(base);
      changed[0].body = `${changed[0].body}<circle cx="12" cy="12" r="1"/>`;
      const snapshot = new Snapshot(root);
      try {
        await adapter.write(adapterContext(root, e, snapshot), iconChanges(base, changed));
        const { icons: back } = iconsFromFiles(await adapter.read(adapterContext(root, e)));
        const { report } = mergeIcons(changed, back);
        check(!report.added.length && !report.changed.length, `write() then read() gives the change back (${changed[0].group ? `${changed[0].group}/` : ''}${changed[0].name})`);
        const files = snapshot.changed();
        check(files.length === 1, `only that icon's file changed: ${files.map((f) => `${f.path} ${changedLines(f.before, f.after)} line(s)`).join(', ') || 'nothing written'}`);
      } catch (err) {
        check(false, `write() failed: ${err.message}`);
      } finally {
        snapshot.restore();
      }
    }
  }
  out(failures ? `${failures} check${failures === 1 ? '' : 's'} failed: fix the adapter (skills/sigma-sync/reference/adapters.md) and test again.` : 'The adapter works: Sigma will use it for import, write and check.');
  process.exit(failures ? 1 : 0);
}

// ---------- design system use report (Part D, Phase 17) ----------
function report(dir) {
  const root = resolve(dir || '.');
  const files = Object.fromEntries(Object.entries(readProject(root).files).map(([p, t]) => [p, JSON.parse(t)]));
  const resolveFile = (p) => (files[p] ? { fileId: p, file: files[p] } : null);
  const design = Object.entries(files).filter(([, f]) => f.kind === 'design').map(([path, file]) => ({
    name: file.name, path, doc: fromProjectFile(structuredClone(file), { path, resolve: resolveFile }).doc,
    editedAt: statSync(join(root, path)).mtimeMs,
  }));
  if (!design.length) fail('no Sigma Design files in this project');
  const r = useReport(design, { since: flags.days ? Date.now() - Number(flags.days) * 86400000 : null, handoff: !!flags.handoff });
  out(json ? r : formatUseReport(r));
}

// ---------- comments (Phase 27) ----------
const rid = () => Math.random().toString(36).slice(2, 10);
// A layer by id, by name path ("Card / Title") or by name: { node, page, path }.
function findLayer(file, ref) {
  const hits = [];
  for (const pg of file.pages || []) {
    const visit = (nodes, trail) => {
      for (const n of nodes || []) {
        const path = [...trail, n.name].join(' / ');
        if (n.id === ref || path === ref || n.name === ref) hits.push({ node: n, page: pg, path, exact: n.id === ref || path === ref });
        visit(n.children, [...trail, n.name]);
      }
    };
    visit(pg.children, []);
  }
  const exact = hits.filter((h) => h.exact);
  if (exact.length === 1) return exact[0];
  if (hits.length === 1) return hits[0];
  fail(hits.length ? `${ref} matches ${hits.length} layers (${hits.slice(0, 4).map((h) => h.path).join('; ')}); use its id or full path` : `no layer ${ref} in this file`);
}

function designFiles(root) {
  return Object.entries(readProject(root).files).map(([path, text]) => [path, JSON.parse(text)]).filter(([, f]) => f.kind === 'design');
}

function commentList(dir) {
  const root = resolve(dir || '.');
  const all = designFiles(root).flatMap(([path, f]) => (f.comments || []).map((c) => ({ file: path, ...c })));
  const shown = flags.all ? all : all.filter((c) => !c.resolved);
  if (json) return out(shown);
  if (!shown.length) return out(all.length ? 'All comments are resolved (--all lists them).' : 'No comments.');
  for (const c of shown) {
    out(`${c.id}  ${c.resolved ? '[resolved] ' : ''}${c.author} on ${c.layer || 'the page'} (${c.file}): ${c.text}`);
    for (const r of c.replies || []) out(`    ↳ ${r.author}: ${r.text}`);
  }
}

function commentAdd(dir) {
  const root = resolve(dir || '.');
  if (!flags.text) fail('say what the comment says: --text "…"');
  const author = flags.author || 'Agent';
  const now = new Date().toISOString();
  if (flags['reply-to']) {
    for (const [path, f] of designFiles(root)) {
      const c = (f.comments || []).find((x) => x.id === flags['reply-to']);
      if (!c) continue;
      (c.replies ||= []).push({ id: rid(), text: String(flags.text), author, createdAt: now });
      writeText(root, path, formatProjectJSON(f));
      return out(`Replied to ${c.id} in ${path}`);
    }
    fail(`no comment ${flags['reply-to']}`);
  }
  if (!flags.file || !flags.layer) fail('say where: --file <.sigma/design/….sigma.json> --layer <id or name path>');
  const f = JSON.parse(readText(root, flags.file));
  const hit = findLayer(f, String(flags.layer));
  const c = { id: rid(), pageId: hit.page.id, nodeId: hit.node.id, at: { x: 0, y: 0 }, layer: hit.path, text: String(flags.text), author, createdAt: now, replies: [] };
  (f.comments ||= []).push(c);
  writeText(root, flags.file, formatProjectJSON(f));
  out(`Commented on ${hit.path} in ${flags.file} (${c.id})`);
}

function commentResolve(id, dir) {
  const root = resolve(dir || '.');
  for (const [path, f] of designFiles(root)) {
    const c = (f.comments || []).find((x) => x.id === id);
    if (!c) continue;
    c.resolved = true;
    c.resolvedBy = flags.author || 'Agent';
    writeText(root, path, formatProjectJSON(f));
    return out(`Resolved ${id} in ${path}`);
  }
  fail(`no comment ${id}`);
}

// validate + every CSS-sourced token file matches its code (an import would change nothing).
async function checkAll(dir) {
  const { root, config } = project(dir);
  const v = validate([root]);
  const drift = [];
  const failed = [];
  for (const e of config.tokens) {
    const readable = cssSources(e).length || e.adapter || (e.sources || []).some((s) => s.format === 'dtcg');
    if (!readable || !exists(root, e.sigma)) continue;
    let collections;
    try {
      ({ collections } = await importedCollections(root, { ...e, index: config.tokens.indexOf(e) }));
    } catch (err) {
      failed.push(`${e.sigma}: ${e.adapter ? `its adapter (${e.adapter})` : 'its source'} couldn’t be read: ${err.message}`);
      continue;
    }
    const existing = readSigma(root, e.sigma);
    const { report } = mergeTokenCollections(existing.collections, collections);
    if (report.added.length || report.changed.length) drift.push({ sigma: e.sigma, added: report.added, changed: report.changed });
  }
  for (const e of config.icons) {
    if (((e.output || 'svg') !== 'svg' && !e.adapter) || !exists(root, e.sigma)) continue;
    let icons;
    try {
      ({ icons } = await importedIcons(root, e));
    } catch (err) {
      failed.push(`${e.sigma}: ${e.adapter ? `its adapter (${e.adapter})` : 'its folder'} couldn’t be read: ${err.message}`);
      continue;
    }
    const { report } = mergeIcons(readSigma(root, e.sigma).icons, icons);
    if (report.added.length || report.changed.length) drift.push({ sigma: e.sigma, added: report.added, changed: report.changed });
  }
  if (json) out({ errors: v.errors, issues: v.issues, drift, failed });
  else {
    if (v.issues.length) out(formatIssues(v.issues));
    for (const f of failed) out(`error  ${f}`);
    for (const d of drift) out(`drift  ${d.sigma}: the code has ${d.added.length} that Sigma doesn’t and ${d.changed.length} that differ (${[...d.added, ...d.changed].slice(0, 6).join(', ')}${d.added.length + d.changed.length > 6 ? '…' : ''}). Run import, or write if Sigma is right.`);
    out(`${Object.keys(v.files).length} files: ${v.errors} errors, ${v.issues.length - v.errors} warnings, ${drift.length ? `${drift.length} file${drift.length === 1 ? '' : 's'} out of step with the code` : 'tokens and icons match the code'}`);
  }
  process.exit(v.errors || drift.length || failed.length ? 1 : 0);
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
} else if (cmd === 'check') await checkAll(sub);
else if (cmd === 'tokens' && sub === 'import') await tokensImport(dir);
else if (cmd === 'tokens' && sub === 'diff') tokensDiff(dir);
else if (cmd === 'tokens' && sub === 'write') await tokensWrite(dir);
else if (cmd === 'tokens' && sub === 'export') tokensExport(dir);
else if (cmd === 'icons' && sub === 'import') await iconsImport(dir);
else if (cmd === 'icons' && sub === 'diff') iconsDiff(dir);
else if (cmd === 'icons' && sub === 'write') await iconsWrite(dir);
else if (cmd === 'changeset' && sub === 'list') changesetList(dir);
else if (cmd === 'changeset' && sub === 'show') changesetShow(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'apply') changesetApply(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'status') changesetStatus(dir, pos[3], pos[4]);
else if (cmd === 'changeset' && sub === 'branch') changesetBranch(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'prepare') await changesetPrepare(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'pr-body') changesetPRBody(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'ticket') changesetTicket(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'sync') changesetSync(dir);
else if (cmd === 'library' && sub === 'build') libraryBuild(dir);
else if (cmd === 'pages' && sub === 'build') pagesBuild(dir);
else if (cmd === 'components' && sub === 'diff') componentsDiff(dir);
else if (cmd === 'components' && sub === 'write') componentsWrite(dir);
else if (cmd === 'adapter' && sub === 'test') await adapterTest(dir);
else if (cmd === 'report') report(sub);
else if (cmd === 'comment' && sub === 'list') commentList(dir);
else if (cmd === 'comment' && sub === 'add') commentAdd(dir);
else if (cmd === 'comment' && sub === 'resolve') commentResolve(dir, pos[3]);
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
  node tools/sigma.mjs changeset list [project]
  node tools/sigma.mjs changeset show <id> [project]
  node tools/sigma.mjs changeset apply <id> [project] --to DIR [--base REV]
  node tools/sigma.mjs changeset status <id> <status> [project] [--pr URL] [--pr-number N] [--ticket URL] [--branch NAME]
  node tools/sigma.mjs changeset branch <id> [project]
  node tools/sigma.mjs changeset prepare <id> [project] --to DIR
  node tools/sigma.mjs changeset pr-body <id> [project] [--images-base URL]
  node tools/sigma.mjs changeset ticket <id> [project]
  node tools/sigma.mjs changeset sync [project]
  node tools/sigma.mjs library build [project] --from DIR [--library PATH] [--dry-run]
  node tools/sigma.mjs pages build [project] --from DIR [--dry-run]
  node tools/sigma.mjs components diff [project] [--base REV] [--entry N]
  node tools/sigma.mjs components write [project] [--base REV] [--entry N] [--dry-run]
  node tools/sigma.mjs adapter test [project] [--kind tokens|icons]
  node tools/sigma.mjs report [project] [--days N] [--handoff] [--json]
  node tools/sigma.mjs comment list [project] [--all]
  node tools/sigma.mjs comment add [project] --file PATH --layer ID|NAME --text TEXT [--author NAME] [--reply-to ID]
  node tools/sigma.mjs comment resolve <id> [project] [--author NAME]
Add --json for machine-readable output. See skills/sigma-sync/SKILL.md.`);
  process.exit(cmd ? 2 : 0);
}
