// Check a component library against the code, from Sigma (Part F, Phase 35). The project's components page
// (components[].page in sigma.config.json: a page of the app that renders every component and loads
// sigma-design/bridge) is opened in a hidden frame; the bridge captures what the manifest lists, Sigma saves
// the captures in the project and compares them with the library (and the pages), and can rebuild the library
// from them.
import { state } from './store.js';
import { project, hasUnsavedProjectChanges, saveToProject, checkProjectNow } from './project.js';
import { getCurrentFileId } from './files.js';
import { modal } from './libraries.js';
import { compareLibrary, comparePages } from './capture-compare.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const READY_MS = 20000;

// The components entry in sigma.config.json for the open file, or null.
export function libraryEntry() {
  const path = state.doc?.project?.path;
  return (project.config?.components || []).find((e) => e.sigma === path) || null;
}

const api = (path, init) => fetch(path, { cache: 'no-store', ...init });
const getJSON = async (path) => {
  const r = await api(`/api/project/file?path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error(`${path}: ${(await r.json().catch(() => ({}))).error || r.status}`);
  return r.json();
};
const putJSON = (path, data) => api(`/api/project/file?path=${encodeURIComponent(path)}`, {
  method: 'PUT', headers: { 'X-Sigma': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(data, null, 2),
});
const exists = async (path) => (await api(`/api/project/file?path=${encodeURIComponent(path)}`)).ok;

// The components page in a hidden frame, and a way to ask its bridge: { ask(message) → reply, close() }.
function openPage(url) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position: fixed; left: -3000px; top: 0; width: 1280px; height: 900px; border: 0; visibility: hidden;';
    const pageOrigin = new URL(url, location.href).origin;
    const pending = new Map();
    let n = 0;
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow) return;
      if (e.data?.type === 'sigma:bridge-ready') {
        clearTimeout(timer);
        resolve({
          ask: (msg) => new Promise((ok, fail) => {
            const id = `m${++n}`;
            pending.set(id, { ok, fail });
            frame.contentWindow.postMessage({ ...msg, id }, pageOrigin);
          }),
          close,
        });
        return;
      }
      const p = pending.get(e.data?.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.type === 'sigma:error') p.fail(new Error(e.data.error));
      else p.ok(e.data);
    };
    const close = () => {
      window.removeEventListener('message', onMessage);
      frame.remove();
    };
    const timer = setTimeout(() => {
      close();
      reject(new Error(`the components page didn’t answer (${url}). Is the app running, and does the page load sigma-design/bridge?`));
    }, READY_MS);
    window.addEventListener('message', onMessage);
    frame.src = url;
    document.body.appendChild(frame);
  });
}

const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Capture everything the manifest (and pages.json) lists, through the page's bridge, into the project.
async function captureFromCode(entry, status) {
  const manifestPath = entry.manifest || '.sigma/captures/manifest.json';
  const dir = manifestPath.slice(0, manifestPath.lastIndexOf('/'));
  const manifest = await getJSON(manifestPath);
  status(`Opening ${entry.page}…`);
  const page = await openPage(entry.page);
  try {
    status('Capturing the components…');
    const { captures } = await page.ask({ type: 'sigma:capture-all', manifest });
    const missing = captures.$missing || [];
    delete captures.$missing;
    for (const [file, capture] of Object.entries(captures)) await putJSON(`${dir}/${file}`, capture);
    let pageCount = 0;
    if (await exists(`${dir}/pages.json`)) {
      const pages = await getJSON(`${dir}/pages.json`);
      for (const p of pages.pages) {
        for (const bp of pages.breakpoints) {
          status(`Capturing ${p.name} at ${bp.width}px…`);
          const { capture } = await page.ask({ type: 'sigma:capture-page', route: p.route, width: bp.width, manifest, name: p.name });
          await putJSON(`${dir}/page-${slug(p.name)}-${slug(bp.name)}.json`, capture);
          pageCount++;
        }
      }
    }
    return { dir, count: Object.keys(captures).length, pageCount, missing };
  } finally {
    page.close();
  }
}

function reportHTML(components, pages) {
  const section = (title, report) => {
    const rows = Object.entries(report);
    if (!rows.length) return '';
    const bad = rows.filter(([, d]) => d.length).length;
    return `<div class="check-section"><div class="check-head"><b>${title}</b><span class="${bad ? 'check-bad' : 'check-ok'}">${rows.length - bad} of ${rows.length} match the code</span></div>` +
      rows.map(([key, diffs]) => `<div class="check-row ${diffs.length ? 'bad' : 'ok'}"><span class="check-mark">${diffs.length ? '✗' : '✓'}</span><span>${esc(key)}</span></div>` +
        diffs.slice(0, 6).map((d) => `<div class="check-diff">${esc(d.layer)}: ${esc(d.what)} ${esc(String(d.sigma))} in Sigma, ${esc(String(d.code))} in code</div>`).join('') +
        (diffs.length > 6 ? `<div class="check-diff">…and ${diffs.length - 6} more</div>` : '')).join('') + '</div>';
  };
  return section('Components', components) + section('Pages', pages);
}

/** The "Check against code" dialog for the open library file. */
export async function openCodeCheck() {
  const entry = libraryEntry();
  if (!entry) return toast('Check against code works on a component library listed in sigma.config.json (components).');
  if (!entry.page) {
    return toast('Add the components page to sigma.config.json ("page": its URL, served by the app, loading sigma-design/bridge): see reference/components.md.');
  }
  const wrap = modal('Check against code', '<div class="check-status muted">Starting…</div><div class="check-report"></div>',
    '<span class="check-note muted"></span><span class="spacer"></span><button class="btn" data-update hidden>Update the library from code…</button><button class="btn" data-close>Close</button><button class="btn primary" data-recheck>Check again</button>');
  wrap.querySelector('.modal').classList.add('check-modal');
  const statusEl = wrap.querySelector('.check-status');
  const status = (text) => (statusEl.textContent = text);
  const run = async () => {
    wrap.querySelector('[data-recheck]').disabled = true;
    wrap.querySelector('[data-update]').hidden = true;
    try {
      if (getCurrentFileId() && (await hasUnsavedProjectChanges(getCurrentFileId(), state.doc))) {
        status('Saving to the project first (the check compares the saved library)…');
        await saveToProject();
      }
      const { dir, count, pageCount, missing } = await captureFromCode(entry, status);
      status('Comparing…');
      const components = await compareLibrary({ captures: dir });
      const pages = await comparePages({ captures: dir });
      wrap.querySelector('.check-report').innerHTML = reportHTML(components, pages);
      const bad = [...Object.values(components), ...Object.values(pages)].filter((d) => d.length).length;
      status(`${count} component captures${pageCount ? ` and ${pageCount} page captures` : ''} from ${entry.page}${missing.length ? ` (${missing.length} missing: ${missing.join('; ')})` : ''}. ${bad ? `${bad} don’t match: fix the code, or update the library from it.` : 'Everything matches the code.'}`);
      wrap.querySelector('[data-update]').hidden = false;
    } catch (err) {
      status(`Couldn’t check: ${err.message}`);
    } finally {
      wrap.querySelector('[data-recheck]').disabled = false;
    }
  };
  wrap.querySelector('[data-recheck]').addEventListener('click', run);
  wrap.querySelector('[data-update]').addEventListener('click', async () => {
    if (!confirm('Rebuild the components the manifest lists from the code, as just captured? Their design in Sigma is replaced (other components and pages stay).')) return;
    status('Building the library from the code…');
    const r = await (await api('/api/project/action?name=library-build', { method: 'POST', headers: { 'X-Sigma': '1' } })).json();
    if (!r.ok) return status(`Couldn’t build: ${r.output || JSON.stringify(r.result?.errors || r.result)}`);
    const res = r.result || {};
    wrap.querySelector('.check-note').textContent = `${(res.added || []).length} added, ${(res.replaced || []).length} rebuilt${(res.notes || []).length ? ` · ${res.notes.length} note(s)` : ''}`;
    await checkProjectNow(); // the open file reloads
    await run();
  });
  run();
}

/** A library listed in sigma.config.json but not built yet: capture its components and build it, then open it. */
export async function buildLibraryFromCode(entry) {
  const wrap = modal('Build the library from code', '<div class="check-status muted">Starting…</div><div class="check-report"></div>',
    '<span class="spacer"></span><button class="btn" data-close>Close</button>');
  wrap.querySelector('.modal').classList.add('check-modal');
  const statusEl = wrap.querySelector('.check-status');
  const status = (text) => (statusEl.textContent = text);
  try {
    if (!entry.page) throw new Error('add the components page to sigma.config.json ("page": its URL, loading sigma-design/bridge)');
    const { dir, count, missing } = await captureFromCode(entry, status);
    status('Building the library…');
    const r = await (await api('/api/project/action?name=library-build', { method: 'POST', headers: { 'X-Sigma': '1' } })).json();
    if (!r.ok) throw new Error(r.output || JSON.stringify(r.result?.errors || r.result));
    status('Comparing…');
    await checkProjectNow();
    const components = await compareLibrary({ captures: dir });
    wrap.querySelector('.check-report').innerHTML = reportHTML(components, {});
    const res = r.result || {};
    status(`Built ${entry.sigma} from ${count} captures (${(res.added || []).length} components${missing.length ? `; missing: ${missing.join('; ')}` : ''}).${(res.notes || []).length ? ` Notes: ${res.notes.join(' · ')}` : ''}`);
    const open = document.createElement('button');
    open.className = 'btn primary';
    open.textContent = 'Open the library';
    open.addEventListener('click', async () => {
      wrap.remove();
      const { openProjectFile } = await import('./project.js');
      openProjectFile(entry.sigma);
    });
    wrap.querySelector('.lib-footer').appendChild(open);
  } catch (err) {
    status(`Couldn’t build: ${err.message}`);
  }
}
