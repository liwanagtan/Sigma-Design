import { createNode, uid } from './store.js';

const text = (props) => createNode('text', { autoResize: 'width', ...props, name: props.name || props.text.slice(0, 30) });

export function sampleDocument({ blank = false } = {}) {
  const page1 = { id: uid(), name: 'Page 1', background: '#F5F5F5', children: [] };
  const doc = { name: 'Untitled', pages: [page1], currentPageId: page1.id };
  if (blank) return doc;

  doc.name = 'Welcome to Sigma';
  const hero = createNode('frame', { name: 'Desktop', x: 0, y: 0, w: 960, h: 600, fill: '#FFFFFF' });
  hero.children.push(
    createNode('rect', { name: 'Nav', x: 0, y: 0, w: 960, h: 64, fill: '#FFFFFF', stroke: '#E6E6E6' }),
    createNode('ellipse', { name: 'Logo', x: 32, y: 20, w: 24, h: 24, fill: '#0D99FF' }),
    text({ text: 'Sigma', x: 66, y: 21, fontSize: 18, fontWeight: 700, w: 60, h: 22 }),
    text({ text: 'Design on an infinite canvas', x: 64, y: 160, fontSize: 48, fontWeight: 700, letterSpacing: -1, w: 640, h: 58 }),
    text({ text: 'Draw frames, shapes and text. Drag, resize, rotate, and snap\nwith smart guides — all in your browser.', x: 64, y: 236, fontSize: 18, lineHeight: 150, fill: '#555555', w: 520, h: 54 }),
    createNode('rect', { name: 'Button', x: 64, y: 320, w: 160, h: 48, radius: 8, fill: '#0D99FF' }),
    text({ text: 'Get started', x: 100, y: 334, fontSize: 16, fontWeight: 600, fill: '#FFFFFF', w: 88, h: 19 }),
    createNode('rect', { name: 'Card', x: 600, y: 300, w: 280, h: 220, radius: 16, fill: '#FFC700', rotation: -6 }),
    createNode('ellipse', { name: 'Blob', x: 720, y: 360, w: 180, h: 180, fill: '#9747FF', fillOpacity: 0.85 }),
  );
  const mobile = createNode('frame', { name: 'Mobile', x: 1040, y: 0, w: 390, h: 600, fill: '#1E1E1E', radius: 0 });
  mobile.children.push(
    text({ text: 'Hello 👋', x: 24, y: 64, fontSize: 32, fontWeight: 700, fill: '#FFFFFF', w: 140, h: 39 }),
    createNode('rect', { name: 'Tile', x: 24, y: 136, w: 342, h: 160, radius: 20, fill: '#14AE5C' }),
    createNode('rect', { name: 'Tile', x: 24, y: 312, w: 163, h: 160, radius: 20, fill: '#F24822' }),
    createNode('rect', { name: 'Tile', x: 203, y: 312, w: 163, h: 160, radius: 20, fill: '#0D99FF' }),
    createNode('line', { name: 'Divider', x: 24, y: 504, w: 342, h: 0, stroke: '#444444', strokeWidth: 1 }),
  );
  page1.children.push(hero, mobile);
  return doc;
}
