import { encodeDocumentRecord, decodeDocumentRecord } from './document-storage.js';
// Minimal promise wrapper around IndexedDB.
// Stores: `files` holds small metadata records (listed by the files home),
//         `docs` holds full documents, loaded only when a file is opened,
//         `versions` holds each file's version history (small records, indexed by fileId); the document
//         of a version lives in `docs` under the key `v:<version id>`.
const DB_NAME = 'sigma';
const DB_VERSION = 2;

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions', { keyPath: 'id' }).createIndex('fileId', 'fileId');
      };
      req.onsuccess = () => {
        const db = req.result;
        // A newer Sigma in another tab needs to upgrade storage: let it, and reconnect on next use.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      // An older Sigma in another tab still has storage open: the upgrade finishes once it reloads or closes.
      req.onblocked = () => window.dispatchEvent(new CustomEvent('sigma:toast', { detail: 'Sigma was updated. Reload or close other Sigma tabs to continue.' }));
    });
  }
  return dbPromise;
}

// Run `fn(tx)` in a transaction over `stores`; resolves with the result of the request `fn` returns.
async function transact(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    const req = fn(tx);
    if (req) req.onsuccess = () => void (result = req.result);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
  });
}

// Change an existing file in one transaction: `update(meta, docRecord)` returns { meta?, doc? } to write
// (or nothing). Resolves false, writing nothing, when the file no longer exists, so a save that races
// with a delete (in this tab or another) can never bring the file back.
async function updateFile(id, update) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'docs'], 'readwrite');
    const files = tx.objectStore('files'), docs = tx.objectStore('docs');
    let exists = false, meta, rec, pending = 2;
    const ready = () => {
      if (--pending) return;
      if (!meta) return;
      exists = true;
      try {
        const out = update(meta, decodeDocumentRecord(rec));
        if (out?.meta) files.put(out.meta);
        if (out?.doc) docs.put(encodeDocumentRecord(out.doc));
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
