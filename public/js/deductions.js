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

// Robust populateEmployeeDropdown: uses /api/employees and falls back to loadEmployees() if defined
async function populateEmployeeDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  try {
    // Try direct fetch first (ensures credentials are sent)
    let emps = [];
    try {
      const resp = await fetch('/api/employees', { credentials: 'include' });
      if (resp.ok) {
        emps = await resp.json();
      } else {
        // fallback to loadEmployees if available
        if (typeof loadEmployees === 'function') {
          emps = await loadEmployees();
        } else {
          emps = [];
        }
      }
    } catch (e) {
      // fetch failed, try loadEmployees global if present
      if (typeof loadEmployees === 'function') {
        try { emps = await loadEmployees(); } catch(_) { emps = []; }
      } else {
        emps = [];
      }
    }

    if (!Array.isArray(emps) || emps.length === 0) {
      sel.innerHTML = '<option value="">No employees available</option>';
      sel.disabled = true;
      return;
    }

    sel.disabled = false;
    sel.innerHTML = '<option value="">Select Employee</option>' +
      emps.map(e => {
        // adapt to common shapes: prefer name, employee_id or id
        const id = e.id ?? e.employee_id ?? '';
        const name = e.name ?? e.full_name ?? e.employee_name ?? (`ID ${id}`);
        return `<option value="${id}">${escapeHTML(name)} (ID: ${id})</option>`;
      }).join('');
  } catch (err) {
    console.error('populateEmployeeDropdown error:', err);
    sel.innerHTML = '<option value="">Failed to load employees</option>';
    sel.disabled = true;
  }
}

// Floating modal Create Deduction form (replace existing window.showDeductionForm)
window.showDeductionForm = async () => {
  // Helper fetch that includes cookies
  const fetchAuth = (url, opts = {}) => fetch(url, { credentials: 'include', ...opts });

  // Create overlay + modal
  const overlay = document.createElement('div');
  overlay.id = 'deductionModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;width:560px;max-width:96%;padding:18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-height:85vh;overflow:auto;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 style="margin:0">Create Deduction</h3>
      <button id="deductionModalCloseBtn" style="font-size:22px;border:none;background:transparent;cursor:pointer">&times;</button>
    </div>

    <form id="deductionFormModal" style="display:grid;grid-template-columns:1fr;gap:10px;">
      <label>Employee (required):<br>
        <select id="ded_employee_id_modal" required style="width:100%;padding:8px;">
          <option>Loading employees...</option>
        </select>
      </label>

      <label>Month (YYYY-MM, required):<br>
        <input type="month" id="ded_month_modal" required style="width:100%;padding:8px;">
      </label>

      <label>Reason (required):<br>
        <select id="ded_reason_modal" required style="width:100%;padding:8px;">
          <option value="">Select</option>
          <option value="Fine">Fine</option>
          <option value="Uniform">Uniform</option>
          <option value="Other">Other</option>
        </select>
      </label>

      <label>Amount (₹, required):<br>
        <input type="number" id="ded_amount_modal" min="0" step="0.01" required style="width:100%;padding:8px;">
      </label>

      <label>Note (optional):<br>
        <input type="text" id="ded_note_modal" placeholder="Optional remarks" style="width:100%;padding:8px;">
      </label>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
        <button type="button" id="ded_reset_modal" style="padding:8px 12px;">Reset</button>
        <button type="button" id="ded_cancel_modal" style="padding:8px 12px;">Cancel</button>
        <button type="submit" id="ded_submit_modal" style="background:#007bff;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer">Save</button>
      </div>
    </form>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // close handlers
  const closeOverlay = () => {
    try { overlay.remove(); } catch(_) {}
  };
  document.getElementById('deductionModalCloseBtn').onclick = closeOverlay;
  document.getElementById('ded_cancel_modal').onclick = closeOverlay;

  // Populate employee dropdown (uses the replacement function above)
  await populateEmployeeDropdown('ded_employee_id_modal');

  // Prefill month with current month
  const monthInput = document.getElementById('ded_month_modal');
  if (!monthInput.value) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    monthInput.value = `${y}-${m}`;
  }

  // Reset behaviour
  document.getElementById('ded_reset_modal').onclick = () => {
    document.getElementById('deductionFormModal').reset();
    // refresh employees dropdown (in case something changed)
    populateEmployeeDropdown('ded_employee_id_modal');
    // refill month
    const now = new Date(); monthInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  };

  // Submit handler
  document.getElementById('deductionFormModal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('ded_submit_modal');
    submitBtn.disabled = true;

    const employee_id = document.getElementById('ded_employee_id_modal').value;
    const month = document.getElementById('ded_month_modal').value;
    const reason = document.getElementById('ded_reason_modal').value;
    const amount = Number(document.getElementById('ded_amount_modal').value || 0);
    const note = document.getElementById('ded_note_modal').value.trim();

    if (!employee_id) { alert('Please select an employee'); submitBtn.disabled = false; return; }
    if (!month) { alert('Please select month'); submitBtn.disabled = false; return; }
    if (!reason) { alert('Please select a reason'); submitBtn.disabled = false; return; }
    if (!(amount > 0)) { alert('Amount must be greater than 0'); submitBtn.disabled = false; return; }

    const payload = { employee_id: Number(employee_id), month, reason, amount, note };

    try {
      const res = await fetchAuth('/api/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || 'Server error ' + res.status);
      }

      alert('Deduction saved.');
      closeOverlay();
      // refresh UI if functions exist
      if (typeof window.showTable === 'function') try { window.showTable('deductions'); } catch(e) {}
      if (typeof window.loadDeductions === 'function') try { window.loadDeductions(); } catch(e) {}
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
