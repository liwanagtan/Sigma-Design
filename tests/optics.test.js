// Optics (Phase 36): the working design system in Welcome to Sigma passes Sigma's own checks.
import { test, eq, ok } from './harness.js';
import { state, loadDocument, walk } from '../src/store.js';
import { libraryEntry } from '../src/variables.js';
import { layOutDocument } from '../src/lay-out.js';
import { loadIconSet, ICON_SETS, usedIconIds, newIconsDocument } from '../src/icon-library.js';
import { sampleIconsDocument } from '../src/sample-icons.js';
import { opticsTokenDocument } from '../src/optics-tokens.js';
import { opticsComponentsDocument, opticsFoundationsDocument, opticsIconsDocument, OPTICS_ICONS } from '../src/optics.js';
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
  const sample = sampleIconsDocument(await loadIconSet(ICON_SETS.find((s) => s.id === 'lucide')));
  const icons = opticsIconsDocument(sample.icons, sample.source).icons;
  const published = { version: 1, collections: tokens.collections };
  const link = (doc) => {
    doc.libraries = [libraryEntry('optics-tokens', tokens.name, published)];
    const used = usedIconIds(doc.pages.flatMap((pg) => pg.children));
    doc.iconLibraries = [{ fileId: 'optics-icons', name: 'Optics Icons', version: 1, count: icons.length, icons: icons.filter((x) => used.has(x.id)) }];
    return doc;
  };
  built = {
    tokens, icons, sample,
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
  const { tokens, icons, sample } = await optics();
  eq(tokens.collections.map((c) => [c.name, c.modes.map((m) => m.name)]), [['Primitives', ['Value']], ['Semantic', ['Light', 'Dark']], ['Typography', ['Default']]]);
  const all = tokens.collections.flatMap((c) => c.variables);
  ok(all.length > 200, `${all.length} tokens`);
  ok(all.every((v) => v.codeSyntax.web.startsWith('--optics-')));
  ok(OPTICS_ICONS.every((id) => icons.some((x) => x.id === id)), 'every icon Optics uses is in Optics Icons');
  ok(icons.length === sample.icons.length && icons.every((x) => x.id.startsWith('optics-')), 'Optics Icons: every Sigma Icons icon, with Optics ids');
  ok(sample.icons.length > 1800, `Sigma Icons is the whole Lucide set (${sample.icons.length})`);
});

test('optics: Optics Components validate, use tokens for every value, and every component is Ready', async () => {
  const doc = open((await optics()).components());
  // Valid in the file format, with the token file it uses.
  const { tokens, icons } = await optics();
  const tokenDoc = newTokenDocument(tokens.name);
  tokenDoc.variables.collections = tokens.collections;
  const iconDoc = newIconsDocument('Optics Icons');
  iconDoc.icons = icons;
  const paths = { 'optics-tokens': '.sigma/tokens/optics.sigma.json', 'optics-icons': '.sigma/icons/optics.sigma.json' };
  const files = { [paths['optics-tokens']]: toProjectFile(tokenDoc).file, [paths['optics-icons']]: toProjectFile(iconDoc).file };
  const file = toProjectFile(doc, { pathOf: (id) => paths[id] || null }).file;
    const errors = validateFile(file, { path: '.sigma/design/optics-components.sigma.json', files }).filter((i) => i.level === 'error');
  eq(errors.map((e) => `${e.at}: ${e.message}`).slice(0, 5), []);
  const audit = auditDocument(doc);
  eq(audit.groups.map((g) => `${g.kind} ${JSON.stringify(g.value)} ×${g.layers.length} (${g.layers.slice(0, 3).map((l) => l.name).join(', ')})`), [], 'no one-off values');
  const rows = componentRows(doc);
  eq(rows.length, 15);
  const notReady = rows.flatMap(({ node }) => readiness(node).filter((c) => !c.ok).map((c) => `${node.name}: ${c.label} (${c.hint})`));
  eq(notReady, [], 'every component Ready');
  // Laid out, nothing on a page overlaps (layouts are placed when the file is built, not when it opens).
  const overlaps = [];
  for (const pg of doc.pages) {
    const boxes = pg.children.map((n) => ({ name: n.name, x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) overlaps.push(`${pg.name}: ${a.name} / ${b.name}`);
    }
  }
  eq(overlaps, [], 'nothing overlaps');
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
  // Every icon in both files is an Optics Icon (none from Sigma Icons).
  const iconIds = new Set();
  for (const d of [comps, found]) for (const pg of d.pages) walk(pg.children, (n) => {
    if (n.iconId) iconIds.add(n.iconId);
    for (const def of Object.values(n.props || {})) if (def.type === 'icon') iconIds.add(def.default);
  });
  ok(iconIds.size > 20 && [...iconIds].every((id) => id.startsWith('optics-')), [...iconIds].filter((id) => !id.startsWith('optics-')).join(', '));
  let modesShown = 0;
  for (const pg of found.pages) walk(pg.children, (n) => void (n.modes && modesShown++));
  ok(modesShown >= 4, 'Light and Dark panels on Color and Elevation');
});
