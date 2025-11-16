import express from "express";
import { authMiddleware } from "./auth.js";
const router = express.Router();

// List requests (admin)
router.get("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  const prisma = req.prisma;
  if (req.user.role === "ADMIN") {
    const all = await prisma.editRequest.findMany();
    return res.json(all);
  } else {
    const userRequests = await prisma.editRequest.findMany({ where: { requesterId: req.user.id }});
    return res.json(userRequests);
  }
});

// Admin approves
router.post("/:id/approve", authMiddleware(["ADMIN"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const request = await prisma.editRequest.findUnique({ where: { id: parseInt(id) }});
  if (!request) return res.status(404).json({ error: "Request not found" });

  if (request.action === "DELETE") {
    // perform delete on the target table
    const table = request.tableName;
    const rowId = request.rowId;
    await applyDelete(prisma, table, rowId);
  } else if (request.action === "EDIT") {
    await applyEdit(prisma, request.tableName, request.rowId, request.payload);
  }
  await prisma.editRequest.update({ where: { id: parseInt(id) }, data: { status: "APPROVED" }});
  res.json({ ok: true });
});

// Admin rejects
router.post("/:id/reject", authMiddleware(["ADMIN"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  await prisma.editRequest.update({ where: { id: parseInt(id) }, data: { status: "REJECTED" }});
  res.json({ ok: true });
});

// helper functions
async function applyDelete(prisma, table, rowId) {
  const id = parseInt(rowId);
  switch (table) {
    case "Client": await prisma.client.delete({ where: { id } }); break;
    case "Employee": await prisma.employee.delete({ where: { id } }); break;
    case "Attendance": await prisma.attendance.delete({ where: { id } }); break;
    case "Invoice": await prisma.invoice.delete({ where: { id } }); break;
    case "Salary": await prisma.salary.delete({ where: { id } }); break;
    default: throw new Error("Unsupported delete");
  }
}

async function applyEdit(prisma, table, rowId, payload) {
  const id = parseInt(rowId);
  switch (table) {
    case "Client": await prisma.client.update({ where: { id }, data: payload }); break;
    case "Employee": await prisma.employee.update({ where: { id }, data: payload }); break;
    case "Attendance": await prisma.attendance.update({ where: { id }, data: payload }); break;
    default: throw new Error("Unsupported edit");
  }
}

export default router;
