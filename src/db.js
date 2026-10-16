import {createDatabaseConnection} from './database-connection.js';
import { encodeDocumentRecord, decodeDocumentRecord } from './document-storage.js';
import {linkedFileIds} from './project-backup.js';
// Minimal promise wrapper around IndexedDB.
// Stores: `files` holds small metadata records (listed by the files home),
//         `docs` holds full documents, loaded only when a file is opened,
//         `versions` holds each file's version history (small records, indexed by fileId); the document
//         of a version lives in `docs` under the key `v:<version id>`.
const openDB = createDatabaseConnection({
  blocked: () => window.dispatchEvent(new CustomEvent('sigma:toast', {detail:'Sigma was updated. Reload or close other Sigma tabs to continue.'})),
});

// Run `fn(tx)` in a transaction over `stores`; resolves with the result of the request `fn` returns.
async function transact(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
    try {
      const req = fn(tx);
      if (req) req.onsuccess = () => void (result = req.result);
    } catch(error) {tx.abort();reject(error);}
  });
}

// Change an existing file in one transaction: `update(meta, docRecord)` returns { meta?, doc? } to write
// (or nothing). Resolves false, writing nothing, when the file no longer exists, so a save that races
// with a delete (in this tab or another) can never bring the file back.
async function updateFile(id, update) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'docs', 'versions'], 'readwrite');
    const files = tx.objectStore('files'), docs = tx.objectStore('docs');
    let exists = false, meta, rec, pending = 2;
    const ready = () => {
      if (--pending) return;
      if (!meta) return;
      exists = true;
      try {
        const out = update(meta, decodeDocumentRecord(rec));
        if (out?.doc && out.contentChanged !== false) out.meta = {...(out.meta || meta), docRevision:(meta.docRevision || 0) + 1};
        if (out?.meta) files.put(out.meta);
        if (out?.doc) docs.put(encodeDocumentRecord(out.doc));
        if (out?.version) {
          tx.objectStore('versions').add(out.version.record);
          docs.add(encodeDocumentRecord({id:'v:'+out.version.record.id,doc:out.version.doc}));
        }
      } catch(error) {tx.abort();reject(error);}
    };
    files.get(id).onsuccess = (e) => { meta = e.target.result; ready(); };
    docs.get(id).onsuccess = (e) => { rec = e.target.result; ready(); };
    tx.oncomplete = () => resolve(exists);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
  });
}

