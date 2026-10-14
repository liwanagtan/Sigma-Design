// Sigma's welcome library. Light values and component geometry are extracted from styles.css;
// Both appearance palettes come from the CSS used by Sigma’s interface.
import { sampleIconId } from './sample-icons.js';
import { UI_SOURCE } from './sigma-ui-source.js';
import { collection, group, token, modes, ref } from './sample-tokens.js';
import { normalizeGroups } from './token-groups.js';
import { createNode, uid, makePaint } from './store.js';

export const SIGMA_SYSTEM_VERSION = 10;
const dark = Object.fromEntries(Object.entries(UI_SOURCE.dark).filter(([key])=>key.startsWith('--')).map(([key,value])=>[key.slice(2),value]));
const slug = s => s.replace(/^\./, '').replace(/[^\w-]+/g, '-');
const px = s => /^\d+(?:\.\d+)?px$/.test(s || '') ? parseFloat(s) : null;
const hex = s => { const m = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(s || ''); return m ? `#${m[1].length === 3 ? [...m[1]].map(x => x+x).join('') : m[1]}`.toUpperCase() : null; };
const labels = { '.btn': 'Button', '.btn.primary': 'Primary button', '.btn.primary.destructive': 'Destructive button', '.icon-btn': 'Icon button', '.rail-btn': 'Rail button', '.tb-btn': 'Toolbar button', '.field': 'Input field', '.select': 'Select', '.seg': 'Segmented control', '.page-row': 'Page row', '.page-group': 'Page group', '.layer-row': 'Layer row', '.menu': 'Dropdown menu', '.menu-item': 'Dropdown item', '.panel-head': 'Panel heading', '.file-name': 'File name', '.preset': 'Preset', '.check-row': 'Checkbox row', '.rail-badge': 'Rail badge' };

export function sigmaTokenDocument() {
  const colors = collection('Interface', ['Light', 'Dark']);
  const c = group(colors, 'color');
  const ids = {};
  for (const [key, value] of Object.entries(UI_SOURCE.root)) {
    if (!key.startsWith('--') || !hex(value)) continue;
    const name = key.slice(2);
    ids[name] = token(colors, c, name, 'color', modes(hex(value), dark[name] || hex(value)), `styles.css :root ${key}. Dark: Sigma interface appearance value.`);
  }
  const palette = group(colors, 'palette');
  for (const value of [...new Set(UI_SOURCE.palette.map(hex).filter(Boolean))]) token(colors, palette, value.slice(1).toLowerCase(), 'color', value, 'Literal color used in styles.css; fixed in both modes.');
  const foundations = collection('Foundations', ['Light', 'Dark']);
  const typeGroup = group(foundations, 'typography');
  const font = UI_SOURCE.root['font-family'].split(',')[0].trim();
  for (const [name, size, weight] of [['interface', 11, 400], ['label', 11, 500], ['heading', 12, 600], ['badge', 9, 600]]) {
    token(foundations, typeGroup, name, 'typography', { fontFamily: font, fontSize: size, fontWeight: weight, lineHeight: null, letterSpacing: 0 }, 'Sigma UI text style; see styles.css.');
  }
  for (const [name, property] of [['spacing', 'padding'], ['radius', 'border-radius'], ['height', 'height']]) {
    const g = group(foundations, name);
    const values = new Set(UI_SOURCE.foundations.flatMap(r => (r[property] || '').split(/\s+/).map(px).filter(v => v !== null)));
    for (const value of [...values].sort((a,b) => a-b)) token(foundations, g, String(value), 'number', value, `Used by ${property} in styles.css.`);
  }
  const fontSizes = group(foundations, 'font-size');
  for (const size of [...new Set(UI_SOURCE.foundations.map(r => px(r['font-size'])).filter(v => v !== null))].sort((a,b) => a-b)) token(foundations, fontSizes, String(size), 'number', size, 'Font size used in styles.css.');
  token(foundations, null, 'font-family', 'string', font, 'styles.css :root font-family (system fallbacks remain in CSS).');
  token(foundations, null, 'rail-width', 'number', px(UI_SOURCE.root['--rail-w']), 'styles.css :root --rail-w.');
  const elevation = group(foundations, 'elevation');
  let shadowIndex = 0;
  for (const value of new Set(UI_SOURCE.foundations.map(r => r['box-shadow']).filter(Boolean))) {
    const m = /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?\s+rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
    if (!m) continue;
    const color = '#' + [Number(m[5]), Number(m[6]), Number(m[7]), Math.round(Number(m[8])*255)].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    token(foundations, elevation, `shadow-${++shadowIndex}`, 'shadow', { color, x: Number(m[1]), y: Number(m[2]), blur: Number(m[3]), spread: Number(m[4] || 0) }, `styles.css box-shadow: ${value}. Shared across modes.`);
  }
  const components = collection('UI components', ['Light', 'Dark']);
  for (const [selector, rule] of Object.entries(UI_SOURCE.rules)) {
    const g = group(components, slug(selector));
    for (const [property, value] of Object.entries(rule)) {
      let type, light, alternate;
      if (value === 'transparent' && ['background', 'border-color', 'border'].includes(property)) { token(components, g, property, 'color', '#00000000', `styles.css ${selector}: ${property}: ${value}.`); continue; }
      const variable = /var\(--([\w-]+)\)/.exec(value);
      if (variable && ids[variable[1]] && ['background', 'color', 'border-color', 'border'].includes(property)) {
        type = 'color'; light = alternate = ref(ids[variable[1]]);
      } else if (hex(value)) {
        type = 'color'; light = hex(value); alternate = property === 'background' && light === '#FFFFFF' ? dark.panel : light;
      } else if (px(value) !== null) { type = 'number'; light = alternate = px(value); }
      else if (property === 'border' && value.includes('transparent')) { type = 'color'; light = alternate = '#00000000'; }
      else if (property === 'font-weight' && /^\d+$/.test(value)) { type = 'number'; light = alternate = Number(value); }
      else continue;
      token(components, g, property, type, modes(light, alternate), `styles.css ${selector}: ${property}: ${value}.`);
    }
    const padding = (rule.padding || '').split(/\s+/).map(px);
    if (padding.length && padding.every(v => v !== null)) {
      token(components, g, 'padding-y', 'number', padding[0]);
      token(components, g, 'padding-x', 'number', padding[1] ?? padding[0]);
    }
  }
  const collections = [colors, foundations, components];
  collections.forEach(normalizeGroups);
  return { name: 'Tokens', collections };
}

