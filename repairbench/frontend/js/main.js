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

// Frontend validation helpers.
// These rules are intentionally explicit instead of relying only on HTML pattern/checkValidity,
// so validation behaves consistently across browsers.
const validationRules = {
  name: {
    required: true,
    test: v => v.length >= 2 && v.length <= 100,
    message: 'Enter your full name (2–100 characters).'
  },
  email: {
    required: true,
    test: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254,
    message: 'Enter a valid email address.'
  },
  phone: {
    required: false,
    test: v => v === '' || /^[0-9+()\-\s]{10,20}$/.test(v),
    message: 'Enter a valid phone number (10–20 characters).'
  },
  customerPhone: {
    required: true,
    test: v => /^[0-9+()\-\s]{10,20}$/.test(v),
    message: 'Enter a valid phone number (10–20 characters).'
  },
  customerName: {
    required: true,
    test: v => v.length >= 2 && v.length <= 100,
    message: 'Name must be between 2 and 100 characters.'
  },
  deviceModel: {
    required: true,
    test: v => v.length >= 2 && v.length <= 100,
    message: 'Device model must be between 2 and 100 characters.'
  },
  issueDescription: {
    required: true,
    test: v => v.length >= 10 && v.length <= 1000,
    message: 'Describe the issue using at least 10 characters.'
  },
  password: {
    required: true,
    test: v => v.length >= 8 && v.length <= 128 && /[A-Za-z]/.test(v) && /\d/.test(v),
    message: 'Password must be 8–128 characters and contain a letter and a number.'
  },
  username: {
    required: true,
    test: v => v.length > 0 && v.length <= 100,
    message: 'Username is required.'
  }
};

function getValidationRule(input) {
  if (!input) return null;
  if (validationRules[input.id]) return validationRules[input.id];
  if (input.required) return {
    required: true,
    test: v => v.length > 0,
    message: 'This field is required.'
  };
  return null;
}

window.validateField = function (input) {
  if (!input || input.disabled || input.type === 'hidden') return true;

  const value = String(input.value ?? '').trim();
  const rule = getValidationRule(input);
  let valid = true;
  let message = '';

  if (rule) {
    if (rule.required && value === '') {
      valid = false;
      message = 'This field is required.';
    } else if (value !== '' && !rule.test(value)) {
      valid = false;
      message = rule.message;
    }
  }

  // Extra rules for numeric/date fields.
  if (valid && input.type === 'number' && value !== '') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 10000000) {
      valid = false;
      message = 'Enter an amount between 0 and 10,000,000.';
    }
  }

  if (valid && input.type === 'date' && value) {
    if (input.id === 'estimatedCompletion' && value < new Date().toISOString().slice(0, 10)) {
      valid = false;
      message = 'Expected completion cannot be in the past.';
    }
  }

  const field = input.closest('.field');
  let error = field && field.querySelector('.validation-error');
  if (!error && field) {
    error = document.createElement('small');
    error.className = 'validation-error';
    field.appendChild(error);
  }

  input.classList.toggle('invalid', !valid);
  input.setAttribute('aria-invalid', valid ? 'false' : 'true');
  if (error) {
    error.textContent = valid ? '' : message;
    error.hidden = valid;
  }
  return valid;
};

window.validateForm = function (form) {
  if (!form) return false;
  let valid = true;
  let firstInvalid = null;

  form.querySelectorAll('input, textarea, select').forEach(input => {
    if (!window.validateField(input)) {
      valid = false;
      if (!firstInvalid) firstInvalid = input;
    }
  });

  if (firstInvalid) firstInvalid.focus();
  return valid;
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form').forEach(form => {
    // We control the messages ourselves rather than showing browser-native messages.
    form.setAttribute('novalidate', 'novalidate');

    form.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('blur', () => window.validateField(input));
      input.addEventListener('input', () => {
        if (input.classList.contains('invalid')) window.validateField(input);
      });
      input.addEventListener('change', () => window.validateField(input));
    });
  });
});
