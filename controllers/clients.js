import express from "express";
import { authMiddleware } from "./auth.js";
const router = express.Router();

// Create client (accountant)
router.post("/", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const data = req.body;
  const prisma = req.prisma;
  const client = await prisma.client.create({
    data: {
      name: data.name,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      state: data.state,
      district: data.district,
      contactPerson: data.contactPerson,
      telephone: data.telephone,
      poNumber: data.poNumber,
      cgstRate: data.cgstRate ?? 9,
      sgstRate: data.sgstRate ?? 9,
      igstRate: data.igstRate ?? 18,
    },
  });
  res.json(client);
});

// Read all (all roles)
router.get("/", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  const prisma = req.prisma;
  const clients = await prisma.client.findMany({ include: { categories: true }});
  res.json(clients);
});

// Update (accountant submits EDIT request instead of direct edit)
router.put("/:id", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  // Instead of direct update, create an edit request to be approved by admin
  const { id } = req.params;
  const payload = req.body;
  const request = await prisma.editRequest.create({
    data: {
      tableName: "Client",
      rowId: parseInt(id),
      action: "EDIT",
      requesterId: req.user.id,
      payload: payload
    }
  });
  res.json({ message: "Edit request submitted", request });
});

// Delete (accountant) -> create delete request
router.delete("/:id", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const request = await prisma.editRequest.create({
    data: {
      tableName: "Client",
      rowId: parseInt(id),
      action: "DELETE",
      requesterId: req.user.id
    }
  });
  res.json({ message: "Delete request submitted", request });
});

// Add category (direct by accountant)
router.post("/:id/categories", authMiddleware(["ACCOUNTANT"]), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const { name, ratePerMonth } = req.body;
  const cat = await prisma.clientCategory.create({
    data: { clientId: parseInt(id), name, ratePerMonth: parseFloat(ratePerMonth) }
  });
  res.json(cat);
});

export default router;
