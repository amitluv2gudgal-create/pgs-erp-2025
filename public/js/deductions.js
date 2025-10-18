// public/js/deductions.js
// - loadDeductions(): list for table
// - window.showDeductionForm(): render create form with Employee dropdown + clear after submit

import { loadEmployees } from './employees.js';

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
