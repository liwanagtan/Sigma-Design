// Optics: forms (Text field and its kinds: Email, Money, Number, Password, Search, URL, Date and Color field, Text
// area; Select, Checkbox, Choice list (with Radio button folded in), Switch, Color picker, Date picker, Drop zone,
// Range slider, Listbox, Autocomplete, Combobox, Option list, Filters, Index filters, Form layout).
import { variantSet, variant, pid } from './kit.js';

const FIELD = {
  Default: { stroke: 'border/strong' }, Hover: { stroke: 'border/hover' }, Focused: { stroke: 'border/focus', strokeWidth: 2 },
  Error: { stroke: 'border/critical' }, Disabled: { stroke: 'border/disabled', fill: 'bg/surface/disabled' },
};

export function buildForms(K, R) {
  const { text, para, icon, comp, frame, inst, side } = K;
  const FORMS = 'Forms';
  const { btn, iconBtn } = R.get('Button');
  const { chipOf } = R.get('Clickable chip');

  // ---------- fields ----------
  // A field set: label, an input (with what goes before and after the value), and help text (an error in Error).
  // o: { label, value, placeholder (the value is a placeholder), before: { icon | text | swatch }, after: { icon | text | stepper },
  //      help, error, multiline, w }
  const fields = {};
  const fieldSet = (name, states, o) => {
    const p = { label: pid('label'), value: pid('value'), help: pid('help'), showHelp: pid('show-help') };
    const w = o.w || 280;
    const make = (s) => {
      const f = FIELD[s];
      const off = s === 'Disabled';
      const before = o.before?.icon ? [icon('Before', o.before.icon, off ? 'icon/disabled' : 'icon/secondary', 20)]
        : o.before?.text ? [text('Before', o.before.text, off ? 'text/disabled' : 'text/secondary', 'body/md')]
          : o.before?.swatch ? [frame('Swatch', { w: 20, h: 20, fill: o.before.swatch, radius: '100', stroke: 'border/default' })] : [];
      const after = o.after?.icon ? [icon('After', o.after.icon, off ? 'icon/disabled' : 'icon/secondary', 20)]
        : o.after?.text ? [text('After', o.after.text, off ? 'text/disabled' : 'text/secondary', 'body/md')]
          : o.after?.stepper ? [frame('Stepper', { dir: 'vertical' }, [icon('Up', 'chevron-up', 'icon/secondary', 12), icon('Down', 'chevron-down', 'icon/secondary', 12)])] : [];
      const help = s === 'Error'
        ? frame('Help', { dir: 'horizontal', gap: '100', alignC: 'center' }, [icon('Icon', 'circle-alert', 'icon/critical', 16), text('Help text', o.error || 'Enter a valid value', 'text/critical', 'body/sm', { propRefs: { text: p.help } })])
        : text('Help text', o.help, off ? 'text/disabled' : 'text/secondary', 'body/sm', { propRefs: { text: p.help } });
      help.propRefs = { ...(help.propRefs || {}), visible: p.showHelp };
      return comp(s, { dir: 'vertical', gap: '100', w }, [
        text('Label', o.label, off ? 'text/disabled' : 'text/default', 'body/md-medium', { propRefs: { text: p.label } }),
        frame('Input', {
          dir: 'horizontal', gap: '200', px: '300', py: '300', fill: f.fill || 'bg/surface/default', stroke: f.stroke, strokeWidth: f.strokeWidth || 1,
          radius: '200', alignC: o.multiline ? 'start' : 'center', fillW: true, ...(o.multiline ? { h: 96 } : {}),
        }, [...before, para('Value', o.value, off ? 'text/disabled' : o.placeholder ? 'text/secondary' : 'text/default', 'body/md', { propRefs: { text: p.value } }), ...after]),
        help,
      ]);
    };
    const set = variantSet(name, [{ name: 'State', values: states }], make, { cellW: w + 40, cellH: o.multiline ? 196 : 120 });
    set.props = {
      [p.label]: { name: 'Label', type: 'text', default: o.label },
      [p.value]: { name: o.placeholder ? 'Placeholder' : 'Value', type: 'text', default: o.value },
      [p.help]: { name: 'Help text', type: 'text', default: o.help },
      [p.showHelp]: { name: 'Show help text', type: 'boolean', default: true },
    };
    fields[name] = { set, p };
    return set;
  };
  const fieldOf = (name, values = {}, state = 'Default') => {
    const { set, p } = fields[name];
    const propValues = {};
    for (const [k, v] of Object.entries(values)) propValues[p[k]] = v;
    return inst(variant(set, `State=${state}`), { name, propValues });
  };
  const ALL = ['Default', 'Hover', 'Focused', 'Error', 'Disabled'], FEW = ['Default', 'Focused', 'Error', 'Disabled'];
  const fieldKb = 'Tab moves focus to it; typing edits it. Its label and help text are announced; an error is announced when it appears.';
  const addField = (name, states, o, info, usage) => {
    const set = fieldSet(name, states, o);
    R.add({ name, category: FORMS, node: set, fieldOf, info: { role: 'textbox', keyboard: fieldKb, ...info }, usage });
    return set;
  };

  addField('Text field', ALL, { label: 'Store name', value: 'Optics Goods', help: 'Shown on your storefront and receipts', error: 'Store name is required' },
    { purpose: 'Lets people enter or edit a single line of text.', notFor: 'Text with its own format (use Email, Money, Number, URL or Date field) or long text (use Text area).', usage: 'A short label above, a hint below. Show errors under the field, in the Error state, saying how to fix it.' },
    { do: ['Give every field a visible label and a helpful hint.', () => [fieldOf('Text field')]], dont: ['Repeat the label as the value or placeholder.', () => [fieldOf('Text field', { value: 'Store name' })]] });
  addField('Email field', FEW, { label: 'Email', value: 'name@example.com', placeholder: true, before: { icon: 'mail' }, help: 'We’ll send receipts here', error: 'Enter an email like name@example.com' },
    { purpose: 'Lets people enter an email address, with the email keyboard on phones.', notFor: 'Several addresses (use Text area) or names.', usage: 'Check the format when people leave the field, and show an example in the error.' },
    { do: ['Show the expected format in the error.', () => [fieldOf('Email field', {}, 'Error')]], dont: ['Use a plain text field for emails.', () => [fieldOf('Text field', { label: 'Email', value: 'name@example.com', help: '' })]] });
  addField('Money field', FEW, { label: 'Price', value: '24.00', before: { text: '$' }, after: { text: 'USD' }, help: 'Before tax', error: 'Enter a price above $0' },
    { purpose: 'Lets people enter an amount of money, with its currency.', notFor: 'Quantities (use Number field).', usage: 'Show the currency, and format the amount when people leave the field.' },
    { do: ['Show the currency with the amount.', () => [fieldOf('Money field')]], dont: ['Leave the currency to guesswork.', () => [fieldOf('Text field', { label: 'Price', value: '24', help: '' })]] });
  addField('Number field', FEW, { label: 'Quantity', value: '12', after: { stepper: true }, help: 'In stock at this location', error: 'Enter a whole number' },
    { purpose: 'Lets people enter a number, with steppers to change it by one.', notFor: 'Money (use Money field) or numbers that are really codes, like a ZIP code.', usage: 'Set a minimum and maximum when there is one, and say it in the hint.' },
    { do: ['Use it for counts people adjust.', () => [fieldOf('Number field')]], dont: ['Use it for codes, like a ZIP code.', () => [fieldOf('Number field', { label: 'ZIP code', value: '10115', help: '' })]] });
  addField('Password field', FEW, { label: 'Password', value: '••••••••••', after: { icon: 'eye' }, help: 'At least 12 characters', error: 'Use at least 12 characters' },
    { purpose: 'Lets people enter a password, hidden, with a way to show it.', notFor: 'Anything that isn’t secret.', usage: 'Say the rules up front in the hint, and let people show what they typed.' },
    { do: ['Say the rules before people type.', () => [fieldOf('Password field')]], dont: ['Only reveal the rules after an error.', () => [fieldOf('Password field', { help: '' })]] });
  addField('Search field', FEW, { label: 'Search orders', value: 'Search by order or customer', placeholder: true, before: { icon: 'search' }, help: 'Results update as you type', error: 'Search for at least 2 characters' },
    { purpose: 'Lets people enter search terms.', notFor: 'Filtering by fixed values (use Filters).', usage: 'Say what can be searched in its label or placeholder.' },
    { do: ['Say what you can search for.', () => [fieldOf('Search field')]], dont: ['Use a vague placeholder.', () => [fieldOf('Search field', { value: 'Search…' })]] });
  addField('URL field', FEW, { label: 'Website', value: 'example.com', before: { text: 'https://' }, help: 'Your store’s address', error: 'Enter a web address like example.com' },
    { purpose: 'Lets people enter a web address, with the URL keyboard on phones.', notFor: 'Email addresses (use Email field).', usage: 'Add https:// for people, and check the address when they leave the field.' },
    { do: ['Fill in https:// so people don’t have to.', () => [fieldOf('URL field')]], dont: ['Ask for a full address in a plain field.', () => [fieldOf('Text field', { label: 'Website', value: 'https://www.example.com/', help: '' })]] });
  addField('Date field', FEW, { label: 'Ship by', value: 'Oct 14, 2026', after: { icon: 'calendar' }, help: 'Your local time', error: 'Choose a date after today' },
    { purpose: 'Lets people type a date or pick it from a calendar.', notFor: 'Ranges (use Date picker) or times only.', usage: 'Show the date the way people write it in their region.' },
    { do: ['Show dates as people write them.', () => [fieldOf('Date field')]], dont: ['Ask for a date as numbers in a plain field.', () => [fieldOf('Text field', { label: 'Ship by', value: '2026-10-14', help: '' })]] });
  addField('Color field', FEW, { label: 'Brand color', value: '#3549D6', before: { swatch: 'bg/fill/brand' }, help: 'Used for buttons and links', error: 'Enter a color like #3549D6' },
    { purpose: 'Lets people enter a color as a value, or pick it.', notFor: 'Choosing from a fixed set (use Color picker).', usage: 'Show the color next to its value.' },
    { do: ['Show the color with its value.', () => [fieldOf('Color field')]], dont: ['Show the value alone.', () => [fieldOf('Text field', { label: 'Brand color', value: '#3549D6', help: '' })]] });
  addField('Text area', FEW, { label: 'Description', value: 'Soft, breathable linen in four colors.', multiline: true, w: 360, help: 'Up to 500 characters', error: 'Keep it under 500 characters' },
    { purpose: 'Lets people enter several lines of text.', notFor: 'A single line (use Text field).', usage: 'Make it as tall as what people usually write, and say the limit if there is one.' },
    { do: ['Size it to what people will write.', () => [fieldOf('Text area')]], dont: ['Use a text area for a short value.', () => [fieldOf('Text area', { label: 'First name', value: 'Olivia' })]] });

  // ---------- Select ----------
  const select = fieldSet('Select', ['Default', 'Hover', 'Focused', 'Disabled'], { label: 'Country', value: 'Canada', after: { icon: 'chevron-down' }, help: 'Where your orders ship from' });
  R.add({
    name: 'Select', category: FORMS, node: select, fieldOf,
    info: { purpose: 'Lets people choose one option from a list.', notFor: 'Two to five options (use Choice list) or several choices (use Option list).', usage: 'Order options logically (alphabetically, or by how often they’re used). Give it a label.', role: 'combobox', keyboard: 'Tab moves focus to it; Space or Enter opens the list; arrows choose; Escape closes it.' },
    usage: { do: ['Use a select for a long list of known options.', () => [fieldOf('Select')]], dont: ['Use a select for two options: show both as a choice list.', () => [fieldOf('Select', { label: 'Gift wrap', value: 'No' })]] },
  });

  // ---------- Checkbox ----------
  const cbLabel = pid('label'), cbShow = pid('show-label');
  const checkbox = variantSet('Checkbox', [{ name: 'Checked', values: ['Off', 'On', 'Indeterminate'] }, { name: 'State', values: ['Default', 'Hover', 'Disabled'] }], (checked, state) => {
    const off = state === 'Disabled', on = checked !== 'Off';
    const fill = off ? 'bg/fill/disabled' : on ? (state === 'Hover' ? 'bg/fill/brand-hover' : 'bg/fill/brand') : state === 'Hover' ? 'bg/surface/hover' : 'bg/surface/default';
    const stroke = off ? 'border/disabled' : on ? 'border/brand' : state === 'Hover' ? 'border/hover' : 'border/strong';
    // A little side padding keeps it a 24px target when its label is hidden (in tables).
    return comp(checked, { dir: 'horizontal', gap: '200', px: '050', py: '300', alignC: 'center' }, [
      frame('Box', { w: 20, h: 20, dir: 'horizontal', fill, stroke, radius: '100', alignP: 'center', alignC: 'center' },
        on ? [icon('Check', checked === 'On' ? 'check' : 'minus', off ? 'icon/disabled' : 'icon/on-fill', 16)] : []),
      text('Label', 'Email me about orders', off ? 'text/disabled' : 'text/default', 'body/md', { propRefs: { text: cbLabel, visible: cbShow } }),
    ]);
  }, { cellW: 260, cellH: 64 });
  checkbox.props = { [cbLabel]: { name: 'Label', type: 'text', default: 'Email me about orders' }, [cbShow]: { name: 'Show label', type: 'boolean', default: true } };
  // A hidden label stays the checkbox's accessible name.
  const cbOf = (checked, l, state = 'Default', { hideLabel = false } = {}) => inst(variant(checkbox, `Checked=${checked}, State=${state}`), {
    name: 'Checkbox', propValues: { [cbLabel]: l, ...(hideLabel ? { [cbShow]: false } : {}) }, ...(hideLabel ? { a11y: { label: l } } : {}),
  });
  R.add({
    name: 'Checkbox', category: FORMS, node: checkbox, cbOf,
    info: { purpose: 'Turns an option on or off, independently of others.', notFor: 'One choice among several (use Choice list) or settings that apply at once (use Switch).', usage: 'Phrase labels positively. Indeterminate is for a parent whose children are partly checked.', role: 'checkbox', keyboard: 'Tab moves focus to it; Space checks or unchecks it.' },
    usage: {
      do: ['Use checkboxes for options people turn on independently.', () => [frame('Column', { dir: 'vertical', gap: '050' }, [cbOf('On', 'Email me about orders'), cbOf('Off', 'Text me about deliveries')])]],
      dont: ['Phrase options negatively: people have to work out what checking means.', () => [cbOf('Off', 'Don’t stop emails')]],
    },
  });

  // ---------- Choice list (with Radio button) ----------
  const radioRow = (l, on) => frame(l, { dir: 'horizontal', gap: '200', py: '300', alignC: 'center', a11y: { role: 'radio' } }, [
    frame('Circle', { w: 20, h: 20, dir: 'horizontal', fill: on ? 'bg/fill/brand' : 'bg/surface/default', stroke: on ? 'border/brand' : 'border/strong', radius: 'full', alignP: 'center', alignC: 'center' },
      on ? [frame('Dot', { w: 8, h: 8, fill: 'bg/surface/default', radius: 'full' })] : []),
    text('Label', l, 'text/default', 'body/md'),
  ]);
  const choice = variantSet('Choice list', [{ name: 'Type', values: ['Single', 'Multiple'] }], (t) => comp(t, { dir: 'vertical', w: 280 }, [
    text('Title', t === 'Single' ? 'Shipping speed' : 'Notify me about', 'text/default', 'body/md-medium'),
    ...(t === 'Single' ? [radioRow('Standard', true), radioRow('Express', false), radioRow('Overnight', false)] : [cbOf('On', 'New orders'), cbOf('Off', 'Refunds'), cbOf('On', 'Low stock')]),
  ]), { cellW: 320, cellH: 200 });
  R.add({
    name: 'Choice list', category: FORMS, node: choice,
    info: { purpose: 'A titled list of options: one choice (radio buttons) or several (checkboxes).', notFor: 'Long lists (use Select) or a single on/off option (use Checkbox).', usage: 'Two to five options in a column, with a sensible one selected for single choice.', role: 'list', keyboard: 'Tab moves focus to the list; arrows move a single choice; Space toggles a checkbox.' },
    usage: {
      do: ['Show a few options at once with one selected.', () => [inst(variant(choice, 'Type=Single'), { name: 'Choice list' })]],
      dont: ['Offer a single radio button: it can’t be turned off again.', () => [radioRow('I agree', false)]],
    },
  });

  // ---------- Switch ----------
  const swLabel = pid('label');
  const sw = variantSet('Switch', [{ name: 'Checked', values: ['Off', 'On'] }, { name: 'State', values: ['Default', 'Disabled'] }], (checked, state) => {
    const off = state === 'Disabled', on = checked === 'On';
    return comp(checked, { dir: 'horizontal', gap: '300', py: '300', alignC: 'center' }, [
      frame('Track', { w: 36, h: 20, dir: 'horizontal', px: '050', alignC: 'center', alignP: on ? 'end' : 'start', radius: 'full', fill: off ? 'bg/fill/disabled' : on ? 'bg/fill/brand' : 'border/strong' }, [
        frame('Knob', { w: 16, h: 16, fill: 'bg/surface/default', radius: 'full', shadow: '100' }),
      ]),
      text('Label', 'Accept online payments', off ? 'text/disabled' : 'text/default', 'body/md', { propRefs: { text: swLabel } }),
    ]);
  }, { cellW: 280, cellH: 64 });
  sw.props = { [swLabel]: { name: 'Label', type: 'text', default: 'Accept online payments' } };
  R.add({
    name: 'Switch', category: FORMS, node: sw,
    info: { purpose: 'Turns a setting on or off, taking effect right away.', notFor: 'Options submitted with a form (use Checkbox).', usage: 'Label the setting, not the action (“Online payments”, not “Turn on”). It applies at once, with no Save.', role: 'switch', keyboard: 'Tab moves focus to it; Space toggles it.' },
    usage: {
      do: ['Use a switch for a setting that applies at once.', () => [inst(variant(sw, 'Checked=On, State=Default'), { name: 'Switch' })]],
      dont: ['Use a switch in a form that needs Save.', () => [frame('Form', { dir: 'vertical', gap: '200' }, [inst(variant(sw, 'Checked=Off, State=Default'), { name: 'Switch', propValues: { [swLabel]: 'Gift wrap' } }), btn('Primary', 'Save')])]],
    },
  });

  // ---------- Color picker ----------
  const hues = ['brand', 'azure', 'green', 'yellow', 'orange', 'red', 'purple', 'gray'];
  const swatchRow = (step) => frame(`Step ${step}`, { dir: 'horizontal', gap: '100' }, hues.map((h) => frame(`${h}/${step}`, {
    w: 24, h: 24, radius: '100', fill: `color/${h}/${step}`,
    ...(h === 'brand' && step === 600 ? { stroke: 'border/focus', strokeWidth: 2, strokeAlign: 'outside' } : {}),
  })));
  const picker = comp('Color picker', { dir: 'vertical', gap: '300', pad: '400', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '300' }, [
    swatchRow(300), swatchRow(500), swatchRow(600), swatchRow(700),
    fieldOf('Color field', { help: '' }),
  ]);
  R.add({
    name: 'Color picker', category: FORMS, node: picker,
    info: { purpose: 'Lets people pick a color from a palette, or enter its value.', notFor: 'Free choice where any color works badly (offer a few presets instead).', usage: 'Show the selected color clearly, and keep its value editable.', role: 'none', keyboard: 'Arrows move between colors; Enter chooses one; its field is a tab stop.' },
    usage: {
      do: ['Show which color is selected.', () => [inst(picker, { name: 'Color picker' })]],
      dont: ['Show colors with no way to type an exact value.', () => [swatchRow(500)]],
    },
  });

  // ---------- Date picker ----------
  const cell = (d, o = {}) => frame(String(d), { w: 36, h: 36, dir: 'horizontal', alignP: 'center', alignC: 'center', radius: 'full', ...(o.fill ? { fill: o.fill } : {}) }, d === '' ? [] : [text('Day', String(d), o.color || 'text/default', 'body/md')]);
  const days = [['', '', '', 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17, 18], [19, 20, 21, 22, 23, 24, 25], [26, 27, 28, 29, 30, 31, '']];
  const datePicker = comp('Date picker', { dir: 'vertical', gap: '200', pad: '400', fill: 'bg/surface/default', stroke: 'border/default', radius: '300' }, [
    frame('Header', { dir: 'horizontal', alignC: 'center', w: 252, spacing: 'auto' }, [iconBtn('chevron-left', 'Previous month', 'Icon only'), text('Month', 'October 2026', 'text/default', 'heading/xs'), iconBtn('chevron-right', 'Next month', 'Icon only')]),
    frame('Weekdays', { dir: 'horizontal' }, ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => frame(d, { w: 36, h: 24, dir: 'horizontal', alignP: 'center', alignC: 'center' }, [text('Day', d, 'text/secondary', 'body/sm')]))),
    ...days.map((wk, i) => frame(`Week ${i + 1}`, { dir: 'horizontal' }, wk.map((d) => cell(d, d === 14 ? { fill: 'bg/fill/brand', color: 'text/on-fill' } : {})))),
  ]);
  R.add({
    name: 'Date picker', category: FORMS, node: datePicker,
    info: { purpose: 'Lets people pick a date, or a range of dates, on a calendar.', notFor: 'Dates people know by heart, like a birthday (use Date field).', usage: 'Start on the month people most likely need, and mark today and the selection.', role: 'none', keyboard: 'Arrows move between days; Page Up and Page Down change month; Enter selects.' },
    usage: {
      do: ['Open on the month people most likely need.', () => [inst(datePicker, { name: 'Date picker' })]],
      dont: ['Make people page through months for a far-off date: let them type it.', () => [fieldOf('Text field', { label: 'Date of birth', value: 'Pick on the calendar', help: '' })]],
    },
  });

  // ---------- Drop zone ----------
  const DROP = { Default: ['bg/surface/secondary', 'border/strong'], Hover: ['bg/surface/selected', 'border/brand'], Error: ['bg/surface/critical', 'border/critical'] };
  const drop = variantSet('Drop zone', [{ name: 'State', values: Object.keys(DROP) }], (s) => comp(s, { dir: 'vertical', gap: '300', pad: '800', w: 400, fill: DROP[s][0], stroke: DROP[s][1], radius: '300', alignC: 'center' }, [
    icon('Icon', 'upload', s === 'Error' ? 'icon/critical' : 'icon/secondary', 24),
    btn('Secondary', 'Add files'),
    text('Hint', s === 'Error' ? 'Only .jpg and .png files' : 'or drop files to upload', s === 'Error' ? 'text/critical' : 'text/secondary', 'body/sm'),
  ]), { cellW: 440, cellH: 200 });
  R.add({
    name: 'Drop zone', category: FORMS, node: drop,
    info: { purpose: 'Lets people upload files by dropping them, or by choosing them with a button.', notFor: 'Text input.', usage: 'Say which files are accepted. Show the hover state while files are dragged over it.', role: 'none', keyboard: 'Its button is a tab stop and opens the file chooser.' },
    usage: {
      do: ['Say which files are accepted when one isn’t.', () => [inst(variant(drop, 'State=Error'), { name: 'Drop zone' })]],
      dont: ['Offer only dragging: give a button too.', () => [frame('Drop', { dir: 'vertical', pad: '800', w: 320, fill: 'bg/surface/secondary', stroke: 'border/strong', radius: '300', alignC: 'center' }, [text('Hint', 'Drop files here', 'text/secondary', 'body/md')])]],
    },
  });

  // ---------- Range slider ----------
  const slider = variantSet('Range slider', [{ name: 'State', values: ['Default', 'Disabled'] }], (s) => {
    const off = s === 'Disabled';
    return comp(s, { dir: 'vertical', gap: '200', w: 280 }, [
      frame('Header', { dir: 'horizontal', fillW: true, spacing: 'auto' }, [text('Label', 'Discount', off ? 'text/disabled' : 'text/default', 'body/md-medium'), text('Value', '50%', off ? 'text/disabled' : 'text/secondary', 'body/md')]),
      frame('Track', { dir: 'horizontal', alignC: 'center', fillW: true, h: 20 }, [
        frame('Filled', { w: 130, h: 4, fill: off ? 'border/disabled' : 'border/brand', radius: 'full' }),
        frame('Thumb', { w: 20, h: 20, fill: 'bg/surface/default', stroke: off ? 'border/disabled' : 'border/brand', strokeWidth: 2, radius: 'full', shadow: '100' }),
        frame('Rest', { fillW: true, h: 4, fill: 'border/default', radius: 'full' }),
      ]),
    ]);
  }, { cellW: 320, cellH: 88 });
  R.add({
    name: 'Range slider', category: FORMS, node: slider,
    info: { purpose: 'Lets people choose a value in a range by dragging.', notFor: 'Exact values (use Number field, or show one next to it).', usage: 'Show the value as it changes, and the range’s ends if they help.', role: 'slider', keyboard: 'Arrows change the value by a step; Home and End go to the ends.' },
    usage: {
      do: ['Show the value as people drag.', () => [inst(variant(slider, 'State=Default'), { name: 'Range slider' })]],
      dont: ['Use a slider when people need an exact number.', () => [frame('Price', { dir: 'vertical', gap: '100' }, [text('Label', 'Exact price', 'text/default', 'body/md-medium'), inst(variant(slider, 'State=Default'), { name: 'Range slider' })])]],
    },
  });

  // ---------- Listbox, Autocomplete, Combobox, Option list ----------
  const option = (l, on = false, hover = false) => frame(l, { dir: 'horizontal', gap: '200', px: '300', py: '200', radius: '200', alignC: 'center', fillW: true, ...(hover ? { fill: 'bg/surface/hover' } : {}) }, [
    text('Label', l, 'text/default', 'body/md'), frame('Space', { fillW: true, h: 1 }), ...(on ? [icon('Check', 'check', 'icon/brand', 20)] : []),
  ]);
  const listbox = comp('Listbox', { dir: 'vertical', w: 240, pad: '100', gap: '050', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '300' }, [
    option('Accessories', true), option('Bags', false, true), option('Shoes'), option('Watches'),
  ]);
  R.add({
    name: 'Listbox', category: 'Lists and tables', node: listbox,
    info: { purpose: 'A list of options to choose from, inside Autocomplete, Combobox and menus of choices.', notFor: 'Actions (use Menu).', usage: 'Show which option is selected with a check, and which has focus with a fill.', role: 'list', keyboard: 'Arrows move between options; Enter selects one.' },
    usage: { do: ['Mark the selected option with a check.', () => [inst(listbox, { name: 'Listbox' })]], dont: ['Show selection by color alone.', () => [frame('List', { dir: 'vertical', w: 200 }, [option('Accessories', false, true), option('Bags')])]] },
  });
  const autocomplete = comp('Autocomplete', { dir: 'vertical', gap: '100', w: 280 }, [fieldOf('Search field', { label: 'Product type', value: 'Ac', help: '' }), inst(listbox, { name: 'Suggestions' })]);
  R.add({
    name: 'Autocomplete', category: FORMS, node: autocomplete,
    info: { purpose: 'Suggests matching options as people type.', notFor: 'A short fixed list (use Select).', usage: 'Show suggestions after a character or two, and let people choose with the keyboard.', role: 'combobox', keyboard: 'Typing filters; arrows move through suggestions; Enter chooses; Escape closes.' },
    usage: { do: ['Suggest as people type.', () => [inst(autocomplete, { name: 'Autocomplete' })]], dont: ['Use it for three options.', () => [fieldOf('Select', { label: 'Size', value: 'Medium' })]] },
  });
  const combobox = comp('Combobox', { dir: 'vertical', gap: '100', w: 280 }, [fieldOf('Select', { label: 'Tags', value: 'Accessories', help: '' }), inst(listbox, { name: 'Options' })]);
  R.add({
    name: 'Combobox', category: FORMS, node: combobox,
    info: { purpose: 'A field with a list of options that people can also type to filter, for one or several values.', notFor: 'Free text (use Text field).', usage: 'Show chosen values in the field, and keep the list short by filtering.', role: 'combobox', keyboard: 'Typing filters; arrows move; Enter toggles an option; Escape closes.' },
    usage: { do: ['Let people filter a long list.', () => [inst(combobox, { name: 'Combobox' })]], dont: ['Hide what’s been chosen.', () => [fieldOf('Select', { label: 'Tags', value: 'Choose…', help: '' })]] },
  });
  const optionList = comp('Option list', { dir: 'vertical', w: 280, pad: '200', fill: 'bg/surface/default', stroke: 'border/default', radius: '300' }, [
    text('Title', 'Sales channels', 'text/default', 'body/md-medium'), cbOf('On', 'Online store'), cbOf('On', 'Point of sale'), cbOf('Off', 'Wholesale'),
  ]);
  R.add({
    name: 'Option list', category: 'Lists and tables', node: optionList,
    info: { purpose: 'A titled list of options in a popover or panel, for one or several choices.', notFor: 'Forms with a few options in the page (use Choice list).', usage: 'Group options under a title; keep labels short.', role: 'list', keyboard: 'Arrows move between options; Space toggles one.' },
    usage: { do: ['Title the group of options.', () => [inst(optionList, { name: 'Option list' })]], dont: ['Mix unrelated options in one list.', () => [frame('List', { dir: 'vertical' }, [cbOf('On', 'Online store'), cbOf('Off', 'Dark mode')])]] },
  });

  // ---------- Filters, Index filters, Form layout ----------
  const filters = comp('Filters', { dir: 'horizontal', gap: '200', pad: '200', w: 720, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', alignC: 'center' }, [
    frame('Search', { dir: 'horizontal', gap: '200', px: '300', py: '200', fillW: true, stroke: 'border/strong', radius: '200', alignC: 'center' }, [icon('Icon', 'search', 'icon/secondary', 20), text('Placeholder', 'Filter orders', 'text/secondary', 'body/md')]),
    chipOf('Selected', 'Paid'), chipOf('Default', 'Tagged with'), btn('Plain', 'Clear all'),
  ]);
  R.add({
    name: 'Filters', category: FORMS, node: filters,
    info: { purpose: 'Narrows a list or table with a search and filter chips.', notFor: 'Switching between saved views (use Index filters, or Tabs).', usage: 'Show applied filters as chips, with a way to clear them all.', role: 'none', keyboard: 'The search and each chip are tab stops.' },
    usage: { do: ['Show what’s filtered, and how to clear it.', () => [inst(filters, { name: 'Filters' })]], dont: ['Hide applied filters behind a menu.', () => [btn('Secondary', 'Filters (2)')]] },
  });
  R.add({ name: 'Form layout', category: FORMS, node: comp('Form layout', { dir: 'vertical', gap: '400' }, [
    fieldOf('Text field', { label: 'Store name', value: 'Optics Goods', help: '' }),
    frame('Group', { dir: 'horizontal', gap: '400' }, [fieldOf('Text field', { label: 'First name', value: 'Olivia', help: '' }), fieldOf('Text field', { label: 'Last name', value: 'Park', help: '' })]),
    fieldOf('Email field', { help: '' }),
  ]),
  info: { purpose: 'Arranges form fields with even spacing, alone or side by side in groups.', notFor: 'Page layout (use Layout).', usage: 'One field per row; group short related fields (first and last name) side by side.', role: 'none', keyboard: 'Fields are tab stops in reading order.' },
  usage: {
    do: ['Group related short fields side by side.', () => [frame('Group', { dir: 'horizontal', gap: '400' }, [fieldOf('Text field', { label: 'City', value: 'Toronto', help: '' }), fieldOf('Text field', { label: 'Postal code', value: 'M5V 2T6', help: '' })])]],
    dont: ['Put unrelated fields on one row.', () => [frame('Group', { dir: 'horizontal', gap: '400' }, [fieldOf('Text field', { label: 'Store name', value: 'Optics Goods', help: '' }), fieldOf('Password field', { help: '' })])]],
  } });
}

