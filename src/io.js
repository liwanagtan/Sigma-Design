import {
  state, page, view, commit, select, selectedNodes, getNode, getParent, pageOf, createNode, cloneNode,
  insertNode, removeNodes, worldMatrix, worldBounds, setWorldMatrix, walk, migratePaints,
} from './store.js';
import { mul, translate, unionBoxes, intersects } from './geom.js';
import { nodeWorldSVG, strokeOverhang, effectOverhang } from './render.js';
import { frameAt } from './hit.js';
import { sortByZ, viewportSize } from './commands.js';
import { toWorld } from './render.js';
import { measureText } from './text.js';
import { createInstance, canPlaceInside } from './components.js';
import { findVariable, allVariables } from './variables.js';
import { inspectImportedData, MAX_JSON_IMPORT_BYTES } from './document-safety.js';

export function toast(msg) {
  window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
}

// ---------- clipboard ----------
let internalClip = null;

function serializeSelection() {
  const nodes = sortByZ(selectedNodes());
  if (!nodes.length) return null;
  // Remember which variables the layers use, so a paste into another file can reconnect them by name.
  const variables = {};
  walk(nodes, (n) => {
    for (const id of Object.values(n.bindings || {})) {
      const hit = findVariable(id);
      if (hit) variables[id] = { name: hit.variable.name, type: hit.variable.type, collection: hit.collection.name };
    }
  });
  return JSON.stringify({
    sigma: 1,
    parentId: getParent(nodes[0].id)?.id || null,
    nodes: nodes.map((n) => ({ node: n, wm: worldMatrix(n) })),
    variables,
  });
}

export function copySelection(e) {
  const data = serializeSelection();
  if (!data) return false;
  internalClip = data;
  if (e?.clipboardData) {
    e.clipboardData.setData('text/plain', data);
    e.preventDefault();
  } else {
    navigator.clipboard?.writeText(data).catch(() => {});
  }
  return true;
}

export function cutSelection(e) {
  if (!copySelection(e)) return;
  removeNodes(state.selection);
  state.selection = [];
  commit();
}

function visibleWorldBox() {
  const { width, height } = viewportSize();
  const a = toWorld({ x: 0, y: 0 }), b = toWorld({ x: width, y: height });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

// `at`: a world point for "Paste here": the pasted layers' top-left goes there, inside the frame there.
function pasteSigma(json, { at = null } = {}) {
  if (json.length > MAX_JSON_IMPORT_BYTES) { toast('Clipboard content is too large.'); return true; }
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return false;
  }
  if (!data?.sigma || !Array.isArray(data.nodes)) return false;
  try { inspectImportedData(data); }
  catch (error) { toast(`Could not paste: ${error.message}`); return true; }
  const sel = selectedNodes();
  let parent = null;
  if (at) parent = frameAt(at);
  else if (sel.length === 1 && ['frame', 'component'].includes(sel[0].type)) parent = sel[0];
  else if (data.parentId && getNode(data.parentId) && pageOf(data.parentId) === page()) parent = getNode(data.parentId);

  const created = [];
  if (parent && !data.nodes.every(({ node }) => canPlaceInside(node, parent))) parent = null;
  for (const { node, wm } of data.nodes) {
    const main = node.type === 'component' ? getNode(node.id) : null;
    if (main?.type === 'component') {
      // Pasting a main component in its own file creates an instance of it, like Figma.
      const inst = createInstance(main, { parent });
      setWorldMatrix(inst, wm);
      created.push(inst);
      continue;
    }
    const c = cloneNode(node);
    walk([c], migratePaints);
    walk([c], (n) => remapBindings(n, data.variables || {}));
    insertNode(c, parent);
    setWorldMatrix(c, wm);
    created.push(c);
  }
  const box = unionBoxes(created.map(worldBounds));
  const target = parent ? worldBounds(parent) : visibleWorldBox();
  if (at) {
    // Paste here: the pasted layers' top-left corner lands on the clicked point.
    const dx = at.x - box.x, dy = at.y - box.y;
    for (const c of created) setWorldMatrix(c, mul(translate(dx, dy), worldMatrix(c)));
  } else if (!intersects(box, target)) {
    // Keep pasted content visible: center it in the target frame or the viewport if it would land off-screen.
    const dx = target.x + target.w / 2 - (box.x + box.w / 2);
    const dy = target.y + target.h / 2 - (box.y + box.h / 2);
    for (const c of created) setWorldMatrix(c, mul(translate(dx, dy), worldMatrix(c)));
  }
  select(created.map((c) => c.id));
  commit();
  return true;
}

// Bindings to variables this file doesn't have are reconnected to a variable with the same name and type
// (preferring the same collection name), or dropped; the layer keeps its current value either way.
function remapBindings(n, known) {
  if (!n.bindings) return;
  for (const [path, id] of Object.entries(n.bindings)) {
    if (findVariable(id)) continue;
    const info = known[id];
    const candidates = info ? allVariables(info.type).filter(({ variable }) => variable.name === info.name) : [];
    const match = candidates.find(({ collection }) => collection.name === info.collection) || candidates[0];
    if (match) n.bindings[path] = match.variable.id;
    else delete n.bindings[path];
  }
  if (!Object.keys(n.bindings).length) delete n.bindings;
}

