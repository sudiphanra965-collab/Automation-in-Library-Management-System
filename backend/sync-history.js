// sync-history.js - Sync current borrowed books to history
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Syncing borrowed books to history...\n');

// Get all currently borrowed books
db.all(`SELECT 
  bb.*, 
  b.title, b.author, b.isbn,
  u.username
  FROM borrowed_books bb
  LEFT JOIN books b ON bb.book_id = b.id
  LEFT JOIN users u ON bb.user_id = u.id`, (err, borrowed) => {
  
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log(`Found ${borrowed.length} currently borrowed books\n`);
  
  if (borrowed.length === 0) {
    console.log('No borrowed books to sync');
    db.close();
    return;
  }
  
  let synced = 0;
  
  borrowed.forEach((book, index) => {
    console.log(`${index + 1}. Book: ${book.title}, User: ${book.username}, Borrowed: ${book.borrow_date}`);
    
    // Check if already in history
    db.get(`SELECT id FROM borrow_history 
      WHERE book_id = ? AND user_id = ? AND status = 'borrowed'`,
      [book.book_id, book.user_id], (err, existing) => {
      
      if (existing) {
        console.log(`   ✓ Already in history (ID: ${existing.id})`);
      } else {
        // Add to history
        db.run(`INSERT INTO borrow_history 
          (book_id, user_id, username, book_title, book_author, book_isbn, 
           issue_date, due_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?, '+14 days'), 'borrowed')`,
          [book.book_id, book.user_id, book.username, book.title, 
           book.author, book.isbn, book.borrow_date, book.borrow_date],
          (err) => {
            if (err) {
              console.log(`   ❌ Error adding to history: ${err.message}`);
            } else {
              console.log(`   ✅ Added to history`);
              synced++;
            }
            
            // Close DB after last item
            if (index === borrowed.length - 1) {
              setTimeout(() => {
                console.log(`\n✅ Sync complete! Added ${synced} new records to history`);
                db.close();
              }, 100);
            }
          });
      }
      
      // Close DB after last item if all already exist
      if (index === borrowed.length - 1 && existing) {
        setTimeout(() => {
          console.log(`\n✅ All borrowed books already in history`);
          db.close();
        }, 100);
      }
    });
  });
});
