import {test, eq, ok} from './harness.js';
import {createDatabaseConnection, upgradeDatabase} from '../src/database-connection.js';

const request = req => new Promise((resolve,reject) => {req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const complete = tx => new Promise((resolve,reject) => {tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});

for (const version of [1,2]) test(`database upgrade: version ${version} preserves documents, history and ownership`, async () => {
  const name='sigma-upgrade-test-'+crypto.randomUUID();let database;
  try {
    const seed=indexedDB.open(name,version);
    seed.onupgradeneeded=()=>{
      const old=seed.result;
      old.createObjectStore('files',{keyPath:'id'});
      old.createObjectStore('docs',{keyPath:'id'});
      const versions=old.createObjectStore('versions',{keyPath:'id'});
      if(version===2)versions.createIndex('fileId','fileId');
    };
    database=await request(seed);
    const tx=database.transaction(['files','docs','versions'],'readwrite'),done=complete(tx);
    const meta={id:'file',name:'Authored work',projectId:'owned',archived:true};
    const doc={id:'file',doc:{name:'Original',pages:[]}};
    tx.objectStore('files').put(meta);tx.objectStore('docs').put(doc);
    tx.objectStore('versions').put({id:'history',fileId:'file',name:'Before edits'});
    tx.objectStore('docs').put({id:'v:history',doc:{name:'Historical',pages:[]}});
    await done;database.close();
    database=await createDatabaseConnection({name})();
    eq(database.version,3);ok(database.objectStoreNames.contains('projects'));
    const read=database.transaction(['files','docs','versions'],'readonly');
    const values=await Promise.all([
      request(read.objectStore('files').get('file')),
      request(read.objectStore('docs').get('file')),
      request(read.objectStore('docs').get('v:history')),
      request(read.objectStore('versions').index('fileId').getAll('file')),
      request(read.objectStore('files').index('projectId').getAllKeys('owned')),
    ]);
    eq(values[0],meta);eq(values[1],doc);eq(values[2].doc.name,'Historical');
    eq(values[3][0].name,'Before edits');eq(values[4],['file']);
  } finally {database?.close();await request(indexedDB.deleteDatabase(name));}
});

test('database upgrade: an aborted upgrade preserves old data and can retry', async () => {
  const name='sigma-upgrade-test-'+crypto.randomUUID();let database;
  try {
    const seed=indexedDB.open(name,1);
    seed.onupgradeneeded=()=>seed.result.createObjectStore('docs',{keyPath:'id'});
    database=await request(seed);
    const tx=database.transaction('docs','readwrite'),done=complete(tx);
    tx.objectStore('docs').put({id:'authored',doc:{name:'Keep this work'}});await done;database.close();
    let abort=true;
    const open=createDatabaseConnection({name,upgrade(database,transaction){
      upgradeDatabase(database,transaction);if(abort)transaction.abort();
    }});
    let failed=false;try{await open();}catch(error){failed=error.name==='AbortError';}ok(failed);
    database=await request(indexedDB.open(name));eq(database.version,1);
    eq((await request(database.transaction('docs').objectStore('docs').get('authored'))).doc.name,'Keep this work');
    database.close();abort=false;database=await open();eq(database.version,3);
    eq((await request(database.transaction('docs').objectStore('docs').get('authored'))).doc.name,'Keep this work');
  } finally {database?.close();await request(indexedDB.deleteDatabase(name));}
});
