// Shells are workspace resources. Only dock layout preferences are persisted, never shell input/output.
import { Terminal } from './vendor/terminal/xterm.mjs';
import { FitAddon } from './vendor/terminal/addon-fit.mjs';
let context = null, connection = null, dock, content, status, tabs, title, active = null, sequence = 0, refreshing = null;
const sessions = new Map(), bindings = new Map();
const preference = (key, fallback) => { try { return localStorage.getItem('sigma.terminal.' + key) ?? fallback; } catch { return fallback; } };
const savePreference = (key, value) => { try { localStorage.setItem('sigma.terminal.' + key, value); } catch {} };
let visible = preference('visible', 'false') === 'true';
let height = Number(preference('height', '240')) || 240;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const scope = () => context?.projectId || 'drafts';
const bound = () => !!context && !!connection?.workspace && (context.projectId === connection.workspace.id || bindings.get(scope()) === connection.workspace.id);
const message = text => { if (status) status.textContent = text; };
async function request(path, method = 'GET', body) {
  const r = await fetch('/api/terminal/' + path, { method, headers: { 'X-Sigma': '1', 'Content-Type': 'application/json', Authorization: `Bearer ${connection?.capability || ''}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const value = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(value.error || 'Start or restart Sigma’s local project server to use Terminal.');
  return value;
}
function fit() {
  // A hidden/minimized working area must not resize a running shell down to a single row.
  if (active && visible && bound() && innerHeight >= 320 && content.clientHeight >= 60 && content.clientWidth >= 160 && !active.element.hidden) {
    try { active.fit.fit(); } catch {}
  }
}
function layout() {
  const show = visible && !!context;
  dock.hidden = !show;
  const displayedHeight = Math.max(160, Math.min(height, Math.max(160, innerHeight - 160)));
  dock.style.height = displayedHeight + 'px';
  document.documentElement.style.setProperty('--terminal-height', show ? displayedHeight + 'px' : '0px');
  document.body.classList.toggle('terminal-open', show);
  for (const button of document.querySelectorAll('[data-rail="terminal"]')) button.setAttribute('aria-pressed', String(show));
  dock.querySelector('.terminal-resizer').setAttribute('aria-valuenow', String(Math.round(displayedHeight)));
  dock.querySelector('.terminal-resizer').setAttribute('aria-valuemax', String(Math.max(160, innerHeight - 160)));
  fit();
}
function theme() {
  const css = getComputedStyle(document.documentElement), dark = document.documentElement.dataset.theme === 'dark';
  for (const s of sessions.values()) s.term.options.theme = {
    background: css.getPropertyValue('--panel').trim(), foreground: css.getPropertyValue('--text').trim(), cursor: css.getPropertyValue('--text').trim(), selectionBackground: '#88888866',
    black: dark ? '#555555' : '#444444', red: dark ? '#ff8080' : '#b32130', green: dark ? '#80d99b' : '#207437', yellow: dark ? '#e8ca78' : '#85600a', blue: dark ? '#81b8ff' : '#2267ba', magenta: dark ? '#d9a1f9' : '#8844aa', cyan: dark ? '#78d5df' : '#006e7c', white: dark ? '#dddddd' : '#777777',
  };
}
function controls() {
  dock.querySelector('[data-terminal-new]').disabled = !bound() || !connection.supported || !!refreshing;
  for (const action of ['clear', 'copy', 'end']) dock.querySelector(`[data-terminal-${action}]`).disabled = !active || !bound();
}
function init() {
  if (dock) return;
  dock = document.createElement('section'); dock.id = 'terminal-dock'; dock.hidden = true; dock.setAttribute('aria-label', 'Terminal');
  dock.innerHTML = `<div class="terminal-resizer" role="separator" aria-label="Resize terminal" aria-orientation="horizontal" aria-valuemin="160" tabindex="0"></div><header><strong>Terminal</strong><span data-terminal-context></span><button data-terminal-new>New terminal</button><button data-terminal-clear>Clear</button><button data-terminal-copy>Copy</button><button data-terminal-end title="Terminate this shell and its running jobs">End session</button><button data-terminal-reconnect>Reconnect</button><button data-terminal-hide aria-label="Hide terminal">Hide</button></header><div class="terminal-tabs" role="tablist" aria-label="Terminal sessions"></div><div class="terminal-content"></div><div class="terminal-status" role="status" aria-live="polite"></div>`;
  document.body.append(dock);
  content = dock.querySelector('.terminal-content'); status = dock.querySelector('.terminal-status'); tabs = dock.querySelector('.terminal-tabs'); title = dock.querySelector('[data-terminal-context]');
  // xterm receives input first; editor's document/window handlers must never receive it.
  for (const name of ['keydown', 'keyup', 'keypress', 'paste', 'copy', 'cut', 'wheel', 'pointerdown']) dock.addEventListener(name, e => e.stopPropagation());
  dock.querySelector('[data-terminal-hide]').onclick = () => {
    visible = false; savePreference('visible', 'false'); layout();
    document.querySelector(context?.kind === 'tokens' ? '#tokens [data-rail="terminal"]' : '#rail [data-rail="terminal"]')?.focus();
  };
  dock.querySelector('[data-terminal-reconnect]').onclick = () => refresh().catch(e => message(e.message));
  dock.querySelector('[data-terminal-new]').onclick = async () => {
    if (!bound()) return;
    const workspaceId = connection.workspace.id;
    dock.querySelector('[data-terminal-new]').disabled = true;
    try {
      const info = await request('sessions', 'POST', { workspaceId });
      if (connection.workspace?.id !== workspaceId) return;
      active = add(info); render(); if (bound() && visible) active.term.focus();
    } catch (e) { message(e.message); } finally { controls(); }
  };
  dock.querySelector('[data-terminal-clear]').onclick = () => active?.term.clear();
  dock.querySelector('[data-terminal-copy]').onclick = () => {
    if (active?.term.hasSelection()) navigator.clipboard.writeText(active.term.getSelection()).catch(e => message(e.message));
    else message('Select terminal text to copy.');
  };
  dock.querySelector('[data-terminal-end]').onclick = async () => {
    if (!active || !bound()) return;
    const s = active;
    try { await request('end', 'POST', { id: s.id, workspaceId: s.workspaceId }); remove(s); render(); }
    catch (e) { message(e.message); }
  };
  const handle = dock.querySelector('.terminal-resizer');
  handle.onpointerdown = e => { e.preventDefault(); handle.setPointerCapture(e.pointerId); };
  handle.onpointermove = e => { if (handle.hasPointerCapture(e.pointerId)) { height = innerHeight - e.clientY; layout(); } };
  handle.onpointerup = e => { handle.releasePointerCapture(e.pointerId); savePreference('height', String(height)); };
  handle.onkeydown = e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); height += e.key === 'ArrowUp' ? 20 : -20; layout(); savePreference('height', String(height)); } };
  new ResizeObserver(fit).observe(content);
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', layout);
}
function remove(s) {
  s.ended = true; clearTimeout(s.retry); s.ws?.close(); s.term.dispose(); s.element.remove(); sessions.delete(s.id);
  if (active === s) active = null;
}
function sessionStatus(s) {
  if (s.exited) return `Shell exited (${s.exitCode ?? 0}). Choose New terminal to start another shell.`;
  return s.connected ? `${s.foreground && s.foreground !== s.shell ? 'Running: ' + s.foreground : 'Shell ready'} · Commands use your local user permissions.` : 'Disconnected · Input is disabled until this session reconnects.';
}
function select(s, focus = false) {
  active = s;
  for (const item of sessions.values()) item.element.hidden = item !== s;
  for (const button of tabs.children) { const selected = button.dataset.id === s.id; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; }
  fit(); controls(); message(sessionStatus(s));
  if (focus && visible && bound()) s.term.focus();
}
function render() {
  layout(); controls();
  if (!context) return;
  title.textContent = bound() ? `${connection.workspace.name} · ${context.name}` : context.name;
  title.title = bound() ? connection.workspace.path : '';
  tabs.replaceChildren();
  for (const item of sessions.values()) item.element.hidden = true;
  content.querySelector('.terminal-guidance')?.remove();
  if (!bound()) {
    active = null; controls();
    const el = document.createElement('div'); el.className = 'terminal-guidance';
    el.innerHTML = `<strong>Connect local workspace</strong><p>Terminal commands run in a local folder, separate from this file.</p>${connection?.workspace ? `<p>${esc(connection.workspace.path)}</p><button data-attach>Connect this workspace</button>` : '<p>Start Sigma from an initialized workspace:</p><code>npx sigma-design dev /path/to/workspace</code><p>Open the address printed by Sigma. For a new workspace, run <code>npx sigma-design init</code> first.</p>'}`;
    content.append(el);
    el.querySelector('[data-attach]')?.addEventListener('click', () => { bindings.set(scope(), connection.workspace.id); refresh().catch(e => message(e.message)); });
    message('No workspace attached.'); return;
  }
  for (const s of sessions.values()) {
    const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.dataset.id = s.id; b.textContent = `${s.shell} ${s.number}${s.exited ? ' · exited' : ''}`;
    b.onclick = () => select(s, true);
    b.onkeydown = e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); const list = [...sessions.values()], i = list.indexOf(s);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowLeft' ? -1 : 1) + list.length) % list.length;
      select(list[next]); tabs.children[next]?.focus();
    };
    tabs.append(b);
  }
  if (active && sessions.has(active.id)) select(active);
  else if (sessions.size) select(sessions.values().next().value);
  else message(connection.supported ? 'Ready. Choose New terminal to start a shell.' : 'Terminal currently supports macOS and Linux. This server platform is not supported.');
}
function send(s, value) { if (s.ws?.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify(value)); }
function attach(s) {
  if (s.ended || s.ws?.readyState === WebSocket.OPEN || s.ws?.readyState === WebSocket.CONNECTING) return;
  const identity = connection;
  const ws = s.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/terminal/socket`);
  ws.onopen = () => send(s, { type: 'attach', id: s.id, capability: identity.capability, instance: identity.instance, workspaceId: s.workspaceId });
  ws.onmessage = ({ data }) => {
    if (s.ended || s.ws !== ws) return;
    const m = JSON.parse(data);
    const ack = () => { if (m.bytes && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ack', bytes: m.bytes })); };
    if (m.type === 'attached') {
      s.connected = true; s.retryCount = 0; s.foreground = m.foreground; s.exited = m.exited; s.exitCode = m.exitCode;
      s.term.reset(); s.term.write(m.output, ack);
      if (s === active && bound()) { fit(); message(sessionStatus(s)); }
      send(s, { type: 'resize', cols: s.term.cols, rows: s.term.rows });
    }
    if (m.type === 'output') s.term.write(m.data, ack);
    if (m.type === 'status') { s.foreground = m.foreground; if (s === active && bound()) message(sessionStatus(s)); }
    if (m.type === 'exit') { s.exited = true; s.exitCode = m.exitCode; render(); }
  };
  ws.onclose = e => {
    s.connected = false;
    if (s.ended || s.ws !== ws) return;
    if (e.code === 1013) { if (s === active && bound()) message('Output exceeded the browser limit. Choose Reconnect to view recent output.'); return; }
    if (s === active && bound()) message('Disconnected. Reconnecting…');
    if (e.code === 1000) { remove(s); render(); message('Session ended. Choose New terminal to start another shell.'); return; }
    clearTimeout(s.retry);
    // Re-authenticate to detect a server restart; never resend input or create a shell automatically.
    s.retry = setTimeout(() => refresh().catch(() => {
      if (s === active && bound()) message('Local server unavailable. Start it again, then choose Reconnect.');
    }), Math.min(10000, 1000 * 2 ** Math.min(s.retryCount++ || 0, 4)));
  };
}
function add(info) {
  if (sessions.has(info.id)) { const s = sessions.get(info.id); s.exited = info.exited; s.exitCode = info.exitCode; attach(s); return s; }
  const element = document.createElement('div'); element.className = 'terminal-emulator'; content.append(element);
  const term = new Terminal({ fontSize: 12, fontFamily: 'monospace', scrollback: 2000, screenReaderMode: true, allowProposedApi: false });
  const fitAddon = new FitAddon(); term.loadAddon(fitAddon); term.open(element);
  // Shell escape sequences cannot write/read the clipboard or create clickable links.
  term.parser.registerOscHandler(52, () => true); term.parser.registerOscHandler(8, () => true);
  const s = { ...info, number: ++sequence, term, fit: fitAddon, element, connected: false, retryCount: 0 }; sessions.set(s.id, s);
  term.onData(data => {
    if (!s.connected || s.exited || s.ended || !bound() || active !== s) return;
    // Large pastes stay under the transport limit; chunks retain order and are never queued offline.
    for (const chunk of data.match(/[\s\S]{1,1024}/gu) || []) send(s, { type: 'input', data: chunk });
  });
  term.onResize(({ cols, rows }) => { if (s.connected) send(s, { type: 'resize', cols: Math.min(500, cols), rows: Math.min(200, rows) }); });
  term.attachCustomKeyEventHandler(e => {
    if (e.key === 'Tab' && e.shiftKey) return false; // keyboard path out of the terminal
    if ((e.metaKey || e.ctrlKey && e.shiftKey) && e.key.toLowerCase() === 'c' && term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()).catch(() => {}); return false; }
    return true;
  });
  theme(); attach(s); return s;
}
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const next = await request('connect', 'POST');
    const restarted = connection && next.instance !== connection.instance;
    if (restarted) { for (const s of [...sessions.values()]) remove(s); if (next.workspace?.id !== connection.workspace?.id) bindings.clear(); }
    connection = next;
    if (bound()) {
      const { sessions: list } = await request('sessions');
      for (const s of [...sessions.values()]) if (!list.some(info => info.id === s.id)) remove(s);
      for (const info of list) add(info);
    }
    render();
    if (restarted && context) message('Server restarted. Previous shells ended; choose New terminal to start again.');
  })();
  controls();
  try { await refreshing; } finally { refreshing = null; controls(); }
}
export function toggleTerminal() {
  init(); visible = !visible; savePreference('visible', String(visible)); layout();
  if (visible) refresh().catch(e => { render(); message('Local terminal unavailable: ' + e.message); });
}
export function setTerminalContext(meta = null) {
  init(); context = meta && meta.kind !== 'icons' ? meta : null;
  render(); if (context && visible) refresh().catch(e => message('Local terminal unavailable: ' + e.message));
}
