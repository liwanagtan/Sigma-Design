import { test, eq, near, ok } from './harness.js';
import { mul, inv, rotate, translate, apply } from '../src/geom.js';
import {
  state, loadDocument, createNode, getNode, worldMatrix, setWorldMatrix, migrateDocument, DOC_VERSION,
  editNode, addEditHook, isFrameLike, normalizeDocument,
} from '../src/store.js';
import { applyLayouts, DEFAULT_LAYOUT } from '../src/layout.js';

// Load a one-page document whose page holds `nodes`.
export function useDoc(nodes) {
  loadDocument({ name: 'Test', pages: [{ id: 'p1', name: 'Page 1', background: '#F5F5F5', children: nodes }], currentPageId: 'p1' });
  return state.doc;
}

test('geom: a matrix times its inverse is the identity', () => {
  const m = mul(translate(10, -4), rotate(33));
  const r = mul(m, inv(m));
  [1, 0, 0, 1, 0, 0].forEach((v, i) => near(r[i], v, 1e-9));
});

test('store: setWorldMatrix keeps a node in place when nested in a rotated parent', () => {
  const child = createNode('rect', { x: 20, y: 30, w: 40, h: 10 });
  const parent = createNode('frame', { x: 100, y: 50, w: 200, h: 200, rotation: 30, children: [child] });
  useDoc([parent]);
  const before = apply(worldMatrix(child), { x: 0, y: 0 });
  const M = worldMatrix(child);
  setWorldMatrix(child, M);
  const after = apply(worldMatrix(child), { x: 0, y: 0 });
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
});

test('store: isFrameLike covers frames, components, sets and instances', () => {
  for (const type of ['frame', 'component', 'componentSet', 'instance']) ok(isFrameLike({ type }), type);
  for (const type of ['rect', 'group', 'text']) ok(!isFrameLike({ type }), type);
});

test('migrate: legacy single fill/stroke become paint lists and the doc is versioned', () => {
  const doc = { name: 'Old', pages: [{ id: 'p', children: [{ id: 'a', type: 'rect', fill: '#FF0000', fillOpacity: 0.5, stroke: '#000000', x: 0, y: 0, w: 1, h: 1 }] }] };
  migrateDocument(doc);
  const n = doc.pages[0].children[0];
  eq(n.fills, [{ color: '#FF0000', opacity: 0.5, visible: true }]);
  eq(n.strokes.length, 1);
  ok(!('fill' in n) && !('stroke' in n), 'legacy keys removed');
  eq(doc.version, DOC_VERSION);
  eq(doc.variables, { collections: [] });
});

test('editNode: hooks see the keys, and a before-hook can block an edit', () => {
  const n = createNode('rect');
  useDoc([n]);
  const seen = [];
  let block = false;
  addEditHook({
    before: (node, keys) => (block && keys.includes('opacity') ? false : undefined),
    after: (node, keys) => seen.push(keys.join(',')),
  });
  editNode(n, ['opacity'], () => void (n.opacity = 0.5));
  block = true;
  const applied = editNode(n, ['opacity'], () => void (n.opacity = 0.1));
  eq(n.opacity, 0.5);
  eq(applied, false);
  eq(seen, ['opacity']);
  block = false;
});

test('layout: a hug row sizes to its children plus gap and padding', () => {
  const a = createNode('rect', { w: 50, h: 20 });
  const b = createNode('rect', { w: 30, h: 40 });
  const row = createNode('frame', {
    layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 10, pt: 5, pr: 5, pb: 5, pl: 5 },
    sizingH: 'hug', sizingV: 'hug', children: [a, b],
  });
  useDoc([row]);
  applyLayouts();
  eq([row.w, row.h], [50 + 10 + 30 + 10, 40 + 10]);
  eq([a.x, b.x], [5, 65]);
});

test('layout: fill children share the leftover width', () => {
  const a = createNode('rect', { w: 10, h: 10, sizingH: 'fill' });
  const b = createNode('rect', { w: 10, h: 10, sizingH: 'fill' });
  const fixed = createNode('rect', { w: 100, h: 10 });
  const row = createNode('frame', { w: 400, h: 50, layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 0 }, children: [a, fixed, b] });
  useDoc([row]);
  applyLayouts();
  eq([a.w, b.w], [150, 150]);
});

test('pipeline: normalizeDocument is a no-op without a document', () => {
  state.doc = null;
  normalizeDocument();
  ok(true);
});
