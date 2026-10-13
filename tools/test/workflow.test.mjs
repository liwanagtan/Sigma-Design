// Team workflow beyond GitHub and Notion: GitLab merge requests, Linear and Jira tickets. node --test tools/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateConfig } from '../../src/project-config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS = join(ROOT, 'tools/sigma.mjs');

function project(workflow) {
  const dir = mkdtempSync(join(tmpdir(), 'sigma-workflow-'));
  writeFileSync(join(dir, 'sigma.config.json'), JSON.stringify({ schema: 1, tokens: [], icons: [], components: [], pages: [], workflow }));
  mkdirSync(join(dir, '.sigma/changesets'), { recursive: true });
  const cs = { id: 'cs-1', title: 'Darker hover', note: '', author: '', createdAt: '2026-10-13T09:00:00.000Z', status: 'proposed', base: 'HEAD', changes: [], renders: {} };
  writeFileSync(join(dir, '.sigma/changesets/cs-1.json'), JSON.stringify(cs));
  return dir;
}
const sigma = (dir, args, env = {}) => execFileSync(process.execPath, [TOOLS, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
const read = (dir) => JSON.parse(readFileSync(join(dir, '.sigma/changesets/cs-1.json'), 'utf8'));

test('workflow: Linear and Jira keys name branches; the project’s tracker and host are recorded', () => {
  const dir = project({ git: 'gitlab', tracker: 'linear', linear: { team: 'DES' }, branch: 'design/{ticket}-{slug}' });
  try {
    sigma(dir, ['changeset', 'status', 'cs-1', 'proposed', dir, '--ticket', 'https://linear.app/acme/issue/DES-42/darker-hover']);
    assert.deepEqual(read(dir).ticket, { tracker: 'linear', url: 'https://linear.app/acme/issue/DES-42/darker-hover' });
    assert.equal(sigma(dir, ['changeset', 'branch', 'cs-1', dir]).trim(), 'design/DES-42-darker-hover');
    sigma(dir, ['changeset', 'status', 'cs-1', 'in-review', dir, '--pr', 'https://gitlab.example.com/acme/web/-/merge_requests/7', '--pr-number', '7']);
    assert.equal(read(dir).pr.host, 'gitlab');
    sigma(dir, ['changeset', 'status', 'cs-1', 'in-review', dir, '--ticket', 'https://acme.atlassian.net/browse/WEB-9', '--tracker', 'jira']);
    assert.equal(sigma(dir, ['changeset', 'branch', 'cs-1', dir]).trim(), 'design/WEB-9-darker-hover');
    sigma(dir, ['changeset', 'status', 'cs-1', 'in-review', dir, '--ticket', 'https://github.com/acme/web/issues/12', '--tracker', 'github']);
    assert.equal(sigma(dir, ['changeset', 'branch', 'cs-1', dir]).trim(), 'design/12-darker-hover', 'an issue number');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workflow: changeset sync reads a GitLab merge request with glab', () => {
  const dir = project({ git: 'gitlab', tracker: 'none' });
  const bin = mkdtempSync(join(tmpdir(), 'sigma-glab-'));
  try {
    // A stand-in glab that answers `glab mr view 7 -R gitlab.example.com/acme/web --output json`.
    const fake = join(bin, 'glab');
    writeFileSync(fake, `#!/bin/sh\nif [ "$1 $2 $3 $4 $5" = "mr view 7 -R gitlab.example.com/acme/web" ]; then cat "${join(bin, 'mr.json')}"; else echo "unexpected: $*" >&2; exit 1; fi\n`);
    chmodSync(fake, 0o755);
    const env = { PATH: `${bin}${delimiter}${process.env.PATH}` };
    sigma(dir, ['changeset', 'status', 'cs-1', 'in-review', dir, '--pr', 'https://gitlab.example.com/acme/web/-/merge_requests/7']);
    writeFileSync(join(bin, 'mr.json'), JSON.stringify({ iid: 7, state: 'opened', detailed_merge_status: 'requested_changes' }));
    assert.match(sigma(dir, ['changeset', 'sync', dir], env), /Darker hover: In review → Changes requested/);
    writeFileSync(join(bin, 'mr.json'), JSON.stringify({ iid: 7, state: 'merged', merged_at: '2026-10-13T10:00:00Z' }));
    sigma(dir, ['changeset', 'sync', dir], env);
    const c = read(dir);
    assert.deepEqual([c.status, c.mergedAt, c.pr.number], ['merged', '2026-10-13T10:00:00Z', 7]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('workflow: the config accepts GitLab, Linear and Jira, and says what they need', () => {
  const warnings = (workflow) => validateConfig({ schema: 1, workflow }).map((i) => `${i.at}: ${i.message}`);
  assert.deepEqual(warnings({ git: 'gitlab', tracker: 'jira', jira: { project: 'WEB' } }), []);
  assert.deepEqual(warnings({ tracker: 'linear' }), ['workflow.linear.team: say which Linear team gets the tickets (its key, like "DES")']);
  assert.match(warnings({ git: 'gitea' })[0], /GitHub, GitLab, Azure DevOps \(azure\) and Bitbucket/);
});

test('workflow: changeset sync reads an Azure DevOps pull request with az', () => {
  const dir = project({ git: 'azure', tracker: 'none' });
  const bin = mkdtempSync(join(tmpdir(), 'sigma-az-'));
  try {
    const fake = join(bin, 'az');
    writeFileSync(fake, `#!/bin/sh\nif [ "$*" = "repos pr show --id 12 --org https://dev.azure.com/acme --output json" ]; then cat "${join(bin, 'pr.json')}"; else echo "unexpected: $*" >&2; exit 1; fi\n`);
    chmodSync(fake, 0o755);
    const env = { PATH: `${bin}${delimiter}${process.env.PATH}` };
    sigma(dir, ['changeset', 'status', 'cs-1', 'in-review', dir, '--pr', 'https://dev.azure.com/acme/web/_git/web/pullrequest/12']);
    assert.equal(read(dir).pr.host, 'azure');
    writeFileSync(join(bin, 'pr.json'), JSON.stringify({ pullRequestId: 12, status: 'active', reviewers: [{ vote: 10 }, { vote: -5 }] }));
    assert.match(sigma(dir, ['changeset', 'sync', dir], env), /In review → Changes requested/);
    writeFileSync(join(bin, 'pr.json'), JSON.stringify({ pullRequestId: 12, status: 'completed', closedDate: '2026-10-13T11:00:00Z', reviewers: [] }));
    sigma(dir, ['changeset', 'sync', dir], env);
    assert.deepEqual([read(dir).status, read(dir).mergedAt], ['merged', '2026-10-13T11:00:00Z']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('workflow: changeset sync reads a Bitbucket pull request from its API, with the token on stdin', () => {
  const dir = project({ git: 'bitbucket', tracker: 'none' });
  const bin = mkdtempSync(join(tmpdir(), 'sigma-curl-'));
  try {
    // A stand-in curl: checks it was asked for the API URL with the token (on stdin, not in its arguments).
    const fake = join(bin, 'curl');
    writeFileSync(fake, `#!/bin/sh\nconfig=$(cat)\ncase "$*" in *secret*) echo "token in arguments" >&2; exit 1;; esac\necho "$config" | grep -q 'url = "https://api.bitbucket.org/2.0/repositories/acme/web/pullrequests/5"' || { echo "unexpected: $config" >&2; exit 1; }\necho "$config" | grep -q 'Authorization: Bearer secret' || { echo "no token" >&2; exit 1; }\ncat "${join(bin, 'pr.json')}"\n`);
    chmodSync(fake, 0o755);
    const env = { PATH: `${bin}${delimiter}${process.env.PATH}`, BITBUCKET_TOKEN: 'secret' };
    sigma(dir, ['changeset', 'status', 'cs-1', 'in-review', dir, '--pr', 'https://bitbucket.org/acme/web/pull-requests/5']);
    assert.equal(read(dir).pr.host, 'bitbucket');
    writeFileSync(join(bin, 'pr.json'), JSON.stringify({ id: 5, state: 'OPEN', participants: [{ state: 'approved' }, { state: 'changes_requested' }] }));
    assert.match(sigma(dir, ['changeset', 'sync', dir], env), /In review → Changes requested/);
    writeFileSync(join(bin, 'pr.json'), JSON.stringify({ id: 5, state: 'MERGED', updated_on: '2026-10-13T12:00:00Z' }));
    sigma(dir, ['changeset', 'sync', dir], env);
    assert.deepEqual([read(dir).status, read(dir).mergedAt], ['merged', '2026-10-13T12:00:00Z']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});
