// Local helper to avoid name clashes
// Local, collision-free helper
async function fetchClientsListSafe() {
  try {
    const r = await fetch('/api/clients');
    if (!r.ok) throw new Error(await r.text());
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('fetchClientsListSafe error:', e);
    return [];
  }
}


// Show form for generating invoice
export function showInvoiceForm() {
  if (document.getElementById('invoice-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'invoice-modal';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,.35)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const card = document.createElement('div');
  card.style.background = '#fff';
  card.style.minWidth = '320px';
  card.style.maxWidth = '520px';
  card.style.padding = '16px';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,.2)';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Generate Invoice</h3>
      <button id="invoice-close" title="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer">&times;</button>
    </div>
    <form id="invoiceForm">
      <label>Client:<br><select id="client_id" required></select></label><br><br>
      <label>Invoice No (optional):<br><input type="text" id="invoice_no"></label><br><br>
      <label>Month (YYYY-MM, required):<br><input type="month" id="month" required></label><br><br>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button type="button" id="invoice-cancel">Cancel</button>
        <button type="submit">Generate</button>
      </div>
    </form>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('invoice-close').onclick = close;
  document.getElementById('invoice-cancel').onclick = close;

  // Populate client dropdown
  loadClients().then(clients => {
    const clientSelect = document.getElementById('client_id');
    clientSelect.innerHTML = '<option value="">Select Client</option>';
    clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = `${client.name} (ID: ${client.id})`;
      clientSelect.appendChild(option);
    });
  });

  document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const client_id = parseInt(document.getElementById('client_id').value, 10);
    const month = document.getElementById('month').value;
    const invoice_no = document.getElementById('invoice_no')?.value || '';
    
    if (!Number.isInteger(client_id) || client_id <= 0) { alert('Please select a valid client'); return; }
    if (!month) { alert('Month is required'); return; }

    const formData = { client_id, month, invoice_no };

    try {
      
      const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData)
     });

       
      if (response.ok) {
        const data = await response.json();
        alert('Invoice generated successfully!');
        close();
      if (window.showTable) window.showTable('invoices');
      if (data && data.id) {
      window.open(`/api/invoices/${data.id}/pdf?download=1`, '_blank');
      }
        if (data.pdf) {
          const pdfData = data.pdf;
          const byteCharacters = atob(pdfData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice_${client_id}_${month}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
        close();
        if (window.showTable) window.showTable('invoices');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert(`Network error: ${error.message}`);
    }
  });
}

// Load all invoices for viewing
export const loadInvoices = async () => {
  try {
    const res = await fetch('/api/invoices', { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error loading invoices:', error);
    return [];
  }
};

// Generate Invoice modal (replaces existing showInvoiceForm)
window.showInvoiceForm = async () => {
  if (document.getElementById('invoice-modal')) return;

  // 1) Load clients first
  const clients = await fetchClientsListSafe();

  // 2) Build options
  const clientOptions = (clients.length
    ? ['<option value="">-- Select Client --</option>'].concat(
        clients.map(c => `<option value="${c.id}">${(c.name || 'Client')} (ID: ${c.id})</option>`)
      )
    : ['<option value="">No clients available</option>']
  ).join('');

  // 3) Render minimal modal
  const overlay = document.createElement('div');
  overlay.id = 'invoice-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;min-width:380px;max-width:520px;padding:16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">Generate Invoice</h3>
      <button id="inv-close" style="border:none;background:transparent;font-size:20px;cursor:pointer" title="Close">&times;</button>
    </div>

    <form id="invoiceForm">
      <label>Client<br>
        <select id="inv_client_id" required>${clientOptions}</select>
      </label><br><br>

      <label>Month (YYYY-MM)<br>
        <input type="text" id="inv_month" placeholder="2025-10" required>
      </label><br><br>

      <label>Invoice No.<br>
        <input type="text" id="inv_invoice_no" placeholder="INV/..." required>
      </label>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button type="submit">Generate</button>
        <button type="button" id="inv-cancel">Cancel</button>
      </div>

      <div id="inv_msg" style="margin-top:6px;color:#b00;"></div>
    </form>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const $ = id => document.getElementById(id);
  const close = () => overlay.remove();
  $('inv-close').onclick = close;
  $('inv-cancel').onclick = close;

  // 4) Basic validation helpers
  function isYYYYMM(s) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }

  // 5) Submit handler: send only required fields
  $('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('inv_msg').textContent = '';

    const client_id = parseInt($('inv_client_id').value, 10);
    const month = $('inv_month').value.trim();
    const invoice_no = $('inv_invoice_no').value.trim();

    if (!Number.isInteger(client_id) || client_id <= 0) {
      $('inv_msg').textContent = 'Please select a client.';
      return;
    }
    if (!isYYYYMM(month)) {
      $('inv_msg').textContent = 'Month must be in YYYY-MM format.';
      return;
    }
    if (!invoice_no) {
      $('inv_msg').textContent = 'Invoice No. is required.';
      return;
    }

    try {
      // Backend will compute totals/dates automatically
      const r = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, month, invoice_no })
      });
      const data = await r.json().catch(()=> ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to generate invoice');

      alert('Invoice generated successfully');
      close();
      if (window.showTable) window.showTable('invoices');
    } catch (err) {
      console.error('Invoice create error:', err);
      $('inv_msg').textContent = err.message || 'Error creating invoice';
    }
  });
};