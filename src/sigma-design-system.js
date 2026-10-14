// Sigma's welcome library. Light values and component geometry are extracted from styles.css;
// Both appearance palettes come from the CSS used by Sigma’s interface.
import { sigmaIconId } from './sample-icons.js';
import { cssNumber, cssPadding, cssShadow } from './sigma-css.js';
import { UI_SOURCE } from './sigma-ui-source.js';
import { collection, group, token, modes, ref } from './sample-tokens.js';
import { normalizeGroups } from './token-groups.js';
import { createNode, uid, makePaint } from './store.js';

export const SIGMA_SYSTEM_VERSION = 15;
const dark = Object.fromEntries(Object.entries(UI_SOURCE.dark).filter(([key])=>key.startsWith('--')).map(([key,value])=>[key.slice(2),value]));
const slug = s => s.replace(/^\./, '').replace(/[^\w-]+/g, '-');
const px = cssNumber;
const hex = s => { const m = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(s || ''); return m ? `#${m[1].length === 3 ? [...m[1]].map(x => x+x).join('') : m[1]}`.toUpperCase() : null; };
const labels = { '.btn': 'Button', '.btn.primary': 'Primary button', '.btn.primary.destructive': 'Destructive button', '.icon-btn': 'Icon button', '.rail-btn': 'Rail button', '.tb-btn': 'Toolbar button', '.field': 'Input field', '.select': 'Select', '.seg': 'Segmented control', '.seg-item':'Segmented item', '.page-row': 'Page row', '.page-group': 'Page group', '.layer-row': 'Layer row', '.menu': 'Dropdown menu', '.menu-item': 'Dropdown item', '.panel-head': 'Panel heading', '.file-name': 'File name', '.preset': 'Preset', '.check-row': 'Checkbox row', '.rail-badge': 'Rail badge' };

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
  for (const value of [...new Set([...UI_SOURCE.palette,'#888888'].map(hex).filter(Boolean))]) token(colors, palette, value.slice(1).toLowerCase(), 'color', value, 'Literal color used in styles.css; fixed in both modes.');
  const foundations = collection('Foundations', ['Light', 'Dark']);
  const foundationIds={};
  const styles=[['interface',11,400],['label',11,500],['heading',12,600],['badge',9,600]];
  const sourceRules=Object.values(UI_SOURCE.rules);
  const font=UI_SOURCE.root['font-family'].split(',')[0].trim();
  const fontId=token(foundations,null,'font-family','string',font,'Sigma interface font.');
  for(const [name,properties,extras] of [
    ['spacing',['padding','padding-top','padding-right','padding-bottom','padding-left','gap'],[0,8,16,24]],
    ['radius',['border-radius'],[3,5]],['height',['height','min-height'],[12,14,16,24,28,30]],
    ['width',['width'],[8,12,14,16,20,200]],['font-size',['font-size'],styles.map(s=>s[1])],
    ['font-weight',['font-weight'],styles.map(s=>s[2])],
  ]) {
    const g=group(foundations,name);
    const values=new Set(extras);
    for(const rule of UI_SOURCE.foundations.concat(sourceRules)) for(const property of properties) {
      for(const part of (rule[property]||'').split(/\s+/)) {
        const value=property==='font-weight'&&/^\d+$/.test(part)?+part:px(part);
        if(value!==null) values.add(value);
      }
    }
    for(const value of [...values].sort((a,b)=>a-b)) foundationIds[`${name}/${value}`]=token(foundations,g,String(value),'number',value,`Sigma ${name} used by styles.css.`);
  }
  const typeGroup=group(foundations,'typography');
  for(const [name,size,weight] of styles) token(foundations,typeGroup,name,'typography',{
    fontFamily:ref(fontId),fontSize:ref(foundationIds[`font-size/${size}`]),fontWeight:ref(foundationIds[`font-weight/${weight}`]),lineHeight:null,letterSpacing:0,
  },'Sigma UI text style; aliases the shared font scale.');
  token(foundations,null,'rail-width','number',px(UI_SOURCE.root['--rail-w']),'styles.css :root --rail-w.');
  const elevation=group(foundations,'elevation'), shadows=new Map();
  for(const value of new Set(UI_SOURCE.foundations.concat(sourceRules).map(r=>r['box-shadow']).filter(Boolean))) {
    const shadow=cssShadow(value);if(!shadow) continue;
    const colorRef=/var\(--([\w-]+)\)/.exec(shadow.color);if(colorRef&&ids[colorRef[1]]) shadow.color=ref(ids[colorRef[1]]);
    shadows.set(value,token(foundations,elevation,`shadow-${shadows.size+1}`,'shadow',shadow,`styles.css box-shadow: ${value}.`));
  }
  const components=collection('UI components',['Light','Dark']);
  for(const [selector,rule] of Object.entries(UI_SOURCE.rules)) {
    const g=group(components,slug(selector));
    for(const [property,value] of Object.entries(rule)) {
      let type,light,alternate;
      const variable=/var\(--([\w-]+)\)/.exec(value);
      if(property==='box-shadow' && shadows.has(value)) {type='shadow';light=alternate=ref(shadows.get(value));}
      else if(variable && ids[variable[1]] && ['background','color','border-color','border'].includes(property)) {type='color';light=alternate=ref(ids[variable[1]]);}
      else if(['background','border-color','border'].includes(property) && value.includes('transparent')) {type='color';light=alternate='#00000000';}
      else if(hex(value)) {type='color';light=hex(value);alternate=light;}
      else if(property==='opacity' && /^\d*(?:\.\d+)?$/.test(value)) {type='number';light=alternate=+value;}
      else {
        const number=property==='font-weight'&&/^\d+$/.test(value)?+value:px(value);
        if(number===null) continue;
        const scale=property.startsWith('padding')||property==='gap'?'spacing':property==='border-radius'?'radius':property==='height'||property==='min-height'?'height':property==='width'?'width':property;
        type='number';light=alternate=foundationIds[`${scale}/${number}`]?ref(foundationIds[`${scale}/${number}`]):number;
      }
      token(components,g,property,type,modes(light,alternate),`styles.css ${selector}: ${property}: ${value}.`);
    }
    const ring=/^(\d+(?:\.\d+)?)px\s+solid\s+var\(--([\w-]+)\)/.exec(rule.outline||'');
    if(ring&&ids[ring[2]]) token(components,g,'focus-ring','shadow',{color:ref(ids[ring[2]]),x:0,y:0,blur:0,spread:+ring[1]+(px(rule['outline-offset'])||0)},'CSS focus outline and offset.');
    const padding=cssPadding(rule);
    if(rule.padding && padding) {
      token(components,g,'padding-y','number',ref(foundationIds[`spacing/${padding[0]}`]));
      token(components,g,'padding-x','number',ref(foundationIds[`spacing/${padding[3]}`]));
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
      const fixed=Object.fromEntries(collections.map(c=>[c.id,c.modes.find(m=>m.name===mode).id]));
      const value = v.valuesByMode[c.modes[0].id];
      children.push(K.text(v.name, 0, y));
      if (v.type === 'typography') {
        const specimen=K.bind(K.text('Sigma · The quick brown fox',290,y),'typography',c.name,v.name);specimen.modes=fixed;children.push(specimen);
        return;
      }
      if (v.type === 'string') { const specimen=K.bind(K.text(value,290,y),'text',c.name,v.name);specimen.modes=fixed;children.push(specimen);return; }
      const n = createNode('rect', { name: v.name, x: 290, y, w: 160, h: 28, fills: [makePaint('#0D99FF')] });
      n.modes=fixed;
      K.bind(n, 'fills.0.color', 'Interface', 'color/accent');
      if (v.type === 'color') K.bind(n, 'fills.0.color', c.name, v.name);
      else if (v.type === 'shadow') {
        n.radius = 5;
        n.effects = [{ type: 'drop-shadow', color: '#000000', opacity: 0.25, x: 0, y: 4, blur: 16, spread: 0, visible: true }];
        K.bind(n, 'fills.0.color', 'Interface', 'color/panel'); K.bind(n, 'effects.0', c.name, v.name);
      } else {
        K.bind(n, v.name.startsWith('radius/') ? 'radius' : v.name.startsWith('height/') ? 'h' : 'w', c.name, v.name);
        const valueLabel=K.text(String(value),480,y);valueLabel.modes=fixed;K.bind(valueLabel,'text',c.name,v.name);children.push(valueLabel);
      }
      children.push(n);
    });
    const fixed=Object.fromEntries(collections.map(c=>[c.id,c.modes.find(m=>m.name===mode).id]));
    const reference=createNode('frame',{name:`${mode} reference`,x:-16,y:74,w:640,h:variables.length*54+40,modes:fixed,clip:false,children:children.splice(2),fills:[makePaint('#F5F5F5')]});
    for(const child of reference.children) {child.x+=16;child.y-=74;}
    K.bind(reference,'fills.0.color','Interface','color/canvas');children.push(reference);
    return {...K.page(name,children,mode),group:mode};
  }));
  return { name: 'Foundations', pages, currentPageId: pages[0].id };
}

