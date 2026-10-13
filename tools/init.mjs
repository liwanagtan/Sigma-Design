// sigma-design init (Part F, Phase 32): set Sigma up in an existing project. It finds what the project has,
// records it in sigma.config.json, and imports what Sigma reads by itself (CSS variables, DTCG tokens.json,
// SVG icon folders). Other stacks (Tailwind, a JS theme, SCSS, icon components) are reported for the agent,
// which finishes setup (skills/sigma-sync). It never overwrites what's there: running it again only adds
// what's missing.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, basename, sep, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseCSSVariables } from '../src/token-sync.js';
import { validateConfig, CONFIG_SCHEMA } from '../src/project-config.js';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.svelte-kit', '.sigma', 'vendor', 'tmp', '.turbo', '.cache']);
const MAX_FILES = 20000;
const toPosix = (p) => p.split(sep).join('/');

// Every file in the project worth looking at (relative paths), skipping dependencies and build output.
export function projectFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 10 || out.length > MAX_FILES) return;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith('.') && e.name !== '.storybook') continue;
      if (SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.isFile()) out.push(toPosix(relative(root, full)));
    }
  };
  walk(root, 0);
  return out;
}

const read = (root, p) => {
  try {
    return readFileSync(join(root, p), 'utf8');
  } catch {
    return '';
  }
};
const title = (s) => {
  const t = String(s || 'project').replace(/^@[^/]+\//, '').replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const slug = (s) => String(s || 'project').replace(/^@[^/]+\//, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';

// A mode's name from its selector: [data-theme="dark"] → Dark, .theme-brand → Brand, @media (… dark) → Dark.
function modeName(selector) {
  if (/dark/i.test(selector)) return 'Dark';
  if (/light/i.test(selector)) return 'Light';
  const m = /data-[\w-]+=["']?([\w-]+)/.exec(selector) || /\.(?:theme-)?([\w-]+)\s*$/.exec(selector);
  return m ? title(m[1]) : selector;
}
const isRoot = (sel) => /^(:root|html)(\s*,\s*(:root|html))*$/.test(sel.trim());

// CSS files that define design tokens: custom properties on :root (or html), and their modes: other
// selectors (or media queries) that override some of them.
function cssTokenFiles(root, files) {
  const found = [];
  for (const path of files.filter((f) => f.endsWith('.css'))) {
    const text = read(root, path);
    if (!text.includes('--')) continue;
    const decls = parseCSSVariables(text);
    const base = decls.filter((d) => isRoot(d.selector));
    if (base.length < 5) continue;
    const names = new Set(base.map((d) => d.name));
    const bySelector = new Map();
    for (const d of decls) {
      if (isRoot(d.selector) || !names.has(d.name)) continue;
      bySelector.set(d.selector, (bySelector.get(d.selector) || 0) + 1);
    }
    if (decls.some((d) => /@theme/.test(d.selector))) continue; // Tailwind's @theme: for the agent
    const modes = [...bySelector].filter(([, n]) => n >= 2).map(([sel]) => sel);
    found.push({ path, count: base.length, rootSelector: base[0].selector, modes });
  }
  return found.sort((a, b) => b.count - a.count);
}

// Folders of SVG icons: the topmost folder named icons (or svg, svgs) holding at least 3 SVGs.
function svgIconFolders(root, files) {
  const counts = new Map();
  for (const f of files.filter((x) => x.toLowerCase().endsWith('.svg'))) {
    const parts = f.split('/');
    const i = parts.findIndex((p) => /^(icons?|svgs?)$/i.test(p));
    if (i < 0 || i === parts.length - 1) continue;
    const dir = parts.slice(0, i + 1).join('/');
    counts.set(dir, (counts.get(dir) || 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= 3).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count);
}

/** What the project has: name, package.json, framework, styling, token and icon sources, git. */
export function detectProject(root) {
  const files = projectFiles(root);
  let pkg = null;
  if (existsSync(join(root, 'package.json'))) {
    try {
      pkg = JSON.parse(read(root, 'package.json'));
    } catch {
      pkg = { invalid: true };
    }
  }
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const has = (d) => d in deps;
  const framework = has('next') ? 'next' : has('nuxt') ? 'nuxt' : has('@sveltejs/kit') ? 'sveltekit' : has('react') ? 'react'
    : has('vue') ? 'vue' : has('svelte') ? 'svelte' : has('@angular/core') ? 'angular' : has('solid-js') ? 'solid' : 'none';

  const css = cssTokenFiles(root, files);
  const dtcg = files.filter((f) => /(^|\/)([\w.-]*\.)?tokens\.json$/i.test(f) && read(root, f).includes('"$value"'));
  // Stacks the agent handles (Phase 33 writes an adapter for them).
  const other = [];
  for (const f of files) {
    const b = basename(f);
    if (/^tailwind\.config\.(js|cjs|mjs|ts)$/.test(b)) other.push({ format: 'tailwind-config', path: f });
    else if (f.endsWith('.css') && /@theme\s*\{/.test(read(root, f))) other.push({ format: 'tailwind-theme', path: f });
    else if (/\.(scss|sass)$/.test(f) && (read(root, f).match(/^\s*\$[\w-]+\s*:/gm) || []).length >= 5) other.push({ format: 'scss-variables', path: f });
    else if (f.endsWith('.less') && (read(root, f).match(/^\s*@[\w-]+\s*:/gm) || []).length >= 5) other.push({ format: 'less-variables', path: f });
    else if (/\.(js|ts|jsx|tsx|mjs)$/.test(f) && /(theme|tokens)/i.test(b) && /\b(createTheme|extendTheme|createStitches|createGlobalTheme|defineConfig)\s*\(|export\s+(const|default)\s+\w*[Tt]heme/.test(read(root, f))) {
      other.push({ format: /\.tsx?$/.test(f) ? 'ts-theme' : 'js-theme', path: f });
    }
  }
  const svg = svgIconFolders(root, files);
  const iconComponents = [];
  if (!svg.length) {
    const byDir = new Map();
    for (const f of files.filter((x) => /\.(jsx|tsx|vue|svelte)$/.test(x) && /(^|\/)icons?\//i.test(x))) {
      const dir = f.slice(0, f.search(/icons?\//i)) + f.match(/icons?\//i)[0].slice(0, -1);
      byDir.set(dir, (byDir.get(dir) || 0) + 1);
    }
    for (const [path, count] of byDir) if (count >= 3) iconComponents.push({ path, count, output: { '.jsx': 'react', '.tsx': 'react', '.vue': 'vue', '.svelte': 'svelte' }[extname(files.find((f) => f.startsWith(path)))] || 'other' });
  }
  const styling = [];
  if (css.length) styling.push('css-variables');
  if (has('tailwindcss') || other.some((o) => o.format.startsWith('tailwind'))) styling.push('tailwind');
  if (has('sass') || other.some((o) => o.format === 'scss-variables')) styling.push('scss');
  if (has('styled-components') || has('@emotion/react')) styling.push('css-in-js');
  if (has('@mui/material')) styling.push('mui');
  if (!styling.length) styling.push('css');

  let git = null;
  try {
    const run = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    run('rev-parse', '--is-inside-work-tree');
    let remote = '';
    try {
      remote = run('remote', 'get-url', 'origin');
    } catch {}
    let base = '';
    try {
      base = run('symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, '');
    } catch {}
    if (!base) {
      try {
        const branches = run('branch', '--format=%(refname:short)').split('\n');
        base = branches.includes('main') ? 'main' : branches.includes('master') ? 'master' : 'main';
      } catch {
        base = 'main';
      }
    }
    git = { github: /github\.com/.test(remote), base };
  } catch {}

  return {
    name: pkg?.name || basename(root), pkg, framework, styling,
    tokens: { css, dtcg, other }, icons: { svg, components: iconComponents }, git,
  };
}

/**
 * What init would do, without doing it: { config (null if there's one already), packageJson (new text or
 * null), found: [lines], forAgent: [lines] }.
 */
export function planInit(root, detected, { version = '0.1.0' } = {}) {
  const found = [];
  const forAgent = [];
  const name = slug(detected.name);
  const label = title(detected.name);
  let config = null;
  if (!existsSync(join(root, 'sigma.config.json'))) {
    config = { schema: CONFIG_SCHEMA, stack: { styling: detected.styling, framework: detected.framework }, tokens: [], icons: [] };
    const css = detected.tokens.css[0];
    if (css) {
      const modes = { [css.modes.some((m) => /dark/i.test(m)) ? 'Light' : 'Default']: css.rootSelector };
      for (const sel of css.modes) {
        let n = modeName(sel);
        for (let i = 2; modes[n]; i++) n = `${modeName(sel)} ${i}`;
        modes[n] = sel;
      }
      config.tokens.push({ sigma: `.sigma/tokens/${name}.sigma.json`, name: `${label} tokens`, sources: [{ path: css.path, format: 'css-variables' }], naming: 'kebab', modes });
      found.push(`tokens: ${css.path} (${css.count} CSS variables${css.modes.length ? `; modes: ${Object.keys(modes).join(', ')}` : ''})`);
      for (const more of detected.tokens.css.slice(1)) found.push(`  also CSS variables in ${more.path} (${more.count}): add it to sources in sigma.config.json if it holds design tokens`);
    } else if (detected.tokens.dtcg.length) {
      const p = detected.tokens.dtcg[0];
      config.tokens.push({ sigma: `.sigma/tokens/${name}.sigma.json`, name: `${label} tokens`, sources: [{ path: p, format: 'dtcg' }], naming: 'kebab' });
      found.push(`tokens: ${p} (DTCG tokens.json)`);
    }
    if (!config.tokens.length) {
      const o = detected.tokens.other[0];
      if (o) {
        forAgent.push(`Tokens are in ${o.path} (${o.format}): Sigma doesn't read that by itself. Ask your coding agent to finish setup with the sigma-sync skill.`);
        found.push(`tokens: ${o.path} (${o.format}, for the agent)`);
      } else {
        found.push('tokens: none found (CSS variables on :root, a tokens.json, a theme)');
        forAgent.push('No design tokens found. If the project has them somewhere Sigma doesn’t look, ask your coding agent to set them up with the sigma-sync skill; or create a Sigma Tokens file in Sigma.');
      }
    } else if (detected.tokens.other.length) {
      for (const o of detected.tokens.other) found.push(`  also ${o.format} in ${o.path}: if it holds design tokens too, ask your coding agent to add it`);
    }
    const svg = detected.icons.svg[0];
    if (svg) {
      config.icons.push({ sigma: `.sigma/icons/${name}-icons.sigma.json`, name: `${label} icons`, source: svg.path, output: 'svg' });
      found.push(`icons: ${svg.path} (${svg.count} SVG files)`);
    } else if (detected.icons.components.length) {
      const c = detected.icons.components[0];
      found.push(`icons: ${c.path} (${c.count} ${c.output} components, for the agent)`);
      forAgent.push(`Icons are ${c.output} components in ${c.path}: ask your coding agent to set them up with the sigma-sync skill (reference/icons.md).`);
    } else found.push('icons: none found (a folder named icons with SVG files)');
    if (!config.icons.length) delete config.icons;
    if (!config.tokens.length) delete config.tokens;
    if (detected.git) {
      config.workflow = { git: 'github', tracker: 'none', branch: 'design/{slug}', base: detected.git.base, labels: ['design'] };
      if (!detected.git.github) found.push('git: no GitHub remote yet (proposals become pull requests through GitHub)');
    }
    const issues = validateConfig(config).filter((i) => i.level === 'error');
    if (issues.length) throw new Error(`the config init made isn't valid: ${issues.map((i) => `${i.at} ${i.message}`).join('; ')}`);
  }

  // package.json: the dev dependency and the `npm run sigma` script.
  let packageJson = null;
  let addedDependency = false;
  const notes = [];
  if (detected.pkg && !detected.pkg.invalid) {
    const text = read(root, 'package.json');
    const pkg = JSON.parse(text);
    let changed = false;
    if (!pkg.dependencies?.['sigma-design'] && !pkg.devDependencies?.['sigma-design']) {
      pkg.devDependencies = { ...(pkg.devDependencies || {}), 'sigma-design': `^${version}` };
      changed = true;
      addedDependency = true;
      notes.push(`package.json: added sigma-design ^${version} to devDependencies (run your package manager's install)`);
    }
    if (!pkg.scripts?.sigma) {
      pkg.scripts = { ...(pkg.scripts || {}), sigma: 'sigma-design dev' };
      changed = true;
      notes.push('package.json: added the script "sigma": "sigma-design dev"');
    } else if (!/sigma-design/.test(pkg.scripts.sigma)) {
      notes.push(`package.json already has a "sigma" script (${pkg.scripts.sigma}): start Sigma with npx sigma-design dev`);
    }
    if (changed) {
      const indent = (/^([ \t]+)"/m.exec(text) || [, '  '])[1];
      packageJson = `${JSON.stringify(pkg, null, indent)}${text.endsWith('\n') ? '\n' : ''}`;
    }
  } else if (!detected.pkg) {
    notes.push('No package.json: start Sigma with npx sigma-design dev');
  }
  return { config, packageJson, addedDependency, found, forAgent, notes };
}

/** Do it: write what planInit planned. Returns the plan. */
export function runInit(root, options = {}) {
  const detected = detectProject(root);
  const plan = planInit(root, detected, options);
  if (options.dryRun) return { ...plan, detected };
  mkdirSync(join(root, '.sigma'), { recursive: true });
  if (plan.config) writeFileSync(join(root, 'sigma.config.json'), `${JSON.stringify(plan.config, null, 2)}\n`);
  if (plan.packageJson) writeFileSync(join(root, 'package.json'), plan.packageJson);
  return { ...plan, detected };
}

export const isSetUp = (root) => existsSync(join(root, 'sigma.config.json')) || (existsSync(join(root, '.sigma')) && statSync(join(root, '.sigma')).isDirectory());
