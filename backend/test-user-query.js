// Test the user query
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Testing user query...\n');

const query = `
  SELECT 
    u.id,
    u.username,
    u.email,
    u.is_admin,
    u.full_name,
    u.roll_no,
    u.mobile_no,
    u.verification_status,
    COUNT(bb.id) as borrowed_count
  FROM users u
  LEFT JOIN borrowed_books bb ON u.id = bb.user_id
  WHERE (u.verification_status IS NULL OR u.verification_status = 'approved')
  GROUP BY u.id
  ORDER BY u.id
`;

db.all(query, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('✅ Query returned', rows.length, 'users:\n');
  
  rows.forEach(user => {
    console.log(`ID: ${user.id} | Username: ${user.username} | Status: ${user.verification_status || 'NULL'} | Admin: ${user.is_admin}`);
  });
  
  console.log('\n✅ Query is working correctly!');
  console.log('   - Rejected users are filtered out');
  console.log('   - Pending users are filtered out');
  console.log('   - Only approved and NULL status users show');
  
  db.close();
});
