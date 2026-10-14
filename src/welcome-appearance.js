// Welcome playgrounds follow the app theme at page level. Explicit specimen and
// brand overrides still demonstrate inheritance; regular saved files stay independent.
export function applyWelcomeAppearance(doc, collections, theme) {
  const name = theme === 'dark' ? 'dark' : 'light';
  let changed = false;
  for (const page of doc.pages || []) {
    for (const collection of collections) {
      if (collection.extends) continue; // Appearance must not apply a brand extension.
      const mode = collection.modes.find(mode => mode.name.toLowerCase() === name);
      if (!mode) continue;
      if (page.modes?.[collection.id] === mode.id) continue;
      (page.modes ||= {})[collection.id] = mode.id;
      changed = true;
    }
  }
  return changed;
}
