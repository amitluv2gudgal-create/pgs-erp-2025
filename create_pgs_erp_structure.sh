#!/bin/bash

# Set the project directory on Desktop
PROJECT_DIR=~/Desktop/PGS-ERP

# Create main project directory
mkdir -p "$PROJECT_DIR"

# Create subdirectories
mkdir -p "$PROJECT_DIR/controllers"
mkdir -p "$PROJECT_DIR/utils"
mkdir -p "$PROJECT_DIR/public/css"
mkdir -p "$PROJECT_DIR/public/js"

# Create files
touch "$PROJECT_DIR/package.json"
touch "$PROJECT_DIR/server.js"
touch "$PROJECT_DIR/db.js"
touch "$PROJECT_DIR/controllers/auth.js"
touch "$PROJECT_DIR/controllers/clients.js"
touch "$PROJECT_DIR/controllers/employees.js"
touch "$PROJECT_DIR/controllers/attendances.js"
touch "$PROJECT_DIR/controllers/deductions.js"
touch "$PROJECT_DIR/controllers/invoices.js"
touch "$PROJECT_DIR/controllers/salaries.js"
touch "$PROJECT_DIR/controllers/requests.js"
touch "$PROJECT_DIR/utils/pdf.js"
touch "$PROJECT_DIR/public/login.html"
touch "$PROJECT_DIR/public/index.html"
touch "$PROJECT_DIR/public/css/style.css"
touch "$PROJECT_DIR/public/js/app.js"
touch "$PROJECT_DIR/public/js/auth.js"
touch "$PROJECT_DIR/public/js/clients.js"
touch "$PROJECT_DIR/public/js/employees.js"
touch "$PROJECT_DIR/public/js/attendances.js"
touch "$PROJECT_DIR/public/js/deductions.js"
touch "$PROJECT_DIR/public/js/invoices.js"
touch "$PROJECT_DIR/public/js/salaries.js"
touch "$PROJECT_DIR/public/js/requests.js"

echo "PGS-ERP folder structure created successfully at $PROJECT_DIR"