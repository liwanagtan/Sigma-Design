// The screen for Sigma Icons files: no canvas. Icons are grouped in a grid with a search; the inspector on
// the right edits the selected icons' names, groups, keywords and style. Icons come in as SVG files
// (picked, dropped or pasted) and are published as versions for Sigma Design files to use.
import { state, commit, subscribe, undo, redo } from './store.js';
import { openHistory, openSaveVersionDialog } from './history.js';
import { goHome, isCurrentSample } from './files.js';
import { saveFile, download, toast } from './io.js';
import { showContextMenu } from './menu.js';
import { icons as uiIcons } from './icons.js';
import { modal } from './libraries.js';
import {
  parseSVGIcon, iconMarkup, iconGroups, iconMatches, iconNameFrom, diffIcons, ICON_STYLES,
} from './icon-library.js';

let root = null;
let selected = new Set(); // icon ids (this screen's own selection, not part of the document)
let anchor = null; // for shift-click ranges
let query = '';
let groupFilter = null; // null: all groups; '' : ungrouped
let styleFilter = 'all'; // 'all' or a style; groups are listed within each style

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const list = () => state.doc?.icons || [];
const byId = (id) => list().find((i) => i.id === id);
const groupLabel = (g) => g || 'Ungrouped';
const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export function initIconsScreen(el) {
  root = el;
  el.innerHTML = `
    <header class="tokens-header">
      <button class="logo-btn" data-icons-menu title="Main menu">${uiIcons.logo}${uiIcons.chevronDown}</button>
      <input class="file-name tokens-file-name icons-file-name" spellcheck="false" aria-label="Sigma Icons file name">
      <span class="kind-badge tokens-kind icons-kind">Sigma Icons</span>
      <div class="tokens-header-actions">
        <span class="publish-status" data-publish-status></span>
        <button class="btn primary" data-publish>Publish…</button>
        <button class="icon-btn" data-undo title="Undo  ⌘Z"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M5 3L2 6l3 3"/><path d="M2 6h7.5a4 4 0 0 1 0 8H7"/></svg></button>
        <button class="icon-btn" data-redo title="Redo  ⇧⌘Z"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M11 3l3 3-3 3"/><path d="M14 6H6.5a4 4 0 0 0 0 8H9"/></svg></button>
      </div>
    </header>
    <div class="icons-body">
      <nav class="icons-groups" data-groups></nav>
      <main class="icons-main">
        <div class="icons-toolbar">
          <input type="search" class="home-search icons-search" placeholder="Search icons" spellcheck="false">
          <span class="spacer"></span>
          <button class="btn primary" data-import>${uiIcons.plus} Import SVGs</button>
        </div>
        <div class="icons-grid" data-grid tabindex="-1"></div>
        <div class="home-drop icons-drop" data-drop hidden><div>Drop <b>.svg</b> files to add them${'<span data-drop-group></span>'}</div></div>
      </main>
      <aside class="icons-inspector" data-inspector></aside>
    </div>`;

  el.querySelector('[data-icons-menu]').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showContextMenu(r.left, r.bottom + 4, [
      { label: 'Back to files', action: goHome },
      '-',
      { label: 'Import SVGs…', action: pickSVGs },
      { label: 'Download a copy (.sigma.json)', action: saveFile },
      '-',
      { label: 'Save to version history…', shortcut: '⌥⌘S', action: () => openSaveVersionDialog() },
      { label: 'Show version history', action: () => openHistory() },
      '-',
      { label: 'Undo', shortcut: '⌘Z', action: undo },
      { label: 'Redo', shortcut: '⇧⌘Z', action: redo },
    ]);
  });
  const name = el.querySelector('.icons-file-name');
  name.addEventListener('change', () => {
    state.doc.name = name.value.trim() || 'Untitled icons';
    commit();
  });
  name.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === 'Escape') && name.blur());
  el.querySelector('[data-publish]').addEventListener('click', openPublishDialog);
  el.querySelector('[data-undo]').addEventListener('click', undo);
  el.querySelector('[data-redo]').addEventListener('click', redo);
  el.querySelector('[data-import]').addEventListener('click', pickSVGs);
  el.querySelector('.icons-search').addEventListener('input', (e) => {
    query = e.target.value;
    renderGrid();
  });
  // Styles, and the groups in each: pick one to show only it (new imports go into the group); double-click
  // a group to rename it.
  const groupsEl = el.querySelector('[data-groups]');
  groupsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-group]');
    if (!b) return;
    styleFilter = b.dataset.style;
    groupFilter = b.dataset.group === '*' ? null : b.dataset.group;
    render();
  });
  groupsEl.addEventListener('dblclick', (e) => {
    const b = e.target.closest('[data-group]');
    if (b && b.dataset.group !== '*' && b.dataset.group !== '') renameGroup(b.dataset.group, b.dataset.style);
  });
  groupsEl.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-group]');
    if (!b || b.dataset.group === '*') return;
    e.preventDefault();
    const g = b.dataset.group, style = b.dataset.style;
    const ids = list().filter((i) => (i.group || '') === g && i.style === style).map((i) => i.id);
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Select all in group', action: () => setSelection(ids) },
      ...(g ? [{ label: 'Rename group…', action: () => renameGroup(g, style) }, { label: 'Ungroup icons', action: () => setGroup(ids, '') }] : []),
      '-',
      { label: `Delete ${plural(ids.length, 'icon')}…`, action: () => deleteIcons(ids) },
    ]);
  });

  // The grid: click to select (⌘ adds, ⇧ selects a range); right-click for more.
  const grid = el.querySelector('[data-grid]');
  grid.addEventListener('click', (e) => {
    const t = e.target.closest('[data-icon]');
    if (!t) return setSelection([]);
    const id = t.dataset.icon;
    if (e.shiftKey && anchor) {
      const order = displayOrder().map((i) => i.id);
      const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
      if (a >= 0) return setSelection([...selected, ...order.slice(a, b + 1)], { keepAnchor: true });
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected);
      next.has(id) ? next.delete(id) : next.add(id);
      anchor = id;
      return setSelection([...next], { keepAnchor: true });
    }
    anchor = id;
    setSelection([id], { keepAnchor: true });
  });
  grid.addEventListener('contextmenu', (e) => {
    const t = e.target.closest('[data-icon]');
    if (!t) return;
    e.preventDefault();
    if (!selected.has(t.dataset.icon)) setSelection([t.dataset.icon]);
    const ids = [...selected];
    showContextMenu(e.clientX, e.clientY, [
      ...(ids.length === 1 ? [{ label: 'Download SVG', action: () => downloadSVG(byId(ids[0])) }, { label: 'Copy SVG code', action: () => copySVG(byId(ids[0])) }, '-'] : []),
      { label: ids.length === 1 ? 'Delete icon' : `Delete ${ids.length} icons`, shortcut: '⌫', action: () => deleteIcons(ids) },
    ]);
  });

  el.querySelector('[data-inspector]').addEventListener('change', onInspectorChange);
  el.querySelector('[data-inspector]').addEventListener('click', onInspectorClick);

  // Drop .svg files anywhere on the screen.
  const drop = el.querySelector('[data-drop]');
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  el.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    drop.querySelector('[data-drop-group]').textContent = groupFilter ? ` to “${groupFilter}”` : '';
    drop.hidden = false;
  });
  el.addEventListener('dragleave', () => {
    if (--depth <= 0) {
      depth = 0;
      drop.hidden = true;
    }
  });
  el.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
  el.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    drop.hidden = true;
    importSVGFiles([...e.dataTransfer.files]);
  });

  window.addEventListener('paste', (e) => {
    if (state.screen !== 'icons' || typing(e.target)) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!/<svg[\s>]/i.test(text)) return;
    e.preventDefault();
    importSVGTexts([{ text, name: 'pasted-icon' }]);
  });

  window.addEventListener('keydown', (e) => {
    if (state.screen !== 'icons' || typing(e.target) || document.querySelector('.modal-backdrop')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      return setSelection(visible().map((i) => i.id));
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
      e.preventDefault();
      return deleteIcons([...selected]);
    }
    if (e.key === 'Escape' && selected.size) setSelection([]);
  });
}