function kit(collections) {
  const find = (collectionName, name) => collections.find(c => c.name === collectionName)?.variables.find(v => v.name === name);
  const bind = (node, property, collectionName, name) => { const v = find(collectionName, name); if (v) (node.bindings ||= {})[property] = v.id; return node; };
  const text = (value, x, y, style = 'interface') => {
    const n = createNode('text', { name: value, text: value, x, y, w: 480, h: 24, fontSize: 11, autoResize: 'width', fills: [makePaint('#1E1E1E')] });
    bind(n, 'fills.0.color', 'Interface', 'color/text');
    return bind(n, 'typography', 'Foundations', `typography/${style}`);
  };
  const page = (name, children, modeName) => ({ id: uid(), name, background: modeName === 'Dark' ? dark.canvas : UI_SOURCE.root['--canvas'], modes: Object.fromEntries(collections.map(c => [c.id, c.modes.find(m => m.name === modeName).id])), children });
  return { find, bind, text, page };
}

export function sigmaFoundationsDocument(collections) {
  const K = kit(collections);
  const sections = collections.filter(c => c.name !== 'UI components').flatMap(c =>
    [...new Set(c.variables.map(v => v.name.split('/')[0]))].map(name => ({ c, name, variables: c.variables.filter(v => v.name.split('/')[0] === name) })));
  const pages = ['Light', 'Dark'].flatMap(mode => sections.map(({ c, name, variables }) => {
    const children = [K.text(`Sigma foundations · ${name} · ${mode}`, 0, 0, 'heading'), K.text(mode === 'Dark' ? 'Dark interface appearance; fixed primitives retain their source values.' : 'Source: styles.css. Values used by Sigma’s interface.', 0, 36)];
    variables.forEach((v, i) => {
      const y = 90 + i*54;
      const value = v.valuesByMode[c.modes[0].id];
      children.push(K.text(v.name, 0, y));
      if (v.type === 'typography') {
        children.push(K.bind(K.text('Sigma · The quick brown fox', 290, y), 'typography', c.name, v.name));
        return;
      }
      if (v.type === 'string') { children.push(K.text(value, 290, y)); return; }
      const n = createNode('rect', { name: v.name, x: 290, y, w: 160, h: 28, fills: [makePaint('#0D99FF')] });
      K.bind(n, 'fills.0.color', 'Interface', 'color/accent');
      if (v.type === 'color') K.bind(n, 'fills.0.color', c.name, v.name);
      else if (v.type === 'shadow') {
        n.radius = 5;
        n.effects = [{ type: 'drop-shadow', color: '#000000', opacity: 0.25, x: 0, y: 4, blur: 16, spread: 0, visible: true }];
        K.bind(n, 'fills.0.color', 'Interface', 'color/panel'); K.bind(n, 'effects.0', c.name, v.name);
      } else {
        K.bind(n, v.name.startsWith('radius/') ? 'radius' : v.name.startsWith('height/') ? 'h' : 'w', c.name, v.name);
        children.push(K.text(`${value}px`, 480, y));
      }
      children.push(n);
    });
    return { ...K.page(name, children, mode), group: mode };
  }));
  return { name: 'Foundations', pages, currentPageId: pages[0].id };
}

