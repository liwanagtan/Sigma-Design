// Design system use report (Part D, Phase 17): like Pinterest's FigStats, measured across design files. Pure:
// it takes documents (as Sigma opens them, or as fromProjectFile reads project files) and returns numbers, so
// the files home and the command line (sigma-design report) show the same report.
//
//   - how much of each file comes from library components: instances, against all layers outside component
//     definitions (an instance counts once: its layers are the component's)
//   - how much uses tokens: colors, type, spacing, radius and shadows that are bound to a token, against all
//     that could be, in components and on pages (layers inside instances are left out: their values are the
//     component's)
//   - the most-used components and tokens, and those nobody uses (a token another token points at is used)
//
// Options: `since` (a time: only files edited after it) and `handoff` (only pages marked for handoff).

const KINDS = ['color', 'type', 'spacing', 'radius', 'shadow'];
export const REPORT_KINDS = { color: 'Colors', type: 'Type', spacing: 'Spacing', radius: 'Corner radius', shadow: 'Shadows' };
const SPACING = ['gap', 'pt', 'pr', 'pb', 'pl'];
const TYPE_BINDINGS = ['typography', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight'];

// Every value a layer has that could come from a token: [{ kind, bound: tokenId | null }].
export function slots(n) {
  const b = n.bindings || {};
  const ref = (path) => b[path] || (n.propRefs?.[path] ? 'property' : null);
  const out = [];
  (n.fills || []).forEach((p, i) => p.visible !== false && out.push({ kind: 'color', bound: ref(`fills.${i}.color`) }));
  if ((n.strokeWidth ?? 1) > 0) (n.strokes || []).forEach((p, i) => p.visible !== false && out.push({ kind: 'color', bound: ref(`strokes.${i}.color`) }));
  (n.effects || []).forEach((e, i) => e.visible !== false && e.type !== 'layer-blur' && out.push({ kind: 'shadow', bound: ref(`effects.${i}`) }));
  if (n.type === 'text') out.push({ kind: 'type', bound: TYPE_BINDINGS.map((k) => b[k]).find(Boolean) || null });
  if (n.layout?.mode) {
    const flow = (n.children || []).filter((c) => c.visible !== false && !c.absolute).length;
    for (const k of SPACING) {
      if (k === 'gap' && (n.layout.spacing === 'auto' || flow < 2)) continue;
      // A value bound to a token counts even without its number (project files leave bound values out).
      if (b[`layout.${k}`] || (n.layout[k] ?? (k === 'gap' ? 10 : 0)) > 0) out.push({ kind: 'spacing', bound: ref(`layout.${k}`) });
    }
  }
  if (b.radius || (n.radius || 0) > 0) out.push({ kind: 'radius', bound: ref('radius') });
  return out;
}

const emptyKinds = () => Object.fromEntries(KINDS.map((k) => [k, { bound: 0, total: 0 }]));
const share = (a, b) => (b ? a / b : null);

/**
 * files: [{ name, path?, doc, editedAt? }] (design files; their docs carry their linked token files and
 * component libraries). Returns { files: [per file], overall, components: [{ id, name, library, uses }],
 * unusedComponents, tokens: [{ id, name, file, uses }], unusedTokens }.
 */
export function useReport(files, { since = null, handoff = false } = {}) {
  const chosen = files.filter((f) => !since || !f.editedAt || f.editedAt >= since);
  // Components and tokens the files can use, by id.
  const components = new Map(); // variant or component id → { id (the set's, else its own), name, library }
  const tokens = new Map(); // token id → { id, name, file }
  const aliased = new Set();
  const addComponents = (list, library) => {
    for (const c of list || []) {
      const entry = { id: c.id, name: c.name, library };
      components.set(c.id, entry);
      if (c.type === 'componentSet') for (const v of c.children || []) components.set(v.id, entry);
    }
  };
  const addTokens = (collections, file) => {
    for (const col of collections || []) {
      for (const v of col.variables || []) {
        if (!tokens.has(v.id)) tokens.set(v.id, { id: v.id, name: v.name, file });
        for (const x of Object.values(v.valuesByMode || {})) {
          if (x && typeof x === 'object') {
            if (typeof x.alias === 'string') aliased.add(x.alias);
            else for (const f of Object.values(x)) if (f && typeof f.alias === 'string') aliased.add(f.alias);
          }
        }
      }
    }
  };
  for (const f of files) {
    for (const lib of f.doc.componentLibraries || []) addComponents(lib.components, lib.name);
    for (const lib of f.doc.libraries || []) {
      addTokens(lib.collections, lib.name);
      for (const dep of lib.dependencies || []) addTokens(dep.collections, dep.name);
    }
    addTokens((f.doc.variables?.collections || []).filter((c) => !c.fromLibrary), f.name);
    const local = [];
    for (const pg of f.doc.pages || []) {
      const visit = (nodes) => nodes.forEach((n) => {
        if (n.type === 'component' || n.type === 'componentSet') local.push(n);
        else if (n.children && n.type !== 'instance') visit(n.children);
      });
      visit(pg.children || []);
    }
    addComponents(local, f.name);
  }

  const componentUses = new Map();
  const tokenUses = new Map();
  const perFile = [];
  const overall = { layers: 0, instances: 0, kinds: emptyKinds() };
  for (const f of chosen) {
    const r = { name: f.name, path: f.path || null, editedAt: f.editedAt || null, layers: 0, instances: 0, kinds: emptyKinds() };
    const pages = (f.doc.pages || []).filter((pg) => !handoff || pg.handoff);
    for (const pg of pages) {
      const visit = (nodes, inDefinition) => {
        for (const n of nodes) {
          if (n.visible === false) continue;
          const definition = inDefinition || n.type === 'component' || n.type === 'componentSet';
          if (n.type === 'instance') {
            const c = components.get(n.componentId);
            const key = c?.id || n.componentId;
            componentUses.set(key, (componentUses.get(key) || 0) + 1);
            if (!definition) {
              r.layers++;
              r.instances++;
            }
            continue; // its layers are its component's
          }
          if (!definition && n.type !== 'group') r.layers++;
          // Component definitions count too: a library's components using tokens is what its team checks.
          for (const s of slots(n)) {
            r.kinds[s.kind].total++;
            if (s.bound) r.kinds[s.kind].bound++;
          }
          for (const id of Object.values(n.bindings || {})) tokenUses.set(id, (tokenUses.get(id) || 0) + 1);
          if (n.children) visit(n.children, definition);
        }
      };
      visit(pg.children || [], false);
    }
    r.componentShare = share(r.instances, r.layers);
    const k = Object.values(r.kinds);
    r.tokenShare = share(k.reduce((s, x) => s + x.bound, 0), k.reduce((s, x) => s + x.total, 0));
    perFile.push(r);
    overall.layers += r.layers;
    overall.instances += r.instances;
    for (const kind of KINDS) {
      overall.kinds[kind].bound += r.kinds[kind].bound;
      overall.kinds[kind].total += r.kinds[kind].total;
    }
  }
  overall.componentShare = share(overall.instances, overall.layers);
  const ok = Object.values(overall.kinds);
  overall.tokenShare = share(ok.reduce((s, x) => s + x.bound, 0), ok.reduce((s, x) => s + x.total, 0));

  const uniqueComponents = [...new Map([...components.values()].map((c) => [c.id, c])).values()];
  const componentList = uniqueComponents.map((c) => ({ ...c, uses: componentUses.get(c.id) || 0 })).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
  const tokenList = [...tokens.values()].map((t) => ({ ...t, uses: tokenUses.get(t.id) || 0, referenced: aliased.has(t.id) })).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
  return {
    files: perFile,
    overall,
    components: componentList.filter((c) => c.uses),
    unusedComponents: componentList.filter((c) => !c.uses),
    tokens: tokenList.filter((t) => t.uses),
    unusedTokens: tokenList.filter((t) => !t.uses && !t.referenced),
  };
}

const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);
export const formatShare = pct;

