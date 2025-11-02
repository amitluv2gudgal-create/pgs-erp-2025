// public/js/deductions.js
// - loadDeductions(): list for table
// - window.showDeductionForm(): render create form with Employee dropdown + clear after submit
// Always include credentials so session cookie is sent
const fetchAuth = (url, opts = {}) => fetch(url, { credentials: 'include', ...opts });

/**
 * Local helper to fetch employees if loadEmployees() isn't available.
 */
async function fetchEmployeesList() {
  try {
    if (typeof loadEmployees === 'function') {
      const list = await loadEmployees();
      return Array.isArray(list) ? list : [];
    }
    const r = await fetchAuth('/api/employees');
    if (!r.ok) {
      console.error('fetchEmployeesList: /api/employees returned', r.status, await r.text().catch(()=>r.statusText));
      return [];
    }
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('fetchEmployeesList error:', e);
    return [];
  }
}

export async function loadDeductions() {
  try {
    const res = await fetchAuth('/api/deductions');
    if (!res.ok) {
      const txt = await res.text().catch(()=>res.statusText);
      console.error('loadDeductions: failed', res.status, txt);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error('loadDeductions error:', err);
    return [];
  }
}

function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function populateEmployeeDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) {
    console.warn('populateEmployeeDropdown: select not found:', selectId);
    return;
  }

  sel.innerHTML = '<option value="">Loading employees...</option>';
  try {
    const emps = await fetchEmployeesList();
    if (!Array.isArray(emps) || emps.length === 0) {
      sel.innerHTML = '<option value="">No employees available</option>';
      return;
    }
    sel.innerHTML = '<option value="">Select Employee</option>' +
      emps.map(e => `<option value="${e.id}">${escapeHTML(e.name || `ID ${e.id}`)} (ID: ${e.id})</option>`).join('');
  } catch (e) {
    console.error('populateEmployeeDropdown error:', e);
    sel.innerHTML = '<option value="">Failed to load employees</option>';
  }
}

export async function showDeductionsTable() {
  const rows = await loadDeductions();
  renderDeductionsTable(Array.isArray(rows) ? rows : (rows.data || []));
}

function ensureContainer() {
  let container = document.getElementById('deductions-container');
  const content = document.getElementById('content') || document.body;
  if (!container) {
    container = document.createElement('div');
    container.id = 'deductions-container';
    content.appendChild(container);
  }
  return container;
}

