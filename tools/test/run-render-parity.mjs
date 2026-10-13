// Render parity, for CI: Sigma's layout of each component library (and its pages) against the code's own render,
// captured from the project's components page. node tools/test/run-render-parity.mjs [project]
// Needs Playwright, which isn't a dependency of Sigma: npm install --no-save playwright && npx playwright install chromium
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const projectDir = resolve(process.argv[2] || join(root, 'examples', 'css-app'));
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright isn’t installed: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const { server, url } = await startServer({ port: 0, strictPort: true, project: projectDir });
const browser = await chromium.launch();
let failed = true;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${url}/tools/capture/parity.html`);
  await page.waitForFunction(() => window.sigmaParity, null, { timeout: 180000 });
  const result = await page.evaluate(() => window.sigmaParity);
  console.log(result.text);
  console.log(result.ok ? '\nSigma renders the same as the code.' : `\n${result.error ? 'Render parity couldn’t run.' : `${result.drift} differ from the code: fix the code, or update the library from it (Check against code…).`}`);
  failed = !result.ok;
} catch (err) {
  console.error(`Render parity didn’t finish: ${err.message}`);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
