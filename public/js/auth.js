// public/js/auth.js
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await res.json() : { error: await res.text() };

    if (!res.ok) {
      alert(payload?.error || `Login failed (${res.status})`);
      return;
    }

    // success
    window.location.href = '/';
  } catch (err) {
    console.error('Login error:', err);
    alert('Network or server error during login.');
  }
});
