// PGS-ERP/public/js/app.js
import { loadClients } from './clients.js';
import { loadEmployees } from './employees.js';
import { loadAttendances } from './attendances.js';
import { loadDeductions } from './deductions.js';
import { loadInvoices } from './invoices.js';
import { loadSalaries } from './salaries.js';
import { loadRequests } from './requests.js';

let user; // Declare user globally

document.addEventListener('DOMContentLoaded', async () => {
  // ✅ Always include credentials so the server sees your session
  const res = await fetch('/api/auth/me', { credentials: 'include' });
if (!res.ok) {
  window.location.href = '/login.html';
  return;
}
user = await res.json();          
window.user = user;
ensurePasswordUI(user);


  if (!user || typeof user.role === 'undefined') {
    console.error('User data is invalid or missing role:', user);
    window.location.href = '/login.html';
    return;
  }

  const content = document.getElementById('content');
  content.innerHTML = `<h2>Welcome, ${user.role}</h2>`;

  // Buttons rendered based on role
  if (user.role !== 'security_supervisor') {
    content.innerHTML += '<button onclick="showTable(\'clients\')">View Clients</button>';
    content.innerHTML += '<button onclick="showTable(\'employees\')">View Employees</button>';
    content.innerHTML += '<button onclick="showTable(\'attendances\')">View Attendances</button>';
    content.innerHTML += '<button onclick="showTable(\'deductions\')">View Deductions</button>';
    content.innerHTML += '<button onclick="showTable(\'invoices\')">View Invoices</button>';
    content.innerHTML += '<button onclick="showTable(\'salaries\')">View Salaries</button>';
  }

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

  // ✅ Role-based top buttons if they exist in your HTML
  const cpwBtn = document.getElementById('btn-change-password');
  if (cpwBtn) {
    cpwBtn.style.display = ['admin', 'hr', 'accountant'].includes(user.role) ? 'inline-block' : 'none';
  }
  const umBtn = document.getElementById('btn-user-mgmt');
  if (umBtn) {
    umBtn.style.display = (user.role === 'admin') ? 'inline-block' : 'none';
  }

  // ✅ Logout should also include credentials
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) {
        console.error('Logout error:', err);
      }
      window.location.href = '/login.html';
    });
  }
});

function ensurePasswordUI(user) {
  const role = (user?.role || '').toLowerCase();
  const canSelfChange = role === 'admin' || role === 'accountant' || role === 'hr';
  const isAdmin = role === 'admin';

  // --- Self Change Password (admins/accountants/hr only) ---
  if (canSelfChange && !document.getElementById('pgs-change-password-btn')) {
    const btn = document.createElement('button');
    btn.id = 'pgs-change-password-btn';
    btn.textContent = 'Change Password';
    Object.assign(btn.style, commonFloatingStyle({ bottom: 16, right: 16 }));
    btn.style.setProperty('color', '#111', 'important');
    btn.style.setProperty('background', '#ffffff', 'important');
    btn.style.setProperty('borderColor', '#d0d5dd', 'important');
    btn.style.setProperty('fontWeight', '600', 'important');
    btn.style.setProperty('letterSpacing', '0.2px', 'important');
    document.body.appendChild(btn);
    const modal = buildSelfChangeModal();
    document.body.appendChild(modal);
    btn.addEventListener('click', () => { modal.style.display = 'flex'; });
  }

  // --- Admin Reset Others' Passwords ---
  if (isAdmin && !document.getElementById('pgs-admin-reset-btn')) {
    const btn2 = document.createElement('button');
    btn2.id = 'pgs-admin-reset-btn';
    btn2.textContent = 'Reset User Password';
    Object.assign(btn2.style, commonFloatingStyle({ bottom: 64, right: 16 }));
    btn2.style.setProperty('color', '#111', 'important');
    btn2.style.setProperty('background', '#ffffff', 'important');
    btn2.style.setProperty('borderColor', '#d0d5dd', 'important');
    btn2.style.setProperty('fontWeight', '600', 'important');
    btn2.style.setProperty('letterSpacing', '0.2px', 'important');
    document.body.appendChild(btn2);
    const modal2 = buildAdminResetModal();
    document.body.appendChild(modal2);
    btn2.addEventListener('click', () => { modal2.style.display = 'flex'; });
  }

  // Supervisors: see nothing.
}

