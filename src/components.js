// Components and instances (roadmap Phases 3–5).
import { state } from './store.js';

// Normalize step: rebuild every instance's children from its main component, then apply
// property values and overrides. Implemented in Phase 3.
export function syncInstances() {
  if (!state.doc) return;
}
