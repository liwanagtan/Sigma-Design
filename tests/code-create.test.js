import {test,eq,ok} from './harness.js';
import {useDoc} from './core.test.js';
import {state,createNode,makePaint,select} from '../src/store.js';
import {resolveVariables} from '../src/variables.js';
import {generateHTMLCode,codeDocument} from '../src/code-create.js';
import {openCodeCreation} from '../src/code-create-ui.js';
import {answerWith} from '../src/dialogs.js';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('code creation: escaped HTML, token names/current modes, layout and accessible semantics',()=>{
  const label=createNode('text',{name:'Label',text:'Save <script>bad()</script>',fills:[makePaint('#fff')]});
  const button=createNode('frame',{name:'Button',w:180,h:40,children:[label],fills:[makePaint('#fff')],bindings:{'fills.0.color':'v'},layout:{mode:'horizontal',gap:8,pt:8,pr:12,pb:8,pl:12},a11y:{role:'button',label:'Save "now"'}});
  const doc=useDoc([button]);doc.variables={collections:[{id:'c',name:'Theme',defaultModeId:'light',modes:[{id:'light',name:'Light'},{id:'dark',name:'Dark'}],variables:[{id:'v',name:'surface',type:'color',codeSyntax:{web:'--app-surface'},valuesByMode:{light:'#FFFFFF',dark:'#112233'}}]}]};doc.pages[0].modes={c:'dark'};resolveVariables();
  const before=JSON.stringify(doc),out=generateHTMLCode([button,label]);
  eq(out.layers,2);ok(out.html.includes('<button'));ok(out.html.includes('Save &lt;script&gt;'));ok(out.html.includes('aria-label="Save &quot;now&quot;"'));ok(out.css.includes('var(--app-surface)'));ok(out.css.includes('--app-surface: #112233;'));ok(out.css.includes('display: flex'));eq(JSON.stringify(doc),before,'generation does not mutate design');
  const parsed=new DOMParser().parseFromString(codeDocument(out),'text/html');eq(parsed.querySelectorAll('script').length,0);eq(parsed.querySelectorAll('button').length,1);
});
test('code creation: omitted unsafe images, isolated preview document, and bounded generation errors',()=>{
  const image=createNode('image',{src:'https://example.com/private.png',name:'Image'});useDoc([image]);
  const out=generateHTMLCode([image]);ok(out.warnings.some(w=>w.includes('image source')));ok(!out.html.includes('https://'));
  const parsed=new DOMParser().parseFromString(codeDocument({html:'<meta http-equiv=refresh content="0;url=https://example.com"><iframe src="https://example.com"></iframe><p onclick="bad()">Preview</p>',css:'x{color:red}</style><script>bad()</script>'}),'text/html');eq(parsed.querySelectorAll('script,iframe,[onclick]').length,0);eq(parsed.querySelectorAll('meta[http-equiv=refresh]').length,0);ok(parsed.querySelector('meta[http-equiv]').content.includes("default-src 'none'"));
  let failed=false;try{generateHTMLCode([]);}catch{failed=true;}ok(failed);
});
test('code creation workspace: edits require confirmation before regeneration/close and never edit design',async()=>{
  const node=createNode('text',{text:'Original'});const doc=useDoc([node]);select([node.id]);const before=JSON.stringify(doc);
  try{
    openCodeCreation();await settle();const wrap=document.querySelector('.code-create-backdrop');ok(wrap);eq(wrap.querySelector('iframe').getAttribute('sandbox'),'');
    const input=wrap.querySelector('[data-code-html]');ok(input.value.includes('Original'));input.value='<p>Manual edit</p>';input.dispatchEvent(new Event('input',{bubbles:true}));
    answerWith(()=>false);wrap.querySelector('[data-code-generate]').click();await settle();eq(input.value,'<p>Manual edit</p>');wrap.querySelector('[data-code-close]').click();await settle();ok(wrap.isConnected);
    wrap.querySelector('[data-code-preview]').click();ok(wrap.querySelector('iframe').srcdoc.includes('Manual edit'));eq(JSON.stringify(doc),before);
    answerWith(()=>true);wrap.querySelector('[data-code-generate]').click();await settle();ok(input.value.includes('Original'));wrap.querySelector('[data-code-close]').click();await settle();ok(!wrap.isConnected);
  }finally{answerWith(()=>true);document.querySelector('[data-code-close]')?.click();await settle();answerWith(null);}
});

test('code creation: responsive base rules precede media rules and unused tokens are excluded',()=>{
  const child=createNode('text',{text:'Details'});
  const frame=createNode('frame',{children:[child],layout:{mode:'horizontal',gap:16,breakpoints:[{maxW:600,mode:'vertical',gap:8,hide:[child.id]}]}});
  const doc=useDoc([frame]);doc.variables={collections:[{id:'c',name:'Unused',defaultModeId:'m',modes:[{id:'m',name:'Default'}],variables:[{id:'unused',name:'unused',type:'color',valuesByMode:{m:'#FF0000'}}]}]};
  const out=generateHTMLCode([frame]);ok(!out.css.includes('--unused'));ok(out.css.includes('@media (max-width: 600px)'));ok(out.css.includes('.sigma-layer-2 { display: none; }'));ok(out.css.indexOf('flex-direction: row')<out.css.lastIndexOf('flex-direction: column'));
});
