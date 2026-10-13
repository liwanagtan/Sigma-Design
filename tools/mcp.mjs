// Sigma's MCP server: the sync steps the sigma-sync skill repeats, as tools, for agents without a terminal
// (or that would rather call tools). `npx sigma-design mcp [project]` speaks MCP over stdio (JSON-RPC, one
// message per line). Every tool runs the same command as `npx sigma-design …`, so a tool and the command line
// never disagree; writes are the same as the commands' and keep their --dry-run.
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(here, 'sigma.mjs');
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
const PROTOCOL = '2025-06-18';

const str = (description) => ({ type: 'string', description });
const bool = (description) => ({ type: 'boolean', description });
const num = (description) => ({ type: 'number', description });
const DRY = { dry_run: bool('Only say what would change; write nothing.') };
const ENTRY = { entry: num('Which entry of sigma.config.json (tokens or icons), from 0. Default: all.') };
const ID = { id: str('The changeset id (any unique part of it).') };

// name → { description, args (the command, from the tool's input), properties, required, readOnly }
const TOOLS_LIST = {
  sigma_check: {
    description: 'Check the project: Sigma files are valid, and tokens and icons match the code. Run it after any change.',
    args: () => ['check', '{project}', '--json'], readOnly: true,
  },
  sigma_tokens_diff: {
    description: 'What differs between the Sigma tokens and the code (since a git revision with base).',
    properties: { base: str('A git revision to compare against, like HEAD.'), ...ENTRY },
    args: (a) => ['tokens', 'diff', '{project}', ...opt('--base', a.base), ...opt('--entry', a.entry)], readOnly: true,
  },
  sigma_tokens_import: {
    description: 'Read the tokens from the code into Sigma (code → Sigma).',
    properties: { ...ENTRY, ...DRY, prune: bool('Also remove Sigma tokens the code no longer has.') },
    args: (a) => ['tokens', 'import', '{project}', ...opt('--entry', a.entry), ...flag('--dry-run', a.dry_run), ...flag('--prune', a.prune)],
  },
  sigma_tokens_write: {
    description: 'Write Sigma’s token changes into the code as minimal edits (Sigma → code).',
    properties: { base: str('A git revision: write only what changed since it.'), ...ENTRY, ...DRY },
    args: (a) => ['tokens', 'write', '{project}', ...opt('--base', a.base), ...opt('--entry', a.entry), ...flag('--dry-run', a.dry_run)],
  },
  sigma_icons_diff: {
    description: 'What differs between the Sigma icons and the code’s icons.',
    properties: { base: str('A git revision to compare against.'), ...ENTRY },
    args: (a) => ['icons', 'diff', '{project}', ...opt('--base', a.base), ...opt('--entry', a.entry)], readOnly: true,
  },
  sigma_icons_import: {
    description: 'Read the icons from the code into Sigma (code → Sigma).',
    properties: { ...ENTRY, ...DRY, prune: bool('Also remove Sigma icons the code no longer has.') },
    args: (a) => ['icons', 'import', '{project}', ...opt('--entry', a.entry), ...flag('--dry-run', a.dry_run), ...flag('--prune', a.prune)],
  },
  sigma_icons_write: {
    description: 'Write Sigma’s icon changes into the code (Sigma → code).',
    properties: { base: str('A git revision: write only what changed since it.'), ...ENTRY, ...DRY },
    args: (a) => ['icons', 'write', '{project}', ...opt('--base', a.base), ...opt('--entry', a.entry), ...flag('--dry-run', a.dry_run)],
  },
  sigma_components_diff: {
    description: 'What changed in the component libraries, as CSS and code changes to make (design to code).',
    properties: { base: str('A git revision to compare against, like HEAD.'), ...ENTRY },
    args: (a) => ['components', 'diff', '{project}', ...opt('--base', a.base), ...opt('--entry', a.entry)], readOnly: true,
  },
  sigma_report: {
    description: 'The design system use report: how much of the design uses library components and tokens, most-used and unused ones.',
    properties: { days: num('Only files edited in the last N days.'), handoff: bool('Only pages marked for handoff.') },
    args: (a) => ['report', '{project}', '--json', ...opt('--days', a.days), ...flag('--handoff', a.handoff)], readOnly: true,
  },
  sigma_changelog: {
    description: 'What’s new in the component libraries (or one Sigma file), as Markdown, from the proposals that changed them.',
    properties: { file: str('A Sigma file path, like .sigma/tokens/core.sigma.json.') },
    args: (a) => ['changelog', '{project}', ...opt('--file', a.file)], readOnly: true,
  },
  sigma_changeset_list: {
    description: 'The designers’ proposals (changesets), with their status, ticket and pull request.',
    args: () => ['changeset', 'list', '{project}', '--json'], readOnly: true,
  },
  sigma_changeset_show: {
    description: 'One proposal: what it changes.', properties: ID, required: ['id'],
    args: (a) => ['changeset', 'show', a.id, '{project}', '--json'], readOnly: true,
  },
  sigma_changeset_pr_body: {
    description: 'A proposal’s pull request body (Markdown): what changed, before and after pictures, accessibility, comments.',
    properties: { ...ID, images_base: str('A URL the pictures are served from (the branch on the Git host).') }, required: ['id'],
    args: (a) => ['changeset', 'pr-body', a.id, '{project}', ...opt('--images-base', a.images_base)], readOnly: true,
  },
  sigma_changeset_ticket: {
    description: 'A proposal’s ticket: title and body.', properties: ID, required: ['id'],
    args: (a) => ['changeset', 'ticket', a.id, '{project}', '--json'], readOnly: true,
  },
  sigma_changeset_status: {
    description: 'Record a proposal’s status, ticket, branch or pull request.',
    properties: {
      ...ID, status: { type: 'string', enum: ['draft', 'proposed', 'in-review', 'changes-requested', 'merged', 'closed'] },
      pr: str('The pull request URL.'), pr_number: num('Its number.'), ticket: str('The ticket URL.'), tracker: str('notion, github, gitlab, linear or jira.'), branch: str('The branch name.'),
    },
    required: ['id', 'status'],
    args: (a) => ['changeset', 'status', a.id, a.status, '{project}', ...opt('--pr', a.pr), ...opt('--pr-number', a.pr_number), ...opt('--ticket', a.ticket), ...opt('--tracker', a.tracker), ...opt('--branch', a.branch)],
  },
  sigma_changeset_sync: {
    description: 'Update open proposals’ statuses from their pull requests (GitHub, GitLab, Azure DevOps or Bitbucket).',
    args: () => ['changeset', 'sync', '{project}', '--json'],
  },
  sigma_comment_list: {
    description: 'Comments on the designs (open ones, or all).', properties: { all: bool('Include resolved comments.') },
    args: (a) => ['comment', 'list', '{project}', '--json', ...flag('--all', a.all)], readOnly: true,
  },
  sigma_comment_add: {
    description: 'Comment on a layer of a design file, or reply to a comment.',
    properties: { file: str('The Sigma file path.'), layer: str('The layer id or name.'), text: str('The comment.'), author: str('Who it’s from.'), reply_to: str('A comment id to reply to.') },
    required: ['file', 'text'],
    args: (a) => ['comment', 'add', '{project}', '--file', a.file, ...opt('--layer', a.layer), '--text', a.text, ...opt('--author', a.author), ...opt('--reply-to', a.reply_to)],
  },
};
function opt(name, v) {
  return v === undefined || v === null || v === '' ? [] : [name, String(v)];
}
function flag(name, on) {
  return on ? [name] : [];
}

