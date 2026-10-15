import {state,page,selectedNodes} from './store.js';
import {generateHTMLCode,codeDocument} from './code-create.js';
import {ask,isAsking} from './dialogs.js';
import {download} from './io.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openCodeCreation() {
  if(document.querySelector('.code-create-backdrop'))return;
  const before=document.activeElement,doc=state.doc,nodes=selectedNodes();
  const wrap=document.createElement('div');wrap.className='modal-backdrop code-create-backdrop';
  wrap.innerHTML=`<section class="modal code-create" role="dialog" aria-modal="true" aria-labelledby="code-create-title">
    <header class="code-create-head"><div><h2 id="code-create-title">Create code</h2><p>HTML / CSS · ${esc(doc.name)}</p></div><button class="btn" data-code-close>Close</button></header>
    <div class="code-create-toolbar"><label>Scope <select class="select" data-code-scope><option value="selection"${nodes.length?'':' disabled'}>Selection (${nodes.length})</option><option value="page"${nodes.length?'':' selected'}>Current page · ${esc(page().name)}</option></select></label><button class="btn primary" data-code-generate>Generate</button><span class="muted" data-code-status role="status"></span></div>
    <div class="code-create-body"><div class="code-create-source"><div class="code-create-actions"><button class="btn" data-code-copy>Copy HTML + CSS</button><button class="btn" data-code-download>Download HTML</button></div><label>HTML<textarea data-code-html spellcheck="false" aria-label="Generated HTML"></textarea></label><label>CSS<textarea data-code-css spellcheck="false" aria-label="Generated CSS"></textarea></label></div><div class="code-create-preview"><div class="code-create-actions"><strong>Preview</strong><label>Width <select class="select" data-code-width><option value="100%">Fit</option><option value="390px">390 px</option><option value="768px">768 px</option><option value="1280px">1280 px</option></select></label><button class="btn" data-code-preview>Update preview</button></div><div class="code-create-frame"><iframe title="Generated HTML preview" sandbox="" referrerpolicy="no-referrer"></iframe></div><details class="code-create-notes"><summary>Output notes and limitations</summary><p>Static HTML/CSS only. Scripts, embedded pages, navigation metadata, and external asset links are removed from preview and download.</p><ul data-code-notes></ul></details></div></div>
  </section>`;
  const html=wrap.querySelector('[data-code-html]'),css=wrap.querySelector('[data-code-css]'),status=wrap.querySelector('[data-code-status]'),frame=wrap.querySelector('iframe');
  let generated=null,dirty=false,busy=false;
  const source=()=>({html:html.value,css:css.value,name:generated?.name||doc.name});
  const refresh=()=>{frame.srcdoc=codeDocument(source());status.textContent=dirty?'Edited draft · Preview updated':'Generated draft · Preview updated';};
  const discard=()=>!dirty||ask('Discard your source edits? Copy or download them first to keep a copy.',{title:'Unsaved code draft',ok:'Discard edits'});
  const close=async()=>{if(busy)return;busy=true;try{if(!await discard())return;wrap.remove();window.removeEventListener('keydown',key,true);if(before?.isConnected)before.focus();}finally{busy=false;}};
  const generate=async()=>{
    if(busy)return;busy=true;
    try{
      if(!await discard())return;
      if(state.doc!==doc)throw new Error('The open Design file changed. Close this workspace and open it again.');
      const next=generateHTMLCode(nodes,{scope:wrap.querySelector('[data-code-scope]').value});
      generated=next;html.value=next.html;css.value=next.css;dirty=false;
      wrap.querySelector('[data-code-notes]').innerHTML=next.warnings.map(w=>`<li>${esc(w)}</li>`).join('');
      refresh();status.textContent=`${next.layers} layers generated · Preview updated`;
    }catch(error){status.textContent=error.message;}finally{busy=false;}
  };
  const key=e=>{
    if(isAsking())return;
    e.stopImmediatePropagation();
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){
      const focus=[...wrap.querySelectorAll('button,select,textarea,summary')].filter(el=>!el.disabled);
      if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0].focus();}
    }
  };
  wrap.addEventListener('pointerdown',e=>e.stopPropagation());
  wrap.addEventListener('input',e=>{if(e.target===html||e.target===css){dirty=true;status.textContent='Edited draft · Update preview to see changes';}});
  wrap.querySelector('[data-code-scope]').onchange=()=>{status.textContent='Scope changed · Generate to replace the draft';};
  wrap.querySelector('[data-code-width]').onchange=e=>{frame.style.width=e.target.value;};
  wrap.querySelector('[data-code-close]').onclick=close;
  wrap.querySelector('[data-code-generate]').onclick=generate;
  wrap.querySelector('[data-code-preview]').onclick=refresh;
  wrap.querySelector('[data-code-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(codeDocument(source()));status.textContent='HTML and CSS copied';}catch{status.textContent='Clipboard unavailable. Select the source to copy it, or download HTML.';}};
  wrap.querySelector('[data-code-download]').onclick=()=>{download(new Blob([codeDocument(source())],{type:'text/html'}),`${(generated?.name||'sigma-export').replace(/[^a-z0-9_-]+/gi,'-')}.html`);status.textContent='Downloaded HTML with embedded CSS';};
  window.addEventListener('keydown',key,true);document.body.append(wrap);wrap.querySelector('[data-code-generate]').focus();generate();
}
