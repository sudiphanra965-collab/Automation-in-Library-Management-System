// Comprehensive diagnosis
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 COMPREHENSIVE DIAGNOSIS\n');
console.log('='.repeat(80));

// 1. Check all users
console.log('\n1️⃣ ALL USERS:');
db.all('SELECT * FROM users ORDER BY id', (err, users) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log(`Total users: ${users.length}\n`);
  users.forEach(u => {
    console.log(`ID: ${u.id} | Username: ${u.username} | Admin: ${u.is_admin} | Status: ${u.verification_status || 'NULL'} | Photo: ${u.user_photo || 'NULL'}`);
  });
  
  // 2. Check borrowed books
  console.log('\n' + '='.repeat(80));
  console.log('\n2️⃣ BORROWED BOOKS:');
  db.all('SELECT * FROM borrowed_books', (err, books) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    console.log(`Total borrowed: ${books.length}\n`);
    books.forEach(b => {
      console.log(`User ID: ${b.user_id} | Book ID: ${b.book_id} | Returned: ${b.return_date ? 'YES' : 'NO'}`);
    });
    
    // 3. Test the query
    console.log('\n' + '='.repeat(80));
    console.log('\n3️⃣ TESTING USER MANAGEMENT QUERY:');
    
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
      LEFT JOIN borrowed_books bb ON u.id = bb.user_id AND bb.return_date IS NULL
      WHERE (u.verification_status IS NULL OR u.verification_status = 'approved')
      GROUP BY u.id
      ORDER BY u.id
    `;
    
    db.all(query, (err, results) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      
      console.log(`Query returned: ${results.length} users\n`);
      results.forEach(r => {
        console.log(`ID: ${r.id} | Username: ${r.username} | Admin: ${r.is_admin} | Books: ${r.borrowed_count} | Photo: ${r.user_photo || 'NULL'}`);
      });
      
      // 4. Check uploads directory
      console.log('\n' + '='.repeat(80));
      console.log('\n4️⃣ CHECKING UPLOADS DIRECTORY:');
      const fs = require('fs');
      const uploadsPath = path.join(__dirname, 'uploads');
      
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        console.log(`Files in uploads: ${files.length}`);
        files.forEach(f => console.log(`  - ${f}`));
      } else {
        console.log('❌ Uploads directory does not exist!');
      }
      
      db.close();
      console.log('\n' + '='.repeat(80));
      console.log('\n✅ Diagnosis complete!');
    });
  });
});
