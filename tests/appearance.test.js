import { test, eq, ok } from './harness.js';
import { appearance, appearancePreference, resolveAppearance, setAppearance, APPEARANCE_KEY, appearanceButtonHTML } from '../src/appearance.js';
import { state } from '../src/store.js';
import { useDoc } from './core.test.js';

test('appearance: Light/Dark saves the preference and never changes the design document', () => {
  const original = localStorage.getItem(APPEARANCE_KEY), previous = appearancePreference();
  const doc = useDoc([]);
  doc.pages[0].background = '#FFEEDD';
  doc.pages[0].modes = { own:'own-dark' };
  const before = JSON.stringify(state.doc);
  try {
    ok(setAppearance('dark'));
    eq(appearance(), 'dark');
    eq(localStorage.getItem(APPEARANCE_KEY), 'dark');
    ok(appearanceButtonHTML().includes('Appearance: Dark'));
    eq(JSON.stringify(state.doc), before, 'document modes and colors stay unchanged');
    ok(setAppearance('light'));
    eq(appearance(), 'light');
    eq(localStorage.getItem(APPEARANCE_KEY), 'light');
    eq(resolveAppearance('auto', true), 'dark');
    eq(resolveAppearance('auto', false), 'light');
    ok(setAppearance('auto'));
    eq(appearancePreference(), 'auto');
    eq(appearance(), window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    eq(localStorage.getItem(APPEARANCE_KEY), 'auto');
    ok(!appearanceButtonHTML().includes('<span'), 'icon only');
    setAppearance('light');
    eq(setAppearance('invalid'), false);
    eq(appearance(), 'light');
    eq(JSON.stringify(state.doc), before);
    window.dispatchEvent(new StorageEvent('storage', { key:APPEARANCE_KEY, newValue:'dark' }));
    eq(appearance(), 'dark', 'another tab updates the appearance');
  } finally {
    if (original===null) localStorage.removeItem(APPEARANCE_KEY); else localStorage.setItem(APPEARANCE_KEY, original);
    setAppearance(previous, { persist:false });
  }
});

test('appearance menu: toggle, selection and outside presses close without reopening', () => {
  const original = appearancePreference();
  const host = document.createElement('div');
  host.innerHTML = appearanceButtonHTML() + '<input aria-label="Outside field">';
  document.body.appendChild(host);
  const button = host.querySelector('button'), input = host.querySelector('input');
  input.addEventListener('pointerdown', e => e.stopPropagation());
  try {
    button.click();
    eq(button.getAttribute('aria-expanded'), 'true');
    button.click();
    eq(document.querySelector('.menu'), null);
    button.click();
    input.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    eq(document.querySelector('.menu'), null, 'outside press closes even when bubbling is stopped');
    input.click();
    eq(document.querySelector('.menu'), null, 'outside click never opens appearance');
    button.click();
    document.querySelector('.menu-item[data-i="1"]').click();
    eq(document.querySelector('.menu'), null);
    eq(appearancePreference(), 'light');
  } finally { host.remove(); setAppearance(original); }
});


test('Welcome appearance follows the app across pages, preserving specimen overrides and brands', async () => {
  const { applyWelcomeAppearance } = await import('../src/welcome-appearance.js');
  const { sigmaTokenDocument, sigmaComponentsDocument } = await import('../src/sigma-design-system.js');
  const tokens = sigmaTokenDocument();
  const doc = sigmaComponentsDocument(tokens.collections);
  const reference = doc.pages[0].children.find(n => n.name.includes('Dark reference'));
  const overrides = JSON.stringify(reference.modes);
  const brand = {id:'brand',extends:tokens.collections[0].id,modes:[{id:'brand-dark',name:'Dark'}]};
  ok(applyWelcomeAppearance(doc, [...tokens.collections, brand], 'dark'));
  for (const page of doc.pages) {
    for (const collection of tokens.collections) eq(page.modes[collection.id], collection.modes.find(m => m.name === 'Dark').id);
    eq(page.modes.brand, undefined, 'system appearance does not enable a brand');
  }
  eq(JSON.stringify(reference.modes), overrides, 'explicit reference modes stay intact');
  eq(applyWelcomeAppearance(doc, tokens.collections, 'dark'), false);
  ok(applyWelcomeAppearance(doc, tokens.collections, 'light'));
  for (const page of doc.pages) for (const collection of tokens.collections) eq(page.modes[collection.id], collection.modes.find(m => m.name === 'Light').id);
});
