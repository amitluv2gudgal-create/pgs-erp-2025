// public/js/attendances.js
// HR: Create Attendance (with 0/1/2 dropdown) + table loader

// function $(sel, root = document) { return root.querySelector(sel); }
// function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
// function create(tag, props = {}) { const el = document.createElement(tag); Object.assign(el, props); return el; }

// // API helpers
// async function fetchJSON(url) {
//   const r = await fetch(url);
//   if (!r.ok) throw new Error(await r.text());
//   return r.json();
// }

// async function getClients() {
//   try { return await fetchJSON('/api/clients'); } catch { return []; }
// }

// async function getEmployees() {
//   try { return await fetchJSON('/api/employees'); } catch { return []; }
// }

// // Build <option>
// function optionHTML(value, label) {
//   return `<option value="${String(value)}">${label}</option>`;
// }

// // ---------- HR FORM ----------
// // Shows modal with Employee, Client, Date and Attendance (0/1/2)
// export function showAttendanceForm() {
//   if ($('#attendance-modal')) return;

//   const overlay = create('div', { id: 'attendance-modal' });
//   Object.assign(overlay.style, {
//     position: 'fixed', inset: '0', background: 'rgba(0,0,0,.35)', zIndex: '9999',
//     display: 'flex', alignItems: 'center', justifyContent: 'center'
//   });

//   const card = create('div');
//   Object.assign(card.style, {
//     background: '#fff', minWidth: '320px', maxWidth: '560px', padding: '16px',
//     borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.2)'
//   });

//   card.innerHTML = `
//     <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
//       <h3 style="margin:0;">Create Attendance</h3>
//       <button id="attendance-close" title="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
//     </div>
//     <form id="attendanceForm">
//       <label>Employee (required):<br>
//         <select id="employee_id" required>
//           <option value="">Loading employees...</option>
//         </select>
//       </label><br><br>

//       <label>Client (required):<br>
//         <select id="client_id" required>
//           <option value="">Loading clients...</option>
//         </select>
//       </label><br><br>

//       <label>Date (required):<br>
//         <input type="date" id="date" required>
//       </label><br><br>

//       <label>Attendance (required):<br>
//         <select id="present" required>
//           <option value="1">Present (1)</option>
//           <option value="2">Weekly Off / Holiday Duty (2)</option>
//           <option value="0">Absent (0)</option>
//         </select>
//       </label><br><br>

//       <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
//         <button type="button" id="attendance-cancel">Cancel</button>
//         <button type="submit">Save</button>
//       </div>
//     </form>
//   `;

//   overlay.appendChild(card);
//   document.body.appendChild(overlay);

//   const close = () => overlay.remove();
//   $('#attendance-close', card).onclick = close;
//   $('#attendance-cancel', card).onclick = close;

//   // Populate dropdowns
//   (async () => {
//     const [employees, clients] = await Promise.all([getEmployees(), getClients()]);

//     const empSel = $('#employee_id', card);
//     if (Array.isArray(employees) && employees.length) {
//       empSel.innerHTML = ['<option value="">Select Employee</option>']
//         .concat(employees.map(e => optionHTML(e.id, `${escapeHTML(e.name)} (ID: ${e.id})`)))
//         .join('');
//     } else {
//       empSel.innerHTML = '<option value="">No employees available</option>';
//     }

//     const cliSel = $('#client_id', card);
//     if (Array.isArray(clients) && clients.length) {
//       cliSel.innerHTML = ['<option value="">Select Client</option>']
//         .concat(clients.map(c => optionHTML(c.id, `${escapeHTML(c.name)} (ID: ${c.id})`)))
//         .join('');
//     } else {
//       cliSel.innerHTML = '<option value="">No clients available</option>';
//     }

//     // Auto-select client when an employee is chosen (if employee has client_id)
//     empSel.addEventListener('change', () => {
//       const eid = parseInt(empSel.value, 10);
//       const emp = Array.isArray(employees) ? employees.find(x => x.id === eid) : null;
//       if (emp && emp.client_id) {
//         const idx = Array.prototype.findIndex.call(cliSel.options, o => Number(o.value) === Number(emp.client_id));
//         if (idx >= 0) cliSel.selectedIndex = idx;
//       }
//     });
//   })();

