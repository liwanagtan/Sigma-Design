import {parseColorValue} from '../src/token-sync.js';
import {test,eq,ok} from './harness.js';
import {UI_COMPONENTS,UI_STYLESHEETS,UI_ICON_SIZES} from '../src/ui-component-registry.js';
import {componentFixtureHTML} from '../src/ui-component-fixtures.js';
import {sigmaTokenDocument,sigmaComponentsDocument} from '../src/sigma-design-system.js';
import {loadDocument,state,walk} from '../src/store.js';
import {resolveVariables} from '../src/variables.js';
import {ICON_SETS,loadIconSet,iconChoices} from '../src/icon-library.js';
import {sampleIconsDocument} from '../src/sample-icons.js';
import {LUCIDE_GLYPHS} from '../src/lucide-ui-data.js';
const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Parity fixture failed to load');};
test('source parity: icons publish the actual shared artwork and tokens cover root/scoped app roles',async()=>{
  const source=await loadIconSet(ICON_SETS.find(x=>x.id==='lucide')),upstream=new Map(source.icons.map(x=>[x[0],x[3]]));
  const icons=iconChoices(sampleIconsDocument().icons);eq(icons.length,Object.keys(LUCIDE_GLYPHS).length);for(const icon of icons)ok(icon.body.includes(upstream.get(icon.name)),icon.name);
  const t=sigmaTokenDocument();const code=t.collections[0];const property=code.variables.find(v=>v.name==='code/property');eq(code.modes.map(m=>property.valuesByMode[m.id]),['#006DA8','#9CDCFE']);eq(property.codeSyntax.web,'--code-property');ok(t.collections[1].variables.some(v=>v.type==='duration'&&Object.values(v.valuesByMode).includes(120)));ok(t.collections[1].variables.some(v=>v.type==='easing'));
});
test('source parity: actual controls and their specimens agree on inherited fonts, dimensions and icon sizes in both modes',async()=>{
  const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-5000px;width:1280px;height:900px';document.body.append(frame);
  try{
    frame.srcdoc=`<!doctype html>${UI_STYLESHEETS.map(p=>`<link rel="stylesheet" href="/${p}">`).join('')}<main id="fixture" style="position:relative;width:200px"></main>`;
    await wait(()=>frame.contentDocument?.querySelector('#fixture')&&frame.contentDocument.styleSheets.length===UI_STYLESHEETS.length);
    await frame.contentDocument.fonts.ready;
    const t=sigmaTokenDocument(),doc=sigmaComponentsDocument(t.collections);doc.variables={collections:t.collections};loadDocument(doc);resolveVariables();
    for(const mode of ['Light','Dark']){
      const d=frame.contentDocument,w=frame.contentWindow;d.documentElement.dataset.theme=mode.toLowerCase();
      const scope=d.createElement('section');scope.className='inspect-section';d.body.appendChild(scope);
      const iface=t.collections.find(c=>c.name==='Interface'),modeId=iface.modes.find(m=>m.name===mode).id;for(const variable of iface.variables.filter(v=>v.codeSyntax?.web)){const el=variable.name.startsWith('code/')?scope:d.documentElement;eq(variable.valuesByMode[modeId],w.getComputedStyle(el).getPropertyValue(variable.codeSyntax.web).trim().toUpperCase(),`${mode} ${variable.codeSyntax.web} comes from actual CSS`);}
      scope.remove();
      for(const selector of ['.btn','.btn.primary','.select','.field','.menu-item','.rail-btn','.tb-btn','.appearance-button']){
        const spec=UI_COMPONENTS.find(c=>c.selector===selector);d.querySelector('#fixture').innerHTML=componentFixtureHTML(selector);const el=d.querySelector('#fixture').firstElementChild,css=w.getComputedStyle(el);
        const page=state.doc.pages.find(p=>p.name===spec.name),set=page.children.find(n=>n.type==='componentSet'&&(mode==='Dark'?n.name.endsWith('Dark reference'):!n.name.endsWith('Dark reference'))),main=set.children.find(n=>n.name==='State=Default');
        eq(main.h,parseFloat(css.height),`${mode} ${selector} height`);eq(main.radius,parseFloat(css.borderRadius),`${mode} ${selector} radius`);
        const texts=[];walk(main.children,n=>{if(n.type==='text')texts.push(n);});for(const text of texts){eq(text.fontWeight,+css.fontWeight,`${mode} ${selector} font weight`);eq(text.fontSize,parseFloat(css.fontSize),`${mode} ${selector} font size`);}
        if(selector==='.rail-btn'||selector==='.tb-btn'){const icon=main.children[0];eq(icon.w,selector==='.rail-btn'?UI_ICON_SIZES.rail:UI_ICON_SIZES.tool);eq(icon.w,el.querySelector('svg').getBoundingClientRect().width);}
        if(selector==='.field'){eq(main.children.map(n=>n.name),['Field label','Input']);eq(main.props.value.default,el.querySelector('input').value);}
        if(selector==='.menu-item'){eq(main.children.map(n=>n.name),['Check region','Menu label','Shortcut region']);ok(main.props.checked);ok(main.props.shortcut);const checked=set.children.find(n=>n.name==='State=Selected');ok(checked.children[0].children[0].visible,'selected item shows the actual check region');}
      }
      for(const selector of ['.btn','.btn.primary','.btn.primary.destructive']){d.querySelector('#fixture').innerHTML=componentFixtureHTML(selector,'Disabled');const el=d.querySelector('#fixture').firstElementChild,css=w.getComputedStyle(el),spec=UI_COMPONENTS.find(c=>c.selector===selector),set=state.doc.pages.find(p=>p.name===spec.name).children.find(n=>n.type==='componentSet'&&(mode==='Dark'?n.name.endsWith('Dark reference'):!n.name.endsWith('Dark reference'))),main=set.children.find(n=>n.name==='State=Disabled');eq(main.children.find(n=>n.type==='text').fontWeight,+css.fontWeight,'disabled text inherits its real base control');eq(main.opacity,+css.opacity,'actual disabled opacity');}
      const rail=state.doc.pages.find(p=>p.name==='Rail button').children.find(n=>n.type==='componentSet');ok(rail.children.some(n=>n.name==='State=Focus'&&n.strokes?.length&&n.strokeWidth===2));
      const switchPage=state.doc.pages.find(p=>p.name==='Switch'),switchSet=switchPage.children.find(n=>n.type==='componentSet'&&(mode==='Dark'?n.name.endsWith('Dark reference'):!n.name.endsWith('Dark reference')));
      for(const stateName of ['Default','Selected']){d.querySelector('#fixture').innerHTML=componentFixtureHTML('.switch',stateName);const track=d.querySelector('#fixture .switch span'),css=w.getComputedStyle(track),thumbCSS=w.getComputedStyle(track,'::after'),main=switchSet.children.find(n=>n.name===`State=${stateName}`);eq(main.fills[0].color,parseColorValue(css.backgroundColor).hex,`${mode} actual switch track`);eq(main.children[0].w,parseFloat(thumbCSS.width));const translate=thumbCSS.transform==='none'?0:+thumbCSS.transform.match(/matrix\(([^)]+)\)/)[1].split(',')[4];eq(main.children[0].x,parseFloat(thumbCSS.left)+translate,`${mode} actual switch thumb position`);ok(main.children[0].bindings['effects.0'],'thumb uses the actual app shadow token');}
    }
  }finally{frame.remove();}
});
