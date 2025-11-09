import express from "express";
import { authMiddleware } from "./auth.js";
import { generateSalaryPDF } from "../utils/pdf.js";
const router = express.Router();

const ratePerDay = (monthly) => parseFloat(monthly) / 30.0;

// generate salaries for a month (accountant)
router.post("/generate", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { month, year } = req.body;
  // for all employees
  const emps = await prisma.employee.findMany();
  const created = [];
  for (const e of emps) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month - 1, 1);
    to.setMonth(to.getMonth() + 1);
    const agg = await prisma.attendance.aggregate({
      _sum: { sessions: true },
      where: { employeeId: e.id, date: { gte: from, lt: to } }
    });
    const totalAttendances = agg._sum.sessions || 0;
    const amount = ratePerDay(e.ratePerMonth) * totalAttendances;
    // sum deductions for this employee (all time or for the month — for now all applicable)
    const ded = await prisma.deduction.aggregate({ _sum: { amount: true }, where: { employeeId: e.id }});
    const deductionsSum = ded._sum.amount || 0;
    const net = amount - deductionsSum;
    const salary = await prisma.salary.create({
      data: {
        employeeId: e.id,
        month: parseInt(month),
        year: parseInt(year),
        basicAmount: amount,
        deductions: deductionsSum,
        netPay: net
      }
    });
    // optionally create/download PDF
    const pdfBuffer = await generateSalaryPDF(salary, e);
    // we'll return created array and not stream all pdfs here
    created.push({ salary, pdfGenerated: true });
  }
  res.json(created);
});

router.get("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  const prisma = req.prisma;
  const s = await prisma.salary.findMany();
  res.json(s);
});

router.delete("/:id", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const request = await prisma.editRequest.create({
    data: { tableName: "Salary", rowId: parseInt(id), action: "DELETE", requesterId: req.user.id }
  });
  res.json({ message: "Delete request created", request });
});

export default router;
