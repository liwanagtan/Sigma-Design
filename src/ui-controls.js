// Reused by live controls and the component parity fixtures.
import {lucideIcon} from './lucide.js';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function menuItemHTML(it,i,role='menu') {
  if(it==='-')return '<div class="menu-sep"></div>';
  return `<button class="menu-item${it.disabled?' disabled':''}" data-i="${i}" role="${role==='listbox'?'option':'menuitem'}"${role==='listbox'?` aria-selected="${!!it.checked}"`:''} aria-disabled="${!!it.disabled}" tabindex="-1"><span class="menu-check">${it.checked?lucideIcon('check',12):''}</span><span class="menu-label">${esc(it.label)}</span><span class="menu-shortcut">${esc(it.shortcut||'')}</span></button>`;
}
export const switchHTML=(attrs,on)=>`<label class="switch"><input type="checkbox" ${attrs} ${on?'checked':''}><span></span></label>`;
export const fieldLabelHTML=(content,attrs='')=>`<span class="field-label" ${attrs}>${content}</span>`;

export const appearanceControlHTML = (label='Auto') => `<button type="button" data-appearance class="icon-btn appearance-button" aria-label="Appearance: ${esc(label)}" title="Appearance: ${esc(label)}" aria-haspopup="menu" aria-expanded="false">${lucideIcon('sun-moon',16)}</button>`;
