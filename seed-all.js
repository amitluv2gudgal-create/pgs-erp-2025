// seed-all.js
import { initDB } from './db.js';
import bcrypt from 'bcrypt';

async function seedAll() {
  const db = await initDB();
  
  // Seed users
  const users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'accountant', password: 'accountant123', role: 'accountant' },
    { username: 'hr', password: 'hr123', role: 'hr' },
  ];
  await db.run('DELETE FROM users');
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [user.username, hashedPassword, user.role]);
  }
  console.log('Users seeded');

// Seed clients
await db.run('DELETE FROM clients');
await db.run("INSERT INTO clients (name, address, contact, telephone, email, cgst, sgst) VALUES (?, ?, ?, ?, ?, ?, ?)", 
  ['Test Client 1', '123 Main St, Mumbai', 'test1@pgsindia.co.in', '1234567890', 'test1@pgsindia.co.in', 9.0, 9.0]);
await db.run("INSERT INTO clients (name, address, contact, telephone, email, cgst, sgst) VALUES (?, ?, ?, ?, ?, ?, ?)", 
  ['Test Client 2', '456 Elm St, Navi Mumbai', 'test2@pgsindia.co.in', '9876543210', 'test2@pgsindia.co.in', 9.0, 9.0]);
console.log('Clients seeded');

// Seed client_categories
await db.run('DELETE FROM client_categories');
await db.run("INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (9, 'security guard', 1166.67)");
await db.run("INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (9, 'security supervisor', 1500.00)");
console.log('Client categories seeded');

  // Seed employees
await db.run('DELETE FROM employees');
await db.run(
  "INSERT INTO employees (name, father_name, local_address, permanent_address, telephone, email, marital_status, spouse_name, next_kin_name, next_kin_telephone, next_kin_address, identifier_name, identifier_address, identifier_telephone, epf_number, esic_number, criminal_record, salary_per_month, category, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  [
    'John Doe', 'John Sr.', '123 Main St, Mumbai', '123 Main St, Mumbai', '1234567890', 'john@pgsindia.co.in', 'single', null,
    'Jane Doe', '9876543210', '456 Elm St, Navi Mumbai', 'ID1', '789 Oak St', '5555555555', 'EPF001', 'ESIC001', 'no', 20000.00,
    'Security Guard', 7
  ]
);
await db.run(
  "INSERT INTO employees (name, father_name, local_address, permanent_address, telephone, email, marital_status, spouse_name, next_kin_name, next_kin_telephone, next_kin_address, identifier_name, identifier_address, identifier_telephone, epf_number, esic_number, criminal_record, salary_per_month, category, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  [
    'Jane Smith', 'Jane Sr.', '456 Elm St, Navi Mumbai', '456 Elm St, Navi Mumbai', '9876543210', 'jane@pgsindia.co.in', 'married', 'John Smith',
    'John Doe', '1234567890', '123 Main St, Mumbai', 'ID2', '101 Pine St', '6666666666', 'EPF002', 'ESIC002', 'no', 25000.00,
    'Security Supervisor', 8
  ]
);
console.log('Employees seeded');

// Seed attendances
await db.run('DELETE FROM attendances');
await db.run(
  "INSERT INTO attendances (employee_id, date, present, submitted_by, client_id, status) VALUES (?, ?, ?, ?, ?, ?)",
  [1, '2025-10-01', 1, 1, 9, 'verified'] // Adjust IDs based on seeded data
);
await db.run(
  "INSERT INTO attendances (employee_id, date, present, submitted_by, client_id, status) VALUES (?, ?, ?, ?, ?, ?)",
  [2, '2025-10-02', 0, 1, 9, 'pending'] // Adjust IDs based on seeded data
);
console.log('Attendances seeded');

  // Seed deductions
  await db.run('DELETE FROM deductions');
  await db.run("INSERT INTO deductions (employee_id, amount, reason, date, month) VALUES (1, 100.50, 'Uniform fee', '2025-10-01', '2025-10')");
  await db.run("INSERT INTO deductions (employee_id, amount, reason, date, month) VALUES (2, 50.00, 'Late fee', '2025-10-02', '2025-10')");
  console.log('Deductions seeded');

  // Seed invoices
  await db.run('DELETE FROM invoices');
  await db.run("INSERT INTO invoices (client_id, month, invoice_no, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoice_date) VALUES (1, '2025-10', 'INV001', 28500.03, 0, 28500.03, 2565.00, 2565.00, 33630.03, '2025-10-07')");
  console.log('Invoices seeded');

  // Seed salaries
await db.run('DELETE FROM salaries');
await db.run(
  "INSERT INTO salaries (employee_id, month, attendance_days, amount, deductions, net_amount, salary_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
  [14, '2025-09', 20, 16000.00, 500.00, 15500.00, '2025-09-30'] // Adjust IDs and values
);
console.log('Salaries seeded');

  // Seed requests
  await db.run('DELETE FROM requests');
  await db.run("INSERT INTO requests (requester_id, action, table_name, record_id, data, status) VALUES (2, 'edit', 'employees', 1, '{\"name\": \"John Updated\"}', 'pending')");
  console.log('Requests seeded');

  // Seed security_supervisors
  await db.run('DELETE FROM security_supervisors');
  await db.run("INSERT INTO security_supervisors (name, username, password, client_id, site_name, created_by) VALUES ('Supervisor 1', 'supervisor1', '$2b$10$hashedpassword', 1, 'Site A', 1)");
  console.log('Security Supervisors seeded');

  db.close();
  console.log('All data seeded successfully');
}

seedAll().catch(err => console.error('Seeding error:', err));