// Accessibility (Part D, Phase 16): annotations on layers and a check for frames, like eBay's Include plugin.
//
// Annotations (`node.a11y`, all optional): `alt` (an image's text alternative), `decorative` (true: an image or
// icon that screen readers skip), `label` (an accessible name, for icon-only buttons), `role` (button, link,
// heading…), `heading` (1–6, for text) and `focus` (focus order in its frame, from 1). An instance uses its
// main component's annotations unless it sets its own, and its role comes from the component's docs.
//
// The check lists issues with the reason for each: text contrast below WCAG AA (contrast.js), tap targets
// below 24×24 (WCAG 2.5.8) or the platform size (44 iOS, 48 Material), very small text, images without alt
// text, controls without an accessible name, headings that skip a level and focus order numbers used twice.
import { state, walk, getParent, pageOf, isShown } from './store.js';
import { textContrast, formatRatio } from './contrast.js';
import { mainComponentOf, owningInstance, containingComponent } from './components.js';
import { KINDS } from './a11y-kinds.js';

export { KINDS, issuesMarkdown } from './a11y-kinds.js';

export const ROLES = {
  button: 'Button', link: 'Link', checkbox: 'Checkbox', radio: 'Radio button', switch: 'Switch', tab: 'Tab',
  textbox: 'Text field', combobox: 'Select', slider: 'Slider', menuitem: 'Menu item',
  img: 'Image', heading: 'Heading', navigation: 'Navigation', dialog: 'Dialog', list: 'List', none: 'None (decorative)',
};
const INTERACTIVE = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'textbox', 'combobox', 'slider', 'menuitem']);
// Roles from component names, when neither the layer nor the component's docs say.
const NAME_ROLES = [
  [/\b(icon ?button|button|btn|chip|fab)\b/i, 'button'], [/\blink\b/i, 'link'], [/\bcheck ?box\b/i, 'checkbox'],
  [/\bradio\b/i, 'radio'], [/\b(switch|toggle)\b/i, 'switch'], [/\btab\b/i, 'tab'],
  [/\b(input|text ?field|text ?box|search ?field)\b/i, 'textbox'], [/\b(select|dropdown|combo ?box)\b/i, 'combobox'],
  [/\bslider\b/i, 'slider'], [/\bmenu ?item\b/i, 'menuitem'],
];


const setOf = (n) => {
  const p = getParent(n?.id);
  return p?.type === 'componentSet' ? p : n;
};

// The main component an instance root or a component is (its set, for a variant).
function componentFor(n) {
  if (n.type === 'instance') {
    const main = mainComponentOf(n);
    return main ? { main, set: setOf(main) } : null;
  }
  if (n.type === 'component') return { main: n, set: setOf(n) };
  return null;
}

/** A layer's annotations, with its main component's under an instance's own. */
export function a11yOf(n) {
  if (n?.type !== 'instance') return n?.a11y || {};
  const main = mainComponentOf(n);
  return { ...(main?.a11y || {}), ...(n.a11y || {}) };
}

/** Its role: set on the layer, else its component's docs, else from the component's name (null: none). */
export function roleOf(n) {
  const own = a11yOf(n).role;
  if (own) return own;
  if (n.type === 'image') return 'img';
  if (n.type === 'text' && a11yOf(n).heading) return 'heading';
  const c = componentFor(n);
  if (!c) return null;
  const docRole = c.set.docs?.role;
  if (docRole) return docRole;
  for (const [re, role] of NAME_ROLES) if (re.test(c.set.name) || re.test(c.main.name)) return role;
  return null;
}
export const isInteractive = (n) => INTERACTIVE.has(roleOf(n));

// Disabled controls are exempt from contrast (WCAG 1.4.3: "inactive user interface components").
function disabled(n) {
  for (let x = n; x; x = getParent(x.id)) {
    const c = componentFor(x);
    if (c && /disabled|inactive/i.test(`${c.main.name}`)) return true;
    if (/disabled/i.test(x.name || '') && x.type !== 'text') return true;
  }
  return false;
}

const visibleText = (n) => {
  let found = false;
  walk([n], (k) => {
    if (found || k.visible === false) return false;
    if (k.type === 'text' && String(k.text || '').trim()) found = true;
  });
  return found;
};

