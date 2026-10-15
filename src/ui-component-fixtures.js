// Fixtures reuse live control renderers where controls have anatomy, not painted substitutes.
import {menuItemHTML,switchHTML,fieldLabelHTML,appearanceControlHTML} from './ui-controls.js';
import {icons} from './icons.js';
import {lucideIcon} from './lucide.js';
import {UI_ICON_SIZES} from './ui-component-registry.js';
export function componentFixtureHTML(selector,state='Default'){
  const disabled=state==='Disabled'?' disabled':'',selected=state==='Selected';
  if(selector==='.menu-item')return menuItemHTML({label:'Dropdown item',shortcut:'⌘C',checked:selected,disabled:!!disabled},0,'listbox');
  if(selector==='.field')return `<label class="field">${fieldLabelHTML('X')}<input value="10" aria-label="Value"></label>`;
  if(selector==='.select')return `<select class="select"${disabled}><option>Select an option</option></select>`;
  if(selector==='.switch')return switchHTML('aria-label="Switch"',selected);
  if(selector==='.appearance-button')return appearanceControlHTML();
  if(selector==='.rail-btn')return `<button class="rail-btn" aria-label="Rail">${lucideIcon('plus',UI_ICON_SIZES.rail)}</button>`;
  if(selector==='.tb-btn')return `<button class="tb-btn${selected?' active':''}" aria-label="Tool">${icons.move}</button>`;
  if(selector==='.icon-btn')return `<button class="icon-btn" aria-label="Icon">${icons.plus}</button>`;
  if(selector==='.seg-item')return `<div class="seg"><button class="icon-btn${selected?' on':''}" aria-label="Left">${icons.alignLeft}</button></div>`;
  if(selector==='.seg')return `<div class="seg"><button class="icon-btn">${icons.alignLeft}</button><button class="icon-btn on">${icons.alignHCenter}</button><button class="icon-btn">${icons.alignRight}</button></div>`;
  if(selector==='.menu')return `<div class="menu" style="position:relative">${['Copy','Paste','Duplicate','Delete'].map((label,i)=>menuItemHTML({label},i)).join('')}</div>`;
  if(selector==='.file-name')return '<input class="file-name" value="Untitled" aria-label="File name">';
  if(selector==='.check-row')return '<label class="check-row"><input type="checkbox">Checkbox row</label>';
  if(selector.startsWith('.btn'))return `<button class="${selector.slice(1).replaceAll('.',' ')}"${disabled}>Button</button>`;
  const classes=selector.slice(1).replaceAll('.',' ');return `<div class="${classes}">${selector.slice(1)}</div>`;
}
