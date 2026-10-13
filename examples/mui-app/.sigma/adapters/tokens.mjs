// Sigma adapter for this project's design tokens: the MUI themes in src/theme.js (written at setup by the
// agent; Sigma runs it on every import, write and check). Contract: skills/sigma-sync/reference/adapters.md
// in the sigma-design package.
//
// Mapping (also in sigma.config.json's notes):
//   shared.spacing, shape.borderRadius, typography.* → Primitives (one mode)
//   lightTheme / darkTheme palette.*                  → Semantic, modes Light and Dark
// Code names are theme paths (palette.primary.main), so a token finds its place in the file.

const FILE = 'src/theme.js';
const BLOCKS = { Default: 'const shared = {', Light: 'export const lightTheme = createTheme({', Dark: 'export const darkTheme = createTheme({' };
const PALETTE = ['primary.main', 'primary.dark', 'primary.contrastText', 'error.main', 'background.default', 'background.paper', 'text.primary', 'text.secondary'];
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const token = (type, value, code) => ({ $type: type, $value: value, $extensions: { 'app.sigma': { codeSyntax: { web: code } } } });
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

// The themes, by running the file without MUI (createTheme is the identity here: only the values matter).
function themes(source) {
  const body = source
    .replace(/^import .*$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/createTheme\(/g, '(');
  return new Function(`${body}\nreturn { shared, lightTheme, darkTheme };`)();
}

const typography = (t) => ({
  fontFamily: '{font.family}',
  fontSize: String(t.fontSize),
  fontWeight: t.fontWeight,
  lineHeight: t.lineHeight, // a ratio: Sigma reads it as a percentage
});

export function read(ctx) {
  const { shared, lightTheme, darkTheme } = themes(ctx.read(FILE));
  const semantic = (theme) => {
    const set = {};
    for (const path of PALETTE) {
      const [group, key] = path.split('.');
      (set[group] ||= {})[kebab(key)] = token('color', get(theme.palette, path), `palette.${path}`);
    }
    return set;
  };
  return {
    Primitives: {
      space: { unit: token('number', shared.spacing, 'spacing') },
      radius: { default: token('number', shared.shape.borderRadius, 'shape.borderRadius') },
      font: {
        family: token('fontFamily', shared.typography.fontFamily, 'typography.fontFamily'),
        size: { base: token('number', shared.typography.fontSize, 'typography.fontSize') },
      },
      typography: {
        h1: token('typography', typography(shared.typography.h1), 'typography.h1'),
        body1: token('typography', typography(shared.typography.body1), 'typography.body1'),
      },
    },
    'Semantic/Light': semantic(lightTheme),
    'Semantic/Dark': semantic(darkTheme),
  };
}

// ---------- writing: one value at a time, in place ----------

// The range of the value of `key` in the object literal that opens at `open` (its "{"): [start, end).
function valueRange(text, open, key) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i = text.indexOf(c, i + 1);
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      if (--depth === 0) break;
    } else if (depth === 1) {
      const m = new RegExp(`^${key}\\s*:\\s*`).exec(text.slice(i));
      if (m && /[\s{,]/.test(text[i - 1])) {
        const start = i + m[0].length;
        let d = 0, j = start;
        for (; j < text.length; j++) {
          const ch = text[j];
          if (ch === '"' || ch === "'" || ch === '`') {
            j = text.indexOf(ch, j + 1);
            continue;
          }
          if (ch === '{' || ch === '[' || ch === '(') d++;
          else if (ch === '}' || ch === ']' || ch === ')') {
            if (d === 0) break;
            d--;
          } else if (ch === ',' && d === 0) break;
        }
        let end = j;
        while (/\s/.test(text[end - 1])) end--;
        return [start, end];
      }
    }
  }
  return null;
}

function locate(text, mode, path) {
  const at = text.indexOf(BLOCKS[mode]);
  if (at < 0) throw new Error(`no ${BLOCKS[mode]} in ${FILE}`);
  let open = text.indexOf('{', at + BLOCKS[mode].length - 1);
  let range = null;
  for (const key of path.split('.')) {
    range = valueRange(text, open, key);
    if (!range) throw new Error(`${path} isn’t in the ${mode === 'Default' ? 'shared' : mode.toLowerCase()} theme in ${FILE}`);
    open = range[0];
  }
  return range;
}

// A JS string literal like the one it replaces (same quotes).
const quoted = (old, value) => {
  const q = /^['"`]/.test(old) ? old[0] : "'";
  return `${q}${String(value).replaceAll('\\', '\\\\').replaceAll(q, `\\${q}`)}${q}`;
};
const unquote = (s) => s.replace(/^['"`]|['"`]$/g, '');
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function literal(ctx, type, old, value) {
  if (value && typeof value === 'object' && 'alias' in value) {
    throw new Error(`${FILE} holds values, not references: give the token a value in Sigma, or change the theme by hand`);
  }
  if (type === 'color') {
    const like = ctx.sigma.parseColorValue(unquote(old)) || { format: 'hex' };
    return quoted(old, ctx.sigma.formatColor(value, like));
  }
  if (type === 'number') return String(value);
  return quoted(old, value);
}

export function write(ctx, changes) {
  let text = ctx.read(FILE);
  for (const c of changes) {
    if (c.change !== 'changed') throw new Error(`${c.name} was ${c.change} in Sigma: this adapter only changes values. Add or remove ${c.code} in ${FILE} by hand, then import`);
    if (c.codeBefore) throw new Error(`${c.name}'s code name changed (${c.codeBefore} → ${c.code}): rename it in ${FILE} by hand`);
    for (const [mode, { after }] of Object.entries(c.modes)) {
      if (c.type === 'typography') {
        // Field by field: fontSize in the file's unit (rem), lineHeight as a ratio.
        for (const [field, v] of Object.entries(after)) {
          if (field === 'fontFamily' || field === 'letterSpacing') continue;
          const [s, e] = locate(text, mode, `${c.code}.${field}`);
          const old = text.slice(s, e);
          let next = old;
          if (field === 'fontSize') next = /rem/.test(old) ? quoted(old, `${round(v / 16)}rem`) : /px/.test(old) ? quoted(old, `${v}px`) : String(v);
          else if (field === 'lineHeight') next = String(round(v / 100, 3));
          else next = String(v);
          const same = field === 'lineHeight' ? Number(old) === Number(next) : field === 'fontSize' && /rem/.test(old) ? parseFloat(unquote(old)) * 16 === v : old === next;
          if (!same) text = text.slice(0, s) + next + text.slice(e);
        }
        continue;
      }
      const [s, e] = locate(text, mode, c.code);
      text = text.slice(0, s) + literal(ctx, c.type, text.slice(s, e), after) + text.slice(e);
    }
  }
  ctx.write(FILE, text);
  return { files: [FILE] };
}