export function sigmaComponentsDocument(collections) {
  const K = kit(collections);
  const pages = Object.entries(labels).filter(([selector]) => UI_SOURCE.rules[selector]).map(([selector, name]) => {
    const variants = ['Default', 'Hover', 'Selected'].filter(state => state === 'Default' || UI_SOURCE.rules[`${selector}${state === 'Hover' ? ':hover' : '.active'}`] || UI_SOURCE.rules[`${selector}.selected`] && state === 'Selected');
    const sets = ['Light', 'Dark'].map((mode, mi) => {
      const components = variants.map((state, si) => {
        const base = UI_SOURCE.rules[selector];
        const stateSelector = `${selector}${state === 'Hover' ? ':hover' : UI_SOURCE.rules[`${selector}.active`] ? '.active' : '.selected'}`;
        const rule = { ...(selector.startsWith('.btn') ? UI_SOURCE.rules['.btn'] : {}), ...base, ...(state === 'Default' ? {} : UI_SOURCE.rules[stateSelector]) };
        const h = px(rule.height) || (selector === '.menu' ? 128 : selector === '.seg' ? 28 : 30);
        const node = createNode('component', { name: `State=${state}`, x: si * 240, y: 0, w: px(rule.width) || 200, h, radius: px(rule['border-radius']) || 0, fills: [makePaint('#00000000')], children: [], description: `${name}, ${state}. Source: styles.css ${selector}.`, codeName: slug(selector) });
        const apply = (prop, cssProperty, fallback) => {
          const sourceSelector = state !== 'Default' && K.find('UI components', `${slug(stateSelector)}/${cssProperty}`) ? stateSelector : selector;
          if (K.find('UI components', `${slug(sourceSelector)}/${cssProperty}`)) K.bind(node, prop, 'UI components', `${slug(sourceSelector)}/${cssProperty}`);
          else if (fallback) K.bind(node, prop, 'Interface', `color/${fallback}`);
        };
        apply('fills.0.color', 'background'); apply('h', 'height'); apply('w', 'width'); apply('radius', 'border-radius');
        if (rule.border && rule.border !== '0') { node.strokes = [makePaint('#E6E6E6')]; apply('strokes.0.color', 'border-color', 'border'); }
        const label = K.text(selector === '.file-name' ? 'Untitled' : name, px(rule['padding-left']) || 8, Math.max(0, (h-14)/2), 'label');
        const fg = (state !== 'Default' && K.find('UI components', `${slug(stateSelector)}/color`)) || K.find('UI components', `${slug(selector)}/color`);
        if (fg) label.bindings['fills.0.color'] = fg.id;
        K.bind(label, 'fontWeight', 'UI components', `${slug(selector)}/font-weight`);
        K.bind(label, 'fontSize', 'UI components', `${slug(selector)}/font-size`);
        if (selector.startsWith('.btn') || selector === '.rail-badge') { label.textAlign = 'center'; label.autoResize = 'fixed'; label.w = Math.max(1, node.w-16); label.h = 18; }
        if (['.icon-btn', '.rail-btn', '.tb-btn'].includes(selector)) {
          label.text = '+'; delete label.bindings.typography; label.fontSize = 20; label.w = node.w; label.x = 0; label.y = (h-24)/2; label.autoResize = 'fixed'; label.textAlign = 'center';
        }
        if (selector === '.rail-badge') { label.text = '1'; label.w = node.w; label.x = 0; label.autoResize = 'fixed'; }
        node.children = [label];
        if (selector === '.select') {
          label.text = 'Select an option';
          const chevron = K.text('⌄', node.w - 22, (h - 18) / 2, 'Chevron');
          K.bind(chevron, 'fills.0.color', 'Interface', 'color/muted');
          node.children.push(chevron);
        }
        if (selector === '.menu') {
          node.children = ['Copy', 'Paste', 'Duplicate', 'Delete'].map((value, i) => {
            const t = K.text(value, 10, 8+i*30); t.bindings['fills.0.color'] = fg.id; return t;
          });
        }
        if (selector === '.seg') {
          node.children = ['Left', 'Center', 'Right'].map((value, i) => K.text(value, 8+i*66, 7));
        }
        if (selector === '.check-row') {
          const box = createNode('rect', { name: 'Checkbox', x: 0, y: 5, w: 14, h: 14, radius: 3, fills: [makePaint('#FFFFFF')], strokes: [makePaint('#E6E6E6')] });
          K.bind(box, 'strokes.0.color', 'Interface', 'color/border'); label.x = 20; node.children.unshift(box);
        }
        node.props = { label: { name: 'Label', type: 'text', default: name } }; label.propRefs = { text: 'label' }; node.props.label.default = label.text;
        if (['.icon-btn', '.rail-btn', '.tb-btn'].includes(selector)) {
          const icon = createNode('icon', { name: 'Add', iconId: sampleIconId('plus'), x: (node.w-16)/2, y: (h-16)/2, w: 16, h: 16, fills: [makePaint('#1E1E1E')] });
          icon.bindings = { 'fills.0.color': fg?.id || K.find('Interface', 'color/text').id }; node.children = [icon];
        }
        if (['.menu', '.seg', '.icon-btn', '.rail-btn', '.tb-btn'].includes(selector)) delete node.props;
        if (selector.startsWith('.btn') && !rule.width) {
          const padding = (rule.padding || '0 12px').split(/\s+/).map(value => parseFloat(value) || 0);
          const horizontal = padding[1] ?? padding[0];
          label.autoResize = 'width';
          node.sizingH = 'hug';
          node.layout = { mode:'horizontal', gap:0, pt:0, pb:0, pl:horizontal, pr:horizontal, spacing:'packed', alignP:'center', alignC:'center' };
        }
        return node;
      });
      const padding = 16, gap = 24;
      const width = components.reduce((sum, component) => sum + component.w, 0) + gap * Math.max(0, components.length - 1) + padding * 2;
      const height = Math.max(...components.map(component => component.h)) + padding * 2;
      const set = createNode('componentSet', { name: `${name} · ${mi === 0 ? 'Current page mode' : 'Dark reference'}`, x: 0, y: 100, w: width, h: height, sizingH:'hug', sizingV:'hug', layout:{ mode:'horizontal', gap, pt:padding, pr:padding, pb:padding, pl:padding, spacing:'packed', alignP:'start', alignC:'center' }, fills: [], clip: false, children: components, variantProps: { State: variants }, ...(mi === 0 ? {} : { modes:Object.fromEntries(collections.map(c => [c.id, c.modes.find(m => m.name === mode).id])) }) });
      return set;
    });
    sets[1].y = sets[0].y + sets[0].h + 64;
    const background = createNode('rect', { name:'Specimen background', x:-24, y:-24, w:Math.max(600, ...sets.map(set => set.w + 48)), h:sets[1].y + sets[1].h + 48, fills:[makePaint('#F5F5F5')] });
    K.bind(background, 'fills.0.color', 'Interface', 'color/canvas');
    return K.page(name, [background, K.text(name, 0, 0, 'heading'), K.text(`Source: styles.css ${selector} · Page mode above; Dark reference below.`, 0, 38), ...sets], 'Light');
  });
  return { name: 'Components', pages, currentPageId: pages[0].id };
}
