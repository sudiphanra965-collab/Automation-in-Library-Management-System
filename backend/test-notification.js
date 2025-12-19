// Test notification endpoint
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Testing notification system...\n');

// Check if notifications table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'", (err, tables) => {
  if (err) {
    console.error('❌ Error checking tables:', err);
    return;
  }
  
  if (tables.length === 0) {
    console.error('❌ Notifications table does NOT exist!');
    db.close();
    return;
  }
  
  console.log('✅ Notifications table exists\n');
  
  // Check table structure
  db.all("PRAGMA table_info(notifications)", (err, columns) => {
    if (err) {
      console.error('❌ Error getting table info:', err);
      db.close();
      return;
    }
    
    console.log('Table structure:');
    console.table(columns);
    
    // Check if there are any notifications
    db.all("SELECT * FROM notifications", (err, notifications) => {
      if (err) {
        console.error('❌ Error getting notifications:', err);
      } else {
        console.log(`\n📊 Total notifications: ${notifications.length}`);
        if (notifications.length > 0) {
          console.log('\nNotifications:');
          console.table(notifications);
        }
      }
      
      // Check borrowed books
      db.all("SELECT id, book_id, user_id, borrow_date FROM borrowed_books LIMIT 5", (err, books) => {
        if (err) {
          console.error('❌ Error getting borrowed books:', err);
        } else {
          console.log(`\n📚 Sample borrowed books: ${books.length}`);
          if (books.length > 0) {
            console.table(books);
          }
        }
        
        db.close();
      });
    });
  });
});
