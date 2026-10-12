// Button({ label, variant: 'primary' | 'danger', icon: 'arrows/arrow-right', disabled }): icon is a path in src/assets/icons
export function Button({ label, variant = 'primary', icon = null, disabled = false }) {
  const el = document.createElement('button');
  el.className = `button${variant === 'danger' ? ' button--danger' : ''}`;
  el.disabled = disabled;
  if (icon) el.append(Object.assign(document.createElement('img'), { src: new URL(`../assets/icons/${icon}.svg`, import.meta.url).href, alt: '', width: 16, height: 16 }));
  el.append(label);
  return el;
}