// The layer an issue is about, and what to call it: inside an instance, the layer (selectable) and its
// instance's name, so "Label in Button" reads well.
const nameOf = (n) => {
  const inst = owningInstance(n);
  if (inst) return `${n.name} in ${inst.name}`;
  const comp = containingComponent(n);
  if (!comp) return n.name;
  const set = setOf(comp);
  if (comp === n) return set === n ? n.name : `${set.name} (${n.name})`;
  return `${n.name} in ${set === comp ? comp.name : `${set.name} (${comp.name})`}`;
};

/**
 * Check layers (frames, usually) and everything in them: [{ kind, severity: 'error' | 'warning', id, name,
 * frame, message, group }]. `group` is the same for the same issue on copies of one component layer, so a
 * list can show it once. Options: target (44 or 48), minText (px).
 */
export function checkAccessibility(roots, { target = 44, minText = 12 } = {}) {
  const issues = [];
  const add = (kind, severity, n, frame, message, group = null) =>
    issues.push({ kind, severity, id: n.id, name: nameOf(n), frame: frame.name, message, group: group || `${kind}:${n.sourceId ? `${n.sourceId}:${message}` : n.id}` });
  const doc = state.doc;
  const pageWas = doc.currentPageId;
  try {
    for (const root of roots) {
      const pg = pageOf(root.id);
      if (pg) doc.currentPageId = pg.id; // contrast measures against the root's page
      const headings = [];
      const focus = new Map();
      walk([root], (n) => {
        if (!isShown(n)) return false; // hidden, or hidden at this width
        const a = a11yOf(n);
        if (a.decorative || a.role === 'none') return n.type === 'image' || n.type === 'icon' ? false : undefined;
        if (n.type === 'text' && String(n.text || '').trim()) {
          const c = disabled(n) ? null : textContrast(n);
          if (c) {
            const need = c.large ? 3 : 4.5;
            if (c.ratio < need) add('contrast', 'error', n, root, `${formatRatio(c.ratio)} against ${c.bg}; needs ${need}:1${c.large ? ' (large text)' : ''}`);
          }
          if ((n.fontSize || 0) < minText) add('text-size', 'warning', n, root, `${n.fontSize}px; ${minText}px or more is easier to read`);
          if (a.heading) headings.push({ n, level: a.heading });
        }
        if (n.type === 'image' && !a.alt) add('alt', 'error', n, root, 'No alt text, and not marked decorative');
        if (isInteractive(n)) {
          const role = ROLES[roleOf(n)] || 'Control';
          const w = Math.round(n.w), h = Math.round(n.h);
          const same = `target:${componentFor(n)?.set.id || n.id}:${w}x${h}`; // one row per component and size
          if (Math.min(w, h) < 24) add('target', 'error', n, root, `${role} is ${w}×${h}; under 24×24`, same);
          else if (Math.min(w, h) < target) add('target', 'warning', n, root, `${role} is ${w}×${h}; under ${target}×${target}`, same);
          if (!a.label && roleOf(n) !== 'textbox' && !visibleText(n)) add('label', 'error', n, root, `${role} has no text and no accessible label`);
        }
        if (a.focus) focus.set(a.focus, [...(focus.get(a.focus) || []), n]);
      });
      // Headings in layer order (the reading order, in auto layout).
      let last = 0;
      for (const { n, level } of headings) {
        if (last && level > last + 1) add('heading', 'warning', n, root, `h${level} after h${last}; skips h${last + 1}`);
        last = level;
      }
      for (const [k, list] of focus) if (list.length > 1) for (const n of list) add('focus', 'warning', n, root, `Focus order ${k} is used ${list.length} times in ${root.name}`);
    }
  } finally {
    doc.currentPageId = pageWas;
  }
  return issues;
}

/** What the annotations mean in HTML, for handoff: `alt="…"`, `aria-label="…"`, `<h2>`, `role="button"`… */
export function a11yCode(n) {
  const a = a11yOf(n);
  const role = roleOf(n);
  const out = [];
  if (n.type === 'image' || role === 'img') out.push(a.decorative ? 'alt=""' : `alt="${a.alt || ''}"`);
  else if (a.decorative || role === 'none') out.push('aria-hidden="true"');
  if (a.heading) out.push(`<h${a.heading}>`);
  if (role && !['img', 'heading', 'none'].includes(role) && !(role === 'button' && n.type === 'instance')) out.push(`role="${role}"`);
  if (a.label) out.push(`aria-label="${a.label}"`);
  if (a.focus) out.push(`focus order ${a.focus}`);
  return out;
}
