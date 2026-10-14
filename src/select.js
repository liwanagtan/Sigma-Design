// Keep native select values, labels and change events; use Sigma's shared popup.
import { showContextMenu, hideContextMenu } from './menu.js';

export function openSelect(select) {
  if (select.disabled || select.multiple || select.size > 1) return;
  if (select.getAttribute('aria-expanded') === 'true') return hideContextMenu();
  const box = select.getBoundingClientRect();
  const items = [];
  for (const child of select.children) {
    if (child.tagName === 'OPTGROUP') {
      items.push({ label:child.label, disabled:true });
      for (const option of child.children) add(option, child.disabled);
    } else add(child);
  }
  function add(option, groupDisabled = false) {
    if (option.tagName !== 'OPTION' || option.hidden) return;
    items.push({ label:option.label, checked:option.selected, disabled:option.disabled || groupDisabled,
      action:() => {
        if (select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('input', { bubbles:true }));
        select.dispatchEvent(new Event('change', { bubbles:true }));
      } });
  }
  showContextMenu(box.left, box.bottom + 4, items, { trigger:select, role:'listbox', minWidth:box.width });
}

const targetSelect = event => event.target.closest?.('select:not([multiple])');
document.addEventListener('pointerdown', event => {
  const select = targetSelect(event);
  if (!select || select.disabled || select.size > 1 || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  select.focus({ preventScroll:true });
  openSelect(select);
}, true);
document.addEventListener('keydown', event => {
  const select = targetSelect(event);
  if (!select || !['Enter',' '].includes(event.key) && !(event.altKey && event.key === 'ArrowDown')) return;
  event.preventDefault(); event.stopPropagation();
  openSelect(select);
}, true);
