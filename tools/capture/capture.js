// Capture a rendered component for Sigma (Part E, Phase 28). Runs in the page where the component is
// rendered (a Storybook story, a test page, the app): load it as a module, or paste it into the page through
// a browser tool, then call
//
//   sigmaCapture(element, { state: 'default' | 'hover' | 'focus' | 'pressed' | 'disabled', name })
//
// It returns a tree Sigma can turn into a component (tools/sigma.mjs library build): each element's box
// (relative to the root), its computed style, the CSS it was written with (so var(--token) references are
// kept), its text, and inline SVG. Layers are named by data-sigma-name, else aria-label, else their first
// class, else their tag. No dependencies.
const STYLE = [
  'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'flex-grow', 'gap', 'row-gap', 'column-gap',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'box-sizing', 'position', 'background-color', 'background-image', 'color', 'opacity', 'visibility',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-width', 'outline-style', 'outline-color', 'outline-offset',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'text-overflow', 'overflow',
  '-webkit-line-clamp', 'cursor',
];
// Authored properties worth keeping (they can hold var() references).
const AUTHORED = [
  'background', 'background-color', 'color', 'border', 'border-color', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-width',
  'border-radius', 'gap', 'row-gap', 'column-gap', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'font', 'font-family',
  'font-size', 'font-weight', 'line-height', 'letter-spacing', 'box-shadow', 'opacity', 'width', 'height', 'min-width', 'max-width', 'min-height',
  'max-height', 'outline', 'outline-color',
];
const PSEUDO = { hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', pressed: ':active' };

function rulesOf(sheet, out = []) {
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    return out; // a stylesheet from another origin
  }
  for (const r of rules || []) {
    if (r.styleSheet) rulesOf(r.styleSheet, out); // @import
    else if (r.cssRules && !r.selectorText) {
      if (!r.media || window.matchMedia(r.media.mediaText).matches) rulesOf(r, out); // @media, @supports, @layer
    } else if (r.selectorText) out.push(r);
  }
  return out;
}
const allRules = () => [...document.styleSheets].flatMap((s) => rulesOf(s));

// The CSS an element was written with: { property: text } from matching rules (in order) and its style attribute.
function authored(el, rules, extra = []) {
  const out = {};
  for (const r of [...rules, ...extra]) {
    let match = false;
    try {
      match = el.matches(r.selector || r.selectorText);
    } catch {}
    if (!match) continue;
    for (const p of AUTHORED) {
      const v = r.style.getPropertyValue(p);
      if (v) out[p] = v.trim();
    }
  }
  for (const p of AUTHORED) {
    const v = el.style.getPropertyValue(p);
    if (v) out[p] = v.trim();
  }
  return out;
}

// Rules that apply in a state (":hover" rules, say), applied to the elements they'd match, as inline styles.
function emulate(root, state, rules) {
  const undo = [];
  if (state === 'disabled') {
    for (const el of [root, ...root.querySelectorAll('button, input, select, textarea')]) {
      if ('disabled' in el && !el.disabled) {
        el.disabled = true;
        undo.push(() => (el.disabled = false));
      }
    }
    return { undo: () => undo.forEach((f) => f()), extra: [] };
  }
  const pseudo = PSEUDO[state];
  const extra = [];
  if (!pseudo) return { undo: () => {}, extra };
  for (const r of rules) {
    if (!r.selectorText.includes(pseudo)) continue;
    const selector = r.selectorText.split(',').filter((s) => s.includes(pseudo)).map((s) => s.split(pseudo).join('')).join(',');
    let targets = [];
    try {
      targets = [root, ...root.querySelectorAll('*')].filter((el) => el.matches(selector));
    } catch {}
    for (const el of targets) {
      const before = el.getAttribute('style');
      // The whole declaration text: shorthands with var() can't be copied property by property.
      el.style.cssText = `${el.style.cssText};${r.style.cssText}`;
      undo.push(() => (before === null ? el.removeAttribute('style') : el.setAttribute('style', before)));
    }
    extra.push({ selector, style: r.style });
  }
  return { undo: () => undo.reverse().forEach((f) => f()), extra };
}

const nameOf = (el) => el.dataset?.sigmaName || el.getAttribute?.('aria-label') || (el.classList?.[0] ? el.classList[0].replace(/^[a-z]/, (c) => c.toUpperCase()) : el.tagName.toLowerCase());

export function sigmaCapture(root, { state = 'default', name = null } = {}) {
  const rules = allRules();
  // Transitions would report a state's starting values; turn them (and animations) off while capturing.
  const still = document.createElement('style');
  still.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.appendChild(still);
  const { undo, extra } = emulate(root, state, rules);
  try {
    const origin = root.getBoundingClientRect();
    const box = (r) => ({ x: Math.round((r.left - origin.left) * 100) / 100, y: Math.round((r.top - origin.top) * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 });
    const visit = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return null;
      const node = { tag: el.tagName.toLowerCase(), name: nameOf(el), box: box(el.getBoundingClientRect()), style: {}, authored: authored(el, rules, extra) };
      for (const p of STYLE) node.style[p] = cs.getPropertyValue(p);
      if (el.tagName.toLowerCase() === 'svg') {
        node.svg = el.outerHTML;
        return node;
      }
      if (el.tagName === 'IMG') node.src = el.currentSrc || el.src;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        node.text = el.value || el.placeholder || '';
        node.placeholder = !el.value && !!el.placeholder;
        if (node.placeholder) node.placeholderColor = getComputedStyle(el, '::placeholder').color;
      }
      const kids = [];
      for (const child of el.childNodes) {
        if (child.nodeType === 1) {
          const k = visit(child);
          if (k) kids.push(k);
        } else if (child.nodeType === 3 && child.textContent.trim()) {
          // A run of text: its own box (from a range), with its parent's text style.
          const range = document.createRange();
          range.selectNodeContents(child);
          kids.push({ tag: '#text', name: el.dataset?.sigmaText || 'Text', text: child.textContent.replace(/\s+/g, ' ').trim(), box: box(range.getBoundingClientRect()), style: node.style, authored: node.authored });
        }
      }
      if (kids.length) node.children = kids;
      return node;
    };
    const tree = visit(root);
    if (name) tree.name = name;
    return { capturedAt: new Date().toISOString(), url: location.href, state, viewport: { w: innerWidth, h: innerHeight }, rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize), tree };
  } finally {
    undo();
    still.remove();
  }
}

if (typeof window !== 'undefined') window.sigmaCapture = sigmaCapture;
