// Add email column to users table
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'library.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column')) {
      console.log('✅ Column email already exists');
    } else {
      console.error('Error adding column:', err);
    }
  } else {
    console.log('✅ Column email added successfully');
  }
  
  // Verify the column was added
  db.all('PRAGMA table_info(users)', (err, cols) => {
    if (err) {
      console.error('Error checking table:', err);
    } else {
      console.log('\n✅ Updated table structure:');
      console.table(cols);
    }
    db.close();
  });
});
