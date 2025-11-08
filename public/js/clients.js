// public/js/clients.js
// Robust clients loader + renderer for PGS-ERP
// - idempotent (guarded)
// - cleans duplicate script tags / duplicate containers if present
// - exposes loadClients(), renderClientsTable(), refreshClientsTable(), openCreateClient()

/* Guard: avoid double-init when file loads more than once */
if (window.__pgs_clients_module_loaded) {
  console.warn('[clients.js] module already loaded — skipping duplicate init');
} else {
  window.__pgs_clients_module_loaded = true;

  // ----------------- helpers -----------------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeClient(c = {}) {
    const o = Object.assign({}, c);
    o.address_line1 = o.address_line1 ?? o.address ?? o.addr ?? o.address1 ?? '';
    o.address_line2 = o.address_line2 ?? o.address2 ?? o.addr2 ?? '';
    o.contact_person = o.contact_person ?? o.contact ?? o.contact_name ?? '';
    o.telephone = o.telephone ?? o.phone ?? o.tel ?? o.mobile ?? '';
    o.email = o.email ?? o.email_address ?? '';
    o.gst_number = o.gst_number ?? o.gst ?? o.gstin ?? '';
    o.igst = (o.igst !== undefined && o.igst !== null && o.igst !== '') ? o.igst : '';
    o.cgst = (o.cgst !== undefined && o.cgst !== null && o.cgst !== '') ? o.cgst : '';
    o.sgst = (o.sgst !== undefined && o.sgst !== null && o.sgst !== '') ? o.sgst : '';

    if (Array.isArray(o.categories)) {
      // ok
    } else if (typeof o.categories === 'string' && o.categories.trim().length > 0) {
      // keep string
    } else if (o.client_categories && Array.isArray(o.client_categories)) {
      o.categories = o.client_categories;
    } else {
      o.categories = o.categories ?? [];
    }

    return o;
  }

  // ----------------- DOM cleanup to remove duplicates -----------------
  (function cleanupDuplicateUI() {
    // Remove duplicate <script> tags that load clients.js (keep first)
    try {
      const scriptSrcMatches = Array.from(document.querySelectorAll('script[src]'))
        .filter(s => s.src && s.src.indexOf('clients.js') !== -1);
      if (scriptSrcMatches.length > 1) {
        scriptSrcMatches.slice(1).forEach(s => {
          console.warn('[clients.js] removing duplicate script tag', s.src);
          s.parentNode && s.parentNode.removeChild(s);
        });
      }
    } catch (e) {
      // ignore
    }

    // Normalize: keep only first clients table container if multiples exist
    try {
      const containers = document.querySelectorAll('#clients-table-container');
      if (containers.length > 1) {
        containers.forEach((c, i) => {
          if (i > 0) {
            console.warn('[clients.js] removing duplicate #clients-table-container', c);
            c.remove();
          }
        });
      }
    } catch (e) {}
  })();


  // ----------------- Renderer -----------------
  window.renderClientsTable = async function renderClientsTable(clients) {
    const container = document.querySelector('#clients-table-container') || document.querySelector('#table-container') || document.getElementById('content') || document.body;
    if (!container) return console.warn('[renderClientsTable] No container found for clients table');

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

    const esc = s => (s == null ? '' : escapeHtml(s));

    let html = `<div class="responsive-table"><table id="clients-table" class="clients-table"><thead><tr>`;
    html += cols.map(c => `<th>${esc(c.label)}</th>`).join('');
    html += `<th>Actions</th></tr></thead><tbody>`;

    if (!clients || clients.length === 0) {
      html += `<tr><td colspan="${cols.length + 1}" style="padding:16px">No clients found.</td></tr>`;
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

    // Remove any accidental duplicate table elements (keep first)
    try {
      const tables = document.querySelectorAll('table.clients-table');
      if (tables.length > 1) {
        tables.forEach((t, i) => { if (i > 0) t.remove(); });
        console.warn('[clients.js] removed extra clients-table elements');
      }
    } catch (e) {}

    // Attach a single delegated click handler to the container (only once)
    if (!container.__clients_action_handler_attached) {
      container.__clients_action_handler_attached = true;
      container.addEventListener('click', async function (ev) {
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
            await window.refreshClientsTable();
          } catch (err) {
            console.error('Delete client error', err);
            alert('Network error while deleting client.');
          }
        }
      }, false);
    }

    return clients;
  };

  // ----------------- refresh helper -----------------
  window.refreshClientsTable = async function refreshClientsTable() {
    const clients = await loadClients();
    return window.renderClientsTable(clients);
  };

  // ----------------- openCreateClient helper -----------------
  // When Create Client button is clicked, prefer modal if exists, otherwise redirect to client-create page
  window.openCreateClient = function openCreateClient() {
    // Try modal id first
    const modal = document.getElementById('client-create-modal');
    const createPage = '/client-create.html';
    if (modal) {
      modal.style.display = 'block';
      if (typeof modal.showModal === 'function') {
        try { modal.showModal(); } catch(e) {}
      }
      return;
    }
    // fallback redirect
    window.location.href = createPage;
  };

  // Attach create-client button handler (if present)
  (function attachCreateButton() {
    try {
      const btn = document.getElementById('create-client-btn') || document.querySelector('[data-action="create-client"]') || document.querySelector('.btn-create-client');
      if (btn && !btn.__clients_create_attached) {
        btn.__clients_create_attached = true;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          window.openCreateClient();
        });
      }
    } catch (e) {}
  })();

  // Do NOT auto-run loadClients() here. Let app.js or the page call loadClients when appropriate.
  // But if caller forgot, ensure page has the clients table present by calling loadClients once if nothing triggers it within a short time.
  setTimeout(() => {
    try {
      const container = document.querySelector('#clients-table-container') || document.querySelector('#table-container') || document.getElementById('content');
      const firstTable = document.querySelector('table.clients-table');
      // If there's no table yet and nobody else has called loadClients, call it once to populate
      if (container && !firstTable && !window.__pgs_clients_loaded_once) {
        window.__pgs_clients_loaded_once = true;
        loadClients();
      }
    } catch (e) {}
  }, 300);
}

// ----------------- API loader (exported) -----------------
 export async function loadClients() {
    const container = document.querySelector('#clients-table-container') || document.querySelector('#table-container') || document.getElementById('content') || document.body;
    if (container) container.innerHTML = `<div class="loading">Loading clients…</div>`;
    try {
      const resp = await fetch('/api/clients', { credentials: 'include' });

      if (resp.status === 401) {
        if (container) container.innerHTML = `<div style="padding:16px;color:#a00">You are not signed in. <a href="/login.html">Sign in</a> to view clients.</div>`;
        console.warn('[loadClients] 401 Unauthorized');
        return [];
      }

      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (!resp.ok) {
        const json = ct.includes('application/json') ? await resp.json().catch(()=>({})) : null;
        if (container) container.innerHTML = `<div style="padding:16px;color:#a00">Server error ${resp.status}: ${escapeHtml(json && json.error ? json.error : String(json || ''))}</div>`;
        console.error('[loadClients] server error', resp.status, json);
        return [];
      }

      if (!ct.includes('application/json')) {
        const body = await resp.text().catch(()=>'(no body)');
        if (container) container.innerHTML = `<div style="padding:16px;color:#a00">Unexpected server response (expected JSON). Try signing in. <pre>${escapeHtml(body.slice(0,800))}</pre></div>`;
        return [];
      }

      const payload = await resp.json();
      const clients = Array.isArray(payload) ? payload : (payload && payload.clients ? payload.clients : []);
      if (typeof window.renderClientsTable === 'function') {
        window.renderClientsTable(clients);
      }
      return clients;
    } catch (err) {
      console.error('[loadClients] network error', err);
      if (container) container.innerHTML = `<div style="padding:16px;color:#a00">Network or JS error: ${escapeHtml(String(err))}</div>`;
      return [];
    }
  }
