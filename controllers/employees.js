// controllers/employees.js
import express from "express";
import { authMiddleware } from "./auth.js";
const router = express.Router();

// Create employee (ADMIN)
router.post("/", authMiddleware(["ADMIN"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const b = req.body;
    const emp = await prisma.employee.create({
      data: {
        name: b.name,
        father_name: b.father_name || null,
        local_address: b.local_address || null,
        permanent_address: b.permanent_address || null,
        telephone: b.telephone || null,
        email: b.email || null,
        marital_status: b.marital_status || null,
        spouse_name: b.spouse_name || null,
        next_kin_name: b.next_kin_name || null,
        next_kin_telephone: b.next_kin_telephone || null,
        next_kin_address: b.next_kin_address || null,
        identifier_name: b.identifier_name || null,
        identifier_address: b.identifier_address || null,
        identifier_telephone: b.identifier_telephone || null,
        epf_number: b.epf_number || null,
        esic_number: b.esic_number || null,
        criminal_record: b.criminal_record || null,
        salary_per_month: parseFloat(b.salary_per_month || 0),
        category: b.category || "",
        clientId: b.clientId ? parseInt(b.clientId) : null,
        employeeId: b.employeeId || `EMP-${Date.now()}`,
      }
    });
    res.json(emp);
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

// Read all employees (all roles)
router.get("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const emps = await prisma.employee.findMany({
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" }
    });
    res.json(emps);
  } catch (err) {
    console.error("List employees error:", err);
    res.status(500).json({ error: "Failed to list employees" });
  }
});

// Read single employee
router.get("/:id", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    const e = await prisma.employee.findUnique({ where: { id }, include: { client: true }});
    if (!e) return res.status(404).json({ error: "Employee not found" });
    res.json(e);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// Update employee (ADMIN)
router.put("/:id", authMiddleware(["ADMIN"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    const b = req.body;

    const data = {
      name: b.name,
      father_name: b.father_name || null,
      local_address: b.local_address || null,
      permanent_address: b.permanent_address || null,
      telephone: b.telephone || null,
      email: b.email || null,
      marital_status: b.marital_status || null,
      spouse_name: b.spouse_name || null,
      next_kin_name: b.next_kin_name || null,
      next_kin_telephone: b.next_kin_telephone || null,
      next_kin_address: b.next_kin_address || null,
      identifier_name: b.identifier_name || null,
      identifier_address: b.identifier_address || null,
      identifier_telephone: b.identifier_telephone || null,
      epf_number: b.epf_number || null,
      esic_number: b.esic_number || null,
      criminal_record: b.criminal_record || null,
      salary_per_month: b.salary_per_month ? parseFloat(b.salary_per_month) : undefined,
      category: b.category,
      clientId: b.clientId ? parseInt(b.clientId) : null,
      employeeId: b.employeeId || undefined,
    };

    // remove undefined values so Prisma won't complain
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const updated = await prisma.employee.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error("Update employee error:", err);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// Delete employee (ADMIN)
router.delete("/:id", authMiddleware(["ADMIN"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    await prisma.employee.delete({ where: { id }});
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete employee error:", err);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

export default router;
