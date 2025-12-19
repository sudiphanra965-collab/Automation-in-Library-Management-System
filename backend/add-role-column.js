// Add role column to users table
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding role column to users table...');

db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column')) {
      console.log('✅ Column "role" already exists');
    } else {
      console.error('❌ Error:', err.message);
    }
  } else {
    console.log('✅ Column "role" added successfully');
  }
  
  db.close();
});
