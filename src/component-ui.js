import {lucideIcon} from './lucide.js';
// Figma-style component UI in the right panel.
//
//   Main component / component set / variant: a header (name, description, ⋯), the variant's own values,
//     and a Properties section: variant properties first, then Boolean, Text and Instance swap ones.
//     "+" creates a property; clicking one opens the floating "Edit component property" window.
//   Instance: the component name (click to swap), ⋯ (Go to main component, Reset all changes, Detach),
//     and a control per property: dropdowns for variants (a toggle for true/false ones), toggles for
//     booleans, fields for text, pickers for instance swaps, then exposed nested instances.
//   Layers inside a main component get properties from the "Apply variable/property" button on
//     Visibility and Text content, and nested instances from "Apply instance swap property"; a bound
//     layer shows a purple pill (see propBinding / propMenuItems, used by panels.js).
import {
  state, getNode, getParent, ancestors, commit, select, editNode, emit, walk, worldBounds, subscribe, createNode, insertNode, detach, reindex,
  isSlotArea, isFrameLike,
} from './store.js';
import { findVariable, previewValue } from './variables.js';
import { openTokenPicker } from './token-picker.js';
import { nodeWorldSVG } from './render.js';
import {
  propsOf, propsHost, PROP_TYPES, addComponentProp, removeComponentProp, updateComponentProp, reorderComponentProp,
  bindLayerProp, setInstanceProp, isVariant, variantsOf, variantDefs, parseVariantName, switchVariant, renameVariantProperty,
  setVariantValue, toggleValues, defaultVariant, variantConflicts, renameVariantValue, reorderVariantValues,
  reorderVariantProperty, removeVariantProperty, addVariantProperty, containingComponent, mainComponentOf, displayName,
  instancesOf, overrideCount, orphanedOverrides, clearOrphanedOverrides, isInsideInstance, owningInstance, listComponents,
  canPlaceInside, nestedInstances, layersUsingProp, libraryOfComponent, setPropDefaultVar, pushOverridesToMain, syncInstances,
  slotDef, slotLimits, isSlotModified, resetSlot, clearSlot, setSlot, insideMainSlot, createInstance, componentMatches,
  isDeprecated, setDeprecated, deprecationTarget,
} from './components.js';
import {
  addVariant, goToMainComponent, resetSelectionOverrides, detachSelection, duplicateSelection, makeComponentSet,
} from './commands.js';
import { showContextMenu } from './menu.js';
import { openDocsEditor, docsHTML, docsDisclosure, statusOf, statusLabel, STATUSES, docsTarget } from './component-docs.js';
import { icons } from './icons.js';
import { openIconPicker, availableIcons } from './icon-ui.js';
import { iconLibraries, loadIconLibraries } from './libraries.js';
import { findIcon, iconMarkup, iconGroups } from './icon-library.js';
import { ask, isAsking } from './dialogs.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (msg) => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: msg }));

// ---------- icons ----------
export const PROP_ICONS = {
  variant:lucideIcon('component',12),
  boolean:lucideIcon('toggle-right',12),
  text:lucideIcon('type',12),
  instance:lucideIcon('replace',12),
  slot:lucideIcon('square-dashed',12),
  icon:lucideIcon('shapes',12),
};
// A button showing an icon and its name, which opens the icon picker.
const iconChoice = (id, attrs, mixed = false) => {
  const icon = !mixed && findIcon(id);
  return `<button class="select swap-btn icon-choice" ${attrs}><span class="icon-choice-glyph">${icon ? iconMarkup(icon, { w: 14, h: 14 }) : ''}</span>` +
    `<span class="swap-name">${mixed ? 'Mixed' : esc(icon ? icon.name : 'Choose an icon…')}</span>${CHEVRON}</button>`;
};
const COMPONENT_ICON = lucideIcon('component',12);
const INSTANCE_ICON = lucideIcon('diamond',12);
const SET_ICON = lucideIcon('layout-grid',12);
const EDIT_ICON = lucideIcon('pencil',12);
const SETTINGS_ICON = lucideIcon('sliders-horizontal',12);
const MORE_ICON = lucideIcon('ellipsis',12);
const RESET_ICON = lucideIcon('rotate-ccw',12);
const GRIP_ICON = lucideIcon('grip-vertical',10);
export const APPLY_PROP_ICON = lucideIcon('diamond-plus',12);
const CHEVRON = lucideIcon('chevron-down',8);

const section = (title, body, action = '', cls = '') =>
  `<div class="section ${cls}"><div class="section-title"><span>${title}</span>${action}</div>${body}</div>`;

// ---------- the panel ----------
// HTML for the component part of the right panel ('' when the selection has nothing to do with components).
export function componentPanel(nodes) {
  const single = nodes.length === 1 ? nodes[0] : null;
  if (!single) return multiInstancePanel(nodes);
  if (single.type === 'componentSet') return setPanel(single);
  if (isSlotArea(single)) return slotAreaPanel(single);
  if (isFrameLike(single) && single.type === 'frame' && containingComponent(single) && containingComponent(single) !== single) return slotFramePanel(single);
  if (single.type === 'component') return isVariant(single) ? variantPanel(single) : mainPanel(single);
  if (single.type === 'instance') {
    const comp = containingComponent(single);
    if (isInsideInstance(single)) return instancePanel(single, { nested: true });
    return instancePanel(single, { inComponent: comp });
  }
  return '';
}

function headActions(node) {
  return `<button class="icon-btn" data-comp-desc title="Edit description">${EDIT_ICON}</button>` +
    `<button class="icon-btn" data-comp-menu="${node.id}" title="More actions">${MORE_ICON}</button>`;
}

// A "Deprecated" tag after a component's name, and the note under it.
const deprecatedTag = (node) => (isDeprecated(node) ? '<span class="deprecated-tag" title="Hidden from Assets and the swap picker; existing instances keep working">Deprecated</span>'
  : `<span class="status-chip comp-status ${statusOf(node) === 'ready' ? 'ok' : ''}" title="Its status in the component matrix (main menu → Component status…)">${statusLabel(statusOf(node))}</span>`);
const deprecatedNote = (node) => (isDeprecated(node)
  ? '<div class="warn">Deprecated: it’s hidden from Assets and the swap picker so nothing new uses it. Instances keep working. Say what to use instead in the description.</div>' : '');

function description(node) {
  if (editingDescription === node.id) {
    return `<textarea class="desc comp-desc-edit" data-desc rows="3" placeholder="Describe this component…" spellcheck="false">${esc(node.description || '')}</textarea>`;
  }
  return docsDisclosure(node, { status: false }); // the status is the chip by the name
}
let editingDescription = null;

function mainPanel(comp) {
  const count = instancesOf(comp.id).length;
  const head = `<div class="comp-head"><span class="comp-icon">${COMPONENT_ICON}</span><span class="comp-name">${esc(comp.name)}</span>${deprecatedTag(comp)}${headActions(comp)}</div>`;
  return `<div class="section comp-panel">${head}${deprecatedNote(comp)}${description(comp)}` +
    `<div class="comp-meta">${count} instance${count === 1 ? '' : 's'}</div></div>` + propertiesSection(comp);
}

function setPanel(set) {
  const n = variantsOf(set).length;
  const head = `<div class="comp-head"><span class="comp-icon">${SET_ICON}</span><span class="comp-name">${esc(set.name)}</span>${deprecatedTag(set)}${headActions(set)}</div>`;
  return `<div class="section comp-panel">${head}${deprecatedNote(set)}${description(set)}` +
    `<div class="comp-meta">${n} variant${n === 1 ? '' : 's'}</div>${conflictNote(set)}</div>` + propertiesSection(set);
}

function conflictNote(set) {
  const conflicts = variantConflicts(set);
  if (!conflicts.length) return '';
  return `<div class="warn">${conflicts.length === 1 ? 'Two or more variants have' : `${conflicts.length} groups of variants have`} the same property values. ` +
    `Give each variant a unique combination: ${conflicts.map((g) => esc(g[0].name)).join('; ')}.</div>`;
}

// A selected variant: its own values (editing one renames the variant), then the set's properties.
function variantPanel(variant) {
  const set = getParent(variant.id);
  const defs = variantDefs(set);
  const own = parseVariantName(variant.name);
  const rows = Object.entries(defs).map(([prop, values]) => {
    const id = `vv-${btoa(unescape(encodeURIComponent(prop))).replace(/=/g, '')}`;
    return `<div class="inst-row"><span class="inst-label" title="${esc(prop)}">${esc(prop)}</span>` +
      `<input class="prop-input combo" list="${id}" data-variant-value="${esc(prop)}" value="${esc(own[prop] ?? '')}" spellcheck="false" title="Pick a value, or type a new one">` +
      `<datalist id="${id}">${values.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist></div>`;
  }).join('');
  const head = `<div class="comp-head"><span class="comp-icon">${COMPONENT_ICON}</span><span class="comp-name">${esc(set.name)}</span>${deprecatedTag(set)}` +
    `<button class="link-btn comp-up" data-select-node="${set.id}" title="Select the component set">Select set</button>${headActions(variant)}</div>`;
  return `<div class="section comp-panel">${head}${deprecatedNote(set)}${description(variant)}<div class="comp-sub">Variant values</div>${rows}${conflictNote(set)}<button class="link-btn" data-select-node="${set.id}">Edit component properties…</button><p class="muted prop-empty">Property definitions are shared by the component set. Configure this variant’s layer bindings on its children.</p></div>` + nestedSection(variant);
}

