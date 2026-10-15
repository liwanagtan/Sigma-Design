// Shared, pure report model for the editor and CLI. Metrics describe reuse, never design quality.
const KINDS = ['color', 'type', 'spacing', 'radius', 'shadow'];
export const REPORT_KINDS = { color:'Colors', type:'Typography fields', spacing:'Spacing', radius:'Corner radius', shadow:'Shadows' };
const TYPE_FIELDS = ['fontFamily','fontSize','fontWeight','lineHeight'];
const emptyKinds = () => Object.fromEntries(KINDS.map(k => [k,{bound:0,total:0}]));
const share = (a,b) => b ? a/b : null;
export const formatShare = x => x === null || !Number.isFinite(x) ? '—' : x>0&&x<0.005 ? '<1%' : x<1&&x>=0.995 ? '>99%' : `${Math.round(x*100)}%`;

// Property-driven fields are identified separately: a component property is not a token binding.
export function slots(n) {
  const b=n.bindings||{}, out=[];
  const add=(kind,path,binding=path)=>out.push({kind,path,bound:b[binding]||null,property:!!(n.propRefs?.[path]||(kind==='type'&&n.propRefs?.typography)),expected:kind==='type'?(binding==='typography'?'typography':path==='fontFamily'?'string':'number'):kind==='color'?'color':kind==='shadow'?'shadow':'number'});
  for(const [field,paints] of [['fills',n.fills],['strokes',(n.strokeWidth??1)>0?n.strokes:[]]])
    (paints||[]).forEach((p,i)=>{if(p.visible!==false&&(!p.type||p.type==='solid'))add('color',`${field}.${i}.color`);});
  (n.effects||[]).forEach((e,i)=>{if(e.visible!==false&&!String(e.type).includes('blur'))add('shadow',`effects.${i}`);});
  if(n.type==='text')for(const field of TYPE_FIELDS)add('type',field,b.typography?'typography':field);
  if(n.layout?.mode){
    const flow=(n.children||[]).filter(c=>c.visible!==false&&!c.absolute).length;
    for(const k of ['gap','pt','pr','pb','pl']){
      if(k==='gap'&&(n.layout.spacing==='auto'||flow<2))continue;
      if(b[`layout.${k}`]||(n.layout[k]??(k==='gap'?10:0))>0)add('spacing',`layout.${k}`);
    }
  }
  if(Array.isArray(n.radii))n.radii.forEach((value,i)=>{if(b[`radii.${i}`]||(value||0)>0)add('radius',`radii.${i}`);});
  else if(b.radius||(n.radius||0)>0)add('radius','radius');
  return out;
}

