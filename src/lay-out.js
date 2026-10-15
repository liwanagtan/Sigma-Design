// Lay a document out as the editor does when it opens a file: tokens resolved, instances built, text measured
// once its fonts come from tokens (a saved file leaves bound values out), auto layout applied until geometry settles, since
// instances size from their laid-out main components. Cycles are reported explicitly. It calls each step itself, so pages without the
// editor's normalizers (tools/capture/compare.html) lay out the same way. Use it inside store.withDocument.
import { state, walk, fixGroups } from './store.js';
import { syncInstances } from './components.js';
import { resolveVariables, normalizeTokenGroups } from './variables.js';
import { applyLayouts, layoutGeometry } from './layout.js';
import { measureText } from './text.js';

export function layOutDocument() {
  const seen=new Set();
  for (let i = 0; i < 64; i++) {
    const before=layoutGeometry();
    normalizeTokenGroups();
    syncInstances();
    resolveVariables();
    for (const pg of state.doc.pages) walk(pg.children, (n) => void (n.type === 'text' && measureText(n)));
    fixGroups();
    applyLayouts();
    fixGroups();
    const after=layoutGeometry();
    if(after===before)return;
    if(seen.has(after)){state.layoutWarnings=['Component layout could not settle. Review cyclic sizing.'];return;}
    seen.add(after);
  }
  state.layoutWarnings=['Component layout exceeded its dependency budget.'];
}
