import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";
import authRouter from "./controllers/auth.js";
import clientsRouter from "./controllers/clients.js";
import employeesRouter from "./controllers/employees.js";
import attendancesRouter from "./controllers/attendances.js";
import deductionsRouter from "./controllers/deductions.js";
import invoicesRouter from "./controllers/invoices.js";
import salariesRouter from "./controllers/salaries.js";
import requestsRouter from "./controllers/requests.js";
import supervisorsRouter from "./controllers/security_supervisor.js";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Attach prisma to req for controllers
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/attendances", attendancesRouter);
app.use("/api/deductions", deductionsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/salaries", salariesRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/supervisors", supervisorsRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PGS-ERP server listening on ${PORT}`);
});
