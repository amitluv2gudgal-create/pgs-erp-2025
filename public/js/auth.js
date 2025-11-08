// 

// public/js/auth.js  (replace existing)
console.log('[auth.js] loaded');

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const username = (document.getElementById('username') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';

    // Basic validation
    if (!username || !password) {
      alert('Please enter username and password');
      return;
    }

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',   // send cookies (if server uses session cookies)
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        cache: 'no-store'
      });

      // Debugging: log statuses & body
      const text = await resp.text().catch(()=>null);
      try {
        console.log('[auth] status=', resp.status, 'body=', JSON.parse(text || '{}'));
      } catch (e) {
        console.log('[auth] status=', resp.status, 'raw=', text);
      }

      if (resp.ok) {
        // Successful login: go to dashboard
        window.location.href = '/index.html';
        return;
      }

      // If not ok, try to parse JSON error message
      let errMsg = `Login failed (status ${resp.status})`;
      try {
        const json = text ? JSON.parse(text) : {};
        if (json && json.error) errMsg = json.error;
      } catch (e) {
        // no JSON
      }

      alert(errMsg);
    } catch (err) {
      console.error('[auth] Network error', err);
      alert('Network error while attempting login: ' + String(err));
    }
  });
}
