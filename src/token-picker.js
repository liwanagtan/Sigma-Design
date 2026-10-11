// A searchable popover for pointing a value at another token: tokens of the right type from this file and
// from linked token files, grouped by collection, with a preview of each value. Opens from a cell's link
// button, or by typing "{" in a value.
import { collections, isLibraryCollection, libraryOf, previewValue, splitColor, groupOf, leafOf, VAR_TYPES } from './variables.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let el = null;
let cleanup = null;

// A short preview of a resolved value: a swatch and hex for colors, the value otherwise.
export function valuePreview(type, value) {
  if (value === undefined || value === null) return '<span class="muted">—</span>';
  if (type === 'color') {
    const { hex, alpha } = splitColor(value);
    return `<span class="mini-swatch" style="--c:${esc(value)}"></span><span>${hex}${alpha < 1 ? ` ${Math.round(alpha * 100)}%` : ''}</span>`;
  }
  if (type === 'typography' && typeof value === 'object') {
    return `<span>${esc(value.fontFamily)} ${esc(value.fontSize)}${value.lineHeight ? `/${esc(value.lineHeight)}%` : ''}</span>`;
  }
  if (type === 'boolean') return `<span>${value ? 'True' : 'False'}</span>`;
  if (type === 'duration') return `<span>${esc(value)}ms</span>`;
  if (type === 'shadow' && typeof value === 'object') {
    const { hex, alpha } = splitColor(value.color);
    return `<span class="mini-swatch shadow-swatch" style="--c:${esc(value.color)}"></span>` +
      `<span>${[value.x, value.y, value.blur, value.spread].map((n) => Number(n) || 0).join(' ')} · ${hex}${alpha < 1 ? ` ${Math.round(alpha * 100)}%` : ''}</span>`;
  }
  if (type === 'easing' && Array.isArray(value)) return `${easingCurve(value)}<span>${value.join(', ')}</span>`;
  if (type === 'string') return `<span>“${esc(value)}”</span>`;
  return `<span>${esc(value)}</span>`;
}

// A small picture of an easing curve.
export function easingCurve(e, size = 14) {
  const [x1, y1, x2, y2] = e.map(Number);
  const p = (x, y) => `${(x * size).toFixed(1)} ${((1 - y) * size).toFixed(1)}`;
  return `<svg class="easing-curve" width="${size}" height="${size}" viewBox="-1 -4 ${size + 2} ${size + 8}" fill="none" stroke="currentColor" stroke-width="1.2">` +
    `<path d="M${p(0, 0)} C${p(x1, y1)} ${p(x2, y2)} ${p(1, 1)}"/></svg>`;
}

// Where a collection lives, for labels: "Color" or "Core tokens › Color".
export function collectionLabel(c) {
  const lib = isLibraryCollection(c) ? libraryOf(c) : null;
  return lib ? `${lib.name} › ${c.name}` : c.name;
}

export function closeTokenPicker() {
  cleanup?.();
  el?.remove();
  el = null;
  cleanup = null;
}

// options: { anchor: DOMRect, type, exclude(id) → bool, currentId, query, onPick(id), onDetach() }
export function openTokenPicker({ anchor, type, exclude = () => false, currentId = null, query = '', onPick, onDetach }) {
  closeTokenPicker();
  const options = [];
  for (const c of collections()) {
    for (const v of c.variables || []) {
      if (v.type !== type || exclude(v.id)) continue;
      options.push({ v, c, label: collectionLabel(c), lib: isLibraryCollection(c), haystack: `${collectionLabel(c)} ${v.name}`.toLowerCase().replace(/[./]/g, ' ') });
    }
  }
  el = document.createElement('div');
  el.className = 'token-picker';
  el.innerHTML = `<input class="token-picker-search" placeholder="Search ${VAR_TYPES[type].toLowerCase()} tokens" spellcheck="false">` +
    '<div class="token-picker-list"></div>' +
    (onDetach && currentId ? '<button class="token-picker-detach">Detach: keep the current value</button>' : '');
  document.body.appendChild(el);
  const search = el.querySelector('input');
  const list = el.querySelector('.token-picker-list');
  search.value = query;
  let shown = [];
  let active = 0;

  const render = () => {
    const words = search.value.toLowerCase().replace(/[{}]/g, '').split(/[\s./]+/).filter(Boolean);
    shown = options.filter((o) => words.every((w) => o.haystack.includes(w)));
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
    let lastLabel = null;
    list.innerHTML = shown.map((o, i) => {
      const head = o.label !== lastLabel ? `<div class="token-picker-head">${o.lib ? '<span class="lib-tag">Token file</span>' : ''}${esc(o.label)}</div>` : '';
      lastLabel = o.label;
      const group = groupOf(o.v.name);
      return `${head}<button class="token-picker-item${i === active ? ' active' : ''}${o.v.id === currentId ? ' current' : ''}" data-i="${i}">` +
        `<span class="token-picker-name">${group ? `<span class="muted">${esc(group)}/</span>` : ''}${esc(leafOf(o.v.name))}</span>` +
        `<span class="token-picker-value">${valuePreview(type, previewValue(o.v.id))}</span></button>`;
    }).join('') || `<div class="muted token-picker-empty">${options.length ? 'No tokens match.' : `No other ${VAR_TYPES[type].toLowerCase()} tokens yet.`}</div>`;
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (o) => {
    closeTokenPicker();
    if (o) onPick(o.v.id);
  };

  search.addEventListener('input', () => {
    active = 0;
    render();
  });
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeTokenPicker();
    }
  });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    const item = e.target.closest('[data-i]');
    if (item) return pick(shown[+item.dataset.i]);
    if (e.target.closest('.token-picker-detach')) {
      closeTokenPicker();
      onDetach();
    }
  });
  const outside = () => closeTokenPicker();
  setTimeout(() => window.addEventListener('pointerdown', outside), 0);
  cleanup = () => window.removeEventListener('pointerdown', outside);

  render();
  // Below the anchor, or above it when there's no room.
  const r = el.getBoundingClientRect();
  const below = anchor.bottom + 4 + r.height <= window.innerHeight - 8;
  el.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 8))}px`;
  el.style.top = `${below ? anchor.bottom + 4 : Math.max(8, anchor.top - r.height - 4)}px`;
  search.focus();
  search.setSelectionRange(search.value.length, search.value.length);
}
