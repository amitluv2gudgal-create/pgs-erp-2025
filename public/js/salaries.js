export const loadSalaries = async () => {
  const res = await fetch('/api/salaries');
  return await res.json();
};

window.showSalaryForm = () => {
  const content = document.getElementById('content');
  content.innerHTML += `
    <h3>Generate Salary</h3>
    <form id="salaryForm">
      <input type="number" placeholder="Employee ID" id="employee_id" required><br>
      <input type="month" id="month" value="2025-09" required><br>
      <button type="submit">Generate</button>
    </form>
  `;
  document.getElementById('salaryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = document.getElementById('employee_id').value;
    const month = document.getElementById('month').value || '2025-09';
    if (!employee_id) {
      alert('Please enter a valid Employee ID');
      return;
    }
    const res = await fetch(`/api/salaries/generate/${employee_id}/${month}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary.pdf`;
      a.click();
    } else {
      const error = await res.json();
      alert(`Error generating salary: ${error.error || 'Unknown error'}`);
    }
  });
};

window.showSalaryForm = showSalaryForm;