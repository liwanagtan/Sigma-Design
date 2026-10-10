// 2D affine matrices as [a, b, c, d, e, f]  →  | a c e |
//                                              | b d f |
export const IDENTITY = [1, 0, 0, 1, 0, 0];

export function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function inv(m) {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c || 1e-12;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function apply(m, p) {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export const translate = (x, y) => [1, 0, 0, 1, x, y];

export function rotate(deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

// Rotation about a point.
export function rotateAbout(deg, cx, cy) {
  return mul(translate(cx, cy), mul(rotate(deg), translate(-cx, -cy)));
}

export function angleOf(m) {
  return (Math.atan2(m[1], m[0]) * 180) / Math.PI;
}

export function normAngle(deg) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.abs(a) < 1e-9 ? 0 : a;
}

export function cornersOf(m, w, h) {
  return [
    apply(m, { x: 0, y: 0 }),
    apply(m, { x: w, y: 0 }),
    apply(m, { x: w, y: h }),
    apply(m, { x: 0, y: h }),
  ];
}

export function aabb(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function unionBoxes(boxes) {
  if (!boxes.length) return null;
  const pts = [];
  for (const b of boxes) pts.push({ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h });
  return aabb(pts);
}

export function intersects(a, b) {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

export function contains(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const css = (m) => `matrix(${m.map((v) => +v.toFixed(6)).join(',')})`;

export const round = (v, p = 2) => {
  const k = 10 ** p;
  return Math.round(v * k) / k;
};
