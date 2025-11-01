// public/js/clients.js
// Updated to use the new Create Client form (id="clEditForm"),
// matching table fields and category form (id="catForm").
// Keeps loadClients export for other modules.

export const loadClients = async () => {
  const res = await fetch('/api/clients');
  return await res.json();
};

// small helper to escape HTML when injecting values into inputs
const escHtml = (s) => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

// ---------- CREATE CLIENT (uses clEditForm as requested) ----------
window.showClientForm = () => {
  const content = document.getElementById('content');
  // Clear or append as you prefer - here we replace content
  content.innerHTML = `
    <h3>Create Client</h3>
    <form id="clEditForm" style="display:grid;gap:10px;">
      <label>Name<br><input id="e_name" required></label>
      <label>Address Line 1 (Billed to)<br><input id="e_addr1"></label>
      <label>Address Line 2 (Shipped to)<br><input id="e_addr2"></label>
      <label>PO/dated<br><input id="e_po" placeholder="PGS/SECURITY/105 dated 30th October 2025"></label>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">State<br><input id="e_state"></label>
        <label style="flex:1">District<br><input id="e_district"></label>
      </div>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">Telephone<br><input id="e_tel"></label>
        <label style="flex:1">Email<br><input id="e_email" type="email"></label>
      </div>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">GST Number<br><input id="e_gst"></label>
        <label style="flex:1">IGST (%)<br><input id="e_igst" type="number" step="0.01"></label>
      </div>
      <div style="display:flex;gap:10px;">
        <label style="flex:1">CGST (%)<br><input id="e_cgst" type="number" step="0.01"></label>
        <label style="flex:1">SGST (%)<br><input id="e_sgst" type="number" step="0.01"></label>
      </div>

      <h4>Categories (optional)</h4>
      <div id="categoriesContainer"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button type="button" id="addCategoryBtn">Add Category</button>
        <button type="submit">Create Client</button>
      </div>
      <div id="cl_edit_msg" style="color:#b00;"></div>
    </form>
  `;

  // Add initial category field
  addCategoryField();

  document.getElementById('addCategoryBtn').onclick = () => addCategoryField();

  document.getElementById('clEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('e_name').value.trim(),
      address_line1: document.getElementById('e_addr1').value.trim(),
      address_line2: document.getElementById('e_addr2').value.trim(),
      po_dated: document.getElementById('e_po').value.trim(),
      state: document.getElementById('e_state').value.trim(),
      district: document.getElementById('e_district').value.trim(),
      telephone: document.getElementById('e_tel').value.trim(),
      email: document.getElementById('e_email').value.trim(),
      gst_number: document.getElementById('e_gst').value.trim(),
      igst: document.getElementById('e_igst').value === '' ? null : parseFloat(document.getElementById('e_igst').value),
      cgst: document.getElementById('e_cgst').value === '' ? null : parseFloat(document.getElementById('e_cgst').value),
      sgst: document.getElementById('e_sgst').value === '' ? null : parseFloat(document.getElementById('e_sgst').value)
    };

    // Collect categories
    const categories = [];
    const container = document.getElementById('categoriesContainer');
    const selects = container.querySelectorAll('select.cat_category');
    const rates = container.querySelectorAll('input.cat_rate');
    for (let i = 0; i < selects.length; i++) {
      const cat = selects[i].value;
      const rateVal = rates[i].value;
      const monthly_rate = rateVal === '' ? null : parseFloat(rateVal);
      if (cat) {
        categories.push({ category: cat, monthly_rate });
      }
    }

    // Create client
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' }));
        document.getElementById('cl_edit_msg').textContent = err.error || 'Create failed';
        return;
      }
      const created = await res.json();

      // Add categories (if any)
      let okAll = true;
      for (const cat of categories) {
        const r = await fetch(`/api/clients/${created.id}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cat)
        });
        if (!r.ok) {
          okAll = false;
          console.error('Category add failed for', cat, await r.text());
        }
      }

      alert(okAll ? 'Client and categories created' : 'Client created; some categories failed');
      if (window.showTable) window.showTable('clients');
    } catch (err) {
      console.error('create client error:', err);
      document.getElementById('cl_edit_msg').textContent = 'Unexpected error. See console.';
    }
  });
};

// ---------- Add Category Field helper used in create form ----------
window.addCategoryField = () => {
  const container = document.getElementById('categoriesContainer');
  const index = container.querySelectorAll('select.cat_category').length;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  wrapper.innerHTML = `
    <select class="cat_category" id="cat_category_${index}">
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
      <option value="cctv operator">CCTV Oprator</option>
      <option value="office boy">Office Boy</option>
      <option value="steward">Steward</option>
    </select>
    <input class="cat_rate" id="cat_rate_${index}" type="number" step="0.01" placeholder="Monthly Rate">
    <button type="button" class="removeCatBtn">Remove</button>
  `;
  container.appendChild(wrapper);
  wrapper.querySelector('.removeCatBtn').onclick = () => wrapper.remove();
};

// ---------- CATEGORY FORM (separate smaller form to add single category to existing client) ----------
window.showCategoryForm = (clientId) => {
  const content = document.getElementById('content');
  content.innerHTML = `
    <h3>Add Category to Client ID ${clientId}</h3>
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
          <option value="cctv operator">CCTV Oprator</option>
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

  document.getElementById('cat-cancel').onclick = () => {
    if (window.showTable) window.showTable('clients');
  };

  document.getElementById('catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('cat_category').value;
    const monthly_rate = document.getElementById('cat_rate').value === '' ? null : parseFloat(document.getElementById('cat_rate').value);
    try {
      const res = await fetch(`/api/clients/${clientId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, monthly_rate })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Add failed' }));
        document.getElementById('cat_msg').textContent = err.error || 'Add failed';
        return;
      }
      alert('Category added');
      if (window.showTable) window.showTable('clients');
    } catch (err) {
      console.error('add category error:', err);
      document.getElementById('cat_msg').textContent = 'Unexpected error. See console.';
    }
  });
};

// ---------- EDIT CLIENT MODAL (now matches new fields) ----------
window.openEditClient = async (id) => {
  try {
    const r = await fetch(`/api/clients/${id}`);
    if (!r.ok) throw new Error(await r.text());
    const client = await r.json();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;min-width:360px;max-width:720px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);max-height:90vh;overflow:auto';

    function inputVal(id, val) {
      return escHtml(val ?? '');
    }

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Client #${id}</h3>
        <button id="client-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="clientEditForm" style="display:grid;gap:10px;">
        <label>Name<br><input id="e_name_edit" value="${inputVal('e_name_edit', client.name)}" required></label>
        <label>Address Line 1 (Billed to)<br><input id="e_addr1_edit" value="${inputVal('e_addr1_edit', client.address_line1)}"></label>
        <label>Address Line 2 (Shipped to)<br><input id="e_addr2_edit" value="${inputVal('e_addr2_edit', client.address_line2)}"></label>
        <label>PO/dated<br><input id="e_po_edit" value="${inputVal('e_po_edit', client.po_dated)}"></label>
        <div style="display:flex;gap:10px;">
          <label style="flex:1">State<br><input id="e_state_edit" value="${inputVal('e_state_edit', client.state)}"></label>
          <label style="flex:1">District<br><input id="e_district_edit" value="${inputVal('e_district_edit', client.district)}"></label>
        </div>
        <div style="display:flex;gap:10px;">
          <label style="flex:1">Telephone<br><input id="e_tel_edit" value="${inputVal('e_tel_edit', client.telephone)}"></label>
          <label style="flex:1">Email<br><input id="e_email_edit" type="email" value="${inputVal('e_email_edit', client.email)}"></label>
        </div>
        <div style="display:flex;gap:10px;">
          <label style="flex:1">GST Number<br><input id="e_gst_edit" value="${inputVal('e_gst_edit', client.gst_number)}"></label>
          <label style="flex:1">IGST (%)<br><input id="e_igst_edit" type="number" step="0.01" value="${client.igst ?? ''}"></label>
        </div>
        <div style="display:flex;gap:10px;">
          <label style="flex:1">CGST (%)<br><input id="e_cgst_edit" type="number" step="0.01" value="${client.cgst ?? ''}"></label>
          <label style="flex:1">SGST (%)<br><input id="e_sgst_edit" type="number" step="0.01" value="${client.sgst ?? ''}"></label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
          <button type="button" id="client-edit-cancel">Cancel</button>
          <button type="submit">Save</button>
        </div>
        <div id="cl_edit_msg" style="color:#b00;"></div>
      </form>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('client-edit-close').onclick = close;
    document.getElementById('client-edit-cancel').onclick = close;

    document.getElementById('clientEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('e_name_edit').value.trim(),
        address_line1: document.getElementById('e_addr1_edit').value.trim(),
        address_line2: document.getElementById('e_addr2_edit').value.trim(),
        po_dated: document.getElementById('e_po_edit').value.trim(),
        state: document.getElementById('e_state_edit').value.trim(),
        district: document.getElementById('e_district_edit').value.trim(),
        telephone: document.getElementById('e_tel_edit').value.trim(),
        email: document.getElementById('e_email_edit').value.trim(),
        gst_number: document.getElementById('e_gst_edit').value.trim(),
        igst: document.getElementById('e_igst_edit').value === '' ? null : parseFloat(document.getElementById('e_igst_edit').value),
        cgst: document.getElementById('e_cgst_edit').value === '' ? null : parseFloat(document.getElementById('e_cgst_edit').value),
        sgst: document.getElementById('e_sgst_edit').value === '' ? null : parseFloat(document.getElementById('e_sgst_edit').value)
      };
      try {
        const u = await fetch(`/api/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!u.ok) {
          const err = await u.json().catch(() => ({ error: 'Update failed' }));
          document.getElementById('cl_edit_msg').textContent = err.error || 'Update failed';
          return;
        }
        alert('Client updated');
        close();
        if (window.showTable) window.showTable('clients');
      } catch (err) {
        console.error('client update error:', err);
        document.getElementById('cl_edit_msg').textContent = 'Unexpected error. See console.';
      }
    });
  } catch (e) {
    console.error('openEditClient error:', e);
    alert('Failed to open editor: ' + (e.message || 'Unknown'));
  }
};
