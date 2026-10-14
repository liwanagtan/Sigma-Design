// The file tools rail: a thin column of icon buttons at the left edge of every file (design, tokens and icons
// files). At the top, the Σ menu and Home; then the tools for that kind of file. A design file's
// are for what it uses (its tokens file, its tokens and their audit, its component and icon libraries);
// a token file's and an icon file's are registered by their screens (registerRailTools). A dot or a count says
// what's linked, and each tooltip says it in words.
import { state } from './store.js';
import {
  libraries, componentLibraries, iconLibraries, openDesignTokensDialog, openLibrariesDialog, openIconLibrariesDialog,
} from './libraries.js';
import { localCollections } from './variables.js';
import { icons as uiIcons } from './icons.js';
import { openVariablesEditor } from './variables-ui.js';
import { openAuditDialog } from './audit-ui.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (body) => `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const RAIL_ICONS = {
  // A token (the hexagon tokens files use), with a swap arrow: change the file.
  tokens: svg('<path d="M9 2.5l5.2 3v6L9 14.5l-5.2-3v-6z"/><circle cx="9" cy="8.5" r="1.7"/><path d="M14 15.5h3.5M16 14l1.5 1.5L16 17"/>'),
  // Rows of swatches: browse the tokens.
  browse: svg('<rect x="3" y="3.5" width="4" height="4" rx="1"/><path d="M9.5 5.5h7.5"/><rect x="3" y="8.5" width="4" height="4" rx="1"/><path d="M9.5 10.5h7.5"/><rect x="3" y="13.5" width="4" height="4" rx="1"/><path d="M9.5 15.5h5"/>'),
  // A magnifier with a check: audit.
  audit: svg('<circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.5 12.5l4.5 4.5"/><path d="M6.2 8.6l1.6 1.6 3-3.2"/>'),
  // Four diamonds, as Assets draws components.
  components: svg('<path d="M10 2.2l2.6 2.6L10 7.4 7.4 4.8zM10 12.6l2.6 2.6-2.6 2.6-2.6-2.6zM4.8 7.4L7.4 10l-2.6 2.6L2.2 10zM15.2 7.4l2.6 2.6-2.6 2.6-2.6-2.6z"/>'),
  // A star, as icons files are drawn.
  icons: svg('<path d="M10 2.8l2.2 4.5 5 .7-3.6 3.5.9 4.9L10 14.1l-4.5 2.3.9-4.9L2.8 8l5-.7z"/>'),
};

// Icons for the token and icon screens' tools.
export const RAIL_TOOL_ICONS = {
  // Two chain links: linked files.
  linked: svg('<path d="M8.5 11.5l3-3"/><path d="M9.5 6l1.6-1.6a3 3 0 0 1 4.2 4.2L13.7 10.2"/><path d="M10.5 14l-1.6 1.6a3 3 0 0 1-4.2-4.2L6.3 9.8"/>'),
  // An arrow into a tray: import.
  import: svg('<path d="M10 3v9M6.5 8.5L10 12l3.5-3.5"/><path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13"/>'),
  // An arrow out of a tray: export.
  export: svg('<path d="M10 12V3M6.5 6.5L10 3l3.5 3.5"/><path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13"/>'),
  // Code brackets: CSS.
  code: svg('<path d="M7 5.5L2.8 10 7 14.5M13 5.5l4.2 4.5-4.2 4.5"/>'),
};

// The tools, in order: { id, label, icon, open, state() → { detail, badge?, alert? }, sepBefore? }. The tooltip shows
// the label, and the detail under it (what's linked, or what it does).
const TOOLS = [
  { id: 'tokens', label: 'Change tokens file', icon: RAIL_ICONS.tokens, open: () => openDesignTokensDialog(), state: () => {
    const t = libraries();
    if (!t.length) return { detail: 'None chosen yet: choose one to use its tokens', alert: true };
    if (t.length > 1) return { detail: `This file uses ${t.length} (${t.map((l) => l.name).join(', ')}): choose one`, alert: true };
    return { detail: `Using ${t[0].name} v${t[0].version}` };
  } },
  { id: 'browse', label: 'Browse design tokens', icon: RAIL_ICONS.browse, open: () => openVariablesEditor(), state: () => {
    const n = localCollections().reduce((k, c) => k + c.variables.length, 0);
    return { detail: `The tokens file’s, and ${n ? `${n} local token${n === 1 ? '' : 's'}` : 'no local tokens'} in this file` };
  } },
  { id: 'audit', label: 'Audit design tokens', icon: RAIL_ICONS.audit, open: () => openAuditDialog(), state: () => ({
    detail: 'Find colors, text styles, spacing, radii and shadows that don’t use tokens',
  }) },
  { id: 'components', label: 'Component libraries', icon: RAIL_ICONS.components, sepBefore: true, open: () => openLibrariesDialog(), state: () => {
    const l = componentLibraries();
    return { detail: l.length ? l.map((x) => `${x.name} v${x.version}`).join(', ') : 'None linked: link files that publish components, to use them from Assets', badge: l.length || null };
  } },
  { id: 'icons', label: 'Icon libraries', icon: RAIL_ICONS.icons, open: () => openIconLibrariesDialog(), state: () => {
    const l = iconLibraries();
    return { detail: l.length ? l.map((x) => `${x.name} v${x.version}`).join(', ') : 'None linked: link icons files, to use their icons', badge: l.length || null };
  } },
];

