import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabaseConnection} from '../../src/database-connection.js';

test('database connection retries an asynchronous or synchronous open failure', async () => {
  let requests = [], sync = false;
  const open = createDatabaseConnection({factory:{open(){if(sync)throw Error('Storage disabled');const request={};requests.push(request);return request;}}});
  const first = open();assert.equal(open(), first);
  requests[0].error = Error('Storage temporarily blocked');requests[0].onerror();
  await assert.rejects(first, /temporarily/);
  sync = true;await assert.rejects(open(), /disabled/);
  sync = false;const retried = open();assert.equal(requests.length,2);
  const database = {close(){}};requests[1].result=database;requests[1].onsuccess();
  assert.equal(await retried,database);assert.equal(open(),retried);
  database.onclose();const reopened=open();assert.notEqual(reopened,retried);
  requests[2].result=database;requests[2].onsuccess();await reopened;
});

test('database version change closes old connection and allows a fresh open', async () => {
  const requests=[];let closes=0,blocks=0;
  const open=createDatabaseConnection({factory:{open(){const r={};requests.push(r);return r;}},blocked:()=>blocks++});
  const first=open();requests[0].onblocked();assert.equal(blocks,1);assert.equal(open(),first);
  const database={close(){closes++;}};requests[0].result=database;requests[0].onsuccess();await first;
  database.onversionchange();assert.equal(closes,1);
  const next=open();assert.equal(requests.length,2);requests[1].result={close(){}};requests[1].onsuccess();await next;
});
