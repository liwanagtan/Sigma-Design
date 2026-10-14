// Full desktop screens captured from Sigma's rendered interface. Keep UI layers editable;
// SVG artwork remains an embedded image, including the editor's canvas preview.
import { PAGE_CAPTURES } from './sigma-page-captures.js';
import { fromProjectFile } from './project-format.js';
import { buildPage } from './capture-to-sigma.js';
import { createNode, uid } from './store.js';

export const SIGMA_PAGES_VERSION = 15;
export const SIGMA_PAGES_SOURCE_HASH=PAGE_CAPTURES.sourceHash;
export const SIGMA_PAGES_NAME = 'Pages and UI';

function svgImage(svg, box, color) {
  let markup = svg.replace(/<svg\b([^>]*)>/, (_, attributes) => {
    const attrs = attributes.replace(/\s(?:width|height|style)="[^"]*"/g, '');
    return `<svg${attrs}${/xmlns=/.test(attrs) ? '' : ' xmlns="http://www.w3.org/2000/svg"'} width="${box.w}" height="${box.h}" style="color:${color || '#1E1E1E'}">`;
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

export function sigmaPagesDocument(collections) {
  const tokens = new Map();
  for (const col of collections) for (const v of col.variables) {
    if (col.name === 'Interface' && v.name.startsWith('color/')) tokens.set(`--${v.name.slice(6)}`, { id: v.id, type: v.type });
  }
  const textToken = tokens.get('--text');
  const pages = PAGE_CAPTURES.captures.map(({ name, capture }, index) => {
    const convert = (el, parentBox = { x:0, y:0 }) => {
      let n;
      if (el.tag === 'svg' || el.svg) {
        n = createNode('image', { name: el.name, src: svgImage(el.svg, el.box, el.style?.color), w: el.box.w, h: el.box.h, imageFit:'fill' });
      } else if (el.tag === 'img') {
        if (!el.src?.startsWith('data:')) throw new Error(`Unbundled page image: ${el.src}`);
        n = createNode('image', { name:el.name, src:el.src, w:el.box.w, h:el.box.h, imageFit:'fill' });
      } else {
        // Convert one element at a time to retain the captured absolute geometry.
        // Browser flex/grid layout is already measured; do not infer a new layout.
        const style = { ...el.style };
        for (const side of ['top','right','bottom','left']) {
          if (/^rgba\([^)]*,\s*0\)$/.test(style[`border-${side}-color`] || '')) style[`border-${side}-style`] = 'none';
        }
        const leaf = { ...el, tag:el.tag==='select' ? 'input' : el.tag, style, children:undefined };
        n = buildPage({ ...capture, tree:leaf }, { name:`sigma-page-${index}-${uid()}`, tokens, iconFor:()=>null }).node;
        n.name = el.name;
        delete n.layout; delete n.sizingH; delete n.sizingV;
        if (n.bindings) for (const key of Object.keys(n.bindings)) if (key.startsWith('layout.')) delete n.bindings[key];
        if (n.type === 'text') {
          n.autoResize = 'fixed';
          // Default text inherits :root's semantic text color in the real app.
          if (!n.bindings?.['fills.0.color'] && /^#1E1E1E$/i.test(n.fills?.[0]?.color || '') && textToken) (n.bindings ||= {})['fills.0.color'] = textToken.id;
        }
        if (['input','textarea','select'].includes(el.tag) && n.children?.length) {
          for (const text of n.children) {
            text.x = parseFloat(el.style['padding-left']) || 0;
            text.y = Math.max(0, (el.box.h-text.fontSize*1.2)/2);
            text.autoResize = 'fixed';
          }
        }
        const children = (el.children || []).map(child=>convert(child, el.box));
        if (children.length) n.children = children;
        if (/(auto|scroll|hidden)/.test(el.style?.overflow || '')) n.clip = true;
      }
      n.x = el.box.x-parentBox.x; n.y = el.box.y-parentBox.y;
      n.w = el.box.w; n.h = el.box.h;
      return n;
    };
    const screen = convert(capture.tree);
    screen.name = `${name} · ${capture.viewport.w} × ${capture.viewport.h}`;
    screen.clip = true;
    return { id:uid(), name, group:'Desktop screens', background:'#E6E6E6', modes:Object.fromEntries(collections.map(c=>[c.id, c.modes.find(m=>m.name==='Light').id])), children:[screen] };
  });
  return fromProjectFile({ format:1, kind:'design', name:SIGMA_PAGES_NAME, pages, description:'Sigma’s rendered desktop screens, captured as editable interface layers with embedded SVG artwork.' }).doc;
}
