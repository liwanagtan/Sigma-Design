// The token audit dialog (Σ menu → Audit design tokens…): one-off values grouped by value with the token
// that matches, layers using deprecated tokens, and instances of deprecated components.
import { state, page, emit, commit, select, getNode, editNode } from './store.js';
import { auditDocument, applyToken, pagesOf, AUDIT_KINDS } from './audit.js';
import { collections, findVariable } from './variables.js';
import { valuePreview, openTokenPicker } from './token-picker.js';
import { openComponentPicker } from './component-ui.js';
import { zoomToSelection } from './commands.js';
import { modal } from './libraries.js';
import { pageLabel } from './page-groups.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "in Dark", "in Brand B · Light" for layers that don't use the default modes.
function modeLabel(modeKey) {
  const ctx = JSON.parse(modeKey || '{}');
  const names = Object.entries(ctx).map(([colId, modeId]) => {
    const col = collections().find((c) => c.id === colId);
    const mode = col?.modes.find((m) => m.id === modeId);
    return col && mode ? (col.extends ? `${col.name} · ${mode.name}` : mode.name) : null;
  }).filter(Boolean);
  return names.length ? `in ${names.join(', ')}` : '';
}

function suggestionCell(g, i) {
  const s = g.suggestion;
  if (!s) return `<span class="muted">No ${AUDIT_KINDS[g.kind].type} tokens</span>`;
  const preview = valuePreview(AUDIT_KINDS[g.kind].type, s.value);
  return `<span class="audit-match ${s.exact ? 'exact' : 'close'}" title="${s.exact ? 'Same value' : 'Closest token: using it changes the value'}">` +
    `${s.exact ? '=' : '≈'} <b>${esc(s.name)}</b>${s.exact ? '' : ` <span class="audit-value">${preview}</span>`}` +
    `${s.others ? ` <span class="muted" title="${s.others} other token${s.others === 1 ? '' : 's'} ${s.exact ? 'match' : 'are as close'}; use Choose… to pick one">+${s.others}</span>` : ''}</span>` +
    `<button class="btn${s.exact ? ' primary' : ''}" data-use="${i}">${s.exact ? 'Use' : 'Use closest'}</button>`;
}

function body(report) {
  const { groups, deprecatedTokens, deprecatedComponents, total } = report;
  const exact = groups.filter((g) => g.suggestion?.exact);
  let html = '';
  if (!groups.length && !deprecatedTokens.length && !deprecatedComponents.length) {
    return '<div class="audit-done">Every color, text style, spacing, radius and shadow in this file uses a design token, and nothing uses deprecated tokens or components.</div>';
  }
  html += `<p class="muted lib-intro">${groups.length
    ? `${plural(groups.length, 'value')} in ${plural(total, 'place')} ${groups.length === 1 ? 'doesn’t' : 'don’t'} use a design token. Use the matching token, pick another, or select the layers to look at them. Layers inside instances come from their main component, so they aren’t listed.`
    : 'Every value uses a design token.'}</p>`;
  if (exact.length > 1) html += `<button class="btn primary audit-all" data-use-all>Use all ${exact.length} exact matches</button>`;
  for (const [kind, { label }] of Object.entries(AUDIT_KINDS)) {
    const rows = groups.map((g, i) => ({ g, i })).filter(({ g }) => g.kind === kind);
    if (!rows.length) continue;
    html += `<div class="audit-section"><div class="audit-title">${label} <span class="muted">${rows.length}</span></div>` +
      rows.map(({ g, i }) => `<div class="audit-row"><span class="audit-value">${valuePreview(AUDIT_KINDS[kind].type, g.value)}</span>` +
        `<span class="muted audit-count">${plural(g.layers.length, 'layer')}${modeLabel(g.modeKey) ? ` · ${esc(modeLabel(g.modeKey))}` : ''}</span>` +
        `<span class="audit-actions">${suggestionCell(g, i)}<button class="btn" data-pick="${i}">Choose…</button><button class="btn" data-select="${i}">Select</button></span></div>`).join('') +
      '</div>';
  }
  if (deprecatedTokens.length) {
    html += `<div class="audit-section"><div class="audit-title">Deprecated tokens in use <span class="muted">${deprecatedTokens.length}</span></div>` +
      deprecatedTokens.map((t, i) => {
        const v = findVariable(t.id)?.variable;
        return `<div class="audit-row"><span class="audit-value"><s>${esc(t.name)}</s></span><span class="muted audit-count" title="${esc(v?.description || '')}">${plural(t.layers.length, 'layer')}${v?.description ? ` · ${esc(v.description)}` : ''}</span>` +
          `<span class="audit-actions"><button class="btn" data-replace="${i}">Replace with…</button><button class="btn" data-select-dt="${i}">Select</button></span></div>`;
      }).join('') + '</div>';
  }
  if (deprecatedComponents.length) {
    html += `<div class="audit-section"><div class="audit-title">Deprecated components in use <span class="muted">${deprecatedComponents.length}</span></div>` +
      deprecatedComponents.map((c, i) => `<div class="audit-row"><span class="audit-value"><s>${esc(c.name)}</s></span><span class="muted audit-count">${plural(c.instances.length, 'instance')}</span>` +
        `<span class="audit-actions"><button class="btn" data-swap="${i}">Swap to…</button><button class="btn" data-select-dc="${i}">Select</button></span></div>`).join('') + '</div>';
  }
  return html;
}

