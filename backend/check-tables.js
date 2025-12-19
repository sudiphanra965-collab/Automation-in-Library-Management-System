const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'library.db');

console.log('\n=== Checking Database ===\n');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  
  console.log('Connected to the database.');
  
  // List all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'books_fts%'", [], (err, tables) => {
    if (err) {
      console.error('Error fetching tables:', err);
      db.close();
      return;
    }
    
    console.log('\nTables in the database:');
    console.log('---------------------');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
      
      // Count rows in each table
      db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
        if (!err && row) {
          console.log(`  Rows: ${row.count}`);
          
          // Show first few rows for non-empty tables
          if (row.count > 0) {
            db.all(`SELECT * FROM ${table.name} LIMIT 3`, (err, rows) => {
              if (!err && rows && rows.length > 0) {
                console.log('  Sample data:');
                console.log(JSON.stringify(rows, null, 2));
              }
              
              // If this was the last table, close the database
              if (table === tables[tables.length - 1]) {
                db.close();
              }
            });
          } else if (table === tables[tables.length - 1]) {
            db.close();
          }
        } else {
          console.log(`  Error counting rows: ${err ? err.message : 'Unknown error'}`);
          if (table === tables[tables.length - 1]) {
            db.close();
          }
        }
      });
    });
    
    if (tables.length === 0) {
      console.log('No tables found!');
      db.close();
    }
  });
});
