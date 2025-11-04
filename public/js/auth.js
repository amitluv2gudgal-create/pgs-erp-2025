// public/js/auth.js
// Safe DOM attach and login/logout helpers

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('username')?.value?.trim() || '';
      const password = document.getElementById('password')?.value || '';
      const loginMsg = document.getElementById('loginMsg');

      if (loginMsg) loginMsg.textContent = 'Logging in...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const body = await res.json().catch(() => ({}));
        console.log('Login response:', res.status, body);

        if (res.ok) {
          if (loginMsg) loginMsg.textContent = 'Login successful';
          // refresh user UI (if present)
          if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
          // load clients automatically if function available
          if (typeof loadClients === 'function') loadClients();
        } else {
          // show server message if present
          const err = body?.error || body?.message || 'Login failed';
          if (loginMsg) loginMsg.textContent = 'Login failed: ' + err;
          console.warn('Login failed:', res.status, body);
        }
      } catch (err) {
        console.error('Login network error', err);
        if (loginMsg) loginMsg.textContent = 'Network error';
      }

      setTimeout(() => {
        if (document.getElementById('loginMsg')) document.getElementById('loginMsg').textContent = '';
      }, 3000);
    });
  } else {
    console.warn('loginBtn not found in DOM');
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        console.log('Logout response:', res.status, body);
        if (res.ok) {
          if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
          if (document.getElementById('clientsTable')) document.getElementById('clientsTable').innerHTML = '';
        } else {
          alert('Logout failed: ' + (body?.error || res.status));
        }
      } catch (err) {
        console.error('Logout error', err);
      }
    });
  } else {
    console.warn('logoutBtn not found in DOM');
  }
});
