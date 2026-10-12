// sigma.config.json: what the sync skill decided about a project, so later runs follow it instead of
// deciding again (docs/schema/README.md). Written by the skill on its first run, edited by people after.
//
//   { schema: 1,
//     stack: { styling: ['css-variables'], framework: 'react' },
//     tokens: [{ sigma: '.sigma/tokens/core.sigma.json',
//                sources: [{ path: 'src/styles/tokens.css', format: 'css-variables' }],
//                naming: 'kebab', modes: { Light: ':root', Dark: '[data-theme="dark"]' }, map: { tokenName: codeName } }],
//     icons: [{ sigma: '.sigma/icons/app.sigma.json', source: 'src/assets/icons', output: 'svg' }],
//     components: [{ sigma: '.sigma/design/library.sigma.json', source: 'src/components',
//                    manifest: '.sigma/captures/manifest.json', styles: ['src/styles/app.css'] }],
//     workflow: { git: 'github', tracker: 'notion', branch: 'design/{ticket}-{slug}', base: 'main',
//                 prTemplate: '.github/pull_request_template.md', labels: ['design'], reviewers: [] } }

export const CONFIG_SCHEMA = 1;
export const TOKEN_FORMATS = ['css-variables', 'scss-variables', 'less-variables', 'tailwind-config', 'tailwind-theme', 'js-theme', 'ts-theme', 'dtcg', 'json', 'other'];
export const ICON_OUTPUTS = ['svg', 'react', 'vue', 'svelte', 'sprite', 'other'];
export const NAMINGS = ['kebab', 'camel', 'snake', 'path', 'as-is'];

export function validateConfig(config, { files = [] } = {}) {
  const issues = [];
  const error = (at, message) => issues.push({ at, level: 'error', message });
  const warn = (at, message) => issues.push({ at, level: 'warning', message });
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    error('', 'should be a JSON object');
    return issues;
  }
  if (config.schema !== CONFIG_SCHEMA) error('schema', `should be ${CONFIG_SCHEMA}`);
  const known = new Set(['$schema', 'schema', 'stack', 'tokens', 'icons', 'components', 'pages', 'workflow', 'notes']);
  for (const k of Object.keys(config)) if (!known.has(k)) warn(k, 'isn’t a setting Sigma knows');
  const sigmaFile = (at, p, kindDir) => {
    if (typeof p !== 'string' || !p.endsWith('.sigma.json')) return error(at, 'should be the path of a .sigma.json file');
    if (!p.startsWith(`.sigma/${kindDir}/`)) warn(at, `Sigma keeps these in .sigma/${kindDir}/`);
    if (files.length && !files.includes(p)) error(at, `${p} isn’t in the project`);
  };
  const list = (key, check) => {
    if (config[key] === undefined) return;
    if (!Array.isArray(config[key])) return error(key, 'should be a list');
    config[key].forEach((entry, i) => check(entry || {}, `${key}[${i}]`));
  };
  list('tokens', (t, at) => {
    sigmaFile(`${at}.sigma`, t.sigma, 'tokens');
    if (!Array.isArray(t.sources) || !t.sources.length) error(`${at}.sources`, 'should list where the tokens live in code: [{ "path": "src/styles/tokens.css", "format": "css-variables" }]');
    (t.sources || []).forEach((s, j) => {
      if (typeof s?.path !== 'string') error(`${at}.sources[${j}].path`, 'is missing');
      if (!TOKEN_FORMATS.includes(s?.format)) error(`${at}.sources[${j}].format`, `should be one of ${TOKEN_FORMATS.join(', ')}`);
    });
    if (t.naming !== undefined && !NAMINGS.includes(t.naming)) error(`${at}.naming`, `should be one of ${NAMINGS.join(', ')}`);
    if (t.modes !== undefined && (typeof t.modes !== 'object' || Array.isArray(t.modes))) error(`${at}.modes`, 'should map mode names to where they apply in code, like { "Dark": "[data-theme=\\"dark\\"]" }');
  });
  list('icons', (t, at) => {
    sigmaFile(`${at}.sigma`, t.sigma, 'icons');
    if (typeof t.source !== 'string') error(`${at}.source`, 'should be the folder (or package) the icons come from');
    if (t.output !== undefined && !ICON_OUTPUTS.includes(t.output)) error(`${at}.output`, `should be one of ${ICON_OUTPUTS.join(', ')}`);
  });
  list('components', (t, at) => {
    sigmaFile(`${at}.sigma`, t.sigma, 'design');
    if (typeof t.source !== 'string') error(`${at}.source`, 'should be the folder the components are in');
    if (t.manifest !== undefined && typeof t.manifest !== 'string') error(`${at}.manifest`, 'should be the path of the captures’ manifest.json');
    if (t.styles !== undefined && (!Array.isArray(t.styles) || t.styles.some((x) => typeof x !== 'string'))) error(`${at}.styles`, 'should list the CSS files the components’ styles are in');
  });
  list('pages', (t, at) => {
    sigmaFile(`${at}.sigma`, t.sigma, 'design');
  });
  const w = config.workflow;
  if (w !== undefined) {
    if (typeof w !== 'object') error('workflow', 'should be an object');
    else {
      if (w.git !== undefined && !['github'].includes(w.git)) warn('workflow.git', 'Sigma works with GitHub so far');
      if (w.tracker !== undefined && !['notion', 'github', 'none'].includes(w.tracker)) warn('workflow.tracker', 'Sigma works with Notion and GitHub Issues so far');
      if (w.branch !== undefined && (typeof w.branch !== 'string' || !w.branch.includes('{slug}'))) warn('workflow.branch', 'should include {slug} (and usually {ticket}), like "design/{ticket}-{slug}"');
      if (w.labels !== undefined && !Array.isArray(w.labels)) error('workflow.labels', 'should be a list');
      if (w.reviewers !== undefined && !Array.isArray(w.reviewers)) error('workflow.reviewers', 'should be a list');
    }
  }
  return issues;
}

// A project's config, with defaults for what isn't set.
export function withDefaults(config = {}) {
  return {
    schema: CONFIG_SCHEMA, tokens: [], icons: [], components: [], pages: [], ...config,
    workflow: { git: 'github', tracker: 'none', branch: 'design/{slug}', base: 'main', labels: ['design'], ...(config.workflow || {}) },
  };
}
