// Check user verification status
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('📊 Checking all users and their verification status...\n');

db.all(`
  SELECT id, username, full_name, roll_no, verification_status, is_verified, registration_date
  FROM users
  ORDER BY id
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Total users:', rows.length);
  console.log('\n' + '='.repeat(100));
  
  rows.forEach(user => {
    console.log(`\nID: ${user.id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Full Name: ${user.full_name || 'N/A'}`);
    console.log(`Roll No: ${user.roll_no || 'N/A'}`);
    console.log(`Verification Status: ${user.verification_status || 'NULL (old user)'}`);
    console.log(`Is Verified: ${user.is_verified || 0}`);
    console.log(`Registration Date: ${user.registration_date || 'N/A'}`);
    console.log('-'.repeat(100));
  });
  
  // Count by status
  const pending = rows.filter(r => r.verification_status === 'pending').length;
  const approved = rows.filter(r => r.verification_status === 'approved').length;
  const rejected = rows.filter(r => r.verification_status === 'rejected').length;
  const nullStatus = rows.filter(r => !r.verification_status).length;
  
  console.log('\n📊 Summary:');
  console.log(`   Pending: ${pending}`);
  console.log(`   Approved: ${approved}`);
  console.log(`   Rejected: ${rejected}`);
  console.log(`   NULL (old users): ${nullStatus}`);
  
  db.close();
});
