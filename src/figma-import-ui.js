import { modal } from './libraries.js';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function showFigmaImportReport(report) {
  if(!report) return;
  const {counts,warnings}=report;
  modal('Figma import report', `<p><b>${esc(report.name)}</b> · ${counts.pages} page${counts.pages===1?'':'s'} · ${counts.layers} source layers</p>`+
    '<p class="muted">Imported as a Sigma design file. You can edit its layers and save your changes.</p>'+
    (warnings.length ? '<p>Review these imported features:</p><ul>'+warnings.map(w=>`<li>${esc(w.message)}${w.count>1?` (${w.count})`:''}</li>`).join('')+'</ul>' : '<p>All layers use supported Sigma properties.</p>'));
}
