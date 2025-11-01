// public/js/clients.js
// Fixed and cleaned Clients frontend (Create + View)
// - corrects table markup and column alignment
// - preserves legacy functions and integrates with existing showTable/filterTable

export const loadClients = async () => {
  try {
    const res = await fetch('/api/clients', { credentials: 'include' });
    if (!res.ok) {
      console.error('loadClients: server returned', res.status);
      window.data_clients = [];
      return [];
    }
    const data = await res.json();
    window.data_clients = Array.isArray(data) ? data : [];
    return window.data_clients;
  } catch (e) {
    console.error('loadClients failed:', e);
    window.data_clients = [];
    return [];
  }
};

// ===== Create Client (form) =====
window.showClientForm = () => {
  const content = document.getElementById('content') || document.body;

  // Remove old container if present to avoid duplicates
  document.getElementById('client-create-container')?.remove();

  const container = document.createElement('div');
  container.id = 'client-create-container';
  content.appendChild(container);

  container.innerHTML = `
    <h3>Create Client</h3>
    <form id="clientForm">
      <label>Client Name<br><input type="text" id="c_name" required></label><br><br>

      <fieldset style="border:1px solid #ddd;padding:10px;border-radius:8px;">
        <legend>Address</legend>
        <label>Address Line 1 (Billed to)<br>
          <input type="text" id="c_address_line1" placeholder="Enter billing address">
        </label><br><br>
        <label>Address Line 2 (Shipped to)<br>
          <input type="text" id="c_address_line2" placeholder="Optional — falls back to Line 1">
        </label>
      </fieldset><br>

      <label>State<br><input type="text" id="c_state" placeholder="e.g., Maharashtra"></label><br><br>
      <label>District<br><input type="text" id="c_district" placeholder="e.g., Thane"></label><br><br>

      <label>PO/dated<br>
        <input type="text" id="c_po_dated" placeholder="e.g., PGS/SECURITY/105 dated 30th October 2025">
      </label><br><br>

      <label>Telephone<br><input type="text" id="c_telephone" placeholder="+91-..."></label><br><br>
      <label>Email<br><input type="email" id="c_email" placeholder="name@company.com"></label><br><br>
      <label>GST Number<br><input type="text" id="c_gst_number" placeholder="Optional"></label><br><br>
      <label>CGST (%)<br><input type="number" step="0.01" id="c_cgst" placeholder="9"></label><br><br>
      <label>SGST (%)<br><input type="number" step="0.01" id="c_sgst" placeholder="9"></label><br><br>
      <label>IGST (%)<br><input type="number" step="0.01" id="c_igst" placeholder="18"></label><br><br>

      <div id="categoriesContainer">
        <h4>Categories (optional)</h4>
      </div>
      <button type="button" id="btnAddCat">Add Category</button><br><br>

      <button type="submit">Save Client</button>
    </form>
  `;

  const addCategoryField = () => {
    const cats = document.getElementById('categoriesContainer');
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.style.margin = '6px 0';
    row.innerHTML = `
      <select class="cat-select">
        <option value="">Select Category</option>
        <option value="security guard">Security Guard</option>
        <option value="lady sercher">Lady Sercher</option>
        <option value="security supervisor">Security Supervisor</option>
        <option value="assistant security officer">Assistant Security Officer</option>
        <option value="security officer">Security Officer</option>
        <option value="housekeeper">Housekeeper</option>
        <option value="housekeeping supervisor">Housekeeping Supervisor</option>
        <option value="team leader housekeeping">Team Leader Housekeeping</option>
        <option value="workman unskilled">Workman Unskilled</option>
        <option value="workman skilled">Workman Skilled</option>
        <option value="bouncer">Bouncer</option>
        <option value="gunman">Gunman</option>
        <option value="cctv operator">CCTV Operator</option>
        <option value="office boy">Office Boy</option>
        <option value="steward">Steward</option>
      </select>
      <input type="number" step="0.01" placeholder="Monthly Rate" class="cat-rate" style="width:160px;">
    `;
    cats.appendChild(row);
  };

  document.getElementById('btnAddCat').onclick = addCategoryField;
  addCategoryField(); // start with one row by default

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: valOrNull(document.getElementById('c_name').value, true),
      address_line1: valOrNull(document.getElementById('c_address_line1').value),
      address_line2: valOrNull(document.getElementById('c_address_line2').value),
      state: valOrNull(document.getElementById('c_state').value),
      district: valOrNull(document.getElementById('c_district').value),
      po_dated: valOrNull(document.getElementById('c_po_dated').value),
      telephone: valOrNull(document.getElementById('c_telephone').value),
      gst_number: valOrNull(document.getElementById('c_gst_number').value),
      email: valOrNull(document.getElementById('c_email').value),
      cgst: numOrZero(document.getElementById('c_cgst').value),
      sgst: numOrZero(document.getElementById('c_sgst').value),
      igst: numOrZero(document.getElementById('c_igst').value),
    };
    if (!payload.name) {
      alert('Client name is required');
      return;
    }

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();

      // Optional categories
      const rows = [...document.querySelectorAll('#categoriesContainer .cat-row')];
      for (const r of rows) {
        const category = r.querySelector('.cat-select').value;
        const monthly_rate = parseFloat(r.querySelector('.cat-rate').value || '0');
        if (category && monthly_rate > 0) {
          const cr = await fetch(`/api/clients/${created.id}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ category, monthly_rate })
          });
          if (!cr.ok) {
            console.warn('Category add failed:', await cr.text());
          }
        }
      }

      alert('Client saved.');
      if (window.showTable) window.showTable('clients');
    } catch (err) {
      console.error('Create client error:', err);
      alert('Error: ' + (err.message || 'Failed'));
    }
  });
};

// ===== Enhanced Clients table (View Clients) =====

// Preserve any existing global renderers (from app.js) so other tables still work
const __origRenderTable = window.renderTable;
const __origFilterTable = window.filterTable;

// Build HTML
function __clientsTableHTML(rows = []) {
  const esc = (s) => (s == null ? '' : String(s));
  return `
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:12px;">
      <thead style="background:#f4f4f4;">
        <tr>
          <th style="text-align:left;">ID</th>
          <th style="text-align:left;">Name</th>
          <th style="text-align:left;">Address Line 1 (Billed to)</th>
          <th style="text-align:left;">Address Line 2 (Shipped to)</th>
          <th style="text-align:left;">PO/dated</th>
          <th style="text-align:left;">State</th>
          <th style="text-align:left;">District</th>
          <th style="text-align:left;">Telephone</th>
          <th style="text-align:left;">GST Number</th>
          <th style="text-align:left;">Email</th>
          <th style="text-align:left;">CGST</th>
          <th style="text-align:left;">SGST</th>
          <th style="text-align:left;">IGST</th>
          <th style="text-align:left;">Categories</th>
          <th style="text-align:left; width:160px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(c => `
          <tr data-id="${esc(c.id)}">
            <td>${esc(c.id)}</td>
            <td>${esc(c.name)}</td>
            <td>${esc(c.address_line1 || '')}</td>
            <td>${esc(c.address_line2 || c.address_line1 || '')}</td>
            <td>${esc(c.po_dated || '')}</td>
            <td>${esc(c.state || '')}</td>
            <td>${esc(c.district || '')}</td>
            <td>${esc(c.telephone || '')}</td>
            <td>${esc(c.gst_number || '')}</td>
            <td>${esc(c.email || '')}</td>
            <td>${esc(c.cgst ?? '')}</td>
            <td>${esc(c.sgst ?? '')}</td>
            <td>${esc(c.igst ?? '')}</td>
            <td>${esc(c.categories ? (Array.isArray(c.categories) ? c.categories.join(', ') : c.categories) : '')}</td>
            <td>
              <button class="btn-edit-client">Edit</button>
              <button class="btn-add-cat">Add Category</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Filter logic for search box (works with your existing search UI)
function __filterClientsData(data, query, exact) {
  const q = (query || '').trim();
  if (!q) return data || [];
  const ql = q.toLowerCase();
  return (data || []).filter(c => {
    const hay = [
      String(c.id ?? ''),
      String(c.name ?? ''),
      String(c.address_line1 ?? ''),
      String(c.address_line2 ?? ''),
      String(c.po_dated ?? ''),
      String(c.state ?? ''),
      String(c.district ?? ''),
      String(c.telephone ?? ''),
      String(c.gst_number ?? ''),
      String(c.email ?? ''),
      String(c.categories ?? '')
    ];
    if (exact) return hay.some(v => v === q || v.toLowerCase() === ql);
    return hay.some(v => v.toLowerCase().includes(ql));
  });
}

// Override renderTable ONLY for 'clients'
window.renderTable = function(containerId, table, data, query) {
  if (table !== 'clients') {
    return __origRenderTable && __origRenderTable(containerId, table, data, query);
  }

  const container = document.getElementById(containerId);
  if (!container) return;

  const searchEl = document.getElementById('search-clients');
  const exactEl = document.getElementById('exact-clients');
  const searchVal = searchEl ? searchEl.value : (query || '');
  const exact = exactEl ? !!exactEl.checked : false;

  // prefer passed data, fallback to window.data_clients
  const src = Array.isArray(data) ? data : (window.data_clients || []);
  const filtered = __filterClientsData(src, searchVal, exact);

  const slotId = 'table-clients';
  container.querySelector('#' + slotId)?.remove();
  const slot = document.createElement('div');
  slot.id = slotId;
  slot.innerHTML = __clientsTableHTML(filtered);
  container.appendChild(slot);

  // Event delegation for Edit and Add Category buttons
  slot.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.getAttribute('data-id'));

    if (ev.target.closest('.btn-edit-client')) {
      if (id) openEditClientModal(id);
      return;
    }
    if (ev.target.closest('.btn-add-cat')) {
      if (id) openAddCategoryModal(id);
      return;
    }
  });
};

