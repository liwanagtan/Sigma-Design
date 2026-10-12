// CSS rules as text (Part E, Phase 30): finding a rule by its selector and editing one declaration at a time,
// keeping everything else in the file as it was. Pure, no DOM. Rules inside @media and other at-rules are
// listed with their condition, so a top-level rule is never confused with a breakpoint's.

const norm = (sel) => String(sel).replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();

// [{ selector, at, start, end, open, close, decls: [{ prop, value, start, end, declStart, declEnd }] }]:
// offsets into `text` (open/close: the braces; value start/end: the value's text, without `;`).
export function parseRules(text) {
  const rules = [];
  const at = [];
  let i = 0, head = 0;
  const skipComment = () => {
    if (text.startsWith('/*', i)) {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? text.length : e + 2;
      return true;
    }
    return false;
  };
  while (i < text.length) {
    if (skipComment()) continue;
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const e = text.indexOf(ch, i + 1);
      i = e < 0 ? text.length : e + 1;
      continue;
    }
    if (ch === ';' && !at.length) {
      head = i + 1; // @import …;
      i++;
      continue;
    }
    if (ch === ';') {
      head = i + 1;
      i++;
      continue;
    }
    if (ch === '{') {
      const prelude = text.slice(head, i).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (prelude.startsWith('@')) {
        at.push(prelude);
        i++;
        head = i;
        continue;
      }
      const close = blockEnd(text, i);
      rules.push({ selector: norm(prelude), at: at.join(' '), start: head + (text.slice(head, i).length - text.slice(head, i).trimStart().length), end: close + 1, open: i, close, decls: declarations(text, i + 1, close) });
      i = close + 1;
      head = i;
      continue;
    }
    if (ch === '}') {
      at.pop();
      i++;
      head = i;
      continue;
    }
    i++;
  }
  return rules;
}

function blockEnd(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text.startsWith('/*', i)) {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? text.length : e + 1;
      continue;
    }
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return i;
  }
  return text.length - 1;
}

function declarations(text, from, to) {
  const out = [];
  let i = from, start = from, depth = 0;
  const flush = (end) => {
    const raw = text.slice(start, end);
    const colon = raw.indexOf(':');
    if (colon > 0 && !raw.trim().startsWith('/*')) {
      const prop = raw.slice(0, colon).trim().toLowerCase();
      const vRaw = raw.slice(colon + 1);
      const lead = vRaw.length - vRaw.trimStart().length;
      const value = vRaw.trim();
      const vStart = start + colon + 1 + lead;
      out.push({ prop, value, start: vStart, end: vStart + value.length, declStart: start + (raw.length - raw.trimStart().length), declEnd: end });
    }
  };
  for (; i < to; i++) {
    if (text.startsWith('/*', i)) {
      const e = text.indexOf('*/', i + 2);
      if (text.slice(start, i).trim() === '') start = e + 2;
      i = e < 0 ? to : e + 1;
      continue;
    }
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (text[i] === ';' && depth === 0) {
      flush(i);
      start = i + 1;
    }
  }
  if (text.slice(start, to).trim()) flush(to);
  return out;
}

// The top-level rule written with exactly this selector (not inside @media), or null.
export function findRule(rules, selector) {
  const want = norm(selector);
  return rules.find((r) => !r.at && r.selector === want) || null;
}

/**
 * Apply edits to CSS text: [{ selector, prop, value, after?: selector }] sets `prop` to `value` in the rule
 * with that selector (replacing the value where it's written, else adding a declaration at the end of the
 * rule); a missing rule is added after the rule `after` names (else after the last rule starting with the
 * same class), written like the file's other rules. value null removes the declaration.
 * Returns { text, applied: [{ selector, prop, before, after, added? }] }.
 */
export function editRules(text, edits) {
  let out = text;
  const applied = [];
  for (const e of edits) {
    const rules = parseRules(out);
    const rule = findRule(rules, e.selector);
    const indent = indentOf(out, rules);
    if (rule) {
      const d = [...rule.decls].reverse().find((x) => x.prop === e.prop);
      if (d && e.value === null) {
        const lineStart = out.lastIndexOf('\n', d.declStart) + 1;
        const lineEnd = out.indexOf('\n', d.declEnd);
        out = out.slice(0, lineStart) + out.slice(lineEnd + 1);
        applied.push({ selector: e.selector, prop: e.prop, before: d.value, after: null });
      } else if (d) {
        if (d.value === e.value) continue;
        out = out.slice(0, d.start) + e.value + out.slice(d.end);
        applied.push({ selector: e.selector, prop: e.prop, before: d.value, after: e.value });
      } else if (e.value !== null) {
        // At the end of the rule, after its last declaration.
        const last = rule.decls[rule.decls.length - 1];
        const semiAt = last ? out.indexOf(';', last.end) : -1;
        const hasSemi = semiAt >= 0 && semiAt < rule.close;
        const at = !last ? rule.open + 1 : hasSemi ? semiAt + 1 : last.end;
        const semi = last && !hasSemi ? ';' : '';
        out = `${out.slice(0, at)}${semi}\n${indent}${e.prop}: ${e.value};${out.slice(at)}`;
        applied.push({ selector: e.selector, prop: e.prop, before: null, after: e.value });
      }
      continue;
    }
    if (e.value === null) continue;
    const anchor = (e.after && findRule(rules, e.after)) || lastRelated(rules, e.selector);
    const block = `${e.selector} {\n${indent}${e.prop}: ${e.value};\n}`;
    if (anchor) out = `${out.slice(0, anchor.end)}\n\n${block}${out.slice(anchor.end)}`;
    else out = `${out.replace(/\s*$/, '')}\n\n${block}\n`;
    applied.push({ selector: e.selector, prop: e.prop, before: null, after: e.value, added: true });
  }
  return { text: out, applied };
}

function indentOf(text, rules) {
  for (const r of rules) {
    const d = r.decls[0];
    if (!d) continue;
    const lineStart = text.lastIndexOf('\n', d.declStart) + 1;
    const ws = text.slice(lineStart, d.declStart);
    if (/^[ \t]+$/.test(ws)) return ws;
  }
  return '  ';
}
// The last top-level rule for the same block (".button--secondary" → the last ".button…" rule).
function lastRelated(rules, selector) {
  const base = /^[.#]?[\w-]+?(?=--|__|:|\.|\[|$)/.exec(norm(selector))?.[0];
  if (!base) return null;
  const related = rules.filter((r) => !r.at && r.selector.split(',').some((s) => s.trim().startsWith(base)));
  return related[related.length - 1] || null;
}
