// PGS-ERP/public/js/app.js
import { loadClients } from './clients.js';
import { loadEmployees } from './employees.js';
import { loadAttendances } from './attendances.js';
import { loadDeductions } from './deductions.js';
import { loadInvoices } from './invoices.js';
import { loadSalaries } from './salaries.js';
import { loadRequests } from './requests.js';

// ✅ FIX: spread opts correctly + always include cookies
const fetchAuth = (url, opts = {}) => fetch(url, { credentials: 'include', ...opts });

let user; // Declare user globally

if (!location.pathname.endsWith('/login.html') && !location.pathname.endsWith('/login')) {
  document.addEventListener('DOMContentLoaded', async () => {
    let res;
    try {
      res = await fetchAuth('/api/auth/current-user', { method: 'GET', headers: { 'Accept': 'application/json' } });
    } catch (err) {
      console.error('Network/CORS error while fetching current-user:', err);
      // Show a friendly error on screen instead of redirecting to avoid flashing
      const content = document.getElementById('content');
      if (content) content.innerHTML = '<p style="color:#b00">Network or CORS error contacting server. Check server logs.</p>';
      return;
    }

    // If not OK, do not immediately redirect — show a friendly message or bring user to login manually.
    if (!res.ok) {
      console.warn('Not authenticated or server returned non-200 for current-user:', res.status);
      // The server should return JSON 401. We simply show login button suggestion to the user.
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = `<p>You are not logged in. <a href="/login.html">Go to login</a></p>`;
      } else {
        // fallback: navigate to login only if user explicitly clicks or uses link
      }
      return;
    }

    // content-type guard: ensure server returned JSON
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      console.error('Expected JSON for current-user but got:', ct);
      const content = document.getElementById('content');
      if (content) content.innerHTML = '<p style="color:#b00">Server returned unexpected content for authentication. Check server-side API.</p>';
      return;
    }

    user = await res.json();
    if (!user || typeof user.role === 'undefined') {
      console.error('User data is invalid or missing role:', user);
      document.getElementById('content').innerHTML = `<p style="color:#b00">Invalid user data. <a href="/login.html">Login</a></p>`;
      return;
    }

  const content = document.getElementById('content');
  content.innerHTML = `<h2>Welcome, ${user.role}</h2>`;

  if (user.role !== 'security_supervisor') {
    content.innerHTML += '<button onclick="showTable(\'clients\')">View Clients</button>';
    content.innerHTML += '<button onclick="showTable(\'employees\')">View Employees</button>';
    content.innerHTML += '<button onclick="showTable(\'attendances\')">View Attendances</button>';
    content.innerHTML += '<button onclick="showTable(\'deductions\')">View Deductions</button>';
    content.innerHTML += '<button onclick="showTable(\'invoices\')">View Invoices</button>';
    content.innerHTML += '<button onclick="showTable(\'salaries\')">View Salaries</button>';
    content.innerHTML += '<button onclick="showUnifiedSearch()">Search Profile</button>';
  }
  window.showUnifiedSearch = showUnifiedSearch;


  if (user.role === 'accountant') {
    content.innerHTML += '<h3>Accountant Actions</h3>';
    content.innerHTML += '<button onclick="showForm(\'client\')">Create Client</button>';
    content.innerHTML += '<button onclick="showForm(\'deduction\')">Create Deduction</button>';
    content.innerHTML += '<button onclick="showForm(\'invoice\')">Generate Invoice</button>';
    content.innerHTML += '<button onclick="showForm(\'salary\')">Generate Salary</button>';
  } else if (user.role === 'hr') {
    content.innerHTML += '<h3>HR Actions</h3>';
    content.innerHTML += '<button onclick="showForm(\'employee\')">Create Employee</button>';
    content.innerHTML += '<button onclick="showForm(\'attendance\')">Create Attendance</button>';
  } else if (user.role === 'admin') {
    content.innerHTML += '<h3>Admin Actions</h3>';
    content.innerHTML += '<button onclick="showPendingRequests()">View Pending Requests</button>';
    content.innerHTML += '<button onclick="showSupervisorForm()">Create Security Supervisor</button>';
    content.innerHTML += '<button onclick="showTable(\'security_supervisors\')">View Security Supervisors</button>';
    const adminSection = document.getElementById('adminSection');
    if (adminSection) adminSection.style.display = 'block';
  } else if (user.role === 'security_supervisor') {
    content.innerHTML += '<button onclick="showAttendanceFormForSupervisor()">Submit Attendance</button>';
  }

  if (['admin', 'accountant', 'hr'].includes(user.role)) {
    content.innerHTML += '<button onclick="showChangePassword()">Change Password</button>';
  }

  if (user.role === 'admin') {
    if (!document.getElementById('btnAdminResetAny')) {
      const btn = document.createElement('button');
      btn.id = 'btnAdminResetAny';
      btn.textContent = 'Reset Any Password (Admin)';
      btn.onclick = showAdminResetAnyPassword;
      content.appendChild(btn);
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { credentials: 'include' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.href = '/login.html';
  });
});

window.showForm = (type) => {
  if (type === 'client') window.showClientForm && window.showClientForm();
  else if (type === 'employee') window.showEmployeeForm && window.showEmployeeForm();
  else if (type === 'attendance') window.showAttendanceForm && window.showAttendanceForm();
  else if (type === 'deduction') showDeductionForm();
  else if (type === 'invoice') window.showInvoiceForm && window.showInvoiceForm();
  else if (type === 'salary') window.showSalaryForm && window.showSalaryForm();
};