// ---------- Properties ----------
const TOKEN_TYPE = { boolean: 'boolean', text: 'string' };
const tokenName = (id) => findVariable(id)?.variable.name || 'Missing token';
// A property's default as shown: the token's value when it comes from one.
const effectiveDefault = (def) => (def.defaultVar && findVariable(def.defaultVar) ? previewValue(def.defaultVar) : def.default);

function valuePreview(def) {
  if (def.type === 'slot') return def.min != null || def.max != null ? `${def.min ?? 0}–${def.max ?? '∞'} layers` : 'Slot';
  if (def.defaultVar) return `<span class="token-ref">${esc(tokenName(def.defaultVar))}</span>`;
  if (def.type === 'boolean') return def.default ? 'True' : 'False';
  if (def.type === 'text') return `“${esc(def.default ?? '')}”`;
  if (def.type === 'icon') {
    const icon = findIcon(def.default);
    return icon ? `<span class="icon-choice-glyph">${iconMarkup(icon, { w: 12, h: 12 })}</span>${esc(icon.name)}` : '—';
  }
  const main = def.default && getNode(def.default);
  return main ? esc(displayName(main) + (isVariant(main) ? ` · ${main.name}` : '')) : '—';
}

function propertiesSection(comp) {
  const host = propsHost(comp);
  const rows = [];
  if (host.type === 'componentSet') {
    for (const [prop, values] of Object.entries(variantDefs(host))) {
      rows.push(`<div class="prop-row" draggable="true" tabindex="0" data-prop-row="v:${esc(prop)}" title="Click to edit · Delete removes it">` +
        `<span class="prop-grip">${GRIP_ICON}</span><span class="prop-icon variant">${PROP_ICONS.variant}</span>` +
        `<span class="prop-row-name">${esc(prop)}</span><span class="prop-row-value">${esc(values.join(', '))}</span>` +
        `<button class="icon-btn prop-edit" data-prop-edit="v:${esc(prop)}" title="Edit property">${SETTINGS_ICON}</button>` +
        `<button class="icon-btn prop-remove" data-prop-remove="v:${esc(prop)}" title="Delete property">${icons.minus}</button></div>`);
    }
  }
  for (const [pid, def] of Object.entries(propsOf(comp))) {
    rows.push(`<div class="prop-row" draggable="true" tabindex="0" data-prop-row="${pid}" title="Click to edit · Delete removes it">` +
      `<span class="prop-grip">${GRIP_ICON}</span><span class="prop-icon ${def.type}">${PROP_ICONS[def.type]}</span>` +
      `<span class="prop-row-name">${esc(def.name)}</span><span class="prop-row-value">${valuePreview(def)}</span>` +
      `<button class="icon-btn prop-edit" data-prop-edit="${pid}" title="Edit property">${SETTINGS_ICON}</button>` +
      `<button class="icon-btn prop-remove" data-prop-remove="${pid}" title="Delete property">${icons.minus}</button></div>`);
  }
  const empty = rows.length ? '' : '<div class="muted prop-empty">Define text, visibility, icon, swap and slot controls for instances.</div>';
  return section('Component properties',rows.join('')+empty,`<button class="icon-btn" data-prop-add title="Create component property">${icons.plus}</button>`)+nestedSection(comp);
}
function nestedSection(comp) {
  const nested=nestedInstances(comp);if(!nested.length){let hasNested=false;walk(comp.children||[],n=>{if(n.type==='instance'){hasNested=true;return false;}});return hasNested?section('Nested controls','<p class="muted prop-empty">No nested components with editable properties in this variant. Add properties to their main components to expose them here.</p>'):'';}
  const exposed=nested.filter(n=>n.exposed);
  return section('Nested controls',`<p class="muted prop-empty">Expose a nested component’s controls on instances of this ${comp.type==='componentSet'?'set':'variant'}. Layer bindings remain unchanged.</p>`+
    exposed.map(n=>`<div class="prop-row exposed"><span class="prop-icon instance">${INSTANCE_ICON}</span><span class="prop-row-name">${esc(exposureLabel(n,comp))}</span><span class="prop-row-value">Exposed</span><button class="icon-btn" data-unexpose="${n.id}" title="Stop exposing controls">${icons.minus}</button></div>`).join('')+
    '<button class="link-btn prop-expose" data-expose-menu>Expose nested controls…</button>');
}
function exposureLabel(n,comp) {
  const path=[...ancestors(n)].reverse();const start=path.indexOf(comp);
  return [...path.slice(start+1),n].map(x=>x.name).join(' / ');
}

// ---------- Instances ----------
function instancePanel(inst, { nested = false, inComponent = null } = {}) {
  const main = mainComponentOf(inst);
  const n = nested ? overrideCount(owningInstance(inst), inst.pathKey) : overrideCount(inst);
  const ref = inComponent && inst.propRefs?.componentId ? propsOf(inComponent)[inst.propRefs.componentId] : null;
  const name = main ? displayName(main) : inst.name;
  const head = `<div class="comp-head"><span class="comp-icon inst">${INSTANCE_ICON}</span>` +
    `<button class="inst-swap" data-swap-menu="${inst.id}" title="Swap instance">${esc(name)}${CHEVRON}</button>` +
    (inComponent ? (ref
      ? `<button class="prop-pill" data-swap-prop-menu="${inst.id}" title="Instance swap property">${PROP_ICONS.instance}${esc(ref.name)}</button>`
      : `<button class="icon-btn" data-swap-prop-menu="${inst.id}" title="Apply instance swap property">${APPLY_PROP_ICON}</button>`) : '') +
    (n ? `<button class="icon-btn" data-inst-reset="${inst.id}" title="Reset all changes">${RESET_ICON}</button>` : '') +
    `<button class="icon-btn" data-inst-menu="${inst.id}" title="More actions">${MORE_ICON}</button></div>`;
  const lib = main && libraryOfComponent(main);
  const sub = nested ? `<div class="comp-sub">In “${esc(owningInstance(inst).name)}”</div>` : lib ? `<div class="comp-sub">From ${esc(lib.name)}</div>` : '';
  const gone = main && isDeprecated(main)
    ? `<div class="warn">“${esc(name)}” is deprecated.${(deprecationTarget(main).description) ? ` ${esc(deprecationTarget(main).description)}` : ' Swap it for another component.'}</div>` : '';
  const body = main
    ? gone + instanceControls(inst, main) + exposedControls(inst)
    : '<div class="warn">The main component is missing. Detach the instance to keep editing it freely.</div>';
  return `<div class="section comp-panel inst-panel">${head}${sub}${body}${nested ? '' : orphanNote(inst)}</div>`;
}

// Several instances of the same component (or set): their shared properties, changed all at once.
function sameFamily(nodes) {
  const host = (n) => {
    const main = mainComponentOf(n);
    return main ? propsHost(main) : null;
  };
  const first = host(nodes[0]);
  return first && nodes.every((n) => n.type === 'instance' && !isInsideInstance(n) && host(n) === first) ? first : null;
}

function multiInstancePanel(nodes) {
  if (nodes.length < 2) return '';
  const family = sameFamily(nodes);
  if (!family) return '';
  const head = `<div class="comp-head"><span class="comp-icon inst">${INSTANCE_ICON}</span><span class="comp-name">${esc(family.name)}</span>` +
    `<span class="muted">${nodes.length} instances</span></div>`;
  return `<div class="section comp-panel inst-panel">${head}${instanceControls(nodes[0], mainComponentOf(nodes[0]), nodes)}</div>`;
}

function orphanNote(inst) {
  const orphans = orphanedOverrides(inst);
  if (!orphans.length) return '';
  return `<div class="warn orphan-note" title="${esc(orphans.join('\n'))}">${orphans.length} override${orphans.length === 1 ? '' : 's'} no longer appl${orphans.length === 1 ? 'ies' : 'y'}: ` +
    `the layers were renamed or removed in the main component. <button class="link-btn" data-clear-orphans="${inst.id}">Clear</button></div>`;
}

const toggle = (attrs, on) => `<label class="switch"><input type="checkbox" ${attrs} ${on ? 'checked' : ''}><span></span></label>`;

