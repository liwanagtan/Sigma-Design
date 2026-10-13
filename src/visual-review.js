// Visual change review (Part D, Phase 19): what a change looks like, before and after, side by side, with the
// pixels that changed marked, like a visual regression test. For a library update (Review updates → Compare),
// a publish (Publish components → Compare), and a version in the version history (⋯ → Compare with current).
//
// Every top-level layer and every component variant is rendered as it is and as it would be (the update
// accepted, or the older version) through store.withDocument, so nothing is opened or saved; whatever renders
// differently is what changed. Renders are taken at the origin, so moving a frame on the canvas isn't a change.
import { state, getNode, withDocument, walk, select, emit, pageOf, localMatrix } from './store.js';
import { apply } from './geom.js';
import { layOutDocument } from './lay-out.js';
import { zoomToSelection } from './commands.js';
import { nodeSVG, strokeOverhang, effectOverhang } from './render.js';
import { modal } from './libraries.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));

/** A layer rendered on its own at the origin: { svg, w, h }. Works for layers outside the document too. */
export function renderSnapshot(node) {
  // Placed at the origin (moving isn't a change), keeping its rotation (turning it is).
  const n = { ...node, x: 0, y: 0, visible: true };
  let pad = 0;
  walk([n], (k) => {
    pad = Math.max(pad, strokeOverhang(k) + (k.visible ? effectOverhang(k) : 0));
  });
  pad = Math.ceil(pad);
  const m = localMatrix(n);
  const round = (v) => Math.round(v * 1000) / 1000; // cos(90°) isn't quite 0
  const corners = [[0, 0], [n.w, 0], [n.w, n.h], [0, n.h]].map(([x, y]) => apply(m, { x, y })).map((c) => ({ x: round(c.x), y: round(c.y) }));
  const x0 = Math.floor(Math.min(...corners.map((c) => c.x))) - pad, y0 = Math.floor(Math.min(...corners.map((c) => c.y))) - pad;
  const w = Math.max(1, Math.ceil(Math.max(...corners.map((c) => c.x))) + pad - x0), h = Math.max(1, Math.ceil(Math.max(...corners.map((c) => c.y))) + pad - y0);
  let body = '';
  try {
    body = nodeSVG(n, { export: true });
  } catch {
    body = '';
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}">${body}</svg>`, w, h };
}

// What a document shows: its top-level layers and component variants (a set's variants one by one), and the
// components of its component libraries. id → { id, name, where, kind, svg, w, h }.
export function renderAll(doc = state.doc) {
  const out = new Map();
  const add = (n, where, kind, name = n.name) => {
    if (n.visible === false || !n.w || !n.h) return;
    out.set(n.id, { id: n.id, name, where, kind, ...renderSnapshot(n) });
  };
  for (const pg of doc.pages || []) {
    for (const n of pg.children || []) {
      if (n.type === 'componentSet') for (const v of n.children.filter((c) => c.type === 'component')) add(v, pg.name, 'component', `${n.name} / ${v.name}`);
      else add(n, pg.name, n.type === 'component' ? 'component' : 'frame');
    }
  }
  // A library's components, laid out on a page of their own (a project file keeps them without derived sizes).
  if (doc === state.doc && doc.pages[0]?.id !== 'visual-review') {
    for (const lib of doc.componentLibraries || []) for (const [id, r] of renderComponents(lib.components, lib.name, 'library')) out.set(id, r);
  }
  return out;
}

// Renders of components that aren't in a document (a publish's snapshot, which may leave out what tokens and
// layout derive): on a page of a copy of this file, so tokens resolve and layouts apply as they do here.
export function renderComponents(list, where, kind = 'component') {
  const doc = { ...structuredClone({ ...state.doc, pages: [] }), pages: [{ id: 'visual-review', name: where, children: structuredClone(list || []) }], currentPageId: 'visual-review' };
  return withDocument(doc, () => {
    layOutDocument();
    return new Map([...renderAll()].filter(([, r]) => r.kind === 'component').map(([id, r]) => [id, { ...r, kind }]));
  });
}

/** What renders differently: [{ id, name, where, kind, change: 'changed' | 'added' | 'removed', before, after }]. */
export function visualChanges(before, after) {
  const out = [];
  for (const [id, b] of after) {
    const a = before.get(id);
    if (!a) out.push({ ...b, change: 'added', before: null, after: b });
    else if (a.svg !== b.svg) out.push({ ...b, change: 'changed', before: a, after: b });
  }
  for (const [id, a] of before) if (!after.has(id)) out.push({ ...a, change: 'removed', before: a, after: null });
  const order = { library: 0, component: 1, frame: 2 };
  return out.sort((x, y) => order[x.kind] - order[y.kind] || x.name.localeCompare(y.name));
}

/** The document's renders with `apply(doc)` done to a copy of it (an update accepted, say). */
export function renderAfter(apply) {
  return withDocument(structuredClone(state.doc), () => {
    apply();
    layOutDocument();
    return renderAll();
  });
}

/** The renders of another document (an older version). */
export const renderOther = (doc) => withDocument(structuredClone(doc), () => {
  layOutDocument();
  return renderAll();
});

