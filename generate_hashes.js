import bcrypt from 'bcrypt';

(async () => {
  const passwords = [
    { username: 'admin', password: 'admin123' },
    { username: 'accountant', password: 'accountant123' },
    { username: 'hr', password: 'hr123' }
  ];

  for (const { username, password } of passwords) {
    const hash = await bcrypt.hash(password, 10);
    console.log(`Username: ${username}, Hash: ${hash}`);
  }
})();