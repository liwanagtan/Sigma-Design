// Sigma's own confirm and prompt (dialogs.js): they show wherever Sigma runs, unlike the browser's, which some
// embedded browsers answer with Cancel at once. (Not tested here: what they guard, like Empty Archive, which would
// erase this browser's archived files.)
import { test, eq, ok } from './harness.js';
import { ask, askText, answerWith, isAsking } from '../src/dialogs.js';

const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

test('dialogs: ask shows a dialog; OK is true, Cancel, Escape and a click outside are false', async () => {
  let p = ask('The file is erased from this browser.', { title: 'Delete forever?', ok: 'Delete forever', danger: true });
  ok(isAsking(), 'a dialog is open');
  const el = document.querySelector('.ask-modal');
  eq([el.querySelector('.modal-head').textContent, el.querySelector('.ask-message').textContent, el.querySelector('[data-ask-ok]').textContent], ['Delete forever?', 'The file is erased from this browser.', 'Delete forever']);
  ok(el.querySelector('[data-ask-ok]').classList.contains('destructive'), 'a destructive action looks it');
  el.querySelector('[data-ask-ok]').click();
  eq(await p, true);
  ok(!isAsking(), 'closed');
  p = ask('Sure?');
  document.querySelector('[data-ask-cancel]').click();
  eq(await p, false);
  p = ask('Sure?');
  key('Escape');
  eq(await p, false);
  p = ask('Sure?');
  key('Enter');
  eq(await p, true, 'Enter is OK');
  p = ask('Sure?');
  document.querySelector('.ask-backdrop').click();
  eq(await p, false, 'a click outside cancels');
});

test('dialogs: askText gives what was typed, or null; tests can answer for the person', async () => {
  let p = askText('Your name, shown on your comments:', { value: 'Ana' });
  const input = document.querySelector('.ask-input');
  eq(input.value, 'Ana');
  input.value = 'Ana Ruiz';
  key('Enter');
  eq(await p, 'Ana Ruiz');
  p = askText('Rename to:');
  key('Escape');
  eq(await p, null);
  answerWith((kind) => (kind === 'ask' ? true : 'typed'));
  try {
    eq([await ask('Sure?'), await askText('Name?')], [true, 'typed']);
    ok(!isAsking(), 'nothing shown');
  } finally {
    answerWith(null);
  }
});
