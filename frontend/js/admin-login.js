if (AdminAuth.isLoggedIn()) {
  window.location.href = 'admin.html';
}

const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  loginError.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  try {
    await AdminAuth.login(username, password);
    showToast('Welcome back.', 'success');
    window.location.href = 'admin.html';
  } catch (error) {
    loginError.textContent = error.message || 'Incorrect username or password.';
    loginError.hidden = false;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});
