// controllers/invoices.js
import express from "express";
import { authMiddleware } from "./auth.js";
import { generateInvoicePDF } from "../utils/pdf.js";
const router = express.Router();

function ratePerDay(monthly) {
  return parseFloat(monthly) / 30.0;
}

router.post("/generate", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const { clientId, month, year } = req.body;
    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) }, include: { categories: true }});
    if (!client) return res.status(404).json({ error: "Client not found" });

    const categories = client.categories || [];
    const categoryData = {};
    let subtotal = 0;

    // attendance matrix
    const employeesList = []; // { id, name }
    const presentByEmp = new Map();

    const daysInMonth = new Date(year, month, 0).getDate(); // month 1-12
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month - 1, daysInMonth);
    to.setDate(to.getDate() + 1); // exclusive end

    for (const cat of categories) {
      // find employees where category matches
      const employees = await prisma.employee.findMany({ where: { category: cat.name }});
      const empIds = employees.map(e => e.id);
      if (empIds.length === 0) {
        categoryData[cat.name] = { qty: 0, rate: ratePerDay(cat.ratePerMonth), amount: 0 };
        continue;
      }

      // sum approved attendances for this category (aggregated across employees)
      const agg = await prisma.attendance.aggregate({
        _sum: { sessions: true },
        where: {
          employeeId: { in: empIds },
          date: { gte: from, lt: to },
          status: "APPROVED"
        }
      });

      const totalAttendances = agg._sum.sessions || 0;
      const rpd = ratePerDay(cat.ratePerMonth);
      const amount = rpd * totalAttendances;

      categoryData[cat.name] = { qty: totalAttendances, rate: rpd, amount };
      subtotal += amount;

      // build per-employee attendance details for the chart
      for (const emp of employees) {
        if (!employeesList.find(e => e.id === emp.id)) employeesList.push({ id: emp.id, name: emp.name });

        // fetch this employee's approved attendances for the month
        const empAtts = await prisma.attendance.findMany({
          where: { employeeId: emp.id, date: { gte: from, lt: to }, status: "APPROVED" },
          orderBy: { date: 'asc' }
        });

        const dayMap = new Map();
        for (const a of empAtts) {
          const d = new Date(a.date);
          const day = d.getDate(); // 1..31
          dayMap.set(String(day), Number(a.sessions || 0));
        }
        presentByEmp.set(emp.id, dayMap);
      }
    }

    const cgst_amount = subtotal * (client.cgstRate / 100 || 0.09);
    const sgst_amount = subtotal * (client.sgstRate / 100 || 0.09);
    const total = subtotal;
    const grand_total = subtotal + cgst_amount + sgst_amount;

    // Save invoice
    const invoice = await prisma.invoice.create({
      data: {
        clientId: parseInt(clientId),
        month: parseInt(month),
        year: parseInt(year),
        lines: JSON.stringify(categoryData),
        totalAmount: grand_total
      }
    });

    const invoiceNo = invoice.id;
    const invoiceDate = new Date().toLocaleDateString('en-GB');
    const invoiceMonth = `${month}-${year}`;

    const attendanceOptions = {
      employees: employeesList,
      daysInMonth,
      presentByEmp
    };

    const pdfBuffer = await generateInvoicePDF(
      client,
      month,
      categoryData,
      subtotal,
      0,
      total,
      cgst_amount,
      sgst_amount,
      grand_total,
      invoiceNo,
      invoiceDate,
      invoiceMonth,
      attendanceOptions
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${invoiceNo}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Generate invoice error:", err);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

export default router;
