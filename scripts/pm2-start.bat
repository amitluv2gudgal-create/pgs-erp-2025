cd /d C:\Users\Hp\Desktop\PGS-ERP
REM Try to start existing pm2 app, otherwise start server.js
pm2 start pgs-erp || pm2 start server.js --name pgs-erp --update-env -- -p 3000
