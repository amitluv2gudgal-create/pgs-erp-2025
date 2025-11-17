// public/js/clients.js

// In public/js/clients.js (near top) — add these functions
import { STATE_NAMES, STATES } from './india_states.js';

// Populate state <select> with options
function populateStateSelect(selectEl, selectedState = '') {
  selectEl.innerHTML = '<option value="">Select State</option>';
  for (const st of STATE_NAMES) {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    if (st === selectedState) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// Populate district select based on a selected state
function populateDistrictSelect(stateName, districtSelectEl, selectedDistrict = '') {
  districtSelectEl.innerHTML = '<option value="">Select District</option>';
  if (!stateName || !STATES[stateName]) return;
  for (const d of STATES[stateName]) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (d === selectedDistrict) opt.selected = true;
    districtSelectEl.appendChild(opt);
  }
}

// Helper to wire two selects: stateSelectEl -> districtSelectEl
function wireStateDistrict(stateSelectEl, districtSelectEl) {
  populateStateSelect(stateSelectEl);
  stateSelectEl.addEventListener('change', (e) => {
    const st = e.target.value;
    populateDistrictSelect(st, districtSelectEl);
  });
}


// Fetch helper using global fetch wrapper (credentials included by default)
const fetchAuth = (url, opts = {}) => fetch(url, { credentials: 'include', ...opts });

// Load clients for data-driven pages or components
export const loadClients = async () => {
  try {
    const res = await fetchAuth('/api/clients');
    if (!res.ok) throw new Error('Failed to load clients: ' + res.status);
    return await res.json();
  } catch (e) {
    console.error('loadClients error', e);
    return [];
  }
};

// Render clients table (call this to show the clients table)
window.showTable = async (which) => {
  if (which !== 'clients') return;
  const content = document.getElementById('content');
  content.innerHTML = '<h3>Clients Table</h3><div id="clientsContainer">Loading...</div>';
  const clients = await loadClients();

  // Search / filter UI
  const searchHtml = `
    <div style="margin-bottom:8px;">
      <input id="clients_search" placeholder="Search by name/ID/month (e.g., John or 123 or 2025-09)" style="width:350px;padding:6px;margin-right:8px;">
      <button id="clients_search_btn">Search</button>
      <button id="clients_clear_btn">Clear</button>
    </div>
  `;
  document.getElementById('clientsContainer').innerHTML = searchHtml + `<div id="clients_table_wrap"></div>`;

  document.getElementById('clients_search_btn').onclick = () => renderClientsTable(clients);
  document.getElementById('clients_clear_btn').onclick = () => {
    document.getElementById('clients_search').value = '';
    renderClientsTable(clients);
  };

  renderClientsTable(clients);
};

function renderClientsTable(clients) {
  const q = (document.getElementById('clients_search')?.value || '').trim().toLowerCase();
  const container = document.getElementById('clients_table_wrap');
  const filtered = clients.filter(c => {
    if (!q) return true;
    // search by id, name or month/year snippet
    if (String(c.id).includes(q)) return true;
    if ((c.name || '').toLowerCase().includes(q)) return true;
    // month date in created_at or po_order
    if ((c.po_order || '').toLowerCase().includes(q)) return true;
    if ((c.created_at || '').toLowerCase().includes(q)) return true;
    return false;
  });

  if (!filtered.length) {
    container.innerHTML = '<div>No clients found.</div>';
    return;
  }

  let html = '<table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;"><thead><tr>';
  html += '<th>id</th>';
  html += '<th>name</th>';
  html += '<th>address (billed)</th>';
  html += '<th>address (shipped)</th>';
  html += '<th>contact person</th>';
  html += '<th>state</th>';
  html += '<th>district</th>';
  html += '<th>PO Order & Dated</th>';
  html += '<th>telephone</th>';
  html += '<th>email</th>';
  html += '<th>cgst</th>';
  html += '<th>sgst</th>';
  html += '<th>igst</th>';
  html += '<th>categories</th>';
  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  for (const c of filtered) {
    html += `<tr>
      <td>${c.id}</td>
      <td>${escapeHtml(c.name || '')}</td>
      <td>${escapeHtml(c.address_line1 || '')}</td>
      <td>${escapeHtml(c.address_line2 || '')}</td>
      <td>${escapeHtml(c.contact_person || '')}</td>
      <td>${escapeHtml(c.state || '')}</td>
      <td>${escapeHtml(c.district || '')}</td>
      <td>${escapeHtml(c.po_order || '')}</td>
      <td>${escapeHtml(c.telephone || '')}</td>
      <td>${escapeHtml(c.email || '')}</td>
      <td>${c.cgst ?? 0}</td>
      <td>${c.sgst ?? 0}</td>
      <td>${c.igst ?? 0}</td>
      <td>${escapeHtml(c.categories || 'No categories')}</td>
      <td>
        <button onclick="openEditClient(${c.id})">Edit</button>
        <button onclick="confirmDeleteClient(${c.id})">Delete</button>
        <button onclick="showCategoryForm(${c.id})">Add Category</button>
      </td>
    </tr>`;
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Create Client form
// Replace existing window.showClientForm with this floating modal version
window.showClientForm = () => {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.id = 'clientFormOverlay';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;width:760px;max-width:95%;padding:18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-height:90vh;overflow:auto;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="margin:0;">Create Client</h3>
      <button id="clientFormClose" style="font-size:22px;border:none;background:transparent;cursor:pointer">&times;</button>
    </div>

    <form id="clientFormModal" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="grid-column:1 / span 2;">
        <label>Name<br><input type="text" id="name" required style="width:100%;padding:6px"></label>
      </div>

      <div style="grid-column:1 / span 2;">
        <label>Address Line 1 (Billed to)<br><input type="text" id="address_line1" required style="width:100%;padding:6px"></label>
      </div>

      <div style="grid-column:1 / span 2;">
        <label>Address Line 2 (Shipped to)<br><input type="text" id="address_line2" style="width:100%;padding:6px"></label>
      </div>

      <label>Contact Person<br><input type="text" id="contact_person" style="width:100%;padding:6px"></label>
      
      <label>State<br>
  <select id="state" style="width:100%;padding:6px">
    <option value="">Loading...</option>
  </select>
</label>

<label>District<br>
  <select id="district" style="width:100%;padding:6px">
    <option value="">Select State first</option>
  </select>
</label>


      <label>PO Order & Dated<br><input type="text" id="po_order" placeholder="PO123 / 2025-10-10" style="width:100%;padding:6px"></label>

      <label>Telephone<br><input type="text" id="telephone" style="width:100%;padding:6px"></label>
      <label>Email<br><input type="email" id="email" style="width:100%;padding:6px"></label>

      <label>CGST (%)<br><input type="number" step="0.01" id="cgst" value="0" style="width:100%;padding:6px"></label>
      <label>SGST (%)<br><input type="number" step="0.01" id="sgst" value="0" style="width:100%;padding:6px"></label>

      <label>IGST (%)<br><input type="number" step="0.01" id="igst" value="0" style="width:100%;padding:6px"></label>

      <div id="categoriesContainerModal" style="grid-column:1 / span 2;margin-top:8px;">
        <h4 style="margin:6px 0 8px 0;">Categories (optional)</h4>
      </div>

      <div style="grid-column:1 / span 2;display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button type="button" id="addCategoryBtn">Add Category</button>
        <button type="button" id="cancelClientBtn">Cancel</button>
        <button type="submit" id="createClientBtn">Create Client</button>
      </div>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close handlers
  document.getElementById('clientFormClose').onclick = () => overlay.remove();
  document.getElementById('cancelClientBtn').onclick = () => overlay.remove();

  // Add first category field by default
  const addCategoryFieldModal = () => {
    // wire the state/district selects in the modal
const stateSelect = document.getElementById('state');
const districtSelect = document.getElementById('district');
wireStateDistrict(stateSelect, districtSelect);

    const container = document.getElementById('categoriesContainerModal');
    const idx = container.querySelectorAll('select').length;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <select id="category_${idx}" style="padding:6px;">
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
        <option value="cctv operator">CCTV Operator</option>
        <option value="steward">Steward</option>
        <option value="office boy">Office Boy</option>
      </select>
      <input type="number" step="0.01" id="monthly_rate_${idx}" placeholder="Monthly Rate" style="padding:6px;width:160px;">
      <button type="button" class="removeCatBtn" style="padding:6px;">Remove</button>
    `;
    container.appendChild(div);
    div.querySelector('.removeCatBtn').onclick = () => div.remove();
  };

  document.getElementById('addCategoryBtn').onclick = addCategoryFieldModal;
  addCategoryFieldModal();

  // Submit handler
  document.getElementById('clientFormModal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value.trim(),
      address_line1: document.getElementById('address_line1').value.trim(),
      address_line2: document.getElementById('address_line2').value.trim(),
      contact_person: document.getElementById('contact_person').value.trim(),
      state: document.getElementById('state').value.trim(),
      district: document.getElementById('district').value.trim(),
      po_order: document.getElementById('po_order').value.trim(),
      telephone: document.getElementById('telephone').value.trim(),
      email: document.getElementById('email').value.trim(),
      cgst: parseFloat(document.getElementById('cgst').value || 0) || 0,
      sgst: parseFloat(document.getElementById('sgst').value || 0) || 0,
      igst: parseFloat(document.getElementById('igst').value || 0) || 0
    };

    // collect categories
    const categories = [];
    const container = document.getElementById('categoriesContainerModal');
    const selects = container.querySelectorAll('select');
    const rates = container.querySelectorAll('input[type="number"]');
    for (let i = 0; i < selects.length; i++) {
      const category = selects[i].value;
      const monthly_rate = rates[i]?.value || 0;
      if (category && Number(monthly_rate) > 0) {
        categories.push({ category, monthly_rate: Number(monthly_rate) });
      }
    }

    try {
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();

      // add categories (if any)
      for (const cat of categories) {
        await fetch(`/api/clients/${data.id}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(cat)
        });
      }

      alert('Client created successfully');
      overlay.remove();
      if (window.showTable) window.showTable('clients');
    } catch (err) {
      console.error('Create client modal error:', err);
      alert('Failed to create client: ' + (err.message || err));
    }
  });
};

