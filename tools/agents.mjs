// sigma-design agents (Part F, Phase 33): teach the project's coding agents about Sigma. Writes
//   - rules: a marked Sigma section in the repo's agent instructions (AGENTS.md, CLAUDE.md,
//     .github/copilot-instructions.md, .cursor/rules/sigma.mdc: those it has; AGENTS.md, and a CLAUDE.md
//     that includes it, when it has none)
//   - project skills: .claude/skills/sigma-tokens, sigma-components, sigma-propose, sigma-design-to-code
// Everything comes from sigma.config.json (the values stay there; the text points to them) and points to the
// general skill in the package. Only Sigma's marked parts are rewritten: what's outside them (the team's own
// rules, each skill's "Project notes") is kept.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';

const START = '<!-- sigma-design:start -->';
const END = '<!-- sigma-design:end -->';
const toPosix = (p) => p.split(sep).join('/');
const read = (root, p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null);
const list = (xs) => xs.filter((x) => x !== null && x !== undefined && x !== false).join('\n'); // '' is a blank line

// Where the general skill is, as the project sees it (node_modules/sigma-design/… when installed).
function guidePath(root, editorRoot) {
  const rel = toPosix(relative(root, join(editorRoot, 'skills', 'sigma-sync')));
  return rel.startsWith('../../..') ? toPosix(join(editorRoot, 'skills', 'sigma-sync')) : rel;
}

function facts(config) {
  const tokens = (config.tokens || []).map((e) => ({
    sigma: e.sigma, adapter: e.adapter, sources: (e.sources || []).map((s) => `\`${s.path}\` (${s.format})`).join(', '),
    modes: e.modes ? Object.keys(e.modes).join(', ') : null,
  }));
  const icons = (config.icons || []).map((e) => ({ sigma: e.sigma, adapter: e.adapter, source: e.source, output: e.output || 'svg' }));
  return { tokens, icons, components: config.components || [], pages: config.pages || [], workflow: config.workflow || {} };
}

/** The rules section (between the markers). */
export function rulesBlock(config, { guide }) {
  const f = facts(config);
  const tokenSources = f.tokens.map((t) => t.sources).filter(Boolean).join('; ');
  const iconSources = f.icons.map((i) => `\`${i.source}\``).join(', ');
  const adapters = [...f.tokens, ...f.icons].filter((x) => x.adapter).map((x) => `\`${x.adapter}\``);
  return list([
    START,
    '## Sigma (design system)',
    '',
    'This project\'s design system is also in [Sigma](https://www.npmjs.com/package/sigma-design): `.sigma/` holds its Sigma',
    'files and `sigma.config.json` says how they map to the code. Designers change tokens, icons and components',
    'in Sigma (`npm run sigma`); the code follows.',
    '',
    !(tokenSources || iconSources) ? null : `- **Code is the truth for design tokens${iconSources ? ' and icons' : ''}** (${[tokenSources, iconSources].filter(Boolean).join('; ')}). While Sigma runs (\`npm run sigma\`) it follows them by itself; otherwise, after changing them, run \`npx sigma-design tokens import\`${iconSources ? ' / `icons import`' : ''}. Either way, \`npx sigma-design check\` must pass.`,
    '- **Never edit `.sigma/**/*.sigma.json` by hand:** use the `sigma-design` commands, which keep ids and diffs small.',
    !adapters.length ? null : `- **Adapters** (${adapters.join(', ')}) are how Sigma reads and writes this project's code. If you change how that code is written, update the adapter and run \`npx sigma-design adapter test\`.`,
    f.components.length
      ? '- **Components:** when you add or change one, keep the components page and `.sigma/captures/manifest.json` up to date (the `sigma-components` skill).'
      : '- **Components** aren\'t in Sigma yet: the `sigma-components` skill says how to bring them in.',
    '- **Proposals** from designers are in `.sigma/changesets/`: turn one into a ticket and a pull request with the `sigma-propose` skill, and write component changes with `sigma-design-to-code`.',
    `- Skills: \`sigma-tokens\`, \`sigma-components\`, \`sigma-propose\`, \`sigma-design-to-code\` (\`.claude/skills/\`). The full guide: \`${guide}/SKILL.md\`.`,
    END,
  ]);
}

const projectNotes = (hint) => `

## Project notes

<!-- Kept when setup runs again. ${hint} -->
`;

