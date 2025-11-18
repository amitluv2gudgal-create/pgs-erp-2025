// utils/pdf.js
// import PDFDocument from 'pdfkit';


// export const generateInvoicePDF = (
//   client,
//   month,
//   categoryData,
//   subtotal,
//   service_charges,
//   total,
//   cgst_amount,
//   sgst_amount,
//   grand_total,
//   invoiceNo,
//   invoiceDate,
//   invoiceMonth
// ) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ size: 'A4', margin: 36 });
//     const buffers = [];
//     doc.on('data', (b) => buffers.push(b));
//     doc.on('end', () => resolve(Buffer.concat(buffers)));
//     doc.on('error', reject);

//     // ========= Header (unchanged visual) =========
//     doc.fontSize(12).text('PGS INDIA PRIVATE LIMITED', 50, 50, { align: 'center' });
//     doc.fontSize(10).text('2ND FLOOR, OFFICE NO. 207, PLOT NO. 56,', 50, 65, { align: 'center' });
//     doc.text('MONARCH PLAZA, SECTOR-11, CBD BELAPUR,', 50, 80, { align: 'center' });
//     doc.text('NAVI MUMBAI, THANE, Maharashtra, 400614', 50, 95, { align: 'center' });
//     doc.text('+91-8422930314, marketing@pgsindia.co.in', 50, 110, { align: 'center' });
//     doc.text('GSTIN : 27AAICP6856G2ZY', 50, 125, { align: 'center' });
//     doc.text('PAN No: AAICP6856G', 50, 140, { align: 'center' });

//     doc.fontSize(14).text('TAX INVOICE', 50, 160, { align: 'center' });
//     doc.fontSize(10).text('Original for Recipient', 400, 160);
//     doc.text('Duplicate for Transporter', 400, 175);
//     doc.text('Triplicate for Supplier', 400, 190);

//     doc.text('Reverse Charge : No', 50, 205);
//     doc.text(`Invoice No. : ${invoiceNo}`, 50, 220);
//     doc.text(`Invoice Date : ${invoiceDate}`, 50, 235);
//     doc.text(`Invoice for: ${invoiceMonth}`, 50, 250);
//     doc.text('State : Maharashtra', 50, 265);
//     doc.text('State Code : 27', 50, 280);

//     doc.text('Challan No. : ', 300, 205);
//     doc.text('Vehicle No. : ', 300, 220);
//     doc.text('Place of Supply : ', 300, 235);

//     doc.text('Details of Receiver | Billed to:', 50, 300);
//     doc.text('Name : ' + (client?.name || ''), 50, 315);
//     doc.text('Address : ' + (client?.address || ''), 50, 330);
//     doc.text('State : Maharashtra', 50, 345);
//     doc.text('State Code : 27', 50, 360);

//     doc.text('Details of Consignee | Shipped to:', 300, 300);
//     doc.text('Name : ' + (client?.name || ''), 300, 315);
//     doc.text('Address : ' + (client?.address || ''), 300, 330);
//     doc.text('State : Maharashtra', 300, 345);
//     doc.text('State Code : 27', 300, 360);

//     // ========= Table (fits within page width) =========
//     doc.font('Courier');

//     // Printable width on A4 with 36pt margins ≈ 523pt
//     const left = 36;
//     const contentWidth = doc.page.width - 2 * 36; // ~523

//     // New column widths sum to 505pt (fits inside 523pt comfortably)
//     const colW = [
//       25,  // Sr. No.
//       90,  // Name of product
//       30,  // HSN/SAC
//       24,  // QTY
//       25,  // Unit
//       30,  // Rate
//       55,  // Taxable Value
//       28,  // CGST Rate
//       55,  // CGST Amount
//       28,  // SGST Rate
//       55,  // SGST Amt.
//       50   // Total
//     ];
//     const sumW = colW.reduce((a, b) => a + b, 0); // 505
//     const startX = left + Math.floor((contentWidth - sumW) / 2); // center the table
//     const colX = [];
//     colW.reduce((x, w, i) => (colX[i] = x, x + w), startX);

//     // Header row
//     const tY = 380;
//     doc.fontSize(6);
//     const headerLabels = [
//       'Sr. No.', 'Name of product', 'HSN/SAC', 'QTY', 'Unit', 'Rate',
//       'Taxable Value', 'CGST Rate', 'CGST Amount', 'SGST Rate', 'SGST Amt.', 'Total'
//     ];
//     headerLabels.forEach((label, i) => {
//       doc.text(label, colX[i], tY, { width: colW[i], align: i === 1 ? 'left' : 'center' });
//     });

