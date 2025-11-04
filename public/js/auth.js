// public/js/auth.js
// Attach to existing login form if present. Otherwise attach to existing buttons/inputs.
// Only create fallback if nothing exists. Uses credentials: 'include' and logs response for debugging.

document.addEventListener('DOMContentLoaded', () => {
  // helper to do login fetch
  async function doLogin(username, password, loginMsgEl) {
    if (loginMsgEl) loginMsgEl.textContent = 'Logging in...';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const body = await res.json().catch(() => ({}));
      console.log('LOGIN RESPONSE', { status: res.status, headers: Object.fromEntries(res.headers.entries()), body });

      if (res.ok) {
        if (loginMsgEl) loginMsgEl.textContent = 'Login successful';
        if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
        if (typeof loadClients === 'function') loadClients();
      } else {
        const err = body?.error || body?.message || `HTTP ${res.status}`;
        if (loginMsgEl) loginMsgEl.textContent = 'Login failed: ' + err;
        console.warn('Login failed:', err, body);
      }
    } catch (err) {
      console.error('Login network error', err);
      if (loginMsgEl) loginMsgEl.textContent = 'Network error';
    }
    setTimeout(() => { if (loginMsgEl) loginMsgEl.textContent = ''; }, 3500);
  }

  // 1) Preferred: existing <form id="loginForm"> -> use its submit
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    // If there's an element named loginMsg in the form, use it; else create small inline span
    let loginMsg = loginForm.querySelector('#loginMsg');
    if (!loginMsg) {
      loginMsg = document.createElement('span');
      loginMsg.id = 'loginMsg';
      loginMsg.style.marginLeft = '.6rem';
      loginForm.appendChild(loginMsg);
    }

    loginForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const username = (loginForm.querySelector('#username') || loginForm.querySelector('input[name="username"]'))?.value?.trim() || '';
      const password = (loginForm.querySelector('#password') || loginForm.querySelector('input[name="password"]'))?.value || '';
      doLogin(username, password, loginMsg);
    });

    console.log('auth.js: attached to existing #loginForm');
    return; // done — do not create fallback or attach other handlers
  }

  // 2) If no form, try to find existing button(s) and inputs by ids
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn && usernameInput && passwordInput) {
    const loginMsgEl = document.getElementById('loginMsg') || null;
    loginBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      doLogin(usernameInput.value.trim(), passwordInput.value, loginMsgEl);
    });
    console.log('auth.js: attached to existing #loginBtn');
  } else if (loginBtn && (!usernameInput || !passwordInput)) {
    console.warn('auth.js: found loginBtn but username/password inputs missing; creating fallback inputs next to button.');
    // create fallback inputs next to loginBtn
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.marginLeft = '8px';
    wrapper.innerHTML = `
      <input id="fallback-username" placeholder="username" style="margin-right:6px" value="accountant" />
      <input id="fallback-password" placeholder="password" type="password" style="margin-right:6px" value="rohit123" />
      <span id="loginMsg" style="margin-left:.6rem"></span>
    `;
    loginBtn.parentNode.insertBefore(wrapper, loginBtn.nextSibling);
    const fu = document.getElementById('fallback-username');
    const fp = document.getElementById('fallback-password');
    loginBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      doLogin(fu.value.trim(), fp.value, document.getElementById('loginMsg'));
    });
    console.log('auth.js: created fallback inputs near existing loginBtn');
  } else if (!loginBtn && !usernameInput && !passwordInput) {
    // 3) Nothing found — create an isolated fallback area (use unique ids so no collisions)
    console.warn('auth.js: No login form/buttons found — injecting fallback login area (unique ids).');
    const wrapper = document.createElement('div');
    wrapper.id = 'auth-fallback-area';
    wrapper.style.border = '1px solid #ddd';
    wrapper.style.padding = '8px';
    wrapper.style.margin = '8px 0';
    wrapper.innerHTML = `
      <strong>Quick Login (injected)</strong><br/>
      <input id="fallback-username" placeholder="username" style="margin-right:6px" value="accountant" />
      <input id="fallback-password" placeholder="password" type="password" style="margin-right:6px" value="rohit123" />
      <button id="fallback-loginBtn">Login</button>
      <button id="fallback-logoutBtn" style="display:none">Logout</button>
      <span id="loginMsg" style="margin-left:.6rem"></span>
    `;
    document.body.insertBefore(wrapper, document.body.firstChild);

    document.getElementById('fallback-loginBtn').addEventListener('click', (ev) => {
      ev.preventDefault();
      const u = document.getElementById('fallback-username').value.trim();
      const p = document.getElementById('fallback-password').value;
      doLogin(u, p, document.getElementById('loginMsg'));
    });
  } else {
    // partial case: username/password inputs exist but no button — create a small login button
    if ((usernameInput || passwordInput) && !loginBtn) {
      const btn = document.createElement('button');
      btn.id = 'loginBtn';
      btn.textContent = 'Login';
      (passwordInput || document.body).insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const u = (usernameInput?.value || '').trim();
        const p = (passwordInput?.value || '');
        doLogin(u, p, document.getElementById('loginMsg'));
      });
      console.log('auth.js: created loginBtn because inputs existed but button did not');
    }
  }

  // attach logout if present
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        console.log('LOGOUT RESPONSE', { status: res.status, body });
        if (res.ok) {
          if (typeof refreshUserDisplay === 'function') refreshUserDisplay();
        } else {
          alert('Logout failed: ' + (body?.error || res.status));
        }
      } catch (err) {
        console.error('Logout error', err);
      }
    });
  }
});
