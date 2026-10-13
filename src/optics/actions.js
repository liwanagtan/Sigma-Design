// Optics: actions (Button, with Icon only folded in; Button group, Clickable, Clickable chip, Link, Menu, Account
// connection, Page actions).
import { variantSet, variant, pid } from './kit.js';

const STATES = ['Default', 'Hover', 'Pressed', 'Focused', 'Disabled'];
export const BUTTON = {
  Primary: { fill: ['bg/fill/brand', 'bg/fill/brand-hover', 'bg/fill/brand-active'], text: 'text/on-fill', icon: 'icon/on-fill' },
  Secondary: { fill: ['bg/fill/default', 'bg/fill/hover', 'bg/fill/active'], text: 'text/default', icon: 'icon/default', stroke: 'border/strong' },
  Tertiary: { fill: ['bg/fill/transparent', 'bg/fill/transparent-hover', 'bg/fill/transparent-active'], text: 'text/default', icon: 'icon/default' },
  Critical: { fill: ['bg/fill/critical', 'bg/fill/critical-hover', 'bg/fill/critical-active'], text: 'text/on-fill', icon: 'icon/on-fill' },
  Plain: { fill: ['bg/fill/transparent', 'bg/fill/transparent', 'bg/fill/transparent'], text: 'text/link', icon: 'icon/brand', hoverText: 'text/link-hover' },
  'Icon only': { fill: ['bg/fill/default', 'bg/fill/hover', 'bg/fill/active'], text: 'text/default', icon: 'icon/default', stroke: 'border/strong', iconOnly: true },
};

