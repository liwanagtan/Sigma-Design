// A tiny in-browser test runner. Open /tests/ while serve.py is running.
const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

const show = (v) => JSON.stringify(v);

export function eq(actual, expected, msg = 'values differ') {
  if (show(actual) !== show(expected)) throw new Error(`${msg}: got ${show(actual)}, expected ${show(expected)}`);
}

export function near(actual, expected, eps = 1e-6, msg = 'numbers differ') {
  if (Math.abs(actual - expected) > eps) throw new Error(`${msg}: got ${actual}, expected ${expected}`);
}

export function ok(value, msg = 'expected a truthy value') {
  if (!value) throw new Error(msg);
}

export async function run(el) {
  let pass = 0;
  const failures = [];
  const rows = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      rows.push(`<li class="pass">✓ ${t.name}</li>`);
    } catch (err) {
      failures.push({ name: t.name, error: err.message });
      rows.push(`<li class="fail">✗ ${t.name}<pre>${err.stack || err.message}</pre></li>`);
    }
  }
  const total = tests.length;
  el.innerHTML = `<h1 class="${failures.length ? 'fail' : 'pass'}">${pass} / ${total} passed</h1><ul>${rows.join('')}</ul>`;
  document.title = `${failures.length ? '✗' : '✓'} ${pass}/${total} – Sigma tests`;
  window.__testResults = { pass, total, failures };
  return window.__testResults;
}