// ---------- import ----------
function pickSVGs() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.svg,image/svg+xml';
  input.multiple = true;
  input.onchange = () => importSVGFiles([...input.files]);
  input.click();
}

async function importSVGFiles(files) {
  const svgs = files.filter((f) => /\.svg$/i.test(f.name) || f.type === 'image/svg+xml');
  if (!svgs.length) return toast('Only .svg files can be added to Sigma Icons.');
  importSVGTexts(await Promise.all(svgs.map(async (f) => ({ text: await f.text(), name: iconNameFrom(f.name) }))));
}

// Icons whose name, group and style are already here are updated in place: same id, so files using them
// update. (An outline and a filled icon can share a name.)
export function importSVGTexts(entries, { group = groupFilter || '' } = {}) {
  if (state.readOnly) return commit(); // shows the read-only hint
  let added = 0, updated = 0;
  const failed = [];
  const ids = [];
  for (const { text, name } of entries) {
    let icon;
    try {
      icon = parseSVGIcon(text, { name, group });
    } catch (err) {
      failed.push(`${name} (${err.message})`);
      continue;
    }
    const same = list().find((i) => i.name === name && (i.group || '') === group && i.style === icon.style);
    if (same) {
      Object.assign(same, { viewBox: icon.viewBox, body: icon.body, style: icon.style, strokeWidth: icon.strokeWidth, cap: icon.cap, join: icon.join });
      ids.push(same.id);
      updated++;
    } else {
      state.doc.icons.push(icon);
      ids.push(icon.id);
      added++;
    }
  }
  if (added || updated) {
    commit();
    setSelection(ids);
  }
  const parts = [added && `Added ${plural(added, 'icon')}`, updated && `updated ${plural(updated, 'icon')}`].filter(Boolean);
  if (parts.length) parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
  toast([parts.join(', '), failed.length && `Couldn’t read ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` and ${failed.length - 3} more` : ''}`].filter(Boolean).join('. '));
  return { added, updated, failed };
}

