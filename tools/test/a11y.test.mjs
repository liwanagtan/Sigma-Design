// Accessibility in design pull requests (Phase 16): node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { issuesMarkdown } from '../../src/a11y-kinds.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS = join(ROOT, 'tools/sigma.mjs');

const issue = (over) => ({ kind: 'contrast', severity: 'error', name: 'Label in Button', frame: 'Settings — Mobile', message: '3.78:1 against #EF4343; needs 4.5:1', group: 'contrast:label', ...over });

test('a11y: issues read as Markdown, errors first, copies of one issue once', () => {
  const lines = issuesMarkdown([
    issue({ kind: 'target', severity: 'warning', name: 'Button', message: 'Button is 87×32; under 44×44', group: 'target:button' }),
    issue(), issue(),
  ]);
  assert.deepEqual(lines, [
    '- ❌ **Text contrast**: _Label in Button_ in Settings — Mobile: 3.78:1 against #EF4343; needs 4.5:1 (×2)',
    '- ⚠️ **Tap targets**: _Button_ in Settings — Mobile: Button is 87×32; under 44×44',
  ]);
});

test('a11y: a changeset’s accessibility check goes into its pull request body', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-a11y-'));
  try {
    execFileSync('cp', ['-R', `${join(ROOT, 'examples/css-app')}/.`, dir]);
    const write = (id, accessibility) => {
      const cs = {
        id, title: 'Settings tweaks', note: '', author: '', createdAt: '2026-10-13T09:00:00.000Z', status: 'proposed', base: 'HEAD',
        changes: [{ key: 'k', file: '.sigma/design/acme-pages.sigma.json', kind: 'page', id: 'settings', name: 'Settings', change: 'changed', before: {}, after: {} }],
        renders: {}, accessibility,
      };
      mkdirSync(join(dir, '.sigma/changesets'), { recursive: true });
      writeFileSync(join(dir, `.sigma/changesets/${id}.json`), JSON.stringify(cs));
      return execFileSync(process.execPath, [TOOLS, 'changeset', 'pr-body', id, dir], { encoding: 'utf8' });
    };
    const body = write('with-issues', { checked: ['page Settings'], issues: [issue(), issue({ kind: 'target', severity: 'warning', message: 'Button is 87×32; under 44×44', group: 't' })] });
    assert.match(body, /### Accessibility\n\nSigma's check found 1 error and 1 warning in page Settings:/);
    assert.match(body, /- ❌ \*\*Text contrast\*\*: _Label in Button_/);
    const clean = write('clean', { checked: ['page Settings'], issues: [] });
    assert.match(clean, /Sigma's check found no issues in page Settings/);
    assert.doesNotMatch(write('unchecked', undefined), /### Accessibility/, 'older changesets have no section');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a11y: annotations in a file are checked', async () => {
  const { validateFile } = await import('../../src/validate.js');
  const file = (a11y) => ({ format: 1, kind: 'design', name: 'D', pages: [{ id: 'p', name: 'P', children: [{ id: 't', type: 'text', name: 'T', text: 'Hi', a11y }] }] });
  const errors = (a11y) => validateFile(file(a11y)).filter((i) => i.level === 'error').map((i) => i.message);
  assert.deepEqual(errors({ heading: 2, focus: 1, label: 'Hi', role: 'heading' }), []);
  assert.deepEqual(errors({ heading: 7, focus: 0, alt: 3, colour: 'red' }), [
    'isn’t an annotation; use alt, decorative, label, role, heading, focus',
    'should be text',
    'should be a heading level from 1 to 6',
    'should be a whole number from 1 (its place in the focus order)',
  ]);
});