export const db = {
  updateFile,
  // A consistent read across ownership, content and all historical dependency snapshots.
  backupProject: async projectId => {
    const database=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction(['projects','files','docs','versions'],'readonly');
      const entries=new Map(),missing=new Set();let metadata,project;
      const fail=error=>{tx.abort();reject(error);};
      function include(id) {
        if(entries.has(id)||missing.has(id))return;
        const meta=metadata.find(f=>f.id===id);
        if(!meta){missing.add(id);return;}
        if(meta.project&&(meta.projectId||null)===(projectId||null))throw new Error('Repository files must be backed up through their repository.');
        const entry={meta,versions:[]};entries.set(id,entry);
        tx.objectStore('docs').get(id).onsuccess=e=>{try{
          const rec=decodeDocumentRecord(e.target.result);
          if(!rec?.doc)throw new Error(`Cannot back up ${meta.name}: document is missing.`);
          entry.doc=rec.doc;entry.views=rec.views;
          for(const linked of linkedFileIds(rec.doc))include(linked);
        }catch(error){fail(error);}};
        tx.objectStore('versions').index('fileId').getAll(id).onsuccess=e=>{try{
          for(const record of e.target.result)tx.objectStore('docs').get('v:'+record.id).onsuccess=v=>{try{
            const rec=decodeDocumentRecord(v.target.result);if(!rec?.doc)throw new Error(`Cannot back up ${meta.name}: a historical document is missing.`);
            entry.versions.push({record,doc:rec.doc});for(const linked of linkedFileIds(rec.doc))include(linked);
          }catch(error){fail(error);}};
        }catch(error){fail(error);}};
      }
      if(projectId)tx.objectStore('projects').get(projectId).onsuccess=e=>{project=e.target.result;};
      tx.objectStore('files').getAll().onsuccess=e=>{try{
        metadata=e.target.result;
        for(const f of metadata)if((f.projectId||null)===(projectId||null))include(f.id);
      }catch(error){fail(error);}};
      tx.oncomplete=()=>resolve({project:project||{name:'Drafts'},files:[...entries.values()],missingDependencies:[...missing]});
      tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Backup snapshot aborted.'));
    });
  },
  restoreProject: async prepared => {
    // Encode before opening the transaction: preparation failures never leave partial imports.
    const records=prepared.files.map(f=>({...f,stored:encodeDocumentRecord({id:f.meta.id,doc:f.doc,views:f.views}),history:f.versions.map(v=>({record:v.record,stored:encodeDocumentRecord({id:'v:'+v.record.id,doc:v.doc})}))}));
    const database=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction(['projects','files','docs','versions'],'readwrite');
      tx.objectStore('projects').getAll().onsuccess=e=>{
        const used=new Set(e.target.result.filter(p=>typeof p.name==='string').map(p=>p.name.toLowerCase()));
        const base=prepared.project.name;let name=base+' (restored)',i=2;
        while(used.has(name.toLowerCase()))name=base+` (restored ${i++})`;
        prepared.project.name=name;tx.objectStore('projects').add(prepared.project);
        for(const f of records){
          tx.objectStore('files').add(f.meta);tx.objectStore('docs').add(f.stored);
          for(const v of f.history){tx.objectStore('versions').add(v.record);tx.objectStore('docs').add(v.stored);}
        }
      };
      tx.oncomplete=()=>resolve(prepared.project.id);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Restore aborted; no files imported.'));
    });
  },
  delete:(store,id)=>transact(store,'readwrite',tx=>tx.objectStore(store).delete(id)),
  // Ownership migrations and batch moves operate on metadata only, atomically.
  projectUpdate: async (update) => {
    const database=await openDB();
    return new Promise((resolve,reject)=> {
      const tx=database.transaction(['projects','files'],'readwrite');
      let projects,files,result;
      const ready=()=>{if(!projects||!files)return;try {
        const changes=update(projects,files);result=changes.result;
        for(const p of changes.projects||[]) tx.objectStore('projects').put(p);
        for(const f of changes.files||[]) tx.objectStore('files').put(f);
      }catch(error){tx.abort();reject(error);}};
      tx.objectStore('projects').getAll().onsuccess=e=>{projects=e.target.result;ready();};
      tx.objectStore('files').getAll().onsuccess=e=>{files=e.target.result;ready();};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Project update aborted'));
    });
  },

  get: async (store, id) => {const value=await transact(store, 'readonly', (tx) => tx.objectStore(store).get(id));return store==='docs' ? decodeDocumentRecord(value) : value;},
  getAll: async (store) => {const values=await transact(store, 'readonly', (tx) => tx.objectStore(store).getAll());return store==='docs' ? values.map(decodeDocumentRecord) : values;},
  put: (store, value) => {const record=store==='docs' ? encodeDocumentRecord(value) : value;return transact(store, 'readwrite', (tx) => tx.objectStore(store).put(record));},

  // Write a file's metadata and document atomically.
  putFile: (meta, docRecord) => {const record=encodeDocumentRecord(docRecord);return transact(['files', 'docs'], 'readwrite', (tx) => {
    tx.objectStore('docs').put(record);
    return tx.objectStore('files').put(meta);
  });},

  deleteFile: (id) => transact(['files', 'docs', 'versions'], 'readwrite', (tx) => {
    const docs = tx.objectStore('docs');
    const versions = tx.objectStore('versions');
    docs.delete(id);
    versions.index('fileId').getAllKeys(id).onsuccess = (e) => {
      for (const k of e.target.result) {
        versions.delete(k);
        docs.delete(`v:${k}`);
      }
    };
    return tx.objectStore('files').delete(id);
  }),

  versionsOf: (fileId) => transact('versions', 'readonly', (tx) => tx.objectStore('versions').index('fileId').getAll(fileId)),
  // Only while the file exists (no orphaned versions from a save that raced with a delete).
  putVersion: (record, doc) => {const stored=doc && encodeDocumentRecord({id:`v:${record.id}`,doc});return transact(['files', 'versions', 'docs'], 'readwrite', (tx) => {
    tx.objectStore('files').getKey(record.fileId).onsuccess = (e) => {
      if (e.target.result === undefined) return;
      if (stored) tx.objectStore('docs').put(stored);
      tx.objectStore('versions').put(record);
    };
  });},
  versionDoc: async (id) => decodeDocumentRecord(await transact('docs', 'readonly', (tx) => tx.objectStore('docs').get(`v:${id}`)))?.doc || null,
  deleteVersions: (ids) => transact(['versions', 'docs'], 'readwrite', (tx) => {
    for (const id of ids) {
      tx.objectStore('versions').delete(id);
      tx.objectStore('docs').delete(`v:${id}`);
    }
  }),
};
