// Minimal promise wrapper around IndexedDB.
// Stores: `files` holds small metadata records (listed by the files home),
//         `docs` holds full documents, loaded only when a file is opened.
const DB_NAME = 'sigma';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Sigma storage is blocked by another tab. Close other Sigma tabs and reload.'));
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

export const db = {
  get: (store, id) => transact(store, 'readonly', (tx) => tx.objectStore(store).get(id)),
  getAll: (store) => transact(store, 'readonly', (tx) => tx.objectStore(store).getAll()),
  put: (store, value) => transact(store, 'readwrite', (tx) => tx.objectStore(store).put(value)),

  // Write a file's metadata and document atomically.
  putFile: (meta, docRecord) => transact(['files', 'docs'], 'readwrite', (tx) => {
    tx.objectStore('docs').put(docRecord);
    return tx.objectStore('files').put(meta);
  }),

  deleteFile: (id) => transact(['files', 'docs'], 'readwrite', (tx) => {
    tx.objectStore('docs').delete(id);
    return tx.objectStore('files').delete(id);
  }),
};
