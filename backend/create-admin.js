// create-admin.js
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, is_admin INTEGER DEFAULT 0)');
  db.run('INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, 1)', [ADMIN_USERNAME, hash], function(err) {
    if (err) console.error('create-admin error', err);
    else console.log('Admin ensured:', ADMIN_USERNAME);
    db.close();
  });
});
