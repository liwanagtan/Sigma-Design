import {LUCIDE_GLYPHS,LUCIDE_VERSION} from './lucide-ui-data.js';
import {lucideIcon} from './lucide.js';
import {UI_ICON_NAMES} from './ui-icon-map.js';
// Sigma Icons publishes the Lucide glyphs used by Sigma’s interface. Optics has the full catalogue.
export const SAMPLE_ICONS_VERSION = 8; // 8: canonical Lucide names with stable Sigma IDs and searchable aliases
import { icons as uiIcons } from './icons.js';
import { newIconsDocument, sanitizeIcons, parseSVGIcon } from './icon-library.js';

export const SAMPLE_ICONS_NAME = 'Icons';
export const sigmaIconId = name => `sigma-ui-${name}`;
export function sigmaUIIcons() {
  const mapped=new Set(Object.values(UI_ICON_NAMES));
  const entries=[...Object.entries(uiIcons).filter(([name])=>name!=='logo'),...Object.keys(LUCIDE_GLYPHS).filter(name=>!mapped.has(name)).map(name=>[name,lucideIcon(name)])];
  return entries.map(([name,svg])=>{
    const attrs=svg.match(/^<svg([^>]*)>/)[1];
    const fill=/fill="([^"]*)"/.exec(attrs)?.[1]||'none';
    const stroke=/stroke="([^"]*)"/.exec(attrs)?.[1]||'none';
    const wrapped=svg.replace(/(<svg[^>]*>)([\s\S]*)(<\/svg>)/,`$1<g fill="${fill}" stroke="${stroke}">$2</g>$3`);
    const lucideName=UI_ICON_NAMES[name]||name;
    return {...parseSVGIcon(wrapped,{name:lucideName,group:'Lucide · Sigma UI'}),id:sigmaIconId(name),keywords:[name,lucideName,'Lucide','Sigma'].join(', ')};
  });
}

// The guide's groups → Lucide icon names (outline). Every other Lucide icon keeps its Lucide category.
const OUTLINE = {
  Actions: ['plus', 'minus', 'x', 'check', 'search', 'settings', 'trash', 'pencil', 'copy', 'download', 'upload', 'share-2', 'external-link', 'funnel'],
  Arrows: ['arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'chevron-left', 'chevron-right', 'chevron-up', 'chevron-down'],
  Communication: ['mail', 'message-circle', 'phone', 'send', 'bell', 'user', 'users'],
  Files: ['file', 'file-text', 'folder', 'paperclip', 'calendar', 'clock'],
  Interface: ['menu', 'house', 'layout-grid', 'list', 'ellipsis', 'eye', 'eye-off', 'lock', 'lock-open', 'log-out'],
  Media: ['play', 'pause', 'skip-forward', 'volume-2', 'image', 'camera', 'mic'],
  Shapes: ['circle', 'square', 'triangle', 'hexagon', 'shield', 'cloud', 'droplet', 'zap', 'moon'],
  Social: ['heart', 'star', 'bookmark', 'thumbs-up', 'flag'],
  Status: ['circle-check', 'circle-alert', 'circle-x', 'info', 'triangle-alert', 'loader'],
};
// Filled versions: the same shapes, filled, with the outline's stroke so they keep their size.
const FILLED = {
  Communication: ['message-circle', 'bell'],
  Media: ['play', 'pause'],
  Shapes: ['circle', 'square', 'triangle', 'hexagon', 'shield', 'cloud', 'droplet', 'zap', 'moon'],
  Social: ['heart', 'star', 'bookmark', 'thumbs-up', 'flag'],
};

// The id of a sample icon (the guide refers to them by name).
export const sampleIconId = (name, filled = false) => `sigma-${name}${filled ? '-filled' : ''}`;

// The sample icons document from the Lucide data (icon-sets/lucide.json), published as v1.
export function lucideIconsDocument(lucide) {
  const byName = new Map(lucide.icons.map(([name, category, keywords, body]) => [name, { category, keywords, body }]));
  const icons = [];
  const push = (name, group, style) => {
    const src = byName.get(name);
    if (!src) throw new Error(`Lucide has no icon named ${name}`);
    icons.push({
      id: sampleIconId(name, style === 'filled'), name, group, keywords: src.keywords, body: src.body,
      viewBox: lucide.viewBox, style, strokeWidth: lucide.strokeWidth, cap: lucide.cap, join: lucide.join,
    });
  };
  // The guide's icons first, in their groups; then every other Lucide icon, in its category; then the filled ones.
  const placed = new Set();
  for (const [group, names] of Object.entries(OUTLINE)) for (const name of names) {
    push(name, group, 'outline');
    placed.add(name);
  }
  for (const [name, { category }] of byName) if (!placed.has(name)) push(name, category || 'Other', 'outline');
  for (const [group, names] of Object.entries(FILLED)) for (const name of names) push(name, group, 'filled');
  const doc = newIconsDocument(SAMPLE_ICONS_NAME);
  doc.icons = sanitizeIcons(icons);
  doc.source = {
    name: 'Lucide', version: lucide.version, url: lucide.url, license: lucide.license, licenseText: lucide.licenseText,
    note: 'Lucide catalogue for Optics, including filled shape variants.',
  };
  doc.published = { version: 1, publishedAt: Date.now(), notes: 'Icons', icons: structuredClone(doc.icons) };
  return doc;
}

export function sampleIconsDocument() {
  const doc=newIconsDocument(SAMPLE_ICONS_NAME);
  doc.icons=sanitizeIcons(sigmaUIIcons());
  doc.source={name:'Lucide · Sigma UI',version:LUCIDE_VERSION,url:'https://lucide.dev',license:'ISC (Feather-derived icons MIT; see NOTICE and icon-sets/lucide.json)',note:'Lucide glyphs used by Sigma’s interface, with stable Sigma IDs. The Sigma brand mark remains separate.'};
  doc.published={version:1,publishedAt:Date.now(),notes:'Sigma UI glyphs',icons:structuredClone(doc.icons)};
  return doc;
}