//     // Line items
//     doc.fontSize(8);
//     let y = tY + 15;
//     let sr = 1;
//     let totalQty = 0;
//     let taxableValue = 0;
//     let cgstTotal = 0;
//     let sgstTotal = 0;
//     let grandTotalCalc = 0;

//     Object.keys(categoryData || {}).forEach((cat) => {
//       const { qty = 0, rate = 0, amount = 0 } = categoryData[cat] || {};
//       if (qty > 0) {
//         const cgst = amount * 0.09;
//         const sgst = amount * 0.09;
//         const rowTotal = amount + cgst + sgst;

//         doc.text(String(sr), colX[0], y, { width: colW[0], align: 'center' });
//         doc.text(cat, colX[1], y, { width: colW[1], align: 'left' });
//         doc.text('998525', colX[2], y, { width: colW[2], align: 'center' });
//         doc.text(qty.toFixed(0), colX[3], y, { width: colW[3], align: 'right' });
//         doc.text('DAYS', colX[4], y, { width: colW[4], align: 'left' });
//         doc.text(rate.toFixed(2), colX[5], y, { width: colW[5], align: 'right' });
//         doc.text(amount.toFixed(2), colX[6], y, { width: colW[6], align: 'right' });
//         doc.text('9.00%', colX[7], y, { width: colW[7], align: 'right' });
//         doc.text(cgst.toFixed(2), colX[8], y, { width: colW[8], align: 'right' });
//         doc.text('9.00%', colX[9], y, { width: colW[9], align: 'right' });
//         doc.text(sgst.toFixed(2), colX[10], y, { width: colW[10], align: 'right' });
//         doc.text(rowTotal.toFixed(2), colX[11], y, { width: colW[11], align: 'right' });

//         totalQty += qty;
//         taxableValue += amount;
//         cgstTotal += cgst;
//         sgstTotal += sgst;
//         grandTotalCalc += rowTotal;
//         y += 15;
//         sr++;
//       }
//     });

//     // Totals row
//     doc.text('Total Quantity', colX[0], y, { width: colW[0] + colW[1], align: 'left' });
//     doc.text(totalQty.toFixed(0), colX[3], y, { width: colW[3], align: 'right' });
//     doc.text('Rs. ' + taxableValue.toFixed(2), colX[6], y, { width: colW[6], align: 'right' });
//     doc.text('Rs. ' + cgstTotal.toFixed(2), colX[8], y, { width: colW[8], align: 'right' });
//     doc.text('Rs. ' + sgstTotal.toFixed(2), colX[10], y, { width: colW[10], align: 'right' });
//     doc.text('Rs. ' + grandTotalCalc.toFixed(2), colX[11], y, { width: colW[11], align: 'right' });

//     // ========= Footer panels (unchanged) =========
//     doc.font('Helvetica');
//     y += 30;
//     doc.text('Bank Details', 50, y + 15);
//     y += 10;
//     doc.text('Account Holder Name : PGS INDIA PVT LTD', 50, y + 15);
//     y += 10;
//     doc.text('Bank Account Number : 15191100000175', 50, y + 15);
//     y += 10;
//     doc.text('Bank IFSC Code : PSIB0021519', 50, y + 15);
//     y += 10;
//     doc.text('Bank Name : PUNJAB AND SIND BANK', 50, y + 15);
//     y += 10;
//     doc.text('Bank Branch Name : KHARGHAR NAVI MUMBAI', 50, y + 15);

//     y += 30;
//     doc.text('Total Amount Before Tax : Rs. ' + Number(total).toFixed(2), 300, y + 15);
//     y += 10;
//     doc.text('Add : CGST : Rs. ' + Number(cgst_amount).toFixed(2), 300, y + 15);
//     y += 10;
//     doc.text('Add : SGST : Rs. ' + Number(sgst_amount).toFixed(2), 300, y + 15);
//     y += 10;
//     doc.text('Total Amount : Rs. ' + Number(grand_total).toFixed(2), 300, y + 15);
//     y += 10;
//     doc.text('Paid Amount : Rs. 0.00', 300, y + 15);
//     y += 10;
//     doc.text('Balance Due : Rs. ' + Number(grand_total).toFixed(2), 300, y + 15);

