const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Initializing new features database schema...\n');

db.serialize(() => {
  // 1. Add rating columns to books table
  console.log('📊 Adding rating columns to books table...');
  db.run(`ALTER TABLE books ADD COLUMN rating REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('Error:', err.message);
  });
  db.run(`ALTER TABLE books ADD COLUMN review_count INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('Error:', err.message);
  });

  // 2. Create reading_lists table
  console.log('📚 Creating reading_lists table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS reading_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 3. Create list_items table
  console.log('📝 Creating list_items table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (list_id) REFERENCES reading_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      UNIQUE(list_id, book_id)
    )
  `);

  // 4. Create reviews table
  console.log('⭐ Creating reviews table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      review_text TEXT,
      helpful_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(book_id, user_id)
    )
  `);

  // 5. Create notifications table
  console.log('🔔 Creating notifications table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 6. Create reservations table
  console.log('📅 Creating reservations table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'available', 'expired', 'cancelled')),
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notified_at DATETIME,
      expires_at DATETIME,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 7. Create achievements table
  console.log('🏆 Creating achievements table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      criteria TEXT NOT NULL,
      points INTEGER DEFAULT 0
    )
  `);

  // 8. Create user_achievements table
  console.log('🎯 Creating user_achievements table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE(user_id, achievement_id)
    )
  `);

  // 9. Create user_stats table for caching
  console.log('📊 Creating user_stats table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      total_borrowed INTEGER DEFAULT 0,
      total_returned INTEGER DEFAULT 0,
      currently_borrowed INTEGER DEFAULT 0,
      reading_streak INTEGER DEFAULT 0,
      last_borrow_date DATE,
      favorite_category TEXT,
      total_points INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Insert default achievements
  console.log('🎖️ Inserting default achievements...');
  const achievements = [
    ['Bookworm', 'Borrow 10 books', '📚', 'borrowed_count >= 10', 100],
    ['Speed Reader', 'Borrow 5 books in one month', '⚡', 'monthly_borrowed >= 5', 150],
    ['Explorer', 'Read from 5 different categories', '🌟', 'categories_count >= 5', 200],
    ['Streak Master', 'Maintain 30-day reading streak', '🔥', 'reading_streak >= 30', 300],
    ['Dedicated Reader', 'Borrow every week for a month', '📖', 'weekly_streak >= 4', 250],
    ['Reviewer', 'Write 10 reviews', '⭐', 'reviews_count >= 10', 150],
    ['Library Champion', 'Top borrower of the month', '👑', 'top_borrower', 500]
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO achievements (name, description, icon, criteria, points) VALUES (?, ?, ?, ?, ?)');
  achievements.forEach(a => stmt.run(a));
  stmt.finalize();

  // Create default reading lists for existing users
  console.log('📋 Creating default reading lists...');
  db.all('SELECT id FROM users', [], (err, users) => {
    if (err) {
      console.error('Error fetching users:', err);
      return;
    }
    
    const listStmt = db.prepare('INSERT OR IGNORE INTO reading_lists (user_id, name, description) VALUES (?, ?, ?)');
    users.forEach(user => {
      listStmt.run(user.id, 'Want to Read', 'Books I want to read');
      listStmt.run(user.id, 'Currently Reading', 'Books I am currently reading');
      listStmt.run(user.id, 'Favorites', 'My favorite books');
    });
    listStmt.finalize();
    
    console.log(`✅ Created default lists for ${users.length} users`);
  });

  // Initialize user stats for existing users
  console.log('📈 Initializing user stats...');
  db.run(`
    INSERT OR IGNORE INTO user_stats (user_id, total_borrowed, total_returned, currently_borrowed)
    SELECT 
      u.id,
      (SELECT COUNT(*) FROM borrowed_books WHERE user_id = u.id),
      (SELECT COUNT(*) FROM borrowed_books WHERE user_id = u.id AND returned_date IS NOT NULL),
      (SELECT COUNT(*) FROM borrowed_books WHERE user_id = u.id AND returned_date IS NULL)
    FROM users u
  `);

  console.log('\n✅ Database schema updated successfully!');
  console.log('\n📋 New tables created:');
  console.log('  - reading_lists (for custom book lists)');
  console.log('  - list_items (books in lists)');
  console.log('  - reviews (book reviews and ratings)');
  console.log('  - notifications (user notifications)');
  console.log('  - reservations (book reservations)');
  console.log('  - achievements (achievement definitions)');
  console.log('  - user_achievements (unlocked achievements)');
  console.log('  - user_stats (cached user statistics)');
  console.log('\n🎉 Ready to use new features!\n');

  db.close();
});
