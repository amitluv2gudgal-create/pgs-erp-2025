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
export const loadEmployees = async () => {
  try {
    const res = await fetch('/api/employees');
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error('loadEmployees error:', err);
    return [];
  }
};

// ===== floating modal Create Employee form with Upload Photo =====
async function showEmployeeForm() {
  // Hide other page sections (same behavior as before)
  document.querySelectorAll('[id^="table-container-"]').forEach(div => (div.style.display = 'none'));
  document.querySelectorAll('[id^="form-container-"]').forEach(div => (div.style.display = 'none'));

  // Create overlay + modal
  const overlay = document.createElement('div');
  overlay.id = 'employeeModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;width:880px;max-width:98%;padding:18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-height:92vh;overflow:auto;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0">Create Employee</h3>
      <button id="empModalClose" style="font-size:24px;border:none;background:transparent;cursor:pointer">&times;</button>
    </div>

    <form id="employeeFormModal" autocomplete="off" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      <label style="grid-column:1 / span 1">Name<br><input type="text" id="name" required style="width:100%;padding:8px"></label>
      <label style="grid-column:2 / span 1">Father's Name<br><input type="text" id="father_name" style="width:100%;padding:8px"></label>

      <label style="grid-column:1 / span 2">Local Address<br><input type="text" id="local_address" style="width:100%;padding:8px"></label>
      <label style="grid-column:1 / span 2">Permanent Address<br><input type="text" id="permanent_address" style="width:100%;padding:8px"></label>

      <label>Telephone<br><input type="text" id="telephone" style="width:100%;padding:8px"></label>
      <label>Email<br><input type="email" id="email" style="width:100%;padding:8px"></label>

      <label>Marital Status<br>
        <select id="marital_status" style="width:100%;padding:8px;">
          <option value="married">married</option>
          <option value="single">single</option>
        </select>
      </label>
      <label>Spouse Name<br><input type="text" id="spouse_name" style="width:100%;padding:8px"></label>

      <label>Next of Kin Name<br><input type="text" id="next_kin_name" style="width:100%;padding:8px"></label>
      <label>Next of Kin Telephone<br><input type="text" id="next_kin_telephone" style="width:100%;padding:8px"></label>

      <label style="grid-column:1 / span 2">Next of Kin Address<br><input type="text" id="next_kin_address" style="width:100%;padding:8px"></label>

      <label>Identifier Name<br><input type="text" id="identifier_name" style="width:100%;padding:8px"></label>
      <label>Identifier Address<br><input type="text" id="identifier_address" style="width:100%;padding:8px"></label>
      <label>Identifier Telephone<br><input type="text" id="identifier_telephone" style="width:100%;padding:8px"></label>
      <label>EPF Number<br><input type="text" id="epf_number" style="width:100%;padding:8px"></label>

      <label>ESIC Number<br><input type="text" id="esic_number" style="width:100%;padding:8px"></label>
      <label>Criminal Record (yes/no)<br><input type="text" id="criminal_record" style="width:100%;padding:8px"></label>

      <label>Salary per Month<br><input type="number" id="salary_per_month" min="0" step="1" style="width:100%;padding:8px"></label>
      <label>Category<br>
        <select id="category" style="width:100%;padding:8px;">
          <option value="security guard">security guard</option>
          <option value="lady searcher">lady searcher</option>
          <option value="security supervisor">security supervisor</option>
          <option value="assistant security officer">assistant security officer</option>
          <option value="security officer">security officer</option>
          <option value="unskilled workman">unskilled workman</option>
          <option value="skilled workman">skilled workman</option>
          <option value="work supervisor">work supervisor</option>
        </select>
      </label>

      <label>Client<br>
        <select id="client_id_modal" required style="width:100%;padding:8px;">
          <option>Loading clients...</option>
        </select>
      </label>

      <!-- Photo area -->
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:8px;border:1px dashed #ddd;border-radius:6px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" id="uploadPhotoBtn" style="padding:8px 12px;">Upload Photo</button>
          <button type="button" id="removePhotoBtn" style="padding:8px 12px;">Remove Photo</button>
        </div>
        <input type="file" id="employee_photo_input" accept="image/*" style="display:none;">
        <div id="photoPreviewContainer" style="width:120px;height:120px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;background:#fafafa;">
          <span style="color:#888;">No photo</span>
        </div>
        <small style="color:#666">Upload a clear photo (jpg/png). File size recommended &lt; 2MB.</small>
      </div>

      <!-- Buttons -->
      <div style="grid-column:1 / span 2;display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
        <button type="button" id="employeeResetBtnModal" style="padding:8px 12px;">Reset</button>
        <button type="button" id="employeeCancelBtnModal" style="padding:8px 12px;">Cancel</button>
        <button type="submit" id="employeeCreateBtnModal" style="background:#007bff;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer">Create</button>
      </div>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close / Cancel handlers
  document.getElementById('empModalClose').onclick = () => overlay.remove();
  document.getElementById('employeeCancelBtnModal').onclick = () => overlay.remove();

  // Wire Reset
  const formEl = document.getElementById('employeeFormModal');
  document.getElementById('employeeResetBtnModal').addEventListener('click', () => {
    formEl.reset();
    clearPhotoPreview();
    // reset client dropdown to first option if populated
    const clientSel = document.getElementById('client_id_modal');
    if (clientSel && clientSel.options.length) clientSel.selectedIndex = 0;
  });

  // Photo upload wiring
  const fileInput = document.getElementById('employee_photo_input');
  const uploadBtn = document.getElementById('uploadPhotoBtn');
  const removeBtn = document.getElementById('removePhotoBtn');
  const photoPreviewContainer = document.getElementById('photoPreviewContainer');
  let selectedPhotoFile = null;

  function clearPhotoPreview() {
    selectedPhotoFile = null;
    photoPreviewContainer.innerHTML = '<span style="color:#888;">No photo</span>';
    fileInput.value = '';
  }

  uploadBtn.onclick = () => fileInput.click();
  removeBtn.onclick = clearPhotoPreview;

  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return clearPhotoPreview();
    // basic file size check (optional)
    if (f.size > 5 * 1024 * 1024) { // 5MB safety limit
      alert('File too large. Please choose an image under 5 MB.');
      fileInput.value = '';
      return;
    }
    // preview
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement('img');
      img.src = reader.result;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'cover';
      photoPreviewContainer.innerHTML = '';
      photoPreviewContainer.appendChild(img);
    };
    reader.readAsDataURL(f);
    selectedPhotoFile = f;
  });

  // Populate client dropdown using your existing helper
  await populateClientDropdown('client_id_modal');

  // Submit handler: send multipart/form-data with photo (if selected)
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('employeeCreateBtnModal');
    submitBtn.disabled = true;

    try {
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
        client_id: parseInt(document.getElementById('client_id_modal').value, 10) || null
      };

      if (!data.name) {
        alert('Please enter employee name.');
        submitBtn.disabled = false;
        return;
      }
      if (!data.client_id) {
        alert('Please select a client.');
        submitBtn.disabled = false;
        return;
      }

      // Build FormData
      const formData = new FormData();
      Object.keys(data).forEach(k => {
        if (data[k] !== null && data[k] !== undefined) formData.append(k, String(data[k]));
      });
      if (selectedPhotoFile) formData.append('photo', selectedPhotoFile, selectedPhotoFile.name);

      // Send to server (multipart/form-data)
      const res = await fetch('/api/employees', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || 'Server error ' + res.status);
      }

      alert('Employee created successfully.');
      overlay.remove();

      // refresh employees list / table if functions exist
      if (typeof window.showTable === 'function') try { window.showTable('employees'); } catch(e){}
      if (typeof window.loadEmployees === 'function') try { window.loadEmployees(); } catch(e){}
    } catch (err) {
      console.error('Create employee failed:', err);
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