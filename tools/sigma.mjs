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
//   node tools/sigma.mjs comment list [project] [--all]
//   node tools/sigma.mjs comment add [project] --file PATH --layer ID|NAME --text TEXT [--author NAME] [--reply-to ID]
//   node tools/sigma.mjs comment resolve <id> [project] [--author NAME]
//
// [project] is the folder with sigma.config.json (default: the current folder). Token commands work on
// the config's "tokens" entries (all of them, or --entry N). --json prints machine-readable output.
import { resolve, basename } from 'node:path';
import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative } from 'node:path';
import { readProject, readText, exists, writeText, gitShow, removeFile, listFilesIn } from './lib/project.mjs';
import { join } from 'node:path';
import { iconsFromFiles, mergeIcons, iconChanges, iconFilePath, iconSVG, sameIcon, svgStyleOf } from '../src/icon-sync.js';
import { parseSVGIcon } from '../src/icon-library.js';
import { applyChanges, summarize, STATUSES, CHANGESET_DIR } from '../src/changesets.js';
import { validateProject } from '../src/validate.js';
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
    else if (argv[i + 1] && !argv[i + 1].startsWith('--') && ['from', 'entry', 'base', 'format', 'to', 'pr', 'pr-number', 'ticket', 'tracker', 'branch', 'images-base', 'file', 'layer', 'text', 'author', 'reply-to'].includes(k)) flags[k] = argv[++i];
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
    if (ch.kind === 'token') {
      const modes = new Set([...Object.keys(ch.before?.valuesByMode || {}), ...Object.keys(ch.after?.valuesByMode || {})]);
      detail = [...modes].filter((m) => show2(ch.before?.valuesByMode?.[m]) !== show2(ch.after?.valuesByMode?.[m]))
        .map((m) => `${modeNames.get(m) || m}: ${show2(ch.before?.valuesByMode?.[m])} → ${show2(ch.after?.valuesByMode?.[m])}`).join(', ');
      if (ch.after?.codeSyntax?.web) detail = `\`${ch.after.codeSyntax.web}\` ${detail}`;
    }
    return `- ${ch.change} ${what}${detail ? ` — ${detail}` : ''}`;
  });
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
function changesetPrepare(id, dir) {
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
  config.tokens.forEach((e, i) => {
    if (!touched.has(e.sigma)) return;
    Object.assign(flags, { entry: String(i), json: false, 'dry-run': false });
    tokensWrite(to);
    code.push(e.sigma);
  });
  config.icons.forEach((e, i) => {
    if (!touched.has(e.sigma)) return;
    Object.assign(flags, { entry: String(i), json: false, 'dry-run': false });
    iconsWrite(to);
    code.push(e.sigma);
  });
  for (const k of Object.keys(flags)) delete flags[k];
  Object.assign(flags, keep);
  out(`Branch files ready in ${to}. Run the project's own checks (tests, lint, build) there before committing.`);
  if (c.changes.some((ch) => ch.kind === 'component' || ch.kind === 'page')) {
    out('Components and pages changed: their code isn’t written by this tool (see skills/sigma-sync/reference/design-to-code.md).');
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
else if (cmd === 'changeset' && sub === 'list') changesetList(dir);
else if (cmd === 'changeset' && sub === 'show') changesetShow(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'apply') changesetApply(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'status') changesetStatus(dir, pos[3], pos[4]);
else if (cmd === 'changeset' && sub === 'branch') changesetBranch(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'prepare') changesetPrepare(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'pr-body') changesetPRBody(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'ticket') changesetTicket(dir, pos[3]);
else if (cmd === 'changeset' && sub === 'sync') changesetSync(dir);
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
  node tools/sigma.mjs comment list [project] [--all]
  node tools/sigma.mjs comment add [project] --file PATH --layer ID|NAME --text TEXT [--author NAME] [--reply-to ID]
  node tools/sigma.mjs comment resolve <id> [project] [--author NAME]
Add --json for machine-readable output. See skills/sigma-sync/SKILL.md.`);
  process.exit(cmd ? 2 : 0);
}
