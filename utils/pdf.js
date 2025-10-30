// utils/pdf.js
import PDFDocument from 'pdfkit';

/**
 * LEGACY INVOICE (classic format) — updated to use:
 * - Address Line 1 (Billed to)
 * - Address Line 2 (Shipped to; falls back to Line 1)
 * - PO/dated (optional line under addresses)
 * Also includes the fixed table widths so the "Total" column fits on page.
 */
export const generateInvoicePDF = (
  client,
  month,
  categoryData,
  subtotal,
  service_charges,
  total,
  cgst_amount,
  sgst_amount,
  grand_total,
  invoiceNo,
  invoiceDate,
  invoiceMonth
) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ========= Header =========
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

    doc.text('Reverse Charge : No', 50, 205);
    doc.text(`Invoice No. : ${invoiceNo}`, 50, 220);
    doc.text(`Invoice Date : ${invoiceDate}`, 50, 235);
    doc.text(`Invoice for: ${invoiceMonth}`, 50, 250);
    doc.text('State : Maharashtra', 50, 265);
    doc.text('State Code : 27', 50, 280);

    doc.text('Challan No. : ', 300, 205);
    doc.text('Vehicle No. : ', 300, 220);
    doc.text('Place of Supply : ', 300, 235);

    // -------- Addresses (2-line model) --------
    const billedTo = (client?.address_line1 || '').trim();
    const shippedTo = (client?.address_line2 && client.address_line2.trim())
      ? client.address_line2.trim()
      : billedTo;
    const poDated = (client?.po_dated && client.po_dated.trim()) ? client.po_dated.trim() : null;

    // Billed to
    doc.text('Details of Receiver | Billed to:', 50, 300);
    doc.text('Name : ' + (client?.name || ''), 50, 315);
    doc.text('Address : ' + billedTo, 50, 330);
    doc.text('State : Maharashtra', 50, 345);
    doc.text('State Code : 27', 50, 360);

    // Shipped to
    doc.text('Details of Consignee | Shipped to:', 300, 300);
    doc.text('Name : ' + (client?.name || ''), 300, 315);
    doc.text('Address : ' + shippedTo, 300, 330);
    doc.text('State : Maharashtra', 300, 345);
    doc.text('State Code : 27', 300, 360);

    // PO/dated (optional)
    if (poDated) {
      doc.text('PO/dated : ' + poDated, 50, 375);
    }

    // ========= Table (fits within page width) =========
    doc.font('Courier');

    const left = 36;
    const contentWidth = doc.page.width - 2 * 36; // ~523
    const colW = [
      25,  // Sr. No.
      90,  // Name of product
      30,  // HSN/SAC
      24,  // QTY
      25,  // Unit
      30,  // Rate
      55,  // Taxable Value
      28,  // CGST Rate
      55,  // CGST Amount
      28,  // SGST Rate
      55,  // SGST Amt.
      50   // Total
    ];
    const sumW = colW.reduce((a, b) => a + b, 0); // 505
    const startX = left + Math.floor((contentWidth - sumW) / 2); // center the table
    const colX = [];
    colW.reduce((x, w, i) => (colX[i] = x, x + w), startX);

    // Header row
    const tY = 395; // moved slightly down if PO line is present
    doc.fontSize(6);
    const headerLabels = [
      'Sr. No.', 'Name of product', 'HSN/SAC', 'QTY', 'Unit', 'Rate',
      'Taxable Value', 'CGST Rate', 'CGST Amount', 'SGST Rate', 'SGST Amt.', 'Total'
    ];
    headerLabels.forEach((label, i) => {
      doc.text(label, colX[i], tY, { width: colW[i], align: i === 1 ? 'left' : 'center' });
    });

    // Line items
    doc.fontSize(8);
    let y = tY + 15;
    let sr = 1;
    let totalQty = 0;
    let taxableValue = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let grandTotalCalc = 0;

    Object.keys(categoryData || {}).forEach((cat) => {
      const { qty = 0, rate = 0, amount = 0 } = categoryData[cat] || {};
      if (qty > 0) {
        const cgst = amount * 0.09;
        const sgst = amount * 0.09;
        const rowTotal = amount + cgst + sgst;

        doc.text(String(sr), colX[0], y, { width: colW[0], align: 'center' });
        doc.text(cat, colX[1], y, { width: colW[1], align: 'left' });
        doc.text('998525', colX[2], y, { width: colW[2], align: 'center' });
        doc.text(qty.toFixed(0), colX[3], y, { width: colW[3], align: 'right' });
        doc.text('DAYS', colX[4], y, { width: colW[4], align: 'left' });
        doc.text(rate.toFixed(2), colX[5], y, { width: colW[5], align: 'right' });
        doc.text(amount.toFixed(2), colX[6], y, { width: colW[6], align: 'right' });
        doc.text('9.00%', colX[7], y, { width: colW[7], align: 'right' });
        doc.text(cgst.toFixed(2), colX[8], y, { width: colW[8], align: 'right' });
        doc.text('9.00%', colX[9], y, { width: colW[9], align: 'right' });
        doc.text(sgst.toFixed(2), colX[10], y, { width: colW[10], align: 'right' });
        doc.text(rowTotal.toFixed(2), colX[11], y, { width: colW[11], align: 'right' });

        totalQty += qty;
        taxableValue += amount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        grandTotalCalc += rowTotal;
        y += 15;
        sr++;
      }
    });

    // Totals row
    doc.text('Total Quantity', colX[0], y, { width: colW[0] + colW[1], align: 'left' });
    doc.text(totalQty.toFixed(0), colX[3], y, { width: colW[3], align: 'right' });
    doc.text('Rs. ' + taxableValue.toFixed(2), colX[6], y, { width: colW[6], align: 'right' });
    doc.text('Rs. ' + cgstTotal.toFixed(2), colX[8], y, { width: colW[8], align: 'right' });
    doc.text('Rs. ' + sgstTotal.toFixed(2), colX[10], y, { width: colW[10], align: 'right' });
    doc.text('Rs. ' + grandTotalCalc.toFixed(2), colX[11], y, { width: colW[11], align: 'right' });

    // ========= Footer panels =========
    doc.font('Helvetica');
    y += 30;
    doc.text('Bank Details', 50, y + 15);
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

    y += 30;
    doc.text('Total Amount Before Tax : Rs. ' + Number(total).toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Add : CGST : Rs. ' + Number(cgst_amount).toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Add : SGST : Rs. ' + Number(sgst_amount).toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Total Amount : Rs. ' + Number(grand_total).toFixed(2), 300, y + 15);
    y += 10;
    doc.text('Paid Amount : Rs. 0.00', 300, y + 15);
    y += 10;
    doc.text('Balance Due : Rs. ' + Number(grand_total).toFixed(2), 300, y + 15);

    y += 30;
    doc.text('Certified that the particular given above are true and correct', 50, y + 15);
    doc.text('For, PGS INDIA PRIVATE LIMITED', 300, y + 15);
    y += 30;
    doc.text('Authorised Signatory', 300, y + 15);
    y += 10;
    doc.text('Name : Accountant', 300, y + 15);

    y += 30;
    doc.text('Terms And Conditions', 50, y + 15);
    y += 10;
    doc.text('1. Payment should be released within seven days from the date of receipt.', 50, y + 15);

    doc.end();
  });
};

