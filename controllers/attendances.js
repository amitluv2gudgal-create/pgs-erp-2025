// controllers/attendances.js
import express from "express";
import { authMiddleware } from "./auth.js";
const router = express.Router();

// Create attendance
// - If body.submittedBy === 'supervisor' or role not HR/ADMIN, mark PENDING.
// - If created by HR or ADMIN, mark APPROVED.
router.post("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const { employeeId, date, sessions, submittedBy } = req.body;
    const parsedDate = new Date(date);
    let status = "APPROVED";

    if (submittedBy && String(submittedBy).toLowerCase() === "supervisor") {
      status = "PENDING";
    } else {
      if (req.user.role === "HR" || req.user.role === "ADMIN") status = "APPROVED";
      else status = "PENDING";
    }

    const att = await prisma.attendance.create({
      data: {
        employeeId: parseInt(employeeId),
        date: parsedDate,
        sessions: parseInt(sessions || 0),
        status,
        submittedBy: submittedBy || null
      }
    });
    res.json(att);
  } catch (err) {
    console.error("Create attendance error:", err);
    res.status(500).json({ error: "Failed to create attendance" });
  }
});

// Bulk upload endpoint (array of attendance rows)
router.post("/batch", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const arr = req.body; // [{employeeId, date, sessions, submittedBy?}, ...]
    const created = [];
    for (const row of arr) {
      let status = "APPROVED";
      if (row.submittedBy && String(row.submittedBy).toLowerCase() === "supervisor") status = "PENDING";
      else if (req.user.role === "HR" || req.user.role === "ADMIN") status = "APPROVED";
      else status = "PENDING";

      const c = await prisma.attendance.create({
        data: {
          employeeId: parseInt(row.employeeId),
          date: new Date(row.date),
          sessions: parseInt(row.sessions || 0),
          status,
          submittedBy: row.submittedBy || null
        }
      });
      created.push(c);
    }
    res.json(created);
  } catch (err) {
    console.error("Batch attendance error:", err);
    res.status(500).json({ error: "Failed to batch upload attendances" });
  }
});

// List attendances (optionally filter by status)
router.get("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const items = await prisma.attendance.findMany({
      where,
      include: { employee: true },
      orderBy: { date: 'asc' }
    });
    res.json(items);
  } catch (err) {
    console.error("List attendance error:", err);
    res.status(500).json({ error: "Failed to list attendances" });
  }
});

// HR or ADMIN approve a pending attendance
router.post("/:id/approve", authMiddleware(["HR","ADMIN"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    const att = await prisma.attendance.update({ where: { id }, data: { status: "APPROVED" }});
    res.json({ ok: true, attendance: att });
  } catch (err) {
    console.error("Approve attendance error:", err);
    res.status(500).json({ error: "Failed to approve attendance" });
  }
});

// HR or ADMIN reject
router.post("/:id/reject", authMiddleware(["HR","ADMIN"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    const att = await prisma.attendance.update({ where: { id }, data: { status: "REJECTED" }});
    res.json({ ok: true, attendance: att });
  } catch (err) {
    console.error("Reject attendance error:", err);
    res.status(500).json({ error: "Failed to reject attendance" });
  }
});

// HR submits edit-request for attendance (keeps your existing approval flow)
router.put("/:id", authMiddleware(["HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    const payload = req.body;
    const request = await prisma.editRequest.create({
      data: { tableName: "Attendance", rowId: id, action: "EDIT", requesterId: req.user.id, payload }
    });
    res.json({ message: "Edit request submitted", request });
  } catch (err) {
    console.error("Attendance edit request error:", err);
    res.status(500).json({ error: "Failed to submit edit request" });
  }
});

// HR submits delete-request for attendance
router.delete("/:id", authMiddleware(["HR"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const id = parseInt(req.params.id);
    const request = await prisma.editRequest.create({
      data: { tableName: "Attendance", rowId: id, action: "DELETE", requesterId: req.user.id }
    });
    res.json({ message: "Delete request submitted", request });
  } catch (err) {
    console.error("Attendance delete request error:", err);
    res.status(500).json({ error: "Failed to submit delete request" });
  }
});

export default router;
