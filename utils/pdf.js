// utils/pdf.js (corrected)
import PDFDocument from 'pdfkit';

export const generateInvoicePDF = (client, month, categoryData, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoiceNo, invoiceDate, invoiceMonth) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Company header with split lines to prevent overlapping
    doc.fontSize(12).text('PGS INDIA PRIVATE LIMITED', 50, 50, { align: 'center' });
    doc.fontSize(10).text('2ND FLOOR, OFFICE NO. 207, PLOT NO. 56,', 50, 65, { align: 'center' });
    doc.text('MONARCH PLAZA, SECTOR-11, CBD BELAPUR,', 50, 80, { align: 'center' });
    doc.text('NAVI MUMBAI, THANE, Maharashtra, 400614', 50, 95, { align: 'center' });
    doc.text('+91-8422930314, marketing@pgsindia.co.in', 50, 110, { align: 'center' });
    doc.text('GSTIN : 27AAICP6856G2ZY', 50, 125, { align: 'center' });
    doc.text('PAN No: AAICP6856G', 50, 140, { align: 'center' });

    doc.fontSize(14).text('TAX INVOICE', 50, 160, { align: 'center' });
    doc.fontSize(10).text('Original for Recipient', 400, 160);
    doc.text('Duplicate for Transporter', 400, 175);
    doc.text('Triplicate for Supplier', 400, 190);

    // Invoice details with adjusted spacing
    doc.text('Reverse Charge : No', 50, 205);
    doc.text(`Invoice No. : ${invoiceNo}`, 50, 220);
    doc.text(`Invoice Date : ${invoiceDate}`, 50, 235);
    doc.text(`Invoice for: ${invoiceMonth}`, 50, 250);  // NEW LINE
    doc.text('State : Maharashtra', 50, 265);  // Shifted down
    doc.text('State Code : 27', 50, 280);  // Shifted down

    doc.text('Challan No. : ', 300, 205);
    doc.text('Vehicle No. : ', 300, 220);
    doc.text('Place of Supply : ', 300, 235);

    // Billed to and Shipped to (shifted down 15px)
    doc.text('Details of Receiver | Billed to:', 50, 300);  // Was 280
    doc.text('Name : ' + client.name, 50, 315);  // Was 295
    doc.text('Address : ' + client.address, 50, 330);  // Was 310
    doc.text('State : Maharashtra', 50, 345);  // Was 325
    doc.text('State Code : 27', 50, 360);  // Was 340

    doc.text('Details of Consignee | Shipped to:', 300, 300);  // Was 280
    doc.text('Name : ' + client.name, 300, 315);  // Was 295
    doc.text('Address : ' + client.address, 300, 330);  // Was 310
    doc.text('State : Maharashtra', 300, 345);  // Was 325
    doc.text('State Code : 27', 300, 360);  // Was 340

    // Switch to monospaced font for table to prevent overlapping
    doc.font('Courier');

    // Define column positions and widths
    const colX = [50, 75, 175, 210, 230, 260, 295, 355, 385, 445, 475, 535];
    const colWidths = [25, 100, 35, 20, 30, 35, 60, 30, 60, 30, 60, 70];

    // Table header with adjusted column positions, widths, and alignments (shifted down 15px)
    doc.fontSize(6);
    doc.text('Sr. No.', colX[0], 380, { width: colWidths[0], align: 'center' });  // Was 360
    doc.text('Name of product', colX[1], 380, { width: colWidths[1], align: 'left' });
    doc.text('HSN/SAC', colX[2], 380, { width: colWidths[2], align: 'left' });
    doc.text('QTY', colX[3], 380, { width: colWidths[3], align: 'right' });
    doc.text('Unit', colX[4], 380, { width: colWidths[4], align: 'left' });
    doc.text('Rate', colX[5], 380, { width: colWidths[5], align: 'right' });
    doc.text('Taxable Value', colX[6], 380, { width: colWidths[6], align: 'right' });
    doc.text('CGST Rate', colX[7], 380, { width: colWidths[7], align: 'right' });
    doc.text('CGST Amount', colX[8], 380, { width: colWidths[8], align: 'right' });
    doc.text('SGST Rate', colX[9], 380, { width: colWidths[9], align: 'right' });
    doc.text('SGST Amt.', colX[10], 380, { width: colWidths[10], align: 'right' });
    doc.text('Total', colX[11], 380, { width: colWidths[11], align: 'right' });

    // Data with consistent font size, widths, and alignments
    doc.fontSize(8);

    // Categories with actual data, only show with QTY > 0
    let y = 395;  // Was 375; shifted down
    let sr = 1;
    let totalQty = 0;
    let taxableValue = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let grandTotal = 0;
    Object.keys(categoryData).forEach(cat => {
      const { qty, rate, amount } = categoryData[cat];
      if (qty > 0) {
        const cgst = amount * 0.09;
        const sgst = amount * 0.09;
        const rowTotal = amount + cgst + sgst;
        doc.text(sr.toString(), colX[0], y, { width: colWidths[0], align: 'center' });
        doc.text(cat, colX[1], y, { width: colWidths[1], align: 'left' });
        doc.text('998525', colX[2], y, { width: colWidths[2], align: 'left' });
        doc.text(qty.toFixed(0), colX[3], y, { width: colWidths[3], align: 'right' });
        doc.text('DAYS', colX[4], y, { width: colWidths[4], align: 'left' });
        doc.text(rate.toFixed(2), colX[5], y, { width: colWidths[5], align: 'right' });
        doc.text(amount.toFixed(2), colX[6], y, { width: colWidths[6], align: 'right' });
        doc.text('9.00%', colX[7], y, { width: colWidths[7], align: 'right' });
        doc.text(cgst.toFixed(2), colX[8], y, { width: colWidths[8], align: 'right' });
        doc.text('9.00%', colX[9], y, { width: colWidths[9], align: 'right' });
        doc.text(sgst.toFixed(2), colX[10], y, { width: colWidths[10], align: 'right' });
        doc.text(rowTotal.toFixed(2), colX[11], y, { width: colWidths[11], align: 'right' });
        totalQty += qty;
        taxableValue += amount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        grandTotal += rowTotal;
        y += 15; // Reduced line spacing for compactness
        sr++;
      }
    });

    // Totals with widths and alignments
    doc.text('Total Quantity', colX[0], y, { width: colWidths[0] + colWidths[1], align: 'left' });
    doc.text(totalQty.toFixed(0), colX[3], y, { width: colWidths[3], align: 'right' });
    doc.text('Rs. ' + taxableValue.toFixed(2), colX[6], y, { width: colWidths[6], align: 'right' });
    doc.text('Rs. ' + cgstTotal.toFixed(2), colX[8], y, { width: colWidths[8], align: 'right' });
    doc.text('Rs. ' + sgstTotal.toFixed(2), colX[10], y, { width: colWidths[10], align: 'right' });
    doc.text('Rs. ' + grandTotal.toFixed(2), colX[11], y, { width: colWidths[11], align: 'right' });

    // Switch back to default font for remaining sections
    doc.font('Helvetica');

    // Bank details (shifted down 15px)
    y += 30;
    doc.text('Bank Details', 50, y + 15);  // Adjusted
    y += 10;
    doc.text('Account Holder Name : PGS INDIA PVT LTD', 50, y + 15);
    y += 10;
    doc.text('Bank Account Number : 15191100000175', 50, y + 15);
    y += 10;
    doc.text('Bank IFSC Code : PSIB0021519', 50, y + 15);
    y += 10;
    doc.text('Bank Name : PUNJAB AND SIND BANK', 50, y + 15);
    y += 10;
    doc.text('Bank Branch Name : KHARGHAR NAVI MUMBAI', 50, y + 15);

    // Total amounts (use total as before-tax, which now includes service_charges) (shifted)
    y += 30;
    doc.text('Total Amount Before Tax : Rs. ' + total.toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Add : CGST : Rs. ' + cgst_amount.toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Add : SGST : Rs. ' + sgst_amount.toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Total Amount : Rs. ' + grand_total.toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Paid Amount : Rs. 0.00', 300, y + 15);
    y += 10;
    doc.text('Balance Due : Rs. ' + grand_total.toFixed(2), 300, y + 15);

    // Certification and signature (shifted)
    y += 30;
    doc.text('Certified that the particular given above are true and correct', 50, y + 15);
    doc.text('For, PGS INDIA PRIVATE LIMITED', 300, y + 15);
    y += 30;
    doc.text('Authorised Signatory', 300, y + 15);
    y += 10;
    doc.text('Name : Accountant', 300, y + 15);

    // Terms (shifted)
    y += 30;
    doc.text('Terms And Conditions', 50, y + 15);
    y += 10;
    doc.text('1. Payment should be released within seven days from the date of receipt.', 50, y + 15);

    doc.end();
  });
};

