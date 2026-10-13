// Optics: overlays (Modal, Popover, Sheet, Tooltip) and utilities (Collapsible, Contextual save bar, App frame, Loading,
// Toast).
import { variantSet, variant } from './kit.js';

export function buildOverlays(K, R) {
  const { text, para, icon, comp, frame, inst, side } = K;
  const OVERLAYS = 'Overlays', UTILITIES = 'Utilities';
  const { btn, iconBtn } = R.get('Button');
  const menu = R.get('Menu').node;
  const { fieldOf } = R.get('Text field');
  const navigation = R.get('Navigation').node, topBar = R.get('Top bar').node, page = R.get('Page').node;

  // ---------- Tooltip ----------
  const tooltip = comp('Tooltip', { dir: 'horizontal', px: '200', py: '100', fill: 'bg/surface/inverse', radius: '200', shadow: '200' }, [text('Text', 'Duplicate', 'text/inverse', 'body/sm')]);
  const tipped = (b, tip) => frame('With tooltip', { dir: 'vertical', gap: '100', alignC: 'center' }, [inst(tip, { name: 'Tooltip' }), b]);
  R.add({
    name: 'Tooltip', category: OVERLAYS, node: tooltip,
    info: { purpose: 'A short label that appears on hover or focus, mostly for icon-only buttons.', notFor: 'Information people need to finish a task (show it in the page).', usage: 'A few words, the same as the button’s accessible label. Never put links or buttons in a tooltip.', role: 'none', keyboard: 'Shows when its button gets focus; Escape hides it.' },
    usage: {
      do: ['Name an icon-only button.', () => [tipped(iconBtn('copy', 'Duplicate'), tooltip)]],
      dont: ['Hide essential information in a tooltip.', () => [frame('With tooltip', { dir: 'vertical', gap: '100', alignC: 'center' }, [
        frame('Tooltip', { dir: 'horizontal', px: '200', py: '100', w: 220, fill: 'bg/surface/inverse', radius: '200' }, [para('Text', 'Your password must have 12 characters, a number and a symbol', 'text/inverse', 'body/sm')]),
        R.get('Icon').iconOf('Subdued', 'info')])]],
    },
  });

  // ---------- Popover ----------
  const popover = comp('Popover', { dir: 'vertical', gap: '100', alignC: 'start' }, [btn('Secondary', 'More actions'), inst(menu, { name: 'Menu' })]);
  R.add({
    name: 'Popover', category: OVERLAYS, node: popover,
    info: { purpose: 'A small layer opened by a button, holding a menu, options or a short form.', notFor: 'Tasks that need focus (use Modal) or short labels (use Tooltip).', usage: 'Open it from a button that says what’s inside; close it on Escape or a click outside.', role: 'dialog', keyboard: 'Enter or Space opens it from its button; focus moves into it; Escape closes it and returns focus.' },
    usage: {
      do: ['Open a popover from a button that says what’s in it.', () => [inst(popover, { name: 'Popover' })]],
      dont: ['Put a long form in a popover.', () => [frame('Popover', { dir: 'vertical', gap: '300', pad: '400', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '300' }, [fieldOf('Text field', { help: '' }), fieldOf('Email field', { help: '' }), fieldOf('Password field', { help: '' })])]],
    },
  });

  // ---------- Modal ----------
  const modalBody = (title, body, actions) => [
    frame('Header', { dir: 'horizontal', px: '400', py: '300', fillW: true, alignC: 'center', spacing: 'auto', stroke: 'border/default', strokeSides: side('bottom') }, [text('Title', title, 'text/default', 'heading/sm'), iconBtn('x', 'Close')]),
    frame('Body', { dir: 'vertical', pad: '400', fillW: true }, [para('Body', body, 'text/default', 'body/md')]),
    frame('Footer', { dir: 'horizontal', gap: '200', px: '400', py: '300', fillW: true, alignP: 'end', stroke: 'border/default', strokeSides: side('top') }, actions),
  ];
  const MODAL = { Small: 380, Medium: 620 };
  const modal = variantSet('Modal', [{ name: 'Size', values: Object.keys(MODAL) }], (s) => comp(s, { dir: 'vertical', w: MODAL[s], fill: 'bg/surface/default', radius: '400', shadow: '600', clip: true },
    modalBody('Delete product?', 'Linen shirt will be deleted for good. This can’t be undone.', [btn('Secondary', 'Cancel'), btn('Critical', 'Delete product')])), { cellW: 660, cellH: 260 });
  R.add({
    name: 'Modal', category: OVERLAYS, node: modal,
    info: { purpose: 'Interrupts to ask for a decision or a short task, over the page.', notFor: 'Information that can sit in the page, or long forms (use a page).', usage: 'Title it with the question; name buttons with the action (“Delete product”, not “OK”). Always a way to close.', role: 'dialog', keyboard: 'Focus moves into it and stays there; Escape closes it; focus returns to what opened it.' },
    usage: {
      do: ['Name the buttons with the action.', () => [inst(variant(modal, 'Size=Small'), { name: 'Modal' })]],
      dont: ['Ask with Yes and No.', () => [frame('Modal', { dir: 'vertical', w: 380, fill: 'bg/surface/default', radius: '400', shadow: '600', clip: true }, modalBody('Are you sure?', 'This can’t be undone.', [btn('Secondary', 'No'), btn('Primary', 'Yes')]))]],
    },
  });

  // ---------- Sheet ----------
  const sheet = comp('Sheet', { dir: 'vertical', w: 380, h: 480, fill: 'bg/surface/default', shadow: '600', stroke: 'border/default', strokeSides: { top: false, right: false, bottom: false, left: true } }, [
    frame('Header', { dir: 'horizontal', px: '400', py: '300', fillW: true, alignC: 'center', spacing: 'auto', stroke: 'border/default', strokeSides: side('bottom') }, [text('Title', 'Filter orders', 'text/default', 'heading/sm'), iconBtn('x', 'Close')]),
    frame('Body', { dir: 'vertical', gap: '400', pad: '400', fillW: true, fillH: true }, [fieldOf('Select', { label: 'Payment', value: 'Paid', help: '' }), fieldOf('Date field', { label: 'Placed after', help: '' })]),
    frame('Footer', { dir: 'horizontal', gap: '200', px: '400', py: '300', fillW: true, alignP: 'end', stroke: 'border/default', strokeSides: side('top') }, [btn('Secondary', 'Clear'), btn('Primary', 'Apply')]),
  ]);
  R.add({
    name: 'Sheet', category: OVERLAYS, node: sheet,
    info: { purpose: 'A panel that slides in from the side, for secondary tasks that keep the page in view.', notFor: 'Decisions (use Modal) or primary tasks (use a page).', usage: 'Title it with its task; actions at the foot; close on Escape.', role: 'dialog', keyboard: 'Focus moves into it; Escape closes it and returns focus.' },
    usage: {
      do: ['Use it for a task that needs the page in view.', () => [inst(sheet, { name: 'Sheet' })]],
      dont: ['Open a sheet for a yes-or-no question.', () => [frame('Sheet', { dir: 'vertical', gap: '300', pad: '400', w: 380, fill: 'bg/surface/default', shadow: '600' }, [text('Title', 'Delete product?', 'text/default', 'heading/sm'), btn('Critical', 'Delete')])]],
    },
  });

  // ---------- Collapsible ----------
  const collapsible = variantSet('Collapsible', [{ name: 'Open', values: ['False', 'True'] }], (o) => comp(o === 'True' ? 'Open' : 'Closed', { dir: 'vertical', gap: '200', w: 400 }, [
    frame('Trigger', { dir: 'horizontal', gap: '200', py: '200', alignC: 'center', a11y: { role: 'button' } }, [icon('Chevron', o === 'True' ? 'chevron-down' : 'chevron-right', 'icon/default', 20), text('Label', 'Shipping details', 'text/default', 'body/md-semibold')]),
    ...(o === 'True' ? [para('Content', 'Ships from Toronto in 1–2 business days, by tracked post.', 'text/secondary', 'body/md')] : []),
  ]), { cellW: 440, cellH: 140 });
  R.add({
    name: 'Collapsible', category: UTILITIES, node: collapsible,
    info: { purpose: 'Shows and hides a section of content behind a heading.', notFor: 'Content people always need (show it).', usage: 'The trigger says what’s inside; the chevron shows whether it’s open.', role: 'none', keyboard: 'The trigger is a button: Enter or Space opens and closes it.' },
    usage: {
      do: ['Say what’s inside.', () => [inst(variant(collapsible, 'Open=True'), { name: 'Collapsible' })]],
      dont: ['Hide what people need to finish their task.', () => [frame('Hidden', { dir: 'horizontal', gap: '200', py: '200', alignC: 'center' }, [R.get('Icon').iconOf('Base', 'chevron-right'), text('Label', 'Required fields', 'text/default', 'body/md-semibold')])]],
    },
  });

  // ---------- Contextual save bar ----------
  const saveBar = comp('Contextual save bar', { dir: 'horizontal', gap: '300', px: '400', py: '200', w: 1200, fill: 'bg/surface/inverse', alignC: 'center' }, [
    icon('Icon', 'circle-alert', 'icon/inverse', 20), text('Message', 'Unsaved changes', 'text/inverse', 'body/md-semibold'), frame('Space', { fillW: true, h: 1 }),
    btn('Secondary', 'Discard'), btn('Primary', 'Save'),
  ]);
  R.add({
    name: 'Contextual save bar', category: UTILITIES, node: saveBar,
    info: { purpose: 'Replaces the top bar when a page has unsaved changes, with Save and Discard.', notFor: 'Forms that save on their own, or settings (use Switch).', usage: 'Show it as soon as something changes; always both Save and Discard.', role: 'none', keyboard: 'Save and Discard are tab stops.' },
    usage: {
      do: ['Offer both Save and Discard.', () => [inst(saveBar, { name: 'Contextual save bar' })]],
      dont: ['Leave people without a way to undo.', () => [frame('Bar', { dir: 'horizontal', gap: '300', px: '400', py: '200', w: 480, fill: 'bg/surface/inverse', alignC: 'center' }, [text('Message', 'Unsaved changes', 'text/inverse', 'body/md-semibold'), frame('Space', { fillW: true, h: 1 }), btn('Primary', 'Save')])]],
    },
  });

  // ---------- App frame (Polaris's Frame: a plain "Frame" reads as an unnamed layer) ----------
  const appFrame = comp('App frame', { dir: 'vertical', w: 1200, fill: 'bg/page', clip: true, stroke: 'border/default', radius: '300' }, [
    inst(topBar, { name: 'Top bar' }),
    frame('Body', { dir: 'horizontal', fillW: true }, [inst(navigation, { name: 'Navigation', sizingV: 'fill' }), frame('Main', { dir: 'vertical', pad: '400', fillW: true }, [inst(page, { name: 'Page' })])]),
  ]);
  R.add({
    name: 'App frame', category: UTILITIES, node: appFrame,
    info: { purpose: 'The app’s outer structure: the top bar, the navigation, and the page in between.', notFor: 'Fullscreen tasks (use Fullscreen bar).', usage: 'One frame per app; pages change inside it.', role: 'none', keyboard: 'A “Skip to content” link comes first, then the top bar, navigation and page.' },
    usage: {
      do: ['Keep the top bar and navigation the same on every page.', () => [inst(appFrame, { name: 'App frame' })]],
      dont: ['Drop the navigation on some pages.', () => [frame('Frame', { dir: 'vertical', w: 720, fill: 'bg/page', stroke: 'border/default', radius: '300', clip: true }, [frame('Main', { dir: 'vertical', pad: '400', fillW: true }, [inst(page, { name: 'Page' })])])]],
    },
  });

  // ---------- Loading ----------
  const loading = comp('Loading', { dir: 'horizontal', w: 1200, h: 4, fill: 'bg/surface/tertiary', a11y: { role: 'img', label: 'Loading' } }, [frame('Progress', { w: 480, h: 4, fill: 'bg/fill/brand' })]);
  R.add({
    name: 'Loading', category: UTILITIES, node: loading,
    info: { purpose: 'A thin bar across the top while a page loads.', notFor: 'Loading part of a page (use Spinner or Skeleton).', usage: 'Show it while moving between pages; one at a time.', role: 'img', keyboard: 'Not focusable; announced as “Loading”.' },
    usage: {
      do: ['Show it at the very top while a page loads.', () => [frame('Top', { dir: 'vertical', w: 480 }, [inst(loading, { name: 'Loading', w: 480, sizingH: 'fixed' }), frame('Page', { w: 480, h: 80, fill: 'bg/page' })])]],
      dont: ['Use it for part of a page.', () => [frame('Card', { dir: 'vertical', gap: '200', pad: '400', w: 320, fill: 'bg/surface/default', stroke: 'border/default', radius: '300' }, [text('Title', 'Sales', 'text/default', 'heading/sm'), frame('Bar', { w: 288, h: 4, fill: 'bg/fill/brand' })])]],
    },
  });

  // ---------- Toast ----------
  const toast = variantSet('Toast', [{ name: 'Tone', values: ['Default', 'Critical'] }], (t) => comp(t, { dir: 'horizontal', gap: '300', pl: '400', pr: '200', py: '200', fill: t === 'Critical' ? 'bg/fill/critical' : 'bg/surface/inverse', radius: '300', shadow: '400', alignC: 'center' }, [
    text('Message', t === 'Critical' ? 'Couldn’t save product' : 'Product saved', t === 'Critical' ? 'text/on-fill' : 'text/inverse', 'body/md-medium'),
    frame('Close', { w: 32, h: 32, dir: 'horizontal', alignP: 'center', alignC: 'center', radius: '200', a11y: { role: 'button', label: 'Dismiss' } }, [icon('Icon', 'x', t === 'Critical' ? 'icon/on-fill' : 'icon/inverse', 16)]),
  ]), { cellW: 320, cellH: 88 });
  R.add({
    name: 'Toast', category: UTILITIES, node: toast,
    info: { purpose: 'A short message, at the foot of the screen, confirming something just happened.', notFor: 'Errors people must act on (use Banner) or anything long.', usage: 'Two or three words (“Product saved”); it goes away on its own.', role: 'none', keyboard: 'Announced politely; its dismiss button is a tab stop.' },
    usage: {
      do: ['Confirm in a few words.', () => [inst(variant(toast, 'Tone=Default'), { name: 'Toast' })]],
      dont: ['Write a sentence in a toast.', () => [frame('Toast', { dir: 'horizontal', px: '400', py: '300', w: 360, fill: 'bg/surface/inverse', radius: '300' }, [para('Message', 'Your product has been saved and will be visible in your store in a few minutes.', 'text/inverse', 'body/md')])]],
    },
  });
}
