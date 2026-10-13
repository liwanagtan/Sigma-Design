#!/usr/bin/env node
// sigma-design: Sigma, installed in a project (Part F, Phase 32).
//
//   npx sigma-design init [dir] [--dry-run]                  set Sigma up in a project (once)
//   npx sigma-design dev [dir] [--port N] [--no-open] [--no-sync]   Sigma on this project (npm run sigma), with
//                                                             live sync: the code and Sigma follow each other
//   npx sigma-design standalone [--port N] [--no-open]        Sigma on its own: a design tool, files in the browser
//   npx sigma-design agents [dir] [--dry-run]                 rules and project skills for the repo's coding agents
//   npx sigma-design <command> …                              the sync tools: check, tokens, icons, changeset,
//                                                             library, pages, components, comment (tools/sigma.mjs)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer, EDITOR_ROOT } from '../tools/server.mjs';
import { runInit, isSetUp } from '../tools/init.mjs';
import { runAgents } from '../tools/agents.mjs';
import { startLiveSync, tools as runTools } from '../tools/live-sync.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
const TOOLS = join(here, '..', 'tools', 'sigma.mjs');
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : null;
};
const positional = () => argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && ['--port'].includes(all[i - 1])));
const fail = (msg) => {
  console.error(`sigma-design: ${msg}`);
  process.exit(1);
};
// The sync tools, as a child process sharing this terminal.
const tools = (args, cwd) => spawnSync(process.execPath, [TOOLS, ...args], { cwd, stdio: 'inherit' }).status;

function openBrowser(url) {
  const [bin, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    spawn(bin, args, { stdio: 'ignore', detached: true }).unref();
  } catch {}
}

async function serve({ project }) {
  const port = Number(value('port') || 6200);
  if (!Number.isInteger(port) || port <= 0) fail('--port should be a number');
  const log = (line) => console.log(`  ${new Date().toLocaleTimeString()}  ${line}`);
  // In a project, the code and Sigma follow each other while it runs (--no-sync to turn that off).
  const sync = project && !flag('no-sync') ? startLiveSync({ root: project, log }) : null;
  const { url } = await startServer({ port, strictPort: !!value('port'), project, log, afterSave: sync?.afterSave, actions: project ? projectActions(project) : {} });
  console.log(`Sigma ${pkg.version} running at ${url}${project ? `  (project: ${project}${sync ? ', live sync on' : ''})` : '  (standalone)'}`);
  console.log('Ctrl+C to stop.');
  if (!flag('no-open')) openBrowser(url);
}

// What Sigma's GUI can run in the project (POST /api/project/action): building from the captures it made.
function projectActions(project) {
  const capturesDir = () => {
    let c = null;
    try {
      c = JSON.parse(readFileSync(join(project, 'sigma.config.json'), 'utf8'));
    } catch {}
    const manifest = c?.components?.[0]?.manifest || '.sigma/captures/manifest.json';
    return dirname(join(project, manifest));
  };
  const run = async (args) => {
    const r = await runTools(args, project);
    return { ok: r.status === 0, result: r.result, output: r.result ? undefined : r.output };
  };
  return {
    'library-build': () => run(['library', 'build', project, '--from', capturesDir()]),
    'pages-build': () => run(['pages', 'build', project, '--from', capturesDir()]),
  };
}

// Write (or show) the rules and project skills; prints what it did.
function agents(dir, { dry = false } = {}) {
  const plan = runAgents(dir, { editorRoot: EDITOR_ROOT, dryRun: dry });
  const changed = plan.filter((f) => f.action !== 'unchanged');
  console.log(`Rules and skills for coding agents${dry ? ' (dry run: nothing written)' : ''}: ${changed.length ? '' : 'up to date'}`);
  for (const f of changed) console.log(`  ${dry ? `would ${f.action}` : `${f.action}d`.replace('created', 'created').replace('updated', 'updated')} ${f.path}`);
  if (dry && changed.length) {
    const rules = changed.find((f) => !f.path.includes('/skills/') && f.text.includes('sigma-design:start'));
    if (rules) console.log(`
The Sigma section (in ${rules.path}):
${rules.text.slice(rules.text.indexOf('<!-- sigma-design:start -->'))}`);
  }
}

