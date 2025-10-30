// public/js/clients.js
// Frontend client management (Create + View)
// Updated for Address Line 1, Address Line 2, PO/dated, and richer table rendering.

export const loadClients = async () => {
  const res = await fetch('/api/clients', { credentials: 'include' });
  return res.ok ? await res.json() : [];
};

// ===== Create Client (form) =====
window.showClientForm = () => {
  const content = document.getElementById('content');
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
      <label>CGST (%)<br><input type="number" step="0.01" id="c_cgst" placeholder="9"></label><br><br>
      <label>SGST (%)<br><input type="number" step="0.01" id="c_sgst" placeholder="9"></label><br><br>

      <div id="categoriesContainer">
        <h4>Categories (optional)</h4>
      </div>
      <button type="button" id="btnAddCat">Add Category</button><br><br>

      <button type="submit">Save Client</button>
    </form>
  `;

  const addCategoryField = () => {
    const container = document.getElementById('categoriesContainer');
    const idx = container.querySelectorAll('.cat-row').length;
    const row = document.createElement('div');
    row.className = 'cat-row';
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
      </select>
      <input type="number" step="0.01" placeholder="Monthly Rate" class="cat-rate">
    `;
    container.appendChild(row);
  };

  document.getElementById('btnAddCat').onclick = addCategoryField;
  addCategoryField(); // start with one row

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: document.getElementById('c_name').value.trim(),
      address_line1: document.getElementById('c_address_line1').value.trim() || null,
      address_line2: document.getElementById('c_address_line2').value.trim() || null,
      state: document.getElementById('c_state').value.trim() || null,
      district: document.getElementById('c_district').value.trim() || null,
      po_dated: document.getElementById('c_po_dated').value.trim() || null,
      telephone: document.getElementById('c_telephone').value.trim() || null,
      email: document.getElementById('c_email').value.trim() || null,
      cgst: parseFloat(document.getElementById('c_cgst').value || 0) || 0,
      sgst: parseFloat(document.getElementById('c_sgst').value || 0) || 0,
    };

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();

      // Create categories if any
      const rows = [...document.querySelectorAll('#categoriesContainer .cat-row')];
      for (const r of rows) {
        const category = r.querySelector('.cat-select').value;
        const monthly_rate = parseFloat(r.querySelector('.cat-rate').value || 0);
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
// Wrap/augment existing app renderers if present
const __origRenderTable = window.renderTable;
const __origFilterTable = window.filterTable;

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
          <th style="text-align:left;">Email</th>
          <th style="text-align:left;">CGST</th>
          <th style="text-align:left;">SGST</th>
          <th style="text-align:left;">Categories</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(c => `
          <tr>
            <td>${esc(c.id)}</td>
            <td>${esc(c.name)}</td>
            <td>${esc(c.address_line1 || '')}</td>
            <td>${esc(c.address_line2 || c.address_line1 || '')}</td>
            <td>${esc(c.po_dated || '')}</td>
            <td>${esc(c.state || '')}</td>
            <td>${esc(c.district || '')}</td>
            <td>${esc(c.telephone || '')}</td>
            <td>${esc(c.email || '')}</td>
            <td>${esc(c.cgst ?? '')}</td>
            <td>${esc(c.sgst ?? '')}</td>
            <td>${esc(c.categories || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

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
      String(c.email ?? ''),
      String(c.categories ?? '')
    ];
    if (exact) return hay.some(v => v === q || v.toLowerCase() === ql);
    return hay.some(v => v.toLowerCase().includes(ql));
  });
}

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

  const src = Array.isArray(data) ? data : (window.data_clients || []);
  const filtered = __filterClientsData(src, searchVal, exact);

  const slotId = 'table-clients';
  container.querySelector('#' + slotId)?.remove();
  const slot = document.createElement('div');
  slot.id = slotId;
  slot.innerHTML = __clientsTableHTML(filtered);
  container.appendChild(slot);
};

window.filterTable = function(table) {
  if (table !== 'clients') {
    return __origFilterTable && __origFilterTable(table);
  }
  const containerId = `table-container-${table}`;
  const data = window.data_clients || [];
  window.renderTable(containerId, table, data, '');
};
