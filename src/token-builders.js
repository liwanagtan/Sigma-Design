// Shared construction helpers for app and example design-system tokens.
import {uid} from './store.js';

export const ref = (id) => ({ alias: id });
export const modes = (...values) => ({ perMode: values }); // a different value in each mode, in order

export function collection(name, modeNames) {
  const ms = modeNames.map((n) => ({ id: uid(), name: n }));
  return { id: uid(), name, modes: ms, defaultModeId: ms[0].id, variables: [], groups: [] };
}

export function group(col, name, parentId = null, description = '') {
  const g = { id: uid(), name, parentId };
  if (description) g.description = description;
  col.groups.push(g);
  return g.id;
}

export function token(col, groupId, name, type, value, description = '') {
  const v = { id: uid(), name, type, valuesByMode: {} };
  if (groupId) v.groupId = groupId;
  if (description) v.description = description;
  col.modes.forEach((m, i) => {
    const x = value?.perMode ? value.perMode[i] ?? value.perMode[0] : value;
    v.valuesByMode[m.id] = structuredClone(x);
  });
  col.variables.push(v);
  return v.id;
}