function pasteText(text, { at = null } = {}) {
  const vb = visibleWorldBox();
  const n = createNode('text', { text, name: text.slice(0, 40) });
  measureText(n);
  let parent = selectedNodes().length === 1 && ['frame', 'component'].includes(selectedNodes()[0].type) ? selectedNodes()[0] : null;
  if (at) parent = frameAt(at);
  if (parent && !canPlaceInside(n, parent)) parent = null;
  insertNode(n, parent);
  const target = parent ? worldBounds(parent) : vb;
  if (at) setWorldMatrix(n, translate(at.x, at.y));
  else setWorldMatrix(n, translate(target.x + target.w / 2 - n.w / 2, target.y + target.h / 2 - n.h / 2));
  select([n.id]);
  commit();
}

export function paste(e) {
  const cd = e?.clipboardData;
  if (cd) {
    const files = [...cd.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      const c = visibleWorldBox();
      importImages(files, { x: c.x + c.w / 2, y: c.y + c.h / 2 });
      return;
    }
    const text = cd.getData('text/plain');
    if (text) {
      e.preventDefault();
      if (!pasteSigma(text)) pasteText(text);
      return;
    }
  }
  if (internalClip) pasteSigma(internalClip);
}

// The context menu's "Paste here": paste what was copied at a point on the canvas (world coordinates).
// Uses what this tab copied, or else the system clipboard (copied in another tab, or text).
export async function pasteHere(at) {
  if (internalClip && pasteSigma(internalClip, { at })) return;
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    // Reading the clipboard can be refused; there's nothing else to paste then.
  }
  if (!text) return window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Nothing to paste. Copy something first.' }));
  if (!pasteSigma(text, { at })) pasteText(text, { at });
}

// ---------- images ----------
function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

const MAX_IMAGE = 2048;

export async function importImages(files, worldPt) {
  const ids = [];
  let offset = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    let src = await readAsDataURL(file);
    let img = await loadImage(src);
    let w = img.naturalWidth || 200, h = img.naturalHeight || 200;
    if (Math.max(w, h) > MAX_IMAGE && file.type !== 'image/svg+xml') {
      const s = MAX_IMAGE / Math.max(w, h);
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * s);
      cv.height = Math.round(h * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      src = cv.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
      w = cv.width;
      h = cv.height;
    }
    const n = createNode('image', { src, w, h, name: file.name.replace(/\.[^.]+$/, '') || 'Image' });
    const parent = frameAt(worldPt);
    insertNode(n, parent);
    setWorldMatrix(n, translate(worldPt.x - w / 2 + offset, worldPt.y - h / 2 + offset));
    offset += 20;
    ids.push(n.id);
  }
  if (ids.length) {
    select(ids);
    commit();
  }
}

export function pickImages(worldPt) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => {
    if (!worldPt) {
      const c = visibleWorldBox();
      worldPt = { x: c.x + c.w / 2, y: c.y + c.h / 2 };
    }
    importImages([...input.files], worldPt);
  };
  input.click();
}

// ---------- export ----------
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (s) => (s || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim();

// `ordered`: nodes are already in z-order (e.g. a page's children), so skip sorting.
export function buildSVG(nodes, { ordered = false } = {}) {
  let box = unionBoxes(nodes.map(worldBounds));
  // Grow the canvas so center/outside strokes and shadows aren't cropped.
  let pad = 0;
  walk(nodes, (n) => {
    pad = Math.max(pad, strokeOverhang(n) + (n.visible ? effectOverhang(n) : 0));
  });
  pad = Math.ceil(pad);
  box = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
  const body = (ordered ? nodes : sortByZ(nodes)).map(nodeWorldSVG).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${body}</svg>`;
  return { svg, box };
}

export async function exportNodes(nodes, { format = 'png', scale = 1 } = {}) {
  nodes = nodes.filter((n) => n.visible);
  if (!nodes.length) return toast('Nothing to export');
  const { svg, box } = buildSVG(nodes);
  const name = safeName(nodes.length === 1 ? nodes[0].name : page().name);
  if (format === 'svg') {
    download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
    return;
  }
  try {
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(box.w * scale));
    cv.height = Math.max(1, Math.ceil(box.h * scale));
    const ctx = cv.getContext('2d');
    if (format === 'jpg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const type = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((res) => cv.toBlob(res, type, 0.92));
    download(blob, `${name}${scale !== 1 ? `@${scale}x` : ''}.${format}`);
  } catch (err) {
    console.error(err);
    toast('This browser blocked raster export; exported SVG instead.');
    download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
  }
}

// ---------- files ----------
export function saveFile() {
  const blob = new Blob([JSON.stringify(state.doc)], { type: 'application/json' });
  download(blob, `${safeName(state.doc.name)}.sigma.json`);
}
