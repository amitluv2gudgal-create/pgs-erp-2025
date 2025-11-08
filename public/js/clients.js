// public/js/clients.js
// ES module - client loader + renderer for PGS-ERP
// Exports: loadClients()

// ------------------ helper ------------------
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#039;');
}

// normalize client object so renderer is robust to field variations
function normalizeClient(c = {}) {
  const o = Object.assign({}, c);

  o.address_line1 = o.address_line1 ?? o.address ?? o.addr ?? o.address1 ?? (o.address_full ? String(o.address_full).split('\n')[0] : '') ?? '';
  o.address_line2 = o.address_line2 ?? o.address2 ?? o.addr2 ?? (o.address_full ? String(o.address_full).split('\n').slice(1).join(', ') : '') ?? '';
  o.contact_person = o.contact_person ?? o.contact ?? o.contact_name ?? o.person ?? o.manager ?? '';
  o.telephone = o.telephone ?? o.phone ?? o.tel ?? o.mobile ?? '';
  o.email = o.email ?? o.email_address ?? o.contact_email ?? '';
  o.gst_number = o.gst_number ?? o.gst ?? o.gstin ?? '';
  o.igst = (o.igst !== undefined && o.igst !== null && o.igst !== '') ? o.igst : (o.IGST !== undefined ? o.IGST : '');
  o.cgst = (o.cgst !== undefined && o.cgst !== null && o.cgst !== '') ? o.cgst : (o.CGST !== undefined ? o.CGST : '');
  o.sgst = (o.sgst !== undefined && o.sgst !== null && o.sgst !== '') ? o.sgst : (o.SGST !== undefined ? o.SGST : '');

  if (Array.isArray(o.categories)) {
    // ok
  } else if (typeof o.categories === 'string' && o.categories.trim().length > 0) {
    // leave string as-is
  } else if (o.client_categories && Array.isArray(o.client_categories)) {
    o.categories = o.client_categories;
  } else {
    o.categories = o.categories ?? [];
  }

  return o;
}