window.showTable = async (table) => {
  let data;
  if (table === 'clients') data = await loadClients();
  else if (table === 'employees') data = await loadEmployees();
  else if (table === 'attendances') data = await loadAttendances();
  else if (table === 'deductions') data = await loadDeductions();
  else if (table === 'invoices') data = await loadInvoices();
  else if (table === 'salaries') data = await loadSalaries();
  else if (table === 'security_supervisors') {
    const res = await fetch('/api/security-supervisors', { credentials: 'include' });
    data = res.ok ? await res.json() : [];
    if (!res.ok) console.error('Fetch error for supervisors:', await res.text());
  }

  data = Array.isArray(data) ? data : [];
  window['data_' + table] = data;

  document.querySelectorAll('[id^="table-container-"]').forEach(div => {
    div.style.display = 'none';
  });

  const containerId = `table-container-${table}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.getElementById('content').appendChild(container);
  }
  container.style.display = 'block';
  container.innerHTML = `
    <h3>${table.charAt(0).toUpperCase() + table.slice(1)} Table</h3>
    <input type="text" id="search-${table}" placeholder="Search by name/ID, month, date (e.g., 'John' or '123' or '2025-09')" oninput="filterTable('${table}')">
    <label><input type="checkbox" id="exact-${table}" onchange="toggleExactMatch('${table}')"> Exact Match</label>
    <button onclick="clearSearch('${table}')">Clear</button>
    <div id="table-${table}"></div>
  `;

  window[`exact_${table}`] = false;
  window.renderTable(containerId, table, data, '');
};

window.showSupervisorForm = async () => {
  const uniqueId = Date.now(); // Unique identifier to avoid duplicates
  if (document.getElementById('supervisor-modal-' + uniqueId)) return;
  const overlay = document.createElement('div');
  overlay.id = 'supervisor-modal-' + uniqueId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:center;justify-content:center';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:320px;max-width:520px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3>Create Security Supervisor</h3><button id="supervisor-close-${uniqueId}" title="Close">&times;</button>
    </div>
    <form id="supervisorForm-${uniqueId}">
      <label>Supervisor Name:<input type="text" id="supervisorName-${uniqueId}" required></label><br>
      <label>Username:<input type="text" id="supervisorUsername-${uniqueId}" required></label><br>
      <label>Password (optional, auto-generated if blank):<input type="text" id="supervisorPassword-${uniqueId}"></label><br>
      <label>Client:<select id="supervisorClientId-${uniqueId}" required></select></label><br>
      <label>Site Name:<input type="text" id="supervisorSite-${uniqueId}" required></label><br>
      <button type="submit">Create</button>
    </form>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById(`supervisor-close-${uniqueId}`).onclick = () => overlay.remove();

  const clients = await loadClients();
  const clientSelect = document.getElementById(`supervisorClientId-${uniqueId}`);
  clientSelect.innerHTML = '<option value="">Select Client</option>';
  if (clients.length === 0) {
    clientSelect.innerHTML = '<option value="">No clients available</option>';
    console.warn('No clients found to populate dropdown');
  } else {
    clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = `${client.name} (ID: ${client.id})`;
      clientSelect.appendChild(option);
    });
  }

  document.getElementById(`supervisorForm-${uniqueId}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById(`supervisorName-${uniqueId}`).value;
    const username = document.getElementById(`supervisorUsername-${uniqueId}`).value;
    const password = document.getElementById(`supervisorPassword-${uniqueId}`).value;
    const client_id = document.getElementById(`supervisorClientId-${uniqueId}`).value;
    const site_name = document.getElementById(`supervisorSite-${uniqueId}`).value;
    if (!client_id) {
      alert('Please select a client');
      return;
    }
    const response = await fetchAuth('/api/security-supervisors/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, username, password, client_id, site_name })
    });
    if (response.ok) {
      const data = await response.json();
      alert(`Supervisor created successfully with ID: ${data.id}`);
      showTable('security_supervisors');
    } else {
      const error = await response.json();
      alert(`Failed to create supervisor: ${error.error || 'Unknown error'}`);
    }
    overlay.remove();
  });
};

