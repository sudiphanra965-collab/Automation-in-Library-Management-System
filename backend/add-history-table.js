// add-history-table.js
// Migration script to add borrow_history table for tracking all book transactions

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Creating borrow_history table...');
  
  // Create borrow_history table to track all transactions
  db.run(`CREATE TABLE IF NOT EXISTS borrow_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT,
    book_title TEXT,
    book_author TEXT,
    book_isbn TEXT,
    issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    due_date DATETIME,
    fine_amount DECIMAL(10,2) DEFAULT 0,
    fine_paid INTEGER DEFAULT 0,
    status TEXT DEFAULT 'borrowed',
    issued_by TEXT,
    returned_to TEXT,
    notes TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, (err) => {
    if (err) {
      console.error('Error creating borrow_history table:', err);
    } else {
      console.log('✅ borrow_history table created successfully');
    }
  });

  // Migrate existing borrowed_books data to history
  db.run(`INSERT INTO borrow_history (book_id, user_id, username, book_title, issue_date, status)
    SELECT 
      bb.book_id,
      bb.user_id,
      u.username,
      b.title,
      bb.borrow_date,
      'borrowed'
    FROM borrowed_books bb
    LEFT JOIN users u ON bb.user_id = u.id
    LEFT JOIN books b ON bb.book_id = b.id
    WHERE NOT EXISTS (
      SELECT 1 FROM borrow_history bh 
      WHERE bh.book_id = bb.book_id 
      AND bh.user_id = bb.user_id 
      AND bh.status = 'borrowed'
    )`, (err) => {
    if (err) {
      console.error('Error migrating data:', err);
    } else {
      console.log('✅ Existing borrowed books migrated to history');
    }
    
    db.close(() => {
      console.log('✅ Migration completed successfully');
      console.log('You can now restart your servers');
    });
  });
});