/** Run one tool: { text, isError }. */
export function callTool(project, name, input = {}) {
  const t = TOOLS_LIST[name];
  if (!t) return { text: `No tool ${name}.`, isError: true };
  for (const k of t.required || []) if (input[k] === undefined || input[k] === '') return { text: `${name} needs ${k}.`, isError: true };
  const args = t.args(input).map((a) => (a === '{project}' ? project : a));
  const r = spawnSync(process.execPath, [TOOLS, ...args], { cwd: project, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const text = [r.stdout, r.stderr].filter((x) => x && x.trim()).join('\n').trim() || (r.status ? `Failed (exit ${r.status}).` : 'Done.');
  return { text, isError: r.status !== 0 };
}

export const toolList = () => Object.entries(TOOLS_LIST).map(([name, t]) => ({
  name, description: t.description,
  inputSchema: { type: 'object', properties: t.properties || {}, ...(t.required ? { required: t.required } : {}) },
  annotations: { readOnlyHint: !!t.readOnly },
}));

/** Answer one JSON-RPC message (null for a notification). */
export function handle(project, msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  const error = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null; // notifications (initialized, cancelled) need no answer
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: msg.params?.protocolVersion || PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'sigma-design', version: pkg.version },
        instructions: `Sigma's sync tools for the project in ${project}: tokens, icons and components between Sigma and the code, proposals (changesets), comments and reports. Run sigma_check after changes. The steps are in skills/sigma-sync/SKILL.md.`,
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: toolList() });
    case 'tools/call': {
      const { text, isError } = callTool(project, msg.params?.name, msg.params?.arguments || {});
      return reply({ content: [{ type: 'text', text }], isError });
    }
    default:
      return error(-32601, `Method not found: ${msg.method}`);
  }
}

/** Serve MCP over stdio for `project`. */
export function serveMCP(project) {
  project = resolve(project);
  const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    const out = handle(project, msg);
    if (out) send(out);
  });
}
