// Fix old users - set their verification_status to NULL so they show up
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Fixing old users (kj, admin)...\n');

// These are old users that existed before the verification system
// They should have NULL verification_status to show up in User Management

db.run(`
  UPDATE users 
  SET verification_status = NULL, 
      is_verified = NULL
  WHERE username IN ('kj', 'admin')
`, (err) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('✅ Updated old users to NULL verification_status');
  
  // Verify
  db.all('SELECT id, username, verification_status, is_verified FROM users ORDER BY id', (err, users) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    console.log('\n📊 All users after fix:');
    users.forEach(u => {
      console.log(`  ID: ${u.id} | ${u.username} | Status: ${u.verification_status || 'NULL'} | Verified: ${u.is_verified || 'NULL'}`);
    });
    
    db.close();
    console.log('\n✅ Fix complete!');
  });
});