window.showAttendanceFormForSupervisor = async () => {
  if (document.getElementById('attendance-modal')) return;

  // Fetch lists (reuse shared loaders if available)
  const [employees, clients] = await Promise.all([
    (typeof loadEmployees === 'function' ? loadEmployees() : fetch('/api/employees').then(r => r.json()).catch(() => [])),
    (typeof loadClients === 'function' ? loadClients() : fetch('/api/clients').then(r => r.json()).catch(() => [])),
  ]);

  const employeesById = {};
  if (Array.isArray(employees)) {
    employees.forEach(e => { if (e && e.id != null) employeesById[e.id] = e; });
  }

  const overlay = document.createElement('div');
  overlay.id = 'attendance-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:center;justify-content:center';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:320px;max-width:560px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

  const empOptions = Array.isArray(employees) && employees.length
    ? ['<option value="">Select Employee</option>'].concat(
        employees.map(e => `<option value="${e.id}">${escapeHtml(e.name || ('Employee ' + e.id))} (ID: ${e.id})</option>`)
      ).join('')
    : '<option value="">No employees available</option>';

  const cliOptions = Array.isArray(clients) && clients.length
    ? ['<option value="">Select Client</option>'].concat(
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.name || ('Client ' + c.id))} (ID: ${c.id})</option>`)
      ).join('')
    : '<option value="">No clients available</option>';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Submit Attendance</h3>
      <button id="attendance-close" title="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="attendanceFormSup">
      <label>Employee (required):<br>
        <select id="sup_employee_id" required>${empOptions}</select>
      </label><br><br>

      <label>Client (required):<br>
        <select id="sup_client_id" required>${cliOptions}</select>
      </label><br><br>

      <label>Date (required):<br>
        <input type="date" id="sup_date" required>
      </label><br><br>

      <label>Attendance (required):<br>
        <select id="sup_present" required>
          <option value="1">Present (1)</option>
          <option value="2">Weekly Off / Holiday Duty (2)</option>
          <option value="0">Absent (0)</option>
        </select>
      </label><br><br>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button type="button" id="attendance-cancel">Cancel</button>
        <button type="submit">Submit</button>
      </div>
    </form>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  const close = () => overlay.remove();
  document.getElementById('attendance-close').onclick = close;
  document.getElementById('attendance-cancel').onclick = close;

  // Auto-select client when employee changes (if employee has client_id)
  const empSel = document.getElementById('sup_employee_id');
  const cliSel = document.getElementById('sup_client_id');
  empSel.addEventListener('change', () => {
    const eid = parseInt(empSel.value, 10);
    const emp = employeesById[eid];
    if (emp && emp.client_id && Array.isArray(clients)) {
      const idx = Array.prototype.findIndex.call(cliSel.options, o => Number(o.value) === Number(emp.client_id));
      if (idx >= 0) cliSel.selectedIndex = idx;
    }
  });

  // Submit
  document.getElementById('attendanceFormSup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = parseInt(empSel.value, 10);
    const client_id = parseInt(cliSel.value, 10);
    const date = document.getElementById('sup_date').value;
    const present = parseInt(document.getElementById('sup_present').value, 10); // 0/1/2

    if (!Number.isInteger(employee_id) || employee_id <= 0) return alert('Please select an Employee');
    if (!Number.isInteger(client_id) || client_id <= 0) return alert('Please select a Client');
    if (!date) return alert('Date is required');
    if (![0,1,2].includes(present)) return alert('Attendance must be 0, 1, or 2');

    try {
      console.log('[SUP FORM] payload:', { employee_id, client_id, date, present });
      const response = await fetchAuth('/api/attendances/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id, client_id, date, present })
      });
      if (!response.ok) {
        let msg = '';
        try { msg = (await response.json()).error; } catch { msg = await response.text(); }
        throw new Error(msg || 'Failed to submit');
      }
      alert('Attendance submitted for HR verification');
      close();
      // IMPORTANT: do NOT open attendance table for supervisors
      return;
    } catch (err) {
      console.error('Supervisor attendance submit error:', err);
      alert('Error: ' + (err.message || 'Unknown error'));
    }
  });
};

// Renders tables with role-based actions
window.renderTable = (containerId, table, data, searchTerm) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tableDiv = document.getElementById(`table-${table}`);
  if (!tableDiv) return;

  let html = '<table border="1"><tr>';

  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => html += `<th>${key}</th>`);

    // Add Actions column:
    if (table === 'attendances' && user?.role === 'hr') {
      html += '<th>Actions</th>';
    } else if (table === 'security_supervisors' && user?.role === 'admin') {
      html += '<th>Actions</th>';
    } else if (['accountant', 'hr'].includes(user?.role) && table !== 'attendances') {
      html += '<th>Actions</th>';
    }
  }
  html += '</tr>';

  if (data.length > 0) {
    data.forEach(row => {
      let matchStyle = '';
      let rowMatches = false;
      if (searchTerm) {
        const exactMode = window[`exact_${table}`] || false;
        for (let key in row) {
          let val = row[key];
          if (val !== null && val !== undefined) {
            let valStr = typeof val === 'object' ? JSON.stringify(val).toLowerCase() : val.toString().toLowerCase();
            rowMatches = exactMode ? (valStr === searchTerm) : valStr.includes(searchTerm);
            if (rowMatches) break;
          }
        }
        if (rowMatches) matchStyle = ' style="background-color: yellow;"';
      }

      html += `<tr${matchStyle}>`;
      Object.values(row).forEach(val => {
        const displayVal = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : (val ?? '');
        let cellStyle = '';
        if (searchTerm) {
          const exactMode = window[`exact_${table}`] || false;
          const valStr = displayVal.toString().toLowerCase();
          const cellMatches = exactMode ? (valStr === searchTerm) : valStr.includes(searchTerm);
          if (cellMatches) cellStyle = ' style="background-color: lightyellow; font-weight: bold;"';
        }
        html += `<td${cellStyle}>${displayVal}</td>`;
      });

      // Actions cell
      if (table === 'attendances' && user?.role === 'hr') {
        const approveReject = (row.status === 'pending')
          ? `<button onclick="approveAttendance(${row.id})">Approve</button>
             <button onclick="rejectAttendance(${row.id})">Reject</button>`
          : '';
        const editDelete = `
          <button onclick="editAttendance(${row.id})">Edit</button>
          <button onclick="deleteAttendance(${row.id})">Delete</button>`;
        html += `<td style="white-space:nowrap;">${approveReject} ${editDelete}</td>`;
      } else if (table === 'security_supervisors' && user?.role === 'admin') {
        // UPDATED: Added Reset Password button
        html += `<td>
          <button onclick="editSupervisor(${row.id}, '${row.name}', '${row.username}', ${row.client_id}, '${row.site_name}')">Edit</button>
          <button onclick="deleteSupervisor(${row.id})">Delete</button>
          <button onclick="resetSupervisorPassword(${row.id}, '${row.username}')">Reset Password</button>
        </td>`;
      } else if (['accountant', 'hr', 'admin'].includes(user?.role) && table !== 'attendances') {
  let actions = '';
  if (table === 'clients') {
    actions = `
      <button onclick="openEditClient(${row.id})">Edit</button>
      <button onclick="requestDelete('${table}', ${row.id})">Delete</button>
      ${user.role === 'accountant' ? `<button onclick="showCategoryForm(${row.id})">Add Category</button>` : ''}
    `;
  } else if (table === 'employees') {
    actions = `
      <button onclick="openEditEmployee(${row.id})">Edit</button>
      <button onclick="requestDelete('${table}', ${row.id})">Delete</button>
    `;
  } else if (table === 'deductions') {
    actions = `
      <button onclick="openEditDeduction(${row.id})">Edit</button>
      <button onclick="requestDelete('${table}', ${row.id})">Delete</button>
    `;
  } else if (table === 'invoices') {
    actions = `
      <button onclick="openEditInvoice(${row.id})">Edit</button>
      <button onclick="requestDelete('${table}', ${row.id})">Delete</button>
    `;
  } else if (table === 'salaries') {
    actions = `
      <button onclick="openEditSalary(${row.id})">Edit</button>
      <button onclick="requestDelete('${table}', ${row.id})">Delete</button>
    `;
  } else if (table === 'security_supervisors' && user?.role === 'admin') {
    // already handled above with edit/delete/reset
  } else {
    // fallback to old approval flow if a table isn’t wired yet
    actions = `<button onclick="requestEdit('${table}', ${row.id})">Edit</button>
               <button onclick="requestDelete('${table}', ${row.id})">Delete</button>`;
  }
  html += `<td>${actions}</td>`;
}

      html += '</tr>';
    });
  } else {
    const numCols =
      (data.length > 0 ? Object.keys(data[0]).length : 1) +
      ((table === 'attendances' && user?.role === 'hr') ||
       (table === 'security_supervisors' && user?.role === 'admin') ||
       (['accountant','hr'].includes(user?.role) && table !== 'attendances')
        ? 1 : 0);
    html += `<tr><td colspan="${numCols}">No data found</td></tr>`;
  }

  html += '</table>';
  tableDiv.innerHTML = html;
};


// === Add these helpers anywhere after renderTable ===
window.approveAttendance = async (id) => {
  try {
    const r = await fetchAuth(`/api/attendances/${id}/approve`, { method: 'POST' });
    if (!r.ok) throw new Error(await r.text());
    alert('Attendance verified');
    if (window.showTable) window.showTable('attendances');
  } catch (e) {
    console.error('approveAttendance error:', e);
    alert('Failed to approve: ' + (e.message || 'Unknown'));
  }
};

window.rejectAttendance = async (id) => {
  try {
    const r = await fetchAuth(`/api/attendances/${id}/reject`, { method: 'POST' });
    if (!r.ok) throw new Error(await r.text());
    alert('Attendance rejected');
    if (window.showTable) window.showTable('attendances');
  } catch (e) {
    console.error('rejectAttendance error:', e);
    alert('Failed to reject: ' + (e.message || 'Unknown'));
  }
};

// Open an edit modal for an attendance (HR only)
window.editAttendance = async (id) => {
  try {
    // Fetch the row (server-side truth)
    const r = await fetchAuth(`/api/attendances/${id}`, { credentials: 'include' });
    if (!r.ok) throw new Error(await r.text());
    const row = await r.json();

    // Fetch employees & clients for dropdowns
    const [employees, clients] = await Promise.all([
      (typeof loadEmployees === 'function' ? loadEmployees() : fetch('/api/employees').then(x=>x.json())),
      (typeof loadClients === 'function' ? loadClients() : fetch('/api/clients').then(x=>x.json())),
    ]);

    // Build modal
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:center;justify-content:center';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;min-width:340px;max-width:600px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

    const empOptions = Array.isArray(employees) ? employees.map(e =>
      `<option value="${e.id}" ${e.id===row.employee_id?'selected':''}>${(e.name||`ID ${e.id}`)} (ID: ${e.id})</option>`
    ).join('') : '';

    const cliOptions = Array.isArray(clients) ? clients.map(c =>
      `<option value="${c.id}" ${c.id===row.client_id?'selected':''}>${(c.name||`Client ${c.id}`)} (ID: ${c.id})</option>`
    ).join('') : '';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Attendance #${id}</h3>
        <button id="att-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="attEditForm">
        <label>Employee:<br>
          <select id="att_employee_id" required>${empOptions}</select>
        </label><br><br>
        <label>Client:<br>
          <select id="att_client_id" required>${cliOptions}</select>
        </label><br><br>
        <label>Date:<br>
          <input type="date" id="att_date" value="${String(row.date).slice(0,10)}" required>
        </label><br><br>
        <label>Attendance:<br>
          <select id="att_present" required>
            <option value="1" ${Number(row.present)===1?'selected':''}>Present (1)</option>
            <option value="2" ${Number(row.present)===2?'selected':''}>Weekly Off / Holiday Duty (2)</option>
            <option value="0" ${Number(row.present)===0?'selected':''}>Absent (0)</option>
          </select>
        </label><br><br>
        <label>Status (read-only):<br>
          <input type="text" id="att_status" value="${row.status || ''}" readonly>
        </label><br><br>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" id="att-edit-cancel">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('att-edit-close').onclick = close;
    document.getElementById('att-edit-cancel').onclick = close;

    document.getElementById('attEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        employee_id: parseInt(document.getElementById('att_employee_id').value, 10),
        client_id: parseInt(document.getElementById('att_client_id').value, 10),
        date: document.getElementById('att_date').value,
        present: parseInt(document.getElementById('att_present').value, 10)
        // status left unchanged here; use Approve/Reject buttons for that flow
      };
      try {
        const u = await fetchAuth(`/api/attendances/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!u.ok) throw new Error(await u.text());
        close();
        alert('Attendance updated');
        if (window.showTable) window.showTable('attendances');
      } catch (err) {
        console.error('editAttendance error:', err);
        alert('Update failed: ' + (err.message || 'Unknown error'));
      }
    });
  } catch (e) {
    console.error('editAttendance init error:', e);
    alert('Failed to open editor');
  }
};

