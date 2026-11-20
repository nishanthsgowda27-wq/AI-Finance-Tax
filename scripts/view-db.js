const mysql = require('mysql2/promise');
const fs = require('fs');

async function viewDatabase() {
  console.log('\n======================================================');
  console.log('              FinanceAI MySQL Database Viewer');
  console.log('======================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: 'FinanceAI_9fK7!qL2#vR8',
      database: 'financeai'
    });

    console.log('Connected to MySQL (127.0.0.1:3307 / database: financeai)\n');

    // 1. Tables List
    const [tables] = await connection.query('SHOW TABLES');
    console.log('--- 1. DATABASE TABLES ---');
    console.table(tables);

    // 2. Users Table
    const [users] = await connection.query(
      'SELECT id, name, email, email_verified, created_at FROM users ORDER BY created_at DESC'
    );
    console.log('\n--- 2. USERS TABLE (Latest Registered Users) ---');
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      console.table(users);
    }

    // 3. OTP Verifications
    const [otps] = await connection.query(
      'SELECT email, purpose, otp_code, expires_at, created_at FROM otp_verifications ORDER BY created_at DESC LIMIT 5'
    );
    console.log('\n--- 3. OTP VERIFICATIONS (Recent Verification Codes) ---');
    if (otps.length === 0) {
      console.log('No recent OTPs.');
    } else {
      console.table(otps);
    }

    // 4. Financial Profiles
    const [profiles] = await connection.query(
      'SELECT * FROM financial_profiles LIMIT 5'
    );
    console.log('\n--- 4. FINANCIAL PROFILES ---');
    if (profiles.length === 0) {
      console.log('No financial profiles found.');
    } else {
      console.table(profiles);
    }

    // 5. Expenses
    const [expenses] = await connection.query(
      'SELECT id, amount, category, description, date, payment_method FROM expenses ORDER BY date DESC LIMIT 10'
    );
    console.log('\n--- 5. EXPENSES (Recent 10 Records) ---');
    if (expenses.length === 0) {
      console.log('No expense records found.');
    } else {
      console.table(expenses);
    }

    console.log('\n======================================================\n');
  } catch (error) {
    console.error('Error connecting to database:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

viewDatabase();

