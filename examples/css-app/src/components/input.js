// Input({ placeholder, value, type })
export function Input({ placeholder = '', value = '', type = 'text' } = {}) {
  return Object.assign(document.createElement('input'), { className: 'input', type, placeholder, value });
}
