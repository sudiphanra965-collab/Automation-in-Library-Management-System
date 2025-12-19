// Data Migration Script: SQLite to PostgreSQL
// Migrates all data from SQLite to PostgreSQL

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db_postgres = require('./db-postgres');

// SQLite database connection
const sqliteDb = new sqlite3.Database(
  path.join(__dirname, 'library.db'),
  sqlite3.OPEN_READONLY,
  (err) => {
    if (err) {
      console.error('❌ Error opening SQLite database:', err.message);
      process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
  }
);

// Helper function to get all rows from SQLite
function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ==================== MIGRATION FUNCTIONS ====================  

async function migrateUsers() {
  console.log('\n📋 Migrating users...');
  try {
    const users = await sqliteAll('SELECT * FROM users');
    console.log(`Found ${users.length} users`);
    
    for (const user of users) {
      await db_postgres.run(
        `INSERT INTO users (id, username, password, is_admin, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO UPDATE SET
         password = EXCLUDED.password,
         is_admin = EXCLUDED.is_admin`,
        [
          user.id,
          user.username,
          user.password,
          user.is_admin === 1,
          user.created_at || new Date().toISOString()
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`
    );
    
    console.log(`✅ Migrated ${users.length} users`);
  } catch (error) {
    console.error('❌ Error migrating users:', error.message);
    throw error;
  }
}

async function migrateBooks() {
  console.log('\n📚 Migrating books...');
  try {
    const books = await sqliteAll('SELECT * FROM books');
    console.log(`Found ${books.length} books`);
    
    for (const book of books) {
      await db_postgres.run(
        `INSERT INTO books (id, title, author, isbn, category, publisher, year, 
                           description, image, available, rating, review_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (isbn) DO UPDATE SET
         title = EXCLUDED.title,
         author = EXCLUDED.author,
         category = EXCLUDED.category,
         available = EXCLUDED.available`,
        [
          book.id,
          book.title,
          book.author,
          book.isbn,
          book.category,
          book.publisher,
          book.year,
          book.description,
          book.image,
          book.available === 1,
          book.rating || 0,
          book.review_count || 0,
          book.created_at || new Date().toISOString()
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('books_id_seq', (SELECT MAX(id) FROM books))`
    );
    
    console.log(`✅ Migrated ${books.length} books`);
  } catch (error) {
    console.error('❌ Error migrating books:', error.message);
    throw error;
  }
}

async function migrateBorrowedBooks() {
  console.log('\n📖 Migrating borrowed books...');
  try {
    const borrowed = await sqliteAll('SELECT * FROM borrowed_books');
    console.log(`Found ${borrowed.length} borrowed records`);
    
    for (const record of borrowed) {
      await db_postgres.run(
        `INSERT INTO borrowed_books (id, book_id, user_id, username, title, author,
                                     borrow_date, return_date, returned_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
        [
          record.id,
          record.book_id,
          record.user_id,
          record.username,
          record.title,
          record.author,
          record.borrow_date,
          record.return_date,
          record.returned_date
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('borrowed_books_id_seq', (SELECT MAX(id) FROM borrowed_books))`
    );
    
    console.log(`✅ Migrated ${borrowed.length} borrowed records`);
  } catch (error) {
    console.error('❌ Error migrating borrowed books:', error.message);
    throw error;
  }
}

async function migrateReadingLists() {
  console.log('\n📚 Migrating reading lists...');
  try {
    const lists = await sqliteAll('SELECT * FROM reading_lists');
    console.log(`Found ${lists.length} reading lists`);
    
    for (const list of lists) {
      await db_postgres.run(
        `INSERT INTO reading_lists (id, user_id, name, description, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, name) DO NOTHING`,
        [
          list.id,
          list.user_id,
          list.name,
          list.description,
          list.created_at || new Date().toISOString()
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('reading_lists_id_seq', (SELECT MAX(id) FROM reading_lists))`
    );
    
    console.log(`✅ Migrated ${lists.length} reading lists`);
  } catch (error) {
    console.error('❌ Error migrating reading lists:', error.message);
    throw error;
  }
}

async function migrateListItems() {
  console.log('\n📋 Migrating list items...');
  try {
    const items = await sqliteAll('SELECT * FROM list_items');
    console.log(`Found ${items.length} list items`);
    
    for (const item of items) {
      await db_postgres.run(
        `INSERT INTO list_items (id, list_id, book_id, added_at, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (list_id, book_id) DO NOTHING`,
        [
          item.id,
          item.list_id,
          item.book_id,
          item.added_at || new Date().toISOString(),
          item.notes
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('list_items_id_seq', (SELECT MAX(id) FROM list_items))`
    );
    
    console.log(`✅ Migrated ${items.length} list items`);
  } catch (error) {
    console.error('❌ Error migrating list items:', error.message);
    throw error;
  }
}

async function migrateReviews() {
  console.log('\n⭐ Migrating reviews...');
  try {
    const reviews = await sqliteAll('SELECT * FROM reviews');
    console.log(`Found ${reviews.length} reviews`);
    
    for (const review of reviews) {
      await db_postgres.run(
        `INSERT INTO reviews (id, book_id, user_id, rating, review_text, 
                             helpful_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (book_id, user_id) DO UPDATE SET
         rating = EXCLUDED.rating,
         review_text = EXCLUDED.review_text`,
        [
          review.id,
          review.book_id,
          review.user_id,
          review.rating,
          review.review_text,
          review.helpful_count || 0,
          review.created_at || new Date().toISOString(),
          review.updated_at || new Date().toISOString()
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('reviews_id_seq', (SELECT MAX(id) FROM reviews))`
    );
    
    console.log(`✅ Migrated ${reviews.length} reviews`);
  } catch (error) {
    console.error('❌ Error migrating reviews:', error.message);
    throw error;
  }
}

async function migrateNotifications() {
  console.log('\n🔔 Migrating notifications...');
  try {
    const notifications = await sqliteAll('SELECT * FROM notifications');
    console.log(`Found ${notifications.length} notifications`);
    
    for (const notif of notifications) {
      await db_postgres.run(
        `INSERT INTO notifications (id, user_id, type, title, message, link, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          notif.id,
          notif.user_id,
          notif.type,
          notif.title,
          notif.message,
          notif.link,
          notif.read === 1,
          notif.created_at || new Date().toISOString()
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications))`
    );
    
    console.log(`✅ Migrated ${notifications.length} notifications`);
  } catch (error) {
    console.error('❌ Error migrating notifications:', error.message);
    throw error;
  }
}

async function migrateReservations() {
  console.log('\n📅 Migrating reservations...');
  try {
    const reservations = await sqliteAll('SELECT * FROM reservations');
    console.log(`Found ${reservations.length} reservations`);
    
    for (const reservation of reservations) {
      await db_postgres.run(
        `INSERT INTO reservations (id, book_id, user_id, position, status,
                                   reserved_at, notified_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          reservation.id,
          reservation.book_id,
          reservation.user_id,
          reservation.position,
          reservation.status || 'pending',
          reservation.reserved_at || new Date().toISOString(),
          reservation.notified_at,
          reservation.expires_at
        ]
      );
    }
    
    // Update sequence
    await db_postgres.query(
      `SELECT setval('reservations_id_seq', (SELECT MAX(id) FROM reservations))`
    );
    
    console.log(`✅ Migrated ${reservations.length} reservations`);
  } catch (error) {
    console.error('❌ Error migrating reservations:', error.message);
    throw error;
  }
}

async function migrateUserStats() {
  console.log('\n📊 Migrating user stats...');
  try {
    const stats = await sqliteAll('SELECT * FROM user_stats');
    console.log(`Found ${stats.length} user stats records`);
    
    for (const stat of stats) {
      await db_postgres.run(
        `INSERT INTO user_stats (user_id, total_borrowed, total_returned, 
                                currently_borrowed, reading_streak, last_borrow_date,
                                favorite_category, total_points, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET
         total_borrowed = EXCLUDED.total_borrowed,
         total_returned = EXCLUDED.total_returned,
         currently_borrowed = EXCLUDED.currently_borrowed`,
        [
          stat.user_id,
          stat.total_borrowed || 0,
          stat.total_returned || 0,
          stat.currently_borrowed || 0,
          stat.reading_streak || 0,
          stat.last_borrow_date,
          stat.favorite_category,
          stat.total_points || 0,
          stat.updated_at || new Date().toISOString()
        ]
      );
    }
    
    console.log(`✅ Migrated ${stats.length} user stats records`);
  } catch (error) {
    console.error('❌ Error migrating user stats:', error.message);
    throw error;
  }
}

// ==================== MAIN MIGRATION ====================

async function runMigration() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL...\n');
  console.log('⚠️  Make sure PostgreSQL is running and schema is created!');
  console.log('⚠️  Run: psql -U library_admin -d library_system -f init-postgres.sql\n');
  
  const startTime = Date.now();
  
  try {
    // Check PostgreSQL connection
    const health = await db_postgres.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error('PostgreSQL is not healthy: ' + health.error);
    }
    
    // Migrate in order (respecting foreign keys)
    await migrateUsers();
    await migrateBooks();
    await migrateBorrowedBooks();
    await migrateReadingLists();
    await migrateListItems();
    await migrateReviews();
    await migrateNotifications();
    await migrateReservations();
    await migrateUserStats();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log('\n📊 Next steps:');
    console.log('1. Update server.js and server-https.js to use PostgreSQL');
    console.log('2. Test all API endpoints');
    console.log('3. Verify data integrity');
    console.log('4. Update frontend if needed');
    console.log('5. Deploy to production!');
    console.log('\n🎉 Your library system is now ready for millions of records!');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Close connections
    sqliteDb.close();
    await db_postgres.close();
  }
}

// Run migration
runMigration();
