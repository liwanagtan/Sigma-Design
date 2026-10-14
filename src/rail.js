// The file tools rail: a thin column of icon buttons at the left edge of a design file, for what the file uses
// (its Sigma Tokens file, its design tokens and their audit, its component and icon libraries). They used to
// sit in the Design panel with nothing selected; here they're one click away and the Design panel is quieter.
// Each opens the same dialog as before; a dot or a count says what's linked, and the tooltip says it in words.
import { state } from './store.js';
import {
  libraries, componentLibraries, iconLibraries, openDesignTokensDialog, openLibrariesDialog, openIconLibrariesDialog,
} from './libraries.js';
import { localCollections } from './variables.js';
import { openVariablesEditor } from './variables-ui.js';
import { openAuditDialog } from './audit-ui.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (body) => `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const RAIL_ICONS = {
  // A token (the hexagon Sigma Tokens files use), with a swap arrow: change the file.
  tokens: svg('<path d="M9 2.5l5.2 3v6L9 14.5l-5.2-3v-6z"/><circle cx="9" cy="8.5" r="1.7"/><path d="M14 15.5h3.5M16 14l1.5 1.5L16 17"/>'),
  // Rows of swatches: browse the tokens.
  browse: svg('<rect x="3" y="3.5" width="4" height="4" rx="1"/><path d="M9.5 5.5h7.5"/><rect x="3" y="8.5" width="4" height="4" rx="1"/><path d="M9.5 10.5h7.5"/><rect x="3" y="13.5" width="4" height="4" rx="1"/><path d="M9.5 15.5h5"/>'),
  // A magnifier with a check: audit.
  audit: svg('<circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.5 12.5l4.5 4.5"/><path d="M6.2 8.6l1.6 1.6 3-3.2"/>'),
  // Four diamonds, as Assets draws components.
  components: svg('<path d="M10 2.2l2.6 2.6L10 7.4 7.4 4.8zM10 12.6l2.6 2.6-2.6 2.6-2.6-2.6zM4.8 7.4L7.4 10l-2.6 2.6L2.2 10zM15.2 7.4l2.6 2.6-2.6 2.6-2.6-2.6z"/>'),
  // A star, as Sigma Icons files are drawn.
  icons: svg('<path d="M10 2.8l2.2 4.5 5 .7-3.6 3.5.9 4.9L10 14.1l-4.5 2.3.9-4.9L2.8 8l5-.7z"/>'),
};

// The tools, in order: { id, label, icon, open, state() → { title, badge?, alert? } }.
const TOOLS = [
  { id: 'tokens', label: 'Change Sigma Tokens file', icon: RAIL_ICONS.tokens, open: () => openDesignTokensDialog(), state: () => {
    const t = libraries();
    if (!t.length) return { title: 'Choose a Sigma Tokens file: none chosen yet', alert: true };
    if (t.length > 1) return { title: `This file uses ${t.length} Sigma Tokens files (${t.map((l) => l.name).join(', ')}): choose one`, alert: true };
    return { title: `Sigma Tokens file: ${t[0].name} v${t[0].version}. Change it` };
  } },
  { id: 'browse', label: 'Browse design tokens', icon: RAIL_ICONS.browse, open: () => openVariablesEditor(), state: () => {
    const n = localCollections().reduce((k, c) => k + c.variables.length, 0);
    return { title: `Browse design tokens: the Sigma Tokens file’s, and ${n ? `${n} local token${n === 1 ? '' : 's'}` : 'no local tokens'} in this file` };
  } },
  { id: 'audit', label: 'Audit design tokens', icon: RAIL_ICONS.audit, open: () => openAuditDialog(), state: () => ({
    title: 'Audit design tokens: find colors, text styles, spacing, radii and shadows that don’t use tokens',
  }) },
  { id: 'components', label: 'Component libraries', icon: RAIL_ICONS.components, open: () => openLibrariesDialog(), state: () => {
    const l = componentLibraries();
    return { title: l.length ? `Component libraries: ${l.map((x) => `${x.name} v${x.version}`).join(', ')}` : 'Component libraries: link Sigma Design files that publish components, to use them from Assets', badge: l.length || null };
  } },
  { id: 'icons', label: 'Icon libraries', icon: RAIL_ICONS.icons, open: () => openIconLibrariesDialog(), state: () => {
    const l = iconLibraries();
    return { title: l.length ? `Icon libraries: ${l.map((x) => `${x.name} v${x.version}`).join(', ')}` : 'Icon libraries: link Sigma Icons files, to use their icons', badge: l.length || null };
  } },
];

export function initRail() {
  const rail = document.getElementById('rail');
  rail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rail]');
    if (b) TOOLS.find((t) => t.id === b.dataset.rail)?.open();
  });
  renderRail();
}

let last = '';
export function renderRail() {
  const rail = document.getElementById('rail');
  if (!rail || !state.doc) return;
  const html = TOOLS.map((t, i) => {
    const st = t.state();
    return `${i === 3 ? '<div class="rail-sep"></div>' : ''}<button class="rail-btn" data-rail="${t.id}" title="${esc(st.title)}" aria-label="${esc(t.label)}">${t.icon}` +
      `${st.alert ? '<span class="rail-dot"></span>' : st.badge ? `<span class="rail-badge">${st.badge}</span>` : ''}</button>`;
  }).join('');
  if (html !== last) rail.innerHTML = last = html;
}
