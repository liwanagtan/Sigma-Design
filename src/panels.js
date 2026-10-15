import {lucideIcon} from './lucide.js';
import {
  state, page, view, emit, commit, select, selectedNodes, getNode, getParent, ancestors, isAncestor, isSlotArea, hiddenByWidth,
  uid, detach, insertNode, worldMatrix, setWorldMatrix, createNode, undo, redo, makePaint, isFrameLike, editNode, worldBounds, setShowGrids,
} from './store.js';
import { translate } from './geom.js';
import { icons, layerIcon, UI_ICON_NAMES } from './icons.js';
import {
  setTool, setProps, align, distribute, zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection, zoomAt,
  viewportSize, sortByZ, toggleVisible, toggleLocked, addAutoLayout, removeAutoLayout,
  placeInstance, resetSelectionOverrides, goToMainComponent,
} from './commands.js';
import { isAutoLayout, getSizing, directionOf, activeBreakpoint } from './layout.js';
import {
  isInsideInstance, owningInstance, canPlaceInside, listComponents, overrideCount, defaultVariant, setInstanceProp, componentMatches,
  isDeprecated, mainComponentOf, componentContext, mainTarget,
} from './components.js';
import { exportNodes, saveFile, pickImages } from './io.js';
import { createFile, openFile, goHome, pickFilesToImport, welcomeFile, getCurrentFileId, makeEditableCopy, isCurrentSample } from './files.js';
import {
  pageRuns, pageLabel, groupNames, keepTogether, movePage, moveGroup, renameGroup, ungroup, newGroupName, collapsedGroups, setCollapsedGroups,
} from './page-groups.js';
import {
  componentPanel, onComponentClick, onComponentChange, bindPropertyDrag, propBinding, propMenuItems, openPlayground, APPLY_PROP_ICON,
} from './component-ui.js';
import {
  openLibrariesDialog, openPublishComponentsDialog, componentPublishStatus, openDesignTokensDialog, openIconLibrariesDialog,
} from './libraries.js';
import { openInsertIcon, openSwapIcon, canInsertIcon, iconLayerInfo } from './icon-ui.js';
import { findIcon } from './icon-library.js';
import { openHistory, openSaveVersionDialog } from './history.js';
import { H_CONSTRAINTS, V_CONSTRAINTS, togglePin } from './constraints.js';
import { blankDocument } from './sample.js';
import {
  collections, findVariable, typeForPath, previewValue, bindVariable, unbindVariable, shiftPaintBindings, createCollection,
  createVariable, VAR_TYPES, multiModeCollections, inheritedMode, splitColor, localCollections, libraryOf,
} from './variables.js';
import { openVariablesEditor } from './variables-ui.js';
import { showContextMenu } from './menu.js';
import { openComponentMatrix } from './component-docs.js';
import { stopEditing, TEXT_CASES } from './text.js';
import { toWorld, nodeWorldSVG, strokeSides } from './render.js';
import { GRID_TYPES, newGrid, retypeGrid } from './grids.js';
import { textContrast, contrastBadge } from './contrast.js';
import { openAuditDialog } from './audit-ui.js';
import { projectMenuItems } from './project-ui.js';
import { inspectHTML } from './inspect.js';
import { commentsListHTML, onCommentsListClick, onCommentsListChange } from './comments.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MIXED = Symbol('mixed');

import { FONTS, WEIGHTS } from './fonts.js';
import { ask, isAsking } from './dialogs.js';
const TYPE_LABEL = {
  frame: 'Frame', group: 'Group', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', text: 'Text', image: 'Image',
  component: 'Component', componentSet: 'Component set', instance: 'Instance', icon: 'Icon',
};
const FRAME_PRESETS = [
  ['iPhone 16', 393, 852], ['iPhone 16 Pro Max', 440, 956], ['Android Compact', 412, 917], ['iPad mini', 744, 1133],
  ['Desktop', 1440, 1024], ['MacBook Air', 1280, 832], ['Slide 16:9', 1920, 1080], ['Instagram post', 1080, 1350],
];

// ---------- init ----------
export function initPanels() {
  initToolbar();
  initFileHeader();
  initPages();
  initLayers();
  initProps();
  initAssets();
  initToast();
  window.addEventListener('sigma:rename', (e) => startRename(e.detail));
}

// ---------- toolbar ----------
const TOOLS = [
  ['move', 'Move', 'V'], ['hand', 'Hand tool', 'H'], '|',
  ['frame', 'Frame', 'F'], ['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'O'], ['line', 'Line', 'L'], '|',
  ['text', 'Text', 'T'], ['image', 'Place image', '⇧⌘K'], '|',
  ['comment', 'Comment', 'C'],
];

function initToolbar() {
  const bar = $('#toolbar');
  bar.innerHTML = TOOLS.map((t) => t === '|'
    ? '<div class="tb-sep"></div>'
    : `<button class="tb-btn" data-tool="${t[0]}" data-tip="${t[1]}  ${t[2]}">${icons[t[0]]}</button>`).join('');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    if (b.dataset.tool === 'image') return pickImages();
    setTool(b.dataset.tool);
  });
}

export function renderToolbar() {
  for (const b of document.querySelectorAll('#toolbar [data-tool]')) b.classList.toggle('active', b.dataset.tool === state.tool);
}

// ---------- file header / main menu ----------
function initFileHeader() {
  // The Σ menu and Home are at the top of the file tools rail (rail.js); the menu opens beside it.
  $('#logo-btn').innerHTML = icons.logo;
  $('#home-btn').innerHTML = icons.home;
  $('#home-btn').addEventListener('click', goHome);
  $('#logo-btn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sel = selectedNodes();
    showContextMenu(r.right + 4, r.top, [
      ...(isCurrentSample() ? [{ label: 'Make an editable copy', action: makeEditableCopy }, '-'] : []),
      { label: 'Back to files', action: goHome },
      '-',
      { label: 'New design file', action: async () => openFile(await createFile(blankDocument())) },
      { label: 'Import file…', action: async () => {
        const [id] = await pickFilesToImport();
        if (id) openFile(id);
      } },
      { label: 'Open Welcome to Sigma', action: async () => openFile(await welcomeFile()) },
      { label: 'Download a copy (.sigma.json)', action: saveFile },
      ...(state.doc?.figmaImport ? [{label:'Figma import report…', action:()=>import('./figma-import-ui.js').then(m=>m.showFigmaImportReport(state.doc.figmaImport))}] : []),
      '-',
      { label: 'Place image…', shortcut: '⇧⌘K', action: () => pickImages() },
      { label: sel.length ? 'Export selection as PNG' : 'Export page as PNG', shortcut: '⇧⌘E', action: () => exportNodes(sel.length ? sel : page().children, { format: 'png', scale: 2 }) },
      { label: sel.length ? 'Export selection as SVG' : 'Export page as SVG', action: () => exportNodes(sel.length ? sel : page().children, { format: 'svg' }) },
      '-',
      { label: 'Undo', shortcut: '⌘Z', action: undo },
      { label: 'Redo', shortcut: '⇧⌘Z', action: redo },
      '-',
      ...projectMenuItems(),
      { label: 'Save to version history…', shortcut: '⌥⌘S', action: () => openSaveVersionDialog() },
      { label: 'Show version history', action: () => openHistory() },
      ...(state.doc?.branch
        ? [{ label: `Merge into “${state.doc.branch.ofName}”…`, action: () => import('./branches.js').then((m) => m.openMergeBranch()) }]
        : state.doc && !state.doc.project && !state.doc.kind ? [{ label: 'Create branch…', action: () => import('./branches.js').then((m) => m.openCreateBranch()) }] : []),
      '-',
      { label: 'Design tokens…', action: () => openDesignTokensDialog() },
      { label: 'Browse design tokens…', action: () => openVariablesEditor() },
      { label: 'Audit design tokens…', action: () => openAuditDialog() },
      { label: 'Check accessibility…', action: () => import('./a11y-ui.js').then((m) => m.openAccessibilityCheck()) },
      '-',
      { label: 'Component libraries…', action: () => openLibrariesDialog() },
      { label: 'Icon libraries…', action: () => openIconLibrariesDialog() },
      { label: 'Publish components…', action: () => openPublishComponentsDialog() },
      { label: 'Component status…', action: () => openComponentMatrix() },
      { label: 'Changelog…', action: () => import('./changelog.js').then((m) => m.openChangelog()) },
      { label: 'Export documentation page', action: () => import('./doc-site.js').then((m) => m.exportDocumentationPage()) },
      '-',
      { label: 'Keyboard shortcuts', shortcut: '?', action: showShortcuts },
    ]);
  });
  const input = $('#file-name');
  input.addEventListener('change', () => {
    state.doc.name = input.value.trim() || 'Untitled';
    commit();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') input.blur();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === '?' && state.screen === 'editor' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) showShortcuts();
  });
}

export function renderFileHeader() {
  const input = $('#file-name');
  if (document.activeElement !== input) input.value = state.doc.name || 'Untitled';
  input.readOnly = !!state.readOnly || !!state.viewOnly;
  document.title = `${state.doc.name || 'Untitled'} – Sigma`;
}

function showShortcuts() {
  const rows = [
    ['Tools', [['Move', 'V'], ['Hand / pan', 'H or hold Space'], ['Frame', 'F'], ['Rectangle', 'R'], ['Ellipse', 'O'], ['Line', 'L'], ['Text', 'T'], ['Place image', '⇧⌘K'], ['Comment', 'C']]],
    ['Canvas', [['Zoom in / out', '⌘+ / ⌘−  or ⌘-scroll / pinch'], ['Zoom to 100%', '⇧0'], ['Zoom to fit', '⇧1'], ['Zoom to selection', '⇧2'], ['Pan', 'Scroll / Space-drag'], ['Show / hide layout grids', '⌃G']]],
    ['Selection', [['Select all', '⌘A'], ['Deep select', '⌘-click'], ['Select inside', 'Double-click / Enter'], ['Select parent', '⇧Enter'], ['Measure distance', 'Hold ⌥']]],
    ['Edit', [['Undo / Redo', '⌘Z / ⇧⌘Z'], ['Copy / Paste / Cut', '⌘C / ⌘V / ⌘X'], ['Duplicate', '⌘D or ⌥-drag'], ['Delete', '⌫'], ['Group / Ungroup', '⌘G / ⇧⌘G'], ['Frame selection', '⌥⌘G'], ['Add / remove auto layout', '⇧A / ⌥⇧A'], ['Create component', '⌥⌘K'], ['Detach instance', '⌥⌘B'], ['Save to version history', '⌥⌘S'], ['Reorder in auto layout', 'Drag or arrow keys'], ['Nudge', 'Arrows (⇧ = 10px)'], ['Bring forward / Send backward', '⌘] / ⌘['], ['To front / To back', '⌥⌘] / ⌥⌘['], ['Hide / Lock', '⇧⌘H / ⇧⌘L'], ['Rename', '⌘R'], ['Flip', '⇧H / ⇧V']]],
    ['Transform', [['Keep proportions', 'Hold ⇧ while resizing'], ['Resize from center', 'Hold ⌥ while resizing'], ['Snap rotation to 15°', 'Hold ⇧ while rotating'], ['Disable snapping', 'Hold ⌘ while dragging']]],
  ];
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal"><div class="modal-head">Keyboard shortcuts<button class="icon-btn" data-close>${icons.close}</button></div><div class="modal-body">` +
    rows.map(([title, items]) => `<div class="sc-group"><div class="sc-title">${title}</div>${items.map(([a, b]) => `<div class="sc-row"><span>${a}</span><kbd>${esc(b)}</kbd></div>`).join('')}</div>`).join('') +
    '</div></div>';
  const close = () => {
    wrap.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (isAsking()) return; // Escape is the open dialog's
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      close();
    }
  };
  wrap.addEventListener('click', (e) => (e.target === wrap || e.target.closest('[data-close]')) && close());
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(wrap);
}

// ---------- pages ----------
// The pages list, with page groups (page-groups.js): a header per group, collapsible, its pages under it;
// right-click menus to make and change groups; drag to reorder pages and groups; a filter for long lists.
let pageFilter = '';
let pageDrag = null; // { page: id } or { group: name }
const FILTER_FROM = 12; // pages; more than this shows the filter

const pagesOf = () => state.doc.pages;
const groupOfPage = (id) => pagesOf().find((p) => p.id === id)?.group || null;
function addPage({ group = null, after = null } = {}) {
  const pg = { id: uid(), name: `Page ${pagesOf().length + 1}`, background: '#F5F5F5', children: [], ...(group ? { group } : {}) };
  const at = after ? pagesOf().findIndex((p) => p.id === after) + 1 : pagesOf().length;
  pagesOf().splice(at || pagesOf().length, 0, pg);
  keepTogether(pagesOf());
  switchPage(pg.id);
  commit();
  return pg;
}
function deletePages(list) {
  const gone = new Set(list.map((p) => p.id));
  if (gone.size >= pagesOf().length) return;
  const wasCurrent = gone.has(state.doc.currentPageId);
  const i = pagesOf().findIndex((p) => p.id === state.doc.currentPageId);
  state.doc.pages = pagesOf().filter((p) => !gone.has(p.id));
  if (wasCurrent) switchPage((pagesOf()[Math.min(i, pagesOf().length - 1)] || pagesOf()[0]).id);
  commit();
}
// Delete pages (or a group's) after asking; ⌘Z brings them back.
async function confirmDeletePages(list, group = null) {
  const what = group ? `“${group}” and its ${list.length === 1 ? 'page' : `${list.length} pages`}` : `page “${list[0].name}”`;
  if (await ask('Everything on it goes too. ⌘Z undoes it.', { title: `Delete ${what}?`, ok: group ? 'Delete group' : 'Delete page', danger: true })) deletePages(list);
}
function setCollapsed(group, on) {
  const set = collapsedGroups(getCurrentFileId());
  if (on) set.add(group);
  else set.delete(group);
  setCollapsedGroups(getCurrentFileId(), set);
  renderPages();
}
// Rename a group in place, on its header (after making it, too).
function renameGroupInline(group) {
  const head = [...$('#pages-list').querySelectorAll('[data-group]')].find((h) => h.dataset.group === group);
  if (!head) return;
  inlineRename(head.querySelector('.name'), group, (name) => {
    const was = collapsedGroups(getCurrentFileId());
    if (was.delete(group)) setCollapsedGroups(getCurrentFileId(), was.add(name.trim()));
    renameGroup(pagesOf(), group, name);
    commit();
  });
}
function newGroupWith(pg) {
  const name = newGroupName(pagesOf());
  movePage(pagesOf(), pg.id, { group: name, beforeId: pagesOf()[pagesOf().indexOf(pg) + 1]?.id || null });
  commit();
  renderPages();
  renameGroupInline(name);
}

