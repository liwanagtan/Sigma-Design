// Sigma's own "Are you sure?" and "Name it" dialogs, in place of the browser's confirm() and prompt(). Those
// don't show everywhere Sigma runs: in some embedded browsers (the Claude desktop app's browser pane, for one)
// they return Cancel at once, so anything that asked first (Empty Archive, Delete page…) silently did nothing.
//
//   if (!(await ask('Delete page “Home”?', { ok: 'Delete page', danger: true }))) return;
//   const name = await askText('Your name, shown on your comments:', { value: '' }); // null when cancelled
//
// Enter is OK, Escape (or a click outside) is Cancel. Tests answer for the person with answerWith().

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let answer = null; // tests: (kind, message, options) => the answer

/** Answer every dialog with fn(kind: 'ask' | 'text', message, options) instead of asking; null asks again. */
export function answerWith(fn) {
  answer = fn;
}

function open(kind, message, { title, ok = 'OK', cancel = 'Cancel', danger = false, value = '', placeholder = '' }) {
  if (answer) return Promise.resolve(answer(kind, message, { title, ok, danger, value }));
  return new Promise((resolve) => {
    const before = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop ask-backdrop';
    wrap.innerHTML = `<div class="modal ask-modal" role="alertdialog" aria-modal="true" aria-labelledby="ask-title" aria-describedby="ask-message">` +
      `<div class="modal-head" id="ask-title">${esc(title || (kind === 'text' ? 'Name' : 'Are you sure?'))}</div>` +
      `<div class="ask-body"><div class="ask-message" id="ask-message">${esc(message)}</div>` +
      (kind === 'text' ? `<input class="prop-input ask-input" value="${esc(value)}" placeholder="${esc(placeholder)}" spellcheck="false">` : '') + '</div>' +
      `<div class="lib-footer"><button class="btn" data-ask-cancel>${esc(cancel)}</button>` +
      `<button class="btn primary${danger ? ' destructive' : ''}" data-ask-ok>${esc(ok)}</button></div></div>`;
    const input = wrap.querySelector('.ask-input');
    const done = (ok) => {
      wrap.remove();
      window.removeEventListener('keydown', onKey, true);
      before?.focus?.();
      resolve(kind === 'text' ? (ok ? input.value : null) : ok);
    };
    const cancelBtn = wrap.querySelector('[data-ask-cancel]');
    const onKey = (e) => {
      if (e.key === 'Tab') return; // moves between the field and buttons
      e.stopImmediatePropagation(); // the editor's shortcuts don't see keys meant for the dialog (typing still types)
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.isComposing)) {
        e.preventDefault();
        done(e.key === 'Enter' && document.activeElement !== cancelBtn);
      }
    };
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation()); // menus and popovers stay as they are
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-ask-cancel]')) done(false);
      else if (e.target.closest('[data-ask-ok]')) done(true);
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    if (input) {
      input.focus();
      input.select();
    } else wrap.querySelector('[data-ask-ok]').focus();
  });
}

/** Whether an ask or askText dialog is open (other windows leave its keys to it). */
export const isAsking = () => !!document.querySelector('.ask-backdrop');

/** Ask before doing something: resolves true for OK, false for Cancel. */
export const ask = (message, options = {}) => open('ask', message, options);

/** Ask for some text: resolves to it (as typed), or null when cancelled. */
export const askText = (message, options = {}) => open('text', message, options);
