// Fix notifications table - drop old one and create new one
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'library.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

// Drop old table and create new one
db.serialize(() => {
  // Drop old table
  db.run('DROP TABLE IF EXISTS notifications', (err) => {
    if (err) {
      console.error('Error dropping old table:', err);
    } else {
      console.log('✅ Old notifications table dropped');
    }
  });
  
  // Create new table with correct structure
  db.run(`
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      book_title TEXT NOT NULL,
      borrow_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (borrow_id) REFERENCES borrowed_books(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating notifications table:', err);
    } else {
      console.log('✅ New notifications table created successfully');
      
      // Verify structure
      db.all("PRAGMA table_info(notifications)", (err, columns) => {
        if (err) {
          console.error('Error getting table info:', err);
        } else {
          console.log('\n✅ Table structure verified:');
          console.table(columns);
        }
        db.close();
      });
    }
  });
});
