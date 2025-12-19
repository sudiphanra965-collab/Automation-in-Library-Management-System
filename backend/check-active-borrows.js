// check-active-borrows.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking currently borrowed books...\n');

db.all(`SELECT bb.*, b.title, b.author, u.username 
  FROM borrowed_books bb
  LEFT JOIN books b ON bb.book_id = b.id
  LEFT JOIN users u ON bb.user_id = u.id`, (err, rows) => {
  
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`Found ${rows.length} currently borrowed books:\n`);
    rows.forEach((row, i) => {
      console.log(`${i + 1}. Book ID: ${row.book_id} - "${row.title}" by ${row.author}`);
      console.log(`   User: ${row.username} (ID: ${row.user_id})`);
      console.log(`   Borrowed: ${row.borrow_date}`);
      console.log('');
    });
  }
  db.close();
});