export function buildActions(K, R) {
  const { text, para, icon, comp, frame, inst, side } = K;
  const ACTIONS = 'Actions';

  // ---------- Button ----------
  const label = pid('label'), showIcon = pid('show-icon'), iconProp = pid('icon');
  const buttonVariant = (v, state) => {
    const st = BUTTON[v];
    const off = state === 'Disabled';
    const i = state === 'Hover' ? 1 : state === 'Pressed' ? 2 : 0;
    const fill = off ? (v === 'Tertiary' || v === 'Plain' ? 'bg/fill/transparent' : 'bg/fill/disabled') : st.fill[i];
    const color = off ? 'text/disabled' : state === 'Hover' && st.hoverText ? st.hoverText : st.text;
    const o = { dir: 'horizontal', gap: '200', px: st.iconOnly ? '300' : '400', py: '300', fill, radius: '200', alignP: 'center', alignC: 'center' };
    if (state === 'Focused') Object.assign(o, { stroke: 'border/focus', strokeWidth: 2, strokeAlign: 'outside' });
    else if (st.stroke) Object.assign(o, { stroke: off ? 'border/disabled' : st.stroke });
    // An icon-only button needs a name for screen readers: "More actions" (its default icon); instances say theirs.
    if (st.iconOnly) o.a11y = { label: 'More actions' };
    return comp(v, o, st.iconOnly
      ? [icon('Icon', 'ellipsis', off ? 'icon/disabled' : st.icon, 20, { propRefs: { iconId: iconProp } })]
      : [
        icon('Icon', 'plus', off ? 'icon/disabled' : st.icon, 20, { visible: false, propRefs: { iconId: iconProp, visible: showIcon } }),
        text('Label', 'Button', color, 'body/md-medium', { propRefs: { text: label } }),
      ]);
  };
  const button = variantSet('Button', [{ name: 'Variant', values: Object.keys(BUTTON) }, { name: 'State', values: STATES }], buttonVariant, { cellW: 150, cellH: 72 });
  button.props = {
    [label]: { name: 'Label', type: 'text', default: 'Button' },
    [showIcon]: { name: 'Show icon', type: 'boolean', default: false },
    [iconProp]: { name: 'Icon', type: 'icon', default: 'optics-plus' },
  };
  const btn = (v, labelText, props = {}) => inst(variant(button, `Variant=${v}, State=Default`), { name: 'Button', propValues: { [label]: labelText }, ...props });
  const iconBtn = (iconName, a11yLabel, v = 'Icon only') => inst(variant(button, `Variant=${v}, State=Default`), { name: a11yLabel, propValues: { [iconProp]: `optics-${iconName}` }, a11y: { label: a11yLabel } });
  R.add({
    name: 'Button', category: ACTIONS, node: button, props: { label, showIcon, icon: iconProp }, btn, iconBtn,
    info: { purpose: 'Lets people take an action: save, continue, delete. Icon only is for well-known actions where space is tight.', notFor: 'Navigation (use Link) or toggling a setting (use Checkbox or Switch).', usage: 'One Primary per view, for the main action. Secondary for the rest, Tertiary and Plain for low emphasis, Critical for destructive actions. Label with a verb. Icon only always has an accessible label (and a Tooltip with the same words).', role: 'button', keyboard: 'Tab moves focus to it; Enter or Space activates it. Announced as its label and “button”.' },
    usage: {
      do: ['Lead with one primary action, with secondary ones beside it.', () => [btn('Secondary', 'Cancel'), btn('Primary', 'Save')]],
      dont: ['Put two primary buttons side by side: nobody can tell which matters.', () => [btn('Primary', 'Save'), btn('Primary', 'Publish')]],
    },
  });

  // ---------- Button group ----------
  const group = variantSet('Button group', [{ name: 'Variant', values: ['Default', 'Segmented'] }], (v) => comp(v, { dir: 'horizontal', gap: v === 'Default' ? '200' : '0' },
    v === 'Default' ? [btn('Secondary', 'Cancel'), btn('Primary', 'Save')] : [btn('Secondary', 'Day'), btn('Secondary', 'Week'), btn('Secondary', 'Month')]), { cellW: 280, cellH: 76 });
  R.add({
    name: 'Button group', category: ACTIONS, node: group,
    info: { purpose: 'Puts related buttons together, evenly spaced, or joined as a segmented control.', notFor: 'Unrelated actions, or more than three or four buttons (use Menu for the rest).', usage: 'The primary action goes last. Segmented groups are for switching between views of the same thing.', role: 'none', keyboard: 'Each button is a tab stop.' },
    usage: {
      do: ['Group a form’s actions, with the primary last.', () => [inst(variant(group, 'Variant=Default'), { name: 'Button group' })]],
      dont: ['Crowd many actions into one group.', () => [btn('Secondary', 'Copy'), btn('Secondary', 'Move'), btn('Secondary', 'Archive'), btn('Secondary', 'Print')]],
    },
  });

  // ---------- Clickable ----------
  const clickable = variantSet('Clickable', [{ name: 'State', values: ['Default', 'Hover', 'Focused'] }], (s) => comp(s, {
    dir: 'horizontal', gap: '300', pad: '300', radius: '300', alignC: 'center', w: 320,
    ...(s === 'Hover' ? { fill: 'bg/surface/hover' } : {}), ...(s === 'Focused' ? { stroke: 'border/focus', strokeWidth: 2, strokeAlign: 'outside' } : {}),
  }, [
    icon('Icon', 'truck', 'icon/default', 20),
    frame('Content', { dir: 'vertical', fillW: true }, [text('Title', 'Shipping and delivery', 'text/default', 'body/md-semibold'), text('Detail', 'Rates, carriers and packages', 'text/secondary', 'body/sm')]),
    icon('Chevron', 'chevron-right', 'icon/secondary', 20),
  ]), { cellW: 360, cellH: 88 });
  R.add({
    name: 'Clickable', category: ACTIONS, node: clickable,
    info: { purpose: 'Makes a custom area clickable, when Button and Link don’t fit: a settings row, a card that opens.', notFor: 'Anything a Button or Link can do.', usage: 'Make the whole area react: a hover fill, a focus ring, and one clear destination.', role: 'link', keyboard: 'Tab moves focus to it; Enter opens it.' },
    usage: {
      do: ['Make a whole settings row open its page.', () => [inst(variant(clickable, 'State=Default'), { name: 'Clickable' })]],
      dont: ['Put buttons inside a clickable area: two actions in one place.', () => [frame('Row', { dir: 'horizontal', gap: '200', alignC: 'center' }, [inst(variant(clickable, 'State=Default'), { name: 'Clickable' }), btn('Secondary', 'Edit')])]],
    },
  });

  // ---------- Clickable chip ----------
  const cc = pid('label');
  const clickChip = variantSet('Clickable chip', [{ name: 'State', values: ['Default', 'Hover', 'Selected', 'Disabled'] }], (s) => {
    const off = s === 'Disabled', on = s === 'Selected';
    return comp(s, { dir: 'horizontal', gap: '100', px: '300', py: '150', radius: 'full', alignC: 'center', stroke: off ? 'border/disabled' : on ? 'border/brand' : 'border/strong', fill: on ? 'bg/surface/selected' : s === 'Hover' ? 'bg/surface/hover' : 'bg/surface/default' }, [
      ...(on ? [icon('Check', 'check', 'icon/brand', 16)] : []),
      text('Label', 'Paid', off ? 'text/disabled' : 'text/default', 'body/md', { propRefs: { text: cc } }),
    ]);
  }, { cellW: 120, cellH: 56 });
  clickChip.props = { [cc]: { name: 'Label', type: 'text', default: 'Paid' } };
  const chipOf = (s, l) => inst(variant(clickChip, `State=${s}`), { name: 'Clickable chip', propValues: { [cc]: l } });
  R.add({
    name: 'Clickable chip', category: ACTIONS, node: clickChip, props: { label: cc }, chipOf,
    info: { purpose: 'A chip people click: a quick filter, a suggestion, a choice to toggle.', notFor: 'Labels that do nothing (use Chip) or main actions (use Button).', usage: 'Short labels. Selected shows a check, so it doesn’t rely on color.', role: 'button', keyboard: 'Tab moves focus to it; Enter or Space toggles it.' },
    usage: {
      do: ['Offer quick filters as clickable chips.', () => [chipOf('Selected', 'Paid'), chipOf('Default', 'Unpaid'), chipOf('Default', 'Refunded')]],
      dont: ['Use a clickable chip for the main action of a page.', () => [chipOf('Default', 'Publish store')]],
    },
  });

  // ---------- Link ----------
  const lk = pid('label');
  const link = variantSet('Link', [{ name: 'Tone', values: ['Default', 'Monochrome'] }, { name: 'State', values: ['Default', 'Hover'] }], (t, s) => comp(t, { dir: 'horizontal', py: '050' }, [
    text('Label', 'View order', t === 'Monochrome' ? (s === 'Hover' ? 'text/default' : 'text/secondary') : s === 'Hover' ? 'text/link-hover' : 'text/link', 'body/md', { propRefs: { text: lk } }),
  ]), { cellW: 140, cellH: 48 });
  link.props = { [lk]: { name: 'Label', type: 'text', default: 'View order' } };
  const linkOf = (l) => inst(variant(link, 'Tone=Default, State=Default'), { name: 'Link', propValues: { [lk]: l } });
  R.add({
    name: 'Link', category: ACTIONS, node: link, props: { label: lk }, linkOf,
    info: { purpose: 'Takes people to another page or place, in or next to text.', notFor: 'Actions that change something (use Button).', usage: 'Say where it goes (“View order”, not “Click here”). Monochrome inside colored text, like a banner.', role: 'link', keyboard: 'Tab moves focus to it; Enter follows it.' },
    usage: {
      do: ['Say where the link goes.', () => [text('Text', 'Order #1024 was paid.', 'text/default', 'body/md'), linkOf('View order')]],
      dont: ['Use vague link text.', () => [text('Text', 'For your order,', 'text/default', 'body/md'), linkOf('click here')]],
    },
  });

  // ---------- Menu (and the older Action list) ----------
  const item = (name, iconName, color = 'text/default', iconColor = 'icon/default') => frame(name, { dir: 'horizontal', gap: '200', px: '300', py: '200', radius: '200', alignC: 'center', fillW: true, a11y: { role: 'menuitem' } }, [
    icon('Icon', iconName, iconColor, 20), text('Label', name, color, 'body/md'),
  ]);
  const menu = comp('Menu', { dir: 'vertical', w: 240, pad: '100', gap: '050', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '400' }, [
    item('Duplicate', 'copy'), item('Edit', 'pencil'), item('Share', 'share-2'),
    frame('Divider', { h: 1, fillW: true, fill: 'border/default' }),
    item('Delete', 'trash', 'text/critical', 'icon/critical'),
  ]);
  R.add({
    name: 'Menu', category: ACTIONS, node: menu,
    info: { purpose: 'A list of actions on something, shown when people open it (the older Action list).', notFor: 'Navigation (use Navigation) or choices (use Select or Option list).', usage: 'Short verbs, most-used first, destructive actions last and in red, after a divider.', role: 'list', keyboard: 'Arrows move between items; Enter runs one; Escape closes the menu.' },
    usage: {
      do: ['Put the destructive action last, after a divider.', () => [inst(menu, { name: 'Menu' })]],
      dont: ['Use a menu for a single action: show it as a button.', () => [inst(menu, { name: 'Menu' }), btn('Secondary', 'Duplicate')]],
    },
  });

  // ---------- Account connection, Page actions (use Avatar from content.js) ----------
  const avatar = R.get('Avatar').node;
  const account = variantSet('Account connection', [{ name: 'State', values: ['Connected', 'Disconnected'] }], (s) => comp(s, { dir: 'horizontal', gap: '300', pad: '400', w: 520, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', alignC: 'center' }, [
    inst(variant(avatar, 'Size=Medium'), { name: 'Avatar' }),
    frame('Account', { dir: 'vertical', fillW: true }, [text('Name', s === 'Connected' ? 'Olivia Park' : 'Optics shipping', 'text/default', 'body/md-semibold'), text('Status', s === 'Connected' ? 'Connected as olivia@example.com' : 'No account connected', 'text/secondary', 'body/sm')]),
    s === 'Connected' ? btn('Secondary', 'Disconnect') : btn('Primary', 'Connect'),
  ]), { cellW: 560, cellH: 100 });
  R.add({
    name: 'Account connection', category: ACTIONS, node: account,
    info: { purpose: 'Connects or disconnects an account with another service, and says which one is connected.', notFor: 'Signing in to the admin itself.', usage: 'Name the account and the service. Connect is primary while nothing is connected.', role: 'none', keyboard: 'Its button is a tab stop.' },
    usage: {
      do: ['Say which account is connected.', () => [inst(variant(account, 'State=Connected'), { name: 'Account connection' })]],
      dont: ['Hide the connected account behind a vague label.', () => [btn('Secondary', 'Manage')]],
    },
  });
  const pageActions = comp('Page actions', { dir: 'horizontal', w: 720, pt: '400', spacing: 'auto', alignC: 'center', stroke: 'border/default', strokeSides: side('top') }, [
    btn('Critical', 'Delete product'), btn('Primary', 'Save'),
  ]);
  R.add({
    name: 'Page actions', category: ACTIONS, node: pageActions,
    info: { purpose: 'The actions for a whole page, at its bottom: save on the right, a destructive action on the left.', notFor: 'Actions on part of a page (put them in its Section).', usage: 'One primary action. Keep the destructive action apart, on the left.', role: 'none', keyboard: 'Its buttons are tab stops, the primary last.' },
    usage: {
      do: ['Keep save on the right and delete on the left, far apart.', () => [inst(pageActions, { name: 'Page actions' })]],
      dont: ['Put delete right next to save.', () => [frame('Actions', { dir: 'horizontal', gap: '200' }, [btn('Critical', 'Delete product'), btn('Primary', 'Save')])]],
    },
  });
}
