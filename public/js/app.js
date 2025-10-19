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
  const res = await fetch('/api/auth/current-user');
  if (!res.ok) {
    window.location.href = '/login.html';
    return; // Exit if not authenticated
  }
  user = await res.json(); // Assign the fetched user data
  if (!user || typeof user.role === 'undefined') {
    console.error('User data is invalid or missing role:', user);
    window.location.href = '/login.html';
    return;
  }
  const content = document.getElementById('content');
  content.innerHTML = `<h2>Welcome, ${user.role}</h2>`;

  // Buttons rendered based on role
if (user.role !== 'security_supervisor') {
  // Common: View tables (NOT for supervisor)
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
  document.getElementById('adminSection').style.display = 'block';
} else if (user.role === 'security_supervisor') {
  // Supervisor: ONLY submit attendance
  content.innerHTML += '<button onclick="showAttendanceFormForSupervisor()">Submit Attendance</button>';
}


  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout');
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


window.renderTable = (containerId, table, data, searchTerm) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tableDiv = document.getElementById(`table-${table}`);
  if (!tableDiv) return;

  let html = '<table border="1"><tr>';
  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => html += `<th>${key}</th>`);

    // Add Actions column logic:
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
        // Only show buttons if pending
        if (row.status === 'pending') {
          html += `<td>
            <button onclick="approveAttendance(${row.id})">Approve</button>
            <button onclick="rejectAttendance(${row.id})">Reject</button>
          </td>`;
        } else {
          html += `<td>-</td>`;
        }
      } else if (table === 'security_supervisors' && user?.role === 'admin') {
        html += `<td><button onclick="editSupervisor(${row.id}, '${row.name}', '${row.username}', ${row.client_id}, '${row.site_name}')">Edit</button> <button onclick="deleteSupervisor(${row.id})">Delete</button></td>`;
      } else if (['accountant', 'hr'].includes(user?.role) && table !== 'attendances') {
        let actions = `<button onclick="requestEdit('${table}', ${row.id})">Edit</button> <button onclick="requestDelete('${table}', ${row.id})">Delete</button>`;
        if (table === 'clients' && user.role === 'accountant') {
          actions += ` <button onclick="showCategoryForm(${row.id})">Add Category</button>`;
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