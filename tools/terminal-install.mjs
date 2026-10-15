// node-pty 1.1.0's packaged Unix helper may lack its executable bit.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync, chmodSync, statSync } from 'node:fs';
try {
  if (process.platform !== 'win32') {
    const root = dirname(createRequire(import.meta.url).resolve('node-pty/package.json'));
    for (const path of [join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'), join(root, 'build/Release/spawn-helper')]) {
      if (existsSync(path)) chmodSync(path, statSync(path).mode | 0o100);
    }
  }
} catch { console.warn("Sigma: native terminal unavailable. The editor can still run; install/rebuild node-pty to enable Terminal."); }