// Override filterTable only for 'clients'
window.filterTable = function(table) {
  if (table !== 'clients') {
    return __origFilterTable && __origFilterTable(table);
  }
  const containerId = `table-container-${table}`;
  const data = window.data_clients || [];
  window.renderTable(containerId, table, data, '');
};

// ===== Modals =====
async function openEditClientModal(id) {
  let client;
  try {
    const r = await fetch(`/api/clients/${id}`, { credentials: 'include' });
    if (!r.ok) throw new Error(await r.text());
    client = await r.json();
  } catch (e) {
    alert('Failed to load client: ' + (e.message || ''));
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:420px;max-width:640px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Edit Client #${escHtml(client.id)}</h3>
      <button id="cl-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="clEditForm" style="display:grid;gap:10px;">
      <label>Name<br><input id="e_name" value="${escHtml(client.name)}" required></label>
      <label>Address Line 1 (Billed to)<br><input id="e_addr1" value="${escHtml(client.address_line1 || '')}"></label>
      <label>Address Line 2 (Shipped to)<br><input id="e_addr2" value="${escHtml(client.address_line2 || '')}"></label>
      <label>PO/dated<br><input id="e_po" value="${escHtml(client.po_dated || '')}" placeholder="PGS/SECURITY/105 dated 30th October 2025"></label>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">State<br><input id="e_state" value="${escHtml(client.state || '')}"></label>
        <label style="flex:1">District<br><input id="e_district" value="${escHtml(client.district || '')}"></label>
      </div>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">Telephone<br><input id="e_tel" value="${escHtml(client.telephone || '')}"></label>
        <label style="flex:1">Email<br><input id="e_email" type="email" value="${escHtml(client.email || '')}"></label>
      </div>
      <label>GST Number<br><input id="e_gst" value="${escHtml(client.gst_number || '')}"></label>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">CGST (%)<br><input id="e_cgst" type="number" step="0.01" value="${client.cgst ?? ''}"></label>
        <label style="flex:1">SGST (%)<br><input id="e_sgst" type="number" step="0.01" value="${client.sgst ?? ''}"></label>
      </div>
      <label>IGST (%)<br><input id="e_igst" type="number" step="0.01" value="${client.igst ?? ''}"></label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button type="submit">Save</button>
        <button type="button" id="cl-edit-cancel">Cancel</button>
      </div>
      <div id="cl_edit_msg" style="color:#b00;"></div>
    </form>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  card.querySelector('#cl-edit-close').onclick = close;
  card.querySelector('#cl-edit-cancel').onclick = close;

  card.querySelector('#clEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: valOrNull(card.querySelector('#e_name').value, true),
      address_line1: valOrNull(card.querySelector('#e_addr1').value),
      address_line2: valOrNull(card.querySelector('#e_addr2').value),
      po_dated: valOrNull(card.querySelector('#e_po').value),
      state: valOrNull(card.querySelector('#e_state').value),
      district: valOrNull(card.querySelector('#e_district').value),
      telephone: valOrNull(card.querySelector('#e_tel').value),
      gst_number: valOrNull(card.querySelector('#e_gst').value),
      email: valOrNull(card.querySelector('#e_email').value),
      cgst: numOrNull(card.querySelector('#e_cgst').value),
      sgst: numOrNull(card.querySelector('#e_sgst').value),
      igst: numOrNull(card.querySelector('#e_igst').value),
    };
    if (!payload.name) {
      card.querySelector('#cl_edit_msg').textContent = 'Client name is required.';
      return;
    }
    try {
      const r = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text());
      close();
      alert('Client updated.');
      if (window.showTable) window.showTable('clients');
    } catch (err) {
      card.querySelector('#cl_edit_msg').textContent = err.message || 'Update failed.';
    }
  });
}

