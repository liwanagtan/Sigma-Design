// Running the design system (Part D, Phase 18): each component's status, its readiness checklist ("definition
// of ready") and its docs, and the component matrix that shows where every component of a library stands.
//
// Stored on the component (on the set, for variants):
//   status: 'draft' | 'review' | 'ready'          (Deprecated is the existing `deprecated` flag)
//   checks: { variants?, breakpoints?, accessibility?: true }   what a person confirmed by hand
//   docs:   { purpose, notFor, usage, dos: [frameId], donts: [frameId], code }
import { state, walk, getNode, getParent, editNode, commit, select, emit } from './store.js';
import { zoomToSelection } from './commands.js';
import { isDeprecated } from './components.js';
import { ROLES, checkAccessibility } from './a11y.js';
import { slots } from './use-report.js';
import { modal } from './libraries.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const STATUSES = { draft: 'Draft', review: 'In review', ready: 'Ready' };

// A variant's status and docs are its set's (also for a library's components, which aren't in this file's tree).
export const docsTarget = (node) => {
  if (!node) return node;
  const parent = getParent(node.id);
  if (parent?.type === 'componentSet') return parent;
  for (const lib of state.doc?.componentLibraries || []) {
    for (const c of lib.components || []) if (c.type === 'componentSet' && c.children?.some((v) => v.id === node.id)) return c;
  }
  return node;
};
export const statusOf = (node) => (isDeprecated(node) ? 'deprecated' : docsTarget(node)?.status || 'draft');
export const statusLabel = (s) => (s === 'deprecated' ? 'Deprecated' : STATUSES[s] || 'Draft');

// The share of a component's values that use tokens (its definition, nested instances left out).
function tokenShare(node) {
  let bound = 0, total = 0;
  walk([node], (n) => {
    if (n.type === 'instance' && n !== node) return false;
    if (n.type === 'componentSet') return; // the set's own background holds the variants; it isn't the component
    for (const s of slots(n)) {
      total++;
      if (s.bound) bound++;
    }
  });
  return total ? bound / total : 1;
}

// Its role and keyboard behavior are written down, and the accessibility check finds no errors in it.
function a11yReady(t, docs) {
  if (!docs.role || !docs.keyboard || !getNode(t.id)) return false;
  return !checkAccessibility([t]).some((i) => i.severity === 'error');
}

const DEFAULT_NAME = /^(component|frame|variant|property|group|rectangle)\s*\d*$/i;

/**
 * The readiness checklist: [{ key, label, ok, manual, hint }]. Sigma checks what it can; the rest a person
 * ticks (manual).
 */
export function readiness(node) {
  const t = docsTarget(node);
  const docs = t.docs || {};
  const checks = t.checks || {};
  const variants = t.type === 'componentSet' ? t.children.filter((v) => v.type === 'component').length : 0;
  const share = tokenShare(t);
  return [
    { key: 'named', label: 'Named', ok: !!t.name && !DEFAULT_NAME.test(t.name.trim()), hint: 'Give it the name people (and the code) use.' },
    { key: 'purpose', label: 'Purpose written', ok: !!(docs.purpose || t.description), hint: 'Say what it’s for (and what it isn’t) in its docs.' },
    { key: 'variants', label: 'Variants and states', ok: variants >= 2 || !!checks.variants, manual: variants < 2, hint: 'Add its variants and states, or confirm it has none.' },
    { key: 'tokens', label: 'Tokens applied', ok: share >= 0.9, hint: `${Math.round(share * 100)}% of its values use tokens (90% or more is ready).` },
    { key: 'breakpoints', label: 'Breakpoint behavior', ok: !!checks.breakpoints, manual: true, hint: 'Confirm how it behaves at each width (fill, hug, wrapping).' },
    { key: 'documented', label: 'Documented', ok: !!docs.usage && !!((docs.dos || []).length || (docs.donts || []).length), hint: 'Write usage guidance and link a Do or Don’t example.' },
    { key: 'accessibility', label: 'Accessibility checked', ok: !!checks.accessibility || a11yReady(t, docs), manual: true, hint: 'Write its role and keyboard behavior in its docs: then Sigma checks its contrast and labels. Or confirm it by hand.' },
    { key: 'code', label: 'Code linked', ok: !!(t.codeName || docs.code), hint: 'Give it its code name (Inspect) or link its code in its docs.' },
  ];
}

// Every component and component set of the open file (top level), as matrix rows.
export function componentRows(doc = state.doc) {
  const rows = [];
  for (const pg of doc?.pages || []) {
    walk(pg.children, (n) => {
      if (n.type === 'component' || n.type === 'componentSet') {
        rows.push({ node: n, page: pg });
        return false;
      }
      if (n.type === 'instance') return false;
    });
  }
  return rows;
}

