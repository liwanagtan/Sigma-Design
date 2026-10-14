// Small, escaped token renderer for read-only code snippets; copied code stays plain text.
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function highlightCode(source) {
  const text=String(source);
  const pattern=/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--[\w-]+|#[\da-fA-F]{3,8}\b|@[\w-]+|\b[\w-]+(?=\s*:)|\b[\w-]+(?=\s*=)|\b[A-Z][\w.]*(?=[\s/>])|\b[\w-]+(?=\()|\b\d*\.?\d+(?:px|rem|em|%|ms|s|deg)?|\b[\w-]+\b|[{}:;=<>()[\],/]/g;
  let html='',last=0;
  for(const match of text.matchAll(pattern)) {
    const token=match[0],rest=text.slice(match.index+token.length);
    const kind=token.startsWith('/*')?'comment':/^['"]/.test(token)?'string':token.startsWith('--')?'variable':token.startsWith('#')?'color':token.startsWith('@')?'keyword':/^\s*:/.test(rest)?'property':/^\s*=/.test(rest)?'attribute':/^[A-Z]/.test(token)?'element':/^\s*\(/.test(rest)?'function':/^\d|^\./.test(token)?'number':/^[\w-]+$/.test(token)?'value':'punctuation';
    html+=esc(text.slice(last,match.index))+`<span class="syntax-${kind}">${esc(token)}</span>`;last=match.index+token.length;
  }
  return html+esc(text.slice(last));
}
export const codeBlock=source=>`<pre class="inspect-code"><code>${highlightCode(source)}</code></pre>`;
