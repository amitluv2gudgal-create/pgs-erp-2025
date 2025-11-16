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


export const loadSalaries = async () => {
  const res = await fetch('/api/salaries');
  return await res.json();
};

// Replace existing window.showSalaryForm with this implementation
// Self-contained: includes escapeHtml helper and robust employee loading.

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.showSalaryForm = async () => {
  // helper to fetch employees (attempt several fallbacks)
  const getEmployees = async () => {
    // 1) try existing helper fetchEmployeesList()
    try {
      if (typeof fetchEmployeesList === 'function') {
        const list = await fetchEmployeesList();
        if (Array.isArray(list) && list.length) return list;
      }
    } catch (e) {
      console.warn('fetchEmployeesList helper failed:', e);
    }

    // 2) try direct fetch to /api/employees with cookies
    try {
      const resp = await fetch('/api/employees', { credentials: 'include' });
      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list)) return list;
      } else {
        console.warn('/api/employees returned', resp.status);
      }
    } catch (e) {
      console.warn('Direct fetch /api/employees failed:', e);
    }

    // 3) try loadEmployees() fallback
    try {
      if (typeof loadEmployees === 'function') {
        const list = await loadEmployees();
        if (Array.isArray(list)) return list;
      }
    } catch (e) {
      console.warn('loadEmployees fallback failed:', e);
    }

    return [];
  };

  // create overlay + modal
  const overlay = document.createElement('div');
  overlay.id = 'salaryModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;width:520px;max-width:96%;padding:18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-height:90vh;overflow:auto;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0">Generate Salary</h3>
      <button id="salaryModalClose" style="font-size:22px;border:none;background:transparent;cursor:pointer">&times;</button>
    </div>

    <form id="salaryModalForm" style="display:grid;grid-template-columns:1fr;gap:10px;">
      <label>Employee (required):<br>
        <select id="salary_employee_select" required style="width:100%;padding:8px;">
          <option>Loading employees...</option>
        </select>
      </label>

      <label>Month (YYYY-MM, required):<br>
        <input type="month" id="salary_month" required style="width:100%;padding:8px;">
      </label>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
        <button type="button" id="salary_reset_btn" style="padding:8px 12px;">Reset</button>
        <button type="button" id="salary_cancel_btn" style="padding:8px 12px;">Cancel</button>
        <button type="submit" id="salary_generate_btn" style="background:#007bff;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer">Generate</button>
      </div>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // handlers
  document.getElementById('salaryModalClose').onclick = () => overlay.remove();
  document.getElementById('salary_cancel_btn').onclick = () => overlay.remove();

  const empSelect = document.getElementById('salary_employee_select');
  const monthInput = document.getElementById('salary_month');
  const resetBtn = document.getElementById('salary_reset_btn');
  const submitBtn = document.getElementById('salary_generate_btn');

  // prefill month with current month if empty
  if (!monthInput.value) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    monthInput.value = `${y}-${m}`;
  }

  // populate employees
  empSelect.disabled = true;
  empSelect.innerHTML = '<option>Loading employees...</option>';
  try {
    const emps = await getEmployees();

    if (!Array.isArray(emps) || emps.length === 0) {
      empSelect.innerHTML = '<option value="">No employees available</option>';
      empSelect.disabled = true;
    } else {
      empSelect.disabled = false;
      const options = ['<option value="">-- Select Employee --</option>'];
      for (const e of emps) {
        const id = e.id ?? e.employee_id ?? e.employeeId ?? '';
        const name = e.name ?? e.full_name ?? e.employee_name ?? (`ID ${id}`);
        const extra = e.designation ? ` - ${e.designation}` : (e.site_name ? ` - ${e.site_name}` : '');
        options.push(`<option value="${escapeHtml(id)}">${escapeHtml(name + extra)} (ID: ${escapeHtml(id)})</option>`);
      }
      empSelect.innerHTML = options.join('');
    }
  } catch (err) {
    console.error('populate employees failed:', err);
    empSelect.innerHTML = '<option value="">Failed to load employees</option>';
    empSelect.disabled = true;
  }

  // Reset behavior
  resetBtn.onclick = () => {
    try {
      document.getElementById('salaryModalForm').reset();
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      // repopulate employees
      (async () => {
        empSelect.disabled = true;
        empSelect.innerHTML = '<option>Loading employees...</option>';
        const emps = await getEmployees();
        if (!Array.isArray(emps) || emps.length === 0) {
          empSelect.innerHTML = '<option value="">No employees available</option>';
          empSelect.disabled = true;
        } else {
          empSelect.disabled = false;
          const opts = ['<option value="">-- Select Employee --</option>'];
          for (const e of emps) {
            const id = e.id ?? e.employee_id ?? e.employeeId ?? '';
            const name = e.name ?? e.full_name ?? e.employee_name ?? (`ID ${id}`);
            const extra = e.designation ? ` - ${e.designation}` : (e.site_name ? ` - ${e.site_name}` : '');
            opts.push(`<option value="${escapeHtml(id)}">${escapeHtml(name + extra)} (ID: ${escapeHtml(id)})</option>`);
          }
          empSelect.innerHTML = opts.join('');
        }
      })();
    } catch (e) {
      console.warn('Reset failed', e);
    }
  };

  // submit/generate
  document.getElementById('salaryModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;

    const employeeId = empSelect.value;
    const month = monthInput.value;

    if (!employeeId) {
      alert('Please select an employee.');
      submitBtn.disabled = false;
      return;
    }
    if (!month) {
      alert('Please select month.');
      submitBtn.disabled = false;
      return;
    }

    try {
      const url = `/api/salaries/generate/${encodeURIComponent(employeeId)}/${encodeURIComponent(month)}`;
      const resp = await fetch(url, { method: 'POST', credentials: 'include' });

      if (!resp.ok) {
        let msg = 'Failed to generate salary';
        try { const body = await resp.json(); msg = body.error || JSON.stringify(body); } catch(_) { msg = await resp.text().catch(()=>msg); }
        throw new Error(msg);
      }

      // Expect a PDF blob to download
      const blob = await resp.blob();
      const filename = `salary_${employeeId}_${month}.pdf`;
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      overlay.remove();
      if (typeof window.showTable === 'function') try { window.showTable('salaries'); } catch(_) {}
      if (typeof window.loadSalaries === 'function') try { window.loadSalaries(); } catch(_) {}
    } catch (err) {
      console.error('Generate salary error:', err);
      alert('Error: ' + (err.message || 'Unknown error'));
    } finally {
      submitBtn.disabled = false;
    }
  });
};

