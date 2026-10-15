import {lucideIcon} from './lucide.js';
import { toggleTerminal } from './terminal.js';
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
const RAIL_ICONS = {
  tokens:lucideIcon('file-symlink',20),browse:lucideIcon('list-tree',20),audit:lucideIcon('search-check',20),components:lucideIcon('component',20),icons:lucideIcon('shapes',20),
};
export const RAIL_TOOL_ICONS = {
  linked:lucideIcon('link',20),import:lucideIcon('import',20),export:lucideIcon('upload',20),code:lucideIcon('code-xml',20),
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
  if (b?.dataset.rail === 'terminal') { toggleTerminal(); return; }
  if (b && kind) KINDS[kind]?.find((t) => t.id === b.dataset.rail)?.open();
});

const lastHTML = new WeakMap();
/** Draw a rail's tools (only when something about them changed). */
export function renderRailTools(container, kind = container?.dataset.railKind) {
  if (!container || !state.doc || !KINDS[kind]) return;
  const tools = [...KINDS[kind]];
  if (kind === 'design' || kind === 'tokens') tools.push({ id: 'terminal', label: 'Terminal', sepBefore: true, icon: lucideIcon('terminal',20) });
  const html = tools.map((t) => {
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
