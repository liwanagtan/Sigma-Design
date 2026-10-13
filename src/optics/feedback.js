// Optics: feedback and status (Badge, Banner, Empty state, Progress, Spinner, Skeleton, Exception list, Inline
// error).
import { variantSet, variant, pid } from './kit.js';

export function buildFeedback(K, R) {
  const { text, para, icon, comp, frame, inst } = K;
  const FEEDBACK = 'Feedback and status';
  const { btn } = R.get('Button');

  // ---------- Badge ----------
  const bd = pid('label');
  const TONES = { Neutral: 'neutral', Info: 'info', Success: 'success', Caution: 'caution', Warning: 'warning', Critical: 'critical', Magic: 'magic' };
  const badge = variantSet('Badge', [{ name: 'Tone', values: Object.keys(TONES) }], (t) => {
    const k = TONES[t];
    return comp(t, { dir: 'horizontal', px: '200', py: '050', fill: k === 'critical' ? 'bg/fill/critical-subtle' : `bg/fill/${k}`, radius: '200', alignC: 'center' }, [
      text('Label', t === 'Neutral' ? 'Draft' : t, k === 'neutral' ? 'text/default' : `text/${k}`, 'body/sm-medium', { propRefs: { text: bd } }),
    ]);
  }, { cellW: 120, cellH: 44 });
  badge.props = { [bd]: { name: 'Label', type: 'text', default: 'Badge' } };
  const badgeOf = (t, l) => inst(variant(badge, `Tone=${t}`), { name: 'Badge', propValues: { [bd]: l } });
  R.add({
    name: 'Badge', category: FEEDBACK, node: badge, props: { label: bd }, badgeOf,
    info: { purpose: 'Shows a short status: Paid, Draft, Needs review.', notFor: 'Actions (badges aren’t clickable) or long text.', usage: 'One or two words. Choose the tone by meaning: Success for done, Caution and Warning for attention, Critical for problems.', role: 'none', keyboard: 'Not focusable; read with the content it describes.' },
    usage: {
      do: ['Use a badge for a short status next to what it describes.', () => [text('Order', 'Order #1024', 'text/default', 'body/md'), badgeOf('Success', 'Paid')]],
      dont: ['Stack many tones together: the colors stop meaning anything.', () => [badgeOf('Info', 'Info'), badgeOf('Caution', 'Caution'), badgeOf('Magic', 'Magic'), badgeOf('Critical', 'Critical')]],
    },
  });

  // ---------- Banner ----------
  const bnTitle = pid('title'), bnBody = pid('body');
  const BANNER = { Info: ['info', 'info'], Success: ['success', 'circle-check'], Warning: ['warning', 'triangle-alert'], Critical: ['critical', 'circle-alert'] };
  const banner = variantSet('Banner', [{ name: 'Tone', values: Object.keys(BANNER) }], (t) => {
    const [k, ic] = BANNER[t];
    return comp(t, { dir: 'horizontal', gap: '300', pad: '400', w: 480, fill: `bg/surface/${k}`, stroke: `border/${k}`, radius: '300' }, [
      icon('Icon', ic, `icon/${k}`, 20),
      frame('Content', { dir: 'vertical', gap: '100', fillW: true }, [
        para('Title', 'Your store is ready to sell', 'text/default', 'heading/xs', { propRefs: { text: bnTitle } }),
        para('Body', 'Add a payment provider to start taking orders.', 'text/default', 'body/md', { propRefs: { text: bnBody } }),
      ]),
    ]);
  }, { cellW: 520, cellH: 120 });
  banner.props = {
    [bnTitle]: { name: 'Title', type: 'text', default: 'Your store is ready to sell' },
    [bnBody]: { name: 'Body', type: 'text', default: 'Add a payment provider to start taking orders.' },
  };
  const bannerOf = (t, title, body) => inst(variant(banner, `Tone=${t}`), { name: 'Banner', propValues: { [bnTitle]: title, [bnBody]: body } });
  R.add({
    name: 'Banner', category: FEEDBACK, node: banner, bannerOf,
    info: { purpose: 'Tells people about something important on the page: a problem, a success, a change.', notFor: 'Confirmations of small actions (use Toast) or permanent content.', usage: 'A title that says what happened, a body that says what to do. Use the tone that matches the urgency.', role: 'none', keyboard: 'Not focusable itself; its title is announced when it appears.' },
    usage: {
      do: ['Say what happened and what to do next, in the right tone.', () => [bannerOf('Critical', 'Payment failed', 'Update your card to keep your plan.')]],
      dont: ['Use a banner for something that isn’t news: it trains people to ignore banners.', () => [bannerOf('Info', 'Welcome back', 'You have 3 orders.')]],
    },
  });

  // ---------- Empty state ----------
  const empty = comp('Empty state', { dir: 'vertical', gap: '400', pad: '1000', w: 480, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', alignC: 'center' }, [
    K.picture('Illustration', 160, 120, { icon: 'inbox' }),
    text('Title', 'Manage your inventory', 'text/default', 'heading/md', { textAlign: 'center' }),
    para('Body', 'Track stock and get alerts when products run low.', 'text/secondary', 'body/md', { textAlign: 'center' }),
    btn('Primary', 'Add product'),
  ]);
  R.add({
    name: 'Empty state', category: FEEDBACK, node: empty,
    info: { purpose: 'Explains why a page, list or table has nothing to show, and offers the next action.', notFor: 'Errors (use Banner) or loading (use Skeleton or Spinner).', usage: 'Say what will be here and how to get started, with one primary action.', role: 'none', keyboard: 'Its button is a tab stop.' },
    usage: {
      do: ['Explain the value and offer the first step.', () => [inst(empty, { name: 'Empty state' })]],
      dont: ['Leave an empty page that just says “Nothing here”.', () => [frame('Empty', { dir: 'vertical', pad: '1000', fill: 'bg/surface/default', radius: '300' }, [text('Text', 'Nothing here', 'text/secondary', 'body/md')])]],
    },
  });

  // ---------- Progress (and the older Progress bar) ----------
  const PROGRESS = { Highlight: 'border/brand', Success: 'border/success', Critical: 'border/critical' };
  const progress = variantSet('Progress', [{ name: 'Tone', values: Object.keys(PROGRESS) }], (t) => comp(t, { dir: 'horizontal', w: 320, h: 8, fill: 'bg/surface/tertiary', radius: 'full', clip: true, a11y: { role: 'img', label: 'Progress: 60%' } }, [
    frame('Value', { w: 192, h: 8, fill: PROGRESS[t], radius: 'full' }),
  ]), { cellW: 360, cellH: 40 });
  R.add({
    name: 'Progress', category: FEEDBACK, node: progress,
    info: { purpose: 'Shows how far a measurable task has come: an upload, an import, a goal.', notFor: 'Waiting without a known end (use Spinner).', usage: 'Say what’s in progress next to it, and the amount if it helps (“3 of 5 steps”).', role: 'img', keyboard: 'Not focusable; its value is announced.' },
    usage: {
      do: ['Say what’s progressing and how far.', () => [frame('Upload', { dir: 'vertical', gap: '200' }, [text('Label', 'Importing products · 60%', 'text/default', 'body/md'), inst(variant(progress, 'Tone=Highlight'), { name: 'Progress' })])]],
      dont: ['Show progress for something you can’t measure.', () => [frame('Loading', { dir: 'vertical', gap: '200' }, [text('Label', 'Loading…', 'text/default', 'body/md'), inst(variant(progress, 'Tone=Highlight'), { name: 'Progress' })])]],
    },
  });

  // ---------- Spinner ----------
  const spinner = variantSet('Spinner', [{ name: 'Size', values: ['Small', 'Large'] }], (sz) => {
    const px = sz === 'Small' ? 20 : 44;
    return comp(sz, { w: px, h: px, dir: 'horizontal', alignP: 'center', alignC: 'center', a11y: { role: 'img', label: 'Loading' } }, [icon('Icon', 'loader', 'icon/brand', px)]);
  }, { cellW: 76, cellH: 76 });
  const spinnerOf = (sz = 'Small') => inst(variant(spinner, `Size=${sz}`), { name: 'Spinner' });
  R.add({
    name: 'Spinner', category: FEEDBACK, node: spinner, spinnerOf,
    info: { purpose: 'Shows that something is loading.', notFor: 'Progress you can measure (use Progress).', usage: 'One spinner for the area that’s loading, with text saying what.', role: 'img', keyboard: 'Not focusable; announced as “Loading”.' },
    usage: {
      do: ['Show a spinner with what’s loading.', () => [spinnerOf(), text('Loading', 'Loading orders…', 'text/secondary', 'body/md')]],
      dont: ['Show several spinners at once: show one for the area that’s loading.', () => [spinnerOf(), spinnerOf(), spinnerOf()]],
    },
  });

  // ---------- Skeleton (the older Skeleton body text, display text, thumbnail, tabs and page) ----------
  const bar = (w, h = 12) => frame('Bar', { w, h, fill: 'bg/surface/tertiary', radius: '100' });
  const SKELETON = {
    'Display text': () => [bar(240, 24)],
    'Body text': () => [bar(320), bar(320), bar(200)],
    Thumbnail: () => [frame('Bar', { w: 60, h: 60, fill: 'bg/surface/tertiary', radius: '200' })],
    Tabs: () => [frame('Tabs', { dir: 'horizontal', gap: '400' }, [bar(80, 16), bar(80, 16), bar(80, 16)])],
    Page: () => [bar(200, 28), frame('Section', { dir: 'vertical', gap: '200', pad: '400', w: 360, fill: 'bg/surface/default', stroke: 'border/default', radius: '300' }, [bar(160, 16), bar(300), bar(260)])],
  };
  const skeleton = variantSet('Skeleton', [{ name: 'Type', values: Object.keys(SKELETON) }], (t) => comp(t, { dir: 'vertical', gap: '200', a11y: { role: 'img', label: 'Loading' } }, SKELETON[t]()), { cellW: 400, cellH: 200 });
  R.add({
    name: 'Skeleton', category: FEEDBACK, node: skeleton,
    info: { purpose: 'Placeholders in the shape of content that’s loading, so the page doesn’t jump when it arrives.', notFor: 'Content that never loads, or short waits (show nothing).', usage: 'Match the shape of what’s coming: a title, lines of text, a thumbnail, tabs or a whole page.', role: 'img', keyboard: 'Not focusable; announced as “Loading”.' },
    usage: {
      do: ['Match the shape of the content that’s coming.', () => [inst(variant(skeleton, 'Type=Body text'), { name: 'Skeleton' })]],
      dont: ['Mix skeletons with a spinner for the same content.', () => [inst(variant(skeleton, 'Type=Display text'), { name: 'Skeleton' }), spinnerOf()]],
    },
  });

  // ---------- Exception list ----------
  const exRow = (ic, tone, title, detail) => frame(title, { dir: 'horizontal', gap: '200' }, [
    icon('Icon', ic, `icon/${tone}`, 20),
    frame('Text', { dir: 'vertical', fillW: true }, [text('Title', title, 'text/default', 'body/md-medium'), para('Detail', detail, 'text/secondary', 'body/sm')]),
  ]);
  const exceptions = comp('Exception list', { dir: 'vertical', gap: '300', w: 400 }, [
    exRow('circle-alert', 'critical', 'Payment failed', 'The card was declined.'),
    exRow('triangle-alert', 'caution', 'Address unverified', 'Check the shipping address.'),
    exRow('info', 'info', 'Gift order', 'The note is printed on the packing slip.'),
  ]);
  R.add({
    name: 'Exception list', category: FEEDBACK, node: exceptions,
    info: { purpose: 'Lists things that need attention about one item, like an order’s problems.', notFor: 'A single message (use Banner) or form errors (use Inline error).', usage: 'Most important first; each with an icon, a title and a short detail.', role: 'list', keyboard: 'Not focusable; read as a list.' },
    usage: {
      do: ['Put the most serious issue first.', () => [inst(exceptions, { name: 'Exception list' })]],
      dont: ['Use it for news that needs no attention.', () => [frame('Order placed', { dir: 'horizontal', gap: '200' }, [
        R.get('Icon').iconOf('Info', 'info'), frame('Text', { dir: 'vertical' }, [text('Title', 'Order placed', 'text/default', 'body/md-medium'), text('Detail', 'Today at 9:41.', 'text/secondary', 'body/sm')])])]],
    },
  });

  // ---------- Inline error ----------
  const ie = pid('message');
  const inlineError = comp('Inline error', { dir: 'horizontal', gap: '100', alignC: 'center' }, [
    icon('Icon', 'circle-alert', 'icon/critical', 16),
    text('Message', 'Store name is required', 'text/critical', 'body/sm', { propRefs: { text: ie } }),
  ]);
  inlineError.props = { [ie]: { name: 'Message', type: 'text', default: 'Store name is required' } };
  R.add({
    name: 'Inline error', category: FEEDBACK, node: inlineError, props: { message: ie },
    info: { purpose: 'An error message under a field, saying how to fix it.', notFor: 'Errors about the whole page (use Banner).', usage: 'Say what’s wrong and how to fix it, next to the field it’s about.', role: 'none', keyboard: 'Not focusable; announced when it appears, and tied to its field.' },
    usage: {
      do: ['Say how to fix it.', () => [inst(inlineError, { name: 'Inline error', propValues: { [ie]: 'Enter a price above $0' } })]],
      dont: ['Just say it’s invalid.', () => [inst(inlineError, { name: 'Inline error', propValues: { [ie]: 'Invalid' } })]],
    },
  });
}
