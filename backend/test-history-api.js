// test-history-api.js - Test the history API endpoint
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Testing history API query...\n');

const query = `SELECT 
  bh.*,
  CASE 
    WHEN bh.status = 'borrowed' THEN 'Active'
    WHEN bh.status = 'returned' THEN 'Returned'
    ELSE bh.status
  END as display_status,
  CASE 
    WHEN bh.return_date IS NULL AND datetime('now') > bh.due_date THEN 1
    ELSE 0
  END as is_overdue,
  CASE 
    WHEN bh.return_date IS NULL AND datetime('now') > bh.due_date 
    THEN CAST((julianday('now') - julianday(bh.due_date)) * 5 AS INTEGER)
    ELSE bh.fine_amount
  END as calculated_fine
  FROM borrow_history bh
  ORDER BY bh.issue_date DESC`;

db.all(query, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`Query returned ${rows.length} records:\n`);
    rows.forEach((row, i) => {
      console.log(`${i + 1}. Book ID: ${row.book_id} - ${row.book_title}`);
      console.log(`   User: ${row.username}`);
      console.log(`   Status: ${row.display_status}`);
      console.log(`   Issue: ${row.issue_date}`);
      console.log(`   Return: ${row.return_date || 'Not returned'}`);
      console.log(`   Overdue: ${row.is_overdue ? 'Yes' : 'No'}`);
      console.log(`   Fine: ₹${row.calculated_fine || 0}`);
      console.log('');
    });
  }
  db.close();
});
