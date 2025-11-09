// auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "change_me_please";

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
}

// Middleware
export function authMiddleware(roles = []) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });
    const token = header.replace("Bearer ", "");
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const prisma = req.prisma;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = generateToken(user);
  res.json({ token, role: user.role });
});

// Admin: change password of any user (without old password)
router.post("/admin/change-password", authMiddleware(["ADMIN"]), async (req, res) => {
  const { userId, newPassword } = req.body;
  const prisma = req.prisma;
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });
  res.json({ ok: true });
});

// User change own password
router.post("/change-password", authMiddleware(["ADMIN","ACCOUNTANT","HR"]), async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const prisma = req.prisma;
  const user = await prisma.user.findUnique({ where: { id: req.user.id }});
  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) return res.status(400).json({ error: "Old password incorrect" });
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hash }});
  res.json({ ok: true });
});

export default router;