// Delete an attendance (HR only)
window.deleteAttendance = async (id) => {
  if (!confirm(`Delete attendance #${id}? This cannot be undone.`)) return;
  try {
    const r = await fetchAuth(`/api/attendances/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error(await r.text());
    alert('Deleted');
    if (window.showTable) window.showTable('attendances');
  } catch (e) {
    console.error('deleteAttendance error:', e);
    alert('Delete failed: ' + (e.message || 'Unknown error'));
  }
};

// Keep existing approve/reject helpers (ensure credentials included)
window.approveAttendance = async (id) => {
  try {
    const r = await fetchAuth(`/api/attendances/${id}/approve`, { method: 'POST', credentials: 'include' });
    if (!r.ok) throw new Error(await r.text());
    alert('Attendance verified');
    if (window.showTable) window.showTable('attendances');
  } catch (e) {
    console.error('approveAttendance error:', e);
    alert('Failed to approve: ' + (e.message || 'Unknown'));
  }
};

window.rejectAttendance = async (id) => {
  try {
    const r = await fetchAuth(`/api/attendances/${id}/reject`, { method: 'POST', credentials: 'include' });
    if (!r.ok) throw new Error(await r.text());
    alert('Attendance rejected');
    if (window.showTable) window.showTable('attendances');
  } catch (e) {
    console.error('rejectAttendance error:', e);
    alert('Failed to reject: ' + (e.message || 'Unknown'));
  }
};

window.filterTable = (table) => {
  const searchInput = document.getElementById(`search-${table}`);
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase().trim();

  let fullData = window[`data_${table}`] || [];

  let filteredData;
  if (!searchTerm) {
    filteredData = fullData;
  } else {
    const exactMode = window[`exact_${table}`] || false;
    filteredData = fullData.filter(row => {
      for (let key in row) {
        let val = row[key];
        if (val !== null && val !== undefined) {
          let valStr = typeof val === 'object' ? JSON.stringify(val).toLowerCase() : val.toString().toLowerCase();
          if (exactMode) {
            if (valStr === searchTerm) return true;
          } else {
            if (valStr.includes(searchTerm)) return true;
          }
        }
      }
      return false;
    });
  }

  const containerId = `table-container-${table}`;
  window.renderTable(containerId, table, filteredData, searchTerm);
};

window.toggleExactMatch = (table) => {
  const exactCheckbox = document.getElementById(`exact-${table}`);
  if (exactCheckbox) {
    window[`exact_${table}`] = exactCheckbox.checked;
    window.filterTable(table);
  }
};

window.clearSearch = (table) => {
  const searchInput = document.getElementById(`search-${table}`);
  if (searchInput) searchInput.value = '';
  const exactCheckbox = document.getElementById(`exact-${table}`);
  if (exactCheckbox) {
    exactCheckbox.checked = false;
    window[`exact_${table}`] = false;
  }
  window.filterTable(table);
};

window.showPendingRequests = async () => {
  const requests = await loadRequests();
  let html = '<h3>Pending Requests</h3><table><tr><th>ID</th><th>Action</th><th>Table</th><th>Record ID</th><th>Actions</th></tr>';
  requests.forEach(req => {
    html += `<tr><td>${req.id}</td><td>${req.action}</td><td>${req.table_name}</td><td>${req.record_id}</td>`;
    html += `<td><button onclick="approveRequest(${req.id})">Approve</button><button onclick="rejectRequest(${req.id})">Reject</button></td></tr>`;
  });
  html += '</table>';
  document.getElementById('content').innerHTML += html;
};

window.requestEdit = async (table, id) => {
  const data = prompt(`Enter new data for ${table} ID ${id}:`);
  if (data) {
    await fetchAuth(`/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: user.id, action: 'edit', table_name: table, record_id: id, new_data: data })
    });
    alert('Edit request sent to admin');
  }
};

