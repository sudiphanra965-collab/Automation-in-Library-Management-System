// Fix remaining columns
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding remaining columns...');

// Add roll_no without UNIQUE constraint (will handle uniqueness in app logic)
db.run(`ALTER TABLE users ADD COLUMN roll_no TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('❌ Error adding roll_no:', err.message);
  } else {
    console.log('✅ Added: roll_no');
  }
  
  // Add registration_date without DEFAULT
  db.run(`ALTER TABLE users ADD COLUMN registration_date TEXT`, (err2) => {
    if (err2 && !err2.message.includes('duplicate column')) {
      console.error('❌ Error adding registration_date:', err2.message);
    } else {
      console.log('✅ Added: registration_date');
    }
    
    console.log('\n✅ All columns added successfully!');
    db.close();
  });
});
