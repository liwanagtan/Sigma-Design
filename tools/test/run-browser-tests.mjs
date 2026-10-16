// Run the in-browser tests (tests/index.html) headlessly, for CI: node tools/test/run-browser-tests.mjs
// Needs Playwright, which isn't a dependency of Sigma: npm install --no-save playwright && npx playwright install chromium
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright isn’t installed: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

// The tests run in a project, as they do in development (examples/css-app).
const { server, url } = await startServer({ port: 0, strictPort: true, project: join(root, 'examples', 'css-app') });
const browser = await chromium.launch();
let failed = true;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.stack || err.message));
  await page.goto(`${url}/tests/`);
  // The runner sets the title to "✓ 197/197 – Sigma tests" (or ✗) when it's done.
  await page.waitForFunction(() => /^[✓✗] \d+\/\d+/.test(document.title), null, { timeout: 180000 });
  const title = await page.title();
  const failures = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n');
    return lines.map((l, i) => (/^✗/.test(l) ? lines.slice(i, i + 4).join('\n') : null)).filter(Boolean);
  });
  console.log(title.replace(/ – Sigma tests$/, ' in-browser tests passed'));
  for (const f of failures) console.log(`\n${f}`);
  for (const e of errors) console.log(`\npage error: ${e}`);
  failed = title.startsWith('✗') || failures.length > 0 || errors.length > 0;
} catch (err) {
  console.error(`The in-browser tests didn’t finish: ${err.message}`);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
