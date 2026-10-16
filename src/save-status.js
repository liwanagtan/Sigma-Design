import {subscribe} from './store.js';
import {lucideIcon} from './lucide.js';
import {currentSaveState,getCurrentFileId,saveNow} from './files.js';
import {showContextMenu} from './menu.js';
import {openRecovery} from './recovery-ui.js';
import {recoveryEntries} from './recovery.js';
const LABELS={pending:'Unsaved changes',saving:'Saving…',saved:'Saved in browser',error:'Save failed',temporary:'Temporary edits',readonly:'Viewing history',unavailable:'File unavailable'};
export function installSaveStatus() {
  const hosts=[document.querySelector('.design-header'),document.querySelector('#tokens .tokens-header-actions'),document.querySelector('#icons .tokens-header-actions')].filter(Boolean);
  for(const host of hosts){
    const group=document.createElement('div');group.className='save-state';
    const label=document.createElement('span');label.dataset.saveState='';label.role='status';label.setAttribute('aria-live','polite');
    const button=document.createElement('button');button.className='icon-btn';button.innerHTML=lucideIcon('ellipsis',16);button.setAttribute('aria-label','Save and recovery options');button.setAttribute('aria-haspopup','menu');
    button.onclick=()=>{const box=button.getBoundingClientRect();showContextMenu(box.left,box.bottom+4,[
      {label:'Save now',disabled:['temporary','readonly','unavailable'].includes(currentSaveState().status),action:()=>saveNow().catch(()=>{})},
      {label:'Recover unsaved edits…',action:()=>openRecovery({fileId:getCurrentFileId()})},
    ],{trigger:button});};
    group.append(label,button);
    if(host.classList.contains('design-header'))host.insertBefore(group,host.querySelector('#design-appearance'));
    else host.prepend(group);
  }
  let seenFile=null;
  const update=()=>{
    const {status,message}=currentSaveState();
    for(const host of hosts){const group=host.querySelector('.save-state'),label=group.querySelector('[data-save-state]');group.hidden=status==='closed';group.dataset.state=status;label.textContent=LABELS[status]||'';label.title=message||(status==='temporary'?'Changes reset when leaving or refreshing. Make an editable copy to keep them.':status==='saved'?'Saved to this browser. Project backups protect against browser storage loss.':'');}
    const id=getCurrentFileId();
    if(id!==seenFile){seenFile=id;if(id&&status!=='temporary')queueMicrotask(()=>{
      try{if(id===getCurrentFileId()&&currentSaveState().status!=='error'&&recoveryEntries(localStorage,{fileId:id}).length)window.dispatchEvent(new CustomEvent('sigma:banner',{detail:{text:'Unsaved recovery entries are available for this file. Saved work has not been replaced.',label:'Review recovery',action:()=>openRecovery({fileId:id})}}));}catch{}
    });}
  };
  subscribe(kind=>{if(['doc','selection'].includes(kind))update();});
  window.addEventListener('sigma:save-state',update);window.addEventListener('sigma:recovery',update);window.addEventListener('hashchange',update);
  update();
}
