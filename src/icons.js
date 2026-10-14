import { findIcon, iconMarkup } from './icon-library.js';
const s = (body, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const s16 = (body) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  appearance: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none"/></svg>',
  selectChevron: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 4.5 3 3 3-3"/></svg>',
  move: s('<path d="M7 4.5l10.5 6-4.6 1.4 2.9 5.1-1.7 1-2.9-5.1L7.5 16z" fill="currentColor" stroke="none"/>'),
  hand: s('<path d="M8.5 12V6.5a1.25 1.25 0 0 1 2.5 0V11m0-5.5V5a1.25 1.25 0 0 1 2.5 0v6m0-5a1.25 1.25 0 0 1 2.5 0v5.5m0-3a1.25 1.25 0 0 1 2.5 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2l-3-3.6a1.3 1.3 0 0 1 2-1.7L8.5 14"/>'),
  frame: s('<path d="M8 4v16M16 4v16M4 8h16M4 16h16"/>'),
  rect: s('<rect x="5" y="5" width="14" height="14" rx="1"/>'),
  ellipse: s('<circle cx="12" cy="12" r="7"/>'),
  line: s('<path d="M5 19L19 5"/>'),
  text: s('<path d="M6 6.5V5h12v1.5M12 5v14M10 19h4"/>'),
  image: s('<rect x="4.5" y="5.5" width="15" height="13" rx="1.5"/><circle cx="9" cy="10" r="1.5"/><path d="M19.5 15l-4-4-8 7.5"/>'),
  chevronDown: `<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 3l2.5 2.5L6.5 3" fill="none" stroke="currentColor" stroke-width="1"/></svg>`,
  chevronRight: `<svg width="8" height="8" viewBox="0 0 8 8"><path d="M3 1.5l2.5 2.5L3 6.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>`,
  eye: s16('<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'),
  eyeOff: s16('<path d="M2.5 5.5C4 7.5 6 8.5 8 8.5s4-1 5.5-3M4.5 7.5l-1 1.5M8 8.5V10.5M11.5 7.5l1 1.5"/>'),
  lock: s16('<rect x="4" y="7" width="8" height="6" rx="1"/><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7"/>'),
  unlock: s16('<rect x="4" y="7" width="8" height="6" rx="1"/><path d="M5.5 7V5.5a2.5 2.5 0 0 1 4.9-.7"/>'),
  comment: s('<path d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5z"/><path d="M9 9.5h6M9 12.5h4"/>'),
  home: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l7-5.5L17 9"/><path d="M4.8 7.8V16.5h10.4V7.8"/><path d="M8.3 16.5v-4.5h3.4v4.5"/></svg>`,
  plus: s16('<path d="M8 3.5v9M3.5 8h9"/>'),
  minus: s16('<path d="M3.5 8h9"/>'),
  close: s16('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  alignLeft: s16('<path d="M2.5 2v12"/><rect x="5" y="4" width="8" height="3" rx=".5"/><rect x="5" y="9" width="5" height="3" rx=".5"/>'),
  alignHCenter: s16('<path d="M8 2v12"/><rect x="3.5" y="4" width="9" height="3" rx=".5"/><rect x="5" y="9" width="6" height="3" rx=".5"/>'),
  alignRight: s16('<path d="M13.5 2v12"/><rect x="3" y="4" width="8" height="3" rx=".5"/><rect x="6" y="9" width="5" height="3" rx=".5"/>'),
  alignTop: s16('<path d="M2 2.5h12"/><rect x="4" y="5" width="3" height="8" rx=".5"/><rect x="9" y="5" width="3" height="5" rx=".5"/>'),
  alignVCenter: s16('<path d="M2 8h12"/><rect x="4" y="3.5" width="3" height="9" rx=".5"/><rect x="9" y="5" width="3" height="6" rx=".5"/>'),
  alignBottom: s16('<path d="M2 13.5h12"/><rect x="4" y="3" width="3" height="8" rx=".5"/><rect x="9" y="6" width="3" height="5" rx=".5"/>'),
  distH: s16('<path d="M2 2v12M14 2v12"/><rect x="6" y="5" width="4" height="6" rx=".5"/>'),
  distV: s16('<path d="M2 2h12M2 14h12"/><rect x="5" y="6" width="6" height="4" rx=".5"/>'),
  textLeft: s16('<path d="M3 4h10M3 7h7M3 10h10M3 13h6"/>'),
  textCenter: s16('<path d="M3 4h10M4.5 7h7M3 10h10M5 13h6"/>'),
  textRight: s16('<path d="M3 4h10M6 7h7M3 10h10M7 13h6"/>'),
  autoWidth: s16('<path d="M2 8h12M4 6l-2 2 2 2M12 6l2 2-2 2"/>'),
  autoHeight: s16('<path d="M8 2v12M6 4l2-2 2 2M6 12l2 2 2-2"/>'),
  fixedSize: s16('<rect x="3" y="3" width="10" height="10" rx="1"/>'),
  rotation: s16('<path d="M3 13V8a5 5 0 0 1 5-5h1"/><path d="M3 13h10"/>'),
  radius: s16('<path d="M3 13V7a4 4 0 0 1 4-4h6"/>'),
  alVertical: s16('<path d="M8 2.5v11M4.5 10L8 13.5 11.5 10"/>'),
  alHorizontal: s16('<path d="M2.5 8h11M10 4.5L13.5 8 10 11.5"/>'),
  gapH: s16('<path d="M3 3v10M13 3v10M7 8h2"/>'),
  gapV: s16('<path d="M3 3h10M3 13h10M8 7v2"/>'),
  padH: s16('<rect x="4.5" y="3.5" width="7" height="9" rx="1"/><path d="M2 3v10M14 3v10"/>'),
  padV: s16('<rect x="3.5" y="4.5" width="9" height="7" rx="1"/><path d="M3 2h10M3 14h10"/>'),
  link: s16('<path d="M6.5 9.5l3-3"/><path d="M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1"/><path d="M3 3l1.5 1.5M13 13l-1.5-1.5"/>'),
  linkOn: s16('<path d="M6.5 9.5l3-3"/><path d="M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1"/>'),
  logo: `<svg width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="5" fill="#0D99FF"/><path d="M14 5.5H6.5L11 10l-4.5 4.5H14" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// Four rounded tiles represent a family of component variants.
export const componentSetSymbol = '<g fill="currentColor" stroke="none"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="7" y="1" width="4" height="4" rx="1"/><rect x="1" y="7" width="4" height="4" rx="1"/><rect x="7" y="7" width="4" height="4" rx="1"/></g>';

export function layerIcon(n) {
  const i16 = (body) => `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1">${body}</svg>`;
  switch (n.type) {
    case 'frame':
      if (n.layout?.mode === 'horizontal') return i16('<rect x="1.5" y="2.5" width="3.5" height="7" rx=".5"/><rect x="7" y="2.5" width="3.5" height="7" rx=".5"/>');
      if (n.layout?.mode === 'vertical') return i16('<rect x="2.5" y="1.5" width="7" height="3.5" rx=".5"/><rect x="2.5" y="7" width="7" height="3.5" rx=".5"/>');
      return i16('<path d="M3.5 1v10M8.5 1v10M1 3.5h10M1 8.5h10"/>');
    case 'group': return i16('<rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke-dasharray="2 1.5"/>');
    case 'rect': return i16('<rect x="1.5" y="1.5" width="9" height="9" rx="1"/>');
    case 'ellipse': return i16('<circle cx="6" cy="6" r="4.5"/>');
    case 'line': return i16('<path d="M1.5 10.5l9-9"/>');
    case 'text': return i16('<path d="M2 3V1.5h8V3M6 1.5v9M4.5 10.5h3"/>');
    case 'image': return i16('<rect x="1" y="1.5" width="10" height="9" rx="1"/><path d="M11 8L8 5l-6 5.5"/>');
    case 'component': return i16('<path d="M6 1.2l1.9 1.9L6 5 4.1 3.1zM6 7l1.9 1.9L6 10.8 4.1 8.9zM3.1 4.1L5 6 3.1 7.9 1.2 6zM8.9 4.1L10.8 6 8.9 7.9 7 6z"/>');
    case 'instance': return i16('<path d="M6 1.5L10.5 6 6 10.5 1.5 6z"/>');
    case 'icon': {
      const icon = findIcon(n.iconId);
      return icon ? iconMarkup(icon, { w: 12, h: 12 }) : i16('<rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke-dasharray="1.5 1.5"/>');
    }
    case 'componentSet': return i16(componentSetSymbol);
    default: return '';
  }
}
