// The project in the editor: menu items, and a status in each file screen's header ("Saved to project" or
// "Not saved to project · ⌘S"). In a project file, Publish is hidden: saving to the project is publishing.
import { state, subscribe } from './store.js';
import { project, onProjectChange, saveToProject, projectStatus } from './project.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function projectMenuItems() {
  if (!project.connected) return [];
  const inIt = !!state.doc?.project?.path;
  return [{ label: inIt ? 'Save to project' : `Add to project “${project.name}”`, shortcut: '⌘S', action: () => saveToProject() }, '-'];
}

let timer = null;
let seq = 0;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(update, 400);
}

async function update() {
  const mine = ++seq;
  const status = state.doc ? await projectStatus() : null;
  if (mine !== seq) return; // a newer update is on its way
  const inProjectFile = !!state.doc?.project?.path;
  for (const el of document.querySelectorAll('[data-project-status]')) {
    el.hidden = !status;
    if (!status) continue;
    const { path, unsaved, connected } = status;
    el.className = `project-status${unsaved ? ' unsaved' : ''}${connected ? '' : ' offline'}`;
    el.title = `${path} in ${project.name || 'the project'}${connected ? (unsaved ? ': changes not saved to the project. ⌘S saves them.' : ': saved') : ': the project isn’t connected'}`;
    el.innerHTML = `<span class="dot"></span>${!connected ? 'Project offline' : unsaved ? 'Save to project' : 'In project'}`;
  }
  // Publishing is for files kept in the browser; in a project, git does the versioning.
  for (const el of document.querySelectorAll('[data-publish], [data-publish-status]')) el.hidden = inProjectFile;
}

// A status chip; clicking it saves.
export function projectStatusChip() {
  return '<button class="project-status" data-project-status hidden></button>';
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-project-status]')) saveToProject();
});
subscribe((kind) => kind === 'doc' && schedule());
onProjectChange(schedule);
window.addEventListener('sigma:project-saved', schedule);
export { esc };
