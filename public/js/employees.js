// public/js/employees.js
const token = localStorage.getItem('token');
if (!token) {
  // optional: redirect to login
  // location.href = '/login.html';
}

const empForm = document.getElementById('empForm');
const employeesTableBody = document.querySelector('#employeesTable tbody');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');

async function loadEmployees(){
  const r = await fetch('/api/employees', { headers: { Authorization: 'Bearer ' + token }});
  if (!r.ok) { console.error('Failed to load employees'); return; }
  const list = await r.json();
  employeesTableBody.innerHTML = '';
  for (const e of list){
    const tr = document.createElement('tr');
    const clientName = e.client ? e.client.name : '';
    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.name}</td>
      <td>${e.employeeId}</td>
      <td>${e.category}</td>
      <td>${clientName}</td>
      <td>${Number(e.salary_per_month||0).toFixed(2)}</td>
      <td>
        <button class="edit" data-id="${e.id}">Edit</button>
        <button class="del" data-id="${e.id}">Delete</button>
      </td>
    `;
    employeesTableBody.appendChild(tr);
  }
}

empForm.addEventListener('submit', async (ev)=> {
  ev.preventDefault();
  const fd = new FormData(empForm);
  const payload = Object.fromEntries(fd.entries());
  // convert numeric fields
  if (payload.clientId) payload.clientId = parseInt(payload.clientId);
  if (payload.salary_per_month) payload.salary_per_month = parseFloat(payload.salary_per_month);

  const existingId = document.getElementById('empId').value;
  if (existingId) {
    // update
    const r = await fetch(`/api/employees/${existingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Update failed'); return; }
    alert('Employee updated');
  } else {
    // create
    const r = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Create failed'); return; }
    alert('Employee created');
  }
  empForm.reset(); document.getElementById('empId').value = '';
  saveBtn.textContent = 'Create Employee';
  loadEmployees();
});

employeesTableBody.addEventListener('click', async (ev) => {
  const target = ev.target;
  if (target.matches('.edit')) {
    const id = target.dataset.id;
    const r = await fetch(`/api/employees/${id}`, { headers: { Authorization: 'Bearer ' + token }});
    if (!r.ok) { alert('Failed to fetch'); return; }
    const e = await r.json();
    // load into form
    document.getElementById('empId').value = e.id;
    empForm.elements['name'].value = e.name || '';
    empForm.elements['employeeId'].value = e.employeeId || '';
    empForm.elements['father_name'].value = e.father_name || '';
    empForm.elements['local_address'].value = e.local_address || '';
    empForm.elements['permanent_address'].value = e.permanent_address || '';
    empForm.elements['telephone'].value = e.telephone || '';
    empForm.elements['email'].value = e.email || '';
    empForm.elements['marital_status'].value = e.marital_status || '';
    empForm.elements['spouse_name'].value = e.spouse_name || '';
    empForm.elements['next_kin_name'].value = e.next_kin_name || '';
    empForm.elements['next_kin_telephone'].value = e.next_kin_telephone || '';
    empForm.elements['next_kin_address'].value = e.next_kin_address || '';
    empForm.elements['identifier_name'].value = e.identifier_name || '';
    empForm.elements['identifier_address'].value = e.identifier_address || '';
    empForm.elements['identifier_telephone'].value = e.identifier_telephone || '';
    empForm.elements['epf_number'].value = e.epf_number || '';
    empForm.elements['esic_number'].value = e.esic_number || '';
    empForm.elements['criminal_record'].value = e.criminal_record || '';
    empForm.elements['salary_per_month'].value = e.salary_per_month || '';
    empForm.elements['category'].value = e.category || '';
    empForm.elements['clientId'].value = e.clientId || '';
    saveBtn.textContent = 'Update Employee';
    window.scrollTo(0,0);
  } else if (target.matches('.del')) {
    if (!confirm('Delete employee?')) return;
    const id = target.dataset.id;
    const r = await fetch(`/api/employees/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }});
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Delete failed'); return; }
    alert('Employee deleted');
    loadEmployees();
  }
});

resetBtn.addEventListener('click', ()=> {
  empForm.reset();
  document.getElementById('empId').value = '';
  saveBtn.textContent = 'Create Employee';
});

window.addEventListener('load', loadEmployees);