// ---------- pixels ----------
const image = (svg) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});

/**
 * Compare two renders pixel by pixel (top-left aligned, at `scale`): { ratio (of the pixels), box (where, in
 * the render's units), url (the after render faded, changed pixels in magenta) }.
 */
export async function pixelDiff(a, b, scale = 1) {
  const w = Math.ceil(Math.max(a?.w || 0, b?.w || 0) * scale), h = Math.ceil(Math.max(a?.h || 0, b?.h || 0) * scale);
  const draw = async (r) => {
    const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = cv.getContext('2d');
    if (r) ctx.drawImage(await image(r.svg), 0, 0, r.w * scale, r.h * scale);
    return ctx.getImageData(0, 0, w, h);
  };
  const [pa, pb] = await Promise.all([draw(a), draw(b)]);
  const out = new ImageData(w, h);
  let changed = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < pa.data.length; i += 4) {
    const d = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]) + Math.abs(pa.data[i + 3] - pb.data[i + 3]);
    if (d > 24) { // anti-aliasing noise stays below this
      changed++;
      const p = i / 4, x = p % w, y = (p / w) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      out.data.set([233, 30, 140, 255], i);
    } else {
      // The unchanged render, faded, so the change has context.
      const alpha = pb.data[i + 3] || pa.data[i + 3];
      const src = pb.data[i + 3] ? pb.data : pa.data;
      out.data.set([src[i], src[i + 1], src[i + 2], alpha * 0.25], i);
    }
  }
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  cv.getContext('2d').putImageData(out, 0, 0);
  return {
    ratio: w * h ? changed / (w * h) : 0,
    box: changed ? { x: x0 / scale, y: y0 / scale, w: (x1 - x0 + 1) / scale, h: (y1 - y0 + 1) / scale } : null,
    url: cv.toDataURL(),
  };
}

// ---------- what it touched ----------
// Instances of `ids` (variant or component ids) in a document's pages.
export function countInstances(doc, ids) {
  let n = 0;
  for (const pg of doc.pages || []) walk(pg.children || [], (x) => {
    if (x.type === 'instance') {
      if (ids.has(x.componentId)) n++;
      return false; // nested instances are the component's
    }
  });
  return n;
}

// The other design files that use library `fileId` and have instances of `ids`: [{ id, name, path, instances }].
async function filesReached(fileId, ids) {
  const { reportFiles } = await import('./home.js');
  const files = await reportFiles();
  return files
    .filter((f) => f.id !== fileId && (f.doc.componentLibraries || []).some((l) => l.fileId === fileId))
    .map((f) => ({ id: f.id, name: f.name, path: f.path || null, instances: countInstances(f.doc, ids) }))
    .filter((f) => f.instances);
}

// ---------- the dialog ----------
const CHANGE = { changed: 'Changed', added: 'New', removed: 'Removed' };
const KIND = { library: 'Library component', component: 'Component', frame: 'Frame' };

/**
 * Show visual changes. `touched`: { instances (in this file), files: Promise<[{ id, name, instances }]> | null }.
 * Layers in the open file can be selected from here (`selectable`).
 */
