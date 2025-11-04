// public/js/auth.js
// Robust login/logout wiring: finds existing buttons or creates a minimal UI if not present.
// Uses credentials: 'include' and logs full response for debugging.

document.addEventListener('DOMContentLoaded', () => {
  // Helper to create a minimal login area if not present in DOM
  function makeLoginArea() {
    if (document.getElementById('loginArea')) return document.getElementById('loginArea');

    const wrapper = document.createElement('div');
    wrapper.id = 'loginArea';
    wrapper.style.border = '1px solid #ddd';
    wrapper.style.padding = '8px';
    wrapper.style.margin = '8px 0';
    wrapper.innerHTML = `
      <strong>Quick Login (injected)</strong><br/>
      <input id="username" placeholder="username" style="margin-right:6px" value="accountant" />
      <input id="password" placeholder="password" type="password" style="margin-right:6px" value="rohit123" />
      <button id="loginBtn">Login</button>
      <button id="logoutBtn" style="display:none">Logout</button>
      <span id="loginMsg" style="margin-left:.6rem"></span>
    `;
    // insert at top of body so it's visible
    document.body.insertBefore(wrapper, document.body.firstChild);
    return wrapper;
  }

  // Ensure we have a login area and buttons
  const loginArea = document.getElementById('loginArea') || makeLoginArea();
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!loginBtn) {
    console.warn('auth.js: loginBtn not found in DOM — created a fallback login area.');
  } else {
    // found existing loginBtn
  }

  if (!logoutBtn) {
    console.warn('auth.js: logoutBtn not found in DOM — created a fallback logout button.');
  }

  // Attach login handler
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const usernameEl = document.getElementById('username');
      const passwordEl = document.getElementById('password');
      const loginMsg = document.getElementById('loginMsg');

      const username = usernameEl ? usernameEl.value.trim() : '';
      const password = passwordEl ? passwordEl.value : '';

      if (loginMsg) loginMsg.textContent = 'Logging in...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        // attempt to parse JSON body (may fail)
        const body = await res.json().catch(() => ({}));
        console.log('LOGIN RESPONSE', { status: res.status, headers: Object.fromEntries(res.headers.entries()), body });

        if (res.ok) {
          if (loginMsg) loginMsg.textContent = 'Login successful';
          // attempt to refresh UI (if function present)
          if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
          // auto-load clients if function available
          if (typeof loadClients === 'function') loadClients();
          // show logout button if present
          const lb = document.getElementById('logoutBtn');
          if (lb) lb.style.display = 'inline-block';
        } else {
          const err = body?.error || body?.message || `HTTP ${res.status}`;
          if (loginMsg) loginMsg.textContent = 'Login failed: ' + err;
          console.warn('Login failed:', err, body);
        }
      } catch (err) {
        console.error('Login network error', err);
        if (document.getElementById('loginMsg')) document.getElementById('loginMsg').textContent = 'Network error';
      }

      setTimeout(() => {
        const lm = document.getElementById('loginMsg');
        if (lm) lm.textContent = '';
      }, 3500);
    });
  }

  // Attach logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        console.log('LOGOUT RESPONSE', { status: res.status, body });
        if (res.ok) {
          // hide logout button if present
          const lb = document.getElementById('logoutBtn');
          if (lb) lb.style.display = 'none';
          if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
          if (document.getElementById('clientsTable')) document.getElementById('clientsTable').innerHTML = '';
        } else {
          alert('Logout failed: ' + (body?.error || res.status));
        }
      } catch (err) {
        console.error('Logout error', err);
      }
    });
  }

  // On load try refresh user display if available
  if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
});
