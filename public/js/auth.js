// public/js/auth.js
// This file is ES module (keeps your original export style).
// It ensures credentials: 'include' is used on both flows and logs response for debugging.

// public/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (document.getElementById('username')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // MUST include cookies
        body: JSON.stringify({ username, password })
      });

      console.log('[CLIENT] POST /api/auth/login status:', res.status);
      const body = await res.json().catch(() => null);
      console.log('[CLIENT] POST /api/auth/login body:', body);

      if (res.ok && body && body.ok) {
        // give browser moment to store cookie
        setTimeout(() => window.location.href = '/index.html', 120);
      } else {
        const message = body?.error || body?.message || 'Login failed';
        alert('Login failed: ' + message);
      }
    } catch (err) {
      console.error('[CLIENT] login fetch error:', err);
      alert('Login request failed. See console for details.');
    }
  });
});


// exported helper used elsewhere in your app
export const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  const body = await response.json().catch(() => null);
  if (response.ok && body && body.ok) {
    // small delay to ensure cookie set
    await new Promise((r) => setTimeout(r, 120));
    window.location.href = '/index.html';
    return true;
  }

  throw new Error(body?.error || 'Login failed');
};