function initPages() {
  $('#add-page').innerHTML = icons.plus;
  $('#add-page').title = 'New page or group';
  $('#add-page').addEventListener('click', (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const cur = page();
    showContextMenu(r.left, r.bottom + 4, [
      { label: cur.group ? `New page in “${cur.group}”` : 'New page', action: () => addPage({ group: cur.group || null, after: cur.id }) },
      ...(cur.group ? [{ label: 'New page (no group)', action: () => addPage() }] : []),
      { label: 'New group', action: () => {
        const name = newGroupName(pagesOf());
        addPage({ group: name });
        renderPages();
        renameGroupInline(name);
      } },
    ]);
  });
  const filter = document.createElement('input');
  filter.id = 'pages-filter';
  filter.className = 'prop-input pages-filter';
  filter.placeholder = 'Filter pages';
  filter.spellcheck = false;
  filter.hidden = true;
  filter.addEventListener('input', () => {
    pageFilter = filter.value;
    renderPages();
  });
  filter.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      filter.value = pageFilter = '';
      renderPages();
      filter.blur();
    }
  });
  $('#pages-list').before(filter);

  const list = $('#pages-list');
  list.addEventListener('click', (e) => {
    const head = e.target.closest('[data-group]');
    if (head) return setCollapsed(head.dataset.group, !head.classList.contains('collapsed'));
    const row = e.target.closest('[data-page]');
    if (!row) return;
    if (e.target.closest('[data-del]')) {
      const pg = pagesOf().find((p) => p.id === row.dataset.page);
      if (pg) confirmDeletePages([pg]);
      return;
    }
    switchPage(row.dataset.page);
  });
  // Right-click a page: rename, mark for handoff (the design system use report can count only those pages),
  // move to a group, delete. Right-click a group: rename, a new page in it, ungroup, delete it.
  list.addEventListener('contextmenu', (e) => {
    const head = e.target.closest('[data-group]');
    if (head) {
      e.preventDefault();
      const group = head.dataset.group;
      const members = pagesOf().filter((p) => p.group === group);
      return showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename group', action: () => renameGroupInline(group) },
        { label: 'New page in group', action: () => addPage({ group, after: members.at(-1).id }) },
        '-',
        { label: 'Collapse all groups', action: () => {
          setCollapsedGroups(getCurrentFileId(), new Set(groupNames(pagesOf())));
          renderPages();
        } },
        { label: 'Expand all groups', action: () => {
          setCollapsedGroups(getCurrentFileId(), new Set());
          renderPages();
        } },
        '-',
        { label: 'Ungroup', action: () => {
          ungroup(pagesOf(), group);
          commit();
        } },
        { label: `Delete group and its ${members.length === 1 ? 'page' : `${members.length} pages`}`, disabled: members.length >= pagesOf().length, action: () => confirmDeletePages(members, group) },
      ]);
    }
    const row = e.target.closest('[data-page]');
    if (!row) return;
    e.preventDefault();
    const pg = pagesOf().find((p) => p.id === row.dataset.page);
    const others = groupNames(pagesOf()).filter((g) => g !== pg.group);
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Rename', action: () => inlineRename(row.querySelector('.name'), pg.name, (name) => {
        pg.name = name;
        commit();
      }) },
      { label: pg.handoff ? 'Unmark for handoff' : 'Mark for handoff', action: () => {
        if (pg.handoff) delete pg.handoff;
        else pg.handoff = true;
        commit();
      } },
      '-',
      ...others.map((g) => ({ label: `Move to “${g}”`, action: () => {
        movePage(pagesOf(), pg.id, { group: g });
        setCollapsed(g, false);
        commit();
      } })),
      { label: 'Move to new group', action: () => newGroupWith(pg) },
      ...(pg.group ? [{ label: 'Remove from group', action: () => {
        // Out of the group, just after it.
        const after = pagesOf().filter((p) => p.group === pg.group && p !== pg).at(-1);
        const next = after ? pagesOf()[pagesOf().indexOf(after) + 1] : null;
        movePage(pagesOf(), pg.id, { group: null, beforeId: next && next !== pg ? next.id : null });
        commit();
      } }] : []),
      ...(pagesOf().length > 1 ? ['-', { label: 'Delete page', action: () => confirmDeletePages([pg]) }] : []),
    ]);
  });
  list.addEventListener('dblclick', (e) => {
    const head = e.target.closest('[data-group]');
    if (head) return renameGroupInline(head.dataset.group);
    const row = e.target.closest('[data-page]');
    if (!row) return;
    const pg = pagesOf().find((p) => p.id === row.dataset.page);
    inlineRename(row.querySelector('.name'), pg.name, (name) => {
      pg.name = name;
      commit();
    });
  });

  // Drag a page to reorder it (into or out of a group), or a group's header to move the whole group.
  list.addEventListener('dragstart', (e) => {
    const head = e.target.closest('[data-group]');
    const row = e.target.closest('[data-page]');
    if (!head && !row) return;
    pageDrag = head ? { group: head.dataset.group } : { page: row.dataset.page };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'pages');
  });
  const clearMarks = () => list.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach((r) => r.classList.remove('drop-before', 'drop-after', 'drop-inside'));
  // Where a drop lands: { el, pos: 'before' | 'after' | 'inside' } (inside: into a group, on its header).
  const dropAt = (e) => {
    const el = e.target.closest('[data-group], [data-page]');
    if (!el || !pageDrag) return null;
    const r = el.getBoundingClientRect();
    const t = (e.clientY - r.top) / r.height;
    if (el.dataset.group) {
      if (pageDrag.page) return { el, pos: t < 0.3 ? 'before' : 'inside' };
      return el.dataset.group === pageDrag.group ? null : { el, pos: 'before' };
    }
    if (pageDrag.group && el.dataset.page && groupOfPage(el.dataset.page) === pageDrag.group) return null;
    if (pageDrag.page === el.dataset.page) return null;
    return { el, pos: t < 0.5 ? 'before' : 'after' };
  };
  list.addEventListener('dragover', (e) => {
    const at = dropAt(e);
    if (!at) return;
    e.preventDefault();
    clearMarks();
    at.el.classList.add(`drop-${at.pos}`);
  });
  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget)) clearMarks();
  });
  list.addEventListener('dragend', () => {
    pageDrag = null;
    clearMarks();
  });
  list.addEventListener('drop', (e) => {
    const at = dropAt(e);
    e.preventDefault();
    clearMarks();
    const drag = pageDrag;
    pageDrag = null;
    if (!at || !drag) return;
    const pages = pagesOf();
    const nextId = (id) => pages[pages.findIndex((p) => p.id === id) + 1]?.id || null;
    if (at.el.dataset.group) {
      const g = at.el.dataset.group;
      const first = pages.find((p) => p.group === g);
      if (drag.page) {
        if (at.pos === 'inside') movePage(pages, drag.page, { group: g });
        else movePage(pages, drag.page, { group: null, beforeId: first.id });
      } else moveGroup(pages, drag.group, first.id);
    } else {
      const target = at.el.dataset.page;
      if (drag.page) {
        // Joins the group of the page it's dropped by.
        movePage(pages, drag.page, { group: groupOfPage(target), beforeId: at.pos === 'before' ? target : nextId(target) });
      } else {
        // A group goes before or after the page, or before or after that page's whole group.
        const g = groupOfPage(target);
        const members = g ? pages.filter((p) => p.group === g) : [pages.find((p) => p.id === target)];
        moveGroup(pages, drag.group, at.pos === 'before' ? members[0].id : nextId(members.at(-1).id));
      }
    }
    commit();
    // A page dropped into a collapsed group: open it, so the page stays in view.
    const g = drag.page && groupOfPage(drag.page);
    if (g && collapsedGroups(getCurrentFileId()).has(g)) setCollapsed(g, false);
  });
}

// Apply a half-edited properties field to the current selection before the selection changes.
export function commitFocusedField() {
  const a = document.activeElement;
  if (a && a !== document.body && $('#props').contains(a)) a.blur();
}

function switchPage(id) {
  if (state.editingTextId) stopEditing();
  commitFocusedField();
  state.doc.currentPageId = id;
  state.selection = [];
  state.hoverId = null;
  const fresh = !state.pageViews[id];
  // The open page's group opens.
  const g = groupOfPage(id);
  const collapsed = collapsedGroups(getCurrentFileId());
  if (g && collapsed.delete(g)) setCollapsedGroups(getCurrentFileId(), collapsed);
  emit('doc');
  if (fresh) requestAnimationFrame(() => zoomToFit());
}

export function renderPages() {
  const list = $('#pages-list');
  if (list.querySelector('input')) return;
  const pages = pagesOf();
  const filter = $('#pages-filter');
  if (filter) {
    filter.hidden = pages.length <= FILTER_FROM && !pageFilter;
    if (filter.hidden && pageFilter) pageFilter = filter.value = '';
  }
  const q = pageFilter.trim().toLowerCase();
  const many = pages.length > 1;
  const current = page().id;
  const collapsed = q ? new Set() : collapsedGroups(getCurrentFileId());
  const pageRow = (p, inGroup) =>
    `<div class="page-row${p.id === current ? ' active' : ''}${inGroup ? ' in-group' : ''}" data-page="${p.id}" draggable="${!q}">` +
    `<span class="check">${p.id === current ? '✓' : ''}</span><span class="name">${esc(p.name)}</span>` +
    (p.handoff ? '<span class="kind-badge handoff-badge" title="Marked for handoff">Handoff</span>' : '') +
    (many ? `<button class="icon-btn row-btn" data-del title="Delete page">${icons.close}</button>` : '') + '</div>';
  let html = '';
  for (const run of pageRuns(pages)) {
    const shown = q ? run.pages.filter((p) => p.name.toLowerCase().includes(q) || (run.group || '').toLowerCase().includes(q)) : run.pages;
    if (!shown.length) continue;
    if (!run.group) {
      html += shown.map((p) => pageRow(p, false)).join('');
      continue;
    }
    const closed = collapsed.has(run.group);
    const holdsCurrent = run.pages.some((p) => p.id === current);
    html += `<div class="page-group${closed ? ' collapsed' : ''}${holdsCurrent ? ' has-active' : ''}" data-group="${esc(run.group)}" draggable="${!q}" title="${closed ? 'Show' : 'Hide'} its pages">` +
      `<span class="chev">${closed ? icons.chevronRight : icons.chevronDown}</span><span class="name">${esc(run.group)}</span>` +
      `<span class="count">${run.pages.length}</span></div>`;
    if (!closed) html += shown.map((p) => pageRow(p, true)).join('');
  }
  list.innerHTML = html || '<div class="muted pages-none">No pages match</div>';
}

function inlineRename(span, value, done) {
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = value;
  span.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  const finish = (ok) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    input.remove();
    if (ok && v && v !== value) done(v);
    else emit('doc');
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
}

// ---------- layers ----------
let dragIds = null;

function initLayers() {
  const list = $('#layers-list');
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.layer-row');
    if (!row || e.target.closest('input')) return;
    const n = getNode(row.dataset.id);
    if (!n) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'vis') return toggleVisible([n]);
    if (act === 'lock') return toggleLocked([n]);
    if (e.target.closest('.chev')) {
      state.collapsed.has(n.id) ? state.collapsed.delete(n.id) : state.collapsed.add(n.id);
      return emit('selection');
    }
    if (state.editingTextId) stopEditing();
    commitFocusedField();
    if (e.metaKey || e.ctrlKey) select([n.id], { toggle: true });
    else if (e.shiftKey) select([n.id], { add: true });
    else select([n.id]);
  });
  list.addEventListener('contextmenu',e=>{
    const row=e.target.closest('.layer-row');if(!row)return;
    e.preventDefault();const n=getNode(row.dataset.id);if(!n)return;select([n.id]);
    const target=mainTarget(n),set=n.type==='component'&&getParent(n.id)?.type==='componentSet'?getParent(n.id):null;
    showContextMenu(e.clientX,e.clientY,[
      ...(target&&target!==n?[{label:'Go to main component',action:goToMainComponent}]:[]),
      ...(set?[{label:'Go to component set',action:()=>{select([set.id]);zoomToSelection();}}]:[]),
      {label:'Rename',action:()=>startRename(n.id)},
    ]);
  });
  list.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.layer-row');
    if (row && e.target.closest('.name')) startRename(row.dataset.id);
  });
  list.addEventListener('pointerover', (e) => {
    const id = e.target.closest('.layer-row')?.dataset.id || null;
    if (id !== state.hoverId) {
      state.hoverId = id;
      emit('overlay');
    }
  });
  list.addEventListener('pointerleave', () => {
    state.hoverId = null;
    emit('overlay');
  });

  // Drag & drop reordering
  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.layer-row');
    if (!row) return;
    const id = row.dataset.id;
    if (!state.selection.includes(id)) select([id]);
    dragIds = [...state.selection];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'layers');
  });
  const clearMarks = () => list.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach((r) => r.classList.remove('drop-before', 'drop-after', 'drop-inside'));
  const dropPos = (e, row) => {
    const n = getNode(row.dataset.id);
    const r = row.getBoundingClientRect();
    const t = (e.clientY - r.top) / r.height;
    if (n?.children && t > 0.25 && t < 0.75) return 'inside';
    return t < 0.5 ? 'before' : 'after';
  };
  list.addEventListener('dragover', (e) => {
    const row = e.target.closest('.layer-row');
    if (!dragIds || !row) return;
    const target = getNode(row.dataset.id);
    if (dragIds.some((id) => id === target.id || isAncestor(getNode(id), target))) return;
    const pos = dropPos(e, row);
    const dest = pos === 'inside' ? target : getParent(target.id);
    if (!dragIds.every((id) => !isInsideInstance(getNode(id)) && canPlaceInside(getNode(id), dest))) return;
    e.preventDefault();
    clearMarks();
    row.classList.add(`drop-${pos}`);
  });
  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget)) clearMarks();
  });
  list.addEventListener('drop', (e) => {
    e.preventDefault();
    clearMarks();
    const row = e.target.closest('.layer-row');
    if (!dragIds || !row) return;
    const target = getNode(row.dataset.id);
    const pos = dropPos(e, row);
    const parent = pos === 'inside' ? target : getParent(target.id);
    const nodes = sortByZ(dragIds.map(getNode).filter(Boolean))
      .filter((n) => n !== target && !isAncestor(n, target) && !isInsideInstance(n) && canPlaceInside(n, parent));
    dragIds = null;
    if (!nodes.length) return;
    const seq = pos === 'before' ? [...nodes].reverse() : nodes;
    for (const n of seq) {
      const M = worldMatrix(n);
      detach(n);
      const list2 = parent ? parent.children : page().children;
      let at = list2.length;
      if (pos === 'before') at = list2.indexOf(target) + 1;
      if (pos === 'after') at = list2.indexOf(target);
      insertNode(n, parent, at);
      setWorldMatrix(n, M);
    }
    if (pos === 'inside') state.collapsed.delete(target.id);
    select(nodes.map((n) => n.id));
    commit();
  });
  list.addEventListener('dragend', () => {
    dragIds = null;
    clearMarks();
  });
}

