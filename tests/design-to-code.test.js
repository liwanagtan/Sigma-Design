// Design to code for components (src/component-diff.js, src/css-rules.js).
import { test, eq, ok } from './harness.js';
import { parseRules, editRules } from '../src/css-rules.js';
import { componentDiff, rootCSS } from '../src/component-diff.js';
import { compareBoxes } from '../src/capture-to-sigma.js';

const CSS = `.button {
  display: inline-flex;
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
}

.button:hover {
  background: var(--accent-hover);
}

.button--danger {
  background: var(--danger);
}

.card {
  padding: 20px;
}

@media (max-width: 640px) {
  .button {
    padding: 4px;
  }
}
`;

test('css rules: rules are found by selector, outside @media unless asked', () => {
  const rules = parseRules(CSS);
  eq(rules.map((r) => [r.at, r.selector]), [['', '.button'], ['', '.button:hover'], ['', '.button--danger'], ['', '.card'], ['@media (max-width: 640px)', '.button']]);
  eq(rules[0].decls.map((d) => [d.prop, d.value]), [['display', 'inline-flex'], ['padding', 'var(--space-2) var(--space-4)'], ['background', 'var(--accent)']]);
});

test('css rules: edits change only the value, add declarations and rules in the file’s style', () => {
  const { text, applied } = editRules(CSS, [
    { selector: '.button', prop: 'padding', value: 'var(--space-2) 16px' },
    { selector: '.button--danger', prop: 'color', value: 'var(--color-gray-0)' },
    { selector: '.button--secondary', prop: 'background', value: 'var(--surface-sunken)' },
    { selector: '.button:hover', prop: 'background', value: null },
  ]);
  ok(text.includes('  padding: var(--space-2) 16px;\n  background: var(--accent);'));
  ok(text.includes('    padding: 4px;'), 'the breakpoint’s rule is left alone');
  ok(text.includes('.button--danger {\n  background: var(--danger);\n  color: var(--color-gray-0);\n}'));
  ok(text.includes('.button--danger {\n  background: var(--danger);\n  color: var(--color-gray-0);\n}\n\n.button--secondary {\n  background: var(--surface-sunken);\n}\n\n.card'), 'a new rule goes after its block’s last rule');
  ok(text.includes('.button:hover {\n}'));
  eq(applied.map((a) => [a.selector, a.prop, a.before, a.after]), [
    ['.button', 'padding', 'var(--space-2) var(--space-4)', 'var(--space-2) 16px'],
    ['.button--danger', 'color', null, 'var(--color-gray-0)'],
    ['.button--secondary', 'background', null, 'var(--surface-sunken)'],
    ['.button:hover', 'background', 'var(--accent-hover)', null],
  ]);
});

// A button set as saved in a library file: Variant (Primary, Danger) × State (Default, Hover).
const codes = { t1: '--accent', t2: '--accent-hover', t3: '--danger', t4: '--space-2', t5: '--space-4', t6: '--color-gray-0', t7: '--surface-sunken' };
const codeOf = (id) => codes[id] || null;
const variant = (name, bg, over = {}) => ({
  id: name, type: 'component', name, fills: [{}], bindings: { 'fills.0.color': bg, 'layout.pt': 't4', 'layout.pb': 't4', 'layout.pl': 't5', 'layout.pr': 't5' },
  layout: { mode: 'horizontal', gap: 8, pt: 8, pr: 20, pb: 8, pl: 20, alignC: 'center' }, sizingH: 'hug', sizingV: 'hug',
  children: [{ id: `${name}-label`, type: 'text', name: 'Label', text: 'Continue', fills: [{}], bindings: { 'fills.0.color': 't6' }, fontWeight: 600, propRefs: { text: 'button-label' } }],
  ...over,
});
const buttonSet = () => ({
  id: 'button', type: 'componentSet', name: 'Button',
  props: { 'button-label': { type: 'text', name: 'Label', default: 'Continue', codeName: 'label' } },
  children: [
    variant('Variant=Primary, State=Default', 't1'), variant('Variant=Primary, State=Hover', 't2'),
    variant('Variant=Danger, State=Default', 't3'), variant('Variant=Danger, State=Hover', 't2'),
  ],
});
const entry = {
  name: 'Button', source: 'src/components/button.js', variantCodeNames: { Variant: 'variant' },
  props: [{ name: 'Label', type: 'text', codeName: 'label' }],
  match: { selector: '.button', variants: { Variant: { Danger: '.button--danger', Primary: '*' }, State: { Default: '*' } } },
  captures: [{ variant: { Variant: 'Primary', State: 'Default' }, file: 'button-primary-default.json', element: '#button-primary' }],
};

