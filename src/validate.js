// Checks Sigma project files (docs/schema/README.md) and says what's wrong in words an agent or a person can
// act on: "token color/primary points at a token that doesn't exist (v9)". No DOM: runs in the browser and
// in Node (tools/validate.js).
//
//   validateProject({ [path]: file })  every file, with links between them checked
//   validateFile(file, { path, files }) one file (`files` gives the files it uses)
// Each returns [{ file, at, level: 'error' | 'warning', message }].
import { FORMAT } from './project-format.js';
import { VAR_TYPES, typeForPath, COMPOSITE_FIELDS, parseEasing } from './variables.js';
import { parseSVGIcon } from './icon-library.js';

const BREAKPOINT_KEYS = ['mode', 'gap', 'spacing', 'pt', 'pr', 'pb', 'pl', 'alignP', 'alignC'];
const A11Y_KEYS = ['alt', 'decorative', 'label', 'role', 'heading', 'focus'];
const NODE_TYPES = ['frame', 'group', 'rect', 'ellipse', 'line', 'text', 'image', 'component', 'componentSet', 'instance', 'icon'];
const CONTAINERS = new Set(['frame', 'group', 'component', 'componentSet']);
const PROP_TYPES = { boolean: 'visible', text: 'text', instance: 'componentId', slot: 'slot', icon: 'iconId' };
const ICON_STYLES = ['outline', 'filled'];
const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const isAlias = (v) => !!v && typeof v === 'object' && typeof v.alias === 'string';
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// The kind of value each token type holds (a value or { alias: tokenId } of the same type).
function checkValue(type, value, say) {
  if (isAlias(value)) return;
  if (COMPOSITE_FIELDS[type]) {
    if (!value || typeof value !== 'object') return say(`should be a ${type} object (${Object.keys(COMPOSITE_FIELDS[type]).join(', ')})`);
    for (const [f, ft] of Object.entries(COMPOSITE_FIELDS[type])) {
      if (value[f] === undefined || isAlias(value[f])) continue;
      if (f === 'lineHeight' && value[f] === null) continue;
      checkValue(ft, value[f], (m) => say(`field ${f} ${m}`));
    }
    return;
  }
  if (type === 'color' && !(typeof value === 'string' && HEX.test(value))) return say(`should be a color like "#0D99FF" or "#0D99FF80", not ${JSON.stringify(value)}`);
  if ((type === 'number' || type === 'duration') && !num(value)) return say(`should be a number, not ${JSON.stringify(value)}`);
  if (type === 'duration' && value < 0) return say('should be 0 or more milliseconds');
  if (type === 'string' && typeof value !== 'string') return say(`should be text, not ${JSON.stringify(value)}`);
  if (type === 'boolean' && typeof value !== 'boolean') return say(`should be true or false, not ${JSON.stringify(value)}`);
  if (type === 'easing' && !parseEasing(value)) return say('should be a cubic Bézier curve [x1, y1, x2, y2] with x1 and x2 between 0 and 1');
}

// The Sigma Tokens files a file can use: its own and, in turn, the ones those use. [{ path, file }]
function tokenFilesOf(file, files, seen = new Set()) {
  const out = [];
  for (const p of file.uses?.tokens || []) {
    if (seen.has(p) || !files[p]) continue;
    seen.add(p);
    out.push({ path: p, file: files[p] }, ...tokenFilesOf(files[p], files, seen));
  }
  return out;
}

