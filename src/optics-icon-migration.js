// Refresh the built-in Optics icon payloads in place. IDs, node geometry, tokens,
// overrides and custom icons stay intact; stock artwork comes from pinned Lucide.
export const OPTICS_ICON_PROVIDER_VERSION = 1;
export function refreshOpticsIconDocument(original,catalogue,versions=new Map()) {
  if(original.opticsIconProvider===OPTICS_ICON_PROVIDER_VERSION)return {doc:original,changed:false};
  const byName=new Map(catalogue.icons.map(i=>[i[0],i[3]]));
  const doc=structuredClone(original);let found=0;
  const visit=value=>{
    if(!value||typeof value!=='object')return;
    if(typeof value.id==='string'&&value.id.startsWith('optics-')&&typeof value.body==='string'&&byName.has(value.name)) {
      value.body=byName.get(value.name);value.viewBox=catalogue.viewBox;value.strokeWidth=catalogue.strokeWidth;value.cap=catalogue.cap;value.join=catalogue.join;found++;
    }
    // Published component icon-file snapshots follow the same icon publication.
    if(value.fileId&&versions.has(value.fileId)&&Array.isArray(value.icons))value.version=versions.get(value.fileId);
    for(const child of Object.values(value))if(typeof child==='object')visit(child);
  };
  visit(doc);if(!found)return {doc:original,changed:false};
  doc.opticsIconProvider=OPTICS_ICON_PROVIDER_VERSION;
  if(doc.kind==='icons'){
    doc.source={...doc.source,name:'Lucide',version:catalogue.version,url:catalogue.url,license:catalogue.license,licenseText:catalogue.licenseText,note:'Canonical Lucide artwork. Legacy filled shape styles retain their existing IDs.'};
    if(doc.published){doc.published.version++;doc.published.publishedAt=Date.now();doc.published.notes='Lucide icon refresh';}
  }
  return {doc,changed:true};
}
export async function refreshStoredOpticsIcons(db,catalogue) {
  const metas=(await db.getAll('files')).filter(m=>m.optics&&!m.archivedAt&&!m.project);
  const versions=new Map(),changed=[];
  // Libraries first, then their consumers; never recreate or rename a file.
  for(const meta of [...metas.filter(m=>m.kind==='icons'),...metas.filter(m=>m.kind!=='icons')]){
    const record=await db.get('docs',meta.id);if(!record?.doc)continue;
    const result=refreshOpticsIconDocument(record.doc,catalogue,versions);
    if(result.doc.kind==='icons'&&result.doc.published)versions.set(meta.id,result.doc.published.version);
    if(!result.changed)continue;
    let applied=false;
    await db.updateFile(meta.id,(latest,current)=>{
      if(!current?.doc||!latest.optics)return {meta:latest,doc:current};
      const fresh=refreshOpticsIconDocument(current.doc,catalogue,versions);applied=fresh.changed;
      if(fresh.doc.kind==='icons'&&fresh.doc.published)versions.set(meta.id,fresh.doc.published.version);
      return {meta:{...latest,...(fresh.doc.kind==='icons'?{tokenVersion:fresh.doc.published?.version}:{}),...(fresh.changed?{thumbnail:null}:{})},doc:{...current,doc:fresh.doc}};
    });
    if(applied)changed.push(meta.id);
  }
  return changed;
}
