// generate-secret-key.js
import crypto from 'crypto';

function generateSecretKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

const secretKey = generateSecretKey();
console.log('Generated Secret Key:', secretKey);
console.log('Copy this key and store it securely (e.g., in an environment variable).');