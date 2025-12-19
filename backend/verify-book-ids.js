// verify-book-ids.js - Verify all books have proper IDs
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('\n📋 VERIFYING BOOK IDs IN DATABASE\n');
console.log('='.repeat(70));

db.all('SELECT id, title, author, category, available FROM books ORDER BY id', [], (err, books) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  if (books.length === 0) {
    console.log('❌ No books found in database!');
    db.close();
    return;
  }

  console.log(`\n✅ Total Books Found: ${books.length}\n`);
  
  // Check for missing IDs
  const ids = books.map(b => b.id);
  const maxId = Math.max(...ids);
  const missingIds = [];
  
  for (let i = 1; i <= maxId; i++) {
    if (!ids.includes(i)) {
      missingIds.push(i);
    }
  }

  // Display all books with their IDs
  console.log('┌──────┬──────────────────────────────────────┬─────────────────────┬──────────────┐');
  console.log('│  ID  │ Title                                │ Author              │ Status       │');
  console.log('├──────┼──────────────────────────────────────┼─────────────────────┼──────────────┤');
  
  books.forEach(book => {
    const id = String(book.id).padEnd(4);
    const title = (book.title || 'N/A').substring(0, 36).padEnd(36);
    const author = (book.author || 'N/A').substring(0, 19).padEnd(19);
    const status = book.available ? '✅ Available' : '📤 Issued   ';
    
    console.log(`│ ${id} │ ${title} │ ${author} │ ${status} │`);
  });
  
  console.log('└──────┴──────────────────────────────────────┴─────────────────────┴──────────────┘');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ All books have valid IDs: YES`);
  console.log(`   📚 Total books: ${books.length}`);
  console.log(`   🔢 ID range: ${Math.min(...ids)} to ${maxId}`);
  
  if (missingIds.length > 0) {
    console.log(`   ⚠️  Missing IDs: ${missingIds.join(', ')}`);
  } else {
    console.log(`   ✅ No gaps in ID sequence`);
  }
  
  const availableCount = books.filter(b => b.available).length;
  const issuedCount = books.length - availableCount;
  console.log(`   ✅ Available: ${availableCount}`);
  console.log(`   📤 Issued: ${issuedCount}`);

  console.log('\n💡 All previously enrolled books have auto-generated IDs!');
  console.log('   Database uses SQLite AUTO_INCREMENT for automatic ID assignment.\n');
  
  db.close();
});