// One row per property. Controls carry data-target (one or more ids), so nested instances' rows work from
// an outer panel, and several selected instances change together. Differing values show as Mixed.
const MIXED = Symbol('mixed');
function instanceControls(inst, main, group = [inst]) {
  const tgt = `data-target="${group.map((n) => n.id).join(',')}"`;
  const shared = (fn) => {
    const vals = group.map(fn);
    return vals.every((x) => JSON.stringify(x) === JSON.stringify(vals[0])) ? vals[0] : MIXED;
  };
  const rows = [];
  if (isVariant(main)) {
    for (const [prop, values] of Object.entries(variantDefs(getParent(main.id)))) {
      const cur = shared((n) => parseVariantName(mainComponentOf(n)?.name || '')[prop]);
      const t = toggleValues(values);
      const control = t
        ? toggle(`${tgt} data-variant-toggle="${esc(prop)}" data-on="${esc(t.on)}" data-off="${esc(t.off)}"${cur === MIXED ? ' data-mixed' : ''}`, cur === t.on)
        : `<select class="select" ${tgt} data-variant-prop="${esc(prop)}">${cur === MIXED ? '<option selected disabled>Mixed</option>' : ''}` +
          `${values.map((v) => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
      rows.push(`<div class="inst-row"><span class="inst-label" title="${esc(prop)}">${PROP_ICONS.variant}${esc(prop)}</span>${control}</div>`);
    }
  }
  for (const [pid, def] of Object.entries(propsOf(main))) {
    const v = shared((n) => (n.propValues || {})[pid] ?? effectiveDefault(def));
    let control;
    if (def.type === 'slot') continue; // slots get their own rows below
    if (def.type === 'boolean') control = toggle(`${tgt} data-instance-prop="${pid}"${v === MIXED ? ' data-mixed' : ''}`, v === true);
    else if (def.type === 'text') control = `<input class="prop-input" ${tgt} data-instance-prop="${pid}" value="${v === MIXED ? '' : esc(v ?? '')}" placeholder="${v === MIXED ? 'Mixed' : ''}" spellcheck="false">`;
    else if (def.type === 'icon') control = iconChoice(v, `${tgt} data-prop-icon="${pid}"`, v === MIXED);
    else {
      const comp = v !== MIXED && v && getNode(v);
      control = `<button class="select swap-btn" ${tgt} data-prop-swap="${pid}"><span class="comp-icon inst">${INSTANCE_ICON}</span>` +
        `<span class="swap-name">${v === MIXED ? 'Mixed' : esc(comp ? displayName(comp) : 'Choose…')}</span>${CHEVRON}</button>`;
    }
    rows.push(`<div class="inst-row"><span class="inst-label" title="${esc(def.name)}">${PROP_ICONS[def.type]}${esc(def.name)}</span>${control}</div>`);
  }
  if (group.length === 1) rows.push(...slotRows(inst, main));
  return rows.join('');
}

// ---------- slots ----------
// The slot areas of an instance (its layers bound to a slot property), with their property.
function slotAreas(inst, main) {
  const defs = propsOf(main);
  const out = [];
  walk(inst.children || [], (n) => {
    if (isSlotArea(n) && defs[n.propRefs.slot]) out.push({ area: n, def: defs[n.propRefs.slot] });
    if (n.type === 'instance' || isSlotArea(n)) return false;
  });
  return out;
}

function limitBadge(area) {
  const l = slotLimits(area);
  if (l.min == null && l.max == null) return `<span class="muted">${l.count} layer${l.count === 1 ? '' : 's'}</span>`;
  const range = `${l.min ?? 0}–${l.max ?? '∞'}`;
  return `<span class="slot-limit ${l.ok ? 'ok' : 'warn'}" title="${l.ok ? 'Within the limits' : 'Outside the limits'}: ${range} layers">${l.ok ? lucideIcon('check',12) : lucideIcon('triangle-alert',12)} ${l.count} of ${range}</span>`;
}

function slotRows(inst, main) {
  return slotAreas(inst, main).map(({ area, def }) =>
    `<div class="inst-row slot-row" data-hover-node="${area.id}"><span class="inst-label">${PROP_ICONS.slot}${esc(def.name)}` +
    `${isSlotModified(area) ? '<span class="slot-tag">Modified</span>' : ''}</span>` +
    `<span class="slot-ctrl">${limitBadge(area)}<button class="icon-btn" data-slot-add="${area.id}" title="Add instances">${icons.plus}</button>` +
    `<button class="icon-btn" data-slot-menu="${area.id}" title="More actions">${MORE_ICON}</button></span></div>`);
}

// A slot area selected inside an instance.
function slotAreaPanel(area) {
  const def = slotDef(area);
  const head = `<div class="comp-head"><span class="comp-icon slot">${PROP_ICONS.slot}</span><span class="comp-name slot">${esc(def?.name || area.name)}</span>` +
    `${isSlotModified(area) ? '<span class="slot-tag">Modified</span>' : ''}<button class="icon-btn" data-slot-menu="${area.id}" title="More actions">${MORE_ICON}</button></div>`;
  const prefOnly = def?.preferredOnly && def.preferred?.length;
  return `<div class="section comp-panel">${head}${def?.description ? `<div class="comp-desc">${esc(def.description)}</div>` : ''}` +
    `<div class="inst-row"><span class="inst-label">Limits</span>${limitBadge(area)}</div>` +
    `<div class="comp-sub">${prefOnly ? 'Only its preferred instances can go in this slot.' : 'Add any layers: draw or drop them in, or add instances.'}</div>` +
    `<button class="btn wide" data-slot-add="${area.id}">${icons.plus} Add instances</button></div>`;
}

// A frame inside a main component: make it a slot (or show the slot it is).
function slotFramePanel(frame) {
  const comp = containingComponent(frame);
  const pid = frame.propRefs?.slot;
  const def = pid && propsOf(comp)[pid];
  if (insideMainSlot(frame) && !def) return '';
  const body = def
    ? `<div class="inst-row"><button class="prop-pill" data-slot-pill="${frame.id}" title="Slot property: click to change or remove">${PROP_ICONS.slot}<span>${esc(def.name)}</span></button>` +
      `<span class="muted">${(frame.children || []).length ? `${frame.children.length} default layer${frame.children.length === 1 ? '' : 's'}` : 'Empty by default'}</span></div>`
    : `<button class="btn wide" data-convert-slot="${frame.id}" title="⌘⇧S">${PROP_ICONS.slot} Convert to slot</button>`;
  return section('Slot', body);
}

// Pick a slot property for a frame (or create one).
export function slotMenu(anchorRect, frame) {
  const comp = containingComponent(frame);
  if (!comp || comp === frame) return toast('A slot has to be a frame inside a main component (not the component itself).');
  if (!isFrameLike(frame) || frame.type === 'instance') return toast('Only frames can be slots. Use Wrap in new slot for other layers.');
  const current = frame.propRefs?.slot;
  const defs = Object.entries(propsOf(comp)).filter(([, d]) => d.type === 'slot');
  showContextMenu(anchorRect.left, anchorRect.bottom + 4, [
    { label: 'Slot properties', disabled: true },
    ...defs.map(([pid, d]) => ({ label: `   ${d.name}`, checked: pid === current, action: () => { setSlot(frame, pid); commit(); } })),
    { label: '   Create slot property…', action: () => openPropWindow({ comp, type: 'slot', anchor: anchorRect, bind: { layer: frame, path: 'slot' } }) },
    ...(current ? [{ label: '   Remove slot (keep the frame and its layers)', action: () => { setSlot(frame, null); commit(); } }] : []),
  ]);
}

function slotActionMenu(btn, area) {
  const r = btn.getBoundingClientRect();
  showContextMenu(r.right - 200, r.bottom + 4, [
    { label: 'Select slot', action: () => { select([area.id]); commit(); } },
    { label: 'Add instances…', action: () => addToSlot(r, area) },
    '-',
    { label: 'Reset slot', disabled: !isSlotModified(area), action: () => { resetSlot(area); commit(); } },
    { label: 'Delete contents', disabled: !(area.children || []).length, action: () => { clearSlot(area); commit(); } },
  ]);
}

// "Add instances": pick a component (preferred ones first, or only those) and add it to the slot.
function addToSlot(anchorRect, area) {
  const def = slotDef(area) || {};
  const only = def.preferredOnly && def.preferred?.length ? new Set(def.preferred) : null;
  openComponentPicker({
    anchor: anchorRect, preferred: def.preferred || [],
    exclude: (c) => (only && !only.has(c.id)) || !canPlaceInside({ type: 'instance', componentId: c.id }, area),
    onPick: (id) => {
      const main = getNode(id);
      const n = createInstance(main, { parent: area, x: 0, y: 0 });
      select([n.id]);
      commit();
    },
  });
}

// Nested instances whose properties the main component shows (and, through them, deeper ones).
function exposedInstances(root) {
  const out = [];
  const visit = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'instance') {
        if (n.exposed && n.visible !== false) {
          out.push(n);
          visit(n.children || []);
        }
        continue;
      }
      if (n.children) visit(n.children);
    }
  };
  visit(root.children || []);
  return out;
}

function exposedControls(inst) {
  return exposedInstances(inst).map((n) => {
    const main = mainComponentOf(n);
    return `<div class="inst-nested-head" data-hover-node="${n.id}"><span class="comp-icon inst">${INSTANCE_ICON}</span>${esc(n.name)}</div>` +
      (main ? instanceControls(n, main) : '');
  }).join('');
}

// ---------- applying properties to layers (used by panels.js) ----------
const PATH_TYPE = { visible: 'boolean', text: 'text', iconId: 'icon' };

// The component property a layer's `path` is bound to, if the selection is one layer in a main component.
export function boundProp(nodes, path) {
  if (nodes.length !== 1 || !PATH_TYPE[path]) return null;
  const layer = nodes[0];
  const comp = containingComponent(layer);
  const pid = comp && layer.propRefs?.[path];
  const def = pid && propsOf(comp)[pid];
  return def ? { comp, pid, def } : null;
}

// A purple pill for a bound property (or '' if none).
export function propBinding(nodes, path) {
  const b = boundProp(nodes, path);
  if (!b) return '';
  return `<button class="prop-pill" data-prop-pill="${path}" title="Component property: click to change or detach">${PROP_ICONS[b.def.type]}<span>${esc(b.def.name)}</span></button>`;
}

// Menu items for the "Apply variable/property" button: this component's properties of the right type,
// and creating one. Empty when the layer isn't in a main component.
export function propMenuItems(nodes, path, anchorRect) {
  const type = PATH_TYPE[path];
  if (nodes.length !== 1 || !type) return [];
  const layer = nodes[0];
  const comp = containingComponent(layer);
  if (!comp || isInsideInstance(layer)) return [];
  if (insideMainSlot(layer)) return [{ label: 'Layers inside a slot can’t use component properties', disabled: true }];
  const current = layer.propRefs?.[path];
  const defs = Object.entries(propsOf(comp)).filter(([, d]) => d.type === type);
  return [
    { label: `${PROP_TYPES[type]} properties`, disabled: true },
    ...defs.map(([pid, d]) => ({ label: `   ${d.name}`, checked: pid === current, action: () => { bindLayerProp(layer, path, pid); commit(); } })),
    { label: `   Create ${PROP_TYPES[type].toLowerCase()} property…`, action: () => openPropWindow({ comp, type, anchor: anchorRect, bind: { layer, path } }) },
    ...(current ? [{ label: '   Detach property', action: () => { bindLayerProp(layer, path, null); commit(); } }] : []),
  ];
}

function swapPropMenu(btn, inst) {
  const comp = containingComponent(inst);
  if (!comp) return;
  const current = inst.propRefs?.componentId;
  const defs = Object.entries(propsOf(comp)).filter(([, d]) => d.type === 'instance');
  const r = btn.getBoundingClientRect();
  showContextMenu(r.left, r.bottom + 4, [
    { label: 'Instance swap properties', disabled: true },
    ...defs.map(([pid, d]) => ({ label: `   ${d.name}`, checked: pid === current, action: () => { bindLayerProp(inst, 'componentId', pid); commit(); } })),
    { label: '   Create instance swap property…', action: () => openPropWindow({ comp, type: 'instance', anchor: r, bind: { layer: inst, path: 'componentId' } }) },
    ...(current ? [{ label: '   Detach property', action: () => { bindLayerProp(inst, 'componentId', null); commit(); } }] : []),
  ]);
}

// ---------- the property window ----------
let win = null;

export function closePropWindow() {
  win?.el.remove();
  win = null;
  window.removeEventListener('pointerdown', outsideWin, true);
  window.removeEventListener('keydown', winKey, true);
}
function outsideWin(e) {
  if (win && !win.el.contains(e.target) && !e.target.closest?.('.menu, .comp-picker, .icon-picker')) closePropWindow();
}
function winKey(e) {
  if (isAsking()) return; // Escape is the open dialog's
  if (e.key === 'Escape' && win) {
    e.stopPropagation();
    closePropWindow();
  }
}

// Create (no pid) or edit a property. `variantProp`: edit a variant property of a set.
// `bind`: { layer, path } to apply the new property to.
export function openPropWindow({ comp, pid = null, type = null, variantProp = null, anchor, bind = null }) {
  closePropWindow();
  const host = propsHost(comp);
  const creating = !pid && !variantProp;
  const def = pid ? propsOf(comp)[pid] : null;
  type = variantProp ? 'variant' : def?.type || type;
  const draft = creating ? {
    name: suggestName(comp, type, bind?.layer),
    default: type === 'boolean' ? (bind ? bind.layer.visible !== false : true)
      : type === 'text' ? (bind ? bind.layer.text : 'Text')
        : type === 'icon' ? (bind ? bind.layer.iconId : firstIconIn(comp))
        : (bind ? bind.layer.componentId : listComponents().find(({ node }) => node.id !== comp.id && !isVariantOf(node, host))?.node.id),
    preferred: [],
  } : null;
  const el = document.createElement('div');
  el.className = 'prop-window';
  document.body.appendChild(el);
  win = { el, comp, pid, type, variantProp, creating, draft, bind };
  renderWin();
  // An Icon property lists the groups of the whole icon sets: read them, then show them.
  if (type === 'icon') loadIconLibraries().then(() => win?.el === el && renderWin());
  // To the left of the right panel, level with what opened it.
  const r = el.getBoundingClientRect();
  const panel = document.querySelector('#right')?.getBoundingClientRect();
  const left = (panel ? panel.left : window.innerWidth - 260) - r.width - 8;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, Math.min((anchor?.top ?? 80) - 12, window.innerHeight - r.height - 8))}px`;
  setTimeout(() => {
    window.addEventListener('pointerdown', outsideWin, true);
    window.addEventListener('keydown', winKey, true);
  }, 0);
  const nameInput = el.querySelector('[data-w-name]');
  nameInput?.focus();
  nameInput?.select();
  el.addEventListener('click', onWinClick);
  el.addEventListener('change', onWinChange);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input') && win?.creating) createFromWin();
    else if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
  });
  bindValueDrag(el);
}

