(function () {
  const TOKEN_KEY = 'repairbench_customer_token';
  const CUSTOMER_KEY = 'repairbench_customer';

  window.customerAuth = {
    token: () => localStorage.getItem(TOKEN_KEY),
    customer: () => {
      try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null'); } catch { return null; }
    },
    isLoggedIn: () => Boolean(localStorage.getItem(TOKEN_KEY)),
    save: (data) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer || {}));
    },
    clear: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_KEY);
    },
    authFetch: (url, options = {}) => {
      const headers = new Headers(options.headers || {});
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
    logout: async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      try {
        if (token) await fetch(`${API_URL}/customer/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } finally {
        window.customerAuth.clear();
        window.location.href = 'index.html';
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const old = document.getElementById('customerNav');
    if (old) old.remove();

    const link = document.createElement('a');
    link.id = 'customerNav';
    if (window.customerAuth.isLoggedIn()) {
      link.href = 'account.html';
      const customer = window.customerAuth.customer();
      link.textContent = customer?.name ? `Hi, ${customer.name.split(' ')[0]}` : 'My Account';
    } else {
      link.href = 'login.html';
      link.textContent = 'Login';
    }
    nav.insertBefore(link, nav.querySelector('a[href="admin-login.html"]') || null);
  });
})();
