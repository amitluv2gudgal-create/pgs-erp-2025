// public/js/employees.js
// - loadEmployees(): fetch list for tables
// - window.showEmployeeForm(): render create form with Client dropdown and clear after submit
// Safe local helper to avoid name clash with clients.js
async function fetchClientsList() {
  try {
    const r = await fetch('/api/clients');
    if (!r.ok) throw new Error(await r.text());
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('fetchClientsList error:', e);
    return [];
  }
}


/** Fetch employees list (used by tables) */
// public/js/employees.js
export const loadEmployees = async () => {
  try {
    // include cookies so session on server authorizes the request
    const res = await fetch('/api/employees', { credentials: 'include' });
    if (!res.ok) {
      // If 401 — redirect to login
      if (res.status === 401 || res.status === 403) {
        console.warn('Not authenticated, redirecting to login');
        window.location.href = '/login.html';
        return [];
      }
      throw new Error(await res.text());
    }
    return await res.json();
  } catch (err) {
    console.error('loadEmployees error:', err);
    return [];
  }
};


/** Render Create Employee form (single visible form, with Client dropdown) */
async function showEmployeeForm() {
  // Hide any open table containers so only one section remains visible
  document.querySelectorAll('[id^="table-container-"]').forEach(div => (div.style.display = 'none'));

  // Hide any other forms that follow the same naming pattern
  document.querySelectorAll('[id^="form-container-"]').forEach(div => (div.style.display = 'none'));

  // Create or reuse our form container
  const containerId = 'form-container-employee';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.getElementById('content').appendChild(container);
  }
  container.style.display = 'block';

  // Build form UI (Client is dropdown now)
  container.innerHTML = `
    <h3>Create Employee</h3>
    <form id="employeeForm" autocomplete="off">
      <input type="text" placeholder="Name" id="name" required><br>
      <input type="text" placeholder="Father's Name" id="father_name"><br>
      <input type="text" placeholder="Local Address" id="local_address"><br>
      <input type="text" placeholder="Permanent Address" id="permanent_address"><br>
      <input type="text" placeholder="Telephone" id="telephone"><br>
      <input type="email" placeholder="Email" id="email"><br>

      <select id="marital_status">
        <option value="married">married</option>
        <option value="single">single</option>
      </select><br>

      <input type="text" placeholder="Spouse Name" id="spouse_name"><br>
      <input type="text" placeholder="Next of Kin Name" id="next_kin_name"><br>
      <input type="text" placeholder="Next of Kin Telephone" id="next_kin_telephone"><br>
      <input type="text" placeholder="Next of Kin Address" id="next_kin_address"><br>
      <input type="text" placeholder="Identifier Name" id="identifier_name"><br>
      <input type="text" placeholder="Identifier Address" id="identifier_address"><br>
      <input type="text" placeholder="Identifier Telephone" id="identifier_telephone"><br>
      <input type="text" placeholder="EPF Number" id="epf_number"><br>
      <input type="text" placeholder="ESIC Number" id="esic_number"><br>
      <input type="text" placeholder="Criminal Record (yes/no)" id="criminal_record"><br>
      <input type="number" placeholder="Salary per Month" id="salary_per_month" min="0" step="1"><br>

      <select id="category">
        <option value="security guard">security guard</option>
        <option value="lady searcher">lady searcher</option>
        <option value="security supervisor">security supervisor</option>
        <option value="assistant security officer">assistant security officer</option>
        <option value="security officer">security officer</option>
        <option value="unskilled workman">unskilled workman</option>
        <option value="skilled workman">skilled workman</option>
        <option value="work supervisor">work supervisor</option>
      </select><br>

      <!-- Client dropdown replaces plain number input -->
      <select id="client_id" required>
        <option value="">Loading clients...</option>
      </select><br>

      <div style="margin-top:8px;">
        <button type="submit" id="employeeCreateBtn">Create</button>
        <button type="button" id="employeeResetBtn">Reset</button>
      </div>
    </form>
  `;

  // Populate Client dropdown
  await populateClientDropdown('client_id');

  // Wire Reset button
  const formEl = document.getElementById('employeeForm');
  document.getElementById('employeeResetBtn').addEventListener('click', () => {
    formEl.reset();
    const clientSel = document.getElementById('client_id');
    if (clientSel && clientSel.options.length) clientSel.selectedIndex = 0;
  });

  // Submit handler: POST to /api/employees and clear on success
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('employeeCreateBtn');
    submitBtn.disabled = true;

    const data = {
      name: document.getElementById('name').value.trim(),
      father_name: document.getElementById('father_name').value.trim(),
      local_address: document.getElementById('local_address').value.trim(),
      permanent_address: document.getElementById('permanent_address').value.trim(),
      telephone: document.getElementById('telephone').value.trim(),
      email: document.getElementById('email').value.trim(),
      marital_status: document.getElementById('marital_status').value,
      spouse_name: document.getElementById('spouse_name').value.trim(),
      next_kin_name: document.getElementById('next_kin_name').value.trim(),
      next_kin_telephone: document.getElementById('next_kin_telephone').value.trim(),
      next_kin_address: document.getElementById('next_kin_address').value.trim(),
      identifier_name: document.getElementById('identifier_name').value.trim(),
      identifier_address: document.getElementById('identifier_address').value.trim(),
      identifier_telephone: document.getElementById('identifier_telephone').value.trim(),
      epf_number: document.getElementById('epf_number').value.trim(),
      esic_number: document.getElementById('esic_number').value.trim(),
      criminal_record: document.getElementById('criminal_record').value.trim(),
      salary_per_month: parseFloat(document.getElementById('salary_per_month').value || '0'),
      category: document.getElementById('category').value,
      client_id: parseInt(document.getElementById('client_id').value, 10)
    };

    if (!data.client_id) {
      alert('Please select a Client.');
      submitBtn.disabled = false;
      return;
    }

    try {

const response = await fetch('/api/employees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',         // <<< add this
  body: JSON.stringify(data)
});

      if (!response.ok) {
  const txt = await tryText(response);
  throw new Error(`Status ${response.status}: ${txt || response.statusText}`);
}


      alert('Employee created');
      // ✅ Clear the form after success
      formEl.reset();
      const clientSel = document.getElementById('client_id');
      if (clientSel && clientSel.options.length) clientSel.selectedIndex = 0;

      // (Optional) Immediately show Employees table:
      // if (typeof window.showTable === 'function') window.showTable('employees');
    } catch (err) {
      console.error('Employee create error:', err);
      alert('Failed to create employee: ' + (err.message || 'Unknown error'));
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/** Populate client dropdown with id + name */
async function populateClientDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    let clients = [];
    if (typeof loadClients === 'function') {
      clients = await loadClients();
    } else {
      const r = await fetch('/api/clients');
      clients = r.ok ? await r.json() : [];
    }

    if (!Array.isArray(clients) || clients.length === 0) {
      sel.innerHTML = '<option value="">No clients available</option>';
      return;
    }

    const options = ['<option value="">Select Client</option>']
      .concat(clients.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (ID: ${c.id})</option>`));
    sel.innerHTML = options.join('');
  } catch (e) {
    console.error('populateClientDropdown error:', e);
    sel.innerHTML = '<option value="">Failed to load clients</option>';
  }
}

async function tryText(res) {
  try { return await res.text(); } catch { return ''; }
}

function escapeHTML(s) {
  if (s == null) return '';
  return s.toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Expose form function to global (app.js calls window.showForm('employee'))
window.showEmployeeForm = showEmployeeForm;

// === EDIT EMPLOYEE MODAL ===
import { loadClients } from './clients.js';

window.openEditEmployee = async (id) => {
  try {
    const [rEmp, clients] = await Promise.all([
  fetch(`/api/employees/${id}`),
  fetchClientsList()
]);

    if (!rEmp.ok) throw new Error(await rEmp.text());
    const e = await rEmp.json();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;min-width:420px;max-width:900px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);max-height:90vh;overflow:auto';

    const cliOptions = Array.isArray(clients) ? clients.map(c =>
      `<option value="${c.id}" ${Number(c.id)===Number(e.client_id)?'selected':''}>${(c.name||'Client')} (ID: ${c.id})</option>`
    ).join('') : '';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Employee #${id}</h3>
        <button id="emp-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="empEditForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>Name:<br><input type="text" id="emp_name" value="${e.name||''}" required></label>
          <label>Father's Name:<br><input type="text" id="emp_father_name" value="${e.father_name||''}"></label>
          <label>Local Address:<br><input type="text" id="emp_local_address" value="${e.local_address||''}"></label>
          <label>Permanent Address:<br><input type="text" id="emp_permanent_address" value="${e.permanent_address||''}"></label>
          <label>Telephone:<br><input type="text" id="emp_telephone" value="${e.telephone||''}"></label>
          <label>Email:<br><input type="email" id="emp_email" value="${e.email||''}"></label>
          <label>Marital Status:<br><input type="text" id="emp_marital_status" value="${e.marital_status||''}"></label>
          <label>Spouse Name:<br><input type="text" id="emp_spouse_name" value="${e.spouse_name||''}"></label>
          <label>Next of Kin Name:<br><input type="text" id="emp_next_kin_name" value="${e.next_kin_name||''}"></label>
          <label>Next of Kin Telephone:<br><input type="text" id="emp_next_kin_telephone" value="${e.next_kin_telephone||''}"></label>
          <label>Next of Kin Address:<br><input type="text" id="emp_next_kin_address" value="${e.next_kin_address||''}"></label>
          <label>Identifier Name:<br><input type="text" id="emp_identifier_name" value="${e.identifier_name||''}"></label>
          <label>Identifier Address:<br><input type="text" id="emp_identifier_address" value="${e.identifier_address||''}"></label>
          <label>Identifier Telephone:<br><input type="text" id="emp_identifier_telephone" value="${e.identifier_telephone||''}"></label>
          <label>EPF Number:<br><input type="text" id="emp_epf_number" value="${e.epf_number||''}"></label>
          <label>ESIC Number:<br><input type="text" id="emp_esic_number" value="${e.esic_number||''}"></label>
          <label>Criminal Record:<br><input type="text" id="emp_criminal_record" value="${e.criminal_record||''}"></label>
          <label>Salary / Month:<br><input type="number" step="0.01" id="emp_salary_per_month" value="${e.salary_per_month ?? ''}"></label>
          <label>Category:<br><input type="text" id="emp_category" value="${e.category||''}"></label>
          <label>Client:<br>
            <select id="emp_client_id">
              <option value="">-- Select Client --</option>
              ${cliOptions}
            </select>
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <button type="button" id="emp-edit-cancel">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('emp-edit-close').onclick = close;
    document.getElementById('emp-edit-cancel').onclick = close;

    document.getElementById('empEditForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        name: document.getElementById('emp_name').value.trim(),
        father_name: document.getElementById('emp_father_name').value.trim(),
        local_address: document.getElementById('emp_local_address').value.trim(),
        permanent_address: document.getElementById('emp_permanent_address').value.trim(),
        telephone: document.getElementById('emp_telephone').value.trim(),
        email: document.getElementById('emp_email').value.trim(),
        marital_status: document.getElementById('emp_marital_status').value.trim(),
        spouse_name: document.getElementById('emp_spouse_name').value.trim(),
        next_kin_name: document.getElementById('emp_next_kin_name').value.trim(),
        next_kin_telephone: document.getElementById('emp_next_kin_telephone').value.trim(),
        next_kin_address: document.getElementById('emp_next_kin_address').value.trim(),
        identifier_name: document.getElementById('emp_identifier_name').value.trim(),
        identifier_address: document.getElementById('emp_identifier_address').value.trim(),
        identifier_telephone: document.getElementById('emp_identifier_telephone').value.trim(),
        epf_number: document.getElementById('emp_epf_number').value.trim(),
        esic_number: document.getElementById('emp_esic_number').value.trim(),
        criminal_record: document.getElementById('emp_criminal_record').value.trim(),
        salary_per_month: parseFloat(document.getElementById('emp_salary_per_month').value || 0) || 0,
        category: document.getElementById('emp_category').value.trim(),
        client_id: (document.getElementById('emp_client_id').value ? parseInt(document.getElementById('emp_client_id').value, 10) : null)
      };

      try {
        const u = await fetch(`/api/employees/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!u.ok) throw new Error(await u.text());
        alert('Employee updated');
        close();
        if (window.showTable) window.showTable('employees');
      } catch (err) {
        console.error('employee update error:', err);
        alert('Update failed: ' + (err.message || 'Unknown error'));
      }
    });
  } catch (e) {
    console.error('openEditEmployee error:', e);
    alert('Failed to open editor: ' + (e.message || 'Unknown'));
  }
};