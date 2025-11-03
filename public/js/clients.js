// public/js/clients.js
// Client form + table helper (minimal, focused on create + render)
// Assumes there is a container with id="clients-table" and a create form triggers showCreateClientForm()

// Utility
function el(id) { return document.getElementById(id); }
function sanitize(s) { return s == null ? '' : String(s); }

// Render clients table (data: array)
export async function renderClientsTable() {
  try {
    const res = await fetch('/api/clients');
    if (!res.ok) throw new Error('Failed to fetch clients');
    const clients = await res.json();

    const tableContainer = el('clients-table');
    if (!tableContainer) return console.warn('No #clients-table container found');

    // build simple table HTML (customize columns as needed)
    const headers = ['ID', 'Name', 'Address', 'Contact', 'Telephone', 'Email', 'CGST', 'SGST', 'IGST', 'GST Number', 'Actions'];
    const thead = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
    const rowsHtml = (clients || []).map(c => {
      const addr = sanitize(c.address_line1 || c.address || '');
      const addr2 = sanitize(c.address_line2 || '');
      const contact = sanitize(c.contact || '');
      return `<tr data-id="${c.id}">
        <td>${c.id}</td>
        <td>${sanitize(c.name)}</td>
        <td>${addr}${addr2? '<br>'+addr2:''}</td>
        <td>${contact}</td>
        <td>${sanitize(c.telephone)}</td>
        <td>${sanitize(c.email)}</td>
        <td>${c.cgst ?? ''}</td>
        <td>${c.sgst ?? ''}</td>
        <td>${c.igst ?? ''}</td>
        <td>${sanitize(c.gst_number)}</td>
        <td>
          <button onclick="openEditClient(${c.id})">Edit</button>
          <button onclick="deleteClient(${c.id})">Delete</button>
        </td>
      </tr>`; 
    }).join('');

    tableContainer.innerHTML = `<table class="table">${thead}<tbody>${rowsHtml}</tbody></table>`;
  } catch (err) {
    console.error('renderClientsTable error:', err);
  }
}

// Show Create Client form (you can integrate this into your UI modal)
export function showCreateClientForm() {
  const container = document.getElementById('create-client-form-container');
  if (!container) {
    console.warn('No #create-client-form-container. Injecting simple form into body.');
    const n = document.createElement('div');
    n.id = 'create-client-form-container';
    document.body.appendChild(n);
  }
  const html = `
    <form id="create-client-form">
      <label>Name<br><input id="c_name" required></label><br>
      <label>Address Line 1 (Billed to)<br><input id="c_address_line1"></label><br>
      <label>Address Line 2 (Shipped to)<br><input id="c_address_line2"></label><br>
      <label>PO/dated<br><input id="c_po_dated" placeholder="YYYY-MM-DD"></label><br>
      <label>State<br><input id="c_state"></label><br>
      <label>District<br><input id="c_district"></label><br>
      <label>Telephone<br><input id="c_telephone"></label><br>
      <label>Email<br><input id="c_email" type="email"></label><br>
      <label>GST Number<br><input id="c_gst_number"></label><br>
      <label>IGST (%)<br><input id="c_igst" type="number" step="0.01"></label><br>
      <label>CGST (%)<br><input id="c_cgst" type="number" step="0.01"></label><br>
      <label>SGST (%)<br><input id="c_sgst" type="number" step="0.01"></label><br>
      <label>Monthly Rate<br><input id="c_monthly_rate" type="number" step="0.01"></label><br>
      <div style="margin-top:8px;">
        <button type="submit">Create Client</button>
        <button type="button" id="create-cancel">Cancel</button>
      </div>
    </form>
  `;
  document.getElementById('create-client-form-container').innerHTML = html;

  const form = document.getElementById('create-client-form');
  document.getElementById('create-cancel').onclick = () => { document.getElementById('create-client-form-container').innerHTML = ''; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: sanitize(el('c_name').value).trim(),
      address_line1: sanitize(el('c_address_line1').value).trim(),
      address_line2: sanitize(el('c_address_line2').value).trim(),
      po_dated: sanitize(el('c_po_dated').value).trim(),
      state: sanitize(el('c_state').value).trim(),
      district: sanitize(el('c_district').value).trim(),
      telephone: sanitize(el('c_telephone').value).trim(),
      email: sanitize(el('c_email').value).trim(),
      gst_number: sanitize(el('c_gst_number').value).trim(),
      igst: parseFloat(el('c_igst').value || 0) || 0,
      cgst: parseFloat(el('c_cgst').value || 0) || 0,
      sgst: parseFloat(el('c_sgst').value || 0) || 0,
      monthly_rate: parseFloat(el('c_monthly_rate').value || 0) || 0
    };

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const created = await res.json();

      // If server returned created client with id, use it. Otherwise, fallback by re-fetching.
      let createdObj = created;
      if (!createdObj || !createdObj.id) {
        // try to find by unique fields
        const all = await fetch('/api/clients').then(r => r.json());
        const found = (all || []).filter(c =>
          (c.name || '').trim() === payload.name &&
          ((payload.telephone && ((c.telephone || '').trim() === payload.telephone)) || (payload.email && ((c.email || '').trim() === payload.email)))
        ).sort((a,b)=>b.id - a.id);
        if (found && found.length) createdObj = found[0];
      }

      if (!createdObj || !createdObj.id) {
        alert('Client created but server did not return id. Refresing clients list.');
        if (window.renderClientsTable) window.renderClientsTable();
      } else {
        // If your app needs to add categories immediately after create, use createdObj.id
        // e.g., POST /api/clients/{id}/categories ...
        if (window.renderClientsTable) window.renderClientsTable();
        alert('Client created: ID ' + createdObj.id);
        // clear form
        form.reset();
        document.getElementById('create-client-form-container').innerHTML = '';
      }
    } catch (err) {
      console.error('Create client failed:', err);
      alert('Failed to create client');
    }
  });
}

// delete client helper
export async function deleteClient(id) {
  if (!confirm('Delete client #' + id + '?')) return;
  try {
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    if (window.renderClientsTable) window.renderClientsTable();
  } catch (err) {
    console.error('deleteClient error:', err);
    alert('Delete failed');
  }
}

// placeholder edit (you likely have your own)
window.openEditClient = async function (id) {
  // You can reuse your existing edit modal; this is just a placeholder to trigger fetching the client
  try {
    const r = await fetch('/api/clients/' + id);
    if (!r.ok) throw new Error('Failed to load');
    const c = await r.json();
    // provide a simple prompt edit flow (replace with your modal)
    const newName = prompt('Edit name', c.name || '');
    if (newName == null) return;
    const payload = { ...c, name: newName };
    const u = await fetch('/api/clients/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!u.ok) throw new Error('Update failed');
    if (window.renderClientsTable) window.renderClientsTable();
  } catch (err) {
    console.error('openEditClient error:', err);
    alert('Edit failed');
  }
};

// auto-run table on load if container exists
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('clients-table')) renderClientsTable();
});
