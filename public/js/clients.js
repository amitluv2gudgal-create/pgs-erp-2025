// public/js/clients.js
// Exported loadClients so other modules can import { loadClients } from './clients.js'
export async function loadClients() {
  try {
    const res = await fetch('/api/clients', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('loadClients: fetch /api/clients returned', res.status, errBody);
      const el = document.querySelector('#clientsTable');
      if (el) el.innerHTML = `<div class="error">Error ${res.status}: ${errBody?.error || res.statusText}</div>`;
      return;
    }

    const clients = await res.json();
    renderClientsTable(clients);
  } catch (err) {
    console.error('loadClients network error', err && err.stack ? err.stack : err);
    const el = document.querySelector('#clientsTable');
    if (el) el.innerHTML = `<div class="error">Network error: ${err?.message || err}</div>`;
  }
}

// make it available on window for inline/onclick usage
window.loadClients = loadClients;

function renderClientsTable(clients = []) {
  const el = document.querySelector('#clientsTable');
  if (!el) {
    console.warn('No #clientsTable element found to render clients');
    return;
  }

  if (!Array.isArray(clients) || !clients.length) {
    el.innerHTML = '<div>No clients found</div>';
    return;
  }

  const rows = clients.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.client_unique_number || '')}</td>
      <td>${escapeHtml(c.telephone || '')}</td>
      <td>${escapeHtml(c.email || '')}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <table class="table">
      <thead>
        <tr><th>ID</th><th>Name</th><th>Unique#</th><th>Phone</th><th>Email</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe).replace(/[&<>"'`=\/]/g, function(s) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[s];
  });
}