export function validateFile(file, { path = '(file)', files = {} } = {}) {
  const issues = [];
  const add = (level, at, message) => issues.push({ file: path, at, level, message });
  const error = (at, m) => add('error', at, m);
  const warn = (at, m) => add('warning', at, m);
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    error('', 'is not a JSON object');
    return issues;
  }
  if (file.format !== FORMAT) {
    if (typeof file.format === 'number' && file.format > FORMAT) warn('format', `is ${file.format}; this Sigma reads format ${FORMAT}`);
    else error('format', `should be ${FORMAT}`);
  }
  if (!['tokens', 'icons', 'design'].includes(file.kind)) error('kind', 'should be "tokens", "icons" or "design"');
  if (typeof file.name !== 'string' || !file.name.trim()) error('name', 'should be the file’s name');

  // ---------- uses ----------
  const wants = { tokens: 'tokens', icons: 'icons', components: 'design' };
  for (const [key, list] of Object.entries(file.uses || {})) {
    if (!wants[key]) {
      error(`uses.${key}`, 'unknown: use "tokens", "icons" or "components"');
      continue;
    }
    if (!Array.isArray(list)) {
      error(`uses.${key}`, 'should be a list of project paths');
      continue;
    }
    if (file.kind !== 'design' && key !== 'tokens') error(`uses.${key}`, `a ${file.kind} file can only use Sigma Tokens files`);
    list.forEach((p, i) => {
      const at = `uses.${key}[${i}]`;
      if (typeof p !== 'string') return error(at, 'should be a project path like ".sigma/tokens/core.sigma.json"');
      if (p === path) return error(at, 'is this file itself');
      const other = files[p];
      if (!other) return error(at, `${p} isn’t in the project`);
      if (other.kind !== wants[key]) error(at, `${p} is a ${other.kind} file, not ${wants[key]}`);
    });
  }

  // ---------- tokens ----------
  const tokens = new Map(); // id → { type, name, where }
  const localCols = Array.isArray(file.collections) ? file.collections : [];
  if (file.collections !== undefined && !Array.isArray(file.collections)) error('collections', 'should be a list of collections');
  if (file.kind === 'tokens' && !Array.isArray(file.collections)) error('collections', 'is missing (a Sigma Tokens file holds collections)');
  const used = tokenFilesOf(file, files);
  const colsById = new Map();
  for (const { path: p, file: f } of used) {
    for (const c of f.collections || []) {
      colsById.set(c.id, c);
      for (const v of c.variables || []) tokens.set(v.id, { type: v.type, name: v.name, where: p });
    }
  }
  localCols.forEach((c, ci) => {
    const at = `collections[${ci}]`;
    if (!c || typeof c !== 'object') return error(at, 'should be a collection object');
    if (typeof c.id !== 'string') error(`${at}.id`, 'is missing');
    else if (colsById.has(c.id)) error(`${at}.id`, `${c.id} is used by another collection`);
    colsById.set(c.id, c);
    for (const v of c.variables || []) {
      if (tokens.has(v.id) && tokens.get(v.id).where === path) error(`${at}`, `token id ${v.id} is used twice`);
      tokens.set(v.id, { type: v.type, name: v.name, where: path });
    }
  });
  localCols.forEach((c, ci) => {
    if (!c || typeof c !== 'object') return;
    const at = `collections[${ci}] (“${c.name}”)`;
    if (typeof c.name !== 'string' || !c.name) error(`collections[${ci}].name`, 'is missing');
    const modes = Array.isArray(c.modes) ? c.modes : [];
    if (!modes.length) error(`${at}.modes`, 'should list at least one mode, like [{ "id": "light", "name": "Light" }]');
    const modeIds = new Set(modes.map((m) => m?.id));
    if (modeIds.size !== modes.length) error(`${at}.modes`, 'has two modes with the same id');
    if (!modeIds.has(c.defaultModeId)) error(`${at}.defaultModeId`, `should be one of its modes (${[...modeIds].join(', ')})`);
    if (c.extends) {
      const parent = colsById.get(c.extends);
      if (!parent) error(`${at}.extends`, `points at collection ${c.extends}, which isn’t in this file or the files it uses`);
      else {
        const parentModes = new Set((parent.modes || []).map((m) => m.id));
        modes.forEach((m, mi) => {
          if (!parentModes.has(m.parentModeId)) error(`${at}.modes[${mi}].parentModeId`, `should be a mode of “${parent.name}”`);
        });
      }
      if (c.variables?.length) error(`${at}.variables`, 'an extension has no tokens of its own; put overrides in "overrides"');
      for (const [vid, byMode] of Object.entries(c.overrides || {})) {
        const t = tokens.get(vid);
        if (!t) {
          error(`${at}.overrides.${vid}`, 'overrides a token that doesn’t exist');
          continue;
        }
        for (const [mid, val] of Object.entries(byMode || {})) {
          if (!modeIds.has(mid)) error(`${at}.overrides.${vid}.${mid}`, 'is not a mode of this collection');
          checkValue(t.type, val, (m) => error(`${at}.overrides.${vid}.${mid}`, m));
        }
      }
      return;
    }
    const groups = Array.isArray(c.groups) ? c.groups : [];
    const groupIds = new Set(groups.map((g) => g?.id));
    groups.forEach((g, gi) => {
      if (g.parentId && !groupIds.has(g.parentId)) error(`${at}.groups[${gi}].parentId`, 'points at a group that doesn’t exist');
    });
    (c.variables || []).forEach((v, vi) => {
      const vat = `${at}.variables[${vi}] (“${v?.name}”)`;
      if (!v || typeof v !== 'object') return error(vat, 'should be a token object');
      if (typeof v.id !== 'string' || !v.id) error(`${vat}.id`, 'is missing');
      if (typeof v.name !== 'string' || !v.name) error(`${vat}.name`, 'is missing (a path like "color/blue/500")');
      if (!VAR_TYPES[v.type]) return error(`${vat}.type`, `should be one of ${Object.keys(VAR_TYPES).join(', ')}`);
      if (v.groupId && !groupIds.has(v.groupId)) error(`${vat}.groupId`, 'points at a group that doesn’t exist (or leave it out: the name’s path makes groups)');
      const byMode = v.valuesByMode || {};
      for (const m of modes) if (!(m.id in byMode)) warn(`${vat}.valuesByMode`, `has no value for mode “${m.name}”`);
      for (const [mid, val] of Object.entries(byMode)) {
        if (!modeIds.has(mid)) error(`${vat}.valuesByMode.${mid}`, 'is not a mode of this collection');
        checkValue(v.type, val, (m) => error(`${vat}.valuesByMode.${mid}`, m));
      }
      for (const other of v.contrastWith || []) if (!tokens.has(other)) warn(`${vat}.contrastWith`, `lists ${other}, which isn’t a token here`);
    });
  });
  // References: each points at a token that exists, of the right type, without going round in circles.
  const aliasOf = (val) => (isAlias(val) ? val.alias : null);
  const refs = new Map(); // id → [ids it points at]
  for (const c of localCols) {
    const each = (vid, val, type, at) => {
      const targets = [];
      const check = (x, t, where) => {
        const a = aliasOf(x);
        if (!a) return;
        const target = tokens.get(a);
        if (!target) return error(where, `points at token ${a}, which doesn’t exist in this file or the files it uses`);
        if (target.type !== t) error(where, `points at “${target.name}”, a ${target.type} token; it needs a ${t} token`);
        targets.push(a);
      };
      check(val, type, at);
      if (COMPOSITE_FIELDS[type] && val && typeof val === 'object' && !isAlias(val)) {
        for (const [f, ft] of Object.entries(COMPOSITE_FIELDS[type])) check(val[f], ft, `${at}.${f}`);
      }
      refs.set(vid, [...(refs.get(vid) || []), ...targets]);
    };
    (c.variables || []).forEach((v, vi) => {
      for (const [mid, val] of Object.entries(v.valuesByMode || {})) each(v.id, val, v.type, `collections “${c.name}”.variables[${vi}] (“${v.name}”).valuesByMode.${mid}`);
    });
    for (const [vid, byMode] of Object.entries(c.overrides || {})) {
      for (const [mid, val] of Object.entries(byMode || {})) each(vid, val, tokens.get(vid)?.type, `collections “${c.name}”.overrides.${vid}.${mid}`);
    }
  }
  const state = new Map();
  const cycle = (id, trail) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const loop = trail.slice(trail.indexOf(id)).concat(id).map((x) => tokens.get(x)?.name || x);
      error('collections', `tokens point at each other in a loop: ${loop.join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const t of refs.get(id) || []) cycle(t, [...trail, id]);
    state.set(id, 2);
  };
  for (const id of refs.keys()) cycle(id, []);

  // ---------- icons ----------
  if (file.kind === 'icons') {
    if (!Array.isArray(file.icons)) error('icons', 'is missing (a Sigma Icons file holds icons)');
    const ids = new Set();
    (file.icons || []).forEach((icon, i) => {
      const at = `icons[${i}] (“${icon?.name}”)`;
      if (!icon || typeof icon !== 'object') return error(at, 'should be an icon object');
      if (typeof icon.id !== 'string' || !icon.id) error(`${at}.id`, 'is missing');
      else if (ids.has(icon.id)) error(`${at}.id`, `${icon.id} is used by another icon`);
      ids.add(icon.id);
      if (typeof icon.name !== 'string' || !icon.name) error(`${at}.name`, 'is missing');
      if (!ICON_STYLES.includes(icon.style)) error(`${at}.style`, 'should be "outline" or "filled"');
      const vb = String(icon.viewBox || '').trim().split(/[\s,]+/).map(Number);
      if (vb.length !== 4 || vb.some((x) => !Number.isFinite(x)) || vb[2] <= 0 || vb[3] <= 0) error(`${at}.viewBox`, 'should be four numbers, like "0 0 24 24"');
      if (icon.strokeWidth !== undefined && !(num(icon.strokeWidth) && icon.strokeWidth >= 0)) error(`${at}.strokeWidth`, 'should be a number, 0 or more');
      if (typeof icon.body !== 'string' || !icon.body) return error(`${at}.body`, 'is missing (the icon’s shapes as SVG markup)');
      try {
        const clean = parseSVGIcon(`<svg viewBox="0 0 24 24">${icon.body}</svg>`).body;
        if (clean !== icon.body) warn(`${at}.body`, 'has markup Sigma removes on load (only plain shapes and their geometry are kept, colors become currentColor)');
      } catch (e) {
        error(`${at}.body`, `can’t be read: ${e.message}`);
      }
    });
  }

  // ---------- design ----------
  if (file.kind === 'design') {
    if (!Array.isArray(file.pages)) error('pages', 'is missing (a Sigma Design file has pages)');
    // Components this file can place: its own and those of the component libraries it uses.
    const components = new Map(); // id → { node, props }
    const iconIds = new Set();
    const addComponents = (pages, owner) => {
      const visit = (nodes, set) => {
        for (const n of nodes || []) {
          if (n?.type === 'componentSet') visit(n.children, n);
          else if (n?.type === 'component') components.set(n.id, { node: n, props: { ...(set?.props || {}), ...(n.props || {}) }, owner });
          if (n?.children && n.type !== 'componentSet') visit(n.children, null);
        }
      };
      for (const pg of pages || []) visit(pg.children, null);
    };
    addComponents(file.pages, path);
    for (const p of file.uses?.components || []) if (files[p]) addComponents(files[p].pages, p);
    for (const p of file.uses?.icons || []) for (const x of files[p]?.icons || []) iconIds.add(x.id);
    for (const p of file.uses?.components || []) {
      for (const ip of files[p]?.uses?.icons || []) for (const x of files[ip]?.icons || []) iconIds.add(x.id);
    }
    const nodeIds = new Set();
    const pageIds = new Set();
    const checkNode = (n, at, parent, comp) => {
      if (!n || typeof n !== 'object') return error(at, 'should be a layer object');
      const where = `${at} (“${n.name ?? n.type}”)`;
      if (typeof n.id !== 'string' || !n.id) error(`${where}.id`, 'is missing');
      else if (nodeIds.has(n.id)) error(`${where}.id`, `${n.id} is used by another layer`);
      nodeIds.add(n.id);
      if (!NODE_TYPES.includes(n.type)) return error(`${where}.type`, `should be one of ${NODE_TYPES.join(', ')}`);
      if (n.children !== undefined && !CONTAINERS.has(n.type)) {
        error(`${where}.children`, n.type === 'instance'
          ? 'an instance’s layers come from its main component; leave them out (overrides and property values change them)'
          : `a ${n.type} layer can’t have children`);
      }
      if (parent?.type === 'componentSet' && n.type !== 'component') error(where, 'a component set holds only components (its variants)');
      for (const k of ['x', 'y', 'w', 'h', 'rotation', 'opacity']) if (n[k] !== undefined && n[k] !== null && !num(n[k])) error(`${where}.${k}`, 'should be a number');
      for (const kind of ['fills', 'strokes']) {
        (n[kind] || []).forEach((p, i) => {
          if (p.color !== undefined && !HEX.test(p.color)) error(`${where}.${kind}[${i}].color`, `should be a color like "#0D99FF", not ${JSON.stringify(p.color)}`);
          if (p.color === undefined && !n.bindings?.[`${kind}.${i}.color`]) warn(`${where}.${kind}[${i}]`, 'has no color and no color token');
        });
      }
      for (const [bpath, vid] of Object.entries(n.bindings || {})) {
        const want = typeForPath(bpath);
        if (!want) {
          error(`${where}.bindings.${bpath}`, 'is not a property a token can set');
          continue;
        }
        const t = tokens.get(vid);
        if (!t) error(`${where}.bindings.${bpath}`, `uses token ${vid}, which isn’t in this file or the Sigma Tokens files it uses`);
        else if (t.type !== want) error(`${where}.bindings.${bpath}`, `uses “${t.name}”, a ${t.type} token; ${bpath} needs a ${want} token`);
      }
      for (const [prop, pid] of Object.entries(n.propRefs || {})) {
        if (!comp) {
          error(`${where}.propRefs`, 'only layers inside a main component can use component properties');
          break;
        }
        const def = comp.props[pid];
        if (!def) error(`${where}.propRefs.${prop}`, `uses property ${pid}, which “${comp.node.name}” doesn’t define`);
        else if (PROP_TYPES[def.type] !== prop) error(`${where}.propRefs.${prop}`, `property “${def.name}” is ${def.type}, which sets ${PROP_TYPES[def.type]}, not ${prop}`);
      }
      (n.layout?.breakpoints || []).forEach((bp, i) => {
        const at = `${where}.layout.breakpoints[${i}]`;
        if (!bp || typeof bp !== 'object') return error(at, 'should be an object like { "maxW": 600, "mode": "vertical" }');
        if (!(num(bp.maxW) && bp.maxW > 0)) error(`${at}.maxW`, 'should be a width in px (it applies at that width or narrower)');
        for (const k of Object.keys(bp)) if (!['maxW', ...BREAKPOINT_KEYS].includes(k)) error(`${at}.${k}`, `isn’t a layout value a breakpoint can change; use ${BREAKPOINT_KEYS.join(', ')}`);
        if (bp.mode !== undefined && !['horizontal', 'vertical'].includes(bp.mode)) error(`${at}.mode`, 'should be "horizontal" or "vertical"');
        for (const k of ['gap', 'pt', 'pr', 'pb', 'pl']) if (bp[k] !== undefined && !num(bp[k])) error(`${at}.${k}`, 'should be a number');
      });
      if (n.dir !== undefined && n.dir !== 'rtl' && n.dir !== 'ltr') error(`${where}.dir`, 'should be "rtl" or "ltr" (left out: the direction of the frame it’s in)');
      if (n.a11y !== undefined) {
        const a = n.a11y;
        if (!a || typeof a !== 'object' || Array.isArray(a)) error(`${where}.a11y`, 'should be an object of accessibility annotations');
        else {
          for (const k of Object.keys(a)) if (!A11Y_KEYS.includes(k)) error(`${where}.a11y.${k}`, `isn’t an annotation; use ${A11Y_KEYS.join(', ')}`);
          for (const k of ['alt', 'label', 'role']) if (a[k] !== undefined && typeof a[k] !== 'string') error(`${where}.a11y.${k}`, 'should be text');
          if (a.decorative !== undefined && typeof a.decorative !== 'boolean') error(`${where}.a11y.decorative`, 'should be true or false');
          if (a.heading !== undefined && !(Number.isInteger(a.heading) && a.heading >= 1 && a.heading <= 6)) error(`${where}.a11y.heading`, 'should be a heading level from 1 to 6');
          if (a.focus !== undefined && !(Number.isInteger(a.focus) && a.focus >= 1)) error(`${where}.a11y.focus`, 'should be a whole number from 1 (its place in the focus order)');
        }
      }
      if (n.type === 'icon') {
        if (!n.iconId) error(`${where}.iconId`, 'is missing');
        else if (!iconIds.has(n.iconId)) error(`${where}.iconId`, `${n.iconId} isn’t in the Sigma Icons files this file uses`);
        if (!comp) warn(where, 'icon layers go inside main components');
      }
      if (n.type === 'instance') {
        const main = components.get(n.componentId);
        if (!n.componentId) error(`${where}.componentId`, 'is missing');
        else if (!main) error(`${where}.componentId`, `${n.componentId} isn’t a component in this file or the component libraries it uses`);
        else {
          for (const [pid, val] of Object.entries(n.propValues || {})) {
            const def = main.props[pid];
            if (!def) warn(`${where}.propValues.${pid}`, `“${main.node.name}” has no such property`);
            else if (def.type === 'boolean' && typeof val !== 'boolean') error(`${where}.propValues.${pid}`, `“${def.name}” should be true or false`);
            else if (def.type === 'text' && typeof val !== 'string') error(`${where}.propValues.${pid}`, `“${def.name}” should be text`);
            else if (def.type === 'instance' && !components.has(val)) error(`${where}.propValues.${pid}`, `“${def.name}” should be a component id`);
            else if (def.type === 'icon' && !iconIds.has(val)) error(`${where}.propValues.${pid}`, `“${def.name}”: ${val} isn’t an icon this file can use`);
          }
        }
        for (const [k, entry] of Object.entries(n.slots || {})) (entry?.nodes || []).forEach((c, i) => checkNode(c, `${where}.slots.${k}[${i}]`, n, null));
      }
      const here = n.type === 'component' ? components.get(n.id) : comp;
      if (n.type === 'component' || n.type === 'componentSet') {
        for (const [pid, def] of Object.entries(n.props || {})) {
          const pat = `${where}.props.${pid} (“${def?.name}”)`;
          if (!PROP_TYPES[def?.type]) error(pat, `type should be one of ${Object.keys(PROP_TYPES).join(', ')}`);
          if (def?.type === 'icon' && def.default && !iconIds.has(def.default)) error(`${pat}.default`, `${def.default} isn’t an icon this file can use`);
          if (def?.type === 'instance' && def.default && !components.has(def.default)) error(`${pat}.default`, `${def.default} isn’t a component`);
        }
      }
      (n.children || []).forEach((c, i) => checkNode(c, `${where}.children[${i}]`, n, n.type === 'componentSet' ? null : here));
    };
    (file.pages || []).forEach((pg, pi) => {
      const at = `pages[${pi}] (“${pg?.name}”)`;
      if (!pg || typeof pg !== 'object') return error(at, 'should be a page object');
      if (typeof pg.id !== 'string' || !pg.id) error(`${at}.id`, 'is missing');
      else if (pageIds.has(pg.id)) error(`${at}.id`, `${pg.id} is used by another page`);
      pageIds.add(pg.id);
      if (pg.background !== undefined && !HEX.test(pg.background)) error(`${at}.background`, 'should be a color like "#F5F5F5"');
      if (pg.handoff !== undefined && pg.handoff !== true) error(`${at}.handoff`, 'should be true (a page marked for handoff), or left out');
      (pg.children || []).forEach((n, i) => checkNode(n, `${at}.children[${i}]`, null, null));
    });
    // Comments: on a page of this file, and (if on a layer) a layer that's still there.
    const commentIds = new Set();
    (file.comments || []).forEach((c, ci) => {
      const at = `comments[${ci}]`;
      if (!c || typeof c !== 'object') return error(at, 'should be a comment object');
      if (typeof c.id !== 'string' || commentIds.has(c.id)) error(`${at}.id`, 'should be a unique id');
      commentIds.add(c.id);
      if (typeof c.text !== 'string' || !c.text.trim()) error(`${at}.text`, 'is missing');
      if (!(file.pages || []).some((p) => p.id === c.pageId)) error(`${at}.pageId`, `${c.pageId} isn’t a page of this file`);
      if (c.nodeId && !nodeIds.has(c.nodeId)) warn(`${at}.nodeId`, `the layer it was on (${c.layer || c.nodeId}) isn’t there any more`);
      if (!c.at || !num(c.at.x) || !num(c.at.y)) error(`${at}.at`, 'should be { "x": …, "y": … }');
    });
  }
  return issues;
}

// Every file in a project: { [path]: file (object or JSON text) }.
export function validateProject(files) {
  const parsed = {};
  const issues = [];
  for (const [path, f] of Object.entries(files)) {
    if (typeof f !== 'string') parsed[path] = f;
    else {
      try {
        parsed[path] = JSON.parse(f);
      } catch (e) {
        issues.push({ file: path, at: '', level: 'error', message: `isn’t valid JSON: ${e.message}` });
      }
    }
  }
  for (const [path, f] of Object.entries(parsed)) issues.push(...validateFile(f, { path, files: parsed }));
  return issues;
}

// "file › at: message" lines, errors first.
export function formatIssues(issues) {
  return [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
    .map((i) => `${i.level === 'error' ? 'error' : 'warning'}  ${i.file}${i.at ? ` › ${i.at}` : ''}: ${i.message}`).join('\n');
}