const setStatus = (node, status) => {
  const t = docsTarget(node);
  editNode(t, ['status'], () => {
    if (status === 'draft') delete t.status;
    else t.status = status;
  });
  commit();
};
const toggleCheck = (node, key) => {
  const t = docsTarget(node);
  editNode(t, ['checks'], () => {
    const checks = { ...(t.checks || {}) };
    if (checks[key]) delete checks[key];
    else checks[key] = true;
    if (Object.keys(checks).length) t.checks = checks;
    else delete t.checks;
  });
  commit();
};

/** The component matrix: every component of the file, its status and its readiness. */
export function openComponentMatrix() {
  const wrap = modal('Component status', '<div class="matrix-summary muted"></div><div class="matrix-wrap"></div>', '<span class="spacer"></span><button class="btn" data-close>Close</button>');
  wrap.querySelector('.modal').classList.add('matrix-modal');
  const render = () => {
    const rows = componentRows();
    const labels = rows.length ? readiness(rows[0].node).map((c) => c.label) : [];
    const counts = {};
    let stuck = 0;
    for (const { node } of rows) {
      const s = statusOf(node);
      counts[s] = (counts[s] || 0) + 1;
      if (s === 'review' && readiness(node).some((c) => !c.ok)) stuck++;
    }
    wrap.querySelector('.matrix-summary').textContent = rows.length
      ? `${rows.length} component${rows.length === 1 ? '' : 's'}: ${['ready', 'review', 'draft', 'deprecated'].filter((s) => counts[s]).map((s) => `${counts[s]} ${statusLabel(s).toLowerCase()}`).join(', ')}${stuck ? `. ${stuck} in review ${stuck === 1 ? 'isn’t' : 'aren’t'} ready yet: see what’s missing.` : '.'}`
      : 'This file has no components yet.';
    wrap.querySelector('.matrix-wrap').innerHTML = rows.length ? `<table class="matrix"><tr><th>Component</th><th>Status</th>${labels.map((l) => `<th class="matrix-check" title="${esc(l)}">${esc(l)}</th>`).join('')}<th>Next</th></tr>` +
      rows.map(({ node }) => {
        const checks = readiness(node);
        const s = statusOf(node);
        const next = checks.find((c) => !c.ok);
        return `<tr data-row="${node.id}"><td><a href="#" data-go="${node.id}">${esc(node.name)}</a></td>
          <td>${s === 'deprecated' ? '<span class="deprecated-tag">Deprecated</span>' : `<select class="select" data-status="${node.id}">${Object.entries(STATUSES).map(([k, l]) => `<option value="${k}"${k === s ? ' selected' : ''}>${l}</option>`).join('')}</select>`}</td>
          ${checks.map((c) => `<td class="matrix-check ${c.ok ? 'ok' : 'no'}" title="${esc(c.label)}: ${esc(c.ok ? 'done' : c.hint)}">${c.manual ? `<button class="matrix-tick" data-tick="${node.id}" data-key="${c.key}">${c.ok ? '✓' : '○'}</button>` : c.ok ? '✓' : '✗'}</td>`).join('')}
          <td class="muted matrix-next">${next ? esc(next.hint) : s === 'ready' ? 'Ready.' : 'Everything’s done: mark it Ready.'}</td></tr>`;
      }).join('') + '</table>' : '';
  };
  wrap.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    setStatus(getNode(sel.dataset.status), sel.value);
    render();
  });
  wrap.addEventListener('click', (e) => {
    const tick = e.target.closest('[data-tick]');
    if (tick) {
      toggleCheck(getNode(tick.dataset.tick), tick.dataset.key);
      return render();
    }
    const go = e.target.closest('[data-go]');
    if (go) {
      e.preventDefault();
      wrap.remove();
      const pg = state.doc.pages.find((p) => { let hit = false; walk(p.children, (n) => void (n.id === go.dataset.go && (hit = true))); return hit; });
      if (pg && pg.id !== state.doc.currentPageId) {
        state.doc.currentPageId = pg.id;
        emit('doc');
      }
      select([go.dataset.go]);
      requestAnimationFrame(() => zoomToSelection());
    }
  });
  render();
}

// Frames that can be Do / Don't examples (not components): those on the file's pages, those in a frame named
// Examples (as on Optics' component pages), and any a component's docs already picked.
function exampleFrames() {
  const out = [];
  const picked = new Set();
  for (const pg of state.doc.pages) walk(pg.children, (n) => void (n.docs && [...(n.docs.dos || []), ...(n.docs.donts || [])].forEach((id) => picked.add(id))));
  const isFrame = (n) => (n.type === 'frame' || n.type === 'group') && n.visible !== false;
  for (const pg of state.doc.pages) {
    for (const n of pg.children) if (isFrame(n)) out.push({ id: n.id, label: `${n.name} (${pg.name})` });
    walk(pg.children, (n) => {
      if (pg.children.includes(n) || !isFrame(n)) return;
      if (picked.has(n.id) || getParent(n.id)?.name === 'Examples') out.push({ id: n.id, label: `${n.name} (${pg.name})` });
    });
  }
  return out;
}

