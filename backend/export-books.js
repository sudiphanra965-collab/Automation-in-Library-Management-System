// export-books.js
// Exports ONLY the books table from local SQLite into seed-books.json (safe to commit).

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'library.db');
const outPath = path.join(__dirname, 'seed-books.json');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB open error:', err.message);
    process.exit(1);
  }
});

db.all('SELECT * FROM books ORDER BY id', (err, rows) => {
  if (err) {
    console.error('Query error:', err.message);
    process.exit(1);
  }

  const safe = rows.map((b) => ({
    // Keep id out; cloud DB should auto-assign
    title: b.title ?? '',
    author: b.author ?? '',
    isbn: b.isbn ?? '',
    category: b.category ?? '',
    description: b.description ?? '',
    image: b.image ?? '',
    available: (b.available == null ? 1 : b.available) ? 1 : 0,
    publisher: b.publisher ?? '',
    year: b.year ?? null,
    abstract: b.abstract ?? '',
    toc: b.toc ?? '',
    subjects: b.subjects ?? '',
    rating: b.rating ?? 0,
    review_count: b.review_count ?? 0
  }));

  fs.writeFileSync(outPath, JSON.stringify(safe, null, 2), 'utf8');
  console.log(`✅ Exported ${safe.length} books to ${outPath}`);
  db.close();
});


