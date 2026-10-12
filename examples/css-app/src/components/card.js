import { Button } from './button.js';

// Card({ title, body, action }): action is a Button's props (or null for none)
export function Card({ title, body, action = null }) {
  const el = document.createElement('section');
  el.className = 'card';
  const h = Object.assign(document.createElement('h2'), { className: 'card__title', textContent: title });
  const p = Object.assign(document.createElement('p'), { className: 'card__body', textContent: body });
  el.append(h, p);
  if (action) el.append(Button(action));
  return el;
}
