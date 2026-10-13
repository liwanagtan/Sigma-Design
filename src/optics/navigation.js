// Optics: navigation (Tabs, with Tab; Pagination, Navigation, Top bar, Fullscreen bar).
import { variantSet, variant, pid } from './kit.js';

export function buildNavigation(K, R) {
  const { text, icon, comp, frame, inst, side } = K;
  const NAV = 'Navigation';
  const { btn, iconBtn } = R.get('Button');
  const { badgeOf } = R.get('Badge');
  const avatar = R.get('Avatar').node;

  // ---------- Tabs ----------
  const tl = pid('label');
  const TAB = { Default: ['text/secondary', null], Hover: ['text/default', 'border/strong'], Selected: ['text/default', 'border/brand'], Disabled: ['text/disabled', null] };
  const tab = variantSet('Tab', [{ name: 'State', values: Object.keys(TAB) }], (s) => comp(s, {
    dir: 'horizontal', px: '300', py: '300', alignC: 'center', ...(TAB[s][1] ? { stroke: TAB[s][1], strokeWidth: 2, strokeSides: side('bottom') } : {}),
  }, [text('Label', 'Orders', TAB[s][0], s === 'Selected' ? 'body/md-semibold' : 'body/md-medium', { propRefs: { text: tl } })]), { cellW: 140, cellH: 72 });
  tab.props = { [tl]: { name: 'Label', type: 'text', default: 'Orders' } };
  const tabOf = (s, l) => inst(variant(tab, `State=${s}`), { name: 'Tab', propValues: { [tl]: l } });
  const tabs = comp('Tabs', { dir: 'horizontal', w: 480, stroke: 'border/default', strokeSides: side('bottom') }, [tabOf('Selected', 'All'), tabOf('Default', 'Unfulfilled'), tabOf('Default', 'Unpaid'), tabOf('Default', 'Open')]);
  R.add({
    name: 'Tabs', category: NAV, node: tabs, extra: [{ node: tab, codeName: 'OpticsTab', info: { role: 'tab', purpose: 'One tab of Tabs.' } }], tabOf,
    info: { purpose: 'Switches between views of the same content, like orders by status.', notFor: 'Moving to another page (use Navigation) or steps in order.', usage: 'Short labels, one or two words; the first tab is the default view.', role: 'none', keyboard: 'Tab moves focus to the selected tab; arrows move between tabs; Enter or Space selects one.' },
    usage: {
      do: ['Keep tab labels short.', () => [inst(tabs, { name: 'Tabs' })]],
      dont: ['Use tabs for steps people must do in order.', () => [frame('Steps', { dir: 'horizontal', stroke: 'border/default', strokeSides: side('bottom') }, [tabOf('Selected', 'Step 1: Details'), tabOf('Default', 'Step 2: Pay')])]],
    },
  });

  // ---------- Pagination ----------
  const pagination = variantSet('Pagination', [{ name: 'Type', values: ['Default', 'Table'] }], (t) => comp(t, {
    dir: 'horizontal', gap: '200', alignC: 'center', ...(t === 'Table' ? { w: 560, px: '300', py: '200', fill: 'bg/surface/secondary', radius: '200', spacing: 'auto' } : {}),
  }, t === 'Table'
    ? [text('Label', '1–50 of 1,240 orders', 'text/secondary', 'body/sm'), frame('Buttons', { dir: 'horizontal', gap: '100' }, [iconBtn('chevron-left', 'Previous page'), iconBtn('chevron-right', 'Next page')])]
    : [iconBtn('chevron-left', 'Previous page'), text('Label', 'Page 2 of 25', 'text/secondary', 'body/md'), iconBtn('chevron-right', 'Next page')]), { cellW: 600, cellH: 96 });
  R.add({
    name: 'Pagination', category: NAV, node: pagination,
    info: { purpose: 'Moves between pages of a long list or table.', notFor: 'Steps in a flow, or short lists (show them all).', usage: 'Say where people are; disable Previous on the first page and Next on the last.', role: 'navigation', keyboard: 'Previous and Next are tab stops; J and K can also move, where shortcuts are on.' },
    usage: {
      do: ['Say where people are in the list.', () => [inst(variant(pagination, 'Type=Default'), { name: 'Pagination' })]],
      dont: ['Page through a short list.', () => [frame('List', { dir: 'horizontal', gap: '200', alignC: 'center' }, [text('Label', '3 orders', 'text/secondary', 'body/md'), inst(variant(pagination, 'Type=Default'), { name: 'Pagination' })])]],
    },
  });

  // ---------- Navigation ----------
  // In the component its icons are its own; in examples (o.inst) they're Icon instances.
  const navItem = (ic, l, o = {}) => frame(l, { dir: 'horizontal', gap: '200', px: '300', py: '200', fillW: true, radius: '200', alignC: 'center', ...(o.on ? { fill: 'bg/surface/selected' } : {}), a11y: { role: 'link' } }, [
    o.inst ? R.get('Icon').iconOf(o.on ? 'Brand' : 'Subdued', ic) : icon('Icon', ic, o.on ? 'icon/brand' : 'icon/secondary', 20),
    text('Label', l, 'text/default', o.on ? 'body/md-semibold' : 'body/md-medium'), frame('Space', { fillW: true, h: 1 }),
    ...(o.badge ? [badgeOf('Info', o.badge)] : []),
  ]);
  const navigation = comp('Navigation', { dir: 'vertical', gap: '050', pad: '300', w: 240, fill: 'bg/surface/secondary', stroke: 'border/default', strokeSides: { top: false, right: true, bottom: false, left: false } }, [
    navItem('house', 'Home', { on: true }), navItem('inbox', 'Orders', { badge: '12' }), navItem('tag', 'Products'), navItem('users', 'Customers'), navItem('chart-column', 'Analytics'),
    frame('Divider', { fillW: true, h: 1, fill: 'border/default' }), navItem('settings', 'Settings'),
  ]);
  R.add({
    name: 'Navigation', category: NAV, node: navigation,
    info: { purpose: 'The app’s main menu: its sections, down the side.', notFor: 'Views of one page (use Tabs).', usage: 'An icon and a short noun per item; mark the current section; badges for counts that need attention.', role: 'navigation', keyboard: 'Each item is a tab stop and a link.' },
    usage: {
      do: ['Mark where people are.', () => [inst(navigation, { name: 'Navigation' })]],
      dont: ['Use verbs as section names.', () => [frame('Nav', { dir: 'vertical', w: 240, pad: '300', fill: 'bg/surface/secondary' }, [navItem('inbox', 'Manage your orders', { inst: true }), navItem('tag', 'Add products', { inst: true })])]],
    },
  });

  // ---------- Top bar ----------
  const topBar = comp('Top bar', { dir: 'horizontal', gap: '400', px: '400', py: '200', w: 1200, fill: 'bg/surface/inverse', alignC: 'center' }, [
    frame('Logo', { dir: 'horizontal', gap: '200', alignC: 'center', w: 220 }, [icon('Icon', 'store', 'icon/inverse', 24), text('Name', 'Optics Goods', 'text/inverse', 'body/md-semibold')]),
    frame('Search', { dir: 'horizontal', gap: '200', px: '300', py: '200', w: 480, fill: 'color/alpha/white-10', radius: '200', alignC: 'center' }, [icon('Icon', 'search', 'icon/inverse', 20), text('Placeholder', 'Search', 'text/inverse', 'body/md')]),
    frame('Space', { fillW: true, h: 1 }),
    frame('User', { dir: 'horizontal', gap: '200', alignC: 'center', a11y: { role: 'button', label: 'Account menu' } }, [inst(variant(avatar, 'Size=Small'), { name: 'Avatar' }), text('Name', 'Olivia Park', 'text/inverse', 'body/md-medium')]),
  ]);
  R.add({
    name: 'Top bar', category: NAV, node: topBar,
    info: { purpose: 'The bar across the top of the app: the store, a search, and the account menu.', notFor: 'Page actions (use Page).', usage: 'Keep it to the store, search and the account; it’s the same on every page.', role: 'none', keyboard: 'The search and account menu are tab stops.' },
    usage: {
      do: ['Keep it the same on every page.', () => [inst(topBar, { name: 'Top bar' })]],
      dont: ['Put page actions in the top bar.', () => [frame('Bar', { dir: 'horizontal', gap: '200', px: '400', py: '200', fill: 'bg/surface/inverse', alignC: 'center' }, [text('Name', 'Optics Goods', 'text/inverse', 'body/md-semibold'), btn('Primary', 'Save order')])]],
    },
  });

  // ---------- Fullscreen bar ----------
  const fullscreen = comp('Fullscreen bar', { dir: 'horizontal', gap: '300', px: '400', py: '200', w: 720, fill: 'bg/surface/default', stroke: 'border/default', strokeSides: side('bottom'), alignC: 'center' }, [
    btn('Tertiary', 'Exit'), frame('Divider', { w: 1, h: 24, fill: 'border/default' }), text('Title', 'Edit theme', 'text/default', 'heading/xs'), frame('Space', { fillW: true, h: 1 }), btn('Primary', 'Save'),
  ]);
  R.add({
    name: 'Fullscreen bar', category: NAV, node: fullscreen,
    info: { purpose: 'The bar of an app taken fullscreen, with a way back out.', notFor: 'Ordinary pages (use Page).', usage: 'Always an Exit on the left; the title says what’s being edited.', role: 'none', keyboard: 'Exit and the actions are tab stops; Escape exits too.' },
    usage: {
      do: ['Always give a way out.', () => [inst(fullscreen, { name: 'Fullscreen bar' })]],
      dont: ['Leave out Exit.', () => [frame('Bar', { dir: 'horizontal', gap: '300', px: '400', py: '200', w: 480, fill: 'bg/surface/default', stroke: 'border/default', alignC: 'center' }, [text('Title', 'Edit theme', 'text/default', 'heading/xs'), frame('Space', { fillW: true, h: 1 }), btn('Primary', 'Save')])]],
    },
  });
}
