// The sample Sigma Icons file ("Sigma Icons" in the Welcome to Sigma folder): a small set picked from Lucide
// (https://lucide.dev, ISC License), in groups, with filled versions of some shapes so it shows both styles.
// The Welcome to Sigma guide links it and uses its icons in components.
import { newIconsDocument, sanitizeIcons } from './icon-library.js';

export const SAMPLE_ICONS_NAME = 'Sigma Icons';

// Group → Lucide icon names (outline).
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

// The sample Sigma Icons document from the Lucide data (icon-sets/lucide.json), published as v1.
export function sampleIconsDocument(lucide) {
  const byName = new Map(lucide.icons.map(([name, , keywords, body]) => [name, { keywords, body }]));
  const icons = [];
  const add = (groups, style) => {
    for (const [group, names] of Object.entries(groups)) {
      for (const name of names) {
        const src = byName.get(name);
        if (!src) throw new Error(`Lucide has no icon named ${name}`);
        icons.push({
          id: sampleIconId(name, style === 'filled'), name, group, keywords: src.keywords, body: src.body,
          viewBox: lucide.viewBox, style, strokeWidth: lucide.strokeWidth, cap: lucide.cap, join: lucide.join,
        });
      }
    }
  };
  add(OUTLINE, 'outline');
  add(FILLED, 'filled');
  const doc = newIconsDocument(SAMPLE_ICONS_NAME);
  doc.icons = sanitizeIcons(icons);
  doc.source = {
    name: 'Lucide', version: lucide.version, url: lucide.url, license: lucide.license, licenseText: lucide.licenseText,
    note: 'A selection of Lucide icons. The filled versions are Lucide shapes, filled.',
  };
  doc.published = { version: 1, publishedAt: Date.now(), notes: 'Sample icons', icons: structuredClone(doc.icons) };
  return doc;
}
