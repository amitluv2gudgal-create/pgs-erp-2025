// public/js/attendances.js
// Changes:
// - Create Attendance form uses dropdowns for Client & Employee.
// - Submits to /api/attendances (HR) with submitted_by handled server-side.
// - Keeps modal UX and refreshes table after save.

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function create(tag, props = {}) { const el = document.createElement(tag); Object.assign(el, props); return el; }

// API helpers
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function getClients() {
  try { return await fetchJSON('/api/clients'); } catch { return []; }
}

async function getEmployees() {
  try { return await fetchJSON('/api/employees'); } catch { return []; }
}

// Build <option> list
function optionHTML(value, label) {
  return `<option value="${String(value)}">${label}</option>`;
}

// Show form for creating attendance (HR flow by default)
export function showAttendanceForm() {
  if ($('#attendance-modal')) return;

  const overlay = create('div', { id: 'attendance-modal' });
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,.35)', zIndex: '9999',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  });

  const card = create('div');
  Object.assign(card.style, {
    background: '#fff', minWidth: '320px', maxWidth: '560px', padding: '16px',
    borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.2)'
  });

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Create Attendance</h3>
      <button id="attendance-close" title="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="attendanceForm">
      <label>Employee (required):<br>
        <select id="employee_id" required>
          <option value="">Loading employees...</option>
        </select>
      </label><br><br>

      <label>Client (required, for billing):<br>
        <select id="client_id" required>
          <option value="">Loading clients...</option>
        </select>
      </label><br><br>

      <label>Date (YYYY-MM-DD, required):<br>
        <input type="date" id="date" required>
      </label><br><br>

      <label>Present:<br>
        <input type="checkbox" id="present" checked>
      </label><br><br>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button type="button" id="attendance-cancel">Cancel</button>
        <button type="submit">Save</button>
      </div>
    </form>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  $('#attendance-close', card).onclick = close;
  $('#attendance-cancel', card).onclick = close;

  // Populate dropdowns
  (async () => {
    const [employees, clients] = await Promise.all([getEmployees(), getClients()]);

    const empSel = $('#employee_id', card);
    if (Array.isArray(employees) && employees.length) {
      empSel.innerHTML = ['<option value="">Select Employee</option>']
        .concat(employees.map(e => optionHTML(e.id, `${escapeHTML(e.name)} (ID: ${e.id})`)))
        .join('');
    } else {
      empSel.innerHTML = '<option value="">No employees available</option>';
    }

    const cliSel = $('#client_id', card);
    if (Array.isArray(clients) && clients.length) {
      cliSel.innerHTML = ['<option value="">Select Client</option>']
        .concat(clients.map(c => optionHTML(c.id, `${escapeHTML(c.name)} (ID: ${c.id})`)))
        .join('');
    } else {
      cliSel.innerHTML = '<option value="">No clients available</option>';
    }
  })();

  // Submit
  $('#attendanceForm', card).addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = parseInt($('#employee_id', card).value, 10);
    const client_id = parseInt($('#client_id', card).value, 10);
    const date = $('#date', card).value;
    const present = $('#present', card).checked ? 1 : 0;

    if (!Number.isInteger(employee_id) || employee_id <= 0) { alert('Please select an Employee'); return; }
    if (!Number.isInteger(client_id) || client_id <= 0) { alert('Please select a Client'); return; }
    if (!date) { alert('Date is required'); return; }

    const formData = { employee_id, client_id, date, present };

    try {
      const response = await fetch('/api/attendances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Attendance recorded successfully!');
        close();
        if (window.showTable) window.showTable('attendances');
      } else {
        const errorData = await safeJSON(response);
        alert(`Error: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert(`Network error: ${error.message}`);
    }
  });
}

// Load all attendances with joined names for viewing
export const loadAttendances = async () => {
  try {
    const res = await fetch('/api/attendances');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error loading attendances:', error);
    return [];
  }
};

async function safeJSON(res) {
  try { return await res.json(); } catch { return {}; }
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

// Keep global handle like before
window.showAttendanceForm = showAttendanceForm;
