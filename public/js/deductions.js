// public/js/deductions.js  (patched)
// - fixed employee-loading bugs
// - robust fetch using window.fetchWrapper if available
// - safer event binding for create/edit forms

// Local helper: fetch employees list from backend (returns array)
async function fetchEmployeesList() {
  try {
    const loader = window.fetchWrapper
      ? (url, opts) => window.fetchWrapper(url, opts).then(r => r.body)
      : async (url, opts) => {
          const r = await fetch(url, opts || {});
          if (!r.ok) throw new Error(await r.text());
          return await r.json();
        };

    const body = await loader('/api/employees', { method: 'GET' });
    // backend may return { employees: [...] } or an array directly
    if (!body) return [];
    if (Array.isArray(body)) return body;
    if (Array.isArray(body.employees)) return body.employees;
    // if it's an object map, coerce to array of values
    if (typeof body === 'object') return Object.values(body);
    return [];
  } catch (e) {
    console.error('fetchEmployeesList error:', e);
    return [];
  }
}

// Exposed: loadDeductions (keeps your original API)
export async function loadDeductions() {
  try {
    const r = await fetch('/api/deductions');
    if (!r.ok) throw new Error(await r.text());
    const body = await r.json();
    // normalize response
    return Array.isArray(body) ? body : (body && body.deductions ? body.deductions : []);
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

// populate employee <select> by element ID
async function populateEmployeeDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // show loading state
  sel.innerHTML = '<option value="">Loading employees…</option>';
  try {
    const emps = await fetchEmployeesList();
    if (!Array.isArray(emps) || emps.length === 0) {
      sel.innerHTML = '<option value="">No employees available</option>';
      sel.dataset.empty = '1';
      return;
    }
    sel.dataset.empty = '0';
    const opts = ['<option value="">Select Employee</option>']
      .concat(emps.map(e => {
        const id = e.id ?? e.employee_id ?? e.emp_id ?? '';
        const name = escapeHTML(e.name ?? e.fullname ?? e.employee_name ?? `Employee ${id}`);
        return `<option value="${id}">${name} (ID: ${id})</option>`;
      }));
    sel.innerHTML = opts.join('');
  } catch (e) {
    console.error('populateEmployeeDropdown error:', e);
    sel.innerHTML = '<option value="">Failed to load employees</option>';
    sel.dataset.empty = '1';
  }
}

// === CREATE Deduction form renderer ===
window.showDeductionForm = async () => {
  // Hide open tables/forms (your pattern)
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

  // populate employees
  await populateEmployeeDropdown('ded_employee_id');

  // Bind form safely (avoid duplicate bindings)
  const form = document.getElementById('deductionForm');
  if (!form) return;
  if (!form.dataset.bound) {
    document.getElementById('ded_reset').onclick = () => form.reset();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('ded_submit');
      submitBtn.disabled = true;

      const employee_id_val = document.getElementById('ded_employee_id').value;
      const employee_id = employee_id_val ? parseInt(employee_id_val, 10) : null;
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
        if (!res.ok) {
          const text = await res.text().catch(() => 'Server error');
          throw new Error(text);
        }
        alert('Deduction saved');
        form.reset();
        // refresh table if available
        if (window.showTable) window.showTable('deductions');
      } catch (err) {
        console.error('Create deduction error:', err);
        alert('Failed to save: ' + (err.message || 'Unknown error'));
      } finally {
        submitBtn.disabled = false;
      }
    });

    form.dataset.bound = '1';
  }
};

// === EDIT DEDUCTION MODAL ===
window.openEditDeduction = async (id) => {
  try {
    const r = await fetch(`/api/deductions/${id}`);
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();

    // Try to load employees for a nicer dropdown; fall back to plain input if not available
    let employees = [];
    try {
      employees = await fetchEmployeesList();
    } catch (_) {
      employees = [];
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;min-width:360px;max-width:640px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

    const empSelect = (Array.isArray(employees) && employees.length)
      ? `<select id="ded_employee_id_edit">
           ${employees.map(e => {
             const id = e.id ?? e.employee_id ?? e.emp_id ?? '';
             const sel = Number(id) === Number(d.employee_id) ? 'selected' : '';
             const name = escapeHTML(e.name ?? e.fullname ?? `Employee ${id}`);
             return `<option value="${id}" ${sel}>${name} (ID: ${id})</option>`;
           }).join('')}
         </select>`
      : `<input type="number" id="ded_employee_id_edit" value="${d.employee_id ?? ''}" placeholder="Employee ID">`;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Deduction #${escapeHTML(id)}</h3>
        <button id="ded-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="dedEditForm">
        <label>Employee:<br>${empSelect}</label><br><br>
        <label>Amount:<br><input type="number" step="0.01" id="ded_amount" value="${escapeHTML(d.amount ?? '')}" required></label><br><br>
        <label>Reason:<br><input type="text" id="ded_reason" value="${escapeHTML(d.reason || '')}"></label><br><br>
        <label>Date:<br><input type="date" id="ded_date" value="${escapeHTML(String(d.date||'').slice(0,10))}"></label><br><br>
        <label>Month (YYYY-MM):<br><input type="text" id="ded_month" value="${escapeHTML(d.month || '')}" placeholder="2025-09"></label><br><br>
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
      const empEl = document.getElementById('ded_employee_id_edit');
      const employee_id = empEl.tagName === 'SELECT' ? parseInt(empEl.value, 10) : parseInt(empEl.value, 10);
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
