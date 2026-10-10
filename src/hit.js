import { page, worldMatrix, getParent, selectedNodes } from './store.js';
import { apply, inv } from './geom.js';
import { view } from './store.js';

function localPoint(n, pt) {
  return apply(inv(worldMatrix(n)), pt);
}

function hitNode(n, pt, exclude) {
  if (!n.visible || n.locked || exclude.has(n.id)) return null;
  const L = localPoint(n, pt);
  const inside = L.x >= 0 && L.y >= 0 && L.x <= n.w && L.y <= n.h;
  if (n.children) {
    if (n.type === 'frame' && n.clip && !inside) return null;
    for (let i = n.children.length - 1; i >= 0; i--) {
      const r = hitNode(n.children[i], pt, exclude);
      if (r) return [n, ...r];
    }
    return n.type === 'frame' && inside ? [n] : null;
  }
  const tol = 4 / view().zoom;
  switch (n.type) {
    case 'ellipse': {
      if (n.w <= 0 || n.h <= 0) return null;
      const dx = (L.x - n.w / 2) / (n.w / 2), dy = (L.y - n.h / 2) / (n.h / 2);
      return dx * dx + dy * dy <= 1 ? [n] : null;
    }
    case 'line': {
      const half = Math.max((n.strokeWidth || 1) / 2, tol);
      return Math.abs(L.y) <= half && L.x >= -tol && L.x <= n.w + tol ? [n] : null;
    }
    default:
      return inside ? [n] : null;
  }
}

// Path of nodes from top-level to deepest hit node, or null.
export function hitPath(pt, exclude = new Set()) {
  const nodes = page().children;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const r = hitNode(nodes[i], pt, exclude);
    if (r) return r;
  }
  return null;
}

// Figma-like selection depth: top-level frames are "transparent", other containers are selected whole,
// unless the user has already drilled into a container.
export function pickFromPath(path, { deep = false } = {}) {
  if (!path || !path.length) return null;
  if (deep) return path[path.length - 1];
  for (const s of selectedNodes()) {
    const p = getParent(s.id);
    if (!p) continue;
    const i = path.indexOf(p);
    if (i >= 0 && i < path.length - 1) return path[i + 1];
  }
  if (path[0].type === 'frame' && path.length > 1) return path[1];
  return path[0];
}

// Deepest frame containing the point (for drawing into / reparenting).
export function frameAt(pt, exclude = new Set()) {
  const search = (nodes) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!n.visible || n.locked || exclude.has(n.id) || !n.children) continue;
      const L = localPoint(n, pt);
      const inside = L.x >= 0 && L.y >= 0 && L.x <= n.w && L.y <= n.h;
      if (n.type === 'frame') {
        if (!inside) continue;
        return search(n.children) || n;
      }
      const deeper = search(n.children);
      if (deeper) return deeper;
    }
    return null;
  };
  return search(page().children);
}
