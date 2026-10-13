// Sigma's capture bridge (Part F, Phase 35): load it on the project's components page (import 'sigma-design/bridge',
// or a <script type="module"> pointing at this file). Sigma opens that page in a frame and asks, by message, for
// the captures its manifest lists; the bridge answers with them. Messages work across origins, so the page can
// be served by the app's own dev server (Vite, Next…), built with the project's own tooling.
//
//   → { type: 'sigma:capture-all', id, manifest }                    ← { type: 'sigma:captures', id, captures }
//   → { type: 'sigma:capture-page', id, route, width, manifest, name } ← { type: 'sigma:capture', id, capture }
//   ← { type: 'sigma:bridge-ready' } when the page has rendered
//
// Only Sigma running on this machine (localhost) gets answers.
import { sigmaCaptureAll, sigmaCapturePage } from './capture.js';

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

if (typeof window !== 'undefined' && window.parent !== window) {
  window.addEventListener('message', async (e) => {
    if (!LOCAL.test(e.origin) || !e.data || typeof e.data !== 'object') return;
    const { type, id } = e.data;
    const reply = (msg) => e.source.postMessage({ id, ...msg }, e.origin);
    try {
      if (type === 'sigma:capture-all') {
        await document.fonts?.ready;
        reply({ type: 'sigma:captures', captures: sigmaCaptureAll(e.data.manifest) });
      } else if (type === 'sigma:capture-page') {
        const capture = await sigmaCapturePage(e.data.route, { width: e.data.width, match: e.data.manifest, name: e.data.name });
        reply({ type: 'sigma:capture', capture });
      }
    } catch (err) {
      reply({ type: 'sigma:error', error: String(err.message || err) });
    }
  });
  // Tell Sigma the page is ready once it has rendered (frameworks render after load).
  const ready = () => setTimeout(() => window.parent.postMessage({ type: 'sigma:bridge-ready' }, '*'), 50);
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
}
