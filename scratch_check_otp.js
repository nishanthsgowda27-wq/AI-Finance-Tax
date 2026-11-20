const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: 'FinanceAI_9fK7!qL2#vR8',
    database: 'financeai'
  });

  const [otps] = await conn.execute(
    'SELECT otp, purpose, expires_at, created_at FROM otp_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 3',
    ['nihanthsgowda968@gmail.com']
  );
  console.log('LATEST_OTPS:', JSON.stringify(otps));

  const [users] = await conn.execute(
    'SELECT id, email, is_verified FROM users WHERE email = ?',
    ['nihanthsgowda968@gmail.com']
  );
  console.log('USER:', JSON.stringify(users));

  await conn.end();
}

main().catch(console.error);

