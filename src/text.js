import { state, getNode, emit, commit, removeNodes, worldMatrix, view, select } from './store.js';
import { mul, css } from './geom.js';

export function textStyle(n) {
  const lh = n.lineHeight ? `${n.lineHeight}%` : 'normal';
  const ws = n.autoResize === 'width' ? 'pre' : 'pre-wrap';
  return [
    `font-family:'${n.fontFamily}',system-ui,sans-serif`,
    `font-size:${n.fontSize}px`,
    `font-weight:${n.fontWeight}`,
    `line-height:${n.lineHeight ? (n.lineHeight / 100) * n.fontSize + 'px' : lh}`,
    `letter-spacing:${n.letterSpacing || 0}px`,
    `text-align:${n.textAlign}`,
    `white-space:${ws}`,
    'overflow-wrap:break-word',
    'margin:0', 'padding:0',
  ].join(';');
}

let measurer = null;

// Updates w/h of a text node according to its autoResize mode.
export function measureText(n) {
  if (n.type !== 'text' || n.autoResize === 'fixed') return;
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
    document.body.appendChild(measurer);
  }
  measurer.setAttribute('style', `position:absolute;left:-99999px;top:0;visibility:hidden;${textStyle(n)};` +
    (n.autoResize === 'width' ? 'width:auto;display:inline-block' : `width:${n.w}px;display:block`));
  // A trailing newline needs a character after it to take up height.
  measurer.textContent = (n.text || '​').replace(/\n$/, '\n​');
  const r = measurer.getBoundingClientRect();
  if (n.autoResize === 'width') n.w = Math.max(1, Math.ceil(r.width));
  n.h = Math.max(1, Math.ceil(r.height));
}

// ---------- in-place editor ----------
let editor = null;
let host = null;

export function initTextEditor(container) {
  host = container;
}

export function positionEditor() {
  if (!editor || !state.editingTextId) return;
  const n = getNode(state.editingTextId);
  if (!n) return stopEditing();
  const v = view();
  const M = mul([v.zoom, 0, 0, v.zoom, v.x, v.y], worldMatrix(n));
  editor.style.transform = css(M);
  editor.setAttribute('style', `${textStyle(n)};color:${n.fill || '#000'};opacity:${n.fillOpacity ?? 1};` +
    `position:absolute;left:0;top:0;transform-origin:0 0;transform:${css(M)};outline:none;caret-color:#0D99FF;` +
    (n.autoResize === 'width' ? 'width:auto;min-width:1px;' : `width:${n.w}px;`) +
    (n.autoResize === 'fixed' ? `height:${n.h}px;` : ''));
}

export function startEditing(id, { selectAll = true } = {}) {
  const n = getNode(id);
  if (!n || n.type !== 'text' || n.locked) return;
  if (state.editingTextId) stopEditing();
  state.editingTextId = id;
  select([id]);
  editor = document.createElement('div');
  editor.className = 'text-editor';
  editor.spellcheck = false;
  try {
    editor.contentEditable = 'plaintext-only';
  } catch {
    editor.contentEditable = 'true';
  }
  editor.textContent = n.text;
  host.appendChild(editor);
  positionEditor();
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  if (!selectAll) range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  editor.addEventListener('input', () => {
    n.text = editor.innerText.replace(/\n$/, '');
    // Text layers are named after their content until renamed by hand.
    if (n.autoName !== false) n.name = n.text.split('\n')[0].trim().slice(0, 60) || 'Text';
    measureText(n);
    positionEditor();
    emit('doc');
  });
  editor.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      stopEditing();
    }
  });
  editor.addEventListener('pointerdown', (e) => e.stopPropagation());
  editor.addEventListener('blur', () => stopEditing());
  emit('doc');
}

export function stopEditing() {
  const id = state.editingTextId;
  if (!id) return;
  state.editingTextId = null;
  const ed = editor;
  editor = null;
  ed?.remove();
  const n = getNode(id);
  if (n && !n.text.trim()) {
    removeNodes([id]);
    state.selection = [];
  }
  commit();
  emit('doc');
}
