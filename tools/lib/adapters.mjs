// Project adapters (Part F, Phase 33): small modules the agent writes once, at setup, for stacks Sigma doesn't
// read by itself (a JS theme, Tailwind, SCSS, icon components). Committed in the project, run by Sigma on
// every import and write: no AI in the loop. The contract is in skills/sigma-sync/reference/adapters.md.
//
//   .sigma/adapters/tokens.mjs   export function read(ctx) → DTCG (reference/tokens.md)
//                                export function write(ctx, changes) → { files: [paths it changed] }
//   .sigma/adapters/icons.mjs    export function read(ctx) → [{ path: 'group/name.svg', text: '<svg…>' }]
//                                export function write(ctx, changes) → { files: [paths it changed] }
//
// ctx = { root, entry (its sigma.config.json entry), read(path), write(path, text), remove(path), exists(path),
//         sigma: { parseColorValue, formatColor, parseCSSValue, formatCSSValue, iconSVG } }
// Paths are relative to the project root. Every write is checked by reading back: if what the adapter reads
// isn't what Sigma has, the files it changed are put back as they were.
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseColorValue, formatColor, parseCSSValue, formatCSSValue } from '../../src/token-sync.js';
import { iconSVG } from '../../src/icon-sync.js';
import { writeAtomic } from './project.mjs';

const inside = (root, path) => {
  const rel = relative(root, resolve(root, path));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`an adapter can only touch files in the project (${path})`);
  return join(root, rel);
};

// The files an adapter touched, as they were before, so a failed write can be undone.
export class Snapshot {
  constructor(root) {
    this.root = root;
    this.before = new Map(); // path → text, or null when the file didn't exist
  }
  remember(path) {
    if (this.before.has(path)) return;
    const full = inside(this.root, path);
    this.before.set(path, existsSync(full) ? readFileSync(full, 'utf8') : null);
  }
  restore() {
    for (const [path, text] of this.before) {
      const full = inside(this.root, path);
      if (text === null) {
        if (existsSync(full)) unlinkSync(full);
      } else writeAtomic(full, text);
    }
  }
  // [{ path, before, after }] for the files that changed.
  changed() {
    return [...this.before].map(([path, before]) => {
      const full = inside(this.root, path);
      return { path, before, after: existsSync(full) ? readFileSync(full, 'utf8') : null };
    }).filter((f) => f.before !== f.after);
  }
}

// The context an adapter gets. Writes go through it, so Sigma knows (and can undo) what changed.
export function adapterContext(root, entry, snapshot = new Snapshot(root)) {
  return {
    root, entry,
    read: (path) => readFileSync(inside(root, path), 'utf8'),
    exists: (path) => existsSync(inside(root, path)),
    write: (path, text) => {
      snapshot.remember(path);
      writeAtomic(inside(root, path), text);
    },
    remove: (path) => {
      snapshot.remember(path);
      const full = inside(root, path);
      if (existsSync(full)) unlinkSync(full);
    },
    sigma: { parseColorValue, formatColor, parseCSSValue, formatCSSValue, iconSVG },
    snapshot,
  };
}

// The adapter module an entry names (its `adapter`), loaded fresh.
export async function loadAdapter(root, path) {
  const full = inside(root, path);
  if (!existsSync(full)) throw new Error(`${path} doesn't exist (the adapter sigma.config.json names)`);
  const mod = await import(`${pathToFileURL(full).href}?t=${Date.now()}`);
  for (const fn of ['read', 'write']) if (typeof mod[fn] !== 'function') throw new Error(`${path} should export a ${fn}() function (skills/sigma-sync/reference/adapters.md)`);
  return mod;
}

// Lines that differ between two texts (a diff's size): line by line when no lines were added or removed,
// else the span from the first difference to the last.
export function changedLines(before, after) {
  const a = String(before ?? '').split('\n'), b = String(after ?? '').split('\n');
  if (a.length === b.length) return a.filter((line, i) => line !== b[i]).length;
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1, endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  return Math.max(endA - start + 1, endB - start + 1, 0);
}