/** Edit a component's docs: purpose, what it isn't for, usage, Do and Don't examples, code link. */
export function openDocsEditor(node) {
  const t = docsTarget(node);
  const d = t.docs || {};
  const frames = exampleFrames();
  const picker = (key, chosen) => (frames.length
    ? `<div class="docs-frames">${frames.map((f) => `<label class="propose-item"><input type="checkbox" data-${key}="${f.id}"${(chosen || []).includes(f.id) ? ' checked' : ''}>${esc(f.label)}</label>`).join('')}</div>`
    : '<p class="muted">Put example frames on a page of this file, then pick them here.</p>');
  const body = `
    <label class="inspector-label">Purpose</label><textarea class="desc" data-f="purpose" rows="2" placeholder="What it’s for, in a sentence">${esc(d.purpose || t.description || '')}</textarea>
    <label class="inspector-label">Not for</label><textarea class="desc" data-f="notFor" rows="2" placeholder="What to use instead, and when">${esc(d.notFor || '')}</textarea>
    <label class="inspector-label">Usage</label><textarea class="desc" data-f="usage" rows="4" placeholder="How to use it well: content, placement, combinations">${esc(d.usage || '')}</textarea>
    <label class="inspector-label">Do</label>${picker('do', d.dos)}
    <label class="inspector-label">Don’t</label>${picker('dont', d.donts)}
    <label class="inspector-label">Code</label><input class="prop-input" data-f="code" placeholder="src/components/Button.jsx, or a link" value="${esc(d.code || '')}" spellcheck="false">
    <label class="inspector-label">Accessibility: role</label><select class="prop-input" data-f="role"><option value="">Not set</option>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${d.role === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <label class="inspector-label">Accessibility: keyboard and screen readers</label><textarea class="desc" data-f="keyboard" rows="3" placeholder="Tab focuses it; Enter and Space activate it. Announced as its label and role.">${esc(d.keyboard || '')}</textarea>`;
  const wrap = modal(`Docs: ${esc(t.name)}`, body, '<span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button>');
  wrap.querySelector('.modal').classList.add('docs-modal');
  wrap.querySelector('[data-save]').addEventListener('click', () => {
    const val = (k) => wrap.querySelector(`[data-f="${k}"]`).value.trim();
    const docs = {
      purpose: val('purpose'), notFor: val('notFor'), usage: val('usage'), code: val('code'), role: val('role'), keyboard: val('keyboard'),
      dos: [...wrap.querySelectorAll('[data-do]:checked')].map((i) => i.dataset.do),
      donts: [...wrap.querySelectorAll('[data-dont]:checked')].map((i) => i.dataset.dont),
    };
    for (const k of Object.keys(docs)) if (!docs[k] || (Array.isArray(docs[k]) && !docs[k].length)) delete docs[k];
    editNode(t, ['docs'], () => {
      if (Object.keys(docs).length) t.docs = docs;
      else delete t.docs;
    });
    commit();
    wrap.remove();
  });
}

/** A component's docs as HTML, for Inspect and Assets (empty when it has none). */
export function docsHTML(node, { compact = false, status = true } = {}) {
  const t = docsTarget(node);
  const d = t?.docs || {};
  const purpose = d.purpose || t?.description;
  if (!purpose && !d.usage && !d.notFor && !d.code && !d.role && !d.keyboard) return '';
  const name = (id) => getNode(id)?.name;
  const examples = (ids, label) => ((ids || []).map(name).filter(Boolean).length ? `<div><b>${label}:</b> ${(ids || []).map(name).filter(Boolean).map(esc).join(', ')}</div>` : '');
  return `<div class="comp-docs">${purpose ? `<div>${esc(purpose)}</div>` : ''}` +
    (compact ? '' : `${d.notFor ? `<div><b>Not for:</b> ${esc(d.notFor)}</div>` : ''}${d.usage ? `<div class="comp-docs-usage">${esc(d.usage)}</div>` : ''}${examples(d.dos, 'Do')}${examples(d.donts, 'Don’t')}` +
      `${d.role || d.keyboard ? `<div><b>Accessibility:</b> ${d.role ? `${esc(ROLES[d.role] || d.role)} role. ` : ''}${esc(d.keyboard || '')}</div>` : ''}`) +
    `${d.code ? `<div class="muted">Code: ${/^https?:/.test(d.code) ? `<a href="${esc(d.code)}" target="_blank" rel="noopener">${esc(d.code)}</a>` : `<code>${esc(d.code)}</code>`}</div>` : ''}` +
    `${status ? `<div class="muted">${statusLabel(statusOf(t))}</div>` : ''}</div>`;
}
