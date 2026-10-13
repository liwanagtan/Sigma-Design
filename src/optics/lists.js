// Optics: lists and tables (Resource item, Resource list, Data table, Index table; Listbox and Option list are
// with the forms that use them).
import { variantSet, variant } from './kit.js';

export function buildLists(K, R) {
  const { text, para, icon, comp, frame, inst, side } = K;
  const LISTS = 'Lists and tables';
  const { btn, iconBtn } = R.get('Button');
  const { badgeOf } = R.get('Badge');
  const { cbOf } = R.get('Checkbox');
  const avatar = R.get('Avatar').node, thumbnail = R.get('Thumbnail').node;
  const pagination = R.get('Pagination').node;
  const indexFilters = R.get('Index filters').node;

  // ---------- Resource item ----------
  const resource = variantSet('Resource item', [{ name: 'State', values: ['Default', 'Hover', 'Selected'] }], (s) => comp(s, {
    dir: 'horizontal', gap: '300', px: '400', py: '300', w: 480, alignC: 'center', fill: s === 'Default' ? 'bg/surface/default' : s === 'Hover' ? 'bg/surface/hover' : 'bg/surface/selected',
    a11y: { role: 'link' },
  }, [
    inst(variant(avatar, 'Size=Medium'), { name: 'Avatar' }),
    frame('Text', { dir: 'vertical', fillW: true }, [text('Name', 'Olivia Park', 'text/default', 'body/md-semibold'), text('Detail', 'Toronto, Canada · 8 orders', 'text/secondary', 'body/sm')]),
    text('Total', '$1,284.00', 'text/default', 'body/md'),
  ]), { cellW: 520, cellH: 96 });
  const resourceOf = (s = 'Default') => inst(variant(resource, `State=${s}`), { name: 'Resource item' });
  R.add({
    name: 'Resource item', category: LISTS, node: resource,
    info: { purpose: 'One thing in a Resource list, like a customer or a product, that opens its own page.', notFor: 'Rows of data to compare (use Data table).', usage: 'A picture, the name, a line of detail; the whole row opens the item.', role: 'link', keyboard: 'Tab moves focus to it; Enter opens it.' },
    usage: {
      do: ['Make the whole row open the item.', () => [resourceOf('Hover')]],
      dont: ['Crowd a row with actions.', () => [frame('Row', { dir: 'horizontal', gap: '200', px: '400', py: '300', fill: 'bg/surface/default', alignC: 'center' }, [text('Name', 'Olivia Park', 'text/default', 'body/md-semibold'), btn('Secondary', 'Email'), btn('Secondary', 'Edit'), btn('Critical', 'Delete')])]],
    },
  });

  // ---------- Resource list ----------
  const resourceList = comp('Resource list', { dir: 'vertical', w: 480, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', clip: true }, [
    frame('Header', { dir: 'horizontal', px: '400', py: '300', fillW: true, alignC: 'center', spacing: 'auto', stroke: 'border/default', strokeSides: side('bottom') }, [text('Count', 'Showing 3 customers', 'text/secondary', 'body/sm'), btn('Plain', 'Sort')]),
    resourceOf(), resourceOf(), resourceOf(),
  ]);
  R.add({
    name: 'Resource list', category: LISTS, node: resourceList,
    info: { purpose: 'A list of things, like customers or products, each opening its own page.', notFor: 'Data to compare across columns (use Index table or Data table).', usage: 'Say how many there are; let people sort and filter long lists.', role: 'list', keyboard: 'Each item is a tab stop.' },
    usage: {
      do: ['Say how many items there are.', () => [inst(resourceList, { name: 'Resource list' })]],
      dont: ['Show a list with no way to tell items apart.', () => [frame('List', { dir: 'vertical', w: 320, stroke: 'border/default', radius: '300' }, [text('Item', 'Customer', 'text/default', 'body/md'), text('Item', 'Customer', 'text/default', 'body/md')])]],
    },
  });

  // ---------- Data table ----------
  const cell = (v, i, o = {}) => frame(`Cell ${i + 1}`, { dir: 'horizontal', gap: '100', w: i === 0 ? 200 : 120, alignP: i === 0 ? 'start' : 'end', alignC: 'center' }, [
    text('Text', v, o.color || 'text/default', o.typo || 'body/md'), ...(o.sort ? [icon('Sort', 'arrow-down', 'icon/secondary', 16)] : []),
  ]);
  const dataRow = (cells, o = {}) => frame(o.name || cells[0], { dir: 'horizontal', px: '300', py: o.head ? '200' : '300', fillW: true, alignC: 'center', ...(o.fill ? { fill: o.fill } : {}), stroke: 'border/default', strokeSides: side(o.head ? 'bottom' : 'top') },
    cells.map((c, i) => cell(c, i, o.head ? { color: 'text/secondary', typo: 'body/sm-medium', sort: i === 3 && o.sort !== false } : o.total ? { typo: 'body/md-semibold' } : {})));
  const dataTable = comp('Data table', { dir: 'vertical', w: 560, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', clip: true }, [
    dataRow(['Product', 'Price', 'Sold', 'Net sales'], { head: true, name: 'Header' }),
    dataRow(['Linen shirt', '$48.00', '112', '$5,376.00']), dataRow(['Canvas tote', '$32.00', '87', '$2,784.00']), dataRow(['Wool scarf', '$56.00', '41', '$2,296.00']),
    dataRow(['Total', '', '240', '$10,456.00'], { total: true, fill: 'bg/surface/secondary', name: 'Totals' }),
  ]);
  R.add({
    name: 'Data table', category: LISTS, node: dataTable,
    info: { purpose: 'Numbers to read and compare, with sorting and totals.', notFor: 'Things people open or act on (use Index table).', usage: 'Numbers right-aligned; mark the sorted column; totals at the foot.', role: 'table', keyboard: 'Sortable headers are buttons and tab stops.' },
    usage: {
      do: ['Show which column is sorted.', () => [inst(dataTable, { name: 'Data table' })]],
      dont: ['Center numbers: they no longer line up.', () => [frame('Table', { dir: 'vertical', w: 240, stroke: 'border/default', radius: '300' }, ['$48.00', '$1,284.00'].map((v) => frame(v, { dir: 'horizontal', w: 240, py: '200', alignP: 'center' }, [text('Text', v, 'text/default', 'body/md')])))]],
    },
  });

  // ---------- Index table ----------
  const idxRow = (cells, o = {}) => frame(o.name || cells[0], { dir: 'horizontal', gap: '200', px: '300', fillW: true, alignC: 'center', ...(o.on ? { fill: 'bg/surface/selected' } : {}), stroke: 'border/default', strokeSides: side(o.head ? 'bottom' : 'top') }, [
    cbOf(o.on ? 'On' : 'Off', o.head ? 'Select all orders' : `Select order ${cells[0]}`, 'Default', { hideLabel: true }),
    ...cells.map((c, i) => frame(`Cell ${i + 1}`, { dir: 'horizontal', w: i === 0 ? 120 : 140 }, [
      i === 2 && !o.head ? badgeOf(c === 'Paid' ? 'Success' : 'Caution', c) : text('Text', c, o.head ? 'text/secondary' : 'text/default', o.head ? 'body/sm-medium' : i === 0 ? 'body/md-semibold' : 'body/md'),
    ])),
  ]);
  const indexTable = comp('Index table', { dir: 'vertical', w: 720, fill: 'bg/surface/default', stroke: 'border/default', radius: '300', clip: true }, [
    inst(indexFilters, { name: 'Index filters' }),
    idxRow(['Order', 'Customer', 'Payment', 'Total'], { head: true, name: 'Header' }),
    idxRow(['#1024', 'Olivia Park', 'Paid', '$84.00'], { on: true }), idxRow(['#1023', 'Sam Lee', 'Pending', '$120.00']), idxRow(['#1022', 'Ana Ruiz', 'Paid', '$46.00']),
    frame('Footer', { dir: 'horizontal', px: '300', py: '200', fillW: true, alignP: 'center', stroke: 'border/default', strokeSides: side('top') }, [inst(variant(pagination, 'Type=Default'), { name: 'Pagination' })]),
  ]);
  R.add({
    name: 'Index table', category: LISTS, node: indexTable,
    info: { purpose: 'A table of things people open, select and act on in bulk, like orders, with views and filters.', notFor: 'Data only to read (use Data table).', usage: 'Checkboxes select rows for bulk actions; clicking a row opens it. Keep the most important column first.', role: 'table', keyboard: 'Each row and checkbox is a tab stop; Space selects a row, Enter opens it.' },
    usage: {
      do: ['Lead with the column people look for.', () => [inst(indexTable, { name: 'Index table' })]],
      dont: ['Drop the checkboxes when people act on orders in bulk.', () => [frame('Table', { dir: 'vertical', w: 480, stroke: 'border/default', radius: '300', clip: true }, [
        dataRow(['Order', 'Customer', 'Payment', 'Total'], { head: true, sort: false, name: 'Header' }), dataRow(['#1024', 'Olivia Park', 'Paid', '$84.00']), dataRow(['#1023', 'Sam Lee', 'Pending', '$120.00'])])]],
    },
  });
}