export const generateSalaryPDF = (employee, month, attendance_days, daily_salary, gross, net, clientName, pf, esic, pt, fine, uniform, dim) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(14).text('Salary Slip for the month of ' + month, 50, 50, { align: 'center' });

    // Employee details with fallback
    doc.fontSize(10).text('Name : ' + (employee?.name || 'N/A'), 50, 80);
    doc.text('Designation : ' + (employee?.category || 'N/A'), 50, 90);
    doc.text('Deptt : Admin', 50, 100);
    doc.text('PF A/c. No.: ' + (employee?.epf_number || 'N/A'), 50, 110);
    doc.text('ESI A/c No. ' + (employee?.esic_number || 'N/A'), 50, 120);
    doc.text('SITE : ' + (clientName || 'N/A'), 50, 130);

    doc.text('Days in Month: ' + dim, 300, 80);  // Use dim instead of hardcoded 30
    doc.text('Paid Days: ' + attendance_days, 300, 90);

    // Use passed values for deductions (no recalculation to ensure consistency with salaries.js)
    const monthly_salary = employee?.salary_per_month || 0;
    const basic = gross;
    const total_deductions = pf + esic + pt + fine + uniform;
    const calculated_net = net; // Use passed net for consistency

    // Table header with added space
    const tableTop = 150;
    doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();
    doc.text('S No.', 50, tableTop + 5);
    doc.text('Earnings', 80, tableTop + 5); // Increased x for space
    doc.text('Amount (Rs.)', 200, tableTop + 5);
    doc.text('S No.', 300, tableTop + 5);
    doc.text('Deductions', 330, tableTop + 5); // Increased space
    doc.text('Amount (Rs.)', 450, tableTop + 5);
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

    // Earnings with separate y
    let earnings_y = tableTop + 25;
    doc.text('1', 50, earnings_y);
    doc.text('Rate per Month', 80, earnings_y);
    doc.text(monthly_salary.toFixed(2), 200, earnings_y);
    earnings_y += 20;
    doc.text('2', 50, earnings_y);
    doc.text('Total Attendances', 80, earnings_y);
    doc.text(attendance_days.toString(), 200, earnings_y);
    earnings_y += 20;
    doc.text('3', 50, earnings_y);
    doc.text('Basic Rate', 80, earnings_y);
    doc.text(daily_salary.toFixed(2), 200, earnings_y);
    earnings_y += 20;
    doc.text('4', 50, earnings_y);
    doc.text('Special allowance', 80, earnings_y);
    doc.text('0.00', 200, earnings_y);
    earnings_y += 20;
    doc.text('5', 50, earnings_y);
    doc.text('HRA', 80, earnings_y);
    doc.text('0.00', 200, earnings_y);
    earnings_y += 20;
    doc.text('6', 50, earnings_y);
    doc.text('CA', 80, earnings_y);
    doc.text('0.00', 200, earnings_y);
    earnings_y += 20;
    doc.text('7', 50, earnings_y);
    doc.text('WA', 80, earnings_y);
    doc.text('0.00', 200, earnings_y);
    earnings_y += 20;
    doc.text('8', 50, earnings_y);
    doc.text('Total Basic', 80, earnings_y);
    doc.text(basic.toFixed(2), 200, earnings_y);
    earnings_y += 30; // Extra space after last earnings line

    // Deductions with separate y (use passed values)
    let deductions_y = tableTop + 25;
    doc.text('1', 300, deductions_y);
    doc.text('Provident Fund', 330, deductions_y);
    doc.text(pf.toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('2', 300, deductions_y);
    doc.text('ESIC', 330, deductions_y);
    doc.text(esic.toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('3', 300, deductions_y);
    doc.text('P.T', 330, deductions_y);
    doc.text(pt.toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('4', 300, deductions_y);
    doc.text('Fine', 330, deductions_y);
    doc.text(fine.toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('5', 300, deductions_y);
    doc.text('Uniform', 330, deductions_y);
    doc.text(uniform.toFixed(2), 450, deductions_y);
    deductions_y += 20;

    // To align with earnings lines, add empty lines to deductions to match height
    while (deductions_y < earnings_y) {
      deductions_y += 20;
    }

    // Total at max y + space
    let total_y = Math.max(earnings_y, deductions_y) + 20;
    doc.text('Total', 80, total_y);
    doc.text(basic.toFixed(2), 200, total_y);
    doc.text('Total', 330, total_y);
    doc.text(total_deductions.toFixed(2), 450, total_y);

    // Net Salary
    total_y += 40;
    doc.text('Net Salary Payable: ' + calculated_net.toFixed(2), 50, total_y);

    // Accounts Department
    total_y += 50;
    doc.text('Accounts Department', 50, total_y);
    total_y += 20;
    doc.text('Date: ' + new Date().toLocaleDateString('en-GB'), 50, total_y);

    doc.end();
  });
};

/**
 * Generate client-wise attendance chart PDF as Buffer.
 * Counts value 2 as TWO days in the row sum.
 * @param {Object} params
 * @param {{id:number,name:string,address?:string}} params.client
 * @param {string} params.month "YYYY-MM"
 * @param {Array<{id:number,name:string}>} params.employees sorted list for the client
 * @param {number} params.daysInMonth 28..31
 * @param {Map<number, Map<string, number>|Set<string>>} params.presentByEmp  // Map<empId, Map<isoDate, 0|1|2>> preferred
 * @returns {Promise<Buffer>}
 */
export async function generateAttendanceChartPDF({ client, month, employees, daysInMonth, presentByEmp }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = 24, right = pageW - 24, bottom = pageH - 24;

    // Header
    const mainTitle = `Attendance Chart — ${client?.name || 'Client'} — ${month}`;
    function header(title = mainTitle) {
      doc.fontSize(16).text(title, { align: 'center' });
      doc.moveDown(0.5);
      if (client?.address) doc.fontSize(10).text(`Address: ${client.address}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).text('Values: 0 = Absent, 1 = Present, 2 = Weekly Off/Holiday Duty (counts as 2). Only verified attendance is shown.', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Table metrics
    const rowH = 18;
    const headerH = 22;
    const sNoW = 36;
    const nameW = 180;
    const sumW = 60;
    const daysW = (right - left) - sNoW - nameW - sumW - 2;
    const dayColW = Math.max(14, Math.floor(daysW / daysInMonth));

    function drawHeaderRow() {
      doc.fontSize(10).font('Helvetica-Bold');
      const y = doc.y;
      doc.rect(left, y, (right - left), headerH).fill('#eeeeee').fillColor('black');
      doc.lineWidth(0.5).strokeColor('#000000').rect(left, y, (right - left), headerH).stroke();

      let x = left;
      doc.text('S.No.', x + 4, y + 5, { width: sNoW - 8, align: 'left' }); x += sNoW;
      doc.text('Name of the Employee', x + 4, y + 5, { width: nameW - 8, align: 'left' }); x += nameW;
      for (let d = 1; d <= daysInMonth; d++) {
        doc.text(String(d).padStart(2, '0'), x, y + 5, { width: dayColW, align: 'center' });
        x += dayColW;
      }
      doc.text('Sum', x, y + 5, { width: sumW, align: 'center' });
      doc.y = y + headerH;
    }

    function row(empIndex, emp) {
      const y = doc.y;
      doc.lineWidth(0.2).strokeColor('#000000').rect(left, y, (right - left), rowH).stroke();

      let x = left;
      doc.font('Helvetica').fontSize(9);
      doc.text(String(empIndex), x + 4, y + 4, { width: sNoW - 8, align: 'left' }); x += sNoW;
      doc.text(emp.name || `ID ${emp.id}`, x + 4, y + 4, { width: nameW - 8, align: 'left' }); x += nameW;

      const perEmp = presentByEmp.get(emp.id);
      let sum = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        let val = 0;
        if (perEmp instanceof Set) {
          val = perEmp.has(iso) ? 1 : 0;            // legacy set
        } else if (perEmp && typeof perEmp.get === 'function') {
          val = Number(perEmp.get(iso) ?? 0);       // 0|1|2
        }
        sum += (val === 2 ? 2 : val === 1 ? 1 : 0);
        doc.text(String(val), x, y + 4, { width: dayColW, align: 'center' });
        x += dayColW;
      }
      doc.text(String(sum), x, y + 4, { width: sumW, align: 'center' });
      doc.y = y + rowH;
    }

    // Start first page
    header();
    drawHeaderRow();

    let serial = 1;
    for (const emp of employees) {
      // new page if needed
      if (doc.y + rowH + 10 > bottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
        header(`${mainTitle} (contd.)`);
        drawHeaderRow();
      }
      row(serial++, emp);
    }

    doc.end();
  });
}