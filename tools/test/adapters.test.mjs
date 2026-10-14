// Project adapters (tools/lib/adapters.mjs, and how tools/sigma.mjs uses them): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'sigma.mjs');
const sigma = (dir, ...args) => spawnSync(process.execPath, [TOOLS, ...args], { cwd: dir, encoding: 'utf8' });
const git = (dir, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, stdio: 'ignore' });

const THEME = `{
  "colors": {
    "brand": "#3b5bff",
    "ink": "#1e1e1e"
  },
  "space": 8
}
`;
// An adapter for theme.json: the kind an agent writes (minimal edits, the file's own color format).
const ADAPTER = `
const t = (type, value, code) => ({ $type: type, $value: value, $extensions: { 'app.sigma': { codeSyntax: { web: code } } } });
export function read(ctx) {
  const theme = JSON.parse(ctx.read('theme.json'));
  return { $metadata: { tokenSetOrder: ['Tokens'] }, Tokens: {
    color: { brand: t('color', theme.colors.brand, 'colors.brand'), ink: t('color', theme.colors.ink, 'colors.ink') },
    space: { unit: t('number', theme.space, 'space') },
  } };
}
export function write(ctx, changes) {
  let text = ctx.read('theme.json');
  for (const c of changes) {
    if (c.change !== 'changed') throw new Error(c.name + ' was ' + c.change + ': add it to theme.json by hand');
    const after = Object.values(c.modes)[0].after;
    const key = c.code.split('.').pop();
    text = text.replace(new RegExp('("' + key + '": )("[^"]*"|\\\\d+)'), (m, k, old) =>
      k + (c.type === 'color' ? JSON.stringify(ctx.sigma.formatColor(after, ctx.sigma.parseColorValue(JSON.parse(old)))) : after));
  }
  ctx.write('theme.json', text);
  return { files: ['theme.json'] };
}
`;

function project(adapter = ADAPTER) {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-adapter-'));
  const put = (p, text) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  };
  put('theme.json', THEME);
  put('.sigma/adapters/tokens.mjs', adapter);
  put('sigma.config.json', JSON.stringify({
    schema: 1, stack: { styling: ['js-theme'], framework: 'none' },
    tokens: [{ sigma: '.sigma/tokens/app.sigma.json', name: 'App tokens', sources: [{ path: 'theme.json', format: 'json' }], naming: 'path', adapter: '.sigma/adapters/tokens.mjs' }],
  }, null, 2));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const r = sigma(dir, 'tokens', 'import', '.');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}
// A designer's change in Sigma: a token's value in the tokens file.
function changeInSigma(dir, name, value) {
  const path = join(dir, '.sigma/tokens/app.sigma.json');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  for (const c of file.collections) for (const v of c.variables) if (v.name === name) v.valuesByMode[Object.keys(v.valuesByMode)[0]] = value;
  writeFileSync(path, JSON.stringify(file, null, 2));
}

test('adapters: import reads through the adapter, and the adapter test passes', () => {
  const dir = project();
  const file = JSON.parse(readFileSync(join(dir, '.sigma/tokens/app.sigma.json'), 'utf8'));
  assert.deepEqual(file.collections.flatMap((c) => c.variables.map((v) => [v.name, v.codeSyntax?.web])), [['color/brand', 'colors.brand'], ['color/ink', 'colors.ink'], ['space/unit', 'space']]);
  const r = sigma(dir, 'adapter', 'test', '.');
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /The adapter works/);
  assert.equal(readFileSync(join(dir, 'theme.json'), 'utf8'), THEME, 'the test puts every file back');
  rmSync(dir, { recursive: true, force: true });
});

test('adapters: a change made in Sigma is written through the adapter as a one-line diff, then checks', () => {
  const dir = project();
  changeInSigma(dir, 'color/brand', '#1F4AE0');
  const r = sigma(dir, 'tokens', 'write', '.');
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /1 change written through \.sigma\/adapters\/tokens\.mjs, and read back the same/);
  assert.equal(readFileSync(join(dir, 'theme.json'), 'utf8'), THEME.replace('#3b5bff', '#1f4ae0'), 'one value, in the file’s own lowercase hex');
  assert.equal(sigma(dir, 'check', '.').status, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('adapters: a write that doesn’t read back the same is put back, and says why', () => {
  const broken = ADAPTER.replace("ctx.write('theme.json', text);", "ctx.write('theme.json', text.replace(/\"ink\": \"[^\"]*\"/, '\"ink\": \"#000000\"'));");
  const dir = project(broken);
  changeInSigma(dir, 'color/brand', '#1F4AE0');
  const r = sigma(dir, 'tokens', 'write', '.');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /not written — after writing, the code still differs from Sigma: color\/ink/);
  assert.equal(readFileSync(join(dir, 'theme.json'), 'utf8'), THEME, 'put back');
  rmSync(dir, { recursive: true, force: true });
});

test('adapters: what the adapter refuses is put back with its message; check sees code changed outside Sigma', () => {
  const dir = project();
  const path = join(dir, '.sigma/tokens/app.sigma.json');
  const file = JSON.parse(readFileSync(path, 'utf8'));
  const c = file.collections[0];
  c.variables.push({ ...structuredClone(c.variables[0]), id: 'new-token', name: 'color/new', codeSyntax: { web: 'colors.new' } });
  writeFileSync(path, JSON.stringify(file, null, 2));
  const r = sigma(dir, 'tokens', 'write', '.');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /the adapter failed: color\/new was added: add it to theme\.json by hand/);
  assert.equal(readFileSync(join(dir, 'theme.json'), 'utf8'), THEME);
  execFileSync('git', ['checkout', '--', '.sigma'], { cwd: dir });
  writeFileSync(join(dir, 'theme.json'), THEME.replace('"space": 8', '"space": 10'));
  const check = sigma(dir, 'check', '.');
  assert.equal(check.status, 1);
  assert.match(check.stdout, /drift .*space\/unit/);
  rmSync(dir, { recursive: true, force: true });
});

test('DTCG without sets: tokens keep their code names (top-level keys are groups)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-dtcg-'));
  writeFileSync(join(dir, 'tokens.json'), JSON.stringify({ color: { brand: { $type: 'color', $value: '#3b5bff', $extensions: { 'app.sigma': { codeSyntax: { web: '--brand' } } } } } }));
  writeFileSync(join(dir, 'sigma.config.json'), JSON.stringify({ schema: 1, tokens: [{ sigma: '.sigma/tokens/t.sigma.json', name: 'T', sources: [{ path: 'tokens.json', format: 'dtcg' }] }] }));
  assert.equal(sigma(dir, 'tokens', 'import', '.').status, 0);
  const file = JSON.parse(readFileSync(join(dir, '.sigma/tokens/t.sigma.json'), 'utf8'));
  assert.deepEqual(file.collections[0].variables.map((v) => [v.name, v.codeSyntax?.web]), [['color/brand', '--brand']]);
  rmSync(dir, { recursive: true, force: true });
});
