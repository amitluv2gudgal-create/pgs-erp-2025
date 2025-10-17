document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (res.ok) window.location.href = '/index.html';
  else alert('Login failed');
});

export const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
  });
  if (response.ok) {
    const user = await response.json();
    req.session.user = { id: user.id, role: user.role };
    window.location.href = '/index.html';
  } else {
    alert('Login failed');
  }
};