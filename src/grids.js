// Layout grids on frames, like Figma's: a square grid, columns or rows.
//
// frame.layoutGrids = [{ type: 'grid' | 'columns' | 'rows', size, count, gutter, margin, align, color, opacity, visible }]
//   grid:          lines every `size` px
//   columns, rows: `count` bands with `gutter` between them. align 'stretch' fills the frame minus `margin` on
//                  each side; 'min' / 'center' / 'max' places bands `size` px wide at the start (after `margin`,
//                  the offset), centered, or at the end (before `margin`).
// Grids are canvas guides only: they're drawn over the frame, layers snap to them, and they never export.
import { state, walk, page, worldMatrix, isFrameLike } from './store.js';
import { apply } from './geom.js';

export const GRID_TYPES = { grid: 'Grid', columns: 'Columns', rows: 'Rows' };

export function newGrid(type = 'columns') {
  if (type === 'grid') return { type, size: 10, color: '#FF0000', opacity: 0.1, visible: true };
  return { type, count: type === 'columns' ? 12 : 6, align: 'stretch', size: 64, gutter: 16, margin: 16, color: '#FF0000', opacity: 0.1, visible: true };
}

// Switching type keeps what still applies and fills in the rest.
export function retypeGrid(g, type) {
  const base = newGrid(type);
  for (const k of Object.keys(base)) if (k !== 'type' && g[k] !== undefined) base[k] = g[k];
  if (type === 'grid' && g.type !== 'grid') base.size = 10;
  if (type !== 'grid' && g.type === 'grid') base.size = 64;
  return base;
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// The bands of a columns / rows grid along an axis of length `len`: [{ start, size }].
export function gridBands(g, len) {
  const count = Math.max(1, Math.min(1000, Math.round(num(g.count, 1))));
  const gutter = Math.max(0, num(g.gutter));
  const margin = num(g.margin);
  let size, start;
  if ((g.align || 'stretch') === 'stretch') {
    size = (len - 2 * margin - gutter * (count - 1)) / count;
    start = margin;
  } else {
    size = Math.max(0, num(g.size, 64));
    const total = count * size + gutter * (count - 1);
    start = g.align === 'center' ? (len - total) / 2 : g.align === 'max' ? len - margin - total : margin;
  }
  if (!(size > 0)) return [];
  return Array.from({ length: count }, (_, i) => ({ start: start + i * (size + gutter), size }));
}

// Grid lines of a square grid along an axis: positions, at most `max` of them.
export function gridLines(g, len, max = 2000) {
  const size = num(g.size, 10);
  if (!(size >= 1)) return [];
  const out = [];
  for (let p = size; p < len && out.length < max; p += size) out.push(p);
  return out;
}

const visibleGrids = (n) => (n.layoutGrids || []).filter((g) => g.visible !== false);

// Is a frame's world matrix axis-aligned (no rotation)? Snapping only uses those.
const axisAligned = (M) => Math.abs(M[1]) < 1e-6 && Math.abs(M[2]) < 1e-6 && M[0] > 0 && M[3] > 0;

// World-space x and y values layers snap to: band edges of columns and rows, and square-grid lines.
// Returns { xs: [{ v, b }], ys: [{ v, b }] } like the other snap targets (b: the frame's world box).
export function gridSnapTargets(exclude = new Set()) {
  const xs = [], ys = [];
  if (!state.showGrids) return { xs, ys };
  walk(page().children, (n) => {
    if (!n.visible || exclude.has(n.id)) return false;
    if (!isFrameLike(n) || !n.layoutGrids?.length) return;
    const M = worldMatrix(n);
    if (!axisAligned(M)) return;
    const o = apply(M, { x: 0, y: 0 });
    const b = { x: o.x, y: o.y, w: n.w, h: n.h };
    for (const g of visibleGrids(n)) {
      if (g.type === 'grid') {
        for (const p of gridLines(g, n.w, 400)) xs.push({ v: o.x + p, b });
        for (const p of gridLines(g, n.h, 400)) ys.push({ v: o.y + p, b });
        continue;
      }
      const horizontal = g.type === 'columns';
      for (const band of gridBands(g, horizontal ? n.w : n.h)) {
        const list = horizontal ? xs : ys, base = horizontal ? o.x : o.y;
        list.push({ v: base + band.start, b }, { v: base + band.start + band.size, b });
      }
    }
  });
  return { xs, ys };
}

// Overlay markup for every visible layout grid on the page. `toScreen` maps world points to the screen;
// `M` is the screen matrix for world space.
export function gridsOverlay(viewMatrix, mul, css) {
  if (!state.showGrids) return '';
  let out = '';
  walk(page().children, (n) => {
    if (!n.visible) return false;
    if (!isFrameLike(n) || !n.layoutGrids?.length) return;
    const grids = visibleGrids(n);
    if (!grids.length) return;
    const M = mul(viewMatrix, worldMatrix(n));
    const zoom = Math.hypot(M[0], M[1]);
    let body = '';
    for (const g of grids) {
      const color = g.color || '#FF0000';
      const op = num(g.opacity, 0.1);
      if (g.type === 'grid') {
        if (num(g.size, 10) * zoom < 4) continue; // too dense to see at this zoom, like Figma
        const lines = [
          ...gridLines(g, n.w).map((x) => `M${x} 0V${n.h}`),
          ...gridLines(g, n.h).map((y) => `M0 ${y}H${n.w}`),
        ];
        body += `<path d="${lines.join('')}" stroke="${color}" stroke-opacity="${Math.min(1, op * 2.5)}" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;
        continue;
      }
      const horizontal = g.type === 'columns';
      for (const band of gridBands(g, horizontal ? n.w : n.h)) {
        body += horizontal
          ? `<rect x="${band.start}" y="0" width="${band.size}" height="${n.h}" fill="${color}" fill-opacity="${op}"/>`
          : `<rect x="0" y="${band.start}" width="${n.w}" height="${band.size}" fill="${color}" fill-opacity="${op}"/>`;
      }
    }
    if (body) out += `<g class="layout-grid" transform="${css(M)}"><clipPath id="grid-clip-${n.id}"><rect width="${n.w}" height="${n.h}"/></clipPath><g clip-path="url(#grid-clip-${n.id})">${body}</g></g>`;
  });
  return out;
}
