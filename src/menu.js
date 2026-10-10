let menuEl = null;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// items: Array<{label, shortcut?, action, disabled?, checked?} | '-'>
export function showContextMenu(x, y, items) {
  hideContextMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'menu';
  menuEl.innerHTML = items
    .map((it, i) => it === '-'
      ? '<div class="menu-sep"></div>'
      : `<button class="menu-item${it.disabled ? ' disabled' : ''}" data-i="${i}">` +
        `<span class="menu-check">${it.checked ? '✓' : ''}</span><span class="menu-label">${esc(it.label)}</span>` +
        `<span class="menu-shortcut">${esc(it.shortcut || '')}</span></button>`)
    .join('');
  document.body.appendChild(menuEl);
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = `${Math.min(x, window.innerWidth - r.width - 8)}px`;
  menuEl.style.top = `${Math.min(y, window.innerHeight - r.height - 8)}px`;
  menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-item');
    if (!btn || btn.classList.contains('disabled')) return;
    const it = items[+btn.dataset.i];
    hideContextMenu();
    it.action?.();
  });
}

export function hideContextMenu() {
  menuEl?.remove();
  menuEl = null;
}

window.addEventListener('pointerdown', hideContextMenu);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuEl) {
    e.stopImmediatePropagation();
    hideContextMenu();
  }
}, true);
window.addEventListener('blur', hideContextMenu);
