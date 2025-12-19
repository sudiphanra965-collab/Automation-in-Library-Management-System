const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./library.db');

console.log('\n🔧 FIXING DATA INCONSISTENCY...\n');

// Find books that are marked unavailable but have no borrow record
db.all(`
  SELECT b.id, b.title
  FROM books b
  LEFT JOIN borrowed_books bb ON b.id = bb.book_id
  WHERE b.available = 0 AND bb.id IS NULL
`, (err, orphanedBooks) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  if (orphanedBooks.length === 0) {
    console.log('✅ No data issues found!');
    db.close();
    return;
  }

  console.log(`Found ${orphanedBooks.length} books marked as unavailable but with no borrow record:`);
  orphanedBooks.forEach(book => {
    console.log(`  - Book ID ${book.id}: ${book.title}`);
  });

  console.log('\nFixing: Setting these books back to available...\n');

  const ids = orphanedBooks.map(b => b.id).join(',');
  db.run(`UPDATE books SET available = 1 WHERE id IN (${ids})`, function(err) {
    if (err) {
      console.error('Error updating books:', err);
    } else {
      console.log(`✅ Fixed ${this.changes} books - set them back to available`);
      console.log('\n💡 Now these books can be properly borrowed again!');
    }
    db.close();
  });
});
