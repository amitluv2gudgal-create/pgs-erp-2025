// async function fetchEmployeesList() {
//   try {
//     const r = await fetch('/api/employees');
//     if (!r.ok) throw new Error(await r.text());
//     const list = await r.json();
//     return Array.isArray(list) ? list : [];
//   } catch (e) {
//     console.error('fetchEmployeesList error:', e);
//     return [];
//   }
// }


// export const loadSalaries = async () => {
//   const res = await fetch('/api/salaries');
//   return await res.json();
// };

// window.showSalaryForm = () => {
//   const content = document.getElementById('content');
//   content.innerHTML += `
//     <h3>Generate Salary</h3>
//     <form id="salaryForm">
//       <input type="number" placeholder="Employee ID" id="employee_id" required><br>
//       <input type="month" id="month" value="2025-09" required><br>
//       <button type="submit">Generate</button>
//     </form>
//   `;
//   document.getElementById('salaryForm').addEventListener('submit', async (e) => {
//     e.preventDefault();
//     const employee_id = document.getElementById('employee_id').value;
//     const month = document.getElementById('month').value || '2025-09';
//     if (!employee_id) {
//       alert('Please enter a valid Employee ID');
//       return;
//     }
//     const res = await fetch(`/api/salaries/generate/${employee_id}/${month}`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' }
//     });
//     if (res.ok) {
//       const blob = await res.blob();
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = `salary.pdf`;
//       a.click();
//     } else {
//       const error = await res.json();
//       alert(`Error generating salary: ${error.error || 'Unknown error'}`);
//     }
//   });
// };

// window.showSalaryForm = showSalaryForm;

// // === EDIT SALARY MODAL ===
// // Schema: id, employee_id, month, attendance_days, amount, deductions, net_amount, salary_date
// // Tries to load employees for dropdown.
// window.openEditSalary = async (id) => {
//   try {
//     const r = await fetch(`/api/salaries/${id}`);
//     if (!r.ok) throw new Error(await r.text());
//     const s = await r.json();

//     // Load employees
//     let employees = [];
//     try {
//       if (typeof fetchEmployeesList === 'function') {
//         const employees = await fetchEmployeesList();

//       } else {
//         const rr = await fetch('/api/employees');
//         if (rr.ok) employees = await rr.json();
//       }
//     } catch (_) {}

//     const overlay = document.createElement('div');
//     overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';
//     const card = document.createElement('div');
//     card.style.cssText = 'background:#fff;min-width:420px;max-width:900px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);max-height:90vh;overflow:auto';

//     const empSelect = (Array.isArray(employees) && employees.length)
//       ? `<select id="sal_employee_id">
//            ${employees.map(e => `<option value="${e.id}" ${Number(e.id)===Number(s.employee_id)?'selected':''}>${(e.name||'Employee')} (ID: ${e.id})</option>`).join('')}
//          </select>`
//       : `<input type="number" id="sal_employee_id" value="${s.employee_id ?? ''}" placeholder="Employee ID">`;

//     card.innerHTML = `
//       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
//         <h3 style="margin:0;">Edit Salary #${id}</h3>
//         <button id="sal-edit-close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
//       </div>
//       <form id="salEditForm">
//         <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
//           <label>Employee:<br>${empSelect}</label>
//           <label>Month (YYYY-MM):<br><input type="text" id="sal_month" value="${s.month || ''}" placeholder="2025-09"></label>
//           <label>Attendance Days:<br><input type="number" step="1" id="sal_attendance_days" value="${s.attendance_days ?? ''}"></label>
//           <label>Amount:<br><input type="number" step="0.01" id="sal_amount" value="${s.amount ?? ''}"></label>
//           <label>Deductions:<br><input type="number" step="0.01" id="sal_deductions" value="${s.deductions ?? ''}"></label>
//           <label>Net Amount:<br><input type="number" step="0.01" id="sal_net_amount" value="${s.net_amount ?? ''}"></label>
//           <label>Salary Date:<br><input type="date" id="sal_salary_date" value="${String(s.salary_date||'').slice(0,10)}"></label>
//         </div>
//         <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
//           <button type="button" id="sal-edit-cancel">Cancel</button>
//           <button type="submit">Save</button>
//         </div>
//       </form>
//     `;
//     overlay.appendChild(card);
//     document.body.appendChild(overlay);

//     const close = () => overlay.remove();
//     document.getElementById('sal-edit-close').onclick = close;
//     document.getElementById('sal-edit-cancel').onclick = close;

//     document.getElementById('salEditForm').addEventListener('submit', async (e) => {
//       e.preventDefault();
//       const employee_id = (() => {
//         const el = document.getElementById('sal_employee_id');
//         return el.tagName === 'SELECT' ? parseInt(el.value,10) : parseInt(el.value,10);
//       })();
//       const payload = {
//         employee_id: Number.isFinite(employee_id) ? employee_id : s.employee_id,
//         month: document.getElementById('sal_month').value.trim() || s.month,
//         attendance_days: parseInt(document.getElementById('sal_attendance_days').value || s.attendance_days || 0, 10),
//         amount: parseFloat(document.getElementById('sal_amount').value || s.amount || 0),
//         deductions: parseFloat(document.getElementById('sal_deductions').value || s.deductions || 0),
//         net_amount: parseFloat(document.getElementById('sal_net_amount').value || s.net_amount || 0),
//         salary_date: document.getElementById('sal_salary_date').value || s.salary_date
//       };
//       try {
//         const u = await fetch(`/api/salaries/${id}`, {
//           method: 'PUT',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(payload)
//         });
//         if (!u.ok) throw new Error(await u.text());
//         alert('Salary updated');
//         close();
//         if (window.showTable) window.showTable('salaries');
//       } catch (err) {
//         console.error('salary update error:', err);
//         alert('Update failed: ' + (err.message || 'Unknown error'));
//       }
//     });
//   } catch (e) {
//     console.error('openEditSalary error:', e);
//     alert('Failed to open editor: ' + (e.message || 'Unknown'));
//   }
// };