// The report as text (the command line).
export function formatUseReport(r) {
  const lines = [];
  lines.push(`Library components: ${pct(r.overall.componentShare)} of layers (${r.overall.instances} instances of ${r.overall.layers} layers)`);
  lines.push(`Tokens: ${pct(r.overall.tokenShare)} of values, by kind: ${Object.entries(r.overall.kinds).filter(([, x]) => x.total).map(([k, x]) => `${REPORT_KINDS[k].toLowerCase()} ${pct(share(x.bound, x.total))} (${x.bound}/${x.total})`).join(', ')}`);
  lines.push('', 'Files:');
  for (const f of r.files) lines.push(`  ${f.name}${f.path ? ` (${f.path})` : ''}: components ${pct(f.componentShare)}, tokens ${pct(f.tokenShare)}, ${f.layers} layers`);
  if (r.components.length) lines.push('', 'Most-used components:', ...r.components.slice(0, 10).map((c) => `  ${c.name}: ${c.uses}`));
  if (r.unusedComponents.length) lines.push('', `Components nobody uses (${r.unusedComponents.length}):`, ...r.unusedComponents.map((c) => `  ${c.name} (${c.library})`));
  if (r.tokens.length) lines.push('', 'Most-used tokens:', ...r.tokens.slice(0, 10).map((t) => `  ${t.name}: ${t.uses}`));
  if (r.unusedTokens.length) lines.push('', `Tokens nobody uses (${r.unusedTokens.length}):`, ...r.unusedTokens.slice(0, 30).map((t) => `  ${t.name} (${t.file})`), ...(r.unusedTokens.length > 30 ? [`  …and ${r.unusedTokens.length - 30} more`] : []));
  return lines.join('\n');
}