// ---------- editing ----------
function setSelection(ids, { keepAnchor = false } = {}) {
  selected = new Set(ids.filter((id) => byId(id)));
  if (!keepAnchor) anchor = ids[ids.length - 1] || null;
  renderGrid();
  renderInspector();
}

function setGroup(ids, group) {
  for (const id of ids) {
    const icon = byId(id);
    if (icon) icon.group = group.trim();
  }
  commit();
}

// Rename a group within one style (the same group name in another style is its own group).
function renameGroup(from, style) {
  const to = prompt(`Rename the ${ICON_STYLES[style].toLowerCase()} group “${from}” to:`, from);
  if (to === null || !to.trim() || to.trim() === from) return;
  setGroup(list().filter((i) => (i.group || '') === from && i.style === style).map((i) => i.id), to);
  if (groupFilter === from) groupFilter = to.trim();
  render();
}

function deleteIcons(ids) {
  ids = ids.filter((id) => byId(id));
  if (!ids.length) return;
  if (ids.length > 1 && !confirm(`Delete ${ids.length} icons? Sigma Design files that use them keep them until they accept the next published version.`)) return;
  state.doc.icons = list().filter((i) => !ids.includes(i.id));
  commit();
  setSelection([]);
  toast(ids.length === 1 ? 'Deleted 1 icon (⌘Z to undo)' : `Deleted ${ids.length} icons (⌘Z to undo)`);
}

const svgFile = (icon) => `<svg xmlns="http://www.w3.org/2000/svg" ${iconMarkup(icon, { w: 24, h: 24 }).slice(5)}`;

function downloadSVG(icon) {
  if (icon) download(new Blob([svgFile(icon)], { type: 'image/svg+xml' }), `${icon.name}.svg`);
}

function copySVG(icon) {
  if (icon) navigator.clipboard?.writeText(svgFile(icon)).then(() => toast('Copied the SVG code'));
}

function onInspectorChange(e) {
  const t = e.target;
  const ids = [...selected];
  if (!ids.length || !t.dataset.field) return;
  const field = t.dataset.field;
  for (const id of ids) {
    const icon = byId(id);
    if (!icon) continue;
    if (field === 'name') icon.name = t.value.trim() || icon.name;
    else if (field === 'group') icon.group = t.value.trim();
    else if (field === 'keywords') icon.keywords = t.value.split(',').map((k) => k.trim()).filter(Boolean).join(', ');
    else if (field === 'strokeWidth') icon.strokeWidth = Math.max(0, Number(t.value) || 0);
  }
  commit();
}

function onInspectorClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const ids = [...selected];
  if (b.dataset.setStyle) {
    for (const id of ids) {
      const icon = byId(id);
      if (!icon) continue;
      icon.style = b.dataset.setStyle;
      if (icon.style === 'outline' && !icon.strokeWidth) icon.strokeWidth = 2;
    }
    commit();
  } else if (b.hasAttribute('data-delete')) deleteIcons(ids);
  else if (b.hasAttribute('data-download')) downloadSVG(byId(ids[0]));
  else if (b.hasAttribute('data-copy')) copySVG(byId(ids[0]));
  else if (b.hasAttribute('data-import')) pickSVGs();
}

// ---------- rendering ----------
const visible = () => list().filter((i) => (groupFilter === null || (i.group || '') === groupFilter) &&
  (styleFilter === 'all' || i.style === styleFilter) && iconMatches(i, query));

// Icons by style, then by group (ungrouped last): [{ style, count, groups: [{ name, icons }] }].
function sections(icons) {
  return Object.keys(ICON_STYLES).map((style) => {
    const of = icons.filter((i) => i.style === style);
    const groups = iconGroups(of).sort((a, b) => (!a.name) - (!b.name)).map((g) => ({ name: g.name, icons: of.filter((i) => (i.group || '') === g.name) }));
    return { style, count: of.length, groups };
  }).filter((s) => s.count);
}
// The shown icons in the order the grid shows them.
const displayOrder = () => sections(visible()).flatMap((s) => s.groups.flatMap((g) => g.icons));

export function showIconsScreen() {
  selected = new Set();
  anchor = null;
  query = '';
  groupFilter = null;
  styleFilter = 'all';
  if (root) root.querySelector('.icons-search').value = '';
  render();
}

export function hideIconsScreen() {
  selected = new Set();
}

function render() {
  if (!root || state.screen !== 'icons' || !state.doc) return;
  if (styleFilter !== 'all' && !list().some((i) => i.style === styleFilter)) styleFilter = 'all';
  if (groupFilter !== null && !list().some((i) => (i.group || '') === groupFilter && (styleFilter === 'all' || i.style === styleFilter))) groupFilter = null;
  for (const id of selected) if (!byId(id)) selected.delete(id);
  renderHeader();
  renderGroups();
  renderGrid();
  renderInspector();
}

function renderHeader() {
  const name = root.querySelector('.icons-file-name');
  if (document.activeElement !== name) name.value = state.doc.name || 'Untitled icons';
  document.title = `${state.doc.name || 'Untitled icons'} – Sigma`;
  const pub = state.doc.published;
  const dirty = hasUnpublishedChanges();
  root.querySelector('[data-publish-status]').innerHTML = !pub
    ? '<span class="status-chip">Not published</span>'
    : dirty ? `<span class="status-chip warn">Unpublished changes · v${pub.version} live</span>`
      : `<span class="status-chip ok">v${pub.version} published</span>`;
  root.querySelector('[data-publish]').disabled = (!!pub && !dirty) || !list().length;
}

function renderGroups() {
  const item = (style, key, label, count, cls = '') => {
    const active = styleFilter === style && (key === '*' ? groupFilter === null : groupFilter === key);
    return `<button class="nav-item${cls}${active ? ' active' : ''}" data-style="${style}" data-group="${esc(key)}" title="${key === '*' || key === '' ? '' : 'Double-click to rename'}">` +
      `<span class="icons-group-name">${esc(label)}</span><span class="muted">${count}</span></button>`;
  };
  root.querySelector('[data-groups]').innerHTML = item('all', '*', 'All icons', list().length) +
    sections(list()).map((s) => `<div class="nav-label icons-style-label">${ICON_STYLES[s.style]}</div>` + item(s.style, '*', `All ${ICON_STYLES[s.style].toLowerCase()}`, s.count) +
      s.groups.map((g) => item(s.style, g.name, groupLabel(g.name), g.icons.length, ' sub')).join('')).join('');
}

