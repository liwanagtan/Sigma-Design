// Design-aware merging: git's merge driver for Sigma files (merge-file, merge-driver install). node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { mergeFiles } from '../../src/changesets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS = join(ROOT, 'tools/sigma.mjs');
const TOKENS = '.sigma/tokens/acme.sigma.json';

const valueOf = (file, id) => file.collections.flatMap((c) => c.variables).find((v) => v.id === id).valuesByMode;
const setValue = (file, id, value) => {
  const v = file.collections.flatMap((c) => c.variables).find((x) => x.id === id);
  for (const m of Object.keys(v.valuesByMode)) v.valuesByMode[m] = value;
};

test('merge: their changes go onto ours item by item; the same item changed both ways is a conflict', () => {
  const base = JSON.parse(readFileSync(join(ROOT, 'examples/css-app', TOKENS), 'utf8'));
  const ours = structuredClone(base), theirs = structuredClone(base);
  setValue(ours, 'color-red-700', '#AA0000');
  setValue(theirs, 'color-gray-0', '#FEFEFE');
  let r = mergeFiles(TOKENS, base, ours, theirs);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual([valueOf(r.file, 'color-red-700'), valueOf(r.file, 'color-gray-0')], [{ 'primitives-default': '#AA0000' }, { 'primitives-default': '#FEFEFE' }]);
  setValue(theirs, 'color-red-700', '#BB0000');
  r = mergeFiles(TOKENS, base, ours, theirs);
  assert.deepEqual(r.conflicts.map((c) => [c.kind, c.name]), [['token', 'color/red/700']]);
  assert.equal(valueOf(r.file, 'color-red-700')['primitives-default'], '#AA0000', 'ours kept');
  assert.equal(valueOf(r.file, 'color-gray-0')['primitives-default'], '#FEFEFE', 'the rest merged');
  setValue(theirs, 'color-red-700', '#AA0000');
  assert.deepEqual(mergeFiles(TOKENS, base, ours, theirs).conflicts, [], 'the same change on both sides is no conflict');
});

test('merge: design files merge component by component', () => {
  const LIB = '.sigma/design/acme-library.sigma.json';
  const base = JSON.parse(readFileSync(join(ROOT, 'examples/css-app', LIB), 'utf8'));
  const find = (file, name) => {
    let hit = null;
    const visit = (nodes) => nodes.forEach((n) => (n.name === name && (n.type === 'component' || n.type === 'componentSet') ? (hit ||= n) : visit(n.children || [])));
    for (const p of file.pages) visit(p.children);
    return hit;
  };
  const ours = structuredClone(base), theirs = structuredClone(base);
  find(ours, 'Button').description = 'Ours';
  find(theirs, 'Card').description = 'Theirs';
  const r = mergeFiles(LIB, base, ours, theirs);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual([find(r.file, 'Button').description, find(r.file, 'Card').description], ['Ours', 'Theirs']);
});

test('merge: git merges two branches’ Sigma edits with the driver installed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-merge-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    mkdirSync(join(dir, '.sigma/tokens'), { recursive: true });
    copyFileSync(join(ROOT, 'examples/css-app', TOKENS), join(dir, TOKENS));
    assert.match(execFileSync(process.execPath, [TOOLS, 'merge-driver', 'install', dir], { encoding: 'utf8' }), /merge token by token/);
    assert.equal(readFileSync(join(dir, '.gitattributes'), 'utf8'), '*.sigma.json merge=sigma\n');
    assert.equal(git('config', 'merge.sigma.driver').trim(), 'npx sigma-design merge-file %O %A %B %P');
    git('config', 'merge.sigma.driver', `"${process.execPath}" "${TOOLS}" merge-file %O %A %B %P`); // this checkout, not npx
    git('add', '.');
    git('commit', '-qm', 'base');
    const edit = (branch, id, value) => {
      git('checkout', '-qb', branch, 'main');
      const f = JSON.parse(readFileSync(join(dir, TOKENS), 'utf8'));
      setValue(f, id, value);
      writeFileSync(join(dir, TOKENS), `${JSON.stringify(f, null, 2)}\n`);
      git('commit', '-qam', `${branch}: ${id}`);
    };
    edit('red', 'color-red-700', '#AA0000');
    edit('gray', 'color-gray-0', '#FEFEFE'); // nearby lines: a text merge would likely conflict
    edit('red2', 'color-red-700', '#BB0000');
    git('checkout', '-q', 'red');
    git('merge', '-q', '--no-edit', 'gray');
    const merged = JSON.parse(readFileSync(join(dir, TOKENS), 'utf8'));
    assert.deepEqual([valueOf(merged, 'color-red-700')['primitives-default'], valueOf(merged, 'color-gray-0')['primitives-default']], ['#AA0000', '#FEFEFE']);
    const conflict = spawnSync('git', ['merge', '--no-edit', 'red2'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(conflict.status, 0, 'git stops on the conflict');
    assert.match(conflict.stderr + conflict.stdout, /kept ours for: token color\/red\/700/);
    const kept = JSON.parse(readFileSync(join(dir, TOKENS), 'utf8'));
    assert.equal(valueOf(kept, 'color-red-700')['primitives-default'], '#AA0000', 'the file is valid JSON with ours, no conflict markers');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