//     y += 30;
//     doc.text('Certified that the particular given above are true and correct', 50, y + 15);
//     doc.text('For, PGS INDIA PRIVATE LIMITED', 300, y + 15);
//     y += 30;
//     doc.text('Authorised Signatory', 300, y + 15);
//     y += 10;
//     doc.text('Name : Accountant', 300, y + 15);

//     y += 30;
//     doc.text('Terms And Conditions', 50, y + 15);
//     y += 10;
//     doc.text('1. Payment should be released within seven days from the date of receipt.', 50, y + 15);

//     doc.end();
//   });
// };


// /**
//  * SALARY PDF — unchanged logic (minor safety casts).
//  */
// export const generateSalaryPDF = (
//   employee,
//   month,
//   attendance_days,
//   daily_salary,
//   gross,
//   net,
//   clientName,
//   pf,
//   esic,
//   pt,
//   fine,
//   uniform,
//   dim
// ) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ size: 'A4', margin: 36 });
//     const buffers = [];
//     doc.on('data', (b) => buffers.push(b));
//     doc.on('end', () => resolve(Buffer.concat(buffers)));
//     doc.on('error', reject);

//     doc.fontSize(14).text('Salary Slip for the month of ' + month, 50, 50, { align: 'center' });

//     // Employee details with fallback
//     doc.fontSize(10).text('Name : ' + (employee?.name || 'N/A'), 50, 80);
//     doc.text('Designation : ' + (employee?.category || 'N/A'), 50, 90);
//     doc.text('Deptt : Admin', 50, 100);
//     doc.text('PF A/c. No.: ' + (employee?.epf_number || 'N/A'), 50, 110);
//     doc.text('ESI A/c No. ' + (employee?.esic_number || 'N/A'), 50, 120);
//     doc.text('SITE : ' + (clientName || 'N/A'), 50, 130);

//     doc.text('Days in Month: ' + Number(dim), 300, 80);
//     doc.text('Paid Days: ' + Number(attendance_days), 300, 90);

//     const monthly_salary = Number(employee?.salary_per_month || 0);
//     const basic = Number(gross);
//     const total_deductions = Number(pf) + Number(esic) + Number(pt) + Number(fine) + Number(uniform);
//     const calculated_net = Number(net);

//     // Table
//     const tableTop = 150;
//     doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();
//     doc.text('S No.', 50, tableTop + 5);
//     doc.text('Earnings', 80, tableTop + 5);
//     doc.text('Amount (Rs.)', 200, tableTop + 5);
//     doc.text('S No.', 300, tableTop + 5);
//     doc.text('Deductions', 330, tableTop + 5);
//     doc.text('Amount (Rs.)', 450, tableTop + 5);
//     doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

//     // Earnings
//     let earnings_y = tableTop + 25;
//     doc.text('1', 50, earnings_y);
//     doc.text('Rate per Month', 80, earnings_y);
//     doc.text(monthly_salary.toFixed(2), 200, earnings_y);
//     earnings_y += 20;
//     doc.text('2', 50, earnings_y);
//     doc.text('Total Attendances', 80, earnings_y);
//     doc.text(String(attendance_days), 200, earnings_y);
//     earnings_y += 20;
//     doc.text('3', 50, earnings_y);
//     doc.text('Basic Rate', 80, earnings_y);
//     doc.text(Number(daily_salary).toFixed(2), 200, earnings_y);
//     earnings_y += 20;
//     doc.text('4', 50, earnings_y);
//     doc.text('Special allowance', 80, earnings_y);
//     doc.text('0.00', 200, earnings_y);
//     earnings_y += 20;
//     doc.text('5', 50, earnings_y);
//     doc.text('HRA', 80, earnings_y);
//     doc.text('0.00', 200, earnings_y);
//     earnings_y += 20;
//     doc.text('6', 50, earnings_y);
//     doc.text('CA', 80, earnings_y);
//     doc.text('0.00', 200, earnings_y);
//     earnings_y += 20;
//     doc.text('7', 50, earnings_y);
//     doc.text('WA', 80, earnings_y);
//     doc.text('0.00', 200, earnings_y);
//     earnings_y += 20;
//     doc.text('8', 50, earnings_y);
//     doc.text('Total Basic', 80, earnings_y);
//     doc.text(basic.toFixed(2), 200, earnings_y);
//     earnings_y += 30;

