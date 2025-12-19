const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./library.db');

db.all('SELECT id, title, author, available FROM books ORDER BY id LIMIT 30', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\n📚 BOOKS IN YOUR DATABASE:\n');
    console.log('ID  | Available | Title');
    console.log('----+-----------+----------------------------------------');
    rows.forEach(book => {
      const status = book.available ? '✅ Yes' : '❌ No (Borrowed)';
      console.log(`${book.id.toString().padEnd(3)} | ${status.padEnd(9)} | ${book.title.substring(0, 40)}`);
    });
    console.log('\n💡 Use these IDs to test the gate scanner!\n');
  }
  db.close();
});
