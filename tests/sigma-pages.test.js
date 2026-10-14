import { test, eq, ok } from './harness.js';
import { sigmaPagesDocument } from '../src/sigma-pages.js';
import { sigmaTokenDocument } from '../src/sigma-design-system.js';
import { loadDocument, state, walk } from '../src/store.js';
import { toProjectFile, fromProjectFile } from '../src/project-format.js';

test('Pages and UI: four full screens render as visible, editable layers with self-contained artwork', () => {
  const tokens = sigmaTokenDocument();
  const doc = sigmaPagesDocument(tokens.collections);
  doc.variables = { collections:tokens.collections };
  loadDocument(doc);
  eq(state.doc.name, 'Pages and UI');
  eq(state.doc.pages.map(p=>p.name), ['Files home','Design editor','Tokens','Icons']);
  const ids = new Set(), tokenIds = new Set(tokens.collections.flatMap(c=>c.variables.map(v=>v.id)));
  let texts=0, images=0, frames=0;
  for (const page of state.doc.pages) {
    const root = page.children[0];
    eq([root.type,root.w,root.h,root.clip,root.visible], ['frame',1280,900,true,true]);
    walk(page.children, n=> {
      ok(!ids.has(n.id), `unique layer: ${n.name}`); ids.add(n.id);
      ok(n.visible !== false && n.opacity !== undefined, `visible layer: ${n.name}`);
      ok([n.x,n.y,n.w,n.h,n.rotation].every(Number.isFinite), `valid geometry: ${n.name}`);
      for (const id of Object.values(n.bindings || {})) ok(tokenIds.has(id), 'binding exists');
      if (n.type === 'text') { texts++; ok(n.text && n.fontSize>0, 'readable text'); }
      if (n.type === 'image') { images++; ok(n.src.startsWith('data:'), 'artwork bundled'); }
      if (n.type === 'frame') frames++;
    });
  }
  ok(texts>100 && images>20 && frames>100, 'interface is made of design layers');
  const reopened = fromProjectFile(toProjectFile(state.doc).file).doc;
  eq(reopened.pages.map(p=>[p.name,p.children[0].w,p.children[0].h]), state.doc.pages.map(p=>[p.name,p.children[0].w,p.children[0].h]), 'project file round-trip');
});
