// Add fine_paid column to borrowed_books table
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'library.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

db.run(`ALTER TABLE borrowed_books ADD COLUMN fine_paid INTEGER DEFAULT 0`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column')) {
      console.log('✅ Column fine_paid already exists');
    } else {
      console.error('Error adding column:', err);
    }
  } else {
    console.log('✅ Column fine_paid added successfully');
  }
  
  // Verify the column was added
  db.all('PRAGMA table_info(borrowed_books)', (err, cols) => {
    if (err) {
      console.error('Error checking table:', err);
    } else {
      console.log('\n✅ Updated table structure:');
      console.table(cols);
    }
    db.close();
  });
});