window.requestDelete = async (table, id) => {
  if (confirm(`Delete ${table} ID ${id}?`)) {
    await fetchAuth(`/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: user.id, action: 'delete', table_name: table, record_id: id, new_data: null })
    });
    alert('Delete request sent to admin');
  }
};

window.approveRequest = async (id) => {
  await fetchAuth(`/api/requests/approve/${id}`, { method: 'POST' });
  alert('Approved');
  showPendingRequests();
};

window.rejectRequest = async (id) => {
  await fetch(`/api/requests/reject/${id}`, { method: 'POST' });
  alert('Rejected');
  showPendingRequests();
};

window.editSupervisor = async (id, name, username, client_id, site_name) => {
  const uniqueId = Date.now(); // Unique identifier to avoid duplicates
  if (document.getElementById('edit-supervisor-modal-' + uniqueId)) return;
  const overlay = document.createElement('div');
  overlay.id = 'edit-supervisor-modal-' + uniqueId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:center;justify-content:center';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:320px;max-width:520px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3>Edit Security Supervisor</h3><button id="edit-supervisor-close-${uniqueId}" title="Close">&times;</button>
    </div>
    <form id="editSupervisorForm-${uniqueId}">
      <label>Supervisor Name:<input type="text" id="editSupervisorName-${uniqueId}" value="${name}" required></label><br>
      <label>Username:<input type="text" id="editSupervisorUsername-${uniqueId}" value="${username}" disabled></label><br>
      <label>Client:<select id="editSupervisorClientId-${uniqueId}" required></select></label><br>
      <label>Site Name:<input type="text" id="editSupervisorSite-${uniqueId}" value="${site_name}" required></label><br>
      <button type="submit">Save</button>
    </form>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById(`edit-supervisor-close-${uniqueId}`).onclick = () => overlay.remove();

  const clients = await loadClients();
  const clientSelect = document.getElementById(`editSupervisorClientId-${uniqueId}`);
  clientSelect.innerHTML = '<option value="">Select Client</option>';
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = `${client.name} (ID: ${client.id})`;
    option.selected = client.id == client_id;
    clientSelect.appendChild(option);
  });

  document.getElementById(`editSupervisorForm-${uniqueId}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById(`editSupervisorName-${uniqueId}`).value;
    const client_id = document.getElementById(`editSupervisorClientId-${uniqueId}`).value;
    const site_name = document.getElementById(`editSupervisorSite-${uniqueId}`).value;
    const response = await fetch(`/api/security-supervisors/edit/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, client_id, site_name })
    });
    if (response.ok) {
      alert('Supervisor updated');
      showTable('security_supervisors');
    } else {
      alert((await response.json()).error || 'Failed to update supervisor');
    }
    overlay.remove();
  });
};

window.deleteSupervisor = async (id) => {
  if (confirm(`Delete Security Supervisor ID ${id}?`)) {
    const response = await fetchAuth(`/api/security-supervisors/delete/${id}`, { method: 'DELETE' });
    if (response.ok) {
      alert('Supervisor deleted');
      showTable('security_supervisors');
    } else {
      alert((await response.json()).error || 'Failed to delete supervisor');
    }
  }
};

// ===================== NEW UI: Change Password (self) =====================
window.showChangePassword = () => {
  if (document.getElementById('changepw-modal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'changepw-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff;padding:16px;border-radius:8px;min-width:300px;">
      <h3>Change Password</h3>
      <label>Current Password:<br><input type="password" id="cpwCurrent"></label><br>
      <label>New Password:<br><input type="password" id="cpwNew"></label><br>
      <label>Confirm New Password:<br><input type="password" id="cpwConfirm"></label><br><br>
      <button id="cpwSubmit">Update</button>
      <button id="cpwCancel">Cancel</button>
      <div id="cpwMsg" style="margin-top:6px;color:#b00;"></div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('cpwCancel').onclick=()=>overlay.remove();
  document.getElementById('cpwSubmit').onclick=async ()=>{
    const currentPassword=document.getElementById('cpwCurrent').value.trim();
    const newPassword=document.getElementById('cpwNew').value.trim();
    const confirm=document.getElementById('cpwConfirm').value.trim();
    const msg=document.getElementById('cpwMsg');
    if(!currentPassword||!newPassword){ msg.textContent='Fill all fields';return; }
    if(newPassword.length<8){ msg.textContent='New password must be at least 8 characters';return; }
    if(newPassword!==confirm){ msg.textContent='Passwords do not match';return; }
    const r=await fetch('/api/auth/change-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({currentPassword,newPassword})
    });
    const d=await r.json();
    if(r.ok){ msg.style.color='green'; msg.textContent='Password updated'; setTimeout(()=>overlay.remove(),1000); }
    else msg.textContent=d.error||'Failed';
  };
};

// ===================== NEW UI: Reset Supervisor Password (admin) =====================
window.resetSupervisorPassword = (id, username) => {
  if (document.getElementById('resetpw-modal')) return;
  const overlay=document.createElement('div');
  overlay.id='resetpw-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML=`
    <div style="background:#fff;padding:16px;border-radius:8px;min-width:300px;">
      <h3>Reset Password for ${username}</h3>
      <label>New Password:<br><input type="password" id="rpwNew"></label><br>
      <label>Confirm New Password:<br><input type="password" id="rpwConfirm"></label><br><br>
      <button id="rpwSubmit">Reset</button>
      <button id="rpwCancel">Cancel</button>
      <div id="rpwMsg" style="margin-top:6px;color:#b00;"></div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('rpwCancel').onclick=()=>overlay.remove();
  document.getElementById('rpwSubmit').onclick=async ()=>{
    const newPw=document.getElementById('rpwNew').value.trim();
    const confirmPw=document.getElementById('rpwConfirm').value.trim();
    const msg=document.getElementById('rpwMsg');
    if(!newPw||newPw.length<8){ msg.textContent='Password must be at least 8 characters'; return; }
    if(newPw!==confirmPw){ msg.textContent='Passwords do not match'; return; }
    const r=await fetch('/api/auth/admin/reset-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:id,role:'security_supervisor',newPassword:newPw})
    });
    const d=await r.json();
    if(r.ok){ msg.style.color='green'; msg.textContent='Password reset'; setTimeout(()=>overlay.remove(),1000); }
    else msg.textContent=d.error||'Failed';
  };
};

// ---------- APPEND THIS AT THE END OF public/js/app.js ----------

// Add the Admin button after dashboard renders (call this once after user is set)
(function addAdminResetAnyPasswordButton() {
  const content = document.getElementById('content');
  if (!content || !window.user) return;
  if (window.user.role !== 'admin') return;

  // Avoid duplicates if content rerenders
  if (!document.getElementById('btnAdminResetAny')) {
    const btn = document.createElement('button');
    btn.id = 'btnAdminResetAny';
    btn.textContent = 'Reset Any Password (Admin)';
    btn.onclick = showAdminResetAnyPassword;
    content.appendChild(btn);
  }
})();

async function adminLookupUserId(role, username) {
  const qs = new URLSearchParams({ role, username });
  const r = await fetchAuth(`/api/auth/lookup-user?${qs.toString()}`);
  const data = await r.json().catch(()=> ({}));
  if (!r.ok) throw new Error(data.error || 'Lookup failed');
  return data; // { ok:true, id, role, username }
}

async function adminResetPassword(userId, role, newPassword) {
  const r = await fetchAuth('/api/auth/admin/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role, newPassword })
  });
  const data = await r.json().catch(()=> ({}));
  if (!r.ok) throw new Error(data.error || 'Reset failed');
  return data;
}

function showAdminResetAnyPassword() {
  if (document.getElementById('admin-reset-any-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'admin-reset-any-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';

  overlay.innerHTML = `
    <div style="background:#fff;padding:16px;border-radius:12px;min-width:360px;box-shadow:0 10px 30px rgba(0,0,0,.2)">
      <h3 style="margin-top:0">Admin: Reset Any Password</h3>

      <label>Role<br>
        <select id="arp_role">
          <option value="admin">Admin</option>
          <option value="accountant">Accountant</option>
          <option value="hr">HR</option>
          <option value="security_supervisor">Security Supervisor</option>
        </select>
      </label><br><br>

      <label>Username<br>
        <input type="text" id="arp_username" placeholder="username" required>
      </label>
      <button id="arp_lookup">Lookup</button>
      <div id="arp_lookup_result" style="margin:6px 0;color:#555;font-size:12px;"></div>

      <hr style="margin:12px 0">

      <label>New Password<br>
        <input type="password" id="arp_new" autocomplete="new-password" minlength="8" required>
      </label><br><br>

      <label>Confirm New Password<br>
        <input type="password" id="arp_confirm" autocomplete="new-password" minlength="8" required>
      </label><br>

      <label style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;">
        <input type="checkbox" id="arp_show"> Show passwords
      </label>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button id="arp_submit">Reset</button>
        <button id="arp_cancel">Cancel</button>
      </div>

      <div id="arp_msg" style="margin-top:6px;color:#b00;"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  let resolvedUserId = null;

  $('arp_cancel').onclick = () => overlay.remove();
  $('arp_show').onchange = () => {
    const type = $('arp_show').checked ? 'text' : 'password';
    $('arp_new').type = type;
    $('arp_confirm').type = type;
  };

  $('arp_lookup').onclick = async () => {
    $('arp_lookup_result').style.color = '#555';
    $('arp_lookup_result').textContent = 'Looking up...';
    $('arp_msg').textContent = '';
    resolvedUserId = null;

    const role = $('arp_role').value.trim();
    const username = $('arp_username').value.trim();
    if (!username) { $('arp_lookup_result').style.color = '#b00'; $('arp_lookup_result').textContent='Enter username'; return; }

    try {
      const data = await adminLookupUserId(role, username);
      resolvedUserId = data.id;
      $('arp_lookup_result').style.color = '#090';
      $('arp_lookup_result').textContent = `Found: id=${data.id}, role=${data.role}, username=${data.username}`;
    } catch (e) {
      $('arp_lookup_result').style.color = '#b00';
      $('arp_lookup_result').textContent = e.message;
    }
  };

  $('arp_submit').onclick = async () => {
    $('arp_msg').style.color = '#b00';
    $('arp_msg').textContent = '';

    const role = $('arp_role').value.trim();
    const username = $('arp_username').value.trim();
    const newPw = $('arp_new').value.trim();
    const confirmPw = $('arp_confirm').value.trim();

    if (!resolvedUserId) {
      $('arp_msg').textContent = 'Lookup the user first.';
      return;
    }
    if (!newPw || newPw.length < 8) {
      $('arp_msg').textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (newPw !== confirmPw) {
      $('arp_msg').textContent = 'Passwords do not match.';
      return;
    }

    try {
      await adminResetPassword(resolvedUserId, role, newPw);
      $('arp_msg').style.color = '#090';
      $('arp_msg').textContent = `Password reset for ${username} (${role}).`;
      setTimeout(()=> overlay.remove(), 1000);
    } catch (e) {
      $('arp_msg').style.color = '#b00';
      $('arp_msg').textContent = e.message;
    }
  };
}

// ===================== Unified Profile Search =====================

// Modal launcher
function showUnifiedSearch() {
  if (document.getElementById('unified-search-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'unified-search-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:420px;max-width:640px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Search Profile (Employee / Client)</h3>
      <button id="us-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="us-form">
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:8px;">
        <label style="display:inline-flex;gap:6px;align-items:center;">
          <input type="radio" name="us-kind" value="employee" checked> Employee
        </label>
        <label style="display:inline-flex;gap:6px;align-items:center;">
          <input type="radio" name="us-kind" value="client"> Client
        </label>
      </div>
      <label>Enter ID or Name<br>
        <input type="text" id="us-query" placeholder="e.g. 42 or Ramesh Kumar" required style="min-width:320px;">
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button type="submit">Search</button>
        <button type="button" id="us-cancel">Cancel</button>
      </div>
      <div id="us-msg" style="margin-top:6px;color:#b00;"></div>
      <div id="us-pick" style="margin-top:10px;"></div>
    </form>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const close = () => overlay.remove();

  $('us-close').onclick = close;
  $('us-cancel').onclick = close;

  $('us-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('us-msg').textContent = '';
    $('us-pick').innerHTML = '';

    const queryRaw = $('us-query').value.trim();
    if (!queryRaw) { $('us-msg').textContent = 'Please enter an ID or Name.'; return; }
    const kind = [...document.querySelectorAll('input[name="us-kind"]')].find(x => x.checked)?.value || 'employee';

    try {
      const result = await findAndShowProfile(kind, queryRaw);
      if (result === 'PICKING') return; // user is picking among multiple matches
      close();
    } catch (err) {
      console.error('Unified search error:', err);
      $('us-msg').textContent = err.message || 'Search failed';
    }
  });

  // Save refs for multi-pick UI
  showUnifiedSearch._refs = { overlay };
}

// Core finder + profile viewer
async function findAndShowProfile(kind, queryText) {
  const isId = /^\d+$/.test(queryText);
  const qLower = queryText.toLowerCase();

  if (kind === 'employee') {
    const employees = await safeGet('/api/employees'); // list
    if (!Array.isArray(employees)) throw new Error('Could not load employees');

    let matches;
    if (isId) {
      const idNum = parseInt(queryText, 10);
      matches = employees.filter(e => Number(e.id) === idNum);
    } else {
      matches = employees.filter(e => (e.name||'').toLowerCase() === qLower);
      if (matches.length === 0) {
        // fallback to contains
        matches = employees.filter(e => (e.name||'').toLowerCase().includes(qLower));
      }
    }

    if (matches.length === 0) throw new Error('No matching employee found');
    if (matches.length > 1) {
      await renderPickList('employee', matches.map(e => ({ id: e.id, label: `${e.name||'(no name)'} (ID: ${e.id})` })));
      return 'PICKING';
    }

    const emp = matches[0];
    const [attendances, salaries] = await Promise.all([
      safeGet('/api/attendances'),
      safeGet('/api/salaries')
    ]);

    const attForEmp = (Array.isArray(attendances) ? attendances : []).filter(a => Number(a.employee_id) === Number(emp.id));
    const salForEmp = (Array.isArray(salaries) ? salaries : []).filter(s => Number(s.employee_id) === Number(emp.id));

    showEmployeeProfile(emp, attForEmp, salForEmp);
    return 'DONE';
  }

  // client
  const clients = await safeGet('/api/clients'); // list
  if (!Array.isArray(clients)) throw new Error('Could not load clients');

  let matches;
  if (isId) {
    const idNum = parseInt(queryText, 10);
    matches = clients.filter(c => Number(c.id) === idNum);
  } else {
    matches = clients.filter(c => (c.name||'').toLowerCase() === qLower);
    if (matches.length === 0) {
      matches = clients.filter(c => (c.name||'').toLowerCase().includes(qLower));
    }
  }

  if (matches.length === 0) throw new Error('No matching client found');
  if (matches.length > 1) {
    await renderPickList('client', matches.map(c => ({ id: c.id, label: `${c.name||'(no name)'} (ID: ${c.id})` })));
    return 'PICKING';
  }

  const cli = matches[0];
  const invoices = await safeGet('/api/invoices');
  const invForCli = (Array.isArray(invoices) ? invoices : []).filter(i => Number(i.client_id) === Number(cli.id));

  showClientProfile(cli, invForCli);
  return 'DONE';
}

// Multipicker UI (inside search modal)
async function renderPickList(kind, items) {
  const pick = document.getElementById('us-pick');
  if (!pick) return;
  pick.innerHTML = `<div style="margin-top:6px;">
    <div style="font-weight:600;margin-bottom:6px;">Multiple ${kind}s found. Pick one:</div>
    ${items.map(x => `<button class="us-pick-btn" data-id="${x.id}" style="margin:3px;">${escapeHtml(x.label)}</button>`).join('')}
  </div>`;

  pick.querySelectorAll('.us-pick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        // Relay back into find flow with explicit ID
        await findAndShowProfile(kind, String(btn.dataset.id));
        // Close the modal
        const overlay = (showUnifiedSearch._refs || {}).overlay;
        if (overlay) overlay.remove();
      } catch (e) {
        alert(e.message || 'Failed to open profile');
      }
    });
  });
}

// ===================== Profile Views =====================

function showEmployeeProfile(emp, attendancesAll, salariesAll) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;z-index:9999;overflow:auto';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;width:min(1100px,94vw);margin:24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);';
  card.innerHTML = `
    <div style="position:sticky;top:0;background:#fff;padding:12px 16px;border-bottom:1px solid #eee;border-top-left-radius:12px;border-top-right-radius:12px;display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">Employee Profile — ${escapeHtml(emp.name || '')} (ID: ${emp.id})</h3>
      <button id="emp-prof-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <div style="padding:16px;">
      ${profileKeyVals([
        ['Name', emp.name],
        ["Father's Name", emp.father_name],
        ['Local Address', emp.local_address],
        ['Permanent Address', emp.permanent_address],
        ['Telephone', emp.telephone],
        ['Email', emp.email],
        ['Marital Status', emp.marital_status],
        ['Spouse Name', emp.spouse_name],
        ['Next of Kin', emp.next_kin_name],
        ['Next of Kin Phone', emp.next_kin_telephone],
        ['Next of Kin Address', emp.next_kin_address],
        ['Identifier Name', emp.identifier_name],
        ['Identifier Phone', emp.identifier_telephone],
        ['Identifier Address', emp.identifier_address],
        ['EPF Number', emp.epf_number],
        ['ESIC Number', emp.esic_number],
        ['Criminal Record', emp.criminal_record],
        ['Salary / Month', emp.salary_per_month],
        ['Category', emp.category],
        ['Client ID', emp.client_id],
      ])}

      <h4 style="margin:16px 0 8px;">Attendances (Last 12 Months)</h4>
      ${tableHtml(
        ['ID','Client ID','Date','Present','Status'],
        filterLastNMonths(attendancesAll, 12, a => a.date).map(a=>[
          a.id, a.client_id, formatDateHuman(a.date), a.present, a.status || ''
        ])
      )}

      <h4 style="margin:16px 0 8px;">Salaries (Last 12 Months)</h4>
      ${tableHtml(
        ['ID','Month','Attendance Days','Amount','Deductions','Net Amount','Salary Date'],
        filterLastNMonths(salariesAll, 12, s => s.salary_date || s.month).map(s=>[
          s.id, s.month || '', s.attendance_days, s.amount, s.deductions, s.net_amount, formatDateHuman(s.salary_date)
        ])
      )}
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById('emp-prof-close').onclick = () => overlay.remove();
}

function showClientProfile(cli, invoicesAll) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;z-index:9999;overflow:auto';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;width:min(1100px,94vw);margin:24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);';
  card.innerHTML = `
    <div style="position:sticky;top:0;background:#fff;padding:12px 16px;border-bottom:1px solid #eee;border-top-left-radius:12px;border-top-right-radius:12px;display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">Client Profile — ${escapeHtml(cli.name || '')} (ID: ${cli.id})</h3>
      <button id="cli-prof-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <div style="padding:16px;">
      ${profileKeyVals([
        ['Name', cli.name],
        ['Address', cli.address],
        ['Contact Person', cli.contact],
        ['Telephone', cli.telephone],
        ['Email', cli.email],
        ['CGST (%)', cli.cgst],
        ['SGST (%)', cli.sgst],
      ])}

      <h4 style="margin:16px 0 8px;">Invoices (Last 12 Months)</h4>
      ${tableHtml(
        ['ID','Month','Invoice No','Subtotal','Service Charges','Total','CGST Amt','SGST Amt','Grand Total','Invoice Date'],
        filterLastNMonths(invoicesAll, 12, i => i.invoice_date || i.month).map(i=>[
          i.id, i.month || '', i.invoice_no || '', i.subtotal, i.service_charges, i.total, i.cgst_amount, i.sgst_amount, i.grand_total, formatDateHuman(i.invoice_date)
        ])
      )}
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById('cli-prof-close').onclick = () => overlay.remove();
}

// ===================== Helpers =====================

async function safeGet(url) {
  try {
    const r = await fetchAuth(url, { credentials: 'include' });
     if (!r.ok) throw new Error(await r.text());
     return await r.json();
   } catch (e) {
     console.error('GET failed:', url, e);
     return [];
   }
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function profileKeyVals(pairs) {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
      ${pairs.map(([k,v]) => `
        <div style="border:1px solid #eee;border-radius:8px;padding:8px;">
          <div style="font-size:12px;color:#666;margin-bottom:2px;">${escapeHtml(k)}</div>
          <div style="font-weight:600;">${escapeHtml(v ?? '')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function tableHtml(headers, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `<div style="color:#666;">No records</div>`;
  }
  const head = `<tr>${headers.map(h=>`<th style="text-align:left;padding:6px;border-bottom:1px solid #eee;">${escapeHtml(h)}</th>`).join('')}</tr>`;
  const body = rows.map(r => `<tr>${r.map(c => `<td style="padding:6px;border-bottom:1px solid #f5f5f5;">${escapeHtml(c ?? '')}</td>`).join('')}</tr>`).join('');
  return `<div style="overflow:auto;"><table style="border-collapse:collapse;width:100%;">${head}${body}</table></div>`;
}

// Normalize various date strings to yyyy-MM-dd (best-effort) for display
function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  // yyyy-MM-dd already?
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // dd/MM/yyyy
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // ISO
  const t = Date.parse(dateStr);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0,10);
  return String(dateStr);
}

// Return only items whose dateExtractor(item) falls within last N*months
function filterLastNMonths(items, n, dateExtractor) {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1); // first day of (current - n + 1)
  return (items || []).filter(it => {
    const s = dateExtractor(it);
    if (!s) return false;
    const d = parseAsDateOrMonth(s);
    if (!d) return false;
    // keep same month or after cutoff
    return d >= cutoff;
  }).sort((a,b) => {
    const da = parseAsDateOrMonth(dateExtractor(a))?.getTime() || 0;
    const db = parseAsDateOrMonth(dateExtractor(b))?.getTime() || 0;
    return db - da; // newest first
  });
}

