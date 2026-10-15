import {appearanceControlHTML} from './ui-controls.js';
import { icons } from './icons.js';
import { showContextMenu, hideContextMenu } from './menu.js';

export const APPEARANCE_KEY = 'sigma.appearance';
const system = window.matchMedia('(prefers-color-scheme: dark)');
export const appearance = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
export const appearancePreference = () => document.documentElement.dataset.appearance || 'auto';
export const resolveAppearance = (preference, systemDark) => preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference;
const label = () => ({ auto:'Auto', light:'Light', dark:'Dark' })[appearancePreference()];
const icon = icons.appearance;

function applyAppearance(systemDark = system.matches) {
  const value = resolveAppearance(appearancePreference(), systemDark);
  document.documentElement.dataset.theme = value;
  document.querySelectorAll('button[data-appearance]').forEach(button => {
    button.setAttribute('aria-label', `Appearance: ${label()}`);
    button.title = `Appearance: ${label()}`;
  });
  window.dispatchEvent(new CustomEvent('sigma:appearance', { detail:value }));
}
export function setAppearance(value, { persist = true } = {}) {
  if (!['auto','light','dark'].includes(value)) return false;
  document.documentElement.dataset.appearance = value;
  if (persist) try { localStorage.setItem(APPEARANCE_KEY, value); } catch {}
  applyAppearance();
  return true;
}
export function appearanceButtonHTML() {
  return appearanceControlHTML(label());
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('button[data-appearance]');
  if (!button) return;
  if (button.getAttribute('aria-expanded') === 'true') {
    hideContextMenu();
    return;
  }
  const box = button.getBoundingClientRect();
  showContextMenu(box.right - 160, box.bottom + 4, ['auto','light','dark'].map(value => ({
    label:({ auto:'Auto', light:'Light', dark:'Dark' })[value], checked:appearancePreference() === value,
    action:()=>setAppearance(value),
  })), { trigger:button });
});
window.addEventListener('storage', event => {
  if (event.key === APPEARANCE_KEY || event.key === null) {
    let value = event.newValue;
    if (event.key === null) try { value = localStorage.getItem(APPEARANCE_KEY); } catch {}
    setAppearance(['auto','light','dark'].includes(value) ? value : 'auto', { persist:false });
  }
});
system.addEventListener('change', event => {
  if (appearancePreference() === 'auto') applyAppearance(event.matches);
});
applyAppearance();