/** File-local resolution prevents another file's local tokens/components from satisfying a missing link. */
export function useReport(files, {since=null,handoff=false,includeHidden=false,includeSamples=true,fileId=null,maxFindings=2000}={}) {
  const chosen=files.filter(f=>(!fileId||f.id===fileId)&&(!since||(f.editedAt&&f.editedAt>=since))&&(includeSamples||!f.sample));
  const components=new Map(),tokens=new Map(),aliased=new Set(),componentUses=new Map(),tokenUses=new Map();
  const findings=[],perFile=[];
  const overall={layers:0,instances:0,linkedInstances:0,localInstances:0,unresolvedInstances:0,pages:0,hidden:0,unsupported:0,propertyValues:0,unresolvedBindings:0,kinds:emptyKinds()};
  let findingsTotal=0;
  const issue=(f,pg,n,type,paths)=>{
    findingsTotal++;
    if(findings.length<maxFindings)findings.push({fileId:f.id||f.path||null,fileName:f.name,path:f.path||null,pageId:pg.id,pageName:pg.name,nodeId:n.id,nodeName:n.name||n.type,type,paths});
  };
  const increment=(map,key)=>map.set(key,(map.get(key)||0)+1);
  for(const f of chosen){
    const identity=f.id||f.path||f.name, componentMap=new Map(),tokenMap=new Map();

    const addComponents=(list,library,owner,source,pageId=null)=>{
      for(const c of list||[]){
        const key=`${owner}\0${c.id}`,entry={key,id:c.id,name:c.name||c.id,library,source,fileId:source==='local'?identity:owner,pageId};
        components.set(key,{...entry,sources:[...new Set([...(components.get(key)?.sources||[]),source])].sort()});componentMap.set(c.id,entry);
        if(c.type==='componentSet')for(const v of c.children||[])componentMap.set(v.id,entry);
      }
    };
    const addTokens=(collections,name,owner,source)=>{
      for(const col of collections||[])for(const v of col.variables||[]){
        const key=`${owner}\0${v.id}`,entry={key,id:v.id,name:v.name||v.id,file:name,fileId:owner,source,type:v.type,collection:col.name};
        tokens.set(key,entry);tokenMap.set(v.id,{...entry,values:v.valuesByMode});
      }
    };
    for(const lib of f.doc.componentLibraries||[])addComponents(lib.components,lib.name,lib.fileId||lib.name,'linked');
    for(const lib of f.doc.libraries||[]){
      addTokens(lib.collections,lib.name,lib.fileId||lib.name,'linked');
      for(const dep of lib.dependencies||[])addTokens(dep.collections,dep.name,dep.fileId||dep.name,'linked');
    }
    addTokens((f.doc.variables?.collections||[]).filter(c=>!c.fromLibrary),f.name,identity,'local');
    for(const pg of f.doc.pages||[]){
      const visit=nodes=>{for(const n of nodes){if(n.type==='component'||n.type==='componentSet'){addComponents([n],f.name,identity,'local',pg.id);}else if(n.children&&n.type!=='instance')visit(n.children);}};
      visit(pg.children||[]);
    }
    const aliases=value=>{if(!value||typeof value!=='object')return;if(typeof value.alias==='string'){const t=tokenMap.get(value.alias);if(t)aliased.add(t.key);}else for(const v of Object.values(value))aliases(v);};
    for(const t of tokenMap.values())aliases(t.values);
    const r={id:identity,name:f.name,path:f.path||null,sample:!!f.sample,editedAt:f.editedAt||null,layers:0,instances:0,linkedInstances:0,localInstances:0,unresolvedInstances:0,pages:0,hidden:0,unsupported:0,propertyValues:0,unresolvedBindings:0,kinds:emptyKinds()};
    const pages=(f.doc.pages||[]).filter(pg=>!handoff||pg.handoff);
    r.pages=pages.length;
    for(const pg of pages){
      const visit=(nodes,inDefinition)=>{
        for(const n of nodes){
          if(n.visible===false&&!includeHidden){r.hidden++;continue;}
          const definition=inDefinition||n.type==='component'||n.type==='componentSet';
          if(n.type==='instance'){
            const c=componentMap.get(n.componentId);
            if(c)increment(componentUses,c.key);else issue(f,pg,n,'missing-component',['componentId']);
            if(!definition){r.layers++;r.instances++;r[c?c.source==='linked'?'linkedInstances':'localInstances':'unresolvedInstances']++;}
            continue; // Expanded instance internals are deliberately excluded to avoid double-counting.
          }
          if(!definition&&n.type!=='group')r.layers++;
          const unsupported=[...(n.fills||[]),...(n.strokes||[])].some(p=>p.visible!==false&&p.type&&p.type!=='solid');
          if(unsupported){r.unsupported++;issue(f,pg,n,'unsupported',[]);}
          const hardcoded=[],missing=[],invalid=[];
          for(const slot of slots(n)){
            if(slot.property&&!slot.bound){r.propertyValues++;continue;}
            r.kinds[slot.kind].total++;
            if(slot.bound&&tokenMap.has(slot.bound)){
              if(tokenMap.get(slot.bound).type===slot.expected)r.kinds[slot.kind].bound++;
              else {r.unresolvedBindings++;invalid.push(slot.path);}
            }
            else if(slot.bound){r.unresolvedBindings++;missing.push(slot.path);}
            else hardcoded.push(slot.path);
          }
          if(missing.length)issue(f,pg,n,'missing-token',missing);
          if(invalid.length)issue(f,pg,n,'invalid-token',invalid);
          if(hardcoded.length)issue(f,pg,n,'unbound',hardcoded);
          for(const id of Object.values(n.bindings||{})){const t=tokenMap.get(id);if(t)increment(tokenUses,t.key);}
          if(n.children)visit(n.children,definition);
        }
      };
      visit(pg.children||[],false);
    }
    r.componentShare=share(r.instances,r.layers);
    r.tokenBound=Object.values(r.kinds).reduce((sum,k)=>sum+k.bound,0);
    r.tokenTotal=Object.values(r.kinds).reduce((sum,k)=>sum+k.total,0);
    r.tokenShare=share(r.tokenBound,r.tokenTotal);
    perFile.push(r);
    for(const key of ['layers','instances','linkedInstances','localInstances','unresolvedInstances','pages','hidden','unsupported','propertyValues','unresolvedBindings'])overall[key]+=r[key];
    for(const kind of KINDS){overall.kinds[kind].bound+=r.kinds[kind].bound;overall.kinds[kind].total+=r.kinds[kind].total;}
  }
  overall.componentShare=share(overall.instances,overall.layers);
  overall.tokenBound=Object.values(overall.kinds).reduce((sum,k)=>sum+k.bound,0);
  overall.tokenTotal=Object.values(overall.kinds).reduce((sum,k)=>sum+k.total,0);
  overall.tokenShare=share(overall.tokenBound,overall.tokenTotal);
  const rank=(a,b)=>b.uses-a.uses||a.name.localeCompare(b.name);
  const componentList=[...components.values()].map(c=>({...c,uses:componentUses.get(c.key)||0})).sort(rank);
  const tokenList=[...tokens.values()].map(t=>({...t,uses:tokenUses.get(t.key)||0,referenced:aliased.has(t.key)})).sort(rank);
  return {files:perFile,overall,findings,findingsTotal,findingsTruncated:findingsTotal>findings.length,
    scope:{available:files.length,measured:chosen.length,unknownDates:since?files.filter(f=>(!fileId||f.id===fileId)&&(includeSamples||!f.sample)&&!f.editedAt).length:0,since,handoff,includeHidden,includeSamples},
    components:componentList.filter(c=>c.uses),unusedComponents:overall.pages?componentList.filter(c=>!c.uses):[],
    tokens:tokenList.filter(t=>t.uses),unusedTokens:overall.pages?tokenList.filter(t=>!t.uses&&!t.referenced):[]};
}

