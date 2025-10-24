// public/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value || '';

    if (!username || !password) {
      alert('Please enter username and password');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',              // ✅ send/receive session cookie
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        let msg = '';
        try { msg = (await res.json()).error; } catch { msg = await res.text(); }
        throw new Error(msg || 'Login failed');
      }

      const data = await res.json();
      // Optional: keep role in localStorage for quick UI decisions
      if (data?.role) localStorage.setItem('userRole', data.role);

      // Go to dashboard
      window.location.href = '/index.html';
    } catch (err) {
      console.error('Login error:', err);
      alert(err.message || 'Login failed');
    }
  });
});
