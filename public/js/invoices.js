import { loadClients } from './clients.js';

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
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        alert('Invoice generated successfully!');
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
    const res = await fetch('/api/invoices');
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

window.showInvoiceForm = showInvoiceForm;