export function sigmaComponentsDocument(collections) {
  const K = kit(collections);
  const pages = Object.entries(labels).filter(([selector]) => UI_SOURCE.rules[selector]).map(([selector, name]) => {
    const selectorFor = state => state==='Default'?selector:`${selector}${state==='Hover'?':hover':state==='Focus'?':focus':state==='Disabled'?'.disabled':UI_SOURCE.rules[`${selector}.active`]?'.active':'.selected'}`;
    const variants=['Default','Hover','Focus','Selected','Disabled'].filter(state=>state==='Default'||UI_SOURCE.rules[selectorFor(state)]);
    const sets = ['Light', 'Dark'].map((mode, mi) => {
      const components = variants.map((state, si) => {
        const base = UI_SOURCE.rules[selector];
        const stateSelector=selectorFor(state);
        const rule = { ...(selector.startsWith('.btn') ? UI_SOURCE.rules['.btn'] : {}), ...base, ...(state === 'Default' ? {} : UI_SOURCE.rules[stateSelector]) };
        const h = px(rule.height) || (selector === '.menu' ? 128 : selector === '.seg' ? 28 : 30);
        const node = createNode('component', { name: `State=${state}`, x: si * 240, y: 0, w: px(rule.width) || 200, h, radius: px(rule['border-radius']) || 0, fills: [makePaint('#00000000')], children: [], description: `${name}, ${state}. Source: styles.css ${selector}.`, codeName: slug(selector) });
        const apply = (prop, cssProperty, fallback) => {
          const sourceSelector = state !== 'Default' && K.find('UI components', `${slug(stateSelector)}/${cssProperty}`) ? stateSelector : selector;
          if (K.find('UI components', `${slug(sourceSelector)}/${cssProperty}`)) K.bind(node, prop, 'UI components', `${slug(sourceSelector)}/${cssProperty}`);
          else if (fallback) K.bind(node, prop, 'Interface', `color/${fallback}`);
        };
        apply('fills.0.color', 'background'); apply('h', 'height'); apply('w', 'width'); apply('radius', 'border-radius');apply('opacity','opacity');
        if(cssShadow(rule['box-shadow'])) {node.effects=[{type:'drop-shadow',visible:true}];apply('effects.0','box-shadow');}
        if (rule.border && rule.border !== '0') { node.strokes = [makePaint('#E6E6E6')]; apply('strokes.0.color',rule['border-color']?'border-color':'border','border'); }
        if(K.find('UI components',`${slug(stateSelector)}/focus-ring`)) {node.effects=[{type:'drop-shadow',visible:true}];K.bind(node,'effects.0','UI components',`${slug(stateSelector)}/focus-ring`);}
        const label = K.text(selector === '.file-name' ? 'Untitled' : name, px(rule['padding-left']) || 8, Math.max(0, (h-14)/2), 'label');
        const fg = (state !== 'Default' && K.find('UI components', `${slug(stateSelector)}/color`)) || K.find('UI components', `${slug(selector)}/color`);
        if (fg) label.bindings['fills.0.color'] = fg.id;
        K.bind(label, 'fontWeight', 'UI components', `${slug(selector)}/font-weight`);
        K.bind(label, 'fontSize', 'UI components', `${slug(selector)}/font-size`);
        if (selector.startsWith('.btn') || selector === '.rail-badge') { label.textAlign = 'center'; label.autoResize = 'fixed'; label.w = Math.max(1, node.w-16); label.h = 18; }
        if (['.icon-btn', '.rail-btn', '.tb-btn','.seg-item'].includes(selector)) {
          label.text = '+'; delete label.bindings.typography; label.fontSize = 20; label.w = node.w; label.x = 0; label.y = (h-24)/2; label.autoResize = 'fixed'; label.textAlign = 'center';
        }
        if (selector === '.rail-badge') { label.text = '1'; label.w = node.w; label.x = 0; label.autoResize = 'fixed'; }
        node.children = [label];
        if(selector==='.select') {
          label.text='Select an option';
          const chevron=createNode('icon',{name:'Select chevron',iconId:sigmaIconId('selectChevron'),x:node.w-20,y:(h-12)/2,w:12,h:12,fills:[makePaint('#888888')]});
          // The app's native-select arrow is fixed gray in both appearances.
          K.bind(chevron,'fills.0.color','Interface','palette/888888');
          node.children.push(chevron);
        }
        if(selector==='.check-row') {
          const box=createNode('rect',{name:'Checkbox',x:0,y:5,w:14,h:14,radius:3,fills:[makePaint('#FFFFFF')],strokes:[makePaint('#E6E6E6')]});
          K.bind(box,'fills.0.color','Interface','color/panel');K.bind(box,'strokes.0.color','Interface','color/border');
          K.bind(box,'w','Foundations','width/14');K.bind(box,'h','Foundations','height/14');K.bind(box,'radius','Foundations','radius/3');
          label.x=20;node.children.unshift(box);
        }
        node.props = { label: { name: 'Label', type: 'text', default: name } }; label.propRefs = { text: 'label' }; node.props.label.default = label.text;
        if (['.icon-btn', '.rail-btn', '.tb-btn','.seg-item'].includes(selector)) {
          const icon = createNode('icon', { name: 'Add', iconId:sigmaIconId(selector==='.seg-item'?'alignLeft':'plus'), x: (node.w-16)/2, y: (h-16)/2, w: 16, h: 16, fills: [makePaint('#1E1E1E')] });
          icon.bindings={'fills.0.color':fg?.id||K.find('Interface','color/text').id};
          K.bind(icon,'w','Foundations','width/16');K.bind(icon,'h','Foundations','height/16');
          node.children=[icon];node.props={icon:{name:'Icon',type:'icon',default:icon.iconId}};icon.propRefs={iconId:'icon'};
        }
        if(['.menu','.seg'].includes(selector)) delete node.props;
        const padding=cssPadding(rule)||[0,0,0,0];
        if(!['.select','.menu','.seg'].includes(selector)) {
          node.layout={mode:'horizontal',gap:px(rule.gap)||0,pt:padding[0],pr:padding[1],pb:padding[2],pl:padding[3],spacing:'packed',alignP:selector.startsWith('.btn')?'center':'start',alignC:'center'};
          for(const [prop,css] of [['pt','padding-top'],['pr','padding-right'],['pb','padding-bottom'],['pl','padding-left'],['gap','gap']]) apply(`layout.${prop}`,css);
          if(selector.startsWith('.btn')&&!rule.width) {label.autoResize='width';node.sizingH='hug';}
          if(['.icon-btn','.rail-btn','.tb-btn','.seg-item'].includes(selector)) node.layout.alignP='center';
        }
        if(selector==='.select') {
          // Reserve the right padding for the CSS background arrow, while the
          // label and arrow remain editable native layers.
          node.layout={mode:'horizontal',gap:0,pt:0,pb:0,pl:padding[3],pr:padding[1],spacing:'packed',alignP:'start',alignC:'center'};
          apply('layout.pl','padding-left');apply('layout.pr','padding-right');
          node.children[1].absolute=true;
          node.children[1].constraints={horizontal:'right',vertical:'center'};
        }
        return node;
      });
      const padding = 16, gap = 24;
      const width = components.reduce((sum, component) => sum + component.w, 0) + gap * Math.max(0, components.length - 1) + padding * 2;
      const height = Math.max(...components.map(component => component.h)) + padding * 2;
      const set = createNode('componentSet', { name: `${name} · ${mi === 0 ? 'Current page mode' : 'Dark reference'}`, x: 0, y: 100, w: width, h: height, sizingH:'hug', sizingV:'hug', layout:{ mode:'horizontal', gap, pt:padding, pr:padding, pb:padding, pl:padding, spacing:'packed', alignP:'start', alignC:'center' }, fills: [], clip: false, children: components, props:components[0].props?structuredClone(components[0].props):undefined, variantProps: { State: variants }, ...(mi === 0 ? {} : { modes:Object.fromEntries(collections.map(c => [c.id, c.modes.find(m => m.name === mode).id])) }) });
      return set;
    });
    sets[1].y = sets[0].y + sets[0].h + 64;
    const background = createNode('rect', { name:'Specimen background', x:-24, y:-24, w:Math.max(600, ...sets.map(set => set.w + 48)), h:sets[1].y + sets[1].h + 48, fills:[makePaint('#F5F5F5')] });
    K.bind(background, 'fills.0.color', 'Interface', 'color/canvas');
    return K.page(name, [background, K.text(name, 0, 0, 'heading'), K.text(`Source: styles.css ${selector} · Page mode above; Dark reference below.`, 0, 38), ...sets], 'Light');
  });
  const setsFor=name=>pages.find(p=>p.name===name)?.children.filter(n=>n.type==='componentSet');
  const instance=(main,label,extra={})=>createNode('instance',{name:label,componentId:main.id,w:main.w,h:main.h,children:[],overrides:{'':{sizingH:'fill'}},propValues:{label,...extra},sizingH:'fill'});
  for(const [name,itemName,values,mode] of [['Dropdown menu','Dropdown item',['Copy','Paste','Duplicate','Delete'],'vertical'],['Segmented control','Segmented item',['Left','Center','Right'],'horizontal']]) {
    const sets=setsFor(name),items=setsFor(itemName);
    for(let i=0;i<(sets?.length||0);i++) for(const main of sets[i].children) {
      const base=items[i].children.find(n=>n.name==='State=Default');
      main.children=values.map((value,j)=>instance(itemName==='Segmented item'&&j===1?items[i].children.find(n=>n.name==='State=Selected')||base:base,value,itemName==='Segmented item'?{icon:sigmaIconId(['alignLeft','alignHCenter','alignRight'][j])}:{}));
      main.layout={mode,gap:0,pt:0,pr:0,pb:0,pl:0,spacing:'packed',alignP:'start',alignC:'center'};
      const selector=name==='Dropdown menu'?'.menu':'.seg';
      for(const [prop,side] of [['pt','top'],['pr','right'],['pb','bottom'],['pl','left']]) K.bind(main,`layout.${prop}`,'UI components',`${slug(selector)}/padding-${side}`);
      if(mode==='vertical') main.sizingV='hug';
    }
  }
  return { name:'Components',pages,currentPageId:pages[0].id };
}

// Compare token content by semantic names rather than generated IDs.
export function sigmaTokenSignature(collections) {
  const names=new Map(collections.flatMap(c=>c.variables.map(v=>[v.id,`${c.name}/${v.name}`])));
  const normalize=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(normalize):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='alias'?names.get(v)||v:normalize(v)])):value;
  return JSON.stringify(collections.map(c=>({name:c.name,modes:c.modes.map(m=>m.name),tokens:c.variables.map(v=>({name:v.name,type:v.type,values:c.modes.map(m=>normalize(v.valuesByMode[m.id]))}))})));
}
