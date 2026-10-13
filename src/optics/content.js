// Optics: typography and content (Text, Heading, Paragraph, Number, Chip) and media and visuals (Icon, Avatar,
// Image, Thumbnail, Video thumbnail, Keyboard key).
import { I, variantSet, variant, pid } from './kit.js';

const TONE_TEXT = { Base: 'text/default', Subdued: 'text/secondary', Critical: 'text/critical', Success: 'text/success', Caution: 'text/caution', Info: 'text/info', Magic: 'text/magic' };

export function buildContent(K, R) {
  const { text, para, icon, comp, frame, inst, picture } = K;
  const CONTENT = 'Typography and content', MEDIA = 'Media and visuals';

  // ---------- Text ----------
  const txt = pid('text');
  const STYLE = { 'Body lg': 'body/lg', 'Body md': 'body/md', 'Body sm': 'body/sm', 'Body md semibold': 'body/md-semibold', Code: 'code' };
  const textSet = variantSet('Text', [{ name: 'Variant', values: Object.keys(STYLE) }, { name: 'Tone', values: ['Base', 'Subdued', 'Critical', 'Success'] }],
    (v, t) => comp(v, { dir: 'horizontal' }, [text('Text', 'Order fulfilled', TONE_TEXT[t], STYLE[v], { propRefs: { text: txt } })]), { cellW: 200, cellH: 48 });
  textSet.props = { [txt]: { name: 'Text', type: 'text', default: 'Order fulfilled' } };
  R.add({
    name: 'Text', category: CONTENT, node: textSet, props: { text: txt },
    info: { purpose: 'Inline text in a style and a tone: body sizes, emphasis, code, and tones for meaning.', notFor: 'Titles (use Heading) or blocks of text (use Paragraph).', usage: 'Use Base for most text, Subdued for supporting text, and Critical or Success only when the text itself carries that meaning.', role: 'none', keyboard: 'Not focusable; read as part of its content.' },
    usage: {
      do: ['Use Subdued for secondary details next to the main text.', () => [inst(variant(textSet, 'Variant=Body md, Tone=Base'), { name: 'Text', propValues: { [txt]: '#1024' } }), inst(variant(textSet, 'Variant=Body md, Tone=Subdued'), { name: 'Text', propValues: { [txt]: 'Paid · Oct 14' } })]],
      dont: ['Color text Critical just to make it stand out: it says something is wrong.', () => [inst(variant(textSet, 'Variant=Body md, Tone=Critical'), { name: 'Text', propValues: { [txt]: 'New collection!' } })]],
    },
  });

  // ---------- Heading ----------
  const hd = pid('text');
  const LEVELS = { '2xl': 1, xl: 2, lg: 3, md: 4, sm: 5, xs: 6 };
  const heading = variantSet('Heading', [{ name: 'Size', values: Object.keys(LEVELS) }],
    (s) => comp(s, { dir: 'horizontal' }, [text('Heading', 'Orders', 'text/default', `heading/${s}`, { a11y: { heading: LEVELS[s] }, propRefs: { text: hd } })]), { cellW: 240, cellH: 64 });
  heading.props = { [hd]: { name: 'Text', type: 'text', default: 'Orders' } };
  R.add({
    name: 'Heading', category: CONTENT, node: heading, props: { text: hd },
    info: { purpose: 'A title for a page, a section or a card, at a level that matches the page’s outline.', notFor: 'Emphasis inside text (use Text, semibold).', usage: 'One 2xl per page for its title; sections below it go down a size at a time. Its heading level (h1–h6) follows the size.', role: 'heading', keyboard: 'Not focusable; screen readers list headings to jump between sections.' },
    usage: {
      do: ['Step down one size at a time, so the outline makes sense.', () => [frame('Outline', { dir: 'vertical', gap: '100' }, [inst(variant(heading, 'Size=lg'), { name: 'Heading', propValues: { [hd]: 'Shipping' } }), inst(variant(heading, 'Size=md'), { name: 'Heading', propValues: { [hd]: 'Rates' } })])]],
      dont: ['Pick a size for its looks: the outline jumps levels.', () => [frame('Outline', { dir: 'vertical', gap: '100' }, [inst(variant(heading, 'Size=xl'), { name: 'Heading', propValues: { [hd]: 'Shipping' } }), inst(variant(heading, 'Size=xs'), { name: 'Heading', propValues: { [hd]: 'Rates' } })])]],
    },
  });

  // ---------- Paragraph ----------
  const pg = pid('text');
  const paragraph = variantSet('Paragraph', [{ name: 'Tone', values: ['Base', 'Subdued'] }],
    (t) => comp(t, { dir: 'vertical', w: 360 }, [para('Paragraph', 'Customers can buy from your store once you’ve added a payment provider and set up shipping.', TONE_TEXT[t], 'body/md', { propRefs: { text: pg } })]), { cellW: 400, cellH: 96 });
  paragraph.props = { [pg]: { name: 'Text', type: 'text', default: 'Customers can buy from your store once you’ve added a payment provider and set up shipping.' } };
  R.add({
    name: 'Paragraph', category: CONTENT, node: paragraph, props: { text: pg },
    info: { purpose: 'A block of running text that wraps to its width.', notFor: 'A single label or value (use Text).', usage: 'Keep paragraphs short: two or three sentences. Use Subdued for helper text under a title.', role: 'none', keyboard: 'Not focusable.' },
    usage: {
      do: ['Say one thing per paragraph, in plain words.', () => [inst(variant(paragraph, 'Tone=Base'), { name: 'Paragraph' })]],
      dont: ['Put a wall of text in a narrow space.', () => [inst(variant(paragraph, 'Tone=Subdued'), { name: 'Paragraph', propValues: { [pg]: 'Shipping rates apply to every order and depend on the weight, the destination, the carrier, the speed, any discounts, and the settings of each location you ship from, which you can change at any time.' } })]],
    },
  });

  // ---------- Number ----------
  const nm = pid('text');
  const number = variantSet('Number', [{ name: 'Tone', values: ['Base', 'Success', 'Critical'] }],
    (t) => comp(t, { dir: 'horizontal' }, [text('Number', t === 'Critical' ? '−$1,240.50' : '$1,240.50', TONE_TEXT[t], 'body/md-semibold', { propRefs: { text: nm } })]), { cellW: 160, cellH: 48 });
  number.props = { [nm]: { name: 'Value', type: 'text', default: '$1,240.50' } };
  R.add({
    name: 'Number', category: CONTENT, node: number, props: { value: nm },
    info: { purpose: 'A number inside text or a table, with digits that line up in columns.', notFor: 'Numbers people type (use Number field).', usage: 'Format for the reader: thousands separators, the currency, a minus sign for negatives. Use Success and Critical for gains and losses.', role: 'none', keyboard: 'Not focusable.' },
    usage: {
      do: ['Format money with its currency and separators.', () => [inst(variant(number, 'Tone=Base'), { name: 'Number' })]],
      dont: ['Show raw numbers people have to parse.', () => [inst(variant(number, 'Tone=Base'), { name: 'Number', propValues: { [nm]: '1240.5' } })]],
    },
  });

  // ---------- Chip (and the older Tag) ----------
  const cp = pid('label');
  const chip = variantSet('Chip', [{ name: 'Variant', values: ['Default', 'Removable'] }], (v) => comp(v, { dir: 'horizontal', gap: '100', px: '200', py: '050', fill: 'bg/fill/neutral', radius: '200', alignC: 'center' }, [
    text('Label', 'Wholesale', 'text/default', 'body/sm', { propRefs: { text: cp } }),
    ...(v === 'Removable' ? [icon('Remove', 'x', 'icon/secondary', 16)] : []),
  ]), { cellW: 140, cellH: 44 });
  chip.props = { [cp]: { name: 'Label', type: 'text', default: 'Wholesale' } };
  R.add({
    name: 'Chip', category: CONTENT, node: chip, props: { label: cp },
    info: { purpose: 'A short label for something people added: a tag, a keyword, a filter value. Removable chips (the older Tag) can be taken off.', notFor: 'Status (use Badge) or choices to click (use Clickable chip).', usage: 'One or two words each. A removable chip’s × removes just that value.', role: 'none', keyboard: 'A removable chip’s remove button is focusable; Enter or Space removes it.' },
    usage: {
      do: ['Show the tags on a product as chips.', () => [inst(variant(chip, 'Variant=Removable'), { name: 'Chip' }), inst(variant(chip, 'Variant=Removable'), { name: 'Chip', propValues: { [cp]: 'Summer' } })]],
      dont: ['Use chips for long text.', () => [inst(variant(chip, 'Variant=Default'), { name: 'Chip', propValues: { [cp]: 'Only for customers in the wholesale program' } })]],
    },
  });

  // ---------- Icon ----------
  const ic = pid('icon');
  const TONE_ICON = { Base: 'icon/default', Subdued: 'icon/secondary', Brand: 'icon/brand', Critical: 'icon/critical', Success: 'icon/success', Caution: 'icon/caution', Warning: 'icon/warning', Info: 'icon/info', Magic: 'icon/magic' };
  const iconSet = variantSet('Icon', [{ name: 'Tone', values: Object.keys(TONE_ICON) }],
    (t) => comp(t, { w: 20, h: 20, dir: 'horizontal' }, [icon('Icon', 'star', TONE_ICON[t], 20, { propRefs: { iconId: ic } })]), { cellW: 56, cellH: 56 });
  iconSet.props = { [ic]: { name: 'Icon', type: 'icon', default: 'optics-star' } };
  R.add({
    name: 'Icon', category: MEDIA, node: iconSet, props: { icon: ic },
    // An Icon instance: examples outside components use these, since icon layers belong in main components.
    iconOf: (tone, name) => inst(variant(iconSet, `Tone=${tone}`), { name: 'Icon', propValues: { [ic]: I(name) } }),
    info: { purpose: 'A symbol from Optics Icons, colored by tone.', notFor: 'Decoration that says nothing, or actions (use Button, icon only).', usage: 'Use well-known icons and pair them with text. Choose the tone by meaning.', role: 'img', keyboard: 'Not focusable. Decorative next to text; otherwise give it a label.' },
    usage: {
      do: ['Pair an icon with a word that says the same.', () => [inst(variant(iconSet, 'Tone=Success'), { name: 'Icon', propValues: { [ic]: 'optics-circle-check' } }), text('Label', 'Paid', 'text/default', 'body/md')]],
      dont: ['Rely on an icon alone to say something important.', () => [inst(variant(iconSet, 'Tone=Critical'), { name: 'Icon', propValues: { [ic]: 'optics-circle-alert' } })]],
    },
  });

  // ---------- Avatar ----------
  const av = pid('initials');
  const avatar = variantSet('Avatar', [{ name: 'Size', values: ['Small', 'Medium', 'Large'] }], (sz) => {
    const px = { Small: 28, Medium: 36, Large: 48 }[sz];
    return comp(sz, { w: px, h: px, dir: 'horizontal', fill: 'bg/fill/info', radius: 'full', alignP: 'center', alignC: 'center' }, [
      text('Initials', 'OP', 'text/info', sz === 'Small' ? 'body/sm-medium' : 'body/md-semibold', { propRefs: { text: av } }),
    ]);
  }, { cellW: 72, cellH: 72 });
  avatar.props = { [av]: { name: 'Initials', type: 'text', default: 'OP' } };
  R.add({
    name: 'Avatar', category: MEDIA, node: avatar, props: { initials: av },
    info: { purpose: 'Represents a person or a store with initials or a picture.', notFor: 'Decoration or icons.', usage: 'Small in dense lists, Medium beside a name, Large on a profile. Pair it with the name.', role: 'img', keyboard: 'Not focusable; its alternative text is the person’s name.' },
    usage: {
      do: ['Pair an avatar with the person’s name.', () => [inst(variant(avatar, 'Size=Medium'), { name: 'Avatar' }), text('Name', 'Olivia Park', 'text/default', 'body/md')]],
      dont: ['Mix avatar sizes in one list.', () => [inst(variant(avatar, 'Size=Small'), { name: 'Avatar' }), inst(variant(avatar, 'Size=Large'), { name: 'Avatar' })]],
    },
  });

  // ---------- Image, Thumbnail, Video thumbnail ----------
  const RATIO = { Square: [160, 160], Landscape: [240, 135], Portrait: [120, 160] };
  const image = variantSet('Image', [{ name: 'Ratio', values: Object.keys(RATIO) }], (r) => {
    const [w, h] = RATIO[r];
    return comp(r, { w, h, dir: 'horizontal', alignP: 'center', alignC: 'center', fill: 'bg/surface/tertiary', radius: '200', clip: true, a11y: { role: 'img', label: 'Product photo' } }, [icon('Picture', 'image', 'icon/secondary', 32)]);
  }, { cellW: 280, cellH: 200 });
  R.add({
    name: 'Image', category: MEDIA, node: image,
    info: { purpose: 'A picture in the page, at a fixed ratio.', notFor: 'Small previews in lists (use Thumbnail) or icons.', usage: 'Keep the ratio of the original. Every image has alternative text, or is marked decorative.', role: 'img', keyboard: 'Not focusable; its alternative text is read.' },
    usage: {
      do: ['Use one ratio for a set of pictures, so they line up.', () => [inst(variant(image, 'Ratio=Square'), { name: 'Image' }), inst(variant(image, 'Ratio=Square'), { name: 'Image' })]],
      dont: ['Mix ratios side by side.', () => [inst(variant(image, 'Ratio=Landscape'), { name: 'Image' }), inst(variant(image, 'Ratio=Portrait'), { name: 'Image' })]],
    },
  });
  const thumbnail = variantSet('Thumbnail', [{ name: 'Size', values: ['Small', 'Medium', 'Large'] }], (sz) => {
    const px = { Small: 40, Medium: 60, Large: 80 }[sz];
    return comp(sz, { w: px, h: px, dir: 'horizontal', alignP: 'center', alignC: 'center', fill: 'bg/surface/tertiary', stroke: 'border/default', radius: '200', clip: true, a11y: { role: 'img', label: 'Product' } }, [icon('Picture', 'image', 'icon/secondary', Math.round(px / 2.5))]);
  }, { cellW: 104, cellH: 104 });
  R.add({
    name: 'Thumbnail', category: MEDIA, node: thumbnail,
    info: { purpose: 'A small preview of a product, file or image, in lists and tables.', notFor: 'Showing a picture in full (use Image).', usage: 'Small in tables, Medium in lists, Large in cards. Square, with a border so light images keep their edge.', role: 'img', keyboard: 'Not focusable; its alternative text names what it shows.' },
    usage: {
      do: ['Use the same size for every row of a list.', () => [inst(variant(thumbnail, 'Size=Small'), { name: 'Thumbnail' }), text('Name', 'Linen shirt', 'text/default', 'body/md')]],
      dont: ['Use a thumbnail where people need to see detail.', () => [inst(variant(thumbnail, 'Size=Small'), { name: 'Thumbnail' }), text('Name', 'Compare the colors', 'text/default', 'body/md')]],
    },
  });
  const video = comp('Video thumbnail', { w: 320, h: 180, dir: 'horizontal', alignP: 'center', alignC: 'center', fill: 'bg/surface/inverse', radius: '300', clip: true, a11y: { role: 'img', label: 'Video: setting up your store' } }, [
    frame('Play', { w: 48, h: 48, dir: 'horizontal', alignP: 'center', alignC: 'center', fill: 'bg/surface/default', radius: 'full', shadow: '300' }, [icon('Icon', 'play', 'icon/default', 20)]),
  ]);
  R.add({
    name: 'Video thumbnail', category: MEDIA, node: video,
    info: { purpose: 'A preview of a video with a play button.', notFor: 'Still images (use Image).', usage: 'Show a frame that says what the video is about, and its length nearby.', role: 'img', keyboard: 'Its play button is focusable; Enter or Space plays the video.' },
    usage: {
      do: ['Say what the video shows next to it.', () => [frame('Video', { dir: 'vertical', gap: '200' }, [inst(video, { name: 'Video thumbnail' }), text('Caption', 'Set up your store · 2:14', 'text/secondary', 'body/sm')])]],
      dont: ['Leave people guessing what plays.', () => [inst(video, { name: 'Video thumbnail' })]],
    },
  });

  // ---------- Keyboard key ----------
  const kk = pid('key');
  const key = variantSet('Keyboard key', [{ name: 'Key', values: ['⌘', 'Shift', 'K'] }], (k) => comp(k, { dir: 'horizontal', px: '150', py: '050', fill: 'bg/surface/secondary', stroke: 'border/strong', radius: '150', alignP: 'center', alignC: 'center' }, [
    text('Key', k, 'text/default', 'code', { propRefs: { text: kk } }),
  ]), { cellW: 88, cellH: 52 });
  key.props = { [kk]: { name: 'Key', type: 'text', default: 'K' } };
  R.add({
    name: 'Keyboard key', category: MEDIA, node: key, props: { key: kk },
    info: { purpose: 'Shows a key to press, in keyboard shortcuts.', notFor: 'Code (use Text, code) or buttons.', usage: 'One key per Keyboard key; put shortcuts like ⌘ K side by side.', role: 'none', keyboard: 'Not focusable.' },
    usage: {
      do: ['Show a shortcut as its keys.', () => [inst(variant(key, 'Key=⌘'), { name: 'Keyboard key' }), inst(variant(key, 'Key=K'), { name: 'Keyboard key' })]],
      dont: ['Put a whole shortcut in one key.', () => [inst(variant(key, 'Key=K'), { name: 'Keyboard key', propValues: { [kk]: 'Ctrl + Shift + K' } })]],
    },
  });
}
