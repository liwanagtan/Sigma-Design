// A design system's documentation page (Part D, Phase 18): one self-contained HTML file generated from the open
// library: its components (previews of every variant, status, docs with Do and Don't examples, properties and
// code names) and the tokens it uses (per mode, with their code names). Main menu → Export documentation page….
// Sharing it beyond this machine is up to the team (a repo, a static host); a hosted docs site needs a backend.
import { state, getNode } from './store.js';
import { buildSVG } from './io.js';
import { resolveValue, collections } from './variables.js';
import { tokenCode, componentCode, propCode, variantPropCode, variantValueCode } from './code-names.js';
import { variantDefs } from './components.js';
import { ROLES } from './a11y.js';
import { componentRows, statusOf, statusLabel, docsTarget } from './component-docs.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function preview(node) {
  try {
    return buildSVG([node]).svg;
  } catch {
    return '';
  }
}

function valueHTML(type, v) {
  if (v === undefined || v === null) return '<span class="muted">—</span>';
  if (type === 'color') return `<span class="swatch" style="background:${esc(String(v).slice(0, 7))};opacity:${String(v).length > 7 ? (parseInt(String(v).slice(7, 9), 16) / 255).toFixed(2) : 1}"></span><code>${esc(v)}</code>`;
  if (Array.isArray(v)) return `<code>${esc(v.length === 4 ? `cubic-bezier(${v.join(', ')})` : v.join(', '))}</code>`;
  if (typeof v === 'object') return `<code>${esc(Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : x}`).join(', '))}</code>`;
  return `<code>${esc(type === 'number' ? `${v}` : v)}</code>`;
}

function tokensHTML() {
  // Linked token files and this file's own collections (extensions show through their base).
  return collections().filter((c) => !c.extends).map((col) => {
    const modes = col.modes || [];
    const rows = (col.variables || []).filter((v) => !v.deprecated).map((v) => `<tr><td><b>${esc(v.name)}</b></td><td><code>${esc(tokenCode(v))}</code></td>` +
      modes.map((m) => `<td>${valueHTML(v.type, resolveValue(v.id, (root) => ({ collection: root, modeId: root.id === col.id ? m.id : root.defaultModeId })))}</td>`).join('') + '</tr>').join('');
    return `<section><h3>${esc(col.name)}</h3><table><tr><th>Token</th><th>CSS</th>${modes.map((m) => `<th>${esc(m.name)}</th>`).join('')}</tr>${rows}</table></section>`;
  }).join('');
}

function componentHTML(node) {
  const t = docsTarget(node);
  const d = t.docs || {};
  const variants = t.type === 'componentSet' ? t.children.filter((v) => v.type === 'component') : [t];
  const props = Object.entries(t.props || {});
  const axes = t.type === 'componentSet' ? Object.entries(variantDefs(t)) : [];
  const examples = (ids, label, cls) => (ids || []).map(getNode).filter(Boolean).map((f) => `<figure class="${cls}"><div class="example">${preview(f)}</div><figcaption><b>${label}</b> ${esc(f.name)}</figcaption></figure>`).join('');
  return `<section class="component" id="${slug(t.name)}">
    <h2>${esc(t.name)} <span class="status ${statusOf(t)}">${statusLabel(statusOf(t))}</span></h2>
    ${d.purpose || t.description ? `<p class="purpose">${esc(d.purpose || t.description)}</p>` : ''}
    ${d.notFor ? `<p><b>Not for:</b> ${esc(d.notFor)}</p>` : ''}
    <div class="variants">${variants.map((v) => `<figure><div class="preview">${preview(v)}</div><figcaption>${esc(t.type === 'componentSet' ? v.name : 'Default')}</figcaption></figure>`).join('')}</div>
    ${d.usage ? `<h4>Usage</h4><p class="usage">${esc(d.usage)}</p>` : ''}
    ${(d.dos || []).length || (d.donts || []).length ? `<div class="examples">${examples(d.dos, 'Do', 'do')}${examples(d.donts, 'Don’t', 'dont')}</div>` : ''}
    ${d.role || d.keyboard ? `<h4>Accessibility</h4><p class="usage">${d.role ? `<b>Role:</b> ${esc(ROLES[d.role] || d.role)}. ` : ''}${esc(d.keyboard || '')}</p>` : ''}
    <h4>Code</h4><p><code>${esc(componentCode(t))}</code>${d.code ? ` · ${/^https?:/.test(d.code) ? `<a href="${esc(d.code)}">${esc(d.code)}</a>` : `<code>${esc(d.code)}</code>`}` : ''}</p>
    ${axes.length || props.length ? `<table><tr><th>Property</th><th>Code</th><th>Type</th><th>Values or default</th></tr>${
      axes.map(([k, vals]) => `<tr><td>${esc(k)}</td><td><code>${esc(variantPropCode(t, k))}</code></td><td>variant</td><td>${vals.map((x) => `<code>${esc(variantValueCode(x))}</code>`).join(' ')}</td></tr>`).join('')}${
      props.map(([, p]) => `<tr><td>${esc(p.name)}</td><td><code>${esc(propCode(p))}</code></td><td>${esc(p.type)}</td><td>${esc(typeof p.default === 'object' ? JSON.stringify(p.default) : String(p.default ?? ''))}</td></tr>`).join('')}</table>` : ''}
  </section>`;
}

/** The documentation page for the open file, as HTML. */
export function documentationPage() {
  const rows = componentRows();
  const order = { ready: 0, review: 1, draft: 2, deprecated: 3 };
  rows.sort((a, b) => order[statusOf(a.node)] - order[statusOf(b.node)] || a.node.name.localeCompare(b.node.name));
  const name = state.doc.name || 'Design system';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font: 14px/1.5 Inter, system-ui, sans-serif; color: #1e1e1e; margin: 0; display: grid; grid-template-columns: 220px 1fr; }
  nav { position: sticky; top: 0; height: 100vh; overflow: auto; padding: 24px 16px; border-right: 1px solid #e5e5e5; box-sizing: border-box; }
  nav a { display: block; color: inherit; text-decoration: none; padding: 2px 0; }
  main { padding: 32px 40px; max-width: 980px; }
  h1 { margin: 0 0 4px; } h2 { margin: 40px 0 8px; } h3 { margin: 24px 0 8px; } h4 { margin: 16px 0 4px; }
  .muted { color: #757575; } code { font: 12px ui-monospace, monospace; background: #f5f5f5; padding: 1px 4px; border-radius: 4px; }
  .status { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 10px; background: #eee; vertical-align: middle; }
  .status.ready { background: #e7f7ee; color: #0f7a40; } .status.review { background: #fff4e5; color: #b54708; } .status.deprecated { background: #fdecec; color: #b42318; }
  .variants, .examples { display: flex; flex-wrap: wrap; gap: 16px; }
  figure { margin: 0; } figcaption { font-size: 12px; color: #757575; margin-top: 4px; }
  .preview, .example { background: #f5f5f5; border-radius: 8px; padding: 16px; display: grid; place-items: center; }
  .preview svg, .example svg { max-width: 100%; height: auto; }
  .do .example { box-shadow: inset 0 -3px #0f7a40; } .dont .example { box-shadow: inset 0 -3px #b42318; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: middle; } th { font-weight: 500; color: #757575; font-size: 12px; }
  .swatch { display: inline-block; width: 16px; height: 16px; border-radius: 4px; border: 1px solid rgba(0,0,0,.1); vertical-align: middle; margin-right: 6px; }
  .usage { white-space: pre-wrap; }
  @media (max-width: 720px) { body { display: block; } nav { position: static; height: auto; border: 0; border-bottom: 1px solid #e5e5e5; } main { padding: 24px 16px; } table { display: block; overflow-x: auto; } }
</style></head>
<body>
<nav><b>${esc(name)}</b><p class="muted">Components</p>${rows.map(({ node }) => `<a href="#${slug(docsTarget(node).name)}">${esc(docsTarget(node).name)}</a>`).join('')}<p class="muted"><a href="#tokens">Tokens</a></p></nav>
<main>
  <h1>${esc(name)}</h1>
  <p class="muted">${rows.length} component${rows.length === 1 ? '' : 's'} · generated by Sigma on ${new Date().toISOString().slice(0, 10)}</p>
  ${rows.map(({ node }) => componentHTML(node)).join('')}
  <h2 id="tokens">Tokens</h2>
  ${tokensHTML()}
</main>
</body></html>
`;
}

/** Download the documentation page of the open file. */
export function exportDocumentationPage() {
  const html = documentationPage();
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([html], { type: 'text/html' })),
    download: `${(state.doc.name || 'design-system').replace(/[^\w-]+/g, '-').toLowerCase()}-docs.html`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
