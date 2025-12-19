// New Features API Endpoints
// This file contains all API endpoints for features 5, 6, 7, 8, 11, 14, 15

const express = require('express');
const router = express.Router();

// Helper functions (to be used with your existing database setup)
// These assume you have `get`, `all`, `run` functions from your server setup

module.exports = (get, all, run, authenticateToken) => {

  // ==================== FEATURE 5: USER STATS ====================
  
  // Get user statistics
  router.get('/api/user/stats', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get or create user stats
      let stats = await get('SELECT * FROM user_stats WHERE user_id = ?', [userId]);
      
      if (!stats) {
        // Calculate and insert stats
        const totalBorrowed = await get('SELECT COUNT(*) as count FROM borrowed_books WHERE user_id = ?', [userId]);
        const totalReturned = await get('SELECT COUNT(*) as count FROM borrowed_books WHERE user_id = ? AND returned_date IS NOT NULL', [userId]);
        const currentlyBorrowed = await get('SELECT COUNT(*) as count FROM borrowed_books WHERE user_id = ? AND returned_date IS NULL', [userId]);
        
        await run(`
          INSERT INTO user_stats (user_id, total_borrowed, total_returned, currently_borrowed)
          VALUES (?, ?, ?, ?)
        `, [userId, totalBorrowed.count, totalReturned.count, currentlyBorrowed.count]);
        
        stats = await get('SELECT * FROM user_stats WHERE user_id = ?', [userId]);
      }
      
      // Get favorite category
      const favCategory = await get(`
        SELECT b.category, COUNT(*) as count
        FROM borrowed_books bb
        JOIN books b ON bb.book_id = b.id
        WHERE bb.user_id = ?
        GROUP BY b.category
        ORDER BY count DESC
        LIMIT 1
      `, [userId]);
      
      res.json({
        totalBorrowed: stats.total_borrowed,
        totalReturned: stats.total_returned,
        currentlyBorrowed: stats.currently_borrowed,
        readingStreak: stats.reading_streak || 0,
        favoriteCategory: favCategory ? favCategory.category : 'None',
        totalPoints: stats.total_points || 0
      });
    } catch (e) {
      console.error('User stats error:', e);
      res.status(500).json({ error: 'Failed to fetch user stats' });
    }
  });

  // ==================== FEATURE 6: READING LISTS ====================
  
  // Get user's reading lists
  router.get('/api/reading-lists', authenticateToken, async (req, res) => {
    try {
      const lists = await all(`
        SELECT rl.*, COUNT(li.id) as book_count
        FROM reading_lists rl
        LEFT JOIN list_items li ON rl.id = li.list_id
        WHERE rl.user_id = ?
        GROUP BY rl.id
        ORDER BY rl.created_at DESC
      `, [req.user.id]);
      
      res.json(lists);
    } catch (e) {
      console.error('Reading lists error:', e);
      res.status(500).json({ error: 'Failed to fetch reading lists' });
    }
  });
  
  // Create new reading list
  router.post('/api/reading-lists', authenticateToken, async (req, res) => {
    try {
      const { name, description } = req.body;
      const result = await run(
        'INSERT INTO reading_lists (user_id, name, description) VALUES (?, ?, ?)',
        [req.user.id, name, description || '']
      );
      
      res.json({ id: result.lastID, message: 'List created successfully' });
    } catch (e) {
      console.error('Create list error:', e);
      res.status(500).json({ error: 'Failed to create list' });
    }
  });
  
  // Get books in a list
  router.get('/api/reading-lists/:id/books', authenticateToken, async (req, res) => {
    try {
      const books = await all(`
        SELECT b.*, li.added_at, li.notes
        FROM list_items li
        JOIN books b ON li.book_id = b.id
        JOIN reading_lists rl ON li.list_id = rl.id
        WHERE rl.id = ? AND rl.user_id = ?
        ORDER BY li.added_at DESC
      `, [req.params.id, req.user.id]);
      
      res.json(books);
    } catch (e) {
      console.error('List books error:', e);
      res.status(500).json({ error: 'Failed to fetch list books' });
    }
  });
  
  // Add book to list
  router.post('/api/reading-lists/:id/books', authenticateToken, async (req, res) => {
    try {
      const { bookId, notes } = req.body;
      
      // Verify list belongs to user
      const list = await get('SELECT * FROM reading_lists WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!list) return res.status(404).json({ error: 'List not found' });
      
      await run(
        'INSERT OR IGNORE INTO list_items (list_id, book_id, notes) VALUES (?, ?, ?)',
        [req.params.id, bookId, notes || '']
      );
      
      res.json({ message: 'Book added to list' });
    } catch (e) {
      console.error('Add to list error:', e);
      res.status(500).json({ error: 'Failed to add book to list' });
    }
  });
  
  // Remove book from list
  router.delete('/api/reading-lists/:listId/books/:bookId', authenticateToken, async (req, res) => {
    try {
      // Verify list belongs to user
      const list = await get('SELECT * FROM reading_lists WHERE id = ? AND user_id = ?', [req.params.listId, req.user.id]);
      if (!list) return res.status(404).json({ error: 'List not found' });
      
      await run('DELETE FROM list_items WHERE list_id = ? AND book_id = ?', [req.params.listId, req.params.bookId]);
      
      res.json({ message: 'Book removed from list' });
    } catch (e) {
      console.error('Remove from list error:', e);
      res.status(500).json({ error: 'Failed to remove book from list' });
    }
  });

  // ==================== FEATURE 7: REVIEWS & RATINGS ====================
  
  // Get reviews for a book
  router.get('/api/books/:id/reviews', async (req, res) => {
    try {
      const reviews = await all(`
        SELECT r.*, u.username
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.book_id = ?
        ORDER BY r.created_at DESC
      `, [req.params.id]);
      
      res.json(reviews);
    } catch (e) {
      console.error('Get reviews error:', e);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });
  
  // Submit a review
  router.post('/api/books/:id/reviews', authenticateToken, async (req, res) => {
    try {
      const { rating, reviewText } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      
      // Insert or update review
      await run(`
        INSERT INTO reviews (book_id, user_id, rating, review_text)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(book_id, user_id) DO UPDATE SET
          rating = excluded.rating,
          review_text = excluded.review_text,
          updated_at = CURRENT_TIMESTAMP
      `, [req.params.id, req.user.id, rating, reviewText || '']);
      
      // Update book's average rating
      const avgRating = await get(`
        SELECT AVG(rating) as avg, COUNT(*) as count
        FROM reviews
        WHERE book_id = ?
      `, [req.params.id]);
      
      await run(
        'UPDATE books SET rating = ?, review_count = ? WHERE id = ?',
        [avgRating.avg, avgRating.count, req.params.id]
      );
      
      res.json({ message: 'Review submitted successfully' });
    } catch (e) {
      console.error('Submit review error:', e);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  });
  
  // Mark review as helpful
  router.post('/api/reviews/:id/helpful', authenticateToken, async (req, res) => {
    try {
      await run('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?', [req.params.id]);
      res.json({ message: 'Marked as helpful' });
    } catch (e) {
      console.error('Helpful error:', e);
      res.status(500).json({ error: 'Failed to mark as helpful' });
    }
  });

  // ==================== FEATURE 8: NOTIFICATIONS ====================
  
  // Get user notifications
  router.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
      const notifications = await all(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user.id]);
      
      const unreadCount = await get(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
        [req.user.id]
      );
      
      res.json({
        notifications,
        unreadCount: unreadCount.count
      });
    } catch (e) {
      console.error('Notifications error:', e);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });
  
  // Mark notification as read
  router.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
      await run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ message: 'Notification marked as read' });
    } catch (e) {
      console.error('Mark read error:', e);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });
  
  // Mark all notifications as read
  router.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
      await run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
      res.json({ message: 'All notifications marked as read' });
    } catch (e) {
      console.error('Mark all read error:', e);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });
  
  // Create notification (helper function for internal use)
  const createNotification = async (userId, type, title, message, link = null) => {
    try {
      await run(
        'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
        [userId, type, title, message, link]
      );
    } catch (e) {
      console.error('Create notification error:', e);
    }
  };

  // ==================== FEATURE 11: RESERVATIONS ====================
  
  // Reserve a book
  router.post('/api/books/:id/reserve', authenticateToken, async (req, res) => {
    try {
      const bookId = req.params.id;
      const userId = req.user.id;
      
      // Check if book is available
      const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      if (book.available) return res.status(400).json({ error: 'Book is available, borrow it directly' });
      
      // Check if user already has a reservation
      const existing = await get(
        'SELECT * FROM reservations WHERE book_id = ? AND user_id = ? AND status = "pending"',
        [bookId, userId]
      );
      if (existing) return res.status(400).json({ error: 'You already have a reservation for this book' });
      
      // Get current queue position
      const queueCount = await get(
        'SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = "pending"',
        [bookId]
      );
      
      // Create reservation
      await run(
        'INSERT INTO reservations (book_id, user_id, position) VALUES (?, ?, ?)',
        [bookId, userId, queueCount.count + 1]
      );
      
      // Create notification
      await createNotification(
        userId,
        'reservation',
        'Reservation Confirmed',
        `You're #${queueCount.count + 1} in line for "${book.title}"`
      );
      
      res.json({
        message: 'Reservation created successfully',
        position: queueCount.count + 1
      });
    } catch (e) {
      console.error('Reserve book error:', e);
      res.status(500).json({ error: 'Failed to reserve book' });
    }
  });
  
  // Get user's reservations
  router.get('/api/reservations', authenticateToken, async (req, res) => {
    try {
      const reservations = await all(`
        SELECT r.*, b.title, b.author, b.image
        FROM reservations r
        JOIN books b ON r.book_id = b.id
        WHERE r.user_id = ? AND r.status IN ('pending', 'available')
        ORDER BY r.reserved_at DESC
      `, [req.user.id]);
      
      res.json(reservations);
    } catch (e) {
      console.error('Get reservations error:', e);
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  });
  
  // Cancel reservation
  router.delete('/api/reservations/:id', authenticateToken, async (req, res) => {
    try {
      await run(
        'UPDATE reservations SET status = "cancelled" WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      
      res.json({ message: 'Reservation cancelled' });
    } catch (e) {
      console.error('Cancel reservation error:', e);
      res.status(500).json({ error: 'Failed to cancel reservation' });
    }
  });

  // ==================== FEATURE 15: AI-POWERED RECOMMENDATIONS ====================
  
  // Get personalized recommendations
  router.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's borrowing history
      const history = await all(`
        SELECT DISTINCT b.category, b.author
        FROM borrowed_books bb
        JOIN books b ON bb.book_id = b.id
        WHERE bb.user_id = ?
      `, [userId]);
      
      const categories = [...new Set(history.map(h => h.category))];
      const authors = [...new Set(history.map(h => h.author))];
      
      // Recommend books from favorite categories
      const categoryRecs = categories.length > 0 ? await all(`
        SELECT * FROM books
        WHERE category IN (${categories.map(() => '?').join(',')})
        AND available = 1
        AND id NOT IN (SELECT book_id FROM borrowed_books WHERE user_id = ?)
        ORDER BY rating DESC
        LIMIT 6
      `, [...categories, userId]) : [];
      
      // Recommend books by favorite authors
      const authorRecs = authors.length > 0 ? await all(`
        SELECT * FROM books
        WHERE author IN (${authors.map(() => '?').join(',')})
        AND available = 1
        AND id NOT IN (SELECT book_id FROM borrowed_books WHERE user_id = ?)
        ORDER BY rating DESC
        LIMIT 6
      `, [...authors, userId]) : [];
      
      // Trending books (most borrowed in last 30 days)
      const trending = await all(`
        SELECT b.*, COUNT(bb.id) as borrow_count
        FROM books b
        LEFT JOIN borrowed_books bb ON b.id = bb.book_id
        WHERE bb.borrow_date >= date('now', '-30 days')
        AND b.available = 1
        GROUP BY b.id
        ORDER BY borrow_count DESC
        LIMIT 6
      `);
      
      // Top rated books
      const topRated = await all(`
        SELECT * FROM books
        WHERE rating >= 4.0 AND review_count >= 3
        AND available = 1
        ORDER BY rating DESC, review_count DESC
        LIMIT 6
      `);
      
      res.json({
        basedOnHistory: categoryRecs,
        favoriteAuthors: authorRecs,
        trending: trending,
        topRated: topRated
      });
    } catch (e) {
      console.error('Recommendations error:', e);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  });

  return router;
};
