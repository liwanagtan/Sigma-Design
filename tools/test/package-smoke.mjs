// Release check against an installed tarball, without checkout/module fallback.
// npm run test:package (requires npm registry access or an already populated cache).
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const scratch=await mkdtemp(join(tmpdir(),'sigma-package-'));
const npm=process.platform==='win32'?'npm.cmd':'npm';
let child;
async function command(bin,args,cwd) {
  const proc=spawn(bin,args,{cwd,env:process.env,stdio:['ignore','pipe','pipe']});
  let out='',err='';proc.stdout.on('data',data=>out+=data);proc.stderr.on('data',data=>err+=data);
  const timeout=setTimeout(()=>proc.kill('SIGTERM'),120000);
  let code;
  try {[code]=await once(proc,'exit');} finally {clearTimeout(timeout);}
  if(code!==0)throw new Error(`${bin} ${args[0]} failed (${code})\n${err}\n${out}`);
  return out;
}
try {
  const packed=JSON.parse(await command(npm,['pack','--ignore-scripts','--json','--pack-destination',scratch],root))[0];
  const paths=new Set(packed.files.map(file=>file.path));
  for(const path of ['LICENSE','NOTICE','CONTRIBUTING.md','docs/data-and-ai.md','docs/standalone-release.md','docs/sigma-source-parity.md','bin/sigma-design.mjs','src/main.js','src/database-connection.js','src/vendor/figma-parser.js','src/vendor/terminal/xterm.mjs']) {
    assert.ok(paths.has(path),`Package missing ${path}`);
  }
  assert.ok(![...paths].some(path=>path.startsWith('tools/test/')),'Development tests must not ship');
  assert.ok(![...paths].some(path=>path.startsWith('experiments/')),'Architecture experiments must not ship');
  const target=join(scratch,'consumer');await mkdir(target);
  await writeFile(join(target,'package.json'),JSON.stringify({name:'standalone-smoke',private:true}));
  await command(npm,['install','--omit=optional','--no-audit','--no-fund',join(scratch,packed.filename)],target);
  const installed=join(target,'node_modules','sigma-design');
  await assert.rejects(access(join(target,'node_modules','node-pty')), 'Optional native PTY should be absent');
  const cli=join(installed,'bin','sigma-design.mjs');
  assert.match(await command(process.execPath,[cli,'--help'],target),/standalone/);
  // Check all relative ES-module dependencies in shipped editor modules, not
  // just the routes fetched below. Missing files cannot resolve from checkout.
  for(const path of paths) {
    if(!path.startsWith('src/')||!path.endsWith('.js')&&!path.endsWith('.mjs'))continue;
    const text=await readFile(join(installed,path),'utf8');
    for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)) {
      if(!match[1].startsWith('.'))continue;
      await readFile(resolve(installed,dirname(path),match[1].split('?')[0]));
    }
  }
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  child=spawn(process.execPath,[cli,'standalone','--port',String(port),'--no-open'],{cwd:target,env:process.env,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{cleanup();reject(new Error('Installed CLI did not start:\n'+output));},15000);
    const check=()=>{if(output.includes('(standalone)')){cleanup();resolve();}};
    const exited=code=>{cleanup();reject(new Error(`Installed CLI exited (${code}):\n${output}`));};
    const cleanup=()=>{clearTimeout(timeout);child.stdout.off('data',check);child.off('exit',exited);child.off('error',exited);};
    child.stdout.on('data',check);child.once('exit',exited);child.once('error',exited);check();
  });
  const base=`http://127.0.0.1:${port}`;
  for(const path of ['/','/styles.css','/src/main.js','/src/database-connection.js','/src/vendor/terminal/xterm.mjs','/examples/optics/.sigma/tokens/optics-tokens.sigma.json']) {
    const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok((await response.text()).length>0,path);
  }
  const worker=await fetch(base+'/src/figma-import-worker.js');assert.equal(worker.status,200);
  assert.match(worker.headers.get('content-security-policy'),/connect-src 'none'/);
  const project=await fetch(base+'/api/project');assert.equal(project.status,404);
  assert.match((await project.json()).error,/standalone/);
  console.log(`Installed package smoke passed on ${process.version} (${process.platform}/${process.arch}); ${packed.files.length} files, ${packed.size} compressed bytes. Optional dependencies omitted.`);
} finally {
  if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await once(child,'exit');}
  await rm(scratch,{recursive:true,force:true});
}