//     // Deductions
//     let deductions_y = tableTop + 25;
//     doc.text('1', 300, deductions_y);
//     doc.text('Provident Fund', 330, deductions_y);
//     doc.text(Number(pf).toFixed(2), 450, deductions_y);
//     deductions_y += 20;
//     doc.text('2', 300, deductions_y);
//     doc.text('ESIC', 330, deductions_y);
//     doc.text(Number(esic).toFixed(2), 450, deductions_y);
//     deductions_y += 20;
//     doc.text('3', 300, deductions_y);
//     doc.text('P.T', 330, deductions_y);
//     doc.text(Number(pt).toFixed(2), 450, deductions_y);
//     deductions_y += 20;
//     doc.text('4', 300, deductions_y);
//     doc.text('Fine', 330, deductions_y);
//     doc.text(Number(fine).toFixed(2), 450, deductions_y);
//     deductions_y += 20;
//     doc.text('5', 300, deductions_y);
//     doc.text('Uniform', 330, deductions_y);
//     doc.text(Number(uniform).toFixed(2), 450, deductions_y);
//     deductions_y += 20;

//     while (deductions_y < earnings_y) deductions_y += 20;

//     const total_y = Math.max(earnings_y, deductions_y) + 20;
//     doc.text('Total', 80, total_y);
//     doc.text(basic.toFixed(2), 200, total_y);
//     doc.text('Total', 330, total_y);
//     doc.text(total_deductions.toFixed(2), 450, total_y);

//     // Net Salary
//     doc.text('Net Salary Payable: ' + calculated_net.toFixed(2), 50, total_y + 40);

//     // Accounts Department
//     doc.text('Accounts Department', 50, total_y + 90);
//     doc.text('Date: ' + new Date().toLocaleDateString('en-GB'), 50, total_y + 110);

//     doc.end();
//   });
// };

// /**
//  * ATTENDANCE CHART PDF — ALWAYS produces at least one page.
//  * Shows 0/1/2 per day (0 = Absent, 1 = Present, 2 = Weekly Off/Holiday Duty and counts as 2).
//  * If employee list is empty, we still render a one-page "No attendance data" notice,
//  * so your merged invoice always includes the chart section.
//  */
// export async function generateAttendanceChartPDF({ client, month, employees, daysInMonth, presentByEmp }) {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
//     const chunks = [];
//     doc.on('data', (d) => chunks.push(d));
//     doc.on('error', reject);
//     doc.on('end', () => resolve(Buffer.concat(chunks)));

//     const pageW = doc.page.width;
//     const pageH = doc.page.height;
//     const left = 24, right = pageW - 24, bottom = pageH - 24;

//     // Header
//     const mainTitle = `Attendance Chart — ${client?.name || 'Client'} — ${month}`;
//     function header(title = mainTitle) {
//       doc.fontSize(16).text(title, { align: 'center' });
//       doc.moveDown(0.5);
//       if (client?.address) doc.fontSize(10).text(`Address: ${client.address}`, { align: 'center' });
//       doc.moveDown(0.5);
//       doc.fontSize(9).text('Values: 0 = Absent, 1 = Present, 2 = Weekly Off/Holiday Duty (counts as 2). Only verified attendance is shown.', { align: 'center' });
//       doc.moveDown(0.5);
//     }

//     // If no employees → render a single-friendly page and exit.
//     const list = Array.isArray(employees) ? employees : [];
//     if (list.length === 0) {
//       header();
//       doc.moveDown(1);
//       doc.font('Helvetica-Bold').fontSize(14).text('No attendance data available for this client/month.', { align: 'center' });
//       doc.end();
//       return;
//     }

//     // Table metrics
//     const rowH = 18;
//     const headerH = 22;
//     const sNoW = 36;
//     const nameW = 180;
//     const sumW = 60;
//     const daysW = (right - left) - sNoW - nameW - sumW - 2;
//     const dayColW = Math.max(14, Math.floor(daysW / Math.max(1, Number(daysInMonth) || 30)));

//     function drawHeaderRow() {
//       doc.fontSize(10).font('Helvetica-Bold');
//       const y = doc.y;
//       doc.rect(left, y, (right - left), headerH).fill('#eeeeee').fillColor('black');
//       doc.lineWidth(0.5).strokeColor('#000000').rect(left, y, (right - left), headerH).stroke();

