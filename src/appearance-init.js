// Restore the preference and resolve Auto before CSS paints.
(() => {
  let preference = 'auto';
  try {
    const saved = localStorage.getItem('sigma.appearance');
    if (['auto','light','dark'].includes(saved)) preference = saved;
  } catch {}
  document.documentElement.dataset.appearance = preference;
  document.documentElement.dataset.theme = preference === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
})();
