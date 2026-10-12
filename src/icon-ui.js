// Icons in Sigma Design files: the icon picker, and icon layers in main components.
// Icon layers go inside main components for now; instances get them from their main component.
import { commit, getParent, ancestors, insertNode, createNode, select, selectedNodes, editNode } from './store.js';
import { isInsideInstance } from './components.js';
import { isAutoLayout } from './layout.js';
import { iconMarkup, iconMatches, iconScore, findIcon, iconLibraryOf, ICON_STYLES, libraryIconCache } from './icon-library.js';
import { iconLibraries, openIconLibrariesDialog, loadIconLibraries, keepIcons } from './libraries.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));

// Every icon this file can use: [{ icon, lib }] (removed icons only when `withId` is one of them). The
// whole sets come from the linked Sigma Icons files (loadIconLibraries); until they're read, just the
// icons the file uses.
export function availableIcons({ groups = null, withId = null } = {}) {
  const out = [];
  for (const lib of iconLibraries()) {
    const set = libraryIconCache.get(lib.fileId)?.icons || [];
    const ids = new Set(set.map((x) => x.id));
    for (const icon of [...set, ...lib.icons.filter((x) => !ids.has(x.id))]) {
      if (icon.removed && icon.id !== withId) continue;
      if (groups?.length && !groups.includes(icon.group || '') && icon.id !== withId) continue;
      out.push({ icon, lib });
    }
  }
  return out;
}

// ---------- the picker ----------
let picker = null;
export function closeIconPicker() {
  picker?.remove();
  picker = null;
}

// A popover grid of icons with a search. `groups`: only these groups ('' is ungrouped); null for all.
// The chosen icon is copied into the file's links before `onPick` runs.
export async function openIconPicker({ anchor, currentId = null, groups = null, onPick }) {
  closeIconPicker();
  const opened = (picker = document.createElement('div'));
  if (iconLibraries().length) {
    picker.className = 'token-picker icon-picker';
    picker.innerHTML = '<div class="muted token-picker-empty">Loading icons…</div>';
    place(picker, anchor);
    await loadIconLibraries();
    if (picker !== opened) return; // closed (or another opened) meanwhile
    picker.remove();
  }
  picker = document.createElement('div');
  picker.className = 'token-picker icon-picker';
  document.body.appendChild(picker);
  if (!iconLibraries().length) {
    picker.innerHTML = '<div class="muted token-picker-empty">This file doesn’t use a Sigma Icons file yet.</div><button class="btn wide" data-libs>Link a Sigma Icons file…</button>';
    picker.querySelector('[data-libs]').onclick = () => {
      closeIconPicker();
      openIconLibrariesDialog();
    };
  } else {
    picker.innerHTML = '<input class="token-picker-search" placeholder="Search icons" spellcheck="false"><div class="token-picker-list icon-picker-list"></div>';
  }
  const search = picker.querySelector('input');
  const list = picker.querySelector('.icon-picker-list');
  // By library, then style, then group (A–Z, ungrouped last), so the picker reads like the Sigma Icons file.
  const styleOrder = Object.keys(ICON_STYLES), libs = iconLibraries();
  const found = availableIcons({ groups, withId: currentId });
  const rank = (x) => [libs.indexOf(x.lib), styleOrder.indexOf(x.icon.style), x.icon.group ? 0 : 1];
  const all = found.map((x, i) => ({ ...x, i, r: rank(x) })).sort((a, b) => a.r.reduce((d, v, k) => d || v - b.r[k], 0) ||
    (a.icon.group || '').localeCompare(b.icon.group || '', undefined, { sensitivity: 'base' }) || a.i - b.i);
  const several = libs.length > 1;
  const styles = new Set(all.map((x) => x.icon.style)).size > 1;
  let shown = [];
  let active = 0;
  const render = () => {
    shown = all.filter(({ icon }) => iconMatches(icon, search.value));
    // Searching: one list, best matches first (heart before heart-crack before file-heart).
    const searching = !!search.value.trim();
    if (searching) shown = shown.map((x, i) => ({ x, i, s: iconScore(x.icon, search.value) })).sort((a, b) => a.s - b.s || a.i - b.i).map(({ x }) => x);
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
    const heads = new Map();
    for (const [i, x] of shown.entries()) {
      const head = searching ? `${shown.length} result${shown.length === 1 ? '' : 's'}`
        : [several && x.lib.name, styles && ICON_STYLES[x.icon.style], x.icon.group || 'Ungrouped'].filter(Boolean).join(' · ');
      if (!heads.has(head)) heads.set(head, []);
      heads.get(head).push(i);
    }
    list.innerHTML = [...heads].map(([head, idx]) => `<div class="token-picker-head">${esc(head)}</div><div class="icon-picker-tiles">` +
      idx.map((i) => {
        const { icon } = shown[i];
        return `<button class="icon-picker-tile${i === active ? ' active' : ''}${icon.id === currentId ? ' current' : ''}" data-i="${i}" title="${esc(icon.name)}">${iconMarkup(icon, { w: 20, h: 20 })}</button>`;
      }).join('') + '</div>').join('') || `<div class="muted token-picker-empty">${all.length ? 'No icons match.' : groups?.length ? 'No icons in the allowed groups.' : 'No icons.'}</div>`;
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    const cur = shown[active]?.icon;
    picker.querySelector('.icon-picker-name')?.remove();
    if (cur) list.insertAdjacentHTML('afterend', `<div class="icon-picker-name muted">${esc(cur.name)}</div>`);
  };
  const pick = (x) => {
    closeIconPicker();
    if (!x) return;
    keepIcons([x.icon.id]);
    onPick(x.icon.id);
  };
  if (search) {
    search.addEventListener('input', () => { active = 0; render(); });
    search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const cols = 8;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step) {
        e.preventDefault();
        active = Math.max(0, Math.min(shown.length - 1, active + step));
        render();
      } else if (e.key === 'Enter') pick(shown[active]);
      else if (e.key === 'Escape') closeIconPicker();
    });
    const cur = all.findIndex((x) => x.icon.id === currentId);
    if (cur >= 0) active = cur;
    render();
  }
  picker.addEventListener('pointerdown', (e) => e.stopPropagation());
  picker.addEventListener('click', (e) => {
    const t = e.target.closest('[data-i]');
    if (t) pick(shown[+t.dataset.i]);
  });
  picker.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-i]');
    const name = picker.querySelector('.icon-picker-name');
    if (t && name) name.textContent = shown[+t.dataset.i]?.icon.name || '';
  });
  const outside = (e) => {
    if (picker && !picker.contains(e.target)) {
      closeIconPicker();
      window.removeEventListener('pointerdown', outside, true);
    }
  };
  setTimeout(() => window.addEventListener('pointerdown', outside, true), 0);
  place(picker, anchor);
  search?.focus();
}