function renderGrid() {
  if (!root || state.screen !== 'icons') return;
  const grid = root.querySelector('[data-grid]');
  const shown = visible();
  if (!list().length) {
    grid.innerHTML = `<div class="home-empty icons-empty"><div class="home-empty-title">Add your icons</div>
      <p>Import SVG files from a free icon set (Lucide, Tabler, Heroicons, Phosphor, Material Symbols…), drop them here, or paste SVG code.
      Their colors are removed so each icon takes the color of the layer that uses it.</p>
      <div class="home-empty-actions"><button class="btn primary" data-import-empty>${uiIcons.plus} Import SVGs</button></div></div>`;
    grid.querySelector('[data-import-empty]').onclick = pickSVGs;
    return;
  }
  if (!shown.length) {
    grid.innerHTML = `<div class="home-empty"><p>${query ? `No icons match “${esc(query)}”.` : 'No icons here.'}</p></div>`;
    return;
  }
  const tile = (i) => `<button class="icon-tile${selected.has(i.id) ? ' selected' : ''}" data-icon="${i.id}" title="${esc(i.name)}${i.keywords ? ` · ${esc(i.keywords)}` : ''}">` +
    `${iconMarkup(i, { w: 24, h: 24 })}<span class="icon-tile-name">${esc(i.name)}</span></button>`;
  grid.innerHTML = sections(shown).map((s) => `<div class="icons-style-title">${ICON_STYLES[s.style]} <span class="muted">${s.count}</span></div>` +
    s.groups.map((g) => `<section class="icons-section"><div class="icons-section-title">${esc(groupLabel(g.name))} <span class="muted">${g.icons.length}</span></div>` +
      `<div class="icons-tiles">${g.icons.map(tile).join('')}</div></section>`).join('')).join('');
}

function renderInspector() {
  if (!root || state.screen !== 'icons') return;
  const el = root.querySelector('[data-inspector]');
  if (el.contains(document.activeElement) && document.activeElement.matches('input, textarea')) return; // don't replace a field being typed in
  const sel = [...selected].map(byId).filter(Boolean);
  const groups = iconGroups(list()).filter((g) => g.name);
  const datalist = `<datalist id="icon-groups">${groups.map((g) => `<option value="${esc(g.name)}">`).join('')}</datalist>`;
  const styleSeg = (cur) => `<div class="seg">${Object.entries(ICON_STYLES).map(([k, v]) => `<button class="icon-btn${cur === k ? ' on' : ''}" data-set-style="${k}">${v}</button>`).join('')}</div>`;
  if (!sel.length) {
    const outline = list().filter((i) => i.style === 'outline').length;
    el.innerHTML = `<div class="inspector-title">Sigma Icons</div>
      <p class="muted icons-help">${list().length ? `${plural(list().length, 'icon')} in ${plural(groups.length, 'group')}: ${outline} outline, ${list().length - outline} filled.` : 'No icons yet.'}</p>
      <p class="muted icons-help">Import SVGs, drop them anywhere here, or paste SVG code (⌘V). Icons go into the group you have open. Re-importing an icon with the same name, group and style updates it.</p>
      <p class="muted icons-help">Colors are removed on import: an icon takes the color of the layer that shows it. Outline icons keep their stroke width, which components can change.</p>
      <p class="muted icons-help">Publish to let Sigma Design files use these icons in components.</p>
      <button class="btn wide" data-import>${uiIcons.plus} Import SVGs</button>`;
    return;
  }
  if (sel.length === 1) {
    const i = sel[0];
    const [, , vw, vh] = i.viewBox.split(' ').map(Number);
    el.innerHTML = `<div class="icon-preview">${iconMarkup(i, { w: 96, h: 96 })}</div>
      <div class="icon-sizes">${[16, 20, 24, 32].map((s) => `<span title="${s}px">${iconMarkup(i, { w: s, h: s })}</span>`).join('')}</div>
      <label class="inspector-label">Name</label>
      <input class="desc icon-field" data-field="name" value="${esc(i.name)}" spellcheck="false">
      <label class="inspector-label">Group</label>
      <input class="desc icon-field" data-field="group" value="${esc(i.group || '')}" list="icon-groups" placeholder="Ungrouped" spellcheck="false">${datalist}
      <label class="inspector-label">Keywords</label>
      <input class="desc icon-field" data-field="keywords" value="${esc(i.keywords || '')}" placeholder="Words to find it by, comma-separated" spellcheck="false">
      <label class="inspector-label">Style</label>${styleSeg(i.style)}
      ${i.style === 'outline' ? `<label class="inspector-label">Stroke width</label><input class="desc icon-field" type="number" min="0" step="0.25" data-field="strokeWidth" value="${i.strokeWidth}">` : ''}
      <p class="muted icons-help">Drawn on a ${+vw.toFixed(2)} × ${+vh.toFixed(2)} grid.</p>
      <div class="icons-actions"><button class="btn" data-download>Download SVG</button><button class="btn" data-copy>Copy SVG</button></div>
      <button class="btn wide danger" data-delete>Delete icon</button>`;
    return;
  }
  const styles = new Set(sel.map((i) => i.style));
  const groupsOf = new Set(sel.map((i) => i.group || ''));
  const sws = new Set(sel.filter((i) => i.style === 'outline').map((i) => i.strokeWidth));
  el.innerHTML = `<div class="inspector-title">${sel.length} icons</div>
    <div class="icons-multi">${sel.slice(0, 24).map((i) => iconMarkup(i, { w: 20, h: 20 })).join('')}</div>
    <label class="inspector-label">Group</label>
    <input class="desc icon-field" data-field="group" value="${groupsOf.size === 1 ? esc([...groupsOf][0]) : ''}" list="icon-groups" placeholder="${groupsOf.size === 1 ? 'Ungrouped' : 'Mixed'}" spellcheck="false">${datalist}
    <label class="inspector-label">Style</label>${styleSeg(styles.size === 1 ? [...styles][0] : null)}
    ${styles.has('outline') ? `<label class="inspector-label">Stroke width</label><input class="desc icon-field" type="number" min="0" step="0.25" data-field="strokeWidth" value="${sws.size === 1 ? [...sws][0] : ''}" placeholder="Mixed">` : ''}
    <button class="btn wide danger" data-delete>Delete ${sel.length} icons</button>`;
}

