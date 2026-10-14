import { test, eq, ok } from './harness.js';
import { openSelect } from '../src/select.js';
import { hideContextMenu } from '../src/menu.js';

test('select: custom options preserve native values, events and disabled groups', () => {
  const select = document.createElement('select');
  select.innerHTML = '<option value="a">Alpha</option><option value="b">Beta</option><optgroup label="Unavailable" disabled><option value="c">Gamma</option></optgroup>';
  document.body.appendChild(select);
  let changes = 0;
  select.addEventListener('change', () => changes++);
  try {
    openSelect(select);
    eq(document.querySelector('.menu').getAttribute('role'), 'listbox');
    eq(document.querySelector('[data-i="0"]').getAttribute('aria-selected'), 'true');
    ok(document.querySelector('[data-i="3"]').classList.contains('disabled'));
    document.querySelector('[data-i="1"]').click();
    eq(select.value, 'b'); eq(changes, 1); eq(document.querySelector('.menu'), null);
    openSelect(select);
    window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
    eq(select.getAttribute('aria-expanded'), 'false');
    select.disabled = true; openSelect(select); eq(document.querySelector('.menu'), null);
  } finally { hideContextMenu(); select.remove(); }
});
