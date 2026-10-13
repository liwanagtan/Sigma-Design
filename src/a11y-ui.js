// The accessibility check dialog (Σ menu → Check accessibility…, or Inspect → Accessibility): issues in the
// selected frames (or every frame on the page), grouped by kind with the reason, to select or annotate.
import { state, page, getParent, getNode } from './store.js';
import { checkAccessibility, KINDS } from './a11y.js';
import { selectLayers } from './audit-ui.js';
import { modal } from './libraries.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
let target = 44;

// The top-level layers of the selection, or every top-level layer on the page.
function roots() {
  const top = (n) => {
    let x = n;
    while (getParent(x.id)) x = getParent(x.id);
    return x;
  };
  const chosen = [...new Set(state.selection.map(getNode).filter(Boolean).map(top))];
  return chosen.length ? { list: chosen, scope: chosen.length === 1 ? `“${chosen[0].name}”` : `${chosen.length} frames` } : { list: page().children, scope: `the page “${page().name}”` };
}

// Copies of one component layer with the same issue show once, with how many there are.
function grouped(issues) {
  const out = new Map();
  for (const i of issues) {
    const g = out.get(i.group);
    if (g) g.ids.push(i.id);
    else out.set(i.group, { ...i, ids: [i.id] });
  }
  return [...out.values()];
}

function body(issues, scope) {
  const groups = grouped(issues);
  const errors = groups.filter((g) => g.severity === 'error').length;
  let html = `<div class="a11y-bar"><span class="muted">Checks ${esc(scope)}.</span><span class="spacer"></span><label class="muted">Tap targets <select class="prop-input a11y-target">` +
    [44, 48].map((t) => `<option value="${t}" ${t === target ? 'selected' : ''}>${t}×${t} (${t === 44 ? 'iOS' : 'Material'})</option>`).join('') + '</select></label></div>';
  if (!groups.length) return `${html}<div class="audit-done">No accessibility issues found. Sigma checks contrast, sizes, alt text, labels, headings and focus order; keyboard behavior and screen reader output still need a person.</div>`;
  html += `<p class="muted lib-intro">${plural(errors, 'error')} and ${plural(groups.length - errors, 'warning')}. Select the layers to fix them, or annotate them in Inspect → Accessibility.</p>`;
  for (const [kind, { label, reason }] of Object.entries(KINDS)) {
    const rows = groups.map((g, i) => ({ g, i })).filter(({ g }) => g.kind === kind);
    if (!rows.length) continue;
    html += `<div class="audit-section"><div class="audit-title">${label} <span class="muted">${rows.length}</span></div><div class="muted a11y-reason">${esc(reason)}</div>` +
      rows.map(({ g, i }) => `<div class="audit-row"><span class="a11y-sev ${g.severity}">${g.severity === 'error' ? 'Error' : 'Warning'}</span>` +
        `<span class="a11y-what"><b>${esc(g.name)}</b> <span class="muted">in ${esc(g.frame)}${g.ids.length > 1 ? ` · ×${g.ids.length}` : ''}</span><br>${esc(g.message)}</span>` +
        `<span class="audit-actions">${kind === 'alt' || kind === 'label' || kind === 'heading' || kind === 'focus' ? `<button class="btn" data-annotate="${i}">Annotate</button>` : ''}<button class="btn" data-select="${i}">Select</button></span></div>`).join('') +
      '</div>';
  }
  return html;
}

export function openAccessibilityCheck() {
  if (!state.doc || state.doc.kind === 'tokens') return;
  const { list, scope } = roots();
  let issues = checkAccessibility(list, { target });
  const wrap = modal('Check accessibility', body(issues, scope), '<button class="btn" data-refresh>Run again</button><span class="spacer"></span><button class="btn" data-close>Done</button>');
  wrap.querySelector('.modal').classList.add('audit-modal', 'a11y-modal');
  const refresh = () => {
    issues = checkAccessibility(list.filter((n) => getNode(n.id)), { target });
    wrap.querySelector('.lib-body').innerHTML = body(issues, scope);
  };
  wrap.addEventListener('change', (e) => {
    if (!e.target.classList.contains('a11y-target')) return;
    target = Number(e.target.value);
    refresh();
  });
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-refresh')) return refresh();
    const groups = grouped(issues);
    const g = groups[+(b.dataset.select ?? b.dataset.annotate)];
    if (!g) return;
    wrap.querySelector('[data-close]').click();
    selectLayers(b.dataset.annotate ? [g.ids[0]] : g.ids);
    if (b.dataset.annotate) document.querySelector('[data-right-tab="inspect"]')?.click();
  });
}