function commonFloatingStyle({ bottom, right }) {
  return {
    position: 'fixed', zIndex: '9999', cursor: 'pointer',
    padding: '10px 14px', fontSize: '14px', borderRadius: '10px',
    border: '1px solid #ccc', background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    bottom: `${bottom}px`, right: `${right}px`
  };
}

function buildSelfChangeModal() {
  const modal = document.createElement('div');
  Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.4)', display:'none',
    alignItems:'center', justifyContent:'center', zIndex:'10000' });
  modal.innerHTML = `
    <div style="width:320px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2)">
      <h3 style="margin:0 0 12px;font-size:16px;">Change Password</h3>
      <label style="display:block;margin-bottom:8px;">
        <span style="display:block;font-size:12px;margin-bottom:4px;">Current password</span>
        <input type="password" id="cp-current" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;">
      </label>
      <label style="display:block;margin-bottom:8px;">
        <span style="display:block;font-size:12px;margin-bottom:4px;">New password</span>
        <input type="password" id="cp-new" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;">
      </label>
      <label style="display:block;margin-bottom:12px;">
        <span style="display:block;font-size:12px;margin-bottom:4px;">Confirm new password</span>
        <input type="password" id="cp-confirm" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;">
      </label>
      <div id="cp-msg" style="min-height:18px;font-size:12px;color:#c00;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="cp-cancel" style="padding:8px 12px;border:1px solid #0a7;border-radius:8px;background:#f5f5f5;cursor:pointer;">Cancel</button>
        <button id="cp-save" style="padding:8px 12px;border:1px solid #0a7;border-radius:8px;background:#0db;cursor:pointer;">Save</button>
      </div>
    </div>`;
    
    const card = modal.firstElementChild;
    card.querySelector('#cp-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
    card.querySelector('#cp-save').addEventListener('click', async () => {
    const current = card.querySelector('#cp-current').value.trim();
    const next = card.querySelector('#cp-new').value.trim();
    const confirm = card.querySelector('#cp-confirm').value.trim();
    const msg = card.querySelector('#cp-msg');
    if (!current || !next || !confirm) return msg.textContent = 'All fields are required.';
    if (next !== confirm) return msg.textContent = 'New passwords do not match.';
    if (next.length < 6) return msg.textContent = 'Password must be at least 6 characters.';

    msg.textContent = '';
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword: current, newPassword: next })
    });

    const data = await res.json().catch(()=>({}));
    if (!res.ok) { msg.textContent = data?.error || 'Failed'; return; }
    msg.style.color = '#0a7'; msg.textContent = 'Password changed.';
    setTimeout(()=>{ modal.style.display='none'; }, 800);
    card.querySelector('#cp-current').value = '';
    card.querySelector('#cp-new').value = '';
    card.querySelector('#cp-confirm').value = '';
  });
  return modal;
}