/** The project skills: [{ name, description, body, notesHint }]. */
export function skills(config, { guide, name }) {
  const f = facts(config);
  const w = f.workflow;
  const tokenLines = f.tokens.map((t) => `- **${t.sigma}**: from ${t.sources}${t.modes ? `; modes ${t.modes}` : ''}${t.adapter ? `; through \`${t.adapter}\`` : ' (read and written by Sigma itself)'}.`);
  const iconLines = f.icons.map((i) => `- **${i.sigma}**: from \`${i.source}\` (${i.output})${i.adapter ? `; through \`${i.adapter}\`` : ''}.`);
  return [
    {
      name: 'sigma-tokens',
      description: `${name}'s design tokens and icons in Sigma: where they are, how they sync, and what to do when they don't. Use when changing design tokens or icons (in code or in Sigma), or when sigma-design check reports drift.`,
      body: list([
        `# Tokens and icons in Sigma (${name})`,
        '',
        ...(tokenLines.length ? tokenLines : ['- No token source is set up yet: set one up with the guide (section 1).']),
        ...iconLines,
        '',
        '- **While Sigma runs** (`npm run sigma`), live sync does both directions: code edits are imported within a second, and a save in Sigma writes the code.',
        '- **Code → Sigma** (Sigma not running): `npx sigma-design tokens import` (and `icons import`), then `npx sigma-design check`.',
        `- **Sigma → code:** \`npx sigma-design tokens diff\` shows what designers changed; \`npx sigma-design tokens write\` (and \`icons write\`) writes it${[...f.tokens, ...f.icons].some((x) => x.adapter) ? ', through the adapter, checking every write by reading it back' : ''}.`,
        ![...f.tokens, ...f.icons].some((x) => x.adapter) ? null : '- **When an adapter fails** (a write is put back, or `check` can\'t read the code): fix the adapter, run `npx sigma-design adapter test` until it passes, then write again.',
        '',
        `Guide: \`${guide}/SKILL.md\` (sections 2–4), \`${guide}/reference/tokens.md\`, \`icons.md\`, \`adapters.md\`.`,
      ]),
      notesHint: 'Write what an agent needs that sigma.config.json doesn’t say: naming rules, which theme values aren’t tokens, anything the adapter can’t do.',
    },
    {
      name: 'sigma-components',
      description: `${name}'s components in Sigma: how they're rendered for capture, how variants map to props, and how to keep the library in step. Use when adding or changing a component, or bringing components or pages into Sigma.`,
      body: list([
        `# Components in Sigma (${name})`,
        '',
        f.components.length
          ? list(f.components.map((c) => `- **${c.sigma}**: from \`${c.source}\`; captures described in \`${c.manifest || '.sigma/captures/manifest.json'}\`${c.styles ? `; styles in ${c.styles.map((s) => `\`${s}\``).join(', ')}` : ''}${c.page ? `; components page \`${c.page}\` (it loads \`sigma-design/bridge\`)` : ''}.`))
          : '- Not set up yet: bring the components in with the guide (`reference/components.md`), then run `npx sigma-design agents` to update this skill.',
        '',
        '**Adding or changing a component:** render it on the components page (every variant and state, each with the',
        'id its manifest entry names as `element`), add it to the manifest (with its `match` rule), then in Sigma open the',
        'library and use **Check against code…** (it captures, compares, and can update the library from the code).',
        'Saving a library in Sigma writes the exact part of the code itself; finish what it lists, then check again.',
        '',
        `Guide: \`${guide}/reference/components.md\`, \`pages.md\`.`,
      ]),
      notesHint: 'Write where components live, how they’re styled, how variants and states map to props, and how the components page renders them.',
    },
    {
      name: 'sigma-propose',
      description: `Turn a design change proposed in Sigma (.sigma/changesets/) into a ticket and a pull request the way ${name}'s team works. Use when asked to send, ship or open a PR for a Sigma proposal, or to sync proposal statuses.`,
      body: list([
        `# Proposals → tickets and pull requests (${name})`,
        '',
        `- Git: ${w.git || 'github'}; base branch \`${w.base || 'main'}\`; branches named \`${w.branch || 'design/{slug}'}\`${w.labels?.length ? `; labels ${w.labels.map((l) => `\`${l}\``).join(', ')}` : ''}.`,
        `- Tracker: ${w.tracker || 'none'}${w.prTemplate ? `; PR template \`${w.prTemplate}\`` : ''}.`,
        '',
        '`npx sigma-design changeset list`, then follow the guide: branch in a worktree, `changeset prepare`, the',
        'project\'s own checks, a draft pull request with `changeset pr-body`, and `changeset sync` for statuses.',
        'Only open pull requests or tickets when the person asked.',
        '',
        `Guide: \`${guide}/reference/workflow.md\`.`,
      ]),
      notesHint: 'Write this team’s conventions: commit message format, who reviews design PRs, which checks must pass, ticket fields.',
    },
    {
      name: 'sigma-design-to-code',
      description: `Write a component change made in Sigma into ${name}'s code: the exact part Sigma writes, the rest by hand, then prove it matches. Use when a proposal or the library changes components.`,
      body: list([
        `# Design changes to components → code (${name})`,
        '',
        '`npx sigma-design components diff` shows the design diff and the plan; `npx sigma-design components write` (also',
        'run by `changeset prepare`) writes the exact CSS and code edits and lists the rest. Do the rest in the code\'s',
        'own conventions, recapture, and compare: every component must match before you commit.',
        '',
        `Guide: \`${guide}/reference/design-to-code.md\`.`,
      ]),
      notesHint: 'Write this project’s conventions for component changes: where variant classes or props are defined, naming, tests to update.',
    },
  ];
}

