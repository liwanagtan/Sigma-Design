import {menuItemHTML} from './ui-controls.js';
import {lucideIcon} from './lucide.js';
let menuEl = null;
let menuTrigger = null;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// items: Array<{label, shortcut?, action, disabled?, checked?} | '-'>
export function showContextMenu(x, y, items, { trigger = null, role = 'menu', minWidth = 0 } = {}) {
  hideContextMenu();
  menuTrigger = trigger;
  menuTrigger?.setAttribute('aria-expanded', 'true');
  menuEl = document.createElement('div');
  menuEl.className = 'menu';
  menuEl.setAttribute('role', role);
  if (minWidth) menuEl.style.minWidth = `${Math.min(minWidth, window.innerWidth - 16)}px`;
  if (trigger) menuEl.setAttribute('aria-label', trigger.getAttribute('aria-label') || trigger.title || 'Options');
  menuEl.innerHTML=items.map((it,i)=>menuItemHTML(it,i,role)).join('');
  document.body.appendChild(menuEl);
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
  menuEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
  const choices = [...menuEl.querySelectorAll('.menu-item:not(.disabled)')];
  let active = Math.max(0, choices.findIndex(b => items[+b.dataset.i].checked));
  let search = '', lastSearch = 0;
  const focusChoice = () => { choices[active]?.focus({ preventScroll:true }); choices[active]?.scrollIntoView({ block:'nearest' }); };
  menuEl.addEventListener('keydown', e => {
    if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      active = e.key === 'Home' ? 0 : e.key === 'End' ? choices.length - 1 : (active + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
      focusChoice();
    } else if (e.key === 'Tab') hideContextMenu();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== ' ') {
      e.preventDefault(); e.stopPropagation();
      search = (Date.now() - lastSearch > 700 ? '' : search) + e.key.toLowerCase();
      lastSearch = Date.now();
      const found = choices.findIndex(b => items[+b.dataset.i].label.toLowerCase().startsWith(search));
      if (found >= 0) { active = found; focusChoice(); }
    }
  });
  focusChoice();
  menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-item');
    if (!btn || btn.classList.contains('disabled')) return;
    const it = items[+btn.dataset.i];
    const trigger = menuTrigger;
    hideContextMenu();
    trigger?.focus({ preventScroll:true });
    it.action?.();
  });
}

export function hideContextMenu() {
  menuTrigger?.setAttribute('aria-expanded', 'false');
  menuTrigger = null;
  menuEl?.remove();
  menuEl = null;
}

window.addEventListener('pointerdown', event => {
  // Capture outside presses even when a canvas, input or resize handle stops bubbling.
  if (menuEl?.contains(event.target) || menuTrigger?.contains(event.target)) return;
  hideContextMenu();
}, true);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuEl) {
    e.stopImmediatePropagation();
    const trigger = menuTrigger;
    hideContextMenu();
    trigger?.focus({ preventScroll:true });
  }
}, true);
window.addEventListener('blur', hideContextMenu);

window.addEventListener('hashchange', hideContextMenu);
window.addEventListener('resize', hideContextMenu);