// The first icon this file can use, preferring the component's own icon layers (for a new Icon property).
function firstIconIn(comp) {
  let id = null;
  walk(propsHost(comp).children || [], (n) => {
    if (!id && n.type === 'icon' && n.iconId) id = n.iconId;
    if (n.type === 'instance') return false;
  });
  return id || availableIcons()[0]?.icon.id || null;
}

const isVariantOf = (node, set) => set.type === 'componentSet' && getParent(node.id) === set;

function suggestName(comp, type, layer) {
  const taken = new Set(Object.values(propsOf(comp)).map((d) => d.name));
  let base = layer ? (type === 'boolean' ? `Show ${layer.name}` : layer.name) : PROP_TYPES[type];
  if (type === 'slot') base = layer ? layer.name : 'Slot';
  if (type === 'icon') base = 'Icon'; // an icon layer is named after its icon, which instances change
  if (!layer && type !== 'variant') base = `${PROP_TYPES[type]}`;
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base} ${i}`;
  return name;
}

function renderWin() {
  if (!win) return;
  // Keep what's typed in a new property's fields across re-renders (before their change events).
  if (win.creating && win.el.firstChild) {
    const name = win.el.querySelector('[data-w-name]');
    const text = win.el.querySelector('[data-w-text]');
    if (name) win.draft.name = name.value;
    if (text) win.draft.default = text.value;
  }
  const { comp, pid, type, variantProp, creating, draft } = win;
  const host = propsHost(comp);
  const def = creating ? draft : pid ? propsOf(comp)[pid] : null;
  const title = creating ? 'Create component property' : 'Edit component property';
  let body = `<label class="w-label">Name</label><input class="prop-input" data-w-name value="${esc(variantProp || def?.name || '')}" spellcheck="false">`;
  const varBtn = (type === 'boolean' || type === 'text')
    ? `<button class="icon-btn w-var" data-w-var title="Apply variable (a design token)">${APPLY_PROP_ICON}</button>` : '';
  const valueLabel = `<div class="w-label-row"><label class="w-label">Value</label>${def?.defaultVar ? '' : varBtn}</div>`;
  if (def?.defaultVar && (type === 'boolean' || type === 'text')) {
    body += valueLabel + `<div class="w-token"><span class="var-chip-like">${esc(tokenName(def.defaultVar))}</span>` +
      `<span class="muted">${esc(String(effectiveDefault(def) ?? ''))}</span><button class="icon-btn" data-w-unvar title="Detach variable">${icons.close}</button></div>`;
  } else if (type === 'boolean') {
    body += valueLabel + '<div class="seg w-seg">' +
      `<button class="${def.default ? 'on' : ''}" data-w-bool="1">True</button><button class="${def.default ? '' : 'on'}" data-w-bool="0">False</button></div>`;
  } else if (type === 'text') {
    body += valueLabel + `<input class="prop-input" data-w-text value="${esc(def.default ?? '')}" spellcheck="false">`;
  } else if (type === 'instance') {
    const main = def.default && getNode(def.default);
    body += '<label class="w-label">Value</label>' +
      `<button class="select swap-btn" data-w-default><span class="comp-icon inst">${INSTANCE_ICON}</span><span class="swap-name">${esc(main ? displayName(main) : 'Choose a component…')}</span>${CHEVRON}</button>` +
      '<label class="w-label">Preferred values <span class="muted">(listed first when swapping)</span></label>' +
      (def.preferred || []).map((id) => {
        const c = getNode(id);
        return `<div class="w-pref"><span class="comp-icon inst">${INSTANCE_ICON}</span><span>${esc(c ? displayName(c) : 'Missing component')}</span><button class="icon-btn" data-w-unprefer="${id}" title="Remove">${icons.minus}</button></div>`;
      }).join('') +
      '<button class="link-btn" data-w-prefer>+ Add preferred value</button>';
  } else if (type === 'icon') {
    // The default icon, and the groups instances may choose from (all by default).
    const groups = iconGroups(availableIcons({ withId: def.default }).map((x) => x.icon));
    const allowed = def.groups;
    const outside = allowed && findIcon(def.default) && !allowed.includes(findIcon(def.default).group || '');
    body += '<label class="w-label">Value</label>' + iconChoice(def.default, 'data-w-icon') +
      '<label class="w-label">Instances can choose from</label>' +
      `<label class="check-row"><input type="checkbox" data-w-all-groups ${allowed ? '' : 'checked'}> All icons</label>` +
      (allowed ? '<div class="w-groups">' + groups.map((g) => `<label class="check-row"><input type="checkbox" data-w-group="${esc(g.name)}" ${allowed.includes(g.name) ? 'checked' : ''}> ${esc(g.name || 'Ungrouped')} <span class="muted">${g.count}</span></label>`).join('') + '</div>' : '') +
      (outside ? '<div class="warn">The default icon isn’t in these groups.</div>' : '');
  } else if (type === 'slot') {
    const num = (k) => (def[k] == null ? '' : def[k]);
    body += '<label class="w-label">Description</label>' +
      `<textarea class="desc" data-w-slot="description" rows="2" placeholder="What goes in this slot?" spellcheck="false">${esc(def.description || '')}</textarea>` +
      '<div class="grid2 w-limits"><label><span class="w-label">Minimum layers</span>' +
      `<input class="prop-input" data-w-slot="min" value="${num('min')}" placeholder="None" inputmode="numeric"></label>` +
      '<label><span class="w-label">Maximum layers</span>' +
      `<input class="prop-input" data-w-slot="max" value="${num('max')}" placeholder="None" inputmode="numeric"></label></div>` +
      '<label class="w-label">Preferred instances</label>' +
      (def.preferred || []).map((id) => {
        const c = getNode(id);
        return `<div class="w-pref"><span class="comp-icon inst">${INSTANCE_ICON}</span><span>${esc(c ? displayName(c) : 'Missing component')}</span><button class="icon-btn" data-w-unprefer="${id}" title="Remove">${icons.minus}</button></div>`;
      }).join('') +
      '<button class="link-btn" data-w-prefer>+ Select preferred instances</button>' +
      `<label class="check-row"><input type="checkbox" data-w-slot="preferredOnly" ${def.preferredOnly ? 'checked' : ''}> Only allow preferred instances</label>` +
      `<label class="check-row"><input type="checkbox" data-w-slot="showEmpty" ${def.showEmpty ? 'checked' : ''}> Display empty slots by default</label>` +
      `<label class="check-row"><input type="checkbox" data-w-slot="fillCounter" ${def.fillCounter ? 'checked' : ''}> Fill items on counter-axis by default</label>`;
  } else if (type === 'variant') {
    const values = variantDefs(host)[variantProp] || [];
    const dv = defaultVariant(host);
    body += '<label class="w-label">Values <span class="muted">(drag to reorder)</span></label><div class="w-values">' +
      values.map((v) => `<div class="w-value" draggable="true" data-w-value="${esc(v)}"><span class="prop-grip">${GRIP_ICON}</span>` +
        `<input class="prop-input" data-w-rename-value="${esc(v)}" value="${esc(v)}" spellcheck="false"></div>`).join('') + '</div>' +
      `<div class="muted w-note">Instances start as the default variant: the one in the top-left corner of the set${dv ? ` (${esc(parseVariantName(dv.name)[variantProp] ?? '')})` : ''}. Add values by adding variants or typing a new value on a variant.</div>`;
  }
  const typeLabel = type === 'variant' ? 'Variant' : PROP_TYPES[type];
  win.el.innerHTML = `<div class="w-head"><span class="prop-icon ${type}">${PROP_ICONS[type]}</span><span>${title}</span><span class="muted w-type">${typeLabel}</span>` +
    `<button class="icon-btn" data-w-close title="Close">${icons.close}</button></div><div class="w-body">${body}</div>` +
    (creating ? '<div class="w-foot"><button class="btn primary" data-w-create>Create property</button></div>' : '');
}

function onWinClick(e) {
  const b = e.target.closest('button');
  if (!b || !win) return;
  const { comp, pid, creating, draft } = win;
  const def = creating ? draft : propsOf(comp)[pid];
  if (b.hasAttribute('data-w-close')) return closePropWindow();
  if (b.hasAttribute('data-w-var')) {
    return openTokenPicker({
      anchor: b.getBoundingClientRect(), type: TOKEN_TYPE[win.type],
      onPick: (id) => {
        if (creating) draft.defaultVar = id;
        else {
          setPropDefaultVar(comp, pid, id);
          commit();
        }
        renderWin();
      },
    });
  }
  if (b.hasAttribute('data-w-unvar')) {
    if (creating) delete draft.defaultVar;
    else {
      setPropDefaultVar(comp, pid, null);
      commit();
    }
    return renderWin();
  }
  if (b.hasAttribute('data-w-create')) return createFromWin();
  if (b.hasAttribute('data-w-icon')) {
    return openIconPicker({
      anchor: b.getBoundingClientRect(), currentId: def.default, groups: def.groups || null,
      onPick: (id) => {
        if (creating) draft.default = id;
        else updateAndCommit({ default: id });
        renderWin();
      },
    });
  }
  if (b.dataset.wBool !== undefined) {
    const v = b.dataset.wBool === '1';
    if (creating) draft.default = v;
    else updateAndCommit({ default: v });
    return renderWin();
  }
  if (b.hasAttribute('data-w-default') || b.hasAttribute('data-w-prefer')) {
    const preferring = b.hasAttribute('data-w-prefer');
    return openComponentPicker({
      anchor: b.getBoundingClientRect(),
      currentId: preferring ? null : def.default,
      exclude: (c) => c.id === comp.id || isVariantOf(c, propsHost(comp)),
      onPick: (id) => {
        if (preferring) {
          const preferred = [...(def.preferred || []), id];
          if (creating) draft.preferred = [...new Set(preferred)];
          else updateAndCommit({ preferred });
        } else if (creating) draft.default = id;
        else updateAndCommit({ default: id });
        renderWin();
      },
    });
  }
  if (b.dataset.wUnprefer) {
    const preferred = (def.preferred || []).filter((x) => x !== b.dataset.wUnprefer);
    if (creating) draft.preferred = preferred;
    else updateAndCommit({ preferred });
    return renderWin();
  }
}

function onWinChange(e) {
  const t = e.target;
  if (!win) return;
  const { comp, creating, draft, variantProp } = win;
  const host = propsHost(comp);
  if (t.hasAttribute('data-w-name')) {
    if (creating) return void (draft.name = t.value);
    if (variantProp) {
      const to = t.value.trim();
      if (!to || to === variantProp) return;
      if (Object.keys(variantDefs(host)).includes(to)) return toast(`There's already a property named “${to}”.`), renderWin();
      renameVariantProperty(host, variantProp, to);
      if (host.valueOrder?.[variantProp]) {
        host.valueOrder[to] = host.valueOrder[variantProp];
        delete host.valueOrder[variantProp];
      }
      win.variantProp = to;
      commit();
      return renderWin();
    }
    return updateAndCommit({ name: t.value });
  }
  if (t.hasAttribute('data-w-all-groups') || t.dataset.wGroup !== undefined) {
    const def = creating ? draft : propsOf(comp)[win.pid];
    let groups;
    if (t.hasAttribute('data-w-all-groups')) groups = t.checked ? null : [findIcon(def.default)?.group || ''];
    else {
      const set = new Set(def.groups || []);
      t.checked ? set.add(t.dataset.wGroup) : set.delete(t.dataset.wGroup);
      groups = [...set];
    }
    if (creating) {
      if (groups?.length) draft.groups = groups;
      else delete draft.groups;
    } else updateAndCommit({ groups });
    return renderWin();
  }
  if (t.dataset.wSlot) {
    const key = t.dataset.wSlot;
    let value = t.type === 'checkbox' ? t.checked : t.value.trim();
    if (key === 'min' || key === 'max') value = value === '' ? null : Math.max(0, Math.round(Number(value)));
    if ((key === 'min' || key === 'max') && value !== null && !Number.isFinite(value)) return renderWin();
    const target = creating ? draft : propsOf(comp)[win.pid];
    if (value === null || value === false || value === '') delete target[key];
    else target[key] = value;
    if (!creating) commit();
    return;
  }
  if (t.hasAttribute('data-w-text')) {
    if (creating) return void (draft.default = t.value);
    return updateAndCommit({ default: t.value });
  }
  if (t.dataset.wRenameValue !== undefined) {
    if (!renameVariantValue(host, variantProp, t.dataset.wRenameValue, t.value)) return renderWin();
    commit();
    return renderWin();
  }
}

