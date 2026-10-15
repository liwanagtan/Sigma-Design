import { test, ok } from './harness.js';
test('terminal dock: keyboard isolation, safe rendering, file reuse, project isolation and restart', async () => {
  const frame = document.createElement('iframe'); frame.src = './fixtures/terminal.html';
  frame.style.cssText = 'position:fixed;width:900px;height:700px;left:-10000px;top:0';
  try {
    const loaded = new Promise((resolve,reject) => { frame.onload = resolve; frame.onerror = reject; });
    document.body.append(frame); await loaded;
    ok((await frame.contentWindow.runTerminalChecks()).passed);
  } finally { frame.remove(); }
});