function startRename(id) {
  const n = getNode(id);
  if (!n) return;
  for (const a of ancestors(n)) state.collapsed.delete(a.id);
  renderLayers(true);
  const row = $(`#layers-list .layer-row[data-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'nearest' });
  inlineRename(row.querySelector('.name'), n.name, (name) => {
    editNode(n, ['name'], () => {
      n.name = name;
      n.autoName = false;
    });
    commit();
  });
}

export function renderLayers(force = false) {
  const list = $('#layers-list');
  if (!force && list.querySelector('input')) return;
  const sel = new Set(state.selection);
  const rows = [];
  const walkRows = (nodes, depth, inSelected, inInstance) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const kids = n.children?.length;
      const open = kids && !state.collapsed.has(n.id);
      const cls = ['layer-row', n.type];
      if (inInstance) cls.push('in-instance');
      if(componentContext(n))cls.push('component-context');
      if (n.type === 'component' || n.type === 'instance' || n.type === 'componentSet') cls.push('componentish');
      if (sel.has(n.id)) cls.push('selected');
      else if (inSelected) cls.push('in-selected');
      if (!n.visible || hiddenByWidth.has(n)) cls.push('is-hidden'); // hidden, or by a breakpoint at this width
      if (n.locked) cls.push('is-locked');
      if (state.hoverId === n.id) cls.push('hover');
      rows.push(
        `<div class="${cls.join(' ')}" data-id="${n.id}" draggable="true" style="--depth:${depth}">` +
        `<span class="chev">${kids ? (open ? icons.chevronDown : icons.chevronRight) : ''}</span>` +
        `<span class="licon">${layerIcon(n)}</span><span class="name"${n.visible && hiddenByWidth.has(n) ? ' title="Hidden at this width by a breakpoint of the frame it’s in"' : ''}>${esc(n.name)}</span>` +
        `<span class="row-actions"><button class="icon-btn" data-act="lock" title="Lock">${n.locked ? icons.lock : icons.unlock}</button>` +
        `<button class="icon-btn" data-act="vis" title="Show/hide">${n.visible ? icons.eye : icons.eyeOff}</button></span></div>`,
      );
      if (open) walkRows(n.children, depth + 1, inSelected || sel.has(n.id), (inInstance || n.type === 'instance') && !isSlotArea(n)); // a slot's contents are editable
    }
  };
  walkRows(page().children, 0, false);
  list.innerHTML = rows.join('') || '<div class="empty-hint">Use the toolbar below to add frames, shapes and text.</div>';
  const first = list.querySelector('.layer-row.selected');
  if (first && lastScrolledSelection !== state.selection.join()) {
    lastScrolledSelection = state.selection.join();
    first.scrollIntoView({ block: 'nearest' });
  }
}
let lastScrolledSelection = '';

export function highlightLayerHover() {
  for (const r of document.querySelectorAll('#layers-list .layer-row')) r.classList.toggle('hover', r.dataset.id === state.hoverId);
}

// ---------- properties ----------
const pct = (key) => ({
  get: (n) => Math.round((n[key] ?? 1) * 100),
  set: (v) => ({ [key]: Math.min(100, Math.max(0, v)) / 100 }),
  suffix: '%',
});
const num = (key, min = -Infinity) => ({ get: (n) => n[key], set: (v) => ({ [key]: Math.max(min, v) }) });

const FIELDS = {
  x: num('x'), y: num('y'), w: num('w', 0.01), h: num('h', 0.01),
  rotation: { get: (n) => -(n.rotation || 0), set: (v) => ({ rotation: -(((v + 180) % 360 + 360) % 360 - 180) }), suffix: '°' },
  radius: {
    get: (n) => (Array.isArray(n.radii) && n.radii.some((r) => r !== n.radii[0]) ? 'Mixed' : n.radii ? n.radii[0] : n.radius),
    set: (v) => ({ radius: Math.max(0, v) }),
  },
  maxLines: {
    get: (n) => (n.maxLines === undefined || n.maxLines === null ? '' : n.maxLines),
    set: (v) => ({ maxLines: Math.max(1, Math.round(v)) }), auto: /^\s*$/, autoValue: { maxLines: undefined },
  },
  // Min / max sizes: empty means no limit.
  ...Object.fromEntries(['minW', 'maxW', 'minH', 'maxH'].map((k) => [k, {
    get: (n) => (n[k] === undefined || n[k] === null ? '' : n[k]), set: (v) => ({ [k]: Math.max(0, v) }),
    auto: /^\s*$/, autoValue: { [k]: undefined },
  }])),
  ...Object.fromEntries(['TL', 'TR', 'BR', 'BL'].map((c, i) => [`radius${c}`, {
    get: (n) => (Array.isArray(n.radii) ? n.radii[i] : n.radius || 0),
    set: (v) => ({ [`radii.${i}`]: Math.max(0, v) }),
  }])),
  opacity: pct('opacity'),
  strokeWidth: num('strokeWidth', 0),
  // Outline icons: the stroke width in the icon's own units (empty: the icon's own).
  iconStroke: {
    get: (n) => n.iconStroke ?? findIcon(n.iconId)?.strokeWidth ?? 2, set: (v) => ({ iconStroke: Math.max(0, v) }),
    auto: /^\s*$/, autoValue: { iconStroke: undefined },
  },
  fontSize: num('fontSize', 1),
  lineHeight: { get: (n) => n.lineHeight ?? 'Auto', set: (v) => ({ lineHeight: v }), suffix: '%', auto: /^\s*(auto)?\s*$/i, autoValue: { lineHeight: null } },
  letterSpacing: num('letterSpacing'),
  // Auto layout
  gap: {
    get: (n) => (n.layout ? (n.layout.spacing === 'auto' ? 'Auto' : n.layout.gap) : 0),
    set: (v) => ({ 'layout.gap': Math.max(0, v), 'layout.spacing': 'packed' }),
    auto: /^\s*auto\s*$/i, autoValue: { 'layout.spacing': 'auto' },
  },
  padH: {
    get: (n) => (n.layout ? (n.layout.pl === n.layout.pr ? n.layout.pl : 'Mixed') : 0),
    set: (v) => ({ 'layout.pl': Math.max(0, v), 'layout.pr': Math.max(0, v) }),
  },
  padV: {
    get: (n) => (n.layout ? (n.layout.pt === n.layout.pb ? n.layout.pt : 'Mixed') : 0),
    set: (v) => ({ 'layout.pt': Math.max(0, v), 'layout.pb': Math.max(0, v) }),
  },
};

function common(nodes, get) {
  let v;
  for (let i = 0; i < nodes.length; i++) {
    const x = get(nodes[i]);
    if (i === 0) v = x;
    else if (x !== v) return MIXED;
  }
  return v;
}

const fmtNum = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : v);

function evalNum(str) {
  const s = String(str).replace(/[%°px\s]/g, '').replace(/,/g, '.');
  if (!s || !/^[-+*/().\d]+$/.test(s)) return null;
  try {
    const v = Function(`"use strict";return (${s})`)();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function normHex(str) {
  let h = String(str).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{1,2}$/i.test(h)) h = h.padStart(2, h[0]).repeat(3);
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toUpperCase()}` : null;
}

// Fields that can be bound to number variables, and the property path they bind.
const FIELD_BIND = {
  w: 'w', h: 'h', radius: 'radius', opacity: 'opacity', strokeWidth: 'strokeWidth', fontSize: 'fontSize', iconStroke: 'iconStroke',
  radiusTL: 'radii.0', radiusTR: 'radii.1', radiusBR: 'radii.2', radiusBL: 'radii.3',
  minW: 'minW', maxW: 'maxW', minH: 'minH', maxH: 'maxH',
  lineHeight: 'lineHeight', letterSpacing: 'letterSpacing', gap: 'layout.gap',
};

function numField(key, label, nodes, { icon } = {}) {
  const f = FIELDS[key];
  const path = FIELD_BIND[key];
  const bound = path ? boundVar(nodes, path) : null;
  const fieldName=({rotation:'Rotation',radius:'Corner radius',minW:'Minimum width',maxW:'Maximum width',minH:'Minimum height',maxH:'Maximum height',gap:'Gap',padH:'Horizontal padding',padV:'Vertical padding'})[key]||label||key;
  const limit=/^(min|max)[WH]$/.test(key);
  const head = `<label ${['gap','padH','padV'].includes(key)?`data-layout-preview="${key}"`:""} title="${esc(fieldName)}" class="field${path ? ' bindable' : ''}"><span class="field-label" data-scrub="${key}">${icon || label}</span>`;
  if (bound && bound !== MIXED) return `${head}${varChip(path, bound)}</label>`;
  const v = common(nodes, f.get);
  const shown = v === MIXED ? '' : fmtNum(v);
  return `${head}<input aria-label="${esc(fieldName)}" data-key="${key}" value="${esc(shown)}"${v === MIXED ? ' placeholder="Mixed"' : limit?' placeholder="None"':''} spellcheck="false">` +
    (path ? varButton(path) : '') + '</label>';
}

// ---------- variable modes ----------
// One picker per collection that has several modes: "Auto" inherits, or pin a specific mode.
// nodes = null edits the current page.
function modeRows(nodes) {
  const cols = multiModeCollections();
  if (!cols.length) return '';
  return cols.map((col) => {
    let current, inherited;
    if (nodes) {
      current = common(nodes, (n) => n.modes?.[col.id] || '');
      inherited = inheritedMode(nodes[0], col, ancestors, () => page());
    } else {
      current = page().modes?.[col.id] || '';
      inherited = null;
    }
    // "Auto" inherits; for an extended collection that nothing applies, it means "not applied".
    const inheritedName = col.modes.find((m) => m.id === (inherited || col.defaultModeId))?.name || '';
    const autoLabel = col.extends && !inherited ? 'Not applied' : `Auto (${inheritedName})`;
    return `<label class="bind-row mode-row" title="Token mode for ${esc(col.name)}"><span>${esc(col.name)}</span>` +
      `<select class="select" data-mode-col="${col.id}" data-mode-target="${nodes ? 'layers' : 'page'}">` +
      (current === MIXED ? '<option selected disabled>Mixed</option>' : '') +
      `<option value="" ${current === '' ? 'selected' : ''}>${esc(autoLabel)}</option>` +
      col.modes.map((m) => `<option value="${m.id}" ${current === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('') +
      '</select></label>';
  }).join('');
}

function setMode(target, colId, modeId) {
  const apply = (obj) => {
    const modes = { ...(obj.modes || {}) };
    if (modeId) modes[colId] = modeId;
    else delete modes[colId];
    if (Object.keys(modes).length) obj.modes = modes;
    else delete obj.modes;
  };
  if (target === 'page') apply(page());
  else for (const n of selectedNodes()) editNode(n, ['modes'], () => apply(n));
  commit();
}

// ---------- variable bindings ----------
const VAR_ICON = lucideIcon('variable',12);

// The variable all `nodes` bind at `path`: a variable, MIXED, or null when unbound.
function boundVar(nodes, path) {
  const ids = new Set(nodes.map((n) => n.bindings?.[path] || null));
  if (ids.size !== 1) return MIXED;
  const id = [...ids][0];
  return id ? findVariable(id)?.variable || { id, name: 'Missing token' } : null;
}

const varChip = (path, v) =>
  `<button class="var-chip${v.deprecated ? ' deprecated' : ''}" data-var-menu="${path}" title="${esc(v.name)}${v.deprecated ? ` is deprecated${v.description ? `: ${esc(v.description)}` : ''}` : ''} — click to change or detach">${VAR_ICON}<span>${esc(v.name.split('/').pop())}</span></button>`;
const varButton = (path) => `<button class="icon-btn var-btn" data-var-menu="${path}" title="Apply design token">${VAR_ICON}</button>`;
const varControl = (nodes, path) => {
  const pill = propBinding(nodes, path); // a component property wins over a token
  if (pill) return pill;
  const b = boundVar(nodes, path);
  return b && b !== MIXED ? varChip(path, b) : varButton(path);
};

function readPath(node, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), node);
}

function previewText(v) {
  const val = previewValue(v.id);
  if (v.type === 'boolean') return val ? 'True' : 'False';
  if (v.type === 'typography') return val ? `${val.fontFamily} ${val.fontSize}` : '';
  if (v.type === 'shadow') return val ? `${val.x ?? 0} ${val.y ?? 0} ${val.blur ?? 0} ${val.spread ?? 0}` : '';
  if (v.type === 'color') {
    const { hex, alpha } = splitColor(val);
    return alpha < 1 ? `${hex} ${Math.round(alpha * 100)}%` : hex;
  }
  if (v.type === 'string') return String(val ?? '').slice(0, 14);
  return String(val ?? '');
}

function variableMenu(btn, path) {
  const nodes = selectedNodes();
  const type = typeForPath(path);
  if (!type || !nodes.length) return;
  const current = boundVar(nodes, path);
  const r0 = btn.getBoundingClientRect();
  const items = [...propMenuItems(nodes, path, r0)];
  if (items.length) items.push('-', { label: 'Design tokens', disabled: true });
  for (const col of collections()) {
    const vars = (col.variables || []).filter((v) => v.type === type);
    if (!vars.length) continue;
    if (items.length && items.at(-1).label !== 'Design tokens') items.push('-');
    // Group by where the tokens come from: a linked token file, or this file's local tokens.
    items.push({ label: `${libraryOf(col)?.name || 'Local'} / ${col.name}`, disabled: true });
    for (const v of vars) {
      if (v.deprecated && !(current && current !== MIXED && current.id === v.id)) continue; // nothing new uses a deprecated token
      items.push({
        label: v.name, shortcut: previewText(v), checked: current && current !== MIXED && current.id === v.id,
        action: () => applyVariable(nodes, path, v.id),
      });
    }
  }
  if (!collections().some((c) => (c.variables || []).some((v) => v.type === type))) items.push({ label: `No ${VAR_TYPES[type].toLowerCase()} tokens yet`, disabled: true });
  items.push('-', { label: 'Create token from this value', action: () => variableFromValue(nodes, path, type) });
  if (current) items.push({ label: 'Detach token', action: () => applyVariable(nodes, path, null) });
  items.push({ label: 'Open local design tokens…', action: () => openVariablesEditor() });
  const r = btn.getBoundingClientRect();
  showContextMenu(Math.max(8, r.right - 220), r.bottom + 4, items);
}

function applyVariable(nodes, path, varId) {
  for (const n of nodes) {
    editNode(n, ['bindings'], () => (varId ? bindVariable(n, path, varId) : unbindVariable(n, path)));
  }
  commit();
}

function variableFromValue(nodes, path, type) {
  const col = localCollections()[0] || createCollection('Tokens');
  let value = readPath(nodes[0], path);
  if (type === 'typography') {
    const n = nodes[0];
    value = { fontFamily: n.fontFamily, fontWeight: n.fontWeight, fontSize: n.fontSize, lineHeight: n.lineHeight ?? null, letterSpacing: n.letterSpacing || 0 };
  }
  if (type === 'shadow') {
    const e = nodes[0].effects?.[+path.split('.')[1]] || {};
    const alpha = e.opacity ?? 1;
    value = {
      color: alpha < 1 ? (e.color || '#000000') + Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase() : e.color || '#000000',
      x: e.x || 0, y: e.y || 0, blur: e.blur || 0, spread: e.spread || 0,
    };
  }
  if (type === 'color') {
    // Keep the paint's opacity in the new token.
    const [kind, i] = path.split('.');
    const p = nodes[0][kind]?.[+i];
    if (p && p.opacity < 1) value = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0').toUpperCase();
  }
  if (path === 'opacity') value = Math.round((value ?? 1) * 100);
  if (type === 'number') value = Number(value) || 0;
  if (type === 'boolean') value = value !== false;
  if (type === 'string') value = String(value ?? '');
  const name = type === 'color' ? 'color' : type === 'typography' ? 'text/style' : type === 'shadow' ? 'shadow' : path.split('.').pop();
  const v = createVariable(col, type, name);
  for (const m of col.modes) v.valuesByMode[m.id] = value;
  applyVariable(nodes, path, v.id);
}

// ---------- paints (multiple fills / strokes) ----------
const PAINT_KINDS = { fills: 'fill', strokes: 'stroke' };
const CORNERS_ICON = lucideIcon('scan',12);
const SIDES = [['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left']];
const canHavePaint = (n, kind) => (kind === 'fills' ? !['line', 'group'].includes(n.type) : !['group', 'text', 'icon'].includes(n.type));
const defaultPaintColor = (n, kind) =>
  kind === 'strokes' ? '#000000' : n.type === 'text' ? '#000000' : n.type === 'icon' ? '#1E1E1E' : isFrameLike(n) ? '#FFFFFF' : '#D9D9D9';

function samePaints(nodes, kind) {
  const first = JSON.stringify(nodes[0]?.[kind] || []);
  return nodes.every((n) => JSON.stringify(n[kind] || []) === first);
}

// Rows are listed top paint first, like Figma; ids refer to the underlying (bottom-up) index.
function paintRows(kind, nodes) {
  if (!samePaints(nodes, kind)) {
    return `<div class="mixed-paints">Click + to replace mixed ${PAINT_KINDS[kind]}s</div>`;
  }
  const list = nodes[0][kind] || [];
  return list.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => {
    const id = `${kind}:${i}`;
    const hidden = p.visible === false;
    const path = `${kind}.${i}.color`;
    const bound = boundVar(nodes, path);
    return `<div class="color-row paint-row${hidden ? ' is-hidden' : ''}">` +
      `<label class="swatch" style="--c:${p.color}"><input type="color" data-paint-color="${id}" value="${p.color.toLowerCase()}"></label>` +
      (bound && bound !== MIXED
        ? `<span class="hex">${varChip(path, bound)}</span>`
        : `<input class="hex" data-paint-hex="${id}" value="${esc(p.color.replace('#', ''))}" spellcheck="false">${varButton(path)}`) +
      `<input class="op" data-paint-op="${id}" value="${Math.round(p.opacity * 100)}"><span class="op-suffix">%</span>` +
      `<button class="icon-btn" data-paint-act="toggle" data-paint="${id}" title="${hidden ? 'Show' : 'Hide'} ${PAINT_KINDS[kind]}">${hidden ? icons.eyeOff : icons.eye}</button>` +
      `<button class="icon-btn" data-paint-act="remove" data-paint="${id}" title="Remove ${PAINT_KINDS[kind]}">${icons.minus}</button></div>`;
  }).join('');
}

function addPaintButton(kind) {
  return `<button class="icon-btn" data-action="add-${kind}" title="Add ${PAINT_KINDS[kind]}">${icons.plus}</button>`;
}

// Apply fn to paint `id` ("fills:2") on every selected node.
// Apply fn to paint `id` ("fills:2") on every selected node; `field` is the paint property being edited.
function updatePaint(id, field, fn, { live = false } = {}) {
  const [kind, i] = id.split(':');
  for (const n of selectedNodes()) {
    if (!n[kind]?.[+i]) continue;
    editNode(n, [`${kind}.${i}.${field}`], () => fn(n[kind][+i]));
  }
  if (live) emit('doc');
  else commit();
}

function removePaint(id) {
  const [kind, i] = id.split(':');
  for (const n of selectedNodes()) {
    if (!n[kind]?.[+i]) continue;
    editNode(n, [`${kind}.${i}`], () => n[kind].splice(+i, 1));
    // Bindings of later paints move down one slot.
    if (n.bindings) editNode(n, ['bindings'], () => shiftPaintBindings(n, kind, +i));
  }
  commit();
}

function addPaint(kind) {
  const nodes = selectedNodes().filter((n) => canHavePaint(n, kind));
  if (!nodes.length) return;
  const replace = !samePaints(nodes, kind);
  for (const n of nodes) {
    // Adding a paint keeps the tokens on the others (replacing mixed paints doesn't).
    editNode(n, [replace ? kind : `${kind}.${(n[kind] || []).length}`], () => {
      const list = replace ? [] : (n[kind] || []);
      // The first paint gets the layer's default color; extra ones start as a translucent black overlay.
      list.push(list.length ? makePaint('#000000', 0.2) : makePaint(defaultPaintColor(n, kind)));
      n[kind] = list;
    });
  }
  commit();
}

// ---------- contrast ----------
// For one text layer: its contrast with what's behind it, and the WCAG level.
function contrastRow(nodes) {
  if (nodes.length !== 1 || nodes[0].type !== 'text') return '';
  const c = textContrast(nodes[0]);
  if (!c) {
    return (nodes[0].fills || []).some((p) => p.visible !== false)
      ? '<div class="contrast-row"><span class="muted">Contrast</span><span class="muted">Can’t measure over an image</span></div>' : '';
  }
  return `<div class="contrast-row" title="Text color ${c.fg} on ${c.bg}, measured behind the middle of the text"><span class="muted">Contrast</span>` +
    `<span class="contrast-pair"><span class="mini-swatch" style="--c:${c.bg}"><span style="color:${c.fg}">A</span></span>${contrastBadge(c.ratio, c.large)}</span></div>`;
}

// ---------- layout grids ----------
const sameGrids = (nodes) => nodes.every((n) => JSON.stringify(n.layoutGrids || []) === JSON.stringify(nodes[0].layoutGrids || []));

function gridSummary(g) {
  if (g.type === 'grid') return `Grid (${g.size ?? 10}px)`;
  const auto = (g.align || 'stretch') === 'stretch';
  return `${g.count ?? 1} ${g.type}${auto ? ' (auto)' : ` (${g.size}px)`}`;
}

function gridRows(nodes) {
  if (!sameGrids(nodes)) return '<div class="mixed-paints">Click + to replace mixed layout grids</div>';
  return (nodes[0].layoutGrids || []).map((g, i) => {
    const hidden = g.visible === false;
    // One labeled line per number: its value, or the token it uses.
    const f = (key, label) => {
      const path = `layoutGrids.${i}.${key}`;
      const bound = boundVar(nodes, path);
      const control = bound && bound !== MIXED ? varChip(path, bound)
        : `<input class="grid-num" data-grid-input="${i}:${key}" value="${esc(fmtNum(g[key] ?? 0))}" spellcheck="false">${varButton(path)}`;
      return `<label class="grid-field bindable"><span class="muted">${label}</span>${control}</label>`;
    };
    const cols = g.type === 'columns';
    const align = g.align || 'stretch';
    let head = `<select class="select" data-grid-type="${i}" title="Grid type">${Object.entries(GRID_TYPES).map(([k, l]) => `<option value="${k}" ${k === g.type ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    let body;
    if (g.type === 'grid') {
      body = f('size', 'Size');
    } else {
      const aligns = { stretch: 'Stretch', min: cols ? 'Left' : 'Top', center: 'Center', max: cols ? 'Right' : 'Bottom' };
      head += `<select class="select" data-grid-align="${i}" title="Where the ${g.type} sit">` +
        Object.entries(aligns).map(([k, l]) => `<option value="${k}" ${k === align ? 'selected' : ''}>${l}</option>`).join('') + '</select>';
      body = f('count', 'Count') + (align === 'stretch' ? '' : f('size', cols ? 'Width' : 'Height')) + f('gutter', 'Gutter') +
        (align === 'center' ? '' : f('margin', align === 'stretch' ? 'Margin' : 'Offset'));
    }
    body += `<div class="color-row"><label class="swatch" style="--c:${g.color || '#FF0000'}"><input type="color" data-grid-color="${i}" value="${(g.color || '#FF0000').toLowerCase()}"></label>` +
      `<input class="hex" data-grid-input="${i}:hex" value="${esc((g.color || '#FF0000').replace('#', ''))}" spellcheck="false">` +
      `<input class="op" data-grid-input="${i}:opacity" value="${Math.round((g.opacity ?? 0.1) * 100)}"><span class="op-suffix">%</span></div>`;
    return `<div class="effect-row grid-row${hidden ? ' is-hidden' : ''}" title="${esc(gridSummary(g))}"><div class="effect-head">${head}` +
      `<button class="icon-btn" data-grid-act="toggle" data-grid="${i}" title="${hidden ? 'Show' : 'Hide'} grid">${hidden ? icons.eyeOff : icons.eye}</button>` +
      `<button class="icon-btn" data-grid-act="remove" data-grid="${i}" title="Remove grid">${icons.minus}</button></div>${body}</div>`;
  }).join('') + (state.showGrids ? '' : '<div class="muted">Layout grids are hidden. Press ⌃G to show them.</div>');
}

// `field`: the grid property changed (a value typed over a token detaches it).
function updateGrid(i, field, fn, { live = false } = {}) {
  for (const n of selectedNodes()) {
    if (!n.layoutGrids?.[i]) continue;
    editNode(n, [`layoutGrids.${i}.${field}`], () => fn(n.layoutGrids[i]));
  }
  if (live) emit('doc');
  else commit();
}

function addGrid() {
  const nodes = selectedNodes().filter(isFrameLike);
  const replace = !sameGrids(nodes);
  for (const n of nodes) {
    const list = replace ? [] : [...(n.layoutGrids || [])];
    editNode(n, [replace ? 'layoutGrids' : `layoutGrids.${list.length}`], () => {
      list.push(newGrid(list.length ? 'rows' : 'columns'));
      n.layoutGrids = list;
    });
  }
  if (!state.showGrids) setShowGrids(true);
  commit();
}

function removeGrid(i) {
  for (const n of selectedNodes()) {
    if (!n.layoutGrids?.[i]) continue;
    editNode(n, [`layoutGrids.${i}`], () => {
      n.layoutGrids.splice(i, 1);
      if (!n.layoutGrids.length) delete n.layoutGrids;
    });
    if (n.bindings) editNode(n, ['bindings'], () => shiftPaintBindings(n, 'layoutGrids', i));
  }
  commit();
}

// ---------- effects ----------
const EFFECT_TYPES = { 'drop-shadow': 'Drop shadow', 'inner-shadow': 'Inner shadow', 'layer-blur': 'Layer blur' };
const sameEffects = (nodes) => nodes.every((n) => JSON.stringify(n.effects || []) === JSON.stringify(nodes[0].effects || []));

// Rows are listed top effect first, like paints; ids are the underlying (bottom-up) index.
function effectRows(nodes) {
  if (!sameEffects(nodes)) return '<div class="mixed-paints">Click + to replace mixed effects</div>';
  const list = nodes[0].effects || [];
  return list.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
    const hidden = e.visible === false;
    const path = `effects.${i}`;
    const bound = boundVar(nodes, path);
    const isBound = bound && bound !== MIXED;
    const blurOnly = e.type === 'layer-blur';
    const f = (key, label) => `<label class="field"><span class="field-label">${label}</span><input data-effect-input="${i}:${key}" value="${esc(fmtNum(e[key] ?? 0))}" spellcheck="false"></label>`;
    let body = '';
    if (!isBound) {
      body = blurOnly
        ? `<div class="grid2">${f('blur', 'Blur')}<span></span></div>`
        : `<div class="grid2">${f('x', 'X')}${f('y', 'Y')}</div><div class="grid2">${f('blur', 'Blur')}${f('spread', 'Spread')}</div>` +
          `<div class="color-row"><label class="swatch" style="--c:${e.color || '#000000'}"><input type="color" data-effect-color="${i}" value="${(e.color || '#000000').toLowerCase()}"></label>` +
          `<input class="hex" data-effect-input="${i}:hex" value="${esc((e.color || '#000000').replace('#', ''))}" spellcheck="false">` +
          `<input class="op" data-effect-input="${i}:opacity" value="${Math.round((e.opacity ?? 1) * 100)}"><span class="op-suffix">%</span></div>`;
    }
    return `<div class="effect-row${hidden ? ' is-hidden' : ''}"><div class="effect-head">` +
      `<select class="select" data-effect-type="${i}">${Object.entries(EFFECT_TYPES).map(([k, l]) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${l}</option>`).join('')}</select>` +
      `<button class="icon-btn" data-effect-act="toggle" data-effect="${i}" title="${hidden ? 'Show' : 'Hide'} effect">${hidden ? icons.eyeOff : icons.eye}</button>` +
      `<button class="icon-btn" data-effect-act="remove" data-effect="${i}" title="Remove effect">${icons.minus}</button></div>` +
      (blurOnly ? '' : `<div class="bind-inline wide"><span class="muted">Shadow token</span>${isBound ? varChip(path, bound) : varButton(path)}</div>`) +
      `${body}</div>`;
  }).join('');
}

// Apply fn to effect `i` on every selected node. Editing an effect detaches a shadow token bound to it.
// `field`: a change that keeps the token (showing, hiding or changing the type).
function updateEffect(i, fn, { live = false, field = null } = {}) {
  for (const n of selectedNodes()) {
    if (!n.effects?.[i]) continue;
    editNode(n, [field ? `effects.${i}.${field}` : `effects.${i}`], () => fn(n.effects[i]));
  }
  if (live) emit('doc');
  else commit();
}

function addEffect() {
  const nodes = selectedNodes();
  const replace = !sameEffects(nodes);
  for (const n of nodes) {
    const list = replace ? [] : [...(n.effects || [])];
    editNode(n, [replace ? 'effects' : `effects.${list.length}`], () => {
      list.push({ type: 'drop-shadow', color: '#000000', opacity: 0.25, x: 0, y: 4, blur: 4, spread: 0, visible: true });
      n.effects = list;
    });
  }
  commit();
}

function removeEffect(i) {
  for (const n of selectedNodes()) {
    if (!n.effects?.[i]) continue;
    editNode(n, [`effects.${i}`], () => {
      n.effects.splice(i, 1);
      if (!n.effects.length) delete n.effects;
    });
    if (n.bindings) editNode(n, ['bindings'], () => shiftPaintBindings(n, 'effects', i));
  }
  commit();
}

function section(title, body, action = '') {
  return `<div class="section"><div class="section-title"><span>${title}</span>${action}</div>${body}</div>`;
}

// The right panel's tab: Design (edit) or Inspect (code handoff).
let rightTab = 'design';

function buildProps() {
  const nodes = selectedNodes();
  if (rightTab === 'inspect') return inspectHTML(nodes);
  if (!nodes.length) {
    let html = '';
    if (state.tool === 'frame') {
      html += section('Frame', `<div class="presets">${FRAME_PRESETS.map(([name, w, h], i) =>
        `<button class="preset" data-preset="${i}"><span>${name}</span><span class="muted">${w}×${h}</span></button>`).join('')}</div>`);
    }
    // The file's tokens and libraries are on the file tools rail (rail.js).
    const pub = componentPublishStatus();
    if (pub.count && state.doc.project?.path) {
      html += section('Components', `<div class="muted">${pub.count} component${pub.count === 1 ? '' : 's'} in this file. In a project, saving is publishing: files that use them read them from the project.</div>`);
    } else if (pub.count) {
      html += section('Components',
        `<div class="muted">${pub.count} component${pub.count === 1 ? '' : 's'} in this file · ${!pub.pub ? 'not published' : pub.dirty ? `v${pub.pub.version} published, changes not published` : `v${pub.pub.version} published`}</div>` +
        `<button class="btn wide" data-action="publish-components" ${pub.pub && !pub.dirty ? 'disabled' : ''}>Publish components…</button>`);
    }
    const pageModes=modeRows(null);
    if(pageModes)html += section('Page', pageModes);
    html += section('Export', `<div class="export-row">${exportControls()}</div><button class="btn wide" data-action="export-page">Export ${esc(page().name)}</button>`);
    return html;
  }
  const types = new Set(nodes.map((n) => n.type));
  const single = nodes.length === 1 ? nodes[0] : null;
  const has = (pred) => nodes.every(pred);
  // Layers inside an instance take their geometry from the main component.
  const lockedGeometry = nodes.some(isInsideInstance);
  let html = componentPanel(nodes) || instanceLayerPanel(nodes);

  // Alignment
  const alignBtns = [['left', 'alignLeft'], ['hcenter', 'alignHCenter'], ['right', 'alignRight'], ['top', 'alignTop'], ['vcenter', 'alignVCenter'], ['bottom', 'alignBottom']];
  const canAlign = !lockedGeometry && (nodes.length > 1 || (single && getParent(single.id)));
  html += `<div class="section align-bar">${alignBtns.map(([k, i]) => `<button class="icon-btn" data-align="${k}" ${canAlign ? '' : 'disabled'} title="Align ${k}">${icons[i]}</button>`).join('')}` +
    `<button class="icon-btn" data-distribute="x" ${nodes.length > 2 ? '' : 'disabled'} title="Distribute horizontal spacing">${icons.distH}</button>` +
    `<button class="icon-btn" data-distribute="y" ${nodes.length > 2 ? '' : 'disabled'} title="Distribute vertical spacing">${icons.distV}</button></div>`;

  // Layout
  const title = types.size === 1 ? TYPE_LABEL[[...types][0]] : 'Mixed';
  const showH = !(types.has('line') && types.size === 1);
  const lockAspect = common(nodes, (n) => !!n.lockAspect);
  let layout = `<div class="grid2">${numField('x', 'X', nodes)}${numField('y', 'Y', nodes)}</div>`;
  layout += `<div class="grid2 wh-row">${numField('w', 'W', nodes)}${showH ? numField('h', 'H', nodes) : '<span></span>'}` +
    `<button class="icon-btn lock-aspect${lockAspect === true ? ' on' : ''}" data-action="lock-aspect" aria-pressed="${lockAspect === true}" aria-label="${lockAspect === true ? 'Unlock' : 'Lock'} aspect ratio" title="${lockAspect === true ? 'Unlock' : 'Lock'} aspect ratio">${lockAspect === true ? icons.aspectLocked : icons.aspectUnlocked}</button></div>`;

  // Resizing: Fixed / Hug contents / Fill container
  const canHug = nodes.every((n) => isAutoLayout(n) || n.type === 'text');
  const canFill = nodes.every((n) => isAutoLayout(getParent(n.id)) && !n.absolute && n.type !== 'group');
  if (canHug || canFill) {
    const sizingSelect = (axis) => {
      const cur = common(nodes, (n) => getSizing(n, axis));
      return `<select class="select" data-sizing="${axis}" title="${axis === 'w' ? 'Horizontal' : 'Vertical'} resizing">` +
        (cur === MIXED ? '<option selected disabled>Mixed</option>' : '') +
        `<option value="fixed" ${cur === 'fixed' ? 'selected' : ''}>Fixed</option>` +
        (canHug ? `<option value="hug" ${cur === 'hug' ? 'selected' : ''}>Hug</option>` : '') +
        (canFill ? `<option value="fill" ${cur === 'fill' ? 'selected' : ''}>Fill</option>` : '') + '</select>';
    };
    layout += `<div class="grid2">${sizingSelect('w')}${showH ? sizingSelect('h') : '<span></span>'}</div>`;
    // Min / max: limits for hug and fill sizes (and auto-width text, which wraps at its max width).
    const limited = nodes.some((n) => ['minW', 'maxW', 'minH', 'maxH'].some((k) => n[k] !== undefined && n[k] !== null));
    layout += `<button class="link-btn add-limits" data-action="show-limits" aria-expanded="${showLimits}" title="${showLimits?'Collapse':'Expand'} size limits">${showLimits?icons.chevronDown:icons.chevronRight} Size limits${limited?' · Active':''}</button>`;
    if (showLimits) {
      layout += `<div class="size-limits"><div class="size-limits-head"><span>Size limits</span><span>px</span></div>`+['W',...(showH?['H']:[])].map(axis=>`<div class="size-limit-axis"><span>${axis==='W'?'Width':'Height'}</span><div class="grid2">${['min','max'].map(prefix=>{const key=prefix+axis;return `<div class="size-limit-control"><span class="muted">${prefix==='min'?'Min':'Max'}</span>${numField(key,'',nodes)}<button class="icon-btn" data-clear-limit="${key}" title="Remove ${prefix==='min'?'minimum':'maximum'} ${axis==='W'?'width':'height'}" aria-label="Remove ${prefix==='min'?'minimum':'maximum'} ${axis==='W'?'width':'height'}">${icons.close}</button></div>`;}).join('')}</div></div>`).join('')+'</div>';
    }
  }
  const hasRadius = has((n) => isFrameLike(n) || ['rect', 'image'].includes(n.type));
  const corners = hasRadius && nodes.every((n) => Array.isArray(n.radii));
  layout += `<div class="grid2 wh-row">${numField('rotation', '', nodes, { icon: icons.rotation })}${hasRadius ? numField('radius', '', nodes, { icon: icons.radius }) : '<span></span>'}` +
    (hasRadius ? `<button class="icon-btn lock-aspect${corners ? ' on' : ''}" data-action="independent-corners" title="${corners ? 'One radius for all corners' : 'Set each corner separately'}">${CORNERS_ICON}</button>` : '') + '</div>';
  if (corners) {
    const c = (key) => numField(key, '', nodes, {icon:lucideIcon(UI_ICON_NAMES[{radiusTL:'cornerTL',radiusTR:'cornerTR',radiusBR:'cornerBR',radiusBL:'cornerBL'}[key]],10)});
    layout += `<div class="grid2">${c('radiusTL')}${c('radiusTR')}</div>` +
      `<div class="grid2">${c('radiusBL')}${c('radiusBR')}</div>`;
  }
  if (nodes.every(isFrameLike)) {
    const clip = common(nodes, (n) => !!n.clip);
    layout += `<label class="check-row"><input type="checkbox" data-bool="clip" ${clip === true ? 'checked' : ''}> Clip content</label>`;
  }
  // Constraints: for layers placed freely inside a frame (not in an auto layout flow).
  const constrained = nodes.every((n) => {
    const p = getParent(n.id);
    return p && isFrameLike(p) && (!isAutoLayout(p) || n.absolute);
  });
  if (constrained) {
    const pick = (axisKey, options, def) => {
      const cur = common(nodes, (n) => n.constraints?.[axisKey] || def);
      return `<select class="select" data-constraint="${axisKey}" title="${axisKey === 'h' ? 'Horizontal' : 'Vertical'} constraint">` +
        (cur === MIXED ? '<option selected disabled>Mixed</option>' : '') +
        Object.entries(options).map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('') + '</select>';
    };
    const h=common(nodes,n=>n.constraints?.h||'left'),v=common(nodes,n=>n.constraints?.v||'top');
    const pin=(axis,edge,active)=>`<button class="constraint-pin pin-${edge}" data-pin-axis="${axis}" data-pin-edge="${edge}" aria-label="Pin ${edge}" aria-pressed="${active}"></button>`;
    layout += `<div class="constraint-label">Constraints</div><div class="constraints-editor"><div class="constraint-diagram" aria-label="Resize pins">${pin('h','left',h==='left'||h==='leftRight')}${pin('h','right',h==='right'||h==='leftRight')}${pin('v','top',v==='top'||v==='topBottom')}${pin('v','bottom',v==='bottom'||v==='topBottom')}<button class="constraint-center" data-pin-center aria-label="Center horizontally and vertically" aria-pressed="${h==='center'&&v==='center'}">+</button></div><div class="constraint-axes"><label>Horizontal${pick('h',H_CONSTRAINTS,'left')}</label><label>Vertical${pick('v',V_CONSTRAINTS,'top')}</label></div></div><p class="inspector-help">Pins follow the parent when it resizes. Auto-layout flow children use Fill and Hug instead.</p>`;
  }
  if (nodes.every((n) => isAutoLayout(getParent(n.id)))) {
    const abs = common(nodes, (n) => !!n.absolute);
    layout += `<label class="check-row" title="Ignore auto layout and position freely"><input type="checkbox" data-bool="absolute" ${abs === true ? 'checked' : ''}> Absolute position</label>`;
  }
  html += section(title, lockedGeometry ? `<fieldset class="readonly" disabled title="Comes from the main component">${layout}</fieldset>` : layout);
  if (!lockedGeometry) html += autoLayoutSection(nodes);
  if (!lockedGeometry && nodes.every(isFrameLike)) {
    html += section('Layout grid', gridRows(nodes), `<button class="icon-btn" data-action="add-grid" title="Add layout grid">${icons.plus}</button>`);
  }

  // Layer
  html += section('Layer', `<div class="grid2">${numField('opacity', '', nodes, { icon: '<span class="op-icon"></span>' })}` +
    `<div class="bind-inline"><span class="muted">Visibility</span>${varControl(nodes, 'visible')}</div></div>` + modeRows(nodes));

  // Icon: which one (Swap…), and the stroke width of outline icons. In an instance the icon comes from
  // the main component (or its Icon property).
  if (types.size === 1 && types.has('icon')) {
    const info = iconLayerInfo(nodes);
    const inInstance = nodes.some(isInsideInstance);
    // In a main component, the icon can come from an Icon property (instances then choose it).
    const pill = !inInstance && propBinding(nodes, 'iconId');
    const propBtn = inInstance || !propMenuItems(nodes, 'iconId', null).length ? ''
      : pill || `<button class="icon-btn" data-action="icon-prop" title="Apply icon property">${APPLY_PROP_ICON}</button>`;
    html += section('Icon', info.html +
      (inInstance ? '<div class="muted">Comes from the main component. An Icon property lets instances choose it.</div>'
        : `<div class="icon-actions"><button class="btn" data-action="swap-icon">Swap icon…</button>${propBtn}</div>`) +
      (info.outline ? (inInstance ? `<fieldset class="readonly" disabled>${numField('iconStroke', '', nodes, { icon: '<span class="mini" title="Stroke width">≡</span>' })}</fieldset>`
        : `<div class="grid2">${numField('iconStroke', '', nodes, { icon: '<span class="mini" title="Stroke width (in the icon’s units)">≡</span>' })}<span></span></div>`) : ''));
  } else if (canInsertIcon()) {
    html += section('Icon', '', '<button class="icon-btn" data-action="insert-icon" title="Add an icon from an icons file">' + icons.plus + '</button>');
  }

  // Text
  if (types.size === 1 && types.has('text')) {
    const fam = common(nodes, (n) => n.fontFamily);
    const wt = common(nodes, (n) => n.fontWeight);
    const ta = common(nodes, (n) => n.textAlign);
    const ar = common(nodes, (n) => n.autoResize);
    let t = `<select class="select wide" data-select="fontFamily">${fam === MIXED ? '<option selected disabled>Mixed</option>' : ''}${FONTS.map((f) => `<option ${f === fam ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
    t += `<div class="grid2"><select class="select" data-select="fontWeight">${wt === MIXED ? '<option selected disabled>Mixed</option>' : ''}${WEIGHTS.map(([w, l]) => `<option value="${w}" ${w === wt ? 'selected' : ''}>${l}</option>`).join('')}</select>${numField('fontSize', '', nodes, { icon: '<span class="mini">Aa</span>' })}</div>`;
    t += `<div class="grid2">${numField('lineHeight', '', nodes, { icon: '<span class="mini">LH</span>' })}${numField('letterSpacing', '', nodes, { icon: '<span class="mini">|A|</span>' })}</div>`;
    t += `<div class="grid2"><div class="seg">${[['left', 'textLeft'], ['center', 'textCenter'], ['right', 'textRight']].map(([k, i]) => `<button class="icon-btn${ta === k ? ' on' : ''}" data-text-align="${k}" title="Align ${k}">${icons[i]}</button>`).join('')}</div>` +
      `<div class="seg">${[['width', 'autoWidth', 'Auto width'], ['height', 'autoHeight', 'Auto height'], ['fixed', 'fixedSize', 'Fixed size']].map(([k, i, tip]) => `<button class="icon-btn${ar === k ? ' on' : ''}" data-auto-resize="${k}" title="${tip}">${icons[i]}</button>`).join('')}</div></div>`;
    const tc = common(nodes, (n) => n.textCase || 'none');
    t += `<div class="text-case-row"><span class="muted">Case</span><div class="seg">${[['none', '—'], ['upper', 'AG'], ['lower', 'ag'], ['title', 'Ag']].map(([k, l]) =>
      `<button class="icon-btn text-case${tc === k ? ' on' : ''}" data-text-case="${k}" title="${TEXT_CASES[k]}">${l}</button>`).join('')}</div></div>`;
    // Truncation: an ellipsis when the text doesn't fit, after Max lines (empty: the lines that fit).
    const trunc = common(nodes, (n) => !!n.truncate);
    t += `<div class="grid2"><label class="check-row" title="End text that doesn’t fit with “…”"><input type="checkbox" data-bool="truncate" ${trunc === true ? 'checked' : ''}> Truncate</label>` +
      (trunc === true ? numField('maxLines', '', nodes, { icon: '<span class="mini" title="Max lines (empty: the lines that fit)">≡#</span>' }) : '<span></span>') + '</div>';
    t += `<div class="bind-inline wide"><span class="muted">Text style</span>${varControl(nodes, 'typography')}</div>`;
    t += `<div class="bind-inline wide"><span class="muted">Text content</span>${varControl(nodes, 'text')}</div>`;
    html += section('Text', t);
  }

  // Fill
  const fillNodes = nodes.filter((n) => canHavePaint(n, 'fills'));
  if (fillNodes.length) {
    const iconsOnly = types.size === 1 && types.has('icon');
    const fillBody = paintRows('fills', fillNodes) + contrastRow(nodes);
    html += section(types.has('image') && types.size === 1 ? 'Fill (behind image)' : iconsOnly ? 'Color' : 'Fill',
      iconsOnly && nodes.some(isInsideInstance) ? `<fieldset class="readonly" disabled title="Comes from the main component">${fillBody}</fieldset>` : fillBody,
      iconsOnly ? '' : addPaintButton('fills'));
  }

  // Stroke
  const paintableStroke = nodes.filter((n) => canHavePaint(n, 'strokes'));
  if (paintableStroke.length && !types.has('text')) {
    const strokeNodes = paintableStroke.filter((n) => n.strokes?.length);
    let body = paintRows('strokes', paintableStroke);
    if (strokeNodes.length) {
      const shapeNodes = strokeNodes.filter((n) => n.type !== 'line');
      const align = common(shapeNodes, (n) => n.strokeAlign || 'inside');
      const alignSelect = shapeNodes.length
        ? `<select class="select" data-select="strokeAlign" title="Stroke position">${align === MIXED ? '<option selected disabled>Mixed</option>' : ''}` +
          ['inside', 'center', 'outside'].map((a) => `<option value="${a}" ${align === a ? 'selected' : ''}>${a[0].toUpperCase() + a.slice(1)}</option>`).join('') + '</select>'
        : '';
      const capSelect = types.size === 1 && types.has('line')
        ? `<select class="select" data-select="cap">${['butt', 'round', 'square'].map((c) => `<option ${common(nodes, (n) => n.cap || 'butt') === c ? 'selected' : ''} value="${c}">${c[0].toUpperCase() + c.slice(1)} cap</option>`).join('')}</select>`
        : '';
      body +=
        `<div class="grid2">${alignSelect || capSelect || '<span></span>'}${numField('strokeWidth', '', strokeNodes, { icon: '<span class="mini">≡</span>' })}</div>`;
      // Sides: rectangles, frames and images can have a stroke on only some sides.
      const boxes = strokeNodes.filter((n) => isFrameLike(n) || ['rect', 'image'].includes(n.type));
      if (boxes.length === strokeNodes.length) {
        body += `<div class="text-case-row"><span class="muted">Sides</span><div class="seg stroke-sides">${SIDES.map(([side, label]) => {
          const on = common(boxes, (n) => strokeSides(n)[side]);
          return `<button class="icon-btn${on === true ? ' on' : ''}" data-stroke-side="${side}" title="${label} ${on === true ? '(on)' : '(off)'}">` +
            `${lucideIcon(UI_ICON_NAMES[{top:'strokeTop',right:'strokeRight',bottom:'strokeBottom',left:'strokeLeft'}[side]],12)}</button>`;
        }).join('')}</div></div>`;
      }
    }
    html += section('Stroke', body, addPaintButton('strokes'));
  }

  // Effects
  html += section('Effects', effectRows(nodes), `<button class="icon-btn" data-action="add-effect" title="Add effect">${icons.plus}</button>`);

  // Export
  html += section('Export', `<div class="export-row">${exportControls()}</div><button class="btn wide" data-action="export">Export ${single ? esc(single.name) : `${nodes.length} layers`}</button>`);
  return html;
}

function autoLayoutSection(nodes) {
  // Instances get their auto layout from the main component; its values can be overridden, not added or removed.
  const fromMain = nodes.some((n) => n.type === 'instance');
  if (fromMain && !nodes.every(isAutoLayout)) return '';
  if (!nodes.every(isAutoLayout)) {
    return section('Auto layout', '', `<button class="icon-btn" data-action="add-al" title="Add auto layout  ⇧A">${icons.plus}</button>`);
  }
  const mode = common(nodes, (n) => n.layout.mode);
  const alignP = common(nodes, (n) => n.layout.alignP);
  const alignC = common(nodes, (n) => n.layout.alignC);
  const spacing = common(nodes, (n) => n.layout.spacing);
  const horiz = mode === 'horizontal';
  const dir = [['vertical', 'alVertical', 'Vertical layout'], ['horizontal', 'alHorizontal', 'Horizontal layout']]
    .map(([m, i, tip]) => `<button class="icon-btn${mode === m ? ' on' : ''}" data-al-mode="${m}" title="${tip}">${icons[i]}</button>`).join('');
  const POS = ['start', 'center', 'end'];
  // Right to left: start is the right edge, so the grid's columns run from the right.
  const textDir = common(nodes, directionOf);
  const rtl = textDir === 'rtl';
  const side = (c) => (c === 'center' ? 'center' : (c === 'start') !== rtl ? 'left' : 'right');
  let cells = '';
  for (const r of POS) {
    for (const c of rtl ? [...POS].reverse() : POS) {
      const p = horiz ? c : r, q = horiz ? r : c; // primary / counter position of this cell
      const on = mode !== MIXED && alignC === q && (spacing === 'auto' || alignP === p);
      cells += `<button class="al-cell${on ? ' on' : ''}" data-al-align="${r},${c}" title="Align ${r === 'center' ? 'middle' : r === 'start' ? 'top' : 'bottom'} ${side(c)}"><span></span></button>`;
    }
  }
  const inherited = nodes.every((n) => n.dir !== 'rtl' && n.dir !== 'ltr') && textDir === 'rtl';
  const dirSeg = [['ltr', 'Left to right'], ['rtl', 'Right to left']]
    .map(([d, tip]) => `<button class="icon-btn al-dir${textDir === d ? ' on' : ''}" data-al-dir="${d}" title="${tip}${inherited && d === 'rtl' ? ' (from a frame it’s in)' : ''}">${d.toUpperCase()}</button>`).join('');
  const body = `<div class="grid2"><div class="seg">${dir}</div>${numField('gap', '', nodes, { icon: horiz ? icons.gapH : icons.gapV })}</div>` +
    `<div class="al-mid"><div class="al-grid${mode === MIXED ? '' : ` ${mode}`}${spacing === 'auto' ? ' between' : ''}">${cells}</div>` +
    `<div class="al-fields">${numField('padH', '', nodes, { icon: icons.padH })}${numField('padV', '', nodes, { icon: icons.padV })}</div></div>` +
    `<div class="al-dir-row"><span class="muted">Direction</span><div class="seg">${dirSeg}</div></div>` +
    (nodes.length === 1 ? breakpointsHTML(nodes[0]) : '');
  const hints=nodes.length===1?`<button class="btn wide" data-spacing-pin aria-pressed="${state.spacingPinned===nodes[0].id}">Preview padding and gaps</button><p class="inspector-help">Hover empty space in this selected frame to inspect spacing.</p>`:'';
  const warning=state.layoutWarnings?.length?`<p class="warn">${esc(state.layoutWarnings.join(' '))}</p>`:'';
  return section('Auto layout', body+hints+warning, fromMain ? '' : `<button class="icon-btn" data-action="remove-al" title="Remove auto layout  ⌥⇧A">${icons.minus}</button>`);
}

// Breakpoints: the frame lays out differently at a width or narrower (layout.breakpoints).
function breakpointsHTML(n) {
  const list = n.layout.breakpoints || [];
  const active = activeBreakpoint(n);
  const num = (i, k, v, title) => `<input class="prop-input bp-num" data-bp-field="${i}:${k}" value="${v ?? ''}" placeholder="—" title="${title}" inputmode="numeric">`;
  const rows = list.map((b, i) => {
    const mode = b.mode || n.layout.mode;
    const pad = (a, z) => (b[a] !== undefined && b[a] === b[z] ? b[a] : '');
    return `<div class="bp-row${b === active ? ' active' : ''}"><span class="muted">≤</span>${num(i, 'maxW', b.maxW, 'At this width (px) or narrower')}` +
      `<div class="seg">${[['vertical', 'alVertical'], ['horizontal', 'alHorizontal']].map(([m, ic]) => `<button class="icon-btn${mode === m ? ' on' : ''}" data-bp-mode="${i}:${m}" title="${m === 'vertical' ? 'Vertical' : 'Horizontal'} at this width">${icons[ic]}</button>`).join('')}</div>` +
      `${num(i, 'gap', b.gap, 'Gap at this width')}${num(i, 'padH', pad('pl', 'pr'), 'Left and right padding at this width')}` +
      `<button class="icon-btn bp-hide${(b.hide || []).length ? ' on' : ''}" data-bp-hide="${i}" title="Layers hidden at this width${(b.hide || []).length ? `: ${(b.hide || []).length}` : ''}">${icons.eyeOff}</button>` +
      `<button class="icon-btn" data-bp-del="${i}" title="Remove this breakpoint">${icons.minus}</button></div>`;
  }).join('');
  return `<div class="bp-head"><span class="muted">Breakpoints${active ? ` · ≤ ${active.maxW} applies at ${Math.round(n.w)}px` : ''}</span><button class="icon-btn" data-bp-add title="Lay out differently at a narrower width">${icons.plus}</button></div>${rows}`;
}

// ---------- components ----------
// The component, set, variant and instance panels live in component-ui.js. Layers inside an instance
// get a note about where they come from, and a reset.
function instanceLayerPanel(nodes) {
  if (!nodes.length || !nodes.every(isInsideInstance)) return '';
  const single = nodes.length === 1 ? nodes[0] : null;
  const owner = owningInstance(nodes[0]);
  const n = single ? overrideCount(owner, single.pathKey) : 0;
  const note = nodes.every((x) => x.type === 'icon') ? 'the icon comes from the main component.'
    : 'appearance and text can be changed here; size and position come from the main component.';
  return `<div class="section comp-panel"><div class="comp-sub">In instance “${esc(owner.name)}”: ${note}</div>` +
    (n ? `<button class="btn wide" data-action="reset-overrides">Reset changes</button>` : '') + '</div>';
}

// ---------- assets ----------
let leftTab = 'layers';
let assetQuery = '';
let showDeprecated = false;

function initAssets() {
  document.querySelector('.left-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-left-tab]');
    if (!b) return;
    leftTab = b.dataset.leftTab;
    for (const t of document.querySelectorAll('[data-left-tab]')) t.classList.toggle('active', t === b);
    $('#left-assets').hidden = leftTab !== 'assets';
    $('#left-comments').hidden = leftTab !== 'comments';
    document.querySelector('#left .pages').hidden = leftTab !== 'layers';
    document.querySelector('#left .layers').hidden = leftTab !== 'layers';
    renderAssets();
    renderCommentsList();
  });
  $('#left-comments').addEventListener('click', (e) => onCommentsListClick(e));
  $('#left-comments').addEventListener('change', (e) => onCommentsListChange(e));
  $('#assets-search').addEventListener('input', (e) => {
    assetQuery = e.target.value;
    renderAssets();
  });
  const list = $('#assets-list');
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-show-deprecated]')) {
      showDeprecated = !showDeprecated;
      return renderAssets();
    }
    const info = e.target.closest('[data-asset-info]');
    if (info) return openPlayground(info.dataset.assetInfo);
    const tile = e.target.closest('[data-component]');
    const main = tile && getNode(tile.dataset.component);
    if (!main) return;
    const { width, height } = viewportSize();
    placeInstance(main, toWorld({ x: width / 2, y: height / 2 }));
  });
  list.addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('[data-component]');
    if (!tile) return;
    e.preventDefault();
    const { width, height } = viewportSize();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Insert instance', action: () => placeInstance(getNode(tile.dataset.component), toWorld({ x: width / 2, y: height / 2 })) },
      { label: 'Open in playground…', action: () => openPlayground(tile.dataset.component) },
      {label:'Go to main component',action:()=>goToMainComponent(getNode(tile.dataset.component))},
    ]);
  });
  // "Insert instance" from the playground: with the variant and property values chosen there.
  window.addEventListener('sigma:insert-instance', (e) => {
    const { main, values } = e.detail;
    if (!main) return;
    const { width, height } = viewportSize();
    const inst = placeInstance(main, toWorld({ x: width / 2, y: height / 2 }));
    for (const [pid, v] of Object.entries(values || {})) setInstanceProp(inst, pid, v);
    commit();
  });
  list.addEventListener('dragstart', (e) => {
    const tile = e.target.closest('[data-component]');
    if (!tile) return;
    e.dataTransfer.setData('application/x-sigma-component', tile.dataset.component);
    e.dataTransfer.effectAllowed = 'copy';
  });
}