// Drag values to reorder them (variant properties).
function bindValueDrag(el) {
  let dragging = null;
  el.addEventListener('dragstart', (e) => {
    const row = e.target.closest?.('[data-w-value]');
    if (!row) return;
    dragging = row.dataset.wValue;
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', (e) => {
    if (dragging === null || !e.target.closest?.('[data-w-value]')) return;
    e.preventDefault();
  });
  el.addEventListener('drop', (e) => {
    const row = e.target.closest?.('[data-w-value]');
    if (dragging === null || !row || !win) return;
    e.preventDefault();
    const host = propsHost(win.comp);
    const values = (variantDefs(host)[win.variantProp] || []).filter((v) => v !== dragging);
    const r = row.getBoundingClientRect();
    let at = values.indexOf(row.dataset.wValue);
    if (e.clientY > r.top + r.height / 2) at++;
    values.splice(at < 0 ? values.length : at, 0, dragging);
    dragging = null;
    reorderVariantValues(host, win.variantProp, values);
    commit();
    renderWin();
  });
}

function updateAndCommit(changes) {
  updateComponentProp(win.comp, win.pid, changes);
  commit();
}

function createFromWin() {
  const { comp, type, draft, bind } = win;
  // Read the fields now: Enter can come before their change events.
  const nameField = win.el.querySelector('[data-w-name]');
  if (nameField) draft.name = nameField.value;
  const textField = win.el.querySelector('[data-w-text]');
  if (textField) draft.default = textField.value;
  const name = String(draft.name || '').trim() || PROP_TYPES[type];
  if (Object.values(propsOf(comp)).some((d) => d.name === name)) return toast(`There's already a property named “${name}”.`);
  if (type === 'instance' && !draft.default) return toast('Choose a component for the value.');
  if (type === 'icon' && !draft.default) return toast('Choose an icon for the value.');
  if (bind?.path === 'slot') {
    // Slot properties go on frames below the component's top level.
    if (bind.layer === comp || !isFrameLike(bind.layer) || bind.layer.type === 'instance') return toast('A slot has to be a frame inside the component.');
  }
  const pid = addComponentProp(comp, type, { name, value: type === 'slot' ? undefined : draft.default });
  if (draft.preferred?.length) updateComponentProp(comp, pid, { preferred: draft.preferred });
  if (draft.groups?.length) updateComponentProp(comp, pid, { groups: draft.groups });
  if (type === 'slot') {
    const def = propsOf(comp)[pid];
    for (const k of ['description', 'min', 'max', 'preferredOnly', 'showEmpty', 'fillCounter']) if (draft[k] != null && draft[k] !== false && draft[k] !== '') def[k] = draft[k];
  }
  if (bind?.path === 'slot') setSlot(bind.layer, pid);
  else if (bind) bindLayerProp(bind.layer, bind.path, pid);
  if (draft.defaultVar) setPropDefaultVar(comp, pid, draft.defaultVar);
  closePropWindow();
  commit();
}