export function openVisualReview(title, changes, { intro = '', touched = null, selectable = true } = {}) {
  const shown = changes.slice(0, 60);
  const counts = ['library', 'component', 'frame'].map((k) => [k, changes.filter((c) => c.kind === k).length]).filter(([, n]) => n);
  const summary = changes.length
    ? counts.map(([k, n]) => `${n} ${KIND[k].toLowerCase()}${n === 1 ? '' : 's'}`).join(', ') + ` look${changes.length === 1 ? 's' : ''} different`
    : 'Nothing looks different.';
  const pane = (r, label) => `<figure><figcaption>${label}</figcaption><div class="vr-img">${r ? `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.svg)}" alt="">` : '<span class="muted">—</span>'}</div></figure>`;
  const body = (intro ? `<p class="muted lib-intro">${intro}</p>` : '') +
    `<div class="vr-summary"><b>${summary}</b>${touched && changes.length ? '<span class="vr-touched muted"></span>' : ''}</div>` +
    shown.map((c, i) => `<div class="vr-row" data-row="${i}"><div class="vr-head"><b>${esc(c.name)}</b><span class="muted">${esc(KIND[c.kind])} · ${esc(c.where)}</span>` +
      `<span class="status-chip ${c.change === 'removed' ? '' : 'ok'}">${CHANGE[c.change]}</span><span class="vr-ratio muted"></span><span class="spacer"></span>` +
      `${selectable && c.kind !== 'library' && c.change !== 'removed' && getNode(c.id) ? `<button class="btn" data-select="${esc(c.id)}">Select</button>` : ''}</div>` +
      `<div class="vr-panes">${pane(c.before, 'Before')}${pane(c.after, 'After')}<figure><figcaption>Differences</figcaption><div class="vr-img vr-diff"><span class="muted">…</span></div></figure></div></div>`).join('') +
    (changes.length > shown.length ? `<div class="muted">and ${changes.length - shown.length} more</div>` : '');
  const wrap = modal(esc(title), body, '<span class="spacer"></span><button class="btn primary" data-close>Done</button>');
  wrap.querySelector('.modal').classList.add('visual-review');
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-select]');
    if (!b) return;
    wrap.remove();
    const pg = pageOf(b.dataset.select);
    if (pg && pg.id !== state.doc.currentPageId) {
      state.doc.currentPageId = pg.id;
      emit('doc');
    }
    select([b.dataset.select]);
    requestAnimationFrame(() => zoomToSelection());
  });
  // Differences, one row at a time so the dialog shows at once.
  (async () => {
    for (let i = 0; i < shown.length; i++) {
      const row = wrap.querySelector(`[data-row="${i}"]`);
      if (!row || !wrap.isConnected) return;
      const c = shown[i];
      try {
        const scale = Math.min(2, 480 / Math.max(c.before?.w || 0, c.after?.w || 0, 1));
        const d = await pixelDiff(c.before, c.after, scale);
        const box = d.box ? `<div class="vr-box" style="left:${(d.box.x / Math.max(c.before?.w || 0, c.after?.w || 0)) * 100}%;top:${(d.box.y / Math.max(c.before?.h || 0, c.after?.h || 0)) * 100}%;width:${(d.box.w / Math.max(c.before?.w || 0, c.after?.w || 0)) * 100}%;height:${(d.box.h / Math.max(c.before?.h || 0, c.after?.h || 0)) * 100}%"></div>` : '';
        row.querySelector('.vr-diff').innerHTML = `<div class="vr-overlay"><img src="${d.url}" alt="">${box}</div>`;
        row.querySelector('.vr-ratio').textContent = c.change === 'changed' ? (d.ratio ? `${d.ratio < 0.001 ? '<0.1' : (d.ratio * 100).toFixed(1)}% of pixels` : 'same pixels') : '';
      } catch {
        row.querySelector('.vr-diff').innerHTML = '<span class="muted">Couldn’t compare</span>';
      }
    }
  })();
  if (touched && changes.length) {
    const el = wrap.querySelector('.vr-touched');
    const here = touched.instances ? `${touched.instances} instance${touched.instances === 1 ? '' : 's'} in this file` : '';
    el.textContent = here;
    touched.files?.then((files) => {
      if (!wrap.isConnected) return;
      const list = files.map((f) => `<a href="#" data-open="${esc(f.id)}">${esc(f.name)}</a> (${f.instances})`).join(', ');
      const total = files.reduce((s, f) => s + f.instances, 0);
      el.innerHTML = [esc(here), files.length ? `${total} instance${total === 1 ? '' : 's'} in ${files.length} other file${files.length === 1 ? '' : 's'}: ${list}` : 'no other file uses them yet'].filter(Boolean).join(' · ');
      el.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', async (e) => {
        e.preventDefault();
        wrap.remove();
        const f = files.find((x) => x.id === a.dataset.open);
        if (f?.path) (await import('./project.js')).openProjectFile(f.path);
        else (await import('./files.js')).openFile(f.id);
      }));
    });
  }
  return wrap;
}

// ---------- the three entry points ----------
const idsOf = (changes) => {
  const ids = new Set();
  for (const c of changes) ids.add(c.id);
  return ids;
};

/** Review updates → Compare: the update accepted in a copy of this file. */
export async function compareUpdate(u, accept) {
  // Both sides are laid out the same way (in a copy), so only the update shows.
  const before = renderAfter(() => {});
  const after = renderAfter(() => accept(u));
  const changes = visualChanges(before, after);
  const ids = idsOf(changes.filter((c) => c.kind === 'library'));
  // Instances of the components that changed, which the frames above include.
  const instances = countInstances(state.doc, ids);
  openVisualReview(`${u.meta.name} v${u.lib.version} → v${u.published.version}`, changes, {
    intro: 'This file as it is, and with the update accepted. Nothing changes until you accept it.',
    touched: ids.size ? { instances, files: null } : null,
  });
}

/** Publish components → Compare: the last published version against the components now. */
export function comparePublish(published, now, fileId) {
  const changes = visualChanges(renderComponents(published?.components, 'Published'), renderComponents(now, 'This file'));
  const ids = new Set();
  for (const c of now) {
    if (!changes.some((x) => x.id === c.id || c.children?.some((v) => v.id === x.id))) continue;
    ids.add(c.id);
    for (const v of c.children || []) ids.add(v.id);
  }
  openVisualReview(published ? `Since v${published.version}` : 'First version', changes, {
    intro: published ? `The components as published in v${published.version}, and as they are now.` : 'Nothing has been published yet: every component is new.',
    touched: { instances: countInstances(state.doc, ids), files: ids.size ? filesReached(fileId, ids).catch(() => []) : Promise.resolve([]) },
  });
}

/** Version history → Compare with current. */
export function compareVersion(doc, label) {
  try {
    const changes = visualChanges(renderOther(doc), renderOther(state.doc));
    openVisualReview(`${label} → current`, changes, { intro: `What changed since “${esc(label)}”.` });
  } catch (err) {
    console.error(err);
    toast('That version could not be compared.');
  }
}