export function formatUseReport(r) {
  const pct=formatShare,lines=[`Component instances: ${pct(r.overall.componentShare)} of layers (${r.overall.instances} instances of ${r.overall.layers} layers; ${r.overall.linkedInstances} linked, ${r.overall.localInstances} local, ${r.overall.unresolvedInstances} unresolved)`,
    `Tokens: ${pct(r.overall.tokenShare)} of eligible values, by kind: ${Object.entries(r.overall.kinds).filter(([,x])=>x.total).map(([k,x])=>`${REPORT_KINDS[k].toLowerCase()} ${pct(share(x.bound,x.total))} (${x.bound}/${x.total})`).join(', ')}`,'','Files:'];
  for(const f of r.files)lines.push(`  ${f.name}${f.path?` (${f.path})`:''}: components ${pct(f.componentShare)}, tokens ${pct(f.tokenShare)}, ${f.layers} layers`);
  if(r.components.length)lines.push('','Most-used components:',...r.components.slice(0,10).map(c=>`  ${c.name}: ${c.uses}`));
  if(r.unusedComponents.length)lines.push('',`Components with no measured instances (${r.unusedComponents.length}):`,...r.unusedComponents.map(c=>`  ${c.name} (${c.library})`));
  if(r.tokens.length)lines.push('','Most-used tokens:',...r.tokens.slice(0,10).map(t=>`  ${t.name}: ${t.uses}`));
  if(r.unusedTokens.length)lines.push('',`Tokens with no measured references (${r.unusedTokens.length}):`,...r.unusedTokens.slice(0,30).map(t=>`  ${t.name} (${t.file})`));
  lines.push('',`Scope: ${r.overall.pages} pages; hidden layers ${r.scope.includeHidden?'included':'excluded'}; component definitions included for token coverage; instance internals excluded.`,
    `${r.overall.unsupported} layers with non-solid paints excluded from color coverage; ${r.overall.propertyValues} property-driven fields excluded. Usage is not a quality score.`);
  return lines.join('\n');
}
