import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
test('welcome design system source matches the repository stylesheet', () => {
  execFileSync(process.execPath, ['tools/design-system/build.mjs', '--check'], { cwd: new URL('../../', import.meta.url) });
});