test('design to code: the CSS a component’s root is written with, from its bindings', () => {
  const css = rootCSS(variant('V', 't1'), codeOf);
  eq([css.background, css.padding, css.gap, css.color, css['font-weight']], ['var(--accent)', 'var(--space-2) var(--space-4)', '8px', 'var(--color-gray-0)', '600']);
});

test('design to code: a change in every variant edits the component’s rule; one value’s, that value’s rule', () => {
  const before = buttonSet();
  const after = buttonSet();
  for (const v of after.children) {
    delete v.bindings['layout.pl'];
    delete v.bindings['layout.pr'];
    v.layout.pl = v.layout.pr = 16;
  }
  after.children[2].bindings['fills.0.color'] = 't7';
  const d = componentDiff(before, after, { entry, codeOf });
  eq(d.css.map((e) => [e.selector, e.prop, e.value]), [['.button', 'padding', 'var(--space-2) 16px'], ['.button--danger', 'background', 'var(--surface-sunken)']]);
  eq(d.agent, [], 'nothing left for the agent');
});

test('design to code: a new variant value gets a rule like its siblings’, and the manifest learns it', () => {
  const before = buttonSet();
  const after = buttonSet();
  const sec = variant('Variant=Secondary, State=Default', 't7');
  sec.children[0].bindings['fills.0.color'] = 't1';
  after.children.push(sec);
  const d = componentDiff(before, after, { entry, codeOf });
  eq(d.css.map((e) => [e.selector, e.prop, e.value]), [['.button--secondary', 'background', 'var(--surface-sunken)'], ['.button--secondary', 'color', 'var(--accent)']]);
  eq(d.manifest.variants, { Variant: { Secondary: '.button--secondary' } });
  eq(d.manifest.captures, [{ variant: { Variant: 'Secondary', State: 'Default' }, file: 'button-secondary-default.json', element: '#button-secondary' }]);
  ok(d.agent.some((a) => /`variant` = 'secondary'/.test(a)), 'the agent is told what the code needs');
});

test('design to code: a property default is edited where the code declares it; layer changes go to the agent', () => {
  const before = buttonSet();
  const after = buttonSet();
  after.props['button-label'].default = 'Save';
  after.children[0].children.push({ id: 'x', type: 'icon', name: 'Icon', iconId: 'plus' });
  const source = "export function Button({ label = 'Continue', variant = 'primary' }) {}";
  const d = componentDiff(before, after, { entry, codeOf, source });
  eq(d.code, [{ file: 'src/components/button.js', find: "label = 'Continue'", replace: "label = 'Save'", why: 'Button: Label defaults to "Save"' }]);
  ok(d.diff.includes('Button / Variant=Primary, State=Default / Icon: added (icon)'));
  ok(/1 visual change/.test(d.agent[0]));
});

test('compare: colors count too, a text’s color and a box’s background', () => {
  const capture = { name: 'B', box: { x: 0, y: 0, w: 10, h: 10 }, style: { 'background-color': 'rgb(255, 0, 0)' }, children: [
    { tag: 'span', name: 'Label', box: { x: 0, y: 0, w: 10, h: 10 }, style: { color: 'rgb(0, 0, 255)' } },
  ] };
  const sigma = { name: 'B', box: { x: 0, y: 0, w: 10, h: 10 }, background: '#FF0000', children: [{ name: 'Label', box: { x: 0, y: 0, w: 10, h: 10 }, color: '#000000' }] };
  eq(compareBoxes(sigma, capture), [{ layer: 'B / Label', what: 'color', code: '#0000FF', sigma: '#000000' }]);
});
