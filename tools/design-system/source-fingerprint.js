// Shared by browser capture and Node verification. Excludes generated captures to avoid a cycle.
export const CAPTURE_SOURCES = [
  'index.html','styles.css','src/terminal.css','src/code-create.css','src/ui-controls.js','src/ui-component-registry.js','src/ui-component-fixtures.js','src/report.css','src/home.js','src/main.js','src/appearance.js',
  'src/icons.js','src/ui-icon-map.js','src/lucide.js','src/lucide-ui-data.js','src/icon-library.js',
  'src/icons-screen.js','src/icon-ui.js','src/tokens-screen.js','src/variables-ui.js',
  'src/rail.js','src/menu.js','src/panels.js','src/component-ui.js','src/component-docs.js',
  'src/render.js','src/layout-overlay.js','src/libraries.js','src/sample-icons.js',
  'src/sigma-design-system.js','src/sigma-ui-source.js','src/welcome.js','src/files.js',
  'tools/design-system/capture-pages.html','tools/design-system/source-fingerprint.js',
];
export async function captureSourceText(read) {
  return JSON.stringify(await Promise.all(CAPTURE_SOURCES.map(async path=>[path,await read(path)])));
}