//   // Submit
//   $('#attendanceForm', card).addEventListener('submit', async (e) => {
//     e.preventDefault();
//     const employee_id = parseInt($('#employee_id', card).value, 10);
//     const client_id = parseInt($('#client_id', card).value, 10);
//     const date = $('#date', card).value;
//     const present = parseInt($('#present', card).value, 10); // 0/1/2

//     if (!employee_id) return alert('Please select an Employee');
//     if (!client_id) return alert('Please select a Client');
//     if (!date) return alert('Date is required');
//     if (![0,1,2].includes(present)) return alert('Attendance must be 0, 1, or 2');

//     try {
//       console.log('[HR FORM] payload:', { employee_id, client_id, date, present });
//       const response = await fetch('/api/attendances', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ employee_id, client_id, date, present }),
//   credentials: 'include'
// });


//       if (response.ok) {
//         alert('Attendance recorded successfully!');
//         close();
//         if (window.showTable) window.showTable('attendances');
//       } else {
//         const errorData = await safeJSON(response);
//         alert(`Error: ${errorData.error || 'Unknown error'}`);
//       }
//     } catch (error) {
//       console.error('Error saving attendance:', error);
//       alert(`Network error: ${error.message}`);
//     }
//   });
// }

// // Load all attendances for table view
// export const loadAttendances = async () => {
//   try {
//     const res = await fetch('/api/attendances');
//     if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
//     const data = await res.json();
//     return Array.isArray(data) ? data : [];
//   } catch (error) {
//     console.error('Error loading attendances:', error);
//     return [];
//   }
// };

// async function safeJSON(res) {
//   try { return await res.json(); } catch { return {}; }
// }
// function escapeHTML(s) {
//   if (s == null) return '';
//   return s.toString()
//     .replaceAll('&', '&amp;')
//     .replaceAll('<', '&lt;')
//     .replaceAll('>', '&gt;')
//     .replaceAll('"', '&quot;')
//     .replaceAll("'", '&#39;');
// }
// window.showAttendanceForm = showAttendanceForm;

// // ========== Helpers appended for cohesion with app.js ==========

// // Universal loader for attendances (used by app.js -> loadAttendances())
// // rename the appended one
// async function fetchAttendancesList() {
//   try {
//     const res = await fetch('/api/attendances');
//     if (!res.ok) throw new Error(await res.text());
//     const rows = await res.json();
//     return Array.isArray(rows) ? rows : [];
//   } catch (err) {
//     console.error('fetchAttendancesList error:', err);
//     return [];
//   }
// }


// // Optional: expose wrappers that delegate to the global handlers defined in app.js
// // This avoids duplication if some parts of UI call functions from attendances.js

// export function openEditAttendance(id) {
//   if (typeof window.editAttendance === 'function') {
//     window.editAttendance(id);
//   } else {
//     console.warn('editAttendance modal function not found on window');
//   }
// }

// export async function approveAttendance(id) {
//   if (typeof window.approveAttendance === 'function') {
//     return window.approveAttendance(id);
//   }
//   // Fallback direct call:
//   try {
//     const r = await fetch(`/api/attendances/${id}/approve`, { method: 'POST' });
//     if (!r.ok) throw new Error(await r.text());
//     alert('Attendance verified');
//   } catch (e) {
//     console.error('approveAttendance error:', e);
//     alert('Failed: ' + (e.message || 'Unknown'));
//   }
// }

// export async function rejectAttendance(id) {
//   if (typeof window.rejectAttendance === 'function') {
//     return window.rejectAttendance(id);
//   }
//   try {
//     const r = await fetch(`/api/attendances/${id}/reject`, { method: 'POST' });
//     if (!r.ok) throw new Error(await r.text());
//     alert('Attendance rejected');
//   } catch (e) {
//     console.error('rejectAttendance error:', e);
//     alert('Failed: ' + (e.message || 'Unknown'));
//   }
// }

// export async function deleteAttendance(id) {
//   if (typeof window.deleteAttendance === 'function') {
//     return window.deleteAttendance(id);
//   }
//   try {
//     if (!confirm(`Delete attendance #${id}?`)) return;
//     const r = await fetch(`/api/attendances/${id}`, { method: 'DELETE' });
//     if (!r.ok) throw new Error(await r.text());
//     alert('Deleted');
//   } catch (e) {
//     console.error('deleteAttendance error:', e);
//     alert('Failed: ' + (e.message || 'Unknown'));
//   }
// }