// ------------------ loader ------------------
export async function loadClients() {
  const container = document.querySelector('#table-container') || document.getElementById('clients-table-container') || document.getElementById('content');
  if (container) container.innerHTML = `<div class="loading">Loading clients…</div>`;

  try {
    const resp = await fetch('/api/clients', { credentials: 'include' });

    if (resp.status === 401) {
      if (container) container.innerHTML = `
        <div style="padding:16px;color:#a00">
          You are not signed in. <a href="/login.html">Sign in</a> to view clients.
        </div>`;
      console.warn('[loadClients] 401 Unauthorized');
      return [];
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();

    if (!resp.ok && contentType.includes('application/json')) {
      const json = await resp.json().catch(()=>({}));
      if (container) container.innerHTML = `<div style="padding:16px;color:#a00">Server error ${resp.status}: ${escapeHtml(json.error || JSON.stringify(json))}</div>`;
      console.error('[loadClients] server error', resp.status, json);
      return [];
    }

    if (!contentType.includes('application/json')) {
      const body = await resp.text().catch(()=>'(no body)');
      if (container) container.innerHTML = `<div style="padding:16px;color:#a00">
        Unexpected server response (expected JSON). This often means you're not logged in. <a href="/login.html">Sign in</a>.
        <pre style="white-space:pre-wrap">${escapeHtml(body.slice(0,800))}</pre>
      </div>`;
      console.warn('[loadClients] Non-JSON response prevented from being injected');
      return [];
    }

    const payload = await resp.json();
    const clients = Array.isArray(payload) ? payload : (payload && payload.clients ? payload.clients : []);
    if (typeof window.renderClientsTable === 'function') {
      window.renderClientsTable(clients);
    } else {
      if (container) container.innerHTML = `<div style="padding:16px">Found ${clients.length} clients</div>`;
    }
    return clients;
  } catch (err) {
    console.error('[loadClients] network error', err);
    if (container) container.innerHTML = `<div style="padding:16px;color:#a00">Network or JS error: ${escapeHtml(String(err))}</div>`;
    return [];
  }
}

// ------------------ renderer ------------------
window.renderClientsTable = async function(clients) {
  const container = document.querySelector('#table-container') || document.getElementById('clients-table-container') || document.getElementById('content');
  if (!container) return console.warn('No clients table container found');

  const esc = s => (s == null ? '' : escapeHtml(s));

  // show interim message
  container.innerHTML = `<div style="padding:10px">Building clients table…</div>`;

  if (!Array.isArray(clients)) {
    clients = await (typeof loadClients === 'function' ? loadClients() : Promise.resolve([]));
  }

  const cols = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'address_line1', label: 'Address Line 1 (Billed)' },
    { key: 'address_line2', label: 'Address Line 2 (Shipped)' },
    { key: 'po_dated', label: 'PO/Dated' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
    { key: 'contact_person', label: 'Contact Person' },
    { key: 'telephone', label: 'Telephone' },
    { key: 'email', label: 'Email' },
    { key: 'gst_number', label: 'GST Number' },
    { key: 'cgst', label: 'CGST (%)' },
    { key: 'sgst', label: 'SGST (%)' },
    { key: 'igst', label: 'IGST (%)' },
    { key: 'categories', label: 'Categories' }
  ];

  // build html with responsive wrapper
  let html = `<div class="responsive-table"><table id="clients-table" class="clients-table"><thead><tr>`;
  html += cols.map(c => `<th>${esc(c.label)}</th>`).join('');
  html += `<th>Actions</th></tr></thead><tbody>`;

  if (!clients || clients.length === 0) {
    html += `<tr><td colspan="${cols.length+1}" style="padding:16px">No clients found.</td></tr>`;
  } else {
    for (const orig of clients) {
      const c = normalizeClient(orig);
      const cats = Array.isArray(c.categories) ? c.categories.map(x => typeof x === 'object' ? (x.category || JSON.stringify(x)) : x).join(', ') : (c.categories || '');
      html += `<tr data-client-id="${esc(c.id)}">`;
      html += `<td>${esc(c.id)}</td>`;
      html += `<td>${esc(c.name)}</td>`;
      html += `<td>${esc(c.address_line1)}</td>`;
      html += `<td>${esc(c.address_line2)}</td>`;
      html += `<td>${esc(c.po_dated || '')}</td>`;
      html += `<td>${esc(c.state || '')}</td>`;
      html += `<td>${esc(c.district || '')}</td>`;
      html += `<td>${esc(c.contact_person || '')}</td>`;
      html += `<td>${esc(c.telephone || '')}</td>`;
      html += `<td>${esc(c.email || '')}</td>`;
      html += `<td>${esc(c.gst_number || '')}</td>`;
      html += `<td>${esc(c.cgst ?? '')}</td>`;
      html += `<td>${esc(c.sgst ?? '')}</td>`;
      html += `<td>${esc(c.igst ?? '')}</td>`;
      html += `<td>${esc(cats)}</td>`;
      html += `<td class="action-cell">`;
      html += `<button class="btn-action btn-edit" data-action="edit" data-id="${esc(c.id)}">Edit</button>`;
      html += `<button class="btn-action btn-delete" data-action="delete" data-id="${esc(c.id)}">Delete</button>`;
      html += `</td></tr>`;
    }
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  // attach delegated event listener only once per container
  if (!container.__clients_action_handler_attached) {
    container.__clients_action_handler_attached = true;
    container.addEventListener('click', async function(ev) {
      const btn = ev.target.closest('.btn-action');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action || !id) return;

      if (action === 'edit') {
        if (typeof window.openEditClient === 'function') {
          window.openEditClient(Number(id));
        } else {
          window.location.href = `/client-edit.html?id=${encodeURIComponent(id)}`;
        }
      } else if (action === 'delete') {
        if (!confirm('Delete client ID ' + id + ' ?')) return;
        try {
          const resp = await fetch(`/api/clients/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
          if (!resp.ok) {
            const text = await resp.text().catch(()=>null);
            alert('Delete failed: ' + (text || resp.status));
            return;
          }
          // refresh table
          if (typeof window.refreshClientsTable === 'function') {
            await window.refreshClientsTable();
          } else {
            await window.renderClientsTable();
          }
        } catch (err) {
          console.error('Delete client error', err);
          alert('Network error while deleting client.');
        }
      }
    }, false);
  }

  return clients;
};

// a convenience refresher used elsewhere
window.refreshClientsTable = async function() {
  const clients = await loadClients();
  return window.renderClientsTable(clients);
};
