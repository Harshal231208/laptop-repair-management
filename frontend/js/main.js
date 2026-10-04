const API_URL = 'https://laptop-repair-management-production.up.railway.app/api';

window.escapeHtml = function (value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
};

window.formatDate = function (value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
};

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
});

// Lightweight frontend validation helpers. Backend validation is still required for security.
window.validateField = function (input, message) {
  if (!input) return true;
  const field = input.closest('.field');
  let error = field && field.querySelector('.validation-error');
  if (!error && field) {
    error = document.createElement('small');
    error.className = 'validation-error';
    field.appendChild(error);
  }
  const invalid = !input.checkValidity();
  input.classList.toggle('invalid', invalid);
  input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  if (error) {
    error.textContent = invalid ? (message || input.validationMessage) : '';
    error.hidden = !invalid;
  }
  return !invalid;
};

window.validateForm = function (form) {
  if (!form) return false;
  let valid = true;
  form.querySelectorAll('input, textarea, select').forEach(input => {
    if (input.disabled) return;
    if (!window.validateField(input)) valid = false;
  });
  if (!valid) {
    const first = form.querySelector('.invalid');
    if (first) first.focus();
  }
  return valid;
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('blur', () => window.validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('invalid')) window.validateField(input);
    });
  });
});
