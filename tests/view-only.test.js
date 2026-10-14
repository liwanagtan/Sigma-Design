// Welcome to Sigma's files are view-only (state.viewOnly): a change is put back, and says why.
import { test, eq, ok } from './harness.js';
import { state, commit, createNode } from '../src/store.js';
import { useDoc } from './core.test.js';

test('view-only: a change to a Welcome to Sigma file is put back, with a message saying why', () => {
  const r = createNode('rect', { name: 'Box', w: 100, h: 100 });
  useDoc([r]);
  const toasts = [];
  const onToast = (e) => toasts.push(e.detail);
  window.addEventListener('sigma:toast', onToast);
  state.viewOnly = true;
  try {
    state.doc.pages[0].children[0].w = 300;
    state.doc.pages[0].children.push(createNode('rect', { name: 'New' }));
    commit();
    eq([state.doc.pages[0].children.length, state.doc.pages[0].children[0].w], [1, 100], 'put back');
    ok(toasts.some((t) => /for looking at/.test(t) && /editable copy/.test(t)), toasts.join(' | '));
  } finally {
    state.viewOnly = false;
    window.removeEventListener('sigma:toast', onToast);
  }
  state.doc.pages[0].children[0].w = 300;
  commit();
  eq(state.doc.pages[0].children[0].w, 300, 'other files change as usual');
});
