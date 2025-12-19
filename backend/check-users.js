// check-users.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking users in database...');

db.all('SELECT id, username, is_admin FROM users', (err, rows) => {
  if (err) {
    console.error('Error querying users:', err);
  } else {
    console.log('Users found:');
    console.table(rows);
    
    const adminUsers = rows.filter(user => user.is_admin === 1);
    console.log(`\nAdmin users: ${adminUsers.length}`);
    adminUsers.forEach(admin => {
      console.log(`- ${admin.username} (ID: ${admin.id})`);
    });
  }
  
  db.close();
});