// Show the layers: go to the page with most of them and select them there.
export function selectLayers(ids) {
  const byPage = new Map();
  for (const id of ids) {
    const pg = pagesOf([{ id }])[0];
    if (pg) byPage.set(pg, [...(byPage.get(pg) || []), id]);
  }
  const [pg, onPage] = [...byPage].sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (!pg) return;
  if (pg !== page()) {
    state.doc.currentPageId = pg.id;
    state.selection = [];
    emit('doc');
  }
  select(onPage);
  requestAnimationFrame(() => zoomToSelection());
  if (byPage.size > 1) toast(`Selected ${onPage.length} on “${pageLabel(pg)}”; ${ids.length - onPage.length} more on other pages`);
}

export function openAuditDialog() {
  if (!state.doc || state.doc.kind === 'tokens') return;
  let report = auditDocument();
  const wrap = modal('Audit design tokens', body(report), '<button class="btn" data-refresh>Run again</button><span class="spacer"></span><button class="btn" data-close>Done</button>');
  wrap.querySelector('.modal').classList.add('audit-modal');
  const refresh = () => {
    report = auditDocument();
    wrap.querySelector('.lib-body').innerHTML = body(report);
  };
  const close = () => wrap.querySelector('[data-close]')?.click();
  const use = (groups, varId) => {
    const n = groups.reduce((s, g) => s + applyToken(g.layers, varId), 0);
    commit();
    refresh();
    return n;
  };
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const { groups, deprecatedTokens, deprecatedComponents } = report;
    if (b.hasAttribute('data-refresh')) return refresh();
    if (b.hasAttribute('data-use-all')) {
      const exact = groups.filter((g) => g.suggestion?.exact);
      let n = 0;
      for (const g of exact) n += applyToken(g.layers, g.suggestion.id);
      commit();
      refresh();
      return toast(`${plural(n, 'value')} now use their tokens`);
    }
    if (b.dataset.use) {
      const g = groups[+b.dataset.use];
      const n = use([g], g.suggestion.id);
      return toast(`${plural(n, 'layer')} now use${n === 1 ? 's' : ''} ${g.suggestion.name}`);
    }
    if (b.dataset.pick) {
      const g = groups[+b.dataset.pick];
      return openTokenPicker({
        anchor: b.getBoundingClientRect(), type: AUDIT_KINDS[g.kind].type,
        onPick: (id) => use([g], id),
      });
    }
    if (b.dataset.select) {
      close();
      return selectLayers(groups[+b.dataset.select].layers.map((l) => l.id));
    }
    if (b.dataset.selectDt) {
      close();
      return selectLayers(deprecatedTokens[+b.dataset.selectDt].layers.map((l) => l.id));
    }
    if (b.dataset.selectDc) {
      close();
      return selectLayers(deprecatedComponents[+b.dataset.selectDc].instances);
    }
    if (b.dataset.replace) {
      const t = deprecatedTokens[+b.dataset.replace];
      const type = findVariable(t.id)?.variable.type;
      return openTokenPicker({
        anchor: b.getBoundingClientRect(), type, exclude: (id) => id === t.id,
        onPick: (id) => {
          const n = applyToken(t.layers, id);
          commit();
          refresh();
          toast(`${plural(n, 'layer')} moved to ${findVariable(id)?.variable.name}`);
        },
      });
    }
    if (b.dataset.swap) {
      const c = deprecatedComponents[+b.dataset.swap];
      return openComponentPicker({
        anchor: b.getBoundingClientRect(), exclude: (node) => node.id === c.id,
        onPick: (id) => {
          for (const instId of c.instances) {
            const inst = getNode(instId);
            if (inst) editNode(inst, ['componentId'], () => void (inst.componentId = id));
          }
          commit();
          refresh();
          toast(`${plural(c.instances.length, 'instance')} swapped`);
        },
      });
    }
  });
}