const ASSET_INFO_ICON = lucideIcon('info',12);
const COMPONENT_LIB_ICON = lucideIcon('component',11,{className:'lib-glyph'});

export function renderCommentsList() {
  if (leftTab !== 'comments' || !state.doc) return;
  $('#left-comments').innerHTML = commentsListHTML();
}

export function renderAssets() {
  if (leftTab !== 'assets' || !state.doc) return;
  const q = assetQuery.trim().toLowerCase();
  // A component set appears once (inserting its first variant); its variants aren't listed separately.
  const comps = [];
  for (const c of listComponents()) {
    const set = getParent(c.node.id);
    if (set?.type === 'componentSet') {
      if (defaultVariant(set) === c.node) comps.push({ node: set, page: c.page, library: c.library, insert: c.node }); // inserts the default (top-left) variant
    } else comps.push({ ...c, insert: c.node });
  }
  const found = comps.filter(({ node, insert }) => componentMatches(node, q) || componentMatches(insert, q));
  // Deprecated components are hidden unless asked for, so nothing new uses them.
  const hidden = found.filter(({ insert }) => isDeprecated(insert)).length;
  const matches = showDeprecated ? found : found.filter(({ insert }) => !isDeprecated(insert));
  const toggle = hidden ? `<button class="link-btn assets-deprecated" data-show-deprecated>${showDeprecated ? 'Hide' : 'Show'} ${hidden} deprecated</button>` : '';
  const list = $('#assets-list');
  if (!matches.length) {
    list.innerHTML = `<div class="empty-hint">${q || hidden ? 'No components match.' : 'No components yet. Select layers and press ⌥⌘K to create one.'}</div>${toggle}`;
    return;
  }
  // Local components are grouped by page, library components by library (after the local ones).
  const byPage = new Map();
  for (const c of matches) {
    const key = c.page || c.library;
    if (!byPage.has(key)) byPage.set(key, []);
    byPage.get(key).push(c);
  }
  // Within a page, "/" in component names groups them, e.g. "Buttons/Primary".
  const tile = ({ node, insert }) => {
    const leaf = node.name.slice(node.name.lastIndexOf('/') + 1);
    const desc = node.docs?.purpose || node.description || insert.docs?.purpose || insert.description;
    return `<div class="asset${isDeprecated(insert) ? ' deprecated' : ''}" draggable="true" data-component="${insert.id}" title="${isDeprecated(insert) ? 'Deprecated · ' : ''}${esc(node.name)}${desc ? `\n${esc(desc)}` : ''}\nClick to insert, or drag onto the canvas">` +
      `<div class="asset-thumb">${componentThumb(insert)}<button class="asset-info" data-asset-info="${insert.id}" title="Component details: try its properties, then insert">${ASSET_INFO_ICON}</button></div>` +
      `<div class="asset-name">${esc(leaf)}${node.type === 'componentSet' ? ` <span class="muted">· ${node.children.length}</span>` : ''}</div></div>`;
  };
  list.innerHTML = [...byPage].map(([pg, items]) => {
    const groups = new Map();
    for (const it of items) {
      const i = it.node.name.lastIndexOf('/');
      const g = i > 0 ? it.node.name.slice(0, i) : '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    }
    const title = pg.fileId ? `${COMPONENT_LIB_ICON}${esc(pg.name)} <span class="muted">v${pg.version}</span>` : esc(pageLabel(pg));
    return `<div class="assets-group"><div class="assets-group-title">${title}</div>` +
      [...groups].map(([g, list]) => (g ? `<div class="assets-subgroup">${esc(g)}</div>` : '') + `<div class="assets-grid">${list.map(tile).join('')}</div>`).join('') +
      '</div>';
  }).join('') + toggle;
}

function componentThumb(n) {
  const b = worldBounds(n);
  if (!(b.w > 0 && b.h > 0)) return '';
  return `<svg viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet">${nodeWorldSVG(n)}</svg>`;
}

let exportScale = 2, exportFormat = 'png';
function exportControls() {
  return `<select class="select" data-export-scale>${[0.5, 1, 2, 3, 4].map((s) => `<option value="${s}" ${s === exportScale ? 'selected' : ''}>${s}x</option>`).join('')}</select>` +
    `<select class="select" data-export-format>${['png', 'jpg', 'svg'].map((f) => `<option value="${f}" ${f === exportFormat ? 'selected' : ''}>${f.toUpperCase()}</option>`).join('')}</select>`;
}

let lastPropsSig = '';
let showLimits = false; // the Min / max fields, before any is set

export function renderProps() {
  const panel = $('#props');
  const active = document.activeElement;
  const sig = `${page().id}|${state.selection.join()}|${state.tool}`;
  const sameTarget = sig === lastPropsSig;
  if (!sameTarget) showLimits = false;
  lastPropsSig = sig;
  // Keep a field in use (text being typed, a color picker open); dropdowns, checkboxes and buttons can be rebuilt.
  const typing = active?.tagName === 'TEXTAREA' || (active?.tagName === 'INPUT' && active.type !== 'checkbox');
  if (sameTarget && panel.contains(active) && typing) {
    // Don't clobber the field being edited; refresh the others in place.
    const tmp = document.createElement('div');
    tmp.innerHTML = buildProps();
    for (const el of panel.querySelectorAll('input:not([type=color]):not([type=checkbox])')) {
      if (el === active) continue;
      const attr = ['data-key', 'data-paint-hex', 'data-paint-op', 'data-effect-input', 'data-grid-input'].find((a) => el.hasAttribute(a));
      if (!attr) continue;
      const twin = tmp.querySelector(`[${attr}${el.getAttribute(attr) ? `="${el.getAttribute(attr)}"` : ''}]`);
      if (twin) el.value = twin.value;
    }
    return;
  }
  const scroll = panel.scrollTop;
  const expanded=sameTarget?[...panel.querySelectorAll('details[data-component-docs][open]')].map(el=>el.dataset.componentDocs):[];
  panel.innerHTML = buildProps();
  for(const el of panel.querySelectorAll('details[data-component-docs]'))el.open=expanded.includes(el.dataset.componentDocs);
  panel.scrollTop = scroll;
}

function initProps() {
  const panel = $('#props');

  document.querySelector('.right-head .tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-right-tab]');
    if (!b) return;
    rightTab = b.dataset.rightTab;
    document.querySelectorAll('[data-right-tab]').forEach((x) => x.classList.toggle('active', x === b));
    lastPropsSig = null;
    renderProps();
  });
  // Inspect: copy a block; edit a component's code names.
  panel.addEventListener('click', (e) => {
    const clearLimit=e.target.closest('[data-clear-limit]');if(clearLimit)return setProps({[clearLimit.dataset.clearLimit]:undefined});
    const pin=e.target.closest('[data-pin-axis]');if(pin){for(const n of selectedNodes()){const axis=pin.dataset.pinAxis;editNode(n,['constraints'],()=>{n.constraints={...n.constraints,[axis]:togglePin(n.constraints?.[axis],axis,pin.dataset.pinEdge)};});}return commit();}
    if(e.target.closest('[data-pin-center]'))return setProps({'constraints.h':'center','constraints.v':'center'});
    if(e.target.closest('[data-spacing-pin]')){const n=selectedNodes()[0];state.spacingPinned=state.spacingPinned===n?.id?null:n?.id;emit('selection');return emit('overlay');}
    if (e.target.closest('[data-create-code]')) return import('./code-create-ui.js').then(m=>m.openCodeCreation());
    if (e.target.closest('[data-a11y-check]')) return import('./a11y-ui.js').then((m) => m.openAccessibilityCheck());
    const copy = e.target.closest('[data-copy]');
    if (!copy) return;
    navigator.clipboard?.writeText(copy.dataset.copy).then(() => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Copied' })));
  });
  panel.addEventListener('change', (e) => {
    const t = e.target;
    const value = t.value.trim();
    if (t.dataset.codeComponent) {
      const host = getNode(t.dataset.codeComponent);
      if (host) editNode(host, ['codeName'], () => (value ? (host.codeName = value) : delete host.codeName));
    } else if (t.dataset.codeProp) {
      const host = getNode(t.dataset.host);
      const def = host?.props?.[t.dataset.codeProp];
      if (def) editNode(host, ['props'], () => (value ? (def.codeName = value) : delete def.codeName));
    } else if (t.dataset.bpField) {
      // A breakpoint's width, gap or side padding; empty: the frame's own value.
      const [i, k] = t.dataset.bpField.split(':');
      const node = selectedNodes()[0];
      if (!node?.layout?.breakpoints?.[+i]) return;
      const v = value === '' ? undefined : Math.max(k === 'maxW' ? 1 : 0, Math.round(Number(value)));
      if (Number.isNaN(v)) return emit('selection');
      editNode(node, ['layout'], () => {
        const list = node.layout.breakpoints.map((x) => ({ ...x }));
        const keys = k === 'padH' ? ['pl', 'pr'] : [k];
        for (const key of keys) {
          if (v === undefined && key !== 'maxW') delete list[+i][key];
          else if (v !== undefined) list[+i][key] = v;
        }
        node.layout = { ...node.layout, breakpoints: list };
      });
    } else if (t.dataset.a11y) {
      // Accessibility annotations: an empty value goes back to automatic (or the main component's).
      const node = getNode(t.dataset.node);
      const k = t.dataset.a11y;
      if (!node) return;
      const fromMain = node.type === 'instance' && mainComponentOf(node)?.a11y?.[k];
      let v = t.type === 'checkbox' ? (t.checked || (fromMain ? false : undefined)) : value || undefined;
      if (v !== undefined && (k === 'heading' || k === 'focus')) v = Math.max(1, Math.round(Number(v))) || undefined;
      editNode(node, ['a11y'], () => {
        const a = { ...(node.a11y || {}) };
        if (v === undefined) delete a[k];
        else a[k] = v;
        if (Object.keys(a).length) node.a11y = a;
        else delete node.a11y;
      });
    } else if (t.dataset.codeVariant) {
      const host = getNode(t.dataset.host);
      if (host) editNode(host, ['codeNames'], () => {
        host.codeNames ||= {};
        if (value) host.codeNames[t.dataset.codeVariant] = value;
        else delete host.codeNames[t.dataset.codeVariant];
        if (!Object.keys(host.codeNames).length) delete host.codeNames;
      });
    } else return;
    commit();
  });

  const applyField = (key, raw) => {
    const f = FIELDS[key];
    if (!f) return;
    if (f.auto?.test(raw)) return setProps(f.autoValue);
    const v = evalNum(raw);
    if (v === null) return emit('selection');
    if(/^(min|max)[WH]$/.test(key)){
      const other=(key.startsWith('min')?'max':'min')+key.at(-1);
      if(selectedNodes().some(n=>n[other]!=null&&(key.startsWith('min')?v>n[other]:v<n[other]))){window.dispatchEvent(new CustomEvent('sigma:toast',{detail:'Minimum size cannot exceed maximum size. Clear or adjust the other limit first.'}));return emit('selection');}
    }
    setProps(f.set(v));
  };

  panel.addEventListener('pointerover',e=>{const key=e.target.closest('[data-layout-preview]')?.dataset.layoutPreview;if(!['gap','padH','padV'].includes(key))return;const n=selectedNodes()[0];if(!isAutoLayout(n))return;state.spacingPreview={id:n.id,kind:key};emit('overlay');});
  panel.addEventListener('pointerout',e=>{if(e.target.closest('.field')?.contains(e.relatedTarget))return;if(state.spacingPreview){state.spacingPreview=null;emit('overlay');}});
  bindPropertyDrag(panel);
  window.addEventListener('sigma:refresh-panel', () => emit('selection'));

  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (onComponentChange(t)) return;
    if (t.dataset.key) return applyField(t.dataset.key, t.value);
    if (t.dataset.paintHex) {
      const hex = normHex(t.value);
      return hex ? updatePaint(t.dataset.paintHex, 'color', (p) => void (p.color = hex)) : emit('selection');
    }
    if (t.dataset.paintOp) {
      const v = evalNum(t.value);
      if (v === null) return emit('selection');
      return updatePaint(t.dataset.paintOp, 'opacity', (p) => void (p.opacity = Math.min(100, Math.max(0, v)) / 100));
    }
    if (t.dataset.paintColor) return updatePaint(t.dataset.paintColor, 'color', (p) => void (p.color = t.value.toUpperCase()));
    if (t.dataset.gridType) return updateGrid(+t.dataset.gridType, 'type', (g) => Object.assign(g, retypeGrid(g, t.value)));
    if (t.dataset.gridAlign) return updateGrid(+t.dataset.gridAlign, 'align', (g) => void (g.align = t.value));
    if (t.dataset.gridColor) return updateGrid(+t.dataset.gridColor, 'color', (g) => void (g.color = t.value.toUpperCase()));
    if (t.dataset.gridInput) {
      const [i, key] = t.dataset.gridInput.split(':');
      if (key === 'hex') {
        const hex = normHex(t.value);
        return hex ? updateGrid(+i, 'color', (g) => void (g.color = hex)) : emit('selection');
      }
      const v = evalNum(t.value);
      if (v === null) return emit('selection');
      if (key === 'opacity') return updateGrid(+i, 'opacity', (g) => void (g.opacity = Math.min(100, Math.max(0, v)) / 100));
      const clean = key === 'count' ? Math.max(1, Math.round(v)) : key === 'size' ? Math.max(1, v) : key === 'gutter' ? Math.max(0, v) : v;
      return updateGrid(+i, key, (g) => void (g[key] = clean));
    }
    if (t.dataset.effectType) return updateEffect(+t.dataset.effectType, (fx) => void (fx.type = t.value), { field: 'type' });
    if (t.dataset.effectColor) return updateEffect(+t.dataset.effectColor, (fx) => void (fx.color = t.value.toUpperCase()));
    if (t.dataset.effectInput) {
      const [i, key] = t.dataset.effectInput.split(':');
      if (key === 'hex') {
        const hex = normHex(t.value);
        return hex ? updateEffect(+i, (fx) => void (fx.color = hex)) : emit('selection');
      }
      const v = evalNum(t.value);
      if (v === null) return emit('selection');
      if (key === 'opacity') return updateEffect(+i, (fx) => void (fx.opacity = Math.min(100, Math.max(0, v)) / 100));
      return updateEffect(+i, (fx) => void (fx[key] = key === 'blur' ? Math.max(0, v) : v));
    }
    if (t.dataset.bool) return setProps({ [t.dataset.bool]: t.checked });
    if (t.dataset.modeCol) return setMode(t.dataset.modeTarget, t.dataset.modeCol, t.value);
    if (t.dataset.constraint) return setProps({ [`constraints.${t.dataset.constraint}`]: t.value });
    if (t.dataset.sizing) return setProps({ [t.dataset.sizing === 'w' ? 'sizingH' : 'sizingV']: t.value });
    if (t.dataset.select) {
      const v = t.dataset.select === 'fontWeight' ? +t.value : t.value;
      return setProps({ [t.dataset.select]: v });
    }
    if (t.hasAttribute('data-export-scale')) exportScale = +t.value;
    if (t.hasAttribute('data-export-format')) exportFormat = t.value;
  });
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.paintColor) {
      updatePaint(t.dataset.paintColor, 'color', (p) => void (p.color = t.value.toUpperCase()), { live: true });
      t.parentElement.style.setProperty('--c', t.value);
    }
    if (t.dataset.gridColor) {
      updateGrid(+t.dataset.gridColor, 'color', (g) => void (g.color = t.value.toUpperCase()), { live: true });
      t.parentElement.style.setProperty('--c', t.value);
    }
    if (t.dataset.effectColor) {
      updateEffect(+t.dataset.effectColor, (fx) => void (fx.color = t.value.toUpperCase()), { live: true });
      t.parentElement.style.setProperty('--c', t.value);
    }

  });
  panel.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.tagName !== 'INPUT') return;
    if (e.key === 'Enter') {
      t.blur();
    } else if (e.key === 'Escape') {
      emit('selection');
      t.blur();
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && t.dataset.key) {
      e.preventDefault();
      const cur = evalNum(t.value) ?? 0;
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      t.value = fmtNum(cur + step);
      applyField(t.dataset.key, t.value);
    }
  });
  panel.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'color') e.target.select();
  });
  panel.addEventListener('click', (e) => {
    if (onComponentClick(e)) return;
    const b = e.target.closest('button');
    if (!b) return;
    const nodes = selectedNodes();
    if (b.dataset.align) return align(b.dataset.align);
    if (b.dataset.distribute) return distribute(b.dataset.distribute);
    if (b.dataset.textAlign) return setProps({ textAlign: b.dataset.textAlign });
    if (b.dataset.textCase) return setProps({ textCase: b.dataset.textCase });
    if (b.dataset.strokeSide) {
      const side = b.dataset.strokeSide;
      const turnOn = !nodes.every((n) => strokeSides(n)[side]);
      for (const n of nodes) {
        editNode(n, ['strokeSides'], () => {
          const s = { ...strokeSides(n), [side]: turnOn };
          if (s.top && s.right && s.bottom && s.left) delete n.strokeSides;
          else n.strokeSides = s;
        });
      }
      return commit();
    }
    if (b.dataset.autoResize) return setProps({ autoResize: b.dataset.autoResize });
    if (b.dataset.varMenu) return variableMenu(b, b.dataset.varMenu);
    if (b.dataset.paintAct === 'toggle') return updatePaint(b.dataset.paint, 'visible', (p) => void (p.visible = p.visible === false));
    if (b.dataset.paintAct === 'remove') return removePaint(b.dataset.paint);
    if (b.dataset.gridAct === 'toggle') return updateGrid(+b.dataset.grid, 'visible', (g) => void (g.visible = g.visible === false));
    if (b.dataset.gridAct === 'remove') return removeGrid(+b.dataset.grid);
    if (b.dataset.effectAct === 'toggle') return updateEffect(+b.dataset.effect, (fx) => void (fx.visible = fx.visible === false), { field: 'visible' });
    if (b.dataset.effectAct === 'remove') return removeEffect(+b.dataset.effect);
    if (b.dataset.alMode) return setProps({ 'layout.mode': b.dataset.alMode });
    if (b.dataset.bpHide !== undefined) {
      // Which of the frame's layers this breakpoint hides (by their id; an instance's by its main's).
      const n = nodes[0];
      const i = +b.dataset.bpHide;
      const r = b.getBoundingClientRect();
      const hide = new Set(n.layout.breakpoints?.[i]?.hide || []);
      const items = (n.children || []).map((k) => {
        const id = k.sourceId || k.id;
        return {
          label: k.name, checked: hide.has(id), action: () => {
            editNode(n, ['layout'], () => {
              const list = n.layout.breakpoints.map((x) => ({ ...x }));
              const set = new Set(list[i].hide || []);
              if (set.has(id)) set.delete(id);
              else set.add(id);
              if (set.size) list[i].hide = [...set];
              else delete list[i].hide;
              n.layout = { ...n.layout, breakpoints: list };
            });
            commit();
          },
        };
      });
      return showContextMenu(r.left, r.bottom + 4, items.length ? [{ label: `Hidden at ≤ ${n.layout.breakpoints[i].maxW}px`, disabled: true, action: () => {} }, '-', ...items] : [{ label: 'This frame has no layers', disabled: true, action: () => {} }]);
    }
    if (b.dataset.bpAdd !== undefined || b.dataset.bpDel !== undefined || b.dataset.bpMode) {
      const n = nodes[0];
      editNode(n, ['layout'], () => {
        const list = [...(n.layout.breakpoints || [])].map((x) => ({ ...x }));
        if (b.dataset.bpAdd !== undefined) {
          // A narrower width than the narrowest so far, stacked: a phone-sized column.
          const narrowest = Math.min(Math.round(n.w), ...list.map((x) => x.maxW));
          list.push({ maxW: Math.max(1, narrowest > 600 ? 600 : narrowest - 1), mode: 'vertical' });
        } else if (b.dataset.bpDel !== undefined) list.splice(+b.dataset.bpDel, 1);
        else {
          const [i, m] = b.dataset.bpMode.split(':');
          list[+i].mode = m;
        }
        n.layout = { ...n.layout, breakpoints: list };
        if (!list.length) delete n.layout.breakpoints;
      });
      return commit();
    }
    if (b.dataset.alDir) {
      // The same as the frame it's in: no setting of its own, so it follows that frame.
      for (const n of nodes) {
        const parent = getParent(n.id);
        const around = parent ? directionOf(parent) : 'ltr';
        editNode(n, ['dir'], () => {
          if (b.dataset.alDir === around) delete n.dir;
          else n.dir = b.dataset.alDir;
        });
      }
      return commit();
    }
    if (b.dataset.alAlign) {
      const [r, c] = b.dataset.alAlign.split(',');
      for (const n of nodes) {
        if (!n.layout) continue;
        const horiz = n.layout.mode === 'horizontal';
        editNode(n, ['layout.alignP', 'layout.alignC'], () => {
          n.layout.alignP = horiz ? c : r;
          n.layout.alignC = horiz ? r : c;
        });
      }
      return commit();
    }
    if (b.dataset.preset) {
      const [name, w, h] = FRAME_PRESETS[+b.dataset.preset];
      const { width, height } = viewportSize();
      const c = toWorld({ x: width / 2, y: height / 2 });
      const n = createNode('frame', { name, w, h });
      insertNode(n, null);
      setWorldMatrix(n, translate(Math.round(c.x - w / 2), Math.round(c.y - h / 2)));
      setTool('move');
      select([n.id]);
      commit();
      zoomToSelection();
      return;
    }
    switch (b.dataset.action) {
      case 'insert-icon':
        return openInsertIcon(b.getBoundingClientRect());
      case 'swap-icon':
        return openSwapIcon(b.getBoundingClientRect());
      case 'icon-prop': {
        const r = b.getBoundingClientRect();
        return showContextMenu(r.left, r.bottom + 4, propMenuItems(nodes, 'iconId', r));
      }
      case 'publish-components':
        return openPublishComponentsDialog();
      case 'reset-overrides':
        return resetSelectionOverrides();
      case 'add-al':
        return addAutoLayout();
      case 'remove-al':
        return removeAutoLayout();
      case 'show-limits':
        showLimits = !showLimits;
        document.activeElement?.blur();
        renderProps();
        if(showLimits)document.querySelector('[data-key="minW"]')?.focus();
        else document.querySelector('[data-action="show-limits"]')?.focus();
        return;
      case 'independent-corners': {
        // Toggle between one radius and four: going back keeps the top-left corner's value for all.
        const split = !nodes.every((n) => Array.isArray(n.radii));
        for (const n of nodes) {
          if (!(isFrameLike(n) || ['rect', 'image'].includes(n.type))) continue;
          editNode(n, ['radius', 'radii'], () => {
            if (split) n.radii = [0, 1, 2, 3].map(() => n.radius || 0);
            else {
              n.radius = n.radii?.[0] ?? n.radius ?? 0;
              delete n.radii;
            }
          });
        }
        return commit();
      }
      case 'lock-aspect': {
        const on = !nodes.every((n) => n.lockAspect);
        for (const n of nodes) editNode(n, ['lockAspect'], () => void (n.lockAspect = on));
        return commit();
      }
      case 'add-fills':
        return addPaint('fills');
      case 'add-strokes':
        return addPaint('strokes');
      case 'add-effect':
        return addEffect();
      case 'add-grid':
        return addGrid();
      case 'export':
        return exportNodes(nodes, { format: exportFormat, scale: exportScale });
      case 'export-page':
        return exportNodes(page().children, { format: exportFormat, scale: exportScale });
    }
  });

  // Scrubbable labels
  panel.addEventListener('pointerdown', (e) => {
    const lbl = e.target.closest('[data-scrub]');
    if (!lbl || lbl.closest('fieldset[disabled]')) return;
    e.preventDefault();
    const key = lbl.dataset.scrub;
    const f = FIELDS[key];
    const nodes = selectedNodes();
    if (!nodes.length) return;
    const start = e.clientX;
    let base = f.get(nodes[0]);
    if (typeof base !== 'number') base = key === 'lineHeight' ? 120 : 0;
    document.body.classList.add('scrubbing');
    let moved = false;
    const move = (ev) => {
      moved = true;
      const step = ev.shiftKey ? 10 : 1;
      const v = Math.round(base + (ev.clientX - start) * step);
      setProps(f.set(v), { live: true, nodes });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('scrubbing');
      if (moved) commit();
      else lbl.parentElement.querySelector('input')?.focus();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // Zoom menu
  $('#zoom-btn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = () => {
      const { width, height } = viewportSize();
      return { x: width / 2, y: height / 2 };
    };
    showContextMenu(r.left - 120, r.bottom + 4, [
      { label: 'Zoom in', shortcut: '⌘+', action: zoomIn },
      { label: 'Zoom out', shortcut: '⌘−', action: zoomOut },
      { label: 'Zoom to fit', shortcut: '⇧1', action: zoomToFit },
      { label: 'Zoom to selection', shortcut: '⇧2', action: zoomToSelection },
      '-',
      { label: 'Zoom to 50%', action: () => zoomAt(0.5 / view().zoom, c()) },
      { label: 'Zoom to 100%', shortcut: '⇧0', action: zoomTo100 },
      { label: 'Zoom to 200%', action: () => zoomAt(2 / view().zoom, c()) },
      '-',
      { label: 'Layout grids', shortcut: '⌃G', checked: state.showGrids, action: () => setShowGrids(!state.showGrids) },
    ]);
  });
}

export function renderZoomLabel() {
  $('#zoom-btn').innerHTML = `${Math.round(view().zoom * 100)}%${icons.chevronDown}`;
}

// ---------- toast ----------
function initToast() {
  let timer;
  window.addEventListener('sigma:toast', (e) => {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = e.detail;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 3200);
  });
}
