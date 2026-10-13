// Rules and project skills for the repo's agents (tools/agents.mjs): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgents } from '../agents.mjs';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG = {
  schema: 1,
  tokens: [{ sigma: '.sigma/tokens/app.sigma.json', name: 'App tokens', sources: [{ path: 'src/theme.ts', format: 'ts-theme' }], adapter: '.sigma/adapters/tokens.mjs', modes: { Light: 'light', Dark: 'dark' } }],
  workflow: { git: 'github', tracker: 'github', branch: 'design/{slug}', base: 'main', labels: ['design'] },
};
function project(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-agents-'));
  for (const [p, text] of Object.entries({ 'sigma.config.json': JSON.stringify(CONFIG), 'package.json': '{ "name": "app" }', ...files })) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}
const read = (dir, p) => readFileSync(join(dir, p), 'utf8');

test('agents: no instructions yet → AGENTS.md with the rules, and a CLAUDE.md that includes it; four skills', () => {
  const dir = project();
  const plan = runAgents(dir, { editorRoot });
  assert.deepEqual(plan.map((f) => [f.path, f.action]), [
    ['AGENTS.md', 'create'], ['CLAUDE.md', 'create'],
    ['.claude/skills/sigma-tokens/SKILL.md', 'create'], ['.claude/skills/sigma-components/SKILL.md', 'create'],
    ['.claude/skills/sigma-propose/SKILL.md', 'create'], ['.claude/skills/sigma-design-to-code/SKILL.md', 'create'],
  ]);
  assert.match(read(dir, 'AGENTS.md'), /<!-- sigma-design:start -->\n## Sigma \(design system\)/);
  assert.match(read(dir, 'AGENTS.md'), /`src\/theme\.ts` \(ts-theme\)/);
  assert.match(read(dir, 'AGENTS.md'), /`\.sigma\/adapters\/tokens\.mjs`/);
  assert.equal(read(dir, 'CLAUDE.md'), '@AGENTS.md\n');
  const skill = read(dir, '.claude/skills/sigma-tokens/SKILL.md');
  assert.match(skill, /^---\nname: sigma-tokens\ndescription: app's design tokens/);
  assert.match(skill, /through `\.sigma\/adapters\/tokens\.mjs`/);
  assert.match(skill, /## Project notes/);
  assert.match(read(dir, '.claude/skills/sigma-propose/SKILL.md'), /branches named `design\/\{slug\}`; labels `design`/);
  assert.deepEqual(runAgents(dir, { editorRoot }).filter((f) => f.action !== 'unchanged'), [], 'running it again changes nothing');
  rmSync(dir, { recursive: true, force: true });
});

test('agents: the team’s own instructions and each skill’s notes are kept; only Sigma’s part is replaced', () => {
  const dir = project({ 'CLAUDE.md': '# Our rules\n\nUse pnpm.\n', '.github/copilot-instructions.md': 'Be brief.\n' });
  runAgents(dir, { editorRoot });
  assert.ok(!existsSync(join(dir, 'AGENTS.md')), 'no new instructions file when the repo has some');
  assert.match(read(dir, 'CLAUDE.md'), /^# Our rules\n\nUse pnpm\.\n\n<!-- sigma-design:start -->/);
  assert.match(read(dir, '.github/copilot-instructions.md'), /^Be brief\.\n\n<!-- sigma-design:start -->/);
  const notes = '\nThe theme is in src/theme.ts; brand colors live in palette.brand.\n';
  writeFileSync(join(dir, '.claude/skills/sigma-tokens/SKILL.md'), read(dir, '.claude/skills/sigma-tokens/SKILL.md') + notes);
  writeFileSync(join(dir, 'CLAUDE.md'), `${read(dir, 'CLAUDE.md')}\nAlways run tests.\n`);
  // The setup changes (no adapter any more): Sigma's parts follow, the rest stays.
  writeFileSync(join(dir, 'sigma.config.json'), JSON.stringify({ ...CONFIG, tokens: [{ ...CONFIG.tokens[0], adapter: undefined, sources: [{ path: 'src/tokens.css', format: 'css-variables' }] }] }));
  runAgents(dir, { editorRoot });
  const claude = read(dir, 'CLAUDE.md');
  assert.match(claude, /`src\/tokens\.css` \(css-variables\)/);
  assert.doesNotMatch(claude, /adapters/);
  assert.match(claude, /Use pnpm\.[\s\S]*Always run tests\./);
  assert.equal(claude.split('<!-- sigma-design:start -->').length, 2, 'one Sigma section');
  assert.ok(read(dir, '.claude/skills/sigma-tokens/SKILL.md').endsWith(notes), 'the notes are kept');
  rmSync(dir, { recursive: true, force: true });
});
