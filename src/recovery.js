// Each tab/file owns a recovery record. Reading never applies or discards another tab's edits.
import {serializeDocument,deserializeDocument} from './document-storage.js';
import {prepareImportedDocument} from './document-safety.js';
const PREFIX='sigma.pending.';
export const recoveryKey=(fileId,tabId)=>PREFIX+encodeURIComponent(fileId)+'.'+encodeURIComponent(tabId);

export function writeRecovery(storage,tabId,{id,doc,views,revision}) {
  const key=recoveryKey(id,tabId);
  storage.setItem(key,JSON.stringify({format:1,id,name:doc.name||'Untitled',revision,t:Date.now(),document:serializeDocument(doc),views}));
  return key;
}

export function recoveryEntries(storage,{fileId=null}={}) {
  const entries=[];
  for(let i=0;i<storage.length;i++) {
    const key=storage.key(i);if(key!=='sigma.pending'&&!key?.startsWith(PREFIX))continue;
    const raw=storage.getItem(key);
    try {
      const record=JSON.parse(raw);
      if(!record||typeof record.id!=='string'||(!record.doc&&typeof record.document!=='string'))throw new Error('Invalid recovery record');
      if(!fileId||record.id===fileId)entries.push({key,record,raw});
    }catch{if(!fileId)entries.push({key,record:null,raw});} // retain unreadable records for download/review
  }
  return entries.sort((a,b)=>(b.record?.t||0)-(a.record?.t||0));
}

export function recoveredDocument(record) {
  const doc=prepareImportedDocument(record.document?deserializeDocument(record.document):structuredClone(record.doc));
  delete doc.project;delete doc.branch;delete doc.published;delete doc.publishedComponents;
  doc.name=`${doc.name||record.name||'Untitled'} (recovered)`;
  return doc;
}

// Only remove the exact record reviewed; a live tab may have updated the same key meanwhile.
export function removeRecovery(storage,key,expected) {
  if(storage.getItem(key)!==expected)return false;
  storage.removeItem(key);return true;
}
