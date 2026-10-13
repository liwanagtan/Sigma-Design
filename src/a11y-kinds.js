// The kinds of accessibility issue (Phase 16) and how a list of them reads in a pull request. Pure, so the
// command line (the pull request body) and the editor share them.

export const KINDS = {
  contrast: { label: 'Text contrast', reason: 'WCAG 1.4.3 (AA): text needs 4.5:1 against what’s behind it, large text (24px, or 18.66px bold) 3:1.' },
  target: { label: 'Tap targets', reason: 'WCAG 2.5.8 (AA) asks for at least 24×24; Apple asks for 44×44 and Material for 48×48.' },
  'text-size': { label: 'Small text', reason: 'Text this small is hard to read for many people, and doesn’t scale well.' },
  alt: { label: 'Images without alt text', reason: 'WCAG 1.1.1: images need a text alternative, or to be marked decorative so screen readers skip them.' },
  label: { label: 'Controls without a name', reason: 'WCAG 4.1.2: a control with no text (an icon-only button) needs an accessible label.' },
  heading: { label: 'Heading levels', reason: 'WCAG 1.3.1: heading levels go down one at a time (an h2 under an h1), so the outline makes sense.' },
  focus: { label: 'Focus order', reason: 'WCAG 2.4.3: each control has its own place in the focus order.' },
};

/** Issues as Markdown lines, for a design pull request. */
export function issuesMarkdown(issues, { max = 30 } = {}) {
  const groups = new Map();
  for (const i of issues) {
    const g = groups.get(i.group);
    if (g) g.count++;
    else groups.set(i.group, { ...i, count: 1 });
  }
  const list = [...groups.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const lines = list.slice(0, max).map((i) => `- ${i.severity === 'error' ? '❌' : '⚠️'} **${KINDS[i.kind].label}**: _${i.name}_ in ${i.frame}: ${i.message}${i.count > 1 ? ` (×${i.count})` : ''}`);
  if (list.length > max) lines.push(`- …and ${list.length - max} more`);
  return lines;
}

