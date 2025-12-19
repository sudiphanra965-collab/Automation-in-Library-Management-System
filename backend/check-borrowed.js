const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./library.db');

console.log('\n📋 CHECKING BORROWED BOOKS:\n');

db.all(`
  SELECT 
    b.id,
    b.title,
    b.available,
    bb.borrow_date,
    u.username as borrower
  FROM books b
  LEFT JOIN borrowed_books bb ON b.id = bb.book_id
  LEFT JOIN users u ON bb.user_id = u.id
  WHERE b.id IN (1,2,3,4,5,6,7,8,9,10)
  ORDER BY b.id
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('ID  | Available | Borrower      | Title');
    console.log('----+-----------+---------------+-------------------------');
    rows.forEach(row => {
      const avail = row.available ? 'Yes ✅' : 'No  ❌';
      const borrower = row.borrower || '(none)';
      console.log(`${row.id.toString().padEnd(3)} | ${avail.padEnd(9)} | ${borrower.padEnd(13)} | ${row.title.substring(0, 25)}`);
    });
  }
  db.close();
});