/**
 * SALARY PDF (unchanged except minor safety casts).
 */
export const generateSalaryPDF = (
  employee,
  month,
  attendance_days,
  daily_salary,
  gross,
  net,
  clientName,
  pf,
  esic,
  pt,
  fine,
  uniform,
  dim
) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(14).text('Salary Slip for the month of ' + month, 50, 50, { align: 'center' });

    // Employee details
    doc.fontSize(10).text('Name : ' + (employee?.name || 'N/A'), 50, 80);
    doc.text('Designation : ' + (employee?.category || 'N/A'), 50, 90);
    doc.text('Deptt : Admin', 50, 100);
    doc.text('PF A/c. No.: ' + (employee?.epf_number || 'N/A'), 50, 110);
    doc.text('ESI A/c No. ' + (employee?.esic_number || 'N/A'), 50, 120);
    doc.text('SITE : ' + (clientName || 'N/A'), 50, 130);

    doc.text('Days in Month: ' + Number(dim), 300, 80);
    doc.text('Paid Days: ' + Number(attendance_days), 300, 90);

    const monthly_salary = Number(employee?.salary_per_month || 0);
    const basic = Number(gross);
    const total_deductions = Number(pf) + Number(esic) + Number(pt) + Number(fine) + Number(uniform);
    const calculated_net = Number(net);

    // Table
    const tableTop = 150;
    doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();
    doc.text('S No.', 50, tableTop + 5);
    doc.text('Earnings', 80, tableTop + 5);
    doc.text('Amount (Rs.)', 200, tableTop + 5);
    doc.text('S No.', 300, tableTop + 5);
    doc.text('Deductions', 330, tableTop + 5);
    doc.text('Amount (Rs.)', 450, tableTop + 5);
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

    // Earnings
    let earnings_y = tableTop + 25;
    doc.text('1', 50, earnings_y);
    doc.text('Rate per Month', 80, earnings_y);
    doc.text(monthly_salary.toFixed(2), 200, earnings_y);
    earnings_y += 20;
    doc.text('2', 50, earnings_y);
    doc.text('Total Attendances', 80, earnings_y);
    doc.text(String(attendance_days), 200, earnings_y);
    earnings_y += 20;
    doc.text('3', 50, earnings_y);
    doc.text('Basic Rate', 80, earnings_y);
    doc.text(Number(daily_salary).toFixed(2), 200, earnings_y);
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
    earnings_y += 30;

    // Deductions
    let deductions_y = tableTop + 25;
    doc.text('1', 300, deductions_y);
    doc.text('Provident Fund', 330, deductions_y);
    doc.text(Number(pf).toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('2', 300, deductions_y);
    doc.text('ESIC', 330, deductions_y);
    doc.text(Number(esic).toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('3', 300, deductions_y);
    doc.text('P.T', 330, deductions_y);
    doc.text(Number(pt).toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('4', 300, deductions_y);
    doc.text('Fine', 330, deductions_y);
    doc.text(Number(fine).toFixed(2), 450, deductions_y);
    deductions_y += 20;
    doc.text('5', 300, deductions_y);
    doc.text('Uniform', 330, deductions_y);
    doc.text(Number(uniform).toFixed(2), 450, deductions_y);
    deductions_y += 20;

    while (deductions_y < earnings_y) deductions_y += 20;

    const total_y = Math.max(earnings_y, deductions_y) + 20;
    doc.text('Total', 80, total_y);
    doc.text(basic.toFixed(2), 200, total_y);
    doc.text('Total', 330, total_y);
    doc.text(total_deductions.toFixed(2), 450, total_y);

    // Net Salary
    doc.text('Net Salary Payable: ' + calculated_net.toFixed(2), 50, total_y + 40);

    // Accounts Department
    doc.text('Accounts Department', 50, total_y + 90);
    doc.text('Date: ' + new Date().toLocaleDateString('en-GB'), 50, total_y + 110);

    doc.end();
  });
};

