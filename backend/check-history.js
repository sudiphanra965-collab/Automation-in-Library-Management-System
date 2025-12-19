// check-history.js - Check borrow_history table data
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking borrow_history table...\n');

// Check if table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='borrow_history'", (err, row) => {
  if (err) {
    console.error('Error checking table:', err);
    return;
  }
  
  if (!row) {
    console.log('❌ borrow_history table does NOT exist!');
    console.log('Run: node add-history-table.js');
    db.close();
    return;
  }
  
  console.log('✅ borrow_history table exists\n');
  
  // Get all records
  db.all('SELECT * FROM borrow_history ORDER BY issue_date DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching history:', err);
      db.close();
      return;
    }
    
    console.log(`Found ${rows.length} records in borrow_history:\n`);
    
    if (rows.length === 0) {
      console.log('⚠️  No records found!');
      console.log('\nChecking borrowed_books table...');
      
      db.all('SELECT * FROM borrowed_books', (err, borrowed) => {
        if (err) {
          console.error('Error:', err);
        } else {
          console.log(`Found ${borrowed.length} active borrowed books:`);
          borrowed.forEach(b => {
            console.log(`  - Book ID: ${b.book_id}, User ID: ${b.user_id}, Date: ${b.borrow_date}`);
          });
        }
        db.close();
      });
    } else {
      rows.forEach((row, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Book: ${row.book_title} by ${row.book_author}`);
        console.log(`  User: ${row.username}`);
        console.log(`  Issue Date: ${row.issue_date}`);
        console.log(`  Due Date: ${row.due_date}`);
        console.log(`  Return Date: ${row.return_date || 'Not returned'}`);
        console.log(`  Status: ${row.status}`);
        console.log(`  Fine: ₹${row.fine_amount || 0}`);
        console.log(`  Issued By: ${row.issued_by || 'N/A'}`);
        console.log(`  Returned To: ${row.returned_to || 'N/A'}`);
        console.log('');
      });
      db.close();
    }
  });
});
