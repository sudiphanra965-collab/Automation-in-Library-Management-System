// Check borrowed_books schema
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('📋 Checking borrowed_books table schema...\n');

db.all("PRAGMA table_info(borrowed_books)", (err, columns) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Columns in borrowed_books:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  const hasReturnDate = columns.some(col => col.name === 'return_date');
  const hasReturnedDate = columns.some(col => col.name === 'returned_date');
  
  console.log('\n📊 Analysis:');
  console.log(`  return_date exists: ${hasReturnDate ? '✅' : '❌'}`);
  console.log(`  returned_date exists: ${hasReturnedDate ? '✅' : '❌'}`);
  
  db.close();
});
