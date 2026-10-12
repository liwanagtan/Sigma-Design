// Button({ label, variant: 'primary' | 'danger', icon: 'arrows/arrow-right' }): icon is a path in src/assets/icons
export function Button({ label, variant = 'primary', icon = null }) {
  const el = document.createElement('button');
  el.className = `button${variant === 'danger' ? ' button--danger' : ''}`;
  if (icon) el.append(Object.assign(document.createElement('img'), { src: `/src/assets/icons/${icon}.svg`, alt: '', width: 16, height: 16 }));
  el.append(label);
  return el;
}
