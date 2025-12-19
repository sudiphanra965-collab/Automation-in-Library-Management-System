const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./library.db');

console.log('\n=== Checking Database ===\n');

db.get('SELECT COUNT(*) as count FROM books', (err, row) => {
  if (err) {
    console.error('Books table error:', err.message);
  } else {
    console.log('📚 Books in database:', row.count);
  }
  
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Users table error:', err.message);
    } else {
      console.log('👤 Users in database:', row.count);
    }
    
    db.get('SELECT COUNT(*) as count FROM borrowed_books', (err, row) => {
      if (err) {
        console.error('Borrowed books table error:', err.message);
      } else {
        console.log('📖 Borrowed books:', row.count);
      }
      
      // Check if admin user exists
      db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) {
          console.error('Admin check error:', err.message);
        } else if (row) {
          console.log('✅ Admin user exists');
        } else {
          console.log('❌ Admin user NOT found');
        }
        
        // Show sample books
        db.all('SELECT id, title, author FROM books LIMIT 5', (err, rows) => {
          if (err) {
            console.error('Sample books error:', err.message);
          } else {
            console.log('\nSample books:');
            rows.forEach(book => {
              console.log(`  ${book.id}. ${book.title} by ${book.author}`);
            });
          }
          
          db.close();
          console.log('\n=== Database Check Complete ===\n');
        });
      });
    });
  });
});
