export const loadClients = async () => {
  const res = await fetch('/api/clients');
  return await res.json();
};

window.showClientForm = () => {
  const content = document.getElementById('content');
  content.innerHTML += `
    <h3>Create Client</h3>
    <form id="clientForm">
      <input type="text" placeholder="Name" id="name"><br>
      <input type="text" placeholder="Address" id="address"><br>
      <input type="text" placeholder="Telephone" id="telephone"><br>
      <input type="email" placeholder="Email" id="email"><br>
      <input type="number" step="0.01" placeholder="CGST" id="cgst"><br>
      <input type="number" step="0.01" placeholder="SGST" id="sgst"><br>
      <div id="categoriesContainer">
        <h4>Categories (optional)</h4>
      </div>
      <button type="button" onclick="addCategoryField()">Add Category</button><br>
      <button type="submit">Create Client</button>
    </form>
  `;
  // Add initial category field
  addCategoryField();

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const address = document.getElementById('address').value;
    const telephone = document.getElementById('telephone').value;
    const email = document.getElementById('email').value;
    const cgst = document.getElementById('cgst').value || 0;
    const sgst = document.getElementById('sgst').value || 0;

    // Collect categories
    const categories = [];
    const categorySelects = document.querySelectorAll('#categoriesContainer select');
    const rateInputs = document.querySelectorAll('#categoriesContainer input[type="number"]');
    for (let i = 0; i < categorySelects.length; i++) {
      const category = categorySelects[i].value;
      const monthly_rate = rateInputs[i].value;
      if (category && monthly_rate > 0) {
        categories.push({ category, monthly_rate });
      }
    }

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, telephone, email, cgst, sgst })
    });
    if (res.ok) {
      const data = await res.json();
      let success = true;
      for (const cat of categories) {
        const catRes = await fetch(`/api/clients/${data.id}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cat)
        });
        if (!catRes.ok) {
          success = false;
          console.error('Error adding category:', (await catRes.json()).error);
        }
      }
      if (success) {
        alert('Client and categories created');
      } else {
        alert('Client created, but some categories failed to add');
      }
    } else {
      alert((await res.json()).error);
    }
  });
};

window.addCategoryField = () => {
  const container = document.getElementById('categoriesContainer');
  const index = container.childElementCount / 2; // Approximate, since select + input per field
  container.innerHTML += `
    <select id="category_${index}">
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
    <input type="number" step="0.01" placeholder="Monthly Rate for Category" id="monthly_rate_${index}"><br>
  `;
};

window.showCategoryForm = (clientId) => {
  const content = document.getElementById('content');
  content.innerHTML += `
    <h3>Add Category to Client ID ${clientId}</h3>
    <form id="categoryForm">
      <select id="category">
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
      </select><br>
      <input type="number" step="0.01" placeholder="Monthly Rate" id="monthly_rate"><br>
      <button type="submit">Add</button>
    </form>
  `;
  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('category').value;
    const monthly_rate = document.getElementById('monthly_rate').value;
    const res = await fetch(`/api/clients/${clientId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, monthly_rate })
    });
    if (res.ok) alert('Category added');
    else alert((await res.json()).error);
  });
};

window.showClientForm = showClientForm;

// === EDIT CLIENT MODAL ===
window.openEditClient = async (id) => {
  try {
    const r = await fetch(`/api/clients/${id}`);
    if (!r.ok) throw new Error(await r.text());
    const c = await r.json();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;min-width:360px;max-width:640px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Client #${id}</h3>
        <button id="client-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="clientEditForm">
        <label>Name:<br><input type="text" id="cli_name" value="${c.name||''}" required></label><br><br>
        <label>Address:<br><input type="text" id="cli_address" value="${c.address||''}"></label><br><br>
        <label>Contact Person:<br><input type="text" id="cli_contact" value="${c.contact||''}"></label><br><br>
        <label>Telephone:<br><input type="text" id="cli_telephone" value="${c.telephone||''}"></label><br><br>
        <label>Email:<br><input type="email" id="cli_email" value="${c.email||''}"></label><br><br>
        <label>CGST (%):<br><input type="number" step="0.01" id="cli_cgst" value="${c.cgst ?? ''}"></label><br><br>
        <label>SGST (%):<br><input type="number" step="0.01" id="cli_sgst" value="${c.sgst ?? ''}"></label><br><br>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" id="client-edit-cancel">Cancel</button>
          <button type="submit">Save</button>
        </div>
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
        name: document.getElementById('cli_name').value.trim(),
        address: document.getElementById('cli_address').value.trim(),
        contact: document.getElementById('cli_contact').value.trim(),
        telephone: document.getElementById('cli_telephone').value.trim(),
        email: document.getElementById('cli_email').value.trim(),
        cgst: parseFloat(document.getElementById('cli_cgst').value || 0) || 0,
        sgst: parseFloat(document.getElementById('cli_sgst').value || 0) || 0,
      };
      try {
        const u = await fetch(`/api/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!u.ok) throw new Error(await u.text());
        alert('Client updated');
        close();
        if (window.showTable) window.showTable('clients');
      } catch (err) {
        console.error('client update error:', err);
        alert('Update failed: ' + (err.message || 'Unknown error'));
      }
    });
  } catch (e) {
    console.error('openEditClient error:', e);
    alert('Failed to open editor: ' + (e.message || 'Unknown'));
  }
};