//       let x = left;
//       doc.text('S.No.', x + 4, y + 5, { width: sNoW - 8, align: 'left' }); x += sNoW;
//       doc.text('Name of the Employee', x + 4, y + 5, { width: nameW - 8, align: 'left' }); x += nameW;
//       for (let d = 1; d <= daysInMonth; d++) {
//         doc.text(String(d).padStart(2, '0'), x, y + 5, { width: dayColW, align: 'center' });
//         x += dayColW;
//       }
//       doc.text('Sum', x, y + 5, { width: sumW, align: 'center' });
//       doc.y = y + headerH;
//     }

//     function row(empIndex, emp) {
//       const y = doc.y;
//       doc.lineWidth(0.2).strokeColor('#000000').rect(left, y, (right - left), rowH).stroke();

//       let x = left;
//       doc.font('Helvetica').fontSize(9);
//       doc.text(String(empIndex), x + 4, y + 4, { width: sNoW - 8, align: 'left' }); x += sNoW;
//       doc.text(emp.name || `ID ${emp.id}`, x + 4, y + 4, { width: nameW - 8, align: 'left' }); x += nameW;

//       const perEmp = presentByEmp?.get?.(emp.id) ?? null;
//       let sum = 0;
//       for (let d = 1; d <= daysInMonth; d++) {
//         const iso = `${month}-${String(d).padStart(2, '0')}`;
//         let val = 0;
//         if (perEmp instanceof Set) {
//           val = perEmp.has(iso) ? 1 : 0;            // legacy set
//         } else if (perEmp && typeof perEmp.get === 'function') {
//           val = Number(perEmp.get(iso) ?? 0);       // 0|1|2
//         }
//         sum += (val === 2 ? 2 : val === 1 ? 1 : 0);
//         doc.text(String(val), x, y + 4, { width: dayColW, align: 'center' });
//         x += dayColW;
//       }
//       doc.text(String(sum), x, y + 4, { width: sumW, align: 'center' });
//       doc.y = y + rowH;
//     }

//     // Start & draw
//     header();
//     drawHeaderRow();

//     let serial = 1;
//     for (const emp of list) {
//       // new page if needed
//       if (doc.y + rowH + 10 > bottom) {
//         doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
//         header(`${mainTitle} (contd.)`);
//         drawHeaderRow();
//       }
//       row(serial++, emp);
//     }

//     doc.end();
//   });
// }

// utils/pdf.js
//
// Generates salary PDF slips using an HTML template rendered with Puppeteer (preferred).
// Falls back to pdfkit if Puppeteer is not available.

import fs from 'fs';
import path from 'path';
import os from 'os';

let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = null; }

let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

