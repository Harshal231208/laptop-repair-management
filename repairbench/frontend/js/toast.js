

(function () {
  function ensureContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function (message, type = 'success', duration = 4500) {
    const container = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'error' ? '⚠' : '✓'}</span>
      <span class="toast-text"></span>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;
    toast.querySelector('.toast-text').textContent = message;

    const remove = () => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    toast.querySelector('.toast-close').addEventListener('click', remove);
    container.appendChild(toast);

    const timer = setTimeout(remove, duration);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
  };
})();
