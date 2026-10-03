// Server-backed admin authentication.
// The backend issues a short-lived session token after verifying the credentials.

const AdminAuth = {
  getToken() {
    return sessionStorage.getItem('rb_admin_token') || '';
  },

  isLoggedIn() {
    return Boolean(this.getToken());
  },

  async login(username, password) {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Unable to sign in.');
    }

    sessionStorage.setItem('rb_admin_token', data.token);
    sessionStorage.setItem('rb_admin_user', data.username || username);
    return true;
  },

  async logout() {
    const token = this.getToken();

    try {
      if (token) {
        await fetch(`${API_URL}/admin/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (_) {
      // Clear the local session even if the server is unavailable.
    }

    sessionStorage.removeItem('rb_admin_token');
    sessionStorage.removeItem('rb_admin_user');
    window.location.href = 'admin-login.html';
  },

  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = 'admin-login.html';
    }
  },

  async fetch(url, options = {}) {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      sessionStorage.removeItem('rb_admin_token');
      sessionStorage.removeItem('rb_admin_user');
      window.location.href = 'admin-login.html';
      throw new Error('Your admin session has expired.');
    }

    return response;
  }
};

window.AdminAuth = AdminAuth;
