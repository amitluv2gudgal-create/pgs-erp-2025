// public/js/employees.js
const token = localStorage.getItem('token');
if (!token) {
  // optional: redirect to login
  // location.href = '/login.html';
}

const empForm = document.getElementById('empForm');
const employeesTableBody = document.querySelector('#employeesTable tbody');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');

<<<<<<< HEAD
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
=======
async function loadEmployees(){
  const r = await fetch('/api/employees', { headers: { Authorization: 'Bearer ' + token }});
  if (!r.ok) { console.error('Failed to load employees'); return; }
  const list = await r.json();
  employeesTableBody.innerHTML = '';
  for (const e of list){
    const tr = document.createElement('tr');
    const clientName = e.client ? e.client.name : '';
    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.name}</td>
      <td>${e.employeeId}</td>
      <td>${e.category}</td>
      <td>${clientName}</td>
      <td>${Number(e.salary_per_month||0).toFixed(2)}</td>
      <td>
        <button class="edit" data-id="${e.id}">Edit</button>
        <button class="del" data-id="${e.id}">Delete</button>
      </td>
>>>>>>> 5a9025979065b3577ed0d98e63f487a7f7a478ae
    `;
    employeesTableBody.appendChild(tr);
  }
}

empForm.addEventListener('submit', async (ev)=> {
  ev.preventDefault();
  const fd = new FormData(empForm);
  const payload = Object.fromEntries(fd.entries());
  // convert numeric fields
  if (payload.clientId) payload.clientId = parseInt(payload.clientId);
  if (payload.salary_per_month) payload.salary_per_month = parseFloat(payload.salary_per_month);

  const existingId = document.getElementById('empId').value;
  if (existingId) {
    // update
    const r = await fetch(`/api/employees/${existingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Update failed'); return; }
    alert('Employee updated');
  } else {
    // create
    const r = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Create failed'); return; }
    alert('Employee created');
  }
  empForm.reset(); document.getElementById('empId').value = '';
  saveBtn.textContent = 'Create Employee';
  loadEmployees();
});

employeesTableBody.addEventListener('click', async (ev) => {
  const target = ev.target;
  if (target.matches('.edit')) {
    const id = target.dataset.id;
    const r = await fetch(`/api/employees/${id}`, { headers: { Authorization: 'Bearer ' + token }});
    if (!r.ok) { alert('Failed to fetch'); return; }
    const e = await r.json();
    // load into form
    document.getElementById('empId').value = e.id;
    empForm.elements['name'].value = e.name || '';
    empForm.elements['employeeId'].value = e.employeeId || '';
    empForm.elements['father_name'].value = e.father_name || '';
    empForm.elements['local_address'].value = e.local_address || '';
    empForm.elements['permanent_address'].value = e.permanent_address || '';
    empForm.elements['telephone'].value = e.telephone || '';
    empForm.elements['email'].value = e.email || '';
    empForm.elements['marital_status'].value = e.marital_status || '';
    empForm.elements['spouse_name'].value = e.spouse_name || '';
    empForm.elements['next_kin_name'].value = e.next_kin_name || '';
    empForm.elements['next_kin_telephone'].value = e.next_kin_telephone || '';
    empForm.elements['next_kin_address'].value = e.next_kin_address || '';
    empForm.elements['identifier_name'].value = e.identifier_name || '';
    empForm.elements['identifier_address'].value = e.identifier_address || '';
    empForm.elements['identifier_telephone'].value = e.identifier_telephone || '';
    empForm.elements['epf_number'].value = e.epf_number || '';
    empForm.elements['esic_number'].value = e.esic_number || '';
    empForm.elements['criminal_record'].value = e.criminal_record || '';
    empForm.elements['salary_per_month'].value = e.salary_per_month || '';
    empForm.elements['category'].value = e.category || '';
    empForm.elements['clientId'].value = e.clientId || '';
    saveBtn.textContent = 'Update Employee';
    window.scrollTo(0,0);
  } else if (target.matches('.del')) {
    if (!confirm('Delete employee?')) return;
    const id = target.dataset.id;
    const r = await fetch(`/api/employees/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }});
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Delete failed'); return; }
    alert('Employee deleted');
    loadEmployees();
  }
});

resetBtn.addEventListener('click', ()=> {
  empForm.reset();
  document.getElementById('empId').value = '';
  saveBtn.textContent = 'Create Employee';
});

window.addEventListener('load', loadEmployees);
