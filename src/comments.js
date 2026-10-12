// Comments on layers (Part E, Phase 27), stored in the Sigma file so they travel with it through git:
//   doc.comments = [{ id, pageId, nodeId, at: { x, y }, layer, text, author, createdAt, resolved?, resolvedBy?,
//                     replies: [{ id, text, author, createdAt }] }]
// `at` is where the pin is, in the layer's own coordinates (so it moves with the layer), or in the page's
// when it isn't on a layer; `layer` is the layer's name path when the comment was made ("Card / Title"),
// for reading a comment outside Sigma (a pull request, a ticket).
import { state, page, view, getNode, worldMatrix, ancestors, commit, emit, uid, select } from './store.js';
import { apply, inv } from './geom.js';
import { toScreen, toWorld } from './render.js';
import { hitPath, pickFromPath } from './hit.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AUTHOR_KEY = 'sigma.author';
let showResolved = false;

export const comments = () => state.doc?.comments || [];
export const commentsOnPage = (pg = page()) => comments().filter((c) => c.pageId === pg?.id);

function author() {
  let name = '';
  try {
    name = localStorage.getItem(AUTHOR_KEY) || '';
  } catch {}
  if (!name) {
    name = (prompt('Your name, shown on your comments:') || '').trim() || 'Someone';
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch {}
  }
  return name;
}

const layerPath = (n) => [...ancestors(n)].reverse().concat(n).map((x) => x.name).join(' / ');

// Where a comment's pin is, in world coordinates.
export function pinPoint(c) {
  const n = c.nodeId && getNode(c.nodeId);
  return n ? apply(worldMatrix(n), c.at) : c.at;
}

export function addComment({ worldPoint, text, node = null }) {
  const c = {
    id: uid(), pageId: page().id, nodeId: node?.id || null, at: node ? apply(inv(worldMatrix(node)), worldPoint) : worldPoint,
    layer: node ? layerPath(node) : '', text: text.trim(), author: author(), createdAt: new Date().toISOString(), replies: [],
  };
  c.at = { x: Math.round(c.at.x * 10) / 10, y: Math.round(c.at.y * 10) / 10 };
  (state.doc.comments ||= []).push(c);
  commit();
  return c;
}

export function reply(c, text) {
  c.replies.push({ id: uid(), text: text.trim(), author: author(), createdAt: new Date().toISOString() });
  commit();
}

export function setResolved(c, resolved) {
  if (resolved) {
    c.resolved = true;
    c.resolvedBy = author();
  } else {
    delete c.resolved;
    delete c.resolvedBy;
  }
  commit();
}

export function deleteComment(c) {
  state.doc.comments = comments().filter((x) => x !== c);
  if (!state.doc.comments.length) delete state.doc.comments;
  commit();
}

// ---------- pins ----------
let pinsEl = null;
let openId = null;

export function initComments(canvas) {
  pinsEl = document.createElement('div');
  pinsEl.className = 'comment-pins';
  canvas.appendChild(pinsEl);
  pinsEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  pinsEl.addEventListener('click', (e) => {
    const pin = e.target.closest('[data-comment]');
    if (pin) openThread(pin.dataset.comment);
  });
}

export function renderCommentPins() {
  if (!pinsEl || !state.doc) return;
  const show = state.tool === 'comment' || comments().some((c) => c.id === openId);
  const list = commentsOnPage().filter((c) => showResolved || !c.resolved || c.id === openId);
  pinsEl.hidden = !show && !list.some((c) => !c.resolved);
  pinsEl.innerHTML = list.map((c, i) => {
    const p = toScreen(pinPoint(c));
    return `<button class="comment-pin${c.resolved ? ' resolved' : ''}${c.id === openId ? ' open' : ''}" data-comment="${c.id}" style="left:${p.x}px;top:${p.y}px" title="${esc(c.author)}: ${esc(c.text)}">${i + 1}</button>`;
  }).join('');
  if (openId) placePopover();
}

// ---------- popovers ----------
let pop = null;
let popAt = null; // world point
export function closeCommentPopover() {
  pop?.remove();
  pop = null;
  openId = null;
  renderCommentPins();
}
function placePopover() {
  if (!pop || !popAt) return;
  const p = toScreen(popAt);
  const host = pinsEl.getBoundingClientRect();
  pop.style.left = `${Math.min(host.left + p.x + 18, window.innerWidth - pop.offsetWidth - 8)}px`;
  pop.style.top = `${Math.max(8, Math.min(host.top + p.y - 12, window.innerHeight - pop.offsetHeight - 8))}px`;
}
function popover(html, at) {
  pop?.remove();
  pop = document.createElement('div');
  pop.className = 'comment-popover';
  pop.innerHTML = html;
  document.body.appendChild(pop);
  popAt = at;
  placePopover();
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
  pop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeCommentPopover();
  });
  return pop;
}

// The comment tool: click a layer (or the canvas) to start a comment there.
export function startComment(screenPoint) {
  const wp = toWorld(screenPoint);
  const node = pickFromPath(hitPath(wp), { deep: true });
  const el = popover(`<div class="comment-target muted">${node ? esc(layerPath(node)) : esc(page().name)}</div>
    <textarea class="desc comment-input" rows="3" placeholder="Add a comment"></textarea>
    <div class="comment-actions"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-post>Comment</button></div>`, wp);
  const input = el.querySelector('textarea');
  input.focus();
  const post = () => {
    if (!input.value.trim()) return;
    const c = addComment({ worldPoint: wp, text: input.value, node });
    openThread(c.id);
  };
  el.querySelector('[data-post]').onclick = post;
  el.querySelector('[data-cancel]').onclick = closeCommentPopover;
  input.addEventListener('keydown', (e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && post());
}

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(+d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function openThread(id) {
  const c = comments().find((x) => x.id === id);
  if (!c) return;
  openId = id;
  if (c.pageId !== page().id) {
    state.doc.currentPageId = c.pageId;
    emit('doc');
  }
  const node = c.nodeId && getNode(c.nodeId);
  const msg = (m) => `<div class="comment-msg"><div class="comment-meta"><b>${esc(m.author)}</b><span class="muted">${when(m.createdAt)}</span></div><div class="comment-text">${esc(m.text)}</div></div>`;
  const el = popover(`<div class="comment-target muted">${node ? `<button class="link-btn" data-select-layer>${esc(layerPath(node))}</button>` : esc(c.layer || 'On the page')}${c.resolved ? ` · Resolved${c.resolvedBy ? ` by ${esc(c.resolvedBy)}` : ''}` : ''}</div>
    ${msg(c)}${c.replies.map(msg).join('')}
    <textarea class="desc comment-input" rows="2" placeholder="Reply"></textarea>
    <div class="comment-actions"><button class="btn" data-delete title="Delete the comment and its replies">Delete</button><span class="spacer"></span>
      <button class="btn" data-resolve>${c.resolved ? 'Reopen' : 'Resolve'}</button><button class="btn primary" data-reply>Reply</button></div>`, pinPoint(c));
  const input = el.querySelector('textarea');
  el.querySelector('[data-reply]').onclick = () => {
    if (!input.value.trim()) return;
    reply(c, input.value);
    openThread(c.id);
  };
  input.addEventListener('keydown', (e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && el.querySelector('[data-reply]').click());
  el.querySelector('[data-resolve]').onclick = () => {
    setResolved(c, !c.resolved);
    c.resolved && !showResolved ? closeCommentPopover() : openThread(c.id);
  };
  el.querySelector('[data-delete]').onclick = () => {
    if (!confirm('Delete this comment and its replies?')) return;
    deleteComment(c);
    closeCommentPopover();
  };
  el.querySelector('[data-select-layer]')?.addEventListener('click', () => node && select([node.id]));
  renderCommentPins();
}

// ---------- the Comments list (left panel) ----------
export function commentsListHTML() {
  const all = comments();
  const shown = all.filter((c) => showResolved || !c.resolved);
  const pages = new Map((state.doc?.pages || []).map((p) => [p.id, p.name]));
  const head = `<div class="comments-head"><span class="muted">${all.filter((c) => !c.resolved).length} open</span>` +
    `<label class="check-row"><input type="checkbox" data-show-resolved ${showResolved ? 'checked' : ''}> Show resolved</label></div>`;
  if (!shown.length) return `${head}<div class="empty-hint">${all.length ? 'All comments are resolved.' : 'No comments yet. Press C (or the comment tool) and click a layer to comment on it.'}</div>`;
  return head + shown.map((c) => `<button class="comment-row${c.resolved ? ' resolved' : ''}" data-open-comment="${c.id}">
    <div class="comment-meta"><b>${esc(c.author)}</b><span class="muted">${esc(pages.get(c.pageId) || '')}${c.replies.length ? ` · ${c.replies.length} repl${c.replies.length === 1 ? 'y' : 'ies'}` : ''}</span></div>
    <div class="comment-text">${esc(c.text)}</div><div class="muted comment-on">${esc(c.layer || 'On the page')}</div></button>`).join('');
}

export function onCommentsListClick(e) {
  const row = e.target.closest('[data-open-comment]');
  if (row) {
    openThread(row.dataset.openComment);
    const c = comments().find((x) => x.id === row.dataset.openComment);
    if (c) centerOn(pinPoint(c));
    return true;
  }
  return false;
}
export function onCommentsListChange(e) {
  if (!e.target.matches('[data-show-resolved]')) return false;
  showResolved = e.target.checked;
  emit('doc');
  return true;
}

function centerOn(p) {
  const v = view();
  const canvas = pinsEl?.parentElement?.getBoundingClientRect();
  if (!canvas) return;
  v.x = canvas.width / 2 - p.x * v.zoom;
  v.y = canvas.height / 2 - p.y * v.zoom;
  emit('view');
}
