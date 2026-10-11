// Constraints: how a layer responds when its frame (or instance) is resized. Layers in an auto layout
// flow are positioned by the layout instead; absolute-positioned ones still use constraints.
//   node.constraints = { h: 'left' | 'right' | 'leftRight' | 'center' | 'scale',
//                        v: 'top' | 'bottom' | 'topBottom' | 'center' | 'scale' }   (default left / top)
import { isFrameLike } from './store.js';
import { round } from './geom.js';
import { isAutoLayout } from './layout.js';

export const H_CONSTRAINTS = { left: 'Left', right: 'Right', leftRight: 'Left & right', center: 'Center', scale: 'Scale' };
export const V_CONSTRAINTS = { top: 'Top', bottom: 'Bottom', topBottom: 'Top & bottom', center: 'Center', scale: 'Scale' };

// New [position, size] on one axis for a rule, given the old position/size and the parent's change.
// Size is null for rules that keep the layer's own size (so e.g. re-measured text widths survive).
function axis(rule, pos0, size0, delta, ratio) {
  switch (rule) {
    case 'right':
    case 'bottom': return [pos0 + delta, null];
    case 'leftRight':
    case 'topBottom': return [pos0, Math.max(1, size0 + delta)];
    case 'center': return [pos0 + delta / 2, null];
    case 'scale': return [pos0 * ratio, Math.max(1, size0 * ratio)];
    default: return [pos0, null]; // left / top
  }
}

// Reposition `parent`'s children for its new size, starting from `kids0` (a snapshot of the children
// taken at the old size w0 × h0). `ignore` keeps everything where it was (⌘ while resizing).
export function applyConstraints(parent, kids0, w0, h0, { ignore = false } = {}) {
  if (!parent.children || !kids0) return;
  const dw = parent.w - w0, dh = parent.h - h0;
  const sx = w0 ? parent.w / w0 : 1, sy = h0 ? parent.h / h0 : 1;
  const flow = isAutoLayout(parent);
  parent.children.forEach((k, i) => {
    const k0 = kids0[i];
    if (!k0 || (flow && !k.absolute)) return;
    const c = ignore ? {} : k.constraints || {};
    const [x, w] = axis(c.h, k0.x, k0.w, dw, sx);
    const [y, h] = axis(c.v, k0.y, k0.h, dh, sy);
    k.x = round(x);
    k.y = round(y);
    if (w !== null) k.w = round(w);
    if (h !== null && k.type !== 'line') k.h = round(h);
    // A stretched text box keeps its new width.
    if (k.type === 'text' && w !== null && k.autoResize === 'width') k.autoResize = 'height';
    // Frames inside pass the resize on to their own children.
    if (isFrameLike(k) && k.type !== 'instance' && k.children && (k.w !== k0.w || k.h !== k0.h)) {
      applyConstraints(k, k0.children, k0.w, k0.h, { ignore });
    }
  });
}
