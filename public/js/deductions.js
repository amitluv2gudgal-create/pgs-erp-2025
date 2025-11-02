// public/js/deductions.js
// - loadDeductions(): list for table
// - window.showDeductionForm(): render create form with Employee dropdown + clear after submit
// Local helper to avoid name clashes
async function fetchEmployeesList() {
  try {
    const r = await fetch('/api/employees');
    if (!r.ok) throw new Error(await r.text());
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('fetchEmployeesList error:', e);
    return [];
  }
}


export async function loadDeductions() {
  try {
    const res = await fetch('/api/deductions');
    if (!res.ok) throw new Error(await res.text());
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
  if (!sel) return;
  try {
    const emps = (typeof loadEmployees === 'function') ? await loadEmployees() : [];
    if (!Array.isArray(emps) || emps.length === 0) {
      sel.innerHTML = '<option value="">No employees available</option>';
      return;
    }
    sel.innerHTML = ['<option value="">Select Employee</option>']
      .concat(emps.map(e => `<option value="${e.id}">${escapeHTML(e.name || `ID ${e.id}`)} (ID: ${e.id})</option>`))
      .join('');
  } catch (e) {
    console.error('populateEmployeeDropdown error:', e);
    sel.innerHTML = '<option value="">Failed to load employees</option>';
  }
}

window.showDeductionForm = async () => {
  // Hide open tables/forms
  document.querySelectorAll('[id^="table-container-"]').forEach(d => d.style.display = 'none');
  document.querySelectorAll('[id^="form-container-"]').forEach(d => d.style.display = 'none');

  // Ensure form container
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
    <form id="deductionForm" autocomplete="off">
      <label>Employee (required):<br>
        <select id="ded_employee_id" required>
          <option value="">Loading employees...</option>
        </select>
      </label><br><br>

      <label>Month (YYYY-MM, required):<br>
        <input type="month" id="ded_month" required>
      </label><br><br>

      <label>Reason (required):<br>
        <select id="ded_reason" required>
          <option value="">Select</option>
          <option value="Fine">Fine</option>
          <option value="Uniform">Uniform</option>
          <option value="Other">Other</option>
        </select>
      </label><br><br>

      <label>Amount (₹, required):<br>
        <input type="number" id="ded_amount" min="0" step="1" required>
      </label><br><br>

      <label>Note (optional):<br>
        <input type="text" id="ded_note" placeholder="Optional remarks">
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
      const res = await fetch('/api/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id, month, reason, amount, note })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Deduction saved');
      form.reset();
    } catch (err) {
      console.error('Create deduction error:', err);
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      submitBtn.disabled = false;
    }
  });
};

// === EDIT DEDUCTION MODAL ===
// Schema: id, employee_id, amount, reason, date, month
// Uses optional employee dropdown if loadEmployees() is available.
window.openEditDeduction = async (id) => {
  try {
    const r = await fetch(`/api/deductions/${id}`);
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();

    // Try to load employees for a nicer dropdown; fall back to plain input if not available
    let employees = [];
    try {
      if (typeof fetchEmployeesList === 'function') {
        const employees = await fetchEmployeesList();
      } else {
        const rr = await fetch('/api/employees');
        if (rr.ok) employees = await rr.json();
      }
    } catch (_) {}

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;min-width:360px;max-width:640px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

    const empSelect = (Array.isArray(employees) && employees.length)
      ? `<select id="ded_employee_id">
           ${employees.map(e => `<option value="${e.id}" ${Number(e.id)===Number(d.employee_id)?'selected':''}>${(e.name||'Employee')} (ID: ${e.id})</option>`).join('')}
         </select>`
      : `<input type="number" id="ded_employee_id" value="${d.employee_id ?? ''}" placeholder="Employee ID">`;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Deduction #${id}</h3>
        <button id="ded-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="dedEditForm">
        <label>Employee:<br>${empSelect}</label><br><br>
        <label>Amount:<br><input type="number" step="0.01" id="ded_amount" value="${d.amount ?? ''}" required></label><br><br>
        <label>Reason:<br><input type="text" id="ded_reason" value="${d.reason || ''}"></label><br><br>
        <label>Date:<br><input type="date" id="ded_date" value="${String(d.date||'').slice(0,10)}"></label><br><br>
        <label>Month (YYYY-MM):<br><input type="text" id="ded_month" value="${d.month || ''}" placeholder="2025-09"></label><br><br>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" id="ded-edit-cancel">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('ded-edit-close').onclick = close;
    document.getElementById('ded-edit-cancel').onclick = close;

    document.getElementById('dedEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const employee_id = (() => {
        const el = document.getElementById('ded_employee_id');
        return el.tagName === 'SELECT' ? parseInt(el.value,10) : parseInt(el.value,10);
      })();
      const payload = {
        employee_id: Number.isFinite(employee_id) ? employee_id : d.employee_id,
        amount: parseFloat(document.getElementById('ded_amount').value || 0) || 0,
        reason: document.getElementById('ded_reason').value.trim(),
        date: document.getElementById('ded_date').value || d.date,
        month: document.getElementById('ded_month').value.trim() || d.month
      };
      try {
        const u = await fetch(`/api/deductions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!u.ok) throw new Error(await u.text());
        alert('Deduction updated');
        close();
        if (window.showTable) window.showTable('deductions');
      } catch (err) {
        console.error('deduction update error:', err);
        alert('Update failed: ' + (err.message || 'Unknown error'));
      }
    });
  } catch (e) {
    console.error('openEditDeduction error:', e);
    alert('Failed to open editor: ' + (e.message || 'Unknown'));
  }
};