// ---------- publishing ----------
const sig = (icons) => JSON.stringify(icons || []);
const hasUnpublishedChanges = () => sig(list()) !== sig(state.doc?.published?.icons);

// Publishing makes the current icons a new numbered version. Sigma Design files that use this file see
// the update and choose when to accept it.
function openPublishDialog() {
  if (isCurrentSample()) return toast('A sample file can’t be published: it isn’t saved. Duplicate it to publish your own.');
  const pub = state.doc.published;
  const d = diffIcons(pub?.icons || [], list());
  const group = (label, items) => (items.length ? `<div class="diff-group"><div class="diff-label">${label} (${items.length})</div>${items.slice(0, 10).map((n) => `<div>${esc(n)}</div>`).join('')}${items.length > 10 ? `<div class="muted">and ${items.length - 10} more</div>` : ''}</div>` : '');
  const next = (pub?.version || 0) + 1;
  const wrap = modal(`Publish ${esc(state.doc.name)}`,
    `<p class="muted">This becomes version ${next}. Sigma Design files that use these icons will be offered the update.</p>
    ${group('Added', d.added) + group('Changed', d.changed) + group('Removed', d.removed) || '<div class="muted">No changes since the last version.</div>'}
    <label class="inspector-label">Notes (optional)</label>
    <textarea class="desc publish-notes" rows="3" placeholder="What changed and why?"></textarea>`,
    `<button class="btn" data-close>Cancel</button><button class="btn primary" data-confirm>Publish v${next}</button>`);
  wrap.querySelector('[data-confirm]').addEventListener('click', () => {
    state.doc.published = { version: next, publishedAt: Date.now(), notes: wrap.querySelector('.publish-notes').value.trim(), icons: structuredClone(list()) };
    commit();
    wrap.querySelector('[data-close]').click();
    toast(`Published v${next}`);
  });
  wrap.querySelector('.publish-notes').focus();
}

subscribe((kind) => {
  if (kind === 'doc') render();
});
