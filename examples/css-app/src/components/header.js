import { Button } from './button.js';

// AppHeader({ current, action }): the bar on every page; action is a Button's props (or null)
export function AppHeader({ current, action = null }) {
  const el = document.createElement('header');
  el.className = 'app-header';
  const brand = Object.assign(document.createElement('span'), { className: 'app-header__brand', textContent: 'Acme' });
  const nav = Object.assign(document.createElement('nav'), { className: 'app-header__nav' });
  for (const [label, href] of [['Projects', 'index.html'], ['Settings', 'settings.html']]) {
    const a = Object.assign(document.createElement('a'), { className: 'app-header__link', href, textContent: label });
    if (label === current) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  const start = Object.assign(document.createElement('div'), { className: 'app-header__start' });
  start.append(brand, nav);
  el.append(start);
  if (action) el.append(Button(action));
  return el;
}