function fmt(num) {
  const n = Number(num || 0);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildSalaryHTML(employee, salaryRecord, clientName) {
  const bd = salaryRecord && salaryRecord.breakdown ? (typeof salaryRecord.breakdown === 'string' ? JSON.parse(salaryRecord.breakdown) : salaryRecord.breakdown) : null;
  const comps = bd?.components ?? {
    basic: employee?.basic_rate ?? 0,
    da: employee?.special_allowance ?? 0,
    hra: employee?.hra ?? 0,
    ca: employee?.ca ?? 0,
    wa: employee?.wa ?? 0,
    educational_allowance: employee?.educational_allowance ?? 0,
    add_4_hours: employee?.add_4_hours ?? 0,
    weekly_off_amount: employee?.weekly_off_amount ?? 0,
    manual_total: employee?.salary_total_manual ?? 0,
    fallback_monthly: employee?.salary_per_month ?? 0
  };

  const computed = bd?.computed ?? {
    daysInMonth: salaryRecord?.daysInMonth ?? salaryRecord?.days_in_month ?? new Date().getDate(),
    attendance_days: salaryRecord?.attendance_days ?? salaryRecord?.attendanceDays ?? 0,
    daily_salary: salaryRecord?.daily_salary ?? ((salaryRecord?.gross ?? 0) / (salaryRecord?.daysInMonth || 1)),
    gross: salaryRecord?.gross ?? 0
  };

  const monthly_total_components = (comps.manual_total && Number(comps.manual_total) > 0)
    ? Number(comps.manual_total)
    : (Number(comps.basic) + Number(comps.da) + Number(comps.hra) + Number(comps.ca) + Number(comps.wa) + Number(comps.educational_allowance) + Number(comps.add_4_hours) + Number(comps.weekly_off_amount));

  const monthly_salary_final = (monthly_total_components > 0) ? monthly_total_components : Number(comps.fallback_monthly || 0);
  const daysInMonth = Number(computed.daysInMonth || 30);
  const attendanceDays = Number(computed.attendance_days || 0);
  const perDay = daysInMonth > 0 ? (monthly_salary_final / daysInMonth) : 0;

  const compProrated = {
    basic: (Number(comps.basic) / daysInMonth) * attendanceDays,
    da: (Number(comps.da) / daysInMonth) * attendanceDays,
    hra: (Number(comps.hra) / daysInMonth) * attendanceDays,
    ca: (Number(comps.ca) / daysInMonth) * attendanceDays,
    wa: (Number(comps.wa) / daysInMonth) * attendanceDays,
    educational_allowance: (Number(comps.educational_allowance) / daysInMonth) * attendanceDays,
    add_4_hours: (Number(comps.add_4_hours) / daysInMonth) * attendanceDays,
    weekly_off_amount: (Number(comps.weekly_off_amount) / daysInMonth) * attendanceDays,
    manual_total: (Number(comps.manual_total) / daysInMonth) * attendanceDays
  };

  const deductions = salaryRecord?.deductions ?? {
    epf: (bd?.deductions?.epf_amount ?? 0),
    esic: (bd?.deductions?.esic_amount ?? 0),
    professional_tax: (bd?.deductions?.professional_tax ?? 0),
    other: (bd?.deductions?.other_deductions_total ?? 0)
  };

  const epfOnBasicPlusDa = Number(employee?.epf_on_basic_plus_da || 0);
  const epfOnBasic = Number(employee?.epf_on_basic || 0);
  let epf_basis_text = 'No EPF';
  if (epfOnBasicPlusDa === 1) epf_basis_text = `EPF on Basic + DA (${fmt(Number(comps.basic) + Number(comps.da))})`;
  else if (epfOnBasic === 1) epf_basis_text = `EPF on Basic (${fmt(Number(comps.basic))})`;

  const company = {
    name: 'PGS INDIA PRIVATE LIMITED',
    addressLine1: '2ND FLOOR, OFFICE NO. 207, PLOT NO. 56, MONARCH PLAZA',
    addressLine2: 'SECTOR-11, CBD BELAPUR, NAVI MUMBAI, MAHARASHTRA - 400614',
    contact: '+91-8422930314',
    gst: 'GSTIN : 27AAICP6856G2ZY'
  };

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Salary Slip - ${employee?.name || ''} - ${salaryRecord?.month || ''}/${salaryRecord?.year || ''}</title>
    <style>
      * { box-sizing: border-box; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #222; }
      body { margin: 0; padding: 24px; font-size: 12px; }
      .paper { width: 210mm; min-height: 297mm; padding: 18mm; margin: 0 auto; }
      header { text-align: center; margin-bottom: 10px; }
      .company { font-size: 14px; font-weight: 700; }
      .company small { display:block; font-weight:400; font-size:11px; }
      .two-col { display: flex; justify-content: space-between; margin-top: 8px; }
      .left, .right { width: 48%; }
      .meta { margin-top: 8px; font-size: 11px; }
      .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      .table th, .table td { border: 1px solid #ddd; padding: 8px; vertical-align: middle; }
      .table th { background: #f7f7f7; font-weight: 700; text-align: left; }
      .table .numeric { text-align: right; font-variant-numeric: tabular-nums; }
      .section-title { margin-top: 16px; font-weight:700; font-size:13px; }
      .totals { margin-top: 12px; display:flex; justify-content: space-between; }
      .totals .left { width: 60%; }
      .totals .right { width: 35%; text-align: right; font-weight:700; }
      .net { font-size: 16px; font-weight: 800; color: #0a6; padding: 8px 12px; border: 2px solid #0a6; display:inline-block; border-radius: 6px; }
      .small { font-size: 11px; color: #444; }
      .muted { color: #666; font-size: 11px; }
      .signature { margin-top: 28px; display:flex; justify-content: space-between; }
      .sign-box { width: 40%; text-align:center; }
      @media print { body { margin:0; padding:0; } .paper { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="paper">
      <header>
        <div class="company">${company.name}</div>
        <small>${company.addressLine1}</small>
        <small>${company.addressLine2}</small>
        <small>${company.contact} &nbsp; | &nbsp; ${company.gst}</small>
        <h2 style="margin-top:8px; margin-bottom:6px;">Salary Slip</h2>
        <div class="muted">Month: ${salaryRecord?.month || ''} / ${salaryRecord?.year || ''}</div>
      </header>

      <div class="two-col">
        <div class="left">
          <div><strong>Employee:</strong> ${employee?.name || 'N/A'}</div>
          <div><strong>Employee ID:</strong> ${employee?.id ?? ''}</div>
          <div><strong>Gender:</strong> ${employee?.gender ? String(employee.gender).toUpperCase() : 'N/A'}</div>
          <div><strong>Category:</strong> ${employee?.category || 'N/A'}</div>
          <div><strong>PF A/C No:</strong> ${employee?.epf_number || 'N/A'}</div>
          <div><strong>ESI A/C No:</strong> ${employee?.esic_number || 'N/A'}</div>
        </div>
        <div class="right">
          <div><strong>Site / Client:</strong> ${clientName || 'N/A'}</div>
          <div><strong>Days in Month:</strong> ${daysInMonth}</div>
          <div><strong>Paid Days (Attendance):</strong> ${attendanceDays}</div>
          <div><strong>Monthly Salary (final):</strong> ₹ ${fmt(monthly_salary_final)}</div>
          <div><strong>Per Day Rate:</strong> ₹ ${fmt(perDay)}</div>
        </div>
      </div>

      <div class="section-title">Earnings (Monthly vs. Paid days)</div>
      <table class="table" style="margin-top:6px;">
        <thead>
          <tr>
            <th style="width: 6%;">#</th>
            <th>Component</th>
            <th style="width: 20%;">Monthly Amount (₹)</th>
            <th style="width: 20%;">Prorated / Paid Days (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${buildComponentRow(1, 'Basic', comps.basic, compProrated.basic)}
          ${buildComponentRow(2, 'Special Allowance (DA)', comps.da, compProrated.da)}
          ${buildComponentRow(3, 'HRA', comps.hra, compProrated.hra)}
          ${buildComponentRow(4, 'CA', comps.ca, compProrated.ca)}
          ${buildComponentRow(5, 'WA', comps.wa, compProrated.wa)}
          ${buildComponentRow(6, 'Educational Allowance', comps.educational_allowance, compProrated.educational_allowance)}
          ${buildComponentRow(7, 'Add 4 Hours', comps.add_4_hours, compProrated.add_4_hours)}
          ${buildComponentRow(8, 'Weekly Off (₹)', comps.weekly_off_amount, compProrated.weekly_off_amount)}
          ${compManualRow(comps.manual_total, compProrated.manual_total)}
          <tr>
            <td></td>
            <td style="font-weight:700">Gross (Paid)</td>
            <td class="numeric">₹ ${fmt(monthly_salary_final)}</td>
            <td class="numeric">₹ ${fmt(salaryRecord?.gross ?? computed.gross ?? 0)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Deductions</div>
      <table class="table" style="margin-top:6px;">
        <thead>
          <tr>
            <th style="width: 6%;">#</th>
            <th>Deductions</th>
            <th style="width: 30%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Provident Fund (PF)</td><td class="numeric">₹ ${fmt(deductions.epf)}</td></tr>
          <tr><td>2</td><td>ESIC</td><td class="numeric">₹ ${fmt(deductions.esic)}</td></tr>
          <tr><td>3</td><td>Professional Tax (PT)</td><td class="numeric">₹ ${fmt(deductions.professional_tax)}</td></tr>
          <tr><td>4</td><td>Other / Recoveries</td><td class="numeric">₹ ${fmt(deductions.other)}</td></tr>
          <tr><td>5</td><td>Fine</td><td class="numeric">₹ ${fmt(bd?.deductions?.extra_fine ?? 0)}</td></tr>
          <tr><td>6</td><td>Uniform</td><td class="numeric">₹ ${fmt(bd?.deductions?.extra_uniform ?? 0)}</td></tr>

          <tr>
            <td></td>
            <td style="font-weight:700">Total Deductions</td>
            <td class="numeric" style="font-weight:700">₹ ${fmt((deductions.epf || 0) + (deductions.esic || 0) + (deductions.professional_tax || 0) + (deductions.other || 0) + (bd?.deductions?.extra_fine || 0) + (bd?.deductions?.extra_uniform || 0))}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="left small">
          <div><strong>EPF basis:</strong> ${epf_basis_text}</div>
          <div class="muted">Note: ESIC is computed on Gross (Total Paid Amount) per company rules.</div>
        </div>
        <div class="right">
          <div>Gross (Paid): ₹ ${fmt(salaryRecord?.gross ?? computed.gross ?? 0)}</div>
          <div>Total Deductions: ₹ ${fmt((deductions.epf || 0) + (deductions.esic || 0) + (deductions.professional_tax || 0) + (deductions.other || 0) + (bd?.deductions?.extra_fine || 0) + (bd?.deductions?.extra_uniform || 0))}</div>
          <div style="margin-top:8px;">Net Payable:</div>
          <div class="net">₹ ${fmt(salaryRecord?.net ?? 0)}</div>
        </div>
      </div>

      <div class="signature">
        <div class="sign-box">
          <div class="small">Prepared By</div>
          <div style="margin-top:36px">________________</div>
        </div>
        <div class="sign-box">
          <div class="small">Approved By</div>
          <div style="margin-top:36px">________________</div>
        </div>
      </div>

      <div style="margin-top:18px;font-size:10px;color:#666;">
        This is a computer generated slip and does not require signature unless specified.
      </div>
    </div>
  </body>
  </html>`;

  return html;

  function buildComponentRow(sno, label, monthly, paid) {
    if ((Number(monthly) || 0) === 0 && (Number(paid) || 0) === 0) return '';
    return `<tr>
      <td>${sno}</td>
      <td>${label}</td>
      <td class="numeric">₹ ${fmt(monthly)}</td>
      <td class="numeric">₹ ${fmt(paid)}</td>
    </tr>`;
  }

  function compManualRow(manualMonthly, manualPaid) {
    if (!manualMonthly || Number(manualMonthly) === 0) return '';
    return `<tr>
      <td>9</td>
      <td>Manual Total</td>
      <td class="numeric">₹ ${fmt(manualMonthly)}</td>
      <td class="numeric">₹ ${fmt(manualPaid)}</td>
    </tr>`;
  }
}

export async function generateSalaryPDF(employee, salaryRecord, clientName = '') {
  const html = buildSalaryHTML(employee, salaryRecord, clientName);

  if (puppeteer) {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
      });
      await page.close();
      await browser.close();
      return buffer;
    } catch (err) {
      await browser.close();
      console.error('Puppeteer PDF generation failed, falling back to PDFKit:', err);
    }
  }

  if (!PDFDocument) {
    throw new Error('Neither puppeteer nor pdfkit is available. Please install "puppeteer" or "pdfkit".');
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const bufs = [];
      doc.on('data', (b) => bufs.push(b));
      doc.on('end', () => resolve(Buffer.concat(bufs)));
      doc.on('error', reject);

      doc.fontSize(14).text('Salary Slip', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`${employee?.name || 'N/A'} (${employee?.id || ''})`);
      doc.text(`Gender: ${employee?.gender || 'N/A'}`);
      doc.text(`Month: ${salaryRecord?.month || ''} / ${salaryRecord?.year || ''}`);
      doc.moveDown(0.5);

      const bd = salaryRecord?.breakdown ? (typeof salaryRecord.breakdown === 'string' ? JSON.parse(salaryRecord.breakdown) : salaryRecord.breakdown) : null;
      const comps = bd?.components || {};
      doc.fontSize(10).text('Components:', { underline: true });
      const compKeys = ['basic','da','hra','ca','wa','educational_allowance','add_4_hours','weekly_off_amount','manual_total','fallback_monthly'];
      compKeys.forEach(k => {
        doc.text(`${k}: ${fmt(comps[k] || 0)}`);
      });

      doc.moveDown(0.5);
      doc.text(`Gross: ₹ ${fmt(salaryRecord?.gross ?? 0)}`);
      const ded = salaryRecord?.deductions || {};
      doc.text(`Deductions:`);
      doc.text(`  PF: ₹ ${fmt(ded.epf || bd?.deductions?.epf_amount || 0)}`);
      doc.text(`  ESIC: ₹ ${fmt(ded.esic || bd?.deductions?.esic_amount || 0)}`);
      doc.text(`  PT: ₹ ${fmt(ded.professional_tax || bd?.deductions?.professional_tax || 0)}`);
      doc.text(`Net Payable: ₹ ${fmt(salaryRecord?.net ?? 0)}`);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}