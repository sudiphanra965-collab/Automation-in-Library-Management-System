// Test the fixed query
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Testing FIXED query...\n');

const query = `
  SELECT 
    u.id,
    u.username,
    u.email,
    u.is_admin,
    u.full_name,
    u.roll_no,
    u.mobile_no,
    u.user_photo,
    COUNT(bb.id) as borrowed_count
  FROM users u
  LEFT JOIN borrowed_books bb ON u.id = bb.user_id AND bb.returned_date IS NULL
  WHERE (u.verification_status IS NULL OR u.verification_status = 'approved')
  GROUP BY u.id
  ORDER BY u.id
`;

db.all(query, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    return;
  }
  
  console.log(`✅ Query returned ${rows.length} users:\n`);
  
  rows.forEach(user => {
    console.log(`ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    console.log(`  Admin: ${user.is_admin ? 'YES' : 'NO'}`);
    console.log(`  Full Name: ${user.full_name || 'N/A'}`);
    console.log(`  Roll No: ${user.roll_no || 'N/A'}`);
    console.log(`  Mobile: ${user.mobile_no || 'N/A'}`);
    console.log(`  Photo: ${user.user_photo || 'N/A'}`);
    console.log(`  Books Borrowed: ${user.borrowed_count}`);
    console.log('');
  });
  
  console.log('✅ Query works perfectly!');
  console.log('\n📊 Summary:');
  console.log(`  Total users: ${rows.length}`);
  console.log(`  Admins: ${rows.filter(u => u.is_admin).length}`);
  console.log(`  Regular users: ${rows.filter(u => !u.is_admin).length}`);
  console.log(`  With photos: ${rows.filter(u => u.user_photo).length}`);
  
  db.close();
});
