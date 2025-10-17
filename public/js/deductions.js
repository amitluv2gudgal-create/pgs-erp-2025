// public/js/deductions.js

// --- helpers ---
function $(sel, root = document) { return root.querySelector(sel); }
function create(tag, props = {}) { const el = document.createElement(tag); Object.assign(el, props); return el; }

// Open a lightweight modal for the Create Deduction form
export function showDeductionForm() {
  if ($('#deduction-modal')) return;

  const overlay = create('div', { id: 'deduction-modal' });
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,.35)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const card = create('div');
  card.style.background = '#fff';
  card.style.minWidth = '320px';
  card.style.maxWidth = '520px';
  card.style.padding = '16px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,.2)';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Create Deduction</h3>
      <button id="deduction-close" title="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="deductionForm">
      <label>Employee ID<br><input type="number" id="employee_id" required></label><br><br>
      <label>Month (YYYY-MM)<br><input type="text" id="month" required pattern="\\d{4}-\\d{2}" placeholder="2025-10"></label><br><br>
      <div style="display:flex;gap:12px">
        <label style="flex:1">Fine (₹)<br><input type="number" step="0.01" id="fine" value="0" min="0"></label>
        <label style="flex:1">Uniform (₹)<br><input type="number" step="0.01" id="uniform" value="0" min="0"></label>
      </div>
      <label style="display:block;margin:10px 0;"><input type="checkbox" id="also_generate"> Also generate salary slip now</label>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button type="button" id="deduction-cancel">Cancel</button>
        <button type="submit">Save</button>
      </div>
    </form>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  $('#deduction-close', card).onclick = close;
  $('#deduction-cancel', card).onclick = close;

  $('#deductionForm', card).addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = parseInt($('#employee_id', card).value, 10);
    const month = $('#month', card).value.trim();
    const fine = parseFloat($('#fine', card).value) || 0;
    const uniform = parseFloat($('#uniform', card).value) || 0;
    const alsoGenerate = $('#also_generate', card).checked;

    if (!/^\d{4}-\d{2}$/.test(month)) { alert('Month must be in YYYY-MM'); return; }
    if (!Number.isInteger(employee_id) || employee_id <= 0) { alert('Invalid Employee ID'); return; }
    if (fine <= 0 && uniform <= 0) { alert('At least one deduction amount must be greater than 0'); return; }

    try {
      let savedCount = 0;

      // Save Fine separately if >0
      if (fine > 0) {
        const saveFine = await fetch('/api/deductions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id, month, amount: fine, reason: 'Fine' })
        });
        if (!saveFine.ok) throw new Error('Failed to save Fine deduction');
        savedCount++;
      }

      // Save Uniform separately if >0
      if (uniform > 0) {
        const saveUniform = await fetch('/api/deductions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id, month, amount: uniform, reason: 'Uniform' })
        });
        if (!saveUniform.ok) throw new Error('Failed to save Uniform deduction');
        savedCount++;
      }

      if (savedCount === 0) throw new Error('No deductions to save');

      // Optional: Generate salary slip now (pass separate fine/uniform values)
      if (alsoGenerate) {
        const resp = await fetch(`/api/salaries/generate/${employee_id}/${month}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fine, uniform })
        });
        if (!resp.ok) throw new Error('Salary slip generation failed');

        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_${employee_id}_${month}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      // Refresh the deductions table
      await window.showTable('deductions');
      close();
      alert(`${savedCount} deduction(s) saved.`);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}

// Load all deductions and return the data array (for app.js table rendering)
export async function loadDeductions() {
  try {
    const res = await fetch('/api/deductions');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : []; // Ensure array, fallback to empty
  } catch (error) {
    console.error('Error loading deductions:', error);
    return []; // Empty array on error to avoid app.js crash
  }
}

window.showDeductionForm = showDeductionForm;