// Index filters uses Tabs, so it's added after navigation.
export function buildIndexFilters(K, R) {
  const { comp, frame, inst } = K;
  const { iconBtn } = R.get('Button');
  const { tabOf } = R.get('Tabs');
  const node = comp('Index filters', { dir: 'horizontal', w: 720, px: '200', alignC: 'center', fill: 'bg/surface/default', stroke: 'border/default', radius: '300' }, [
    frame('Views', { dir: 'horizontal', fillW: true }, [tabOf('Selected', 'All'), tabOf('Default', 'Unfulfilled'), tabOf('Default', 'Unpaid')]),
    iconBtn('search', 'Search and filter', 'Icon only'), iconBtn('arrow-up-down', 'Sort', 'Icon only'),
  ]);
  R.add({
    name: 'Index filters', category: 'Forms', node,
    info: { purpose: 'Saved views of a list as tabs, with search, filters and sorting on demand.', notFor: 'A single list with a few filters (use Filters).', usage: 'Name views by what they show; open search and filters from the icons.', role: 'none', keyboard: 'Views are tabs (arrows move between them); the icons are tab stops.' },
    usage: { do: ['Name each view by what it shows.', () => [inst(node, { name: 'Index filters' })]], dont: ['Name views vaguely.', () => [frame('Views', { dir: 'horizontal' }, [tabOf('Selected', 'View 1'), tabOf('Default', 'View 2')])]] },
  });
}
