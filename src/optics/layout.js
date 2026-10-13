// Optics: layout and structure (Box, Stack (Block, Inline and Legacy stack), Grid (Inline grid), Divider, Query
// container, Section (Card and Legacy card), Callout card, Media card, Bleed, Layout, Page, Table, Ordered list,
// Unordered list, Description list, Footer help).
import { variantSet, variant } from './kit.js';

export function buildLayout(K, R) {
  const { text, para, icon, comp, frame, inst, side, picture } = K;
  const LAYOUT = 'Layout and structure';
  const { btn, iconBtn } = R.get('Button');
  const { badgeOf } = R.get('Badge');
  const { linkOf } = R.get('Link');

  // A sample block, to show how layout components arrange what's inside them.
  const block = (l, w = 96, h = 48) => frame(l, { w, h, dir: 'horizontal', alignP: 'center', alignC: 'center', fill: 'bg/surface/selected', stroke: 'border/brand', radius: '200' }, [text('Label', l, 'text/default', 'body/sm-medium')]);
  const card = (name, o, children) => frame(name, { dir: 'vertical', gap: '300', pad: '400', fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '100', ...o }, children);

  // ---------- Box ----------
  const BOX = { Default: {}, Subdued: { fill: 'bg/surface/secondary' }, Bordered: { stroke: 'border/default' }, Raised: { fill: 'bg/surface/default', shadow: '200' } };
  const box = variantSet('Box', [{ name: 'Style', values: Object.keys(BOX) }], (s) => comp(s, { dir: 'vertical', pad: '400', w: 240, radius: '300', fill: 'bg/surface/default', ...BOX[s] }, [
    para('Content', 'Padding, background, border and corner radius, all from tokens.', 'text/default', 'body/md'),
  ]), { cellW: 280, cellH: 120 });
  R.add({
    name: 'Box', category: LAYOUT, node: box,
    info: { purpose: 'The most basic layout block: padding, background, border, radius and shadow, from tokens.', notFor: 'Arranging several things (use Stack or Grid) or content groups (use Section).', usage: 'Use it to give one area its own padding or background; reach for Section when it has a title.', role: 'none', keyboard: 'Not focusable.' },
    usage: {
      do: ['Use a box to set off one area.', () => [inst(variant(box, 'Style=Subdued'), { name: 'Box' })]],
      dont: ['Nest boxes to build up spacing: use one, with the right padding.', () => [frame('Outer', { pad: '200', stroke: 'border/default', radius: '300' }, [frame('Inner', { pad: '200', stroke: 'border/default', radius: '300' }, [text('Content', 'Content', 'text/default', 'body/md')])])]],
    },
  });

  // ---------- Stack ----------
  const stack = variantSet('Stack', [{ name: 'Direction', values: ['Block', 'Inline'] }], (d) => comp(d, { dir: d === 'Block' ? 'vertical' : 'horizontal', gap: '300' }, [block('One'), block('Two'), block('Three')]), { cellW: 360, cellH: 220 });
  R.add({
    name: 'Stack', category: LAYOUT, node: stack,
    info: { purpose: 'Puts things in a column (block) or a row (inline), with even spacing from tokens.', notFor: 'Columns that line up across rows (use Grid).', usage: 'Pick the gap from the spacing scale; stacks nest for more complex layouts.', role: 'none', keyboard: 'Not focusable; children keep reading order.' },
    usage: {
      do: ['Space items evenly with a token gap.', () => [inst(variant(stack, 'Direction=Inline'), { name: 'Stack' })]],
      dont: ['Space items unevenly by hand.', () => [frame('Row', { dir: 'horizontal' }, [block('One'), frame('Gap', { w: 8, h: 1 }), block('Two'), frame('Gap', { w: 24, h: 1 }), block('Three')])]],
    },
  });

  // ---------- Grid ----------
  const grid = variantSet('Grid', [{ name: 'Columns', values: ['2', '3'] }], (c) => comp(c, { dir: 'vertical', gap: '300' }, [0, 1].map((r) => frame(`Row ${r + 1}`, { dir: 'horizontal', gap: '300' },
    Array.from({ length: +c }, (_, i) => block(`${r * +c + i + 1}`, c === '2' ? 150 : 96))))), { cellW: 360, cellH: 160 });
  R.add({
    name: 'Grid', category: LAYOUT, node: grid,
    info: { purpose: 'Lines things up in columns and rows, with token gaps.', notFor: 'A single row or column (use Stack).', usage: 'Use for cards and tiles that should line up; change the columns at breakpoints with a Query container.', role: 'none', keyboard: 'Not focusable; children keep reading order.' },
    usage: {
      do: ['Line up tiles of the same kind.', () => [inst(variant(grid, 'Columns=3'), { name: 'Grid' })]],
      dont: ['Use a grid for a single row of buttons.', () => [frame('Grid', { dir: 'horizontal', gap: '300' }, [btn('Secondary', 'Cancel'), frame('Empty', { w: 96, h: 1 }), btn('Primary', 'Save')])]],
    },
  });

  // ---------- Divider ----------
  const divider = variantSet('Divider', [{ name: 'Direction', values: ['Horizontal', 'Vertical'] }], (d) => comp(d, d === 'Horizontal' ? { w: 240, h: 1, fill: 'border/default' } : { w: 1, h: 48, fill: 'border/default' }), { cellW: 280, cellH: 80 });
  R.add({
    name: 'Divider', category: LAYOUT, node: divider,
    info: { purpose: 'A thin line that separates groups of content.', notFor: 'Separating every item (use spacing, or a list).', usage: 'Use sparingly, between groups that spacing alone doesn’t separate.', role: 'separator', keyboard: 'Not focusable.' },
    usage: {
      do: ['Separate distinct groups.', () => [frame('Groups', { dir: 'vertical', gap: '300', w: 240 }, [text('A', 'Shipping', 'text/default', 'body/md'), inst(variant(divider, 'Direction=Horizontal'), { name: 'Divider' }), text('B', 'Payments', 'text/default', 'body/md')])]],
      dont: ['Put a divider between every line.', () => [frame('Lines', { dir: 'vertical', gap: '100', w: 240 }, ['Name', 'Email', 'Phone'].flatMap((l) => [text(l, l, 'text/default', 'body/md'), inst(variant(divider, 'Direction=Horizontal'), { name: 'Divider' })]))]],
    },
  });

  // ---------- Query container ----------
  const qc = variantSet('Query container', [{ name: 'Width', values: ['Narrow', 'Wide'] }], (wd) => comp(wd, { dir: wd === 'Narrow' ? 'vertical' : 'horizontal', gap: '300', pad: '300', w: wd === 'Narrow' ? 200 : 480, stroke: 'border/strong', radius: '300' }, [
    block('Image', wd === 'Narrow' ? 176 : 140, 80), frame('Text', { dir: 'vertical', gap: '100', fillW: true }, [text('Title', 'Linen shirt', 'text/default', 'heading/xs'), para('Body', 'Changes layout with the width of its container.', 'text/secondary', 'body/sm')]),
  ]), { cellW: 520, cellH: 260 });
  R.add({
    name: 'Query container', category: LAYOUT, node: qc,
    info: { purpose: 'Lets what’s inside change its layout with the width of its container, not the screen.', notFor: 'Whole-page layout (use breakpoints, or Layout).', usage: 'Stack in narrow containers, side by side in wide ones. In Sigma, the variants match the file’s breakpoints.', role: 'none', keyboard: 'Not focusable.' },
    usage: {
      do: ['Stack content when the container is narrow.', () => [inst(variant(qc, 'Width=Narrow'), { name: 'Query container' })]],
      dont: ['Squeeze a wide layout into a narrow container.', () => [frame('Squeezed', { dir: 'horizontal', gap: '300', pad: '300', w: 200, stroke: 'border/strong', radius: '300', clip: true }, [block('Image', 140, 80), text('Title', 'Linen shirt', 'text/default', 'heading/xs')])]],
    },
  });

  // ---------- Section ----------
  const section = variantSet('Section', [{ name: 'Type', values: ['Card', 'Plain'] }], (t) => comp(t, {
    dir: 'vertical', gap: '300', pad: '400', w: 400, ...(t === 'Card' ? { fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '100' } : {}),
  }, [
    frame('Header', { dir: 'horizontal', fillW: true, alignC: 'center', spacing: 'auto' }, [text('Title', 'Shipping', 'text/default', 'heading/sm'), linkOf('Edit')]),
    para('Body', 'Standard shipping to Canada and the United States, 3–5 business days.', 'text/secondary', 'body/md'),
  ]), { cellW: 440, cellH: 180 });
  R.add({
    name: 'Section', category: LAYOUT, node: section,
    info: { purpose: 'Groups related content under a heading; as a card, it stands out from the page.', notFor: 'Spacing without a heading (use Box or Stack).', usage: 'One topic per section, with a short heading and at most one action in the header.', role: 'region', keyboard: 'Not focusable; its heading is a landmark for screen readers.' },
    usage: {
      do: ['Give each section one topic and a heading.', () => [inst(variant(section, 'Type=Card'), { name: 'Section' })]],
      dont: ['Pile many actions into a section header.', () => [card('Section', { w: 400 }, [frame('Header', { dir: 'horizontal', gap: '200', alignC: 'center' }, [text('Title', 'Shipping', 'text/default', 'heading/sm'), btn('Secondary', 'Edit'), btn('Secondary', 'Copy'), btn('Secondary', 'Delete')])])]],
    },
  });

  // ---------- Callout card ----------
  const callout = comp('Callout card', { dir: 'horizontal', gap: '600', pad: '600', w: 560, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '100', alignC: 'center' }, [
    frame('Text', { dir: 'vertical', gap: '300', fillW: true }, [text('Title', 'Customize your store', 'text/default', 'heading/sm'), para('Body', 'Pick a theme and add your logo to make your store your own.', 'text/secondary', 'body/md'), btn('Secondary', 'Customize theme')]),
    picture('Illustration', 120, 120, { icon: 'palette' }),
  ]);
  R.add({
    name: 'Callout card', category: LAYOUT, node: callout,
    info: { purpose: 'Suggests a next step people may not know about, with a picture and one action.', notFor: 'Required tasks (use Banner) or ordinary content (use Section).', usage: 'One clear action, and a picture that helps explain it. Let people dismiss it.', role: 'region', keyboard: 'Its button is a tab stop.' },
    usage: {
      do: ['Suggest one thing to do next.', () => [inst(callout, { name: 'Callout card' })]],
      dont: ['Offer several actions in one callout.', () => [card('Callout', { w: 360 }, [text('Title', 'Get started', 'text/default', 'heading/sm'), frame('Actions', { dir: 'horizontal', gap: '200' }, [btn('Secondary', 'Theme'), btn('Secondary', 'Logo'), btn('Secondary', 'Domain')])])]],
    },
  });

  // ---------- Media card ----------
  const media = variantSet('Media card', [{ name: 'Layout', values: ['Horizontal', 'Vertical'] }], (l) => comp(l, {
    dir: l === 'Horizontal' ? 'horizontal' : 'vertical', w: l === 'Horizontal' ? 560 : 280, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', shadow: '100', clip: true,
  }, [
    picture('Media', l === 'Horizontal' ? 200 : 280, 160, { icon: 'play', radius: '0' }),
    frame('Text', { dir: 'vertical', gap: '300', pad: '400', fillW: true }, [text('Title', 'Getting started', 'text/default', 'heading/sm'), para('Body', 'Watch a short tour of your new store.', 'text/secondary', 'body/md'), btn('Secondary', 'Watch video')]),
  ]), { cellW: 600, cellH: 360 });
  R.add({
    name: 'Media card', category: LAYOUT, node: media,
    info: { purpose: 'Pairs a picture or video with a title, text and an action.', notFor: 'Content without media (use Section).', usage: 'Make the media tell the story; keep the text short.', role: 'region', keyboard: 'Its button is a tab stop.' },
    usage: {
      do: ['Use media that explains the action.', () => [inst(variant(media, 'Layout=Vertical'), { name: 'Media card' })]],
      dont: ['Use a media card with no media.', () => [card('Card', { w: 280 }, [text('Title', 'Getting started', 'text/default', 'heading/sm'), btn('Secondary', 'Watch video')])]],
    },
  });

  // ---------- Bleed ----------
  // The card has no side padding of its own: the text keeps it, the photo bleeds to the edges.
  const bleed = comp('Bleed', { dir: 'vertical', gap: '300', py: '400', w: 360, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', clip: true }, [
    frame('Header', { dir: 'vertical', px: '400', fillW: true }, [text('Title', 'Product photo', 'text/default', 'heading/sm')]),
    picture('Photo', 360, 120, { radius: '0' }),
    frame('Footer', { dir: 'vertical', px: '400', fillW: true }, [para('Body', 'The photo runs edge to edge; the text keeps the card’s padding.', 'text/secondary', 'body/sm')]),
  ]);
  R.add({
    name: 'Bleed', category: LAYOUT, node: bleed,
    info: { purpose: 'Lets content reach past its container’s padding, like a photo running edge to edge in a card.', notFor: 'Breaking out of the page.', usage: 'Use for media and dividers inside padded containers; keep text inside the padding.', role: 'none', keyboard: 'Not focusable.' },
    usage: {
      do: ['Let photos reach the card’s edges.', () => [inst(bleed, { name: 'Bleed' })]],
      dont: ['Let text run to the edges.', () => [frame('Card', { dir: 'vertical', w: 320, fill: 'bg/surface/default', stroke: 'border/default', radius: '300' }, [para('Body', 'Text that runs edge to edge is hard to read.', 'text/default', 'body/md')])]],
    },
  });

  // ---------- Layout ----------
  const layoutSet = variantSet('Layout', [{ name: 'Columns', values: ['Two-thirds and one-third', 'Annotated'] }], (c) => comp(c === 'Annotated' ? 'Annotated' : 'Two-thirds and one-third', { dir: 'horizontal', gap: '400', w: 720 }, c === 'Annotated'
    ? [frame('Annotation', { dir: 'vertical', gap: '100', w: 240 }, [text('Title', 'Store details', 'text/default', 'heading/sm'), para('Body', 'Shown to customers on receipts.', 'text/secondary', 'body/sm')]), card('Content', { fillW: true }, [block('Fields', 420, 96)])]
    : [card('Main', { fillW: true }, [block('Main', 420, 120)]), card('Side', { w: 220 }, [block('Side', 188, 120)])]), { cellW: 760, cellH: 240 });
  R.add({
    name: 'Layout', category: LAYOUT, node: layoutSet,
    info: { purpose: 'Arranges a page’s sections into a main column and a side column, or annotated rows.', notFor: 'Arranging things inside a section (use Stack or Grid).', usage: 'Main content in the wide column; supporting details on the side. Settings pages use the annotated layout.', role: 'none', keyboard: 'Not focusable; main content comes first in reading order.' },
    usage: {
      do: ['Put the main content in the wide column.', () => [inst(variant(layoutSet, 'Columns=Two-thirds and one-third'), { name: 'Layout' })]],
      dont: ['Make three equal columns of sections.', () => [frame('Layout', { dir: 'horizontal', gap: '400' }, [card('One', {}, [block('One', 140, 80)]), card('Two', {}, [block('Two', 140, 80)]), card('Three', {}, [block('Three', 140, 80)])])]],
    },
  });

  // ---------- Page ----------
  const page = comp('Page', { dir: 'vertical', gap: '400', pad: '600', w: 720, fill: 'bg/page', radius: '300' }, [
    frame('Header', { dir: 'horizontal', gap: '300', alignC: 'center', fillW: true }, [
      iconBtn('arrow-left', 'Back to orders'),
      text('Title', 'Order #1024', 'text/default', 'heading/lg'), badgeOf('Success', 'Paid'),
      frame('Space', { fillW: true, h: 1 }), btn('Secondary', 'Refund'), btn('Primary', 'Fulfill'),
    ]),
    card('Content', { fillW: true }, [text('Title', 'Items', 'text/default', 'heading/sm'), block('Content', 600, 96)]),
  ]);
  R.add({
    name: 'Page', category: LAYOUT, node: page,
    info: { purpose: 'The outer frame of a page: title, back link, status, actions, and the content below.', notFor: 'Parts of a page (use Section).', usage: 'One primary action in the header; say what the page is about in the title.', role: 'main', keyboard: 'The back link and actions are tab stops; the title is the page’s heading.' },
    usage: {
      do: ['Title the page and lead with one primary action.', () => [inst(page, { name: 'Page' })]],
      dont: ['Leave the page untitled.', () => [frame('Page', { dir: 'horizontal', gap: '300', pad: '400', fill: 'bg/page', radius: '300' }, [btn('Secondary', 'Refund'), btn('Primary', 'Fulfill')])]],
    },
  });

  // ---------- Table ----------
  const row = (cells, head = false) => frame(head ? 'Header' : cells[0], { dir: 'horizontal', px: '300', py: head ? '200' : '300', fillW: true, alignC: 'center', ...(head ? { fill: 'bg/surface/secondary' } : { stroke: 'border/default', strokeSides: side('top') }) },
    cells.map((c, i) => frame(`Cell ${i + 1}`, { dir: 'horizontal', w: i === 0 ? 200 : 120, alignP: i === 0 ? 'start' : 'end' }, [text('Text', c, head ? 'text/secondary' : 'text/default', head ? 'body/sm-medium' : 'body/md')])));
  const table = comp('Table', { dir: 'vertical', w: 560, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', clip: true }, [
    row(['Product', 'Price', 'Stock', 'Sold'], true), row(['Linen shirt', '$48.00', '24', '112']), row(['Canvas tote', '$32.00', '8', '87']), row(['Wool scarf', '$56.00', '0', '41']),
  ]);
  R.add({
    name: 'Table', category: LAYOUT, node: table,
    info: { purpose: 'Shows data in rows and columns, to read and compare.', notFor: 'Lists of things people act on (use Resource list or Index table) or layout.', usage: 'Line text up left and numbers right; keep headers short.', role: 'table', keyboard: 'Not focusable unless its cells hold controls; read as a table.' },
    usage: {
      do: ['Line numbers up on the right.', () => [inst(table, { name: 'Table' })]],
      dont: ['Use a table to lay out a form.', () => [frame('Form', { dir: 'vertical', w: 400, stroke: 'border/default', radius: '300' }, [row(['Name', 'Olivia']), row(['Email', 'olivia@example.com'])])]],
    },
  });

  // ---------- Ordered and Unordered list ----------
  const item = (marker, l) => frame(l, { dir: 'horizontal', gap: '200', fillW: true }, [text('Marker', marker, 'text/secondary', 'body/md'), para('Text', l, 'text/default', 'body/md')]);
  const steps = ['Add your products', 'Set up payments', 'Choose a domain'];
  const ordered = comp('Ordered list', { dir: 'vertical', gap: '200', w: 320 }, steps.map((s, i) => item(`${i + 1}.`, s)));
  R.add({
    name: 'Ordered list', category: LAYOUT, node: ordered,
    info: { purpose: 'A numbered list, for steps that happen in order.', notFor: 'Items in no particular order (use Unordered list).', usage: 'Start each item the same way; keep them short.', role: 'list', keyboard: 'Not focusable; read as a numbered list.' },
    usage: { do: ['Number steps that happen in order.', () => [inst(ordered, { name: 'Ordered list' })]], dont: ['Number things that have no order.', () => [frame('List', { dir: 'vertical', gap: '200', w: 240 }, [item('1.', 'Red'), item('2.', 'Blue'), item('3.', 'Green')])]] },
  });
  const unordered = comp('Unordered list', { dir: 'vertical', gap: '200', w: 320 }, ['Free shipping over $50', 'Returns within 30 days', 'Gift wrapping'].map((s) => item('•', s)));
  R.add({
    name: 'Unordered list', category: LAYOUT, node: unordered,
    info: { purpose: 'A bulleted list, for related items in no particular order.', notFor: 'Steps (use Ordered list).', usage: 'Keep items parallel and short; no full stops on fragments.', role: 'list', keyboard: 'Not focusable; read as a list.' },
    usage: { do: ['Keep items short and parallel.', () => [inst(unordered, { name: 'Unordered list' })]], dont: ['Bullet a single item.', () => [frame('List', { dir: 'vertical', w: 240 }, [item('•', 'Free shipping over $50')])]] },
  });

  // ---------- Description list ----------
  const term = (t, d) => frame(t, { dir: 'horizontal', gap: '400', py: '300', fillW: true, stroke: 'border/default', strokeSides: side('bottom') }, [
    frame('Term', { dir: 'horizontal', w: 120 }, [text('Term', t, 'text/secondary', 'body/md-medium')]), para('Description', d, 'text/default', 'body/md'),
  ]);
  const described = comp('Description list', { dir: 'vertical', w: 440 }, [term('Customer', 'Olivia Park'), term('Ships to', '200 King St W, Toronto'), term('Payment', 'Visa ending 4242')]);
  R.add({
    name: 'Description list', category: LAYOUT, node: described,
    info: { purpose: 'Pairs terms with their descriptions, like an order’s details.', notFor: 'Data to compare across items (use Table).', usage: 'Short terms on the left, their values on the right.', role: 'list', keyboard: 'Not focusable; read as term and description pairs.' },
    usage: { do: ['Pair short terms with their values.', () => [inst(described, { name: 'Description list' })]], dont: ['Write sentences as terms.', () => [frame('List', { dir: 'vertical', w: 440 }, [term('The customer who ordered', 'Olivia Park')])]] },
  });

  // ---------- Footer help ----------
  const footer = comp('Footer help', { dir: 'horizontal', gap: '200', pad: '400', alignC: 'center' }, [
    icon('Icon', 'circle-question-mark', 'icon/secondary', 20), text('Text', 'Learn more about', 'text/secondary', 'body/md'), linkOf('fulfilling orders'),
  ]);
  R.add({
    name: 'Footer help', category: LAYOUT, node: footer,
    info: { purpose: 'Points to help about the page, at its foot.', notFor: 'Errors or warnings (use Banner).', usage: 'One link, saying what it’s about; at most one per page.', role: 'none', keyboard: 'Its link is a tab stop.' },
    usage: { do: ['Say what the help is about.', () => [inst(footer, { name: 'Footer help' })]], dont: ['Link to help in general.', () => [frame('Footer', { dir: 'horizontal', gap: '200' }, [text('Text', 'Need help?', 'text/secondary', 'body/md'), linkOf('Click here')])]] },
  });
}