window.showSalaryForm = showSalaryForm;

// === EDIT SALARY MODAL ===
// Schema: id, employee_id, month, attendance_days, amount, deductions, net_amount, salary_date
// Tries to load employees for dropdown.
window.openEditSalary = async (id) => {
  try {
    const r = await fetch(`/api/salaries/${id}`);
    if (!r.ok) throw new Error(await r.text());
    const s = await r.json();

    // Load employees
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
    card.style.cssText = 'background:#fff;min-width:420px;max-width:900px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);max-height:90vh;overflow:auto';

    const empSelect = (Array.isArray(employees) && employees.length)
      ? `<select id="sal_employee_id">
           ${employees.map(e => `<option value="${e.id}" ${Number(e.id)===Number(s.employee_id)?'selected':''}>${(e.name||'Employee')} (ID: ${e.id})</option>`).join('')}
         </select>`
      : `<input type="number" id="sal_employee_id" value="${s.employee_id ?? ''}" placeholder="Employee ID">`;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;">Edit Salary #${id}</h3>
        <button id="sal-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
      </div>
      <form id="salEditForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>Employee:<br>${empSelect}</label>
          <label>Month (YYYY-MM):<br><input type="text" id="sal_month" value="${s.month || ''}" placeholder="2025-09"></label>
          <label>Attendance Days:<br><input type="number" step="1" id="sal_attendance_days" value="${s.attendance_days ?? ''}"></label>
          <label>Amount:<br><input type="number" step="0.01" id="sal_amount" value="${s.amount ?? ''}"></label>
          <label>Deductions:<br><input type="number" step="0.01" id="sal_deductions" value="${s.deductions ?? ''}"></label>
          <label>Net Amount:<br><input type="number" step="0.01" id="sal_net_amount" value="${s.net_amount ?? ''}"></label>
          <label>Salary Date:<br><input type="date" id="sal_salary_date" value="${String(s.salary_date||'').slice(0,10)}"></label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <button type="button" id="sal-edit-cancel">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('sal-edit-close').onclick = close;
    document.getElementById('sal-edit-cancel').onclick = close;

    document.getElementById('salEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const employee_id = (() => {
        const el = document.getElementById('sal_employee_id');
        return el.tagName === 'SELECT' ? parseInt(el.value,10) : parseInt(el.value,10);
      })();
      const payload = {
        employee_id: Number.isFinite(employee_id) ? employee_id : s.employee_id,
        month: document.getElementById('sal_month').value.trim() || s.month,
        attendance_days: parseInt(document.getElementById('sal_attendance_days').value || s.attendance_days || 0, 10),
        amount: parseFloat(document.getElementById('sal_amount').value || s.amount || 0),
        deductions: parseFloat(document.getElementById('sal_deductions').value || s.deductions || 0),
        net_amount: parseFloat(document.getElementById('sal_net_amount').value || s.net_amount || 0),
        salary_date: document.getElementById('sal_salary_date').value || s.salary_date
      };
      try {
        const u = await fetch(`/api/salaries/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!u.ok) throw new Error(await u.text());
        alert('Salary updated');
        close();
        if (window.showTable) window.showTable('salaries');
      } catch (err) {
        console.error('salary update error:', err);
        alert('Update failed: ' + (err.message || 'Unknown error'));
      }
    });
  } catch (e) {
    console.error('openEditSalary error:', e);
    alert('Failed to open editor: ' + (e.message || 'Unknown'));
  }
};
