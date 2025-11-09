// scripts/seed-admin.js
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const run = async () => {
  const pwd = await bcrypt.hash("admin123", 10);
  try {
    await prisma.user.create({ data: { username: "admin", password: pwd, role: "ADMIN" }});
    console.log("Admin created (username=admin, password=admin123). Change immediately.");
  } catch(e) {
    console.error("Probably already exists:", e.message);
  } finally {
    await prisma.$disconnect();
  }
};
run();
