// Sigma adapter for this project's icons: React components in src/icons/ (one file per icon, with MUI's
// SvgIcon, exported from src/icons/index.js). Written at setup by the agent; Sigma runs it on every import,
// write and check. Contract: skills/sigma-sync/reference/adapters.md in the sigma-design package.

const DIR = 'src/icons';
const INDEX = `${DIR}/index.js`;
const pascal = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const camelAttr = (a) => a.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const kebabAttr = (a) => a.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The icon files: the components listed in index.js.
function components(ctx) {
  return [...ctx.read(INDEX).matchAll(/export \{ default as (\w+) \} from '\.\/(\w+)\.jsx';/g)].map((m) => ({ name: m[1], path: `${DIR}/${m[2]}.jsx` }));
}

// <SvgIcon …> attributes and children as SVG.
function toSVG(jsx) {
  const open = /<SvgIcon\b([^>]*)>/.exec(jsx);
  const close = jsx.indexOf('</SvgIcon>');
  if (!open || close < 0) throw new Error('no <SvgIcon>…</SvgIcon>');
  const attrs = [...open[1].matchAll(/(\w+)=(?:"([^"]*)"|\{([^}]*)\})/g)]
    .map(([, k, s, e]) => `${kebabAttr(k)}="${s ?? e.trim()}"`).join(' ');
  const body = jsx.slice(open.index + open[0].length, close).trim()
    .replace(/(\w+)=\{([^}]*)\}/g, (_, k, v) => `${k}="${v.trim()}"`)
    .replace(/\b([a-z]+[A-Z]\w*)=/g, (_, k) => `${kebabAttr(k)}=`)
    .replace(/\s*\/>/g, '/>').replace(/>\s+</g, '><');
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
}

export function read(ctx) {
  return components(ctx).map((c) => ({ path: `${kebab(c.name)}.svg`, text: toSVG(ctx.read(c.path)) }));
}

// An icon's shapes as JSX children, one per line, written like the other components (" />").
function children(body, indent) {
  return (body.match(/<[^>]+\/>/g) || []).map((el) => `${indent}${el
    .replace(/\s*\/>$/, ' />')
    .replace(/\b([a-z]+(?:-[a-z]+)+)=/g, (_, k) => `${camelAttr(k)}=`)}`).join('\n');
}

function componentFile(icon) {
  const name = pascal(icon.name);
  const stroke = icon.style !== 'filled';
  const attrs = stroke
    ? `viewBox="${icon.viewBox}" fill="none" stroke="currentColor" strokeWidth={${icon.strokeWidth ?? 2}} strokeLinecap="round" strokeLinejoin="round"`
    : `viewBox="${icon.viewBox}"`;
  return `import { SvgIcon } from '@mui/material';

export default function ${name}(props) {
  return (
    <SvgIcon {...props} ${attrs}>
${children(icon.body, '      ')}
    </SvgIcon>
  );
}
`;
}

export function write(ctx, changes) {
  const files = [];
  let index = ctx.read(INDEX);
  for (const c of changes) {
    if (c.group) throw new Error(`${c.group}/${c.name}: this project's icons have no groups (a flat ${DIR}/)`);
    const name = pascal(c.name);
    const path = `${DIR}/${name}.jsx`;
    if (c.change === 'removed') {
      ctx.remove(path);
      index = index.replace(new RegExp(`export \\{ default as ${name} \\} from '\\./${name}\\.jsx';\\n`), '');
    } else if (c.change === 'added' || !ctx.exists(path)) {
      ctx.write(path, componentFile(c.icon));
      const lines = index.trimEnd().split('\n');
      lines.push(`export { default as ${name} } from './${name}.jsx';`);
      index = `${lines.sort().join('\n')}\n`;
    } else {
      // Only the shapes (and the viewBox or stroke width, if they changed); the rest of the file stays.
      let text = ctx.read(path);
      const open = /<SvgIcon\b[^>]*>\n/.exec(text);
      const close = text.indexOf('    </SvgIcon>');
      text = text.slice(0, open.index + open[0].length) + children(c.icon.body, '      ') + '\n' + text.slice(close);
      text = text.replace(/viewBox="[^"]*"/, `viewBox="${c.icon.viewBox}"`);
      if (c.icon.strokeWidth !== undefined) text = text.replace(/strokeWidth=\{[^}]*\}/, `strokeWidth={${c.icon.strokeWidth}}`);
      ctx.write(path, text);
    }
    files.push(path);
  }
  if (index !== ctx.read(INDEX)) {
    ctx.write(INDEX, index);
    files.push(INDEX);
  }
  return { files };
}