// ---------- the component picker (swap) ----------
let picker = null;
export function closeComponentPicker() {
  picker?.remove();
  picker = null;
}

function thumb(node) {
  const b = worldBounds(node);
  if (!(b.w > 0 && b.h > 0)) return COMPONENT_ICON;
  return `<svg viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet">${nodeWorldSVG(node)}</svg>`;
}

// A searchable list of components: preferred ones first, then each page / library and set.
export function openComponentPicker({ anchor, currentId = null, preferred = [], exclude = () => false, onPick }) {
  closeComponentPicker();
  const all = listComponents().filter(({ node }) => !exclude(node));
  const label = (node) => (isVariant(node) ? `${getParent(node.id).name} · ${node.name}` : node.name);
  const groupOf = (c) => (c.library ? c.library.name : c.page?.name || '');
  picker = document.createElement('div');
  picker.className = 'token-picker comp-picker';
  picker.innerHTML = '<input class="token-picker-search" placeholder="Search components" spellcheck="false"><div class="token-picker-list"></div>';
  document.body.appendChild(picker);
  const search = picker.querySelector('input');
  const list = picker.querySelector('.token-picker-list');
  let shown = [];
  let active = 0;
  const render = () => {
    const match = (c) => (!isDeprecated(c.node) || c.node.id === currentId) && componentMatches(c.node, search.value);
    const pref = preferred.map((id) => all.find((c) => c.node.id === id)).filter(Boolean).filter(match);
    const rest = all.filter((c) => match(c) && !preferred.includes(c.node.id));
    shown = [...pref.map((c) => ({ ...c, head: 'Preferred' })), ...rest.map((c) => ({ ...c, head: groupOf(c) }))];
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
    let last = null;
    list.innerHTML = shown.map((c, i) => {
      const head = c.head !== last ? `<div class="token-picker-head">${esc(c.head || 'Components')}</div>` : '';
      last = c.head;
      return `${head}<button class="token-picker-item${i === active ? ' active' : ''}${c.node.id === currentId ? ' current' : ''}" data-i="${i}">` +
        `<span class="picker-thumb">${thumb(c.node)}</span><span class="token-picker-name">${esc(label(c.node))}</span></button>`;
    }).join('') || '<div class="muted token-picker-empty">No components match.</div>';
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (c) => {
    closeComponentPicker();
    if (c) onPick(c.node.id);
  };
  search.addEventListener('input', () => { active = 0; render(); });
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      render();
    } else if (e.key === 'Enter') pick(shown[active]);
    else if (e.key === 'Escape') closeComponentPicker();
  });
  picker.addEventListener('pointerdown', (e) => e.stopPropagation());
  picker.addEventListener('click', (e) => {
    const item = e.target.closest('[data-i]');
    if (item) pick(shown[+item.dataset.i]);
  });
  const outside = (e) => {
    if (picker && !picker.contains(e.target)) {
      closeComponentPicker();
      window.removeEventListener('pointerdown', outside, true);
    }
  };
  setTimeout(() => window.addEventListener('pointerdown', outside, true), 0);
  render();
  const r = picker.getBoundingClientRect();
  picker.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 8))}px`;
  picker.style.top = `${anchor.bottom + 4 + r.height <= window.innerHeight - 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - r.height - 4)}px`;
  search.focus();
}

// ---------- events (called by panels.js) ----------
const selected = () => state.selection.map(getNode).filter(Boolean);
const targetsOf = (el) => (el.dataset.target ? el.dataset.target.split(',').map(getNode).filter(Boolean) : selected().slice(0, 1));
const targetOf = (el) => targetsOf(el)[0];

// Clicks in the right panel. Returns true when handled.
export function onComponentClick(e) {
  const b = e.target.closest('button, .prop-row');
  if (!b) return false;
  const node = selected()[0];
  if (b.hasAttribute('data-prop-add')) return addPropMenu(b, node), true;
  if (b.dataset.propEdit || (b.matches('.prop-row[data-prop-row]') && !e.target.closest('button, input'))) {
    const key = b.dataset.propEdit || b.dataset.propRow;
    openPropWindow({ comp: node, ...(key.startsWith('v:') ? { variantProp: key.slice(2) } : { pid: key }), anchor: b.getBoundingClientRect() });
    return true;
  }
  if (b.dataset.propRemove) return deleteProp(node, b.dataset.propRemove), true;
  if (b.hasAttribute('data-comp-desc')) {
    editingDescription = editingDescription === node.id ? null : node.id;
    window.dispatchEvent(new CustomEvent('sigma:refresh-panel'));
    setTimeout(() => document.querySelector('.comp-desc-edit')?.focus(), 0);
    return true;
  }
  if (b.dataset.compMenu) return compMenu(b, getNode(b.dataset.compMenu)), true;
  if (b.dataset.selectNode) {
    select([b.dataset.selectNode]);
    commit();
    return true;
  }
  if (b.dataset.swapMenu) {
    const inst = getNode(b.dataset.swapMenu);
    const main = mainComponentOf(inst);
    openComponentPicker({
      anchor: b.getBoundingClientRect(), currentId: inst.componentId,
      preferred: main ? preferredFor(inst) : [],
      exclude: (c) => !canSwapTo(inst, c),
      onPick: (id) => {
        editNode(inst, ['componentId'], () => void (inst.componentId = id));
        commit();
      },
    });
    return true;
  }
  if (b.dataset.swapPropMenu) return swapPropMenu(b, getNode(b.dataset.swapPropMenu)), true;
  if (b.dataset.slotAdd) return addToSlot(b.getBoundingClientRect(), getNode(b.dataset.slotAdd)), true;
  if (b.dataset.slotMenu) return slotActionMenu(b, getNode(b.dataset.slotMenu)), true;
  if (b.dataset.convertSlot || b.dataset.slotPill) return slotMenu(b.getBoundingClientRect(), getNode(b.dataset.convertSlot || b.dataset.slotPill)), true;
  if (b.dataset.propIcon) {
    // An instance's Icon property: an icon from the allowed groups.
    const insts = targetsOf(b);
    const def = propsOf(mainComponentOf(insts[0]))[b.dataset.propIcon];
    openIconPicker({
      anchor: b.getBoundingClientRect(), currentId: (insts[0].propValues || {})[b.dataset.propIcon] ?? def?.default, groups: def?.groups || null,
      onPick: (id) => {
        for (const n of insts) setInstanceProp(n, b.dataset.propIcon, id);
        commit();
      },
    });
    return true;
  }
  if (b.dataset.propSwap) {
    const insts = targetsOf(b);
    const inst = insts[0];
    const main = mainComponentOf(inst);
    const def = propsOf(main)[b.dataset.propSwap];
    openComponentPicker({
      anchor: b.getBoundingClientRect(), currentId: (inst.propValues || {})[b.dataset.propSwap] ?? def?.default, preferred: def?.preferred || [],
      exclude: (c) => !canPlaceInside({ type: 'instance', componentId: c.id }, main), // never a component inside itself
      onPick: (id) => {
        for (const n of insts) setInstanceProp(n, b.dataset.propSwap, id);
        commit();
      },
    });
    return true;
  }
  if (b.dataset.instReset) {
    select([b.dataset.instReset]);
    resetSelectionOverrides();
    return true;
  }
  if (b.dataset.instMenu) return instMenu(b, getNode(b.dataset.instMenu)), true;
  if (b.dataset.clearOrphans) {
    clearOrphanedOverrides(getNode(b.dataset.clearOrphans));
    commit();
    return true;
  }
  if (b.hasAttribute('data-expose-menu')) return exposeMenu(b, node), true;
  if (b.dataset.unexpose) {
    const n = getNode(b.dataset.unexpose);
    if (n) delete n.exposed;
    commit();
    return true;
  }
  if (b.dataset.propPill) {
    const r = b.getBoundingClientRect();
    showContextMenu(r.left, r.bottom + 4, [
      ...propMenuItems(selected(), b.dataset.propPill, r),
      '-',
      { label: 'Edit property…', action: () => { const bp = boundProp(selected(), b.dataset.propPill); if (bp) openPropWindow({ comp: bp.comp, pid: bp.pid, anchor: r }); } },
    ]);
    return true;
  }
  return false;
}

// Can `inst` (or a layer in it) be swapped to component `c`? Not if that would put a component inside
// itself: the check is against the component that really holds the layer.
function canSwapTo(inst, c) {
  const host = isInsideInstance(inst) ? mainComponentOf(owningInstance(inst)) : getParent(inst.id);
  return canPlaceInside({ type: 'instance', componentId: c.id }, host);
}

// Preferred instances for swapping a nested instance: those of the property it's bound to, if any.
function preferredFor(inst) {
  const owner = owningInstance(inst);
  const ownerMain = owner && mainComponentOf(owner);
  if (!ownerMain) return [];
  for (const def of Object.values(propsOf(ownerMain))) if (def.type === 'instance' && def.preferred) return def.preferred;
  return [];
}

// Changes (selects, toggles, fields) in the right panel. Returns true when handled.
export function onComponentChange(t) {
  if (t.dataset.variantToggle !== undefined) {
    for (const inst of targetsOf(t)) switchVariant(inst, t.dataset.variantToggle, t.checked ? t.dataset.on : t.dataset.off);
    commit();
    return true;
  }
  if (t.dataset.variantProp !== undefined) {
    let exact = true;
    for (const inst of targetsOf(t)) exact = switchVariant(inst, t.dataset.variantProp, t.value) && exact;
    if (!exact) toast('No variant matches exactly, so the closest one was used.');
    commit();
    return true;
  }
  if (t.dataset.instanceProp) {
    for (const inst of targetsOf(t)) setInstanceProp(inst, t.dataset.instanceProp, t.type === 'checkbox' ? t.checked : t.value);
    commit();
    return true;
  }
  if (t.dataset.variantValue !== undefined) {
    const variant = selected()[0];
    const value = t.value.trim();
    if (!value || value.includes(',') || value.includes('=')) {
      toast('Values can’t be empty or contain “,” or “=”.');
      window.dispatchEvent(new CustomEvent('sigma:refresh-panel'));
      return true;
    }
    setVariantValue(variant, t.dataset.variantValue, value);
    commit();
    return true;
  }
  if (t.hasAttribute('data-desc')) {
    const n = selected()[0];
    if (n) editNode(n, ['description'], () => void (n.description = t.value.trim() || undefined));
    editingDescription = null;
    commit();
    return true;
  }
  return false;
}

// Drag property rows to reorder them (variant properties among themselves).
// A property highlight never outlives the selection it was for.
subscribe((kind) => {
  if ((kind === 'selection' || kind === 'doc') && state.highlightIds?.length && !document.querySelector('.prop-row:hover, .inst-row:hover')) state.highlightIds = [];
});

export function bindPropertyDrag(root) {
  // Hovering a property highlights the layers it controls (in the main component, or in the instance).
  root.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.prop-row[data-prop-row], .inst-row');
    const ids = row ? highlightFor(row) : [];
    if (JSON.stringify(ids) === JSON.stringify(state.highlightIds || [])) return;
    state.highlightIds = ids;
    emit('overlay');
  });
  root.addEventListener('mouseleave', () => {
    if (!state.highlightIds?.length) return;
    state.highlightIds = [];
    emit('overlay');
  });
  // Select a property (click or Tab) and press Delete to remove it, like Figma.
  root.addEventListener('keydown', (e) => {
    const row = e.target.closest?.('.prop-row[data-prop-row]');
    if (!row || e.target !== row) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      deleteProp(selected()[0], row.dataset.propRow);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openPropWindow({ comp: selected()[0], ...(row.dataset.propRow.startsWith('v:') ? { variantProp: row.dataset.propRow.slice(2) } : { pid: row.dataset.propRow }), anchor: row.getBoundingClientRect() });
    }
  });
  let dragging = null;
  root.addEventListener('dragstart', (e) => {
    const row = e.target.closest?.('.prop-row[data-prop-row]');
    if (!row) return;
    dragging = row.dataset.propRow;
    e.dataTransfer.effectAllowed = 'move';
  });
  root.addEventListener('dragover', (e) => {
    const row = dragging && e.target.closest?.('.prop-row[data-prop-row]');
    root.querySelectorAll('.prop-row.drop-before, .prop-row.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    if (!row || row.dataset.propRow.startsWith('v:') !== dragging.startsWith('v:')) return;
    e.preventDefault();
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  root.addEventListener('dragend', () => {
    dragging = null;
    root.querySelectorAll('.prop-row.drop-before, .prop-row.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
  });
  root.addEventListener('drop', (e) => {
    const row = dragging && e.target.closest?.('.prop-row[data-prop-row]');
    if (!row) return;
    e.preventDefault();
    const node = selected()[0];
    const after = e.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    const rows = [...root.querySelectorAll('.prop-row[data-prop-row]')].map((x) => x.dataset.propRow)
      .filter((k) => k.startsWith('v:') === dragging.startsWith('v:') && k !== dragging);
    const idx = rows.indexOf(row.dataset.propRow) + (after ? 1 : 0);
    const before = rows[idx] || null;
    if (dragging.startsWith('v:')) reorderVariantProperty(propsHost(node), dragging.slice(2), before ? before.slice(2) : null);
    else reorderComponentProp(node, dragging, before);
    dragging = null;
    commit();
  });
  root.addEventListener('dblclick', (e) => {
    const name = e.target.closest?.('.prop-row-name');
    const row = name?.closest('.prop-row[data-prop-row]');
    if (!row) return;
    // Rename in place (like Figma).
    const key = row.dataset.propRow;
    const input = document.createElement('input');
    input.className = 'prop-input prop-rename';
    input.value = name.textContent;
    name.replaceWith(input);
    input.focus();
    input.select();
    const done = (save) => {
      const node = selected()[0];
      if (save && input.value.trim() && input.value.trim() !== name.textContent) {
        if (key.startsWith('v:')) renameVariantProperty(propsHost(node), key.slice(2), input.value);
        else updateComponentProp(node, key, { name: input.value });
        commit();
      } else window.dispatchEvent(new CustomEvent('sigma:refresh-panel'));
    };
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') input.blur();
      if (ev.key === 'Escape') { input.value = name.textContent; input.blur(); }
    });
    input.addEventListener('blur', () => done(true), { once: true });
  });
  root.addEventListener('contextmenu', (e) => {
    const row = e.target.closest?.('.prop-row[data-prop-row]');
    if (!row) return;
    e.preventDefault();
    const node = selected()[0];
    const key = row.dataset.propRow;
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Edit property…', action: () => openPropWindow({ comp: node, ...(key.startsWith('v:') ? { variantProp: key.slice(2) } : { pid: key }), anchor: row.getBoundingClientRect() }) },
      { label: 'Delete property', action: () => deleteProp(node, key) },
    ]);
  });
}

// Layer ids a property row controls: bound layers of the main component, or (for an instance row) the
// instance's layers derived from them.
function highlightFor(row) {
  const node = selected()[0];
  if (!node) return [];
  if (row.dataset.propRow) {
    const key = row.dataset.propRow;
    if (key.startsWith('v:')) return [];
    return layersUsingProp(node, key).map((u) => u.layer.id);
  }
  const control = row.querySelector('[data-instance-prop], [data-prop-swap], [data-prop-icon]');
  const pid = control?.dataset.instanceProp || control?.dataset.propSwap || control?.dataset.propIcon;
  const inst = control && targetOf(control);
  const main = inst && mainComponentOf(inst);
  if (!pid || !main) return [];
  const sources = new Set(layersUsingProp(main, pid).map((u) => u.layer.id));
  const out = [];
  walk(inst.children || [], (n) => {
    if (sources.has(n.sourceId) && n.id.startsWith(`${inst.id}/`)) out.push(n.id);
  });
  return out;
}

// ---------- menus ----------
function addPropMenu(btn, node) {
  const r = btn.getBoundingClientRect();
  const comp = node;
  showContextMenu(r.right - 180, r.bottom + 4, [
    { label: 'Variant', action: () => addVariantProp(comp, r) },
    { label: 'Boolean', action: () => openPropWindow({ comp, type: 'boolean', anchor: r }) },
    { label: 'Instance swap', disabled: listComponents().length < 2, action: () => openPropWindow({ comp, type: 'instance', anchor: r }) },
    { label: 'Text', action: () => openPropWindow({ comp, type: 'text', anchor: r }) },
    { label: 'Icon', disabled: !iconLibraries().length, action: () => openPropWindow({ comp, type: 'icon', anchor: r }) },
    { label: 'Slot', action: () => openPropWindow({ comp, type: 'slot', anchor: r }) },
  ]);
}

// "+ → Variant": a main component becomes a component set (like Figma); a set gets a new property.
function addVariantProp(comp, r) {
  let set = propsHost(comp);
  if (set.type !== 'componentSet') {
    set = makeComponentSet(comp);
    if (!set) return;
    return openPropWindow({ comp: set, variantProp: Object.keys(variantDefs(set))[0], anchor: r });
  }
  const name = addVariantProperty(set);
  commit();
  openPropWindow({ comp: set, variantProp: name, anchor: r });
}

async function deleteProp(node, key) {
  const host = propsHost(node);
  if (key.startsWith('v:')) {
    if (!removeVariantProperty(host, key.slice(2))) return toast('A component set needs at least one variant property.');
    return commit();
  }
  const uses = layersUsingProp(node, key).length;
  const def = propsOf(node)[key];
  if (uses && !(await ask(`${uses} layer${uses === 1 ? ' uses' : 's use'} it; they keep their current state.`, { title: `Delete the property “${def?.name}”?`, ok: 'Delete property', danger: true }))) return;
  removeComponentProp(node, key);
  commit();
}

function compMenu(btn, node) {
  const r = btn.getBoundingClientRect();
  const set = node.type === 'componentSet' ? node : isVariant(node) ? getParent(node.id) : null;
  showContextMenu(r.right - 200, r.bottom + 4, [
    ...(node.type !== 'componentSet' ? [{ label: 'Create instance', action: () => duplicateSelection() }] : []),
    { label: 'Add variant', action: () => (set ? addVariant(set) : addVariantProp(node, r)) },
    { label: 'Edit description', action: () => { editingDescription = node.id; window.dispatchEvent(new CustomEvent('sigma:refresh-panel')); setTimeout(() => document.querySelector('.comp-desc-edit')?.focus(), 0); } },
    { label: 'Docs…', action: () => openDocsEditor(node) },
    '-',
    ...Object.entries(STATUSES).map(([k, l]) => ({ label: l, checked: statusOf(node)===k, action: () => {
      const t = docsTarget(node);
      editNode(t, ['status'], () => (k === 'draft' ? delete t.status : (t.status = k)));
      commit();
    } })),
    '-',
    isDeprecated(node)
      ? { label: 'Mark as not deprecated', action: () => { setDeprecated(node, false); commit(); } }
      : { label: set ? 'Deprecate component set' : 'Deprecate component', action: () => { setDeprecated(node, true); commit(); } },
  ]);
}

function instMenu(btn, inst) {
  const r = btn.getBoundingClientRect();
  const nested = isInsideInstance(inst);
  const owner = nested ? owningInstance(inst) : inst;
  const n = nested ? overrideCount(owner, inst.pathKey) : overrideCount(inst);
  showContextMenu(r.right - 200, r.bottom + 4, [
    { label: 'Go to main component', disabled: !mainComponentOf(inst), action: () => { select([inst.id]); goToMainComponent(); } },
    { label: n ? `Reset all changes (${n})` : 'Reset all changes', disabled: !n, action: () => { select([inst.id]); resetSelectionOverrides(); } },
    ...(nested ? [] : [{
      label: 'Push changes to main component', disabled: !n || !mainComponentOf(inst) || !!libraryOfComponent(mainComponentOf(inst)),
      action: () => {
        if (pushOverridesToMain(inst)) {
          commit();
          toast('Pushed the changes to the main component');
        }
      },
    }]),
    ...(nested ? [] : [{ label: 'Detach instance', shortcut: '⌥⌘B', action: () => { select([inst.id]); detachSelection(); } }]),
  ]);
}

function exposeMenu(btn, comp) {
  const r = btn.getBoundingClientRect();
  const nested = nestedInstances(comp);
  showContextMenu(r.left, r.bottom + 4, [
    { label: 'Expose controls on outer instances', disabled: true },
    ...nested.map((n) => ({
      label: exposureLabel(n,comp), checked: !!n.exposed,
      action: () => {
        if (n.exposed) delete n.exposed;
        else n.exposed = true;
        commit();
      },
    })),
  ]);
}

// ---------- component playground ----------
// Figma's component details: preview a component, try its properties (variants, toggles, text, swaps)
// and insert an instance with those choices. The preview instance only ever exists for a moment while
// its picture is drawn; nothing is saved until "Insert instance".
let play = null;

function previewSVG(mainId, propValues) {
  const main = getNode(mainId);
  if (!main) return '';
  const inst = createNode('instance', { name: main.name, componentId: main.id, w: main.w, h: main.h, overrides: {}, children: [], propValues: structuredClone(propValues) });
  insertNode(inst, null);
  syncInstances();
  const b = worldBounds(inst);
  const svg = `<svg viewBox="${b.x - 8} ${b.y - 8} ${b.w + 16} ${b.h + 16}" preserveAspectRatio="xMidYMid meet">${nodeWorldSVG(inst)}</svg>`;
  detach(inst);
  reindex();
  return svg;
}

export function openPlayground(componentId) {
  const start = getNode(componentId);
  if (!start) return;
  closePlayground();
  const set = isVariant(start) ? getParent(start.id) : null;
  play = { mainId: start.id, values: {} };
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = '<div class="modal playground"></div>';
  document.body.appendChild(el);
  play.el = el;
  const render = () => {
    const main = getNode(play.mainId);
    const defs = propsOf(main);
    const rows = [];
    if (set) {
      const current = parseVariantName(main.name);
      for (const [prop, values] of Object.entries(variantDefs(set))) {
        const t = toggleValues(values);
        rows.push(`<div class="inst-row"><span class="inst-label">${PROP_ICONS.variant}${esc(prop)}</span>` + (t
          ? toggle(`data-pg-toggle="${esc(prop)}" data-on="${esc(t.on)}" data-off="${esc(t.off)}"`, current[prop] === t.on)
          : `<select class="select" data-pg-variant="${esc(prop)}">${values.map((v) => `<option ${v === current[prop] ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`) + '</div>');
      }
    }
    for (const [pid, def] of Object.entries(defs)) {
      const v = play.values[pid] ?? effectiveDefault(def);
      let control;
      if (def.type === 'boolean') control = toggle(`data-pg-prop="${pid}"`, !!v);
      else if (def.type === 'text') control = `<input class="prop-input" data-pg-prop="${pid}" value="${esc(v ?? '')}" spellcheck="false">`;
      else if (def.type === 'icon') control = iconChoice(v, `data-pg-icon="${pid}"`);
      else {
        const options = listComponents().filter(({ node }) => canPlaceInside({ type: 'instance', componentId: node.id }, main));
        const pref = def.preferred || [];
        const ordered = [...options.filter(({ node }) => pref.includes(node.id)), ...options.filter(({ node }) => !pref.includes(node.id))];
        control = `<select class="select" data-pg-prop="${pid}">${ordered.map(({ node }) => `<option value="${node.id}" ${node.id === v ? 'selected' : ''}>${esc(isVariant(node) ? `${getParent(node.id).name} · ${node.name}` : node.name)}</option>`).join('')}</select>`;
      }
      rows.push(`<div class="inst-row"><span class="inst-label">${PROP_ICONS[def.type]}${esc(def.name)}</span>${control}</div>`);
    }
    const host = set || main;
    el.querySelector('.playground').innerHTML =
      `<div class="modal-head"><span class="comp-icon">${set ? SET_ICON : COMPONENT_ICON}</span> ${esc(host.name)}<button class="icon-btn" data-pg-close>${icons.close}</button></div>` +
      `<div class="pg-body"><div class="pg-preview">${previewSVG(play.mainId, play.values)}</div>` +
      `<div class="pg-side">${docsHTML(host) || (host.description ? `<div class="comp-desc">${esc(host.description)}</div>` : '')}` +
      `<div class="prop-sub">Properties</div>${rows.join('') || '<div class="muted">This component has no properties.</div>'}</div></div>` +
      '<div class="lib-footer"><button class="btn" data-pg-reset>Reset</button><span class="spacer"></span><button class="btn primary" data-pg-insert>Insert instance</button></div>';
  };
  play.render = render;
  render();
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-pg-close]')) return closePlayground();
    if (e.target.closest('[data-pg-reset]')) {
      play.mainId = set ? defaultVariant(set).id : start.id;
      play.values = {};
      return render();
    }
    if (e.target.closest('[data-pg-insert]')) return insertFromPlayground();
    const iconBtn = e.target.closest('[data-pg-icon]');
    if (iconBtn) {
      const pid = iconBtn.dataset.pgIcon;
      const def = propsOf(getNode(play.mainId))[pid];
      return openIconPicker({
        anchor: iconBtn.getBoundingClientRect(), currentId: play.values[pid] ?? def?.default, groups: def?.groups || null,
        onPick: (id) => {
          play.values[pid] = id;
          render();
        },
      });
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.pgVariant !== undefined || t.dataset.pgToggle !== undefined) {
      const prop = t.dataset.pgVariant ?? t.dataset.pgToggle;
      const value = t.dataset.pgVariant !== undefined ? t.value : t.checked ? t.dataset.on : t.dataset.off;
      const wanted = { ...parseVariantName(getNode(play.mainId).name), [prop]: value };
      let best = null, score = -1;
      for (const v of variantsOf(set)) {
        const p = parseVariantName(v.name);
        const sc = Object.entries(wanted).filter(([k, x]) => p[k] === x).length;
        if (sc > score) [best, score] = [v, sc];
      }
      if (best) play.mainId = best.id;
    } else if (t.dataset.pgProp) {
      play.values[t.dataset.pgProp] = t.type === 'checkbox' ? t.checked : t.value;
    } else return;
    render();
  });
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closePlayground();
  });
}

export function closePlayground() {
  play?.el.remove();
  play = null;
}

function insertFromPlayground() {
  const main = getNode(play.mainId);
  const values = play.values;
  closePlayground();
  window.dispatchEvent(new CustomEvent('sigma:insert-instance', { detail: { main, values } }));
}