export function renderDeductionsTable(rows = []) {
  const container = ensureContainer();
  let html = `<div style="overflow:auto"><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;min-width:800px">
    <thead style="background:#f6f6f6"><tr>
      <th>#</th><th>Employee ID</th><th>Amount</th><th>Month</th><th>Reason</th><th>Note</th><th>Actions</th>
    </tr></thead><tbody>`;
  rows.forEach((r, idx) => {
    html += `<tr>
      <td>${idx+1}</td>
      <td>${escapeHTML(r.employee_id)}</td>
      <td>${escapeHTML(r.amount)}</td>
      <td>${escapeHTML(r.month || r.date || '')}</td>
      <td>${escapeHTML(r.reason || '')}</td>
      <td>${escapeHTML(r.note || '')}</td>
      <td>
        <button data-id="${r.id}" class="ded-edit">Edit</button>
        <button data-id="${r.id}" class="ded-del">Delete</button>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;

  container.querySelectorAll('.ded-del').forEach(btn => {
    btn.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Delete deduction?')) return;
      try {
        const r = await fetchAuth(`/api/deductions/${id}`, { method: 'DELETE' });
        if (!r.ok) {
          let errBody = '';
          try { errBody = (await r.json()).error || JSON.stringify(await r.json()); } catch(_) { errBody = await r.text().catch(()=>r.statusText); }
          alert('Delete failed: ' + (errBody || r.statusText));
          return;
        }
        alert('Deleted');
        showDeductionsTable();
      } catch (err) {
        console.error('delete deduction error', err);
        alert('Delete failed — see console');
      }
    };
  });

  container.querySelectorAll('.ded-edit').forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      openEditDeduction(Number(id));
    };
  });
}

// showDeductionForm builds form in #content (same as before) but with autocomplete attrs
window.showDeductionForm = async () => {
  // Hide open tables/forms
  document.querySelectorAll('[id^="table-container-"]').forEach(d => d.style.display = 'none');
  document.querySelectorAll('[id^="form-container-"]').forEach(d => d.style.display = 'none');

  const containerId = 'form-container-deduction';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.getElementById('content').appendChild(container);
  }
  container.style.display = 'block';

  container.innerHTML = `
    <h3>Create Deduction</h3>
    <form id="deductionForm" autocomplete="on">
      <label>Employee (required):<br>
        <select id="ded_employee_id" required autocomplete="off">
          <option value="">Loading employees...</option>
        </select>
      </label><br><br>

      <label>Month (YYYY-MM, required):<br>
        <input type="month" id="ded_month" required autocomplete="bday-month">
      </label><br><br>

      <label>Reason (required):<br>
        <select id="ded_reason" required autocomplete="off">
          <option value="">Select</option>
          <option value="Fine">Fine</option>
          <option value="Uniform">Uniform</option>
          <option value="Other">Other</option>
        </select>
      </label><br><br>

      <label>Amount (₹, required):<br>
        <input type="number" id="ded_amount" min="0" step="1" required autocomplete="off">
      </label><br><br>

      <label>Note (optional):<br>
        <input type="text" id="ded_note" placeholder="Optional remarks" autocomplete="off">
      </label><br><br>

      <div style="display:flex;gap:8px;">
        <button type="submit" id="ded_submit">Save</button>
        <button type="button" id="ded_reset">Reset</button>
      </div>
    </form>
  `;

  await populateEmployeeDropdown('ded_employee_id');

  const form = document.getElementById('deductionForm');
  document.getElementById('ded_reset').onclick = () => form.reset();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('ded_submit');
    submitBtn.disabled = true;

    const employee_id = parseInt(document.getElementById('ded_employee_id').value, 10);
    const month = document.getElementById('ded_month').value;
    const reason = document.getElementById('ded_reason').value;
    const amount = Number(document.getElementById('ded_amount').value || 0);
    const note = document.getElementById('ded_note').value.trim();

    if (!employee_id) { alert('Please select an employee'); submitBtn.disabled = false; return; }
    if (!month) { alert('Please select month'); submitBtn.disabled = false; return; }
    if (!reason) { alert('Please select reason'); submitBtn.disabled = false; return; }
    if (!(amount > 0)) { alert('Amount must be greater than 0'); submitBtn.disabled = false; return; }

    try {
      const res = await fetchAuth('/api/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id, month, reason, amount, note })
      });
      const bodyText = await res.text().catch(()=> '');
      let j = null;
      try { j = bodyText ? JSON.parse(bodyText) : null; } catch(_) { j = null; }
      if (!res.ok) {
        const errMsg = (j && j.error) ? j.error : (bodyText || res.statusText);
        throw new Error(errMsg || `Status ${res.status}`);
      }
      alert('Deduction saved');
      form.reset();
      showDeductionsTable();
    } catch (err) {
      console.error('Create deduction error:', err);
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      submitBtn.disabled = false;
    }
  });
};

// The edit modal (openEditDeduction) code remains unchanged from your uploaded file (it already handles the fields nicely).
// Reuse your existing openEditDeduction implementation.

window.openEditDeduction = window.openEditDeduction || function(id){ alert('openEditDeduction not found; please ensure it is loaded.'); };

// expose helpers
window.showDeductionsTable = showDeductionsTable;
window.showDeductionForm = window.showDeductionForm;
window.loadDeductions = loadDeductions;