function openAddCategoryModal(id) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:360px;max-width:520px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Add Category to Client #${escHtml(id)}</h3>
      <button id="cat-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="catForm" style="display:grid;gap:10px;">
      <label>Category<br>
        <select id="cat_category">
          <option value="">Select Category</option>
          <option value="security guard">Security Guard</option>
          <option value="lady sercher">Lady Sercher</option>
          <option value="security supervisor">Security Supervisor</option>
          <option value="assistant security officer">Assistant Security Officer</option>
          <option value="security officer">Security Officer</option>
          <option value="housekeeper">Housekeeper</option>
          <option value="housekeeping supervisor">Housekeeping Supervisor</option>
          <option value="team leader housekeeping">Team Leader Housekeeping</option>
          <option value="workman unskilled">Workman Unskilled</option>
          <option value="workman skilled">Workman Skilled</option>
          <option value="bouncer">Bouncer</option>
          <option value="gunman">Gunman</option>
          <option value="cctv operator">CCTV Operator</option>
          <option value="office boy">Office Boy</option>
          <option value="steward">Steward</option>
        </select>
      </label>
      <label>Monthly Rate<br><input type="number" step="0.01" id="cat_rate" placeholder="e.g., 18000"></label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button type="submit">Add</button>
        <button type="button" id="cat-cancel">Cancel</button>
      </div>
      <div id="cat_msg" style="color:#b00;"></div>
    </form>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  card.querySelector('#cat-close').onclick = close;
  card.querySelector('#cat-cancel').onclick = close;

  card.querySelector('#catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = String(card.querySelector('#cat_category').value || '').trim();
    const monthly_rate = parseFloat(card.querySelector('#cat_rate').value || '0');
    if (!category) {
      card.querySelector('#cat_msg').textContent = 'Please select a category.';
      return;
    }
    if (!(monthly_rate > 0)) {
      card.querySelector('#cat_msg').textContent = 'Monthly rate must be > 0.';
      return;
    }
    try {
      const r = await fetch(`/api/clients/${id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, monthly_rate })
      });
      if (!r.ok) throw new Error(await r.text());
      close();
      alert('Category added.');
      if (window.showTable) window.showTable('clients');
    } catch (err) {
      card.querySelector('#cat_msg').textContent = err.message || 'Failed to add category.';
    }
  });
}

// ===== Helpers =====
function valOrNull(v, required = false) {
  const s = String(v ?? '').trim();
  if (required && s === '') return null;
  return s === '' ? null : s;
}
function numOrZero(v) {
  const s = String(v ?? '').trim();
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] ));
}

// Compatibility shims for legacy inline onclicks (safe to keep alongside delegation)
window.openEditClient = (id) => { try { openEditClientModal(Number(id)); } catch(e) { console.error(e); } };
window.showCategoryForm = (id) => { try { openAddCategoryModal(Number(id)); } catch(e) { console.error(e); } };