// ==========================================================
// Floating Modal — Edit Client (Admin Direct Edit Mode)
// ==========================================================
window.openEditClient = async (id) => {
  try {
    const res = await fetchAuth(`/api/clients/${id}/direct`);
    if (!res.ok) throw new Error(await res.text());
    const c = await res.json();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:9999;';
    
    const modal = document.createElement('div');
    modal.style.cssText =
      'background:#fff; width:780px; max-width:95%; padding:20px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.25); max-height:90vh; overflow-y:auto;';
    
    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0;">Edit Client #${id}</h3>
        <button id="editClientClose" style="font-size:26px; border:none; background:transparent; cursor:pointer">&times;</button>
      </div>

      <form id="editClientForm" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        
        <div style="grid-column:1 / span 2;">
          <label>Name<br>
            <input type="text" id="edit_name" value="${escapeHtml(c.name || '')}" required style="width:100%; padding:6px;">
          </label>
        </div>

        <div style="grid-column:1 / span 2;">
          <label>Address Line 1 (Billed)<br>
            <input type="text" id="edit_address1" value="${escapeHtml(c.address_line1 || '')}" style="width:100%; padding:6px;">
          </label>
        </div>

        <div style="grid-column:1 / span 2;">
          <label>Address Line 2 (Shipped)<br>
            <input type="text" id="edit_address2" value="${escapeHtml(c.address_line2 || '')}" style="width:100%; padding:6px;">
          </label>
        </div>

        <label>Contact Person<br>
          <input type="text" id="edit_contact" value="${escapeHtml(c.contact_person || '')}" style="width:100%; padding:6px;">
        </label>

        <label>State<br>
          <select id="edit_state" style="width:100%; padding:6px;">
            <option value="">Loading...</option>
          </select>
        </label>

        <label>District<br>
          <select id="edit_district" style="width:100%; padding:6px;">
            <option value="">Select State first</option>
          </select>
        </label>

        <label>PO Order & Dated<br>
          <input type="text" id="edit_po" value="${escapeHtml(c.po_order || '')}" style="width:100%; padding:6px;">
        </label>

        <label>Telephone<br>
          <input type="text" id="edit_telephone" value="${escapeHtml(c.telephone || '')}" style="width:100%; padding:6px;">
        </label>

        <label>Email<br>
          <input type="email" id="edit_email" value="${escapeHtml(c.email || '')}" style="width:100%; padding:6px;">
        </label>

        <label>CGST (%)<br>
          <input type="number" step="0.01" id="edit_cgst" value="${c.cgst ?? 0}" style="width:100%; padding:6px;">
        </label>

        <label>SGST (%)<br>
          <input type="number" step="0.01" id="edit_sgst" value="${c.sgst ?? 0}" style="width:100%; padding:6px;">
        </label>

        <label>IGST (%)<br>
          <input type="number" step="0.01" id="edit_igst" value="${c.igst ?? 0}" style="width:100%; padding:6px;">
        </label>

        <div style="grid-column:1 / span 2; display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
          <button type="button" id="edit_cancel_btn">Cancel</button>
          <button type="submit" style="background:#007bff; color:white; padding:6px 14px; border:none; border-radius:6px;">Save</button>
        </div>

      </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    document.getElementById('editClientClose').onclick = () => overlay.remove();
    document.getElementById('edit_cancel_btn').onclick = () => overlay.remove();

    // ----------------------------------------------
    // STATE & DISTRICT DROPDOWN INITIALIZATION
    // ----------------------------------------------
    const stSelect = document.getElementById('edit_state');
    const distSelect = document.getElementById('edit_district');

    wireStateDistrict(stSelect, distSelect);

    // Pre-select existing values
    if (c.state) {
      stSelect.value = c.state;
      populateDistrictSelect(c.state, distSelect, c.district);
    }

    // ----------------------------------------------
    // SUBMIT HANDLER (ADMIN DIRECT EDIT)
    // ----------------------------------------------
    document.getElementById('editClientForm').onsubmit = async (e) => {
      e.preventDefault();

      const payload = {
        name: document.getElementById('edit_name').value.trim(),
        address_line1: document.getElementById('edit_address1').value.trim(),
        address_line2: document.getElementById('edit_address2').value.trim(),
        contact_person: document.getElementById('edit_contact').value.trim(),
        state: document.getElementById('edit_state').value.trim(),
        district: document.getElementById('edit_district').value.trim(),
        po_order: document.getElementById('edit_po').value.trim(),
        telephone: document.getElementById('edit_telephone').value.trim(),
        email: document.getElementById('edit_email').value.trim(),
        cgst: parseFloat(document.getElementById('edit_cgst').value || 0),
        sgst: parseFloat(document.getElementById('edit_sgst').value || 0),
        igst: parseFloat(document.getElementById('edit_igst').value || 0)
      };

      try {
        const up = await fetchAuth(`/api/clients/${id}/direct`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!up.ok) throw new Error(await up.text());

        alert("Client updated successfully.");
        overlay.remove();
        if (window.showTable) window.showTable('clients');
      } catch (err) {
        alert("Update failed: " + err.message);
        console.error(err);
      }
    };
  }
  catch (err) {
    console.error("openEditClient error:", err);
    alert("Could not load client details.");
  }
};


// Minimal HTML escape helper
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