/**
 * ATTENDANCE CHART PDF — ALWAYS produces at least one page.
 * Uses client address lines in header if present.
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

    const addressLine =
      (client?.address_line1?.trim() || '') +
      (client?.address_line2?.trim() ? ` | ${client.address_line2.trim()}` : '');

    // Header
    const mainTitle = `Attendance Chart — ${client?.name || 'Client'} — ${month}`;
    function header(title = mainTitle) {
      doc.fontSize(16).text(title, { align: 'center' });
      doc.moveDown(0.5);
      if (addressLine) doc.fontSize(10).text(`Address: ${addressLine}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).text('Values: 0 = Absent, 1 = Present, 2 = Weekly Off/Holiday Duty (counts as 2). Only verified attendance is shown.', { align: 'center' });
      doc.moveDown(0.5);
    }

    // If no employees → one info page
    const list = Array.isArray(employees) ? employees : [];
    if (list.length === 0) {
      header();
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(14).text('No attendance data available for this client/month.', { align: 'center' });
      doc.end();
      return;
    }

    // Table metrics
    const rowH = 18;
    const headerH = 22;
    const sNoW = 36;
    const nameW = 180;
    const sumW = 60;
    const daysW = (right - left) - sNoW - nameW - sumW - 2;
    const dayColW = Math.max(14, Math.floor(daysW / Math.max(1, Number(daysInMonth) || 30)));

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

      const perEmp = presentByEmp?.get?.(emp.id) ?? null;
      let sum = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        let val = 0;
        if (perEmp instanceof Set) {
          val = perEmp.has(iso) ? 1 : 0;
        } else if (perEmp && typeof perEmp.get === 'function') {
          val = Number(perEmp.get(iso) ?? 0);
        }
        sum += (val === 2 ? 2 : val === 1 ? 1 : 0);
        doc.text(String(val), x, y + 4, { width: dayColW, align: 'center' });
        x += dayColW;
      }
      doc.text(String(sum), x, y + 4, { width: sumW, align: 'center' });
      doc.y = y + rowH;
    }

    // Draw
    header();
    drawHeaderRow();

    let serial = 1;
    for (const emp of list) {
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