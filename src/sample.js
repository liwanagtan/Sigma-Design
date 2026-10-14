import { uid } from './store.js';

// A new, empty design file. ("Welcome to Sigma", the guide file, is built in welcome.js.)
export function blankDocument() {
  const page = { id: uid(), name: 'Page 1', background: '#F5F5F5', children: [] };
  return { name: 'Untitled', pages: [page], currentPageId: page.id };
}