function buildAdminResetModal() {
  const modal = document.createElement('div');
  Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.4)', display:'none',
    alignItems:'center', justifyContent:'center', zIndex:'10000' });
  modal.innerHTML = `
    <div style="width:360px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2)">
      <h3 style="margin:0 0 12px;font-size:16px;">Admin: Reset User Password</h3>
      <p style="margin:0 0 8px;font-size:12px;color:#555;">Provide <strong>either</strong> User ID or Username.</p>
      <label style="display:block;margin-bottom:8px;">
        <span style="display:block;font-size:12px;margin-bottom:4px;">User ID</span>
        <input type="number" id="arp-id" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;">
      </label>
      <label style="display:block;margin-bottom:8px;">
        <span style="display:block;font-size:12px;margin-bottom:4px;">Username</span>
        <input type="text" id="arp-username" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;">
      </label>
      <label style="display:block;margin-bottom:12px;">
        <span style="display:block;font-size:12px;margin-bottom:4px;">New password</span>
        <input type="password" id="arp-new" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;">
      </label>
      <div id="arp-msg" style="min-height:18px;font-size:12px;color:#c00;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="arp-cancel" style="padding:8px 12px;border:1px solid #ccc;border-radius:8px;background:#f5f5f5;cursor:pointer;">Cancel</button>
        <button id="arp-save" style="padding:8px 12px;border:1px solid #0a7;border-radius:8px;background:#0db;cursor:pointer;">Reset</button>
      </div>
    </div>`;

    const card = modal.firstElementChild;
    card.querySelector('#arp-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
    card.querySelector('#arp-save').addEventListener('click', async () => {
    const id = card.querySelector('#arp-id').value.trim();
    const username = card.querySelector('#arp-username').value.trim();
    const next = card.querySelector('#arp-new').value.trim();
    const msg = card.querySelector('#arp-msg');

    if (!id && !username) return msg.textContent = 'Enter User ID or Username.';
    if (!next || next.length < 6) return msg.textContent = 'Password must be at least 6 characters.';

    msg.textContent = '';
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: id ? Number(id) : undefined, username: username || undefined, newPassword: next })
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) { msg.textContent = data?.error || 'Failed'; return; }
    msg.style.color = '#0a7'; msg.textContent = 'Password reset.';
    setTimeout(()=>{ modal.style.display='none'; }, 800);
    card.querySelector('#arp-id').value = '';
    card.querySelector('#arp-username').value = '';
    card.querySelector('#arp-new').value = '';
  });
  return modal;
}

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
    const res = await fetch('/api/security-supervisors');
    data = res.ok ? await res.json() : [];
    if (!res.ok) console.error('Fetch error for supervisors:', await res.text());
  }

  data = Array.isArray(data) ? data : [];
  window['data_' + table] = data;

  // 🔹 Hide all other table containers before showing the new one
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
  container.style.display = 'block'; // ensure visible
  container.innerHTML = '';

  const searchHtml = `
    <h3>${table.charAt(0).toUpperCase() + table.slice(1)} Table</h3>
    <input type="text" id="search-${table}" placeholder="Search by name/ID, month, date (e.g., 'John' or '123' or '2025-09')" oninput="filterTable('${table}')">
    <label><input type="checkbox" id="exact-${table}" onchange="toggleExactMatch('${table}')"> Exact Match</label>
    <button onclick="clearSearch('${table}')">Clear</button>
    <div id="table-${table}"></div>
  `;
  container.innerHTML = searchHtml;

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
    const response = await fetch('/api/security-supervisors/create', {
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
      const response = await fetch('/api/attendances/supervisor', {
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

// window.renderTable
window.renderTable = (containerId, table, data, searchTerm) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tableDiv = document.getElementById(`table-${table}`);
  if (!tableDiv) return;

  // Helper: should we show an Actions column for this table & role?
  const showActionsForHR =
    (user?.role === 'hr') &&
    (table === 'attendances' || table === 'employees'); // ✅ HR: only Attendances + Employees

  const showActionsForAdmin =
    (user?.role === 'admin') && (table === 'security_supervisors'); // Admin keeps SS actions

  const showActionsForAccountant =
    (user?.role === 'accountant') &&
    (table === 'clients' || table === 'deductions' || table === 'invoices' || table === 'salaries'); // Accountant unchanged

  const shouldShowActions = showActionsForHR || showActionsForAdmin || showActionsForAccountant;

  let html = '<table border="1"><tr>';

  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => html += `<th>${key}</th>`);
    if (shouldShowActions) html += '<th>Actions</th>';
  }
  html += '</tr>';

  if (data.length > 0) {
    data.forEach(row => {
      let matchStyle = '';
      let rowMatches = false;
      if (searchTerm) {
        const exactMode = window[`exact_${table}`] || false;
        for (let key in row) {
          const val = row[key];
          if (val !== null && val !== undefined) {
            const valStr = (typeof val === 'object' ? JSON.stringify(val) : String(val)).toLowerCase();
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
          const valStr = String(displayVal).toLowerCase();
          const cellMatches = exactMode ? (valStr === searchTerm) : valStr.includes(searchTerm);
          if (cellMatches) cellStyle = ' style="background-color: lightyellow; font-weight: bold;"';
        }
        html += `<td${cellStyle}>${displayVal}</td>`;
      });

      // Actions cell
      if (shouldShowActions) {
        if (table === 'attendances' && user?.role === 'hr') {
          // HR: Approve/Reject (if pending) + Edit/Delete
          const approveReject = (row.status === 'pending')
            ? `<button onclick="approveAttendance(${row.id})">Approve</button>
               <button onclick="rejectAttendance(${row.id})">Reject</button>`
            : '';
          const editDelete = `
            <button onclick="editAttendance(${row.id})">Edit</button>
            <button onclick="deleteAttendance(${row.id})">Delete</button>`;
          html += `<td style="white-space:nowrap;">${approveReject} ${editDelete}</td>`;
        } else if (table === 'employees' && user?.role === 'hr') {
          // HR: Edit/Delete on Employees (using your existing request-based flows)
          const actions = `
            <button onclick="requestEdit('employees', ${row.id})">Edit</button>
            <button onclick="requestDelete('employees', ${row.id})">Delete</button>`;
          html += `<td>${actions}</td>`;
        } else if (table === 'security_supervisors' && user?.role === 'admin') {
          html += `<td>
            <button onclick="editSupervisor(${row.id}, '${row.name}', '${row.username}', ${row.client_id}, '${row.site_name}')">Edit</button>
            <button onclick="deleteSupervisor(${row.id})">Delete</button>
          </td>`;
        } else if (user?.role === 'accountant' && (table === 'clients' || table === 'deductions' || table === 'invoices' || table === 'salaries')) {
          // Accountant keeps existing actions on these tables
          let actions = `<button onclick="requestEdit('${table}', ${row.id})">Edit</button>
                         <button onclick="requestDelete('${table}', ${row.id})">Delete</button>`;
          if (table === 'clients') {
            actions += ` <button onclick="showCategoryForm(${row.id})">Add Category</button>`;
          }
          html += `<td>${actions}</td>`;
        } else {
          html += '<td>-</td>';
        }
      }

      html += '</tr>';
    });
  } else {
    const numCols = (data.length > 0 ? Object.keys(data[0]).length : 1) + (shouldShowActions ? 1 : 0);
    html += `<tr><td colspan="${numCols}">No data found</td></tr>`;
  }

  html += '</table>';
  tableDiv.innerHTML = html;
};

// === Add these helpers anywhere after renderTable ===
window.approveAttendance = async (id) => {
  try {
    const r = await fetch(`/api/attendances/${id}/approve`, { method: 'POST' });
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
    const r = await fetch(`/api/attendances/${id}/reject`, { method: 'POST' });
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
    const r = await fetch(`/api/attendances/${id}`, { credentials: 'include' });
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
        const u = await fetch(`/api/attendances/${id}`, {
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
    const r = await fetch(`/api/attendances/${id}`, {
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
    const r = await fetch(`/api/attendances/${id}/approve`, { method: 'POST', credentials: 'include' });
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
    const r = await fetch(`/api/attendances/${id}/reject`, { method: 'POST', credentials: 'include' });
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
    await fetch(`/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: user.id, action: 'edit', table_name: table, record_id: id, new_data: data })
    });
    alert('Edit request sent to admin');
  }
};

window.requestDelete = async (table, id) => {
  if (confirm(`Delete ${table} ID ${id}?`)) {
    await fetch(`/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: user.id, action: 'delete', table_name: table, record_id: id, new_data: null })
    });
    alert('Delete request sent to admin');
  }
};

window.approveRequest = async (id) => {
  await fetch(`/api/requests/approve/${id}`, { method: 'POST' });
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
    const response = await fetch(`/api/security-supervisors/delete/${id}`, { method: 'DELETE' });
    if (response.ok) {
      alert('Supervisor deleted');
      showTable('security_supervisors');
    } else {
      alert((await response.json()).error || 'Failed to delete supervisor');
    }
  }
};

window.openUserManagement = async function() {
  if (window.user?.role !== 'admin') { alert('Admin only'); return; }

  let data;
  try {
    const r = await fetch('/api/auth/admin/users', { credentials: 'include' });
    if (!r.ok) throw new Error(await r.text());
    data = await r.json(); // { users: [...], supervisors: [...] }
  } catch (e) {
    console.error('Load users error:', e);
    alert('Failed to load users');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'um-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:center;justify-content:center';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:380px;max-width:760px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);max-height:80vh;overflow:auto';

  const usersRows = (data.users || []).map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${escapeHtml(u.username)}</td>
      <td>${u.role}</td>
      <td>
        <input type="password" id="newpass_user_${u.id}" placeholder="New password (min 6)">
        <button onclick="resetUserPass(${u.id})">Reset</button>
      </td>
    </tr>
  `).join('');

  const supRows = (data.supervisors || []).map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${escapeHtml(s.username)}</td>
      <td>${escapeHtml(s.name || '')}</td>
      <td>${s.client_id ?? ''}</td>
      <td>${escapeHtml(s.site_name || '')}</td>
      <td>
        <input type="password" id="newpass_sup_${s.id}" placeholder="New password (min 6)">
        <button onclick="resetSupervisorPass(${s.id})">Reset</button>
      </td>
    </tr>
  `).join('');

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">User Management (Admin)</h3>
      <button id="um-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>

    <h4>Users (admin / accountant / hr)</h4>
    <table border="1" cellspacing="0" cellpadding="4" style="width:100%;margin-bottom:12px;">
      <tr><th>ID</th><th>Username</th><th>Role</th><th>Reset Password</th></tr>
      ${usersRows || '<tr><td colspan="4">No users</td></tr>'}
    </table>

    <h4>Security Supervisors</h4>
    <table border="1" cellspacing="0" cellpadding="4" style="width:100%;">
      <tr><th>ID</th><th>Username</th><th>Name</th><th>Client ID</th><th>Site</th><th>Reset Password</th></tr>
      ${supRows || '<tr><td colspan="6">No supervisors</td></tr>'}
    </table>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById('um-close').onclick = () => overlay.remove();

  window.resetUserPass = async (id) => {
    const input = document.getElementById(`newpass_user_${id}`);
    const new_password = input?.value?.trim();
    if (!new_password || new_password.length < 6) return alert('Enter a password with at least 6 characters');
    try {
      const r = await fetch(`/api/auth/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_password })
      });
      if (!r.ok) throw new Error(await r.text());
      alert('Password reset for user');
      input.value = '';
    } catch (e) {
      console.error('resetUserPass error:', e);
      alert('Failed to reset user password');
    }
  };

  window.resetSupervisorPass = async (id) => {
    const input = document.getElementById(`newpass_sup_${id}`);
    const new_password = input?.value?.trim();
    if (!new_password || new_password.length < 6) return alert('Enter a password with at least 6 characters');
    try {
      const r = await fetch(`/api/auth/admin/supervisors/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_password })
      });
      if (!r.ok) throw new Error(await r.text());
      alert('Password reset for supervisor');
      input.value = '';
    } catch (e) {
      console.error('resetSupervisorPass error:', e);
      alert('Failed to reset supervisor password');
    }
  };

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
};