function help() {
  console.log(`sigma-design ${pkg.version}: Sigma, the design tool, inside your project.

  npx sigma-design init [dir] [--dry-run]            set Sigma up in a project (finds its tokens and icons)
  npx sigma-design dev [dir] [--port N] [--no-open]  open Sigma on the project (npm run sigma)
  npx sigma-design standalone [--port N]             Sigma on its own, with files in the browser
  npx sigma-design agents [dir] [--dry-run]          rules and project skills for the repo's coding agents
  npx sigma-design adapter test [dir]                prove the project's adapters (reference/adapters.md)
  npx sigma-design report [dir] [--days N] [--handoff]  how much of the design comes from the design system
  npx sigma-design changelog [dir] [--file PATH]      what's new in the component libraries, as Markdown
  npx sigma-design check [dir]                       Sigma files are valid, and tokens and icons match the code
  npx sigma-design mcp [dir]                         the sync tools as an MCP server (stdio), for agents
  npx sigma-design merge-driver install [dir]        git merges Sigma files token by token, component by component

Sync tools (for people and agents; see skills/sigma-sync/SKILL.md):
  tokens import|diff|write|export, icons import|diff|write, changeset …, library build, pages build,
  components diff|write, comment list|add|resolve, validate. Run one with no arguments for its help.

Agents: the setup and sync instructions are in ${relative(process.cwd(), join(here, '..', 'skills', 'sigma-sync', 'SKILL.md'))}`);
}

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') help();
else if (cmd === '--version' || cmd === '-v' || cmd === 'version') console.log(pkg.version);
else if (cmd === 'standalone') await serve({ project: null });
else if (cmd === 'mcp') {
  // An MCP server over stdio: nothing else may go to stdout.
  const dir = resolve(positional()[0] || '.');
  if (!existsSync(join(dir, 'sigma.config.json'))) fail(`no sigma.config.json in ${dir}: run npx sigma-design init first`);
  (await import('../tools/mcp.mjs')).serveMCP(dir);
}
else if (cmd === 'agents') {
  const dir = resolve(positional()[0] || '.');
  if (!existsSync(join(dir, 'sigma.config.json'))) fail(`no sigma.config.json in ${dir}: run npx sigma-design init first`);
  agents(dir, { dry: flag('dry-run') });
}
else if (cmd === 'dev') {
  const dir = resolve(positional()[0] || '.');
  if (!existsSync(dir)) fail(`no such folder: ${dir}`);
  if (!isSetUp(dir)) fail(`Sigma isn't set up in ${dir} yet: run npx sigma-design init there first`);
  await serve({ project: dir });
} else if (cmd === 'init') {
  const dir = resolve(positional()[0] || '.');
  if (!existsSync(dir)) fail(`no such folder: ${dir}`);
  const dry = flag('dry-run');
  const already = existsSync(join(dir, 'sigma.config.json'));
  let plan;
  try {
    plan = runInit(dir, { version: pkg.version, dryRun: dry });
  } catch (err) {
    fail(err.message);
  }
  console.log(`Sigma in ${dir}${dry ? ' (dry run: nothing written)' : ''}`);
  if (already) console.log('  sigma.config.json is already there: it was left as it is.');
  for (const line of plan.found) console.log(`  ${line}`);
  if (plan.config && !dry) console.log('  wrote sigma.config.json');
  for (const line of plan.notes) console.log(`  ${dry ? line.replace(/^package\.json: added/, 'package.json: would add') : line}`);
  if (!dry && plan.config) {
    // Import what Sigma reads by itself, then check.
    if (plan.config.tokens?.length) tools(['tokens', 'import', dir], dir);
    if (plan.config.icons?.length) tools(['icons', 'import', dir], dir);
  }
  if (!dry && existsSync(join(dir, 'sigma.config.json'))) {
    tools(['check', dir], dir);
    agents(dir);
  }
  if (plan.forAgent.length) {
    console.log('\nFor your coding agent:');
    for (const line of plan.forAgent) console.log(`  - ${line}`);
    const skill = join(EDITOR_ROOT, 'skills', 'sigma-sync', 'SKILL.md');
    const rel = relative(dir, skill);
    console.log(`  The skill: ${rel.startsWith('..') ? skill : rel}`);
  }
  if (!dry) console.log(`\nNext: ${plan.addedDependency ? 'install (npm install), then ' : ''}${existsSync(join(dir, 'package.json')) ? 'npm run sigma' : 'npx sigma-design dev'}`);
} else {
  // Everything else is the sync tools' command line.
  process.exit(tools(argv, process.cwd()) ?? 1);
}
