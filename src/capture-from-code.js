// Capture a project's components as its code renders them (Part F, Phase 35): the components page
// (components[].page in sigma.config.json, a page of the app that renders every component and loads
// sigma-design/bridge) opens in a hidden frame, and its bridge captures what the manifest lists into the
// project's captures folder. No editor needed: Check against code uses it, and so does the render parity
// check (tools/capture/parity.html).

const READY_MS = 20000;
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

/** Capture everything the manifest (and pages.json) lists, through the page's bridge, into the project. */
export async function captureFromCode(entry, status) {
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