// Accept "yyyy-MM-dd", "dd/MM/yyyy", "yyyy-MM"
function parseAsDateOrMonth(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  const mm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (mm) {
    const dd = Number(mm[1]), m = Number(mm[2]), y = Number(mm[3]);
    return new Date(y, m-1, dd);
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y,m] = s.split('-').map(Number);
    return new Date(y, m-1, 1);
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}}


// Robust attach: works even if button is rendered later
function attachLogoutHandler() {
  // Try common ids/classes; adjust if your markup differs
  const selectors = ['#logoutBtn', 'button.logout', '.logout-btn'];
  let btn = null;
  for (const s of selectors) {
    btn = document.querySelector(s);
    if (btn) break;
  }

  if (!btn) {
    console.log('[PGS-ERP] Logout button not found yet. Will retry in 500ms.');
    // try again later (useful if DOM built after)
    setTimeout(attachLogoutHandler, 500);
    return;
  }

  // If handler already set, avoid double-wire
  if (btn.dataset.logoutAttached === '1') {
    console.log('[PGS-ERP] Logout handler already attached.');
    return;
  }
  btn.dataset.logoutAttached = '1';

  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    console.log('[PGS-ERP] Logout clicked — calling /api/auth/logout');

    try {
      const resp = await fetchAuth('/api/auth/logout', { method: 'POST', headers: { 'Accept': 'application/json' }});

      console.log('[PGS-ERP] /api/auth/logout response status:', resp.status, 'headers:', [...resp.headers.entries()]);

      // handle JSON responses safely
      const ct = resp.headers.get('content-type') || '';
      let body = null;
      if (ct.includes('application/json')) {
        body = await resp.json();
        console.log('[PGS-ERP] /api/auth/logout json body:', body);
      } else {
        body = await resp.text();
        console.log('[PGS-ERP] /api/auth/logout non-json body (truncated):', body.slice(0,200));
      }

      if (resp.ok) {
        // destroy client-side UX and go to login
        console.log('[PGS-ERP] Logout OK — redirecting to login');
        window.location.href = '/login.html';
      } else {
        console.warn('[PGS-ERP] Logout failed:', resp.status, body);
        alert('Logout failed. Check console/network logs.');
      }
    } catch (err) {
      console.error('[PGS-ERP] Network error during logout:', err);
      alert('Network error during logout. Check console for details.');
    }
  });
}

// start attaching after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachLogoutHandler);
} else {
  attachLogoutHandler();
}

