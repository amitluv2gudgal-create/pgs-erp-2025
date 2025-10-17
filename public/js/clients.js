// public/js/clients.js (updated to include all categories in dropdown and support multiple during creation)
export const loadClients = async () => {
  const res = await fetch('/api/clients');
  return await res.json();
};

window.showClientForm = () => {
  const content = document.getElementById('content');
  content.innerHTML += `
    <h3>Create Client</h3>
    <form id="clientForm">
      <input type="text" placeholder="Name" id="name"><br>
      <input type="text" placeholder="Address" id="address"><br>
      <input type="text" placeholder="Telephone" id="telephone"><br>
      <input type="email" placeholder="Email" id="email"><br>
      <input type="number" step="0.01" placeholder="CGST" id="cgst"><br>
      <input type="number" step="0.01" placeholder="SGST" id="sgst"><br>
      <div id="categoriesContainer">
        <h4>Categories (optional)</h4>
      </div>
      <button type="button" onclick="addCategoryField()">Add Category</button><br>
      <button type="submit">Create Client</button>
    </form>
  `;
  // Add initial category field
  addCategoryField();

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const address = document.getElementById('address').value;
    const telephone = document.getElementById('telephone').value;
    const email = document.getElementById('email').value;
    const cgst = document.getElementById('cgst').value || 0;
    const sgst = document.getElementById('sgst').value || 0;

    // Collect categories
    const categories = [];
    const categorySelects = document.querySelectorAll('#categoriesContainer select');
    const rateInputs = document.querySelectorAll('#categoriesContainer input[type="number"]');
    for (let i = 0; i < categorySelects.length; i++) {
      const category = categorySelects[i].value;
      const monthly_rate = rateInputs[i].value;
      if (category && monthly_rate > 0) {
        categories.push({ category, monthly_rate });
      }
    }

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, telephone, email, cgst, sgst })
    });
    if (res.ok) {
      const data = await res.json();
      let success = true;
      for (const cat of categories) {
        const catRes = await fetch(`/api/clients/${data.id}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cat)
        });
        if (!catRes.ok) {
          success = false;
          console.error('Error adding category:', (await catRes.json()).error);
        }
      }
      if (success) {
        alert('Client and categories created');
      } else {
        alert('Client created, but some categories failed to add');
      }
    } else {
      alert((await res.json()).error);
    }
  });
};

window.addCategoryField = () => {
  const container = document.getElementById('categoriesContainer');
  const index = container.childElementCount / 2; // Approximate, since select + input per field
  container.innerHTML += `
    <select id="category_${index}">
      <option value="">Select Category</option>
      <option value="security guard">Security Guard</option>
      <option value="lady sercher">Lady Sercher</option>
      <option value="security supervisor">Security Supervisor</option>
      <option value="assistant security officer">Assistant Security Officer</option>
      <option value="security officer">Security Officer</option>
      <option value="housekeeper">Housekeeper</option>
      <option value="housekeeping supervisor">Housekeeping Supervisor</option>
      <option value="team leader housekeeping">Team Leader Housekeeping</option>
      <option value="workman unskilled">Workman Unskilled</option>
      <option value="workman skilled">Workman Skilled</option>
    </select>
    <input type="number" step="0.01" placeholder="Monthly Rate for Category" id="monthly_rate_${index}"><br>
  `;
};

window.showCategoryForm = (clientId) => {
  const content = document.getElementById('content');
  content.innerHTML += `
    <h3>Add Category to Client ID ${clientId}</h3>
    <form id="categoryForm">
      <select id="category">
        <option value="">Select Category</option>
        <option value="security guard">Security Guard</option>
        <option value="lady sercher">Lady Sercher</option>
        <option value="security supervisor">Security Supervisor</option>
        <option value="assistant security officer">Assistant Security Officer</option>
        <option value="security officer">Security Officer</option>
        <option value="housekeeper">Housekeeper</option>
        <option value="housekeeping supervisor">Housekeeping Supervisor</option>
        <option value="team leader housekeeping">Team Leader Housekeeping</option>
        <option value="workman unskilled">Workman Unskilled</option>
        <option value="workman skilled">Workman Skilled</option>
      </select><br>
      <input type="number" step="0.01" placeholder="Monthly Rate" id="monthly_rate"><br>
      <button type="submit">Add</button>
    </form>
  `;
  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('category').value;
    const monthly_rate = document.getElementById('monthly_rate').value;
    const res = await fetch(`/api/clients/${clientId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, monthly_rate })
    });
    if (res.ok) alert('Category added');
    else alert((await res.json()).error);
  });
};

window.showClientForm = showClientForm;