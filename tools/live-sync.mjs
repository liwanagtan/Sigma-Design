// Live sync while Sigma runs in a project (Part F, Phase 34).
//
//   Code → Sigma: the token and icon sources in sigma.config.json are watched; when one changes (an edit, a
//   git pull), that entry is imported, so its Sigma file follows and the open editor reloads it.
//   Sigma → code: when Sigma saves a token or icon file, what that save changed is written to the code at once
//   (CSS and SVG by Sigma itself, anything else through the project's adapter, checked by reading back).
//
// The work is done by the sync tools (tools/sigma.mjs), one operation at a time. Sources are checked by
// polling their modification times, which works the same everywhere (editors that replace files, network
// drives, every OS). Sigma writing the code makes the next check import it again, which changes nothing.
import { existsSync, readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listFilesIn } from './lib/project.mjs';

const TOOLS = fileURLToPath(new URL('./sigma.mjs', import.meta.url));

// Run the sync tools with --json: { status, result (parsed JSON or null), output }.
function tools(args, cwd) {
  return new Promise((ok) => {
    execFile(process.execPath, [TOOLS, ...args, '--json'], { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      let result = null;
      try {
        result = JSON.parse(stdout);
      } catch {}
      ok({ status: err ? err.code ?? 1 : 0, result, output: `${stdout}${stderr}`.trim() });
    });
  });
}

const config = (root) => {
  try {
    return JSON.parse(readFileSync(join(root, 'sigma.config.json'), 'utf8'));
  } catch {
    return null;
  }
};

// What to watch: [{ kind, index, entry, files: [paths], dirs: [paths] }].
function watched(root) {
  const c = config(root);
  if (!c) return [];
  const out = [];
  (c.tokens || []).forEach((entry, index) => out.push({ kind: 'tokens', index, entry, files: (entry.sources || []).map((s) => s.path), dirs: [] }));
  (c.icons || []).forEach((entry, index) => out.push({ kind: 'icons', index, entry, files: [], dirs: entry.source ? [entry.source] : [] }));
  return out;
}

// A fingerprint of an entry's sources: their sizes and modification times (and, for folders, their files).
function signature(root, w) {
  const parts = [];
  const stamp = (rel) => {
    try {
      const st = statSync(join(root, rel));
      parts.push(`${rel}:${st.size}:${st.mtimeMs}`);
    } catch {
      parts.push(`${rel}:-`);
    }
  };
  for (const f of w.files) stamp(f);
  for (const d of w.dirs) for (const f of listFilesIn(join(root, d), '')) stamp(`${d}/${f}`);
  return parts.join('|');
}

/**
 * Start live sync for `root`. `log(line)` reports what happened. Returns
 *   { afterSave(rel, before) → Promise<report | null>, ready: Promise, stop() }
 * where afterSave is called by the server after Sigma saves a file (`before`: its previous text).
 */
export function startLiveSync({ root, log = () => {}, interval = 800 } = {}) {
  const seen = new Map(); // `${kind}:${index}` → signature
  let queue = Promise.resolve();
  let stopped = false;
  const serial = (fn) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };

  async function importEntry(w, why) {
    const r = await tools([w.kind, 'import', root, '--entry', String(w.index)], root);
    seen.set(`${w.kind}:${w.index}`, signature(root, w));
    const res = r.result?.[0];
    if (!res) {
      log(`couldn’t import ${w.entry.sigma}: ${r.output.split('\n').pop()}`);
      return;
    }
    const n = res.added.length + res.changed.length;
    if (res.written) log(`${why}: ${n} ${w.kind === 'icons' ? 'icon' : 'token'}${n === 1 ? '' : 's'} updated in ${w.entry.sigma}${n ? ` (${[...res.added, ...res.changed].slice(0, 4).join(', ')}${n > 4 ? '…' : ''})` : ''}`);
  }

  async function tick() {
    if (stopped) return;
    for (const w of watched(root)) {
      const key = `${w.kind}:${w.index}`;
      const sig = signature(root, w);
      if (seen.get(key) === sig) continue;
      const first = !seen.has(key);
      if (!existsSync(join(root, w.entry.sigma))) {
        seen.set(key, sig);
        continue; // not imported yet: that's setup's job
      }
      await serial(() => importEntry(w, first ? 'on start' : `${[...w.files, ...w.dirs].join(', ')} changed`));
    }
  }

  // Sigma saved a project file: write what that save changed to the code.
  async function afterSave(rel, before) {
    const w = watched(root).find((x) => x.entry.sigma === rel);
    if (!w || before === null) return null; // not a token or icon file (or a new one)
    return serial(async () => {
      const dir = mkdtempSync(join(tmpdir(), 'sigma-save-'));
      const baseFile = join(dir, 'before.json');
      writeFileSync(baseFile, before);
      try {
        const r = await tools([w.kind, 'write', root, '--entry', String(w.index), '--base-file', baseFile], root);
        seen.set(`${w.kind}:${w.index}`, signature(root, w)); // our own write: nothing to import
        const res = r.result?.[0] || r.result;
        const report = summarize(w, res, r);
        log(report.text);
        return report;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  let timer = null;
  const ready = tick().catch((err) => log(`live sync: ${err.message}`));
  ready.then(() => {
    const loop = () => {
      if (stopped) return;
      timer = setTimeout(() => tick().catch((err) => log(`live sync: ${err.message}`)).finally(loop), interval);
    };
    loop();
  });
  return {
    afterSave, ready,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

// What a write did, for the editor and the log: { written: [{ path, lines }], problem, manual, text }.
function summarize(w, res, r) {
  const what = w.kind === 'icons' ? 'icons' : 'tokens';
  if (!res) return { written: [], problem: r.output.split('\n').pop() || 'the write failed', text: `couldn’t write ${what}: ${r.output}` };
  if (res.manual) return { written: [], manual: true, text: `${w.entry.sigma}: the code isn’t written by Sigma here (no adapter): ${res.changes.length} change(s) for the agent (sigma-design ${what} diff)` };
  if (res.problem) return { written: [], problem: res.problem, text: `${w.entry.sigma}: not written — ${res.problem}` };
  let written = [];
  if (res.adapter) written = res.files || [];
  else if (w.kind === 'tokens') written = (r.result || []).filter((x) => x.written).map((x) => ({ path: x.source, lines: x.edits.length }));
  else written = [...(res.written || []), ...(res.removed || [])].map((path) => ({ path, lines: null }));
  return { written, text: written.length ? `wrote ${written.map((f) => `${f.path}${f.lines ? ` (${f.lines} line${f.lines === 1 ? '' : 's'})` : ''}`).join(', ')}` : `${w.entry.sigma}: nothing to write to the code` };
}
