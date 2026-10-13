// Optics (Phase 36): the working design system in Welcome to Sigma passes Sigma's own checks.
import { test, eq, ok } from './harness.js';
import { state, loadDocument, walk } from '../src/store.js';
import { libraryEntry } from '../src/variables.js';
import { layOutDocument } from '../src/lay-out.js';
import { loadIconSet, ICON_SETS, usedIconIds, newIconsDocument } from '../src/icon-library.js';
import { sampleIconsDocument } from '../src/sample-icons.js';
import { opticsTokenDocument } from '../src/optics-tokens.js';
import { opticsComponentsDocument, opticsFoundationsDocument, OPTICS_ICONS } from '../src/optics.js';
import { auditDocument } from '../src/audit.js';
import { checkAccessibility } from '../src/a11y.js';
import { readiness, componentRows } from '../src/component-docs.js';
import { useReport } from '../src/use-report.js';
import { toProjectFile } from '../src/project-format.js';
import { validateFile } from '../src/validate.js';
import { newTokenDocument } from '../src/files.js';

let built = null;
async function optics() {
  if (built) return built;
  const tokens = opticsTokenDocument();
  const icons = sampleIconsDocument(await loadIconSet(ICON_SETS.find((s) => s.id === 'lucide'))).icons;
  const published = { version: 1, collections: tokens.collections };
  const link = (doc) => {
    doc.libraries = [libraryEntry('optics-tokens', tokens.name, published)];
    const used = usedIconIds(doc.pages.flatMap((pg) => pg.children));
    doc.iconLibraries = [{ fileId: 'sigma-icons', name: 'Sigma Icons', version: 1, count: icons.length, icons: icons.filter((x) => used.has(x.id)) }];
    return doc;
  };
  built = {
    tokens, icons,
    components: () => link(opticsComponentsDocument(tokens.collections)),
    foundations: () => link(opticsFoundationsDocument(tokens.collections, { icons })),
  };
  return built;
}
// Open a document as the editor does: loaded, then laid out (tokens, instances, text, auto layout).
function open(doc) {
  loadDocument(doc);
  layOutDocument();
  return state.doc;
}
const errorsIn = (doc) => doc.pages.flatMap((pg) => checkAccessibility(pg.children).filter((i) => i.severity === 'error').map((i) => `${pg.name}: ${i.name} — ${i.message}`));

test('optics: the tokens are complete, every one with a CSS variable', async () => {
  const { tokens, icons } = await optics();
  eq(tokens.collections.map((c) => [c.name, c.modes.map((m) => m.name)]), [['Primitives', ['Value']], ['Semantic', ['Light', 'Dark']], ['Typography', ['Default']]]);
  const all = tokens.collections.flatMap((c) => c.variables);
  ok(all.length > 200, `${all.length} tokens`);
  ok(all.every((v) => v.codeSyntax.web.startsWith('--optics-')));
  ok(OPTICS_ICONS.every((id) => icons.some((x) => x.id === id)), 'every icon Optics uses is in Sigma Icons');
});

test('optics: Optics Components validate, use tokens for every value, and every component is Ready', async () => {
  const doc = open((await optics()).components());
  // Valid in the file format, with the token file it uses.
  const { tokens, icons } = await optics();
  const tokenDoc = newTokenDocument(tokens.name);
  tokenDoc.variables.collections = tokens.collections;
  const iconDoc = newIconsDocument('Sigma Icons');
  iconDoc.icons = icons;
  const paths = { 'optics-tokens': '.sigma/tokens/optics.sigma.json', 'sigma-icons': '.sigma/icons/sigma.sigma.json' };
  const files = { [paths['optics-tokens']]: toProjectFile(tokenDoc).file, [paths['sigma-icons']]: toProjectFile(iconDoc).file };
  const file = toProjectFile(doc, { pathOf: (id) => paths[id] || null }).file;
  for (const pg of file.pages) {
    delete pg.welcomeColumns; // arranged when the editor opens it
    delete pg.welcomeRows;
  }
  const errors = validateFile(file, { path: '.sigma/design/optics-components.sigma.json', files }).filter((i) => i.level === 'error');
  eq(errors.map((e) => `${e.at}: ${e.message}`).slice(0, 5), []);
  const audit = auditDocument(doc);
  eq(audit.groups.map((g) => `${g.kind} ${JSON.stringify(g.value)} ×${g.layers.length} (${g.layers.slice(0, 3).map((l) => l.name).join(', ')})`), [], 'no one-off values');
  const rows = componentRows(doc);
  eq(rows.length, 15);
  const notReady = rows.flatMap(({ node }) => readiness(node).filter((c) => !c.ok).map((c) => `${node.name}: ${c.label} (${c.hint})`));
  eq(notReady, [], 'every component Ready');
  const report = useReport([{ name: 'Optics Components', doc }]).files[0];
  ok(report.tokenShare >= 0.99, `token share ${report.tokenShare}`);
});

test('optics: no accessibility errors in Optics Components or Foundations (Light and Dark)', async () => {
  const comps = open((await optics()).components());
  eq(errorsIn(comps), []);
  const found = open((await optics()).foundations());
  eq(errorsIn(found), []);
  eq(auditDocument(found).groups.map((g) => `${g.kind} ${JSON.stringify(g.value)} ×${g.layers.length} (${g.layers.slice(0, 3).map((l) => l.name).join(', ')})`), [], 'Foundations: no one-off values either');
  eq(found.pages.map((p) => p.name), ['Color', 'Typography', 'Spacing', 'Radius', 'Elevation', 'Motion', 'Icons']);
  let modesShown = 0;
  for (const pg of found.pages) walk(pg.children, (n) => void (n.modes && modesShown++));
  ok(modesShown >= 4, 'Light and Dark panels on Color and Elevation');
});
