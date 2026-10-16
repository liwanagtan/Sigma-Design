// Additive schema upgrades preserve documents and history. Never delete storage to
// recover an open failure: the next explicit operation may retry instead.
export function upgradeDatabase(database, transaction) {
  if (!database.objectStoreNames.contains('files')) database.createObjectStore('files', {keyPath:'id'});
  const files = transaction.objectStore('files');
  if (!files.indexNames.contains('projectId')) files.createIndex('projectId', 'projectId');
  if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', {keyPath:'id'});
  if (!database.objectStoreNames.contains('docs')) database.createObjectStore('docs', {keyPath:'id'});
  if (!database.objectStoreNames.contains('versions')) database.createObjectStore('versions', {keyPath:'id'});
  const versions = transaction.objectStore('versions');
  if (!versions.indexNames.contains('fileId')) versions.createIndex('fileId', 'fileId');
}

export function createDatabaseConnection({factory = globalThis.indexedDB, name = 'sigma', version = 3, blocked = () => {}, upgrade = upgradeDatabase} = {}) {
  let pending = null;
  return function open() {
    if (pending) return pending;
    const attempt = new Promise((resolve, reject) => {
      const request = factory.open(name, version);
      request.onupgradeneeded = () => {
        try {upgrade(request.result, request.transaction);}
        catch (error) {request.transaction.abort();reject(error);}
      };
      request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
      request.onblocked = blocked;
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {database.close(); if (pending === attempt) pending = null;};
        database.onclose = () => {if (pending === attempt) pending = null;};
        resolve(database);
      };
    });
    pending = attempt;
    // Clear only this failed attempt, never a newer connection. Keep rejection
    // visible to callers while permitting a later user-initiated retry.
    attempt.catch(() => {if (pending === attempt) pending = null;});
    return attempt;
  };
}
