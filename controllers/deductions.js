import express from "express";
import { authMiddleware } from "./auth.js";
const router = express.Router();

// Accountant CRUD direct (they can create/edit/delete deductions)
router.post("/", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { employeeId, name, amount } = req.body;
  const d = await prisma.deduction.create({
    data: { employeeId: employeeId ? parseInt(employeeId) : null, name, amount: parseFloat(amount) }
  });
  res.json(d);
});

router.get("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  const prisma = req.prisma;
  const all = await prisma.deduction.findMany();
  res.json(all);
});

router.put("/:id", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const d = await prisma.deduction.update({
    where: { id: parseInt(id) },
    data: { ...req.body }
  });
  res.json(d);
});

router.delete("/:id", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const d = await prisma.deduction.delete({ where: { id: parseInt(id) }});
  res.json({ ok: true });
});

export default router;