function place(el, anchor) {
  if (!el.isConnected) document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 8))}px`;
  el.style.top = `${anchor.bottom + 4 + r.height <= window.innerHeight - 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - r.height - 4)}px`;
}

// ---------- icon layers ----------
// Inside a main component (not in an instance): where icon layers can go.
const inMainComponent = (n) => !!n && n.type !== 'instance' && !isInsideInstance(n) && [n, ...ancestors(n)].some((a) => a.type === 'component');

// Where a new icon goes for the selection: into the selected component or frame, or next to the selected
// layer. null when the selection isn't in a main component.
export function iconTarget(sel = selectedNodes()) {
  if (sel.length !== 1 || !inMainComponent(sel[0])) return null;
  const n = sel[0];
  if (n.children && n.type !== 'group') return { parent: n, at: n.children.length };
  const parent = getParent(n.id);
  return { parent, at: parent.children.indexOf(n) + 1 };
}

export const canInsertIcon = () => !!iconTarget();

export function insertIcon(iconId) {
  const target = iconTarget();
  const icon = findIcon(iconId);
  if (!target || !icon) return toast('Select a main component, or a layer in one, to add an icon to it.');
  const { parent, at } = target;
  keepIcons([iconId]);
  const node = createNode('icon', { name: icon.name, iconId });
  if (!isAutoLayout(parent)) {
    node.x = Math.round((parent.w - node.w) / 2);
    node.y = Math.round((parent.h - node.h) / 2);
  }
  insertNode(node, parent, at);
  select([node.id]);
  commit();
  return node;
}

// "Insert icon…": pick an icon, then add it to the selected component.
export function openInsertIcon(anchor) {
  if (!canInsertIcon()) return toast('Icons go inside components: select a main component, or a layer in one, first.');
  openIconPicker({ anchor, onPick: (id) => insertIcon(id) });
}

// Swap the icon of the selected icon layers (in main components; in instances the Icon property does it).
export function openSwapIcon(anchor, nodes = selectedNodes().filter((n) => n.type === 'icon')) {
  if (!nodes.length) return;
  openIconPicker({
    anchor, currentId: nodes[0].iconId,
    onPick: (id) => {
      const icon = findIcon(id);
      for (const n of nodes) {
        editNode(n, ['iconId', 'name'], () => {
          // A layer still named after its old icon takes the new icon's name.
          if (n.name === findIcon(n.iconId)?.name) n.name = icon.name;
          n.iconId = id;
        });
      }
      commit();
    },
  });
}

// The panel section for icon layers: the icon (with Swap), and the stroke width of outline icons.
export function iconLayerInfo(nodes) {
  const ids = new Set(nodes.map((n) => n.iconId));
  const icon = ids.size === 1 ? findIcon([...ids][0]) : null;
  const lib = icon && iconLibraryOf(icon.id);
  const name = ids.size > 1 ? 'Mixed' : icon ? icon.name : 'Icon not available';
  const where = icon?.removed ? 'Removed from its Sigma Icons file' : lib ? `${lib.name}${icon.group ? ` / ${icon.group}` : ''}`
    : icon ? 'From a component library' : 'Its Sigma Icons file isn’t linked';
  return {
    icon, outline: nodes.some((n) => findIcon(n.iconId)?.style === 'outline'),
    html: `<div class="icon-layer-row"><span class="icon-layer-preview">${icon ? iconMarkup(icon, { w: 20, h: 20 }) : ''}</span>` +
      `<span class="icon-layer-name"><span>${esc(name)}</span><span class="muted">${esc(ids.size > 1 ? '' : where)}</span></span></div>`,
  };
}