const KINDS = { design: TOOLS };

/** A token or icon screen's tools (same shape as the design file's). */
export function registerRailTools(kind, tools) {
  KINDS[kind] = tools;
}

/** The rail's markup for the token and icon screens: Σ menu, Home, then that kind's tools (renderRailTools). */
export function railHTML(kind) {
  return `<nav class="rail" aria-label="File tools">` +
    `<button class="rail-btn rail-logo" data-rail-menu aria-label="Main menu" data-tip-detail="Files, export, version history and more" aria-haspopup="menu">${uiIcons.logo}</button>` +
    `<button class="rail-btn" data-rail-home aria-label="Home" data-tip-detail="Back to your files">${uiIcons.home}</button>` +
    `<div class="rail-sep"></div><div class="rail-tools" data-rail-kind="${kind}"></div></nav>`;
}

// Any rail's tool buttons, wherever they are.
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-rail]');
  const kind = b?.closest('[data-rail-kind]')?.dataset.railKind;
  if (b && kind) KINDS[kind]?.find((t) => t.id === b.dataset.rail)?.open();
});

const lastHTML = new WeakMap();
/** Draw a rail's tools (only when something about them changed). */
export function renderRailTools(container, kind = container?.dataset.railKind) {
  if (!container || !state.doc || !KINDS[kind]) return;
  const html = KINDS[kind].map((t) => {
    const st = t.state ? t.state() : {};
    return `${t.sepBefore ? '<div class="rail-sep"></div>' : ''}<button class="rail-btn" data-rail="${t.id}" aria-label="${esc(t.label)}"${st.detail ? ` data-tip-detail="${esc(st.detail)}"` : ''}>${t.icon}` +
      `${st.alert ? '<span class="rail-dot"></span>' : st.badge ? `<span class="rail-badge">${st.badge}</span>` : ''}</button>`;
  }).join('');
  if (html !== lastHTML.get(container)) {
    container.innerHTML = html;
    lastHTML.set(container, html);
  }
}

export function initRail() {
  document.getElementById('rail-tools').dataset.railKind = 'design';
  renderRail();
}

export function renderRail() {
  renderRailTools(document.getElementById('rail-tools'), 'design');
}

// ---------- tooltips ----------
// Every rail button's tooltip, shown beside it: its name, and under it what's linked or what it does. Sigma's
// own, not the browser's (that one is slow, and some embedded browsers don't show it). Quick to appear, and
// instant while moving between buttons; also shown when a button gets keyboard focus.
let tip = null;
let showTimer = 0;
let hiddenAt = 0;
let tipFor = null;
function tipEl() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'rail-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  return tip;
}
function showTip(btn) {
  const el = tipEl();
  const label = btn.getAttribute('aria-label') || '';
  const detail = btn.dataset.tipDetail || '';
  el.innerHTML = `<div class="rail-tip-label">${esc(label)}</div>${detail ? `<div class="rail-tip-detail">${esc(detail)}</div>` : ''}`;
  el.hidden = false;
  const r = btn.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  el.style.left = `${Math.round(r.right + 8)}px`;
  el.style.top = `${Math.round(Math.max(8, Math.min(window.innerHeight - t.height - 8, r.top + r.height / 2 - t.height / 2)))}px`;
  tipFor = btn;
}
function hideTip() {
  clearTimeout(showTimer);
  if (tip && !tip.hidden) {
    tip.hidden = true;
    hiddenAt = Date.now();
  }
  tipFor = null;
}
document.addEventListener('mouseover', (e) => {
  const btn = e.target.closest?.('.rail-btn');
  if (!btn || btn === tipFor) return;
  clearTimeout(showTimer);
  // Moving from one button to the next shows the next at once.
  const quick = (tip && !tip.hidden) || Date.now() - hiddenAt < 600;
  showTimer = setTimeout(() => btn.isConnected && showTip(btn), quick ? 0 : 300);
});
document.addEventListener('mouseout', (e) => {
  const btn = e.target.closest?.('.rail-btn');
  if (btn && !btn.contains(e.relatedTarget)) hideTip();
});
document.addEventListener('focusin', (e) => {
  const btn = e.target.closest?.('.rail-btn');
  if (btn && btn.matches(':focus-visible')) showTip(btn);
});
document.addEventListener('focusout', (e) => e.target.closest?.('.rail-btn') && hideTip());
// Clicking (a menu or dialog opens), scrolling, a key, or leaving the window hides it.
for (const type of ['pointerdown', 'wheel', 'keydown']) document.addEventListener(type, () => tipFor && hideTip(), true);
window.addEventListener('blur', hideTip);
