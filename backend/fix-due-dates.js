// fix-due-dates.js - Fix NULL due dates in history
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Fixing NULL due dates in history...\n');

// Update records with NULL due_date
db.run(`UPDATE borrow_history 
  SET due_date = datetime(issue_date, '+14 days')
  WHERE due_date IS NULL`, function(err) {
  
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`✅ Fixed ${this.changes} records with NULL due dates`);
  }
  
  // Show all records now
  db.all('SELECT * FROM borrow_history ORDER BY issue_date DESC', (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log(`\nCurrent history (${rows.length} records):\n`);
      rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.book_title} - ${row.username}`);
        console.log(`   Issue: ${row.issue_date}`);
        console.log(`   Due: ${row.due_date}`);
        console.log(`   Return: ${row.return_date || 'Not returned'}`);
        console.log(`   Status: ${row.status}`);
        console.log('');
      });
    }
    db.close();
  });
});