// A file with Sigma's marked part put in (replacing the old one), or appended; the rest kept.
function withBlock(text, block) {
  if (text === null) return `${block}\n`;
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + END.length);
  return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
}

/**
 * What `agents` would write: [{ path, text, action: 'create' | 'update' | 'unchanged' }].
 *   editorRoot: where the sigma-design package is (for the guide's path)
 */
export function planAgents(root, { editorRoot, config = null } = {}) {
  config ||= JSON.parse(read(root, 'sigma.config.json') || 'null');
  if (!config) throw new Error('no sigma.config.json: run sigma-design init first');
  let name = 'this project';
  try {
    name = JSON.parse(read(root, 'package.json') || '{}').name || root.split(sep).pop();
  } catch {
    name = root.split(sep).pop();
  }
  const guide = guidePath(root, editorRoot);
  const block = rulesBlock(config, { guide });
  const out = [];
  const put = (path, text) => {
    const before = read(root, path);
    out.push({ path, text, action: before === null ? 'create' : before === text ? 'unchanged' : 'update' });
  };

  // Rules: in each instructions file the repo has; AGENTS.md (and a CLAUDE.md including it) if none.
  let files = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md'].filter((p) => read(root, p) !== null);
  // A file that includes AGENTS.md (CLAUDE.md with "@AGENTS.md") gets the rules from it: not twice.
  if (files.includes('AGENTS.md')) files = files.filter((p) => p === 'AGENTS.md' || !/^@AGENTS\.md\s*$/m.test(read(root, p)));
  const cursor = existsSync(join(root, '.cursor')) && statSync(join(root, '.cursor')).isDirectory();
  for (const p of files) put(p, withBlock(read(root, p), block));
  if (cursor) put('.cursor/rules/sigma.mdc', `---\ndescription: Sigma, this project's design system tool\nalwaysApply: true\n---\n${withBlock(null, block)}`);
  if (!files.length && !cursor) {
    put('AGENTS.md', withBlock(`# Agent instructions\n`, block));
    put('CLAUDE.md', '@AGENTS.md\n');
  }

  // Project skills: frontmatter and Sigma's part regenerated; "Project notes" kept.
  for (const s of skills(config, { guide, name })) {
    const path = `.claude/skills/${s.name}/SKILL.md`;
    const before = read(root, path);
    const rest = before && before.indexOf(END) >= 0 ? before.slice(before.indexOf(END) + END.length) : projectNotes(s.notesHint);
    put(path, `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${START}\n${s.body}\n${END}${rest}`);
  }
  return out;
}

export function runAgents(root, options = {}) {
  const plan = planAgents(root, options);
  if (!options.dryRun) {
    for (const f of plan) {
      if (f.action === 'unchanged') continue;
      mkdirSync(dirname(join(root, f.path)), { recursive: true });
      writeFileSync(join(root, f.path), f.text);
    }
  }
  return plan;
}
