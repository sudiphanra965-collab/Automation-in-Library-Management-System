// server-https.js - HTTPS version for camera access
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.HTTPS_PORT || 5443;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// SSL Certificate options
let httpsOptions;
try {
  // Try to load certificate
  httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'localhost-cert.pem'))
  };
  console.log('✅ SSL Certificate loaded');
} catch (err) {
  console.error('❌ SSL Certificate not found!');
  console.error('Please run: node generate-cert.js');
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching for frontend assets
app.use((req, res, next) => {
  if (/\.(?:js|css|html)(?:\?.*)?$/.test(req.url)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Database setup
const db = new sqlite3.Database('./library.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Database connected');
  }
});

// Promisify database functions
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

const authorizeAdmin = (req, res, next) => {
  // Check both isAdmin flag and role field for compatibility
  if (!req.user.isAdmin && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../frontend/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ========== AUTH ROUTES ==========
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'user']);
    res.json({ message: 'User created successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Enhanced student registration with verification
app.post('/api/register-student', upload.fields([
  { name: 'userPhoto', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
  try {
    const { fullName, rollNo, dateOfBirth, mobileNo, username, email, password } = req.body;
    
    // Validate required fields
    if (!fullName || !rollNo || !dateOfBirth || !mobileNo || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if username already exists
    const existingUser = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Check if roll number already exists
    const existingRoll = await get('SELECT * FROM users WHERE roll_no = ?', [rollNo]);
    if (existingRoll) {
      return res.status(400).json({ error: 'Roll number already registered' });
    }
    
    // Check if photos were uploaded
    if (!req.files || !req.files.userPhoto || !req.files.idProof) {
      return res.status(400).json({ error: 'Both photos are required' });
    }
    
    const userPhotoPath = req.files.userPhoto[0].filename;
    const idProofPath = req.files.idProof[0].filename;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user with pending verification status
    const result = await run(`
      INSERT INTO users (
        username, password, email, full_name, roll_no, 
        date_of_birth, mobile_no, user_photo, id_proof_photo,
        is_verified, verification_status, registration_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', datetime('now'))
    `, [
      username, hashedPassword, email || null, fullName, rollNo,
      dateOfBirth, mobileNo, userPhotoPath, idProofPath
    ]);
    
    console.log('✅ Student registration submitted:', {
      id: result.lastID,
      username,
      fullName,
      rollNo
    });
    
    res.json({ 
      message: 'Registration submitted successfully. Your account will be activated after admin verification.',
      userId: result.lastID
    });
    
  } catch (e) {
    console.error('Student registration error:', e);
    res.status(500).json({ error: 'Registration failed: ' + e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
    
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Check for is_admin field (matches server.js format)
    const isAdmin = !!(user.is_admin || user.role === 'admin');
    
    // Check verification status (skip for admin)
    if (!isAdmin && user.verification_status === 'pending') {
      return res.status(403).json({ 
        error: 'Account pending verification', 
        message: 'Your account is awaiting admin approval. Please check back later.'
      });
    }
    
    if (!isAdmin && user.verification_status === 'rejected') {
      return res.status(403).json({ 
        error: 'Account rejected', 
        message: user.rejection_reason || 'Your registration was rejected. Please contact admin.'
      });
    }
    
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      isAdmin: isAdmin 
    }, JWT_SECRET, { expiresIn: '7d' });
    
    // Return format matching server.js (not nested in user object)
    res.json({ 
      token, 
      username: user.username, 
      isAdmin: isAdmin,
      is_admin: isAdmin ? 1 : 0
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ========== PUBLIC ROUTES ==========
// Categories endpoint
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT category FROM books ORDER BY category');
    res.json(rows.map(r => r.category));
  } catch (e) { 
    console.error('Categories error:', e);
    res.status(500).json({ error: 'Failed to fetch categories' }); 
  }
});

// ========== BOOK ROUTES ==========
app.get('/api/books', async (req, res) => {
  try {
    const { category, q, field, term, filters, match, searchQuery } = req.query;
    
    let query = `
      SELECT b.*, 
        CASE WHEN bb.id IS NOT NULL THEN 0 ELSE 1 END as available,
        CASE WHEN bb.id IS NOT NULL THEN u.username ELSE NULL END as borrowedBy,
        bb.borrow_date as borrowDate
      FROM books b
      LEFT JOIN borrowed_books bb ON b.id = bb.book_id
      LEFT JOIN users u ON bb.user_id = u.id
    `;
    let params = [];
    let conditions = [];
    
    // Category filter
    if (category) {
      conditions.push('b.category = ?');
      params.push(category);
    }
    
    // General search (q parameter)
    if (q) {
      conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.description LIKE ?)');
      const search = `%${q}%`;
      params.push(search, search, search, search);
    }
    
    // Field-specific search
    if (field && term) {
      conditions.push(`b.${field} LIKE ?`);
      params.push(`%${term}%`);
    }
    
    // Legacy searchQuery parameter
    if (searchQuery) {
      conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
      const search = `%${searchQuery}%`;
      params.push(search, search, search);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY b.title';
    
    const books = await all(query, params);
    res.json(books);
  } catch (e) {
    console.error('Books fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Get user's borrowed books with detailed information
app.get('/api/borrowed-books', authenticateToken, async (req, res) => {
  try {
    const rows = await all(`
      SELECT 
        bb.id,
        bb.book_id,
        bb.borrow_date as borrowed_date,
        bb.borrow_date,
        b.title,
        b.author,
        b.category,
        b.isbn,
        b.description,
        b.image
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.user_id = ?
      ORDER BY bb.borrow_date DESC
    `, [req.user.id]);
    
    res.json(rows);
  } catch (e) {
    console.error('Error fetching borrowed books:', e);
    res.status(500).json({ error: 'Failed to fetch borrowed books.' });
  }
});

// Return a borrowed book
app.post('/api/return-book/:borrowId', authenticateToken, async (req, res) => {
  try {
    const { borrowId } = req.params;
    const borrow = await get('SELECT * FROM borrowed_books WHERE id = ? AND user_id = ?', [borrowId, req.user.id]);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found or unauthorized' });
    }
    
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);
    res.json({ message: 'Book returned successfully' });
  } catch (e) {
    console.error('Return book error:', e);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

// Borrow a book by ID
app.post('/api/books/:id/borrow', authenticateToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const userId = req.user.id;
    
    console.log('Attempting to borrow book:', { bookId, userId });
    
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) {
      console.log('Book not found:', bookId);
      return res.status(404).json({ error: 'Book not found.' });
    }
    if (book.available === 0) {
      console.log('Book unavailable:', bookId);
      return res.status(400).json({ error: 'Book is currently unavailable.' });
    }
    
    // Check if user already borrowed this book
    const existingBorrow = await get('SELECT id FROM borrowed_books WHERE book_id = ? AND user_id = ?', [bookId, userId]);
    if (existingBorrow) {
      return res.status(400).json({ error: 'You have already borrowed this book.' });
    }
    
    // Get user details for history
    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    
    // Update book availability
    await run('UPDATE books SET available = 0 WHERE id = ?', [bookId]);
    
    // Insert borrow record
    await run(`INSERT INTO borrowed_books (book_id, user_id, borrow_date) 
               VALUES (?, ?, datetime('now'))`, [bookId, userId]);
    
    // Record in history
    try {
      await run(`INSERT INTO borrow_history 
        (book_id, user_id, username, book_title, book_author, book_isbn, issue_date, due_date, status)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+14 days'), 'borrowed')`,
        [bookId, userId, user.username, book.title, book.author, book.isbn]);
      console.log('✅ History record created for book', bookId);
    } catch (historyError) {
      console.error('❌ Failed to create history record:', historyError);
      // Continue anyway - book is already borrowed
    }
    
    console.log('Book borrowed successfully');
    res.json({ message: 'Book borrowed successfully!' });
  } catch (e) { 
    console.error('Error borrowing book:', e);
    res.status(500).json({ error: 'Failed to borrow book: ' + e.message }); 
  }
});

// Renew a borrowed book
app.post('/api/renew-book/:borrowId', authenticateToken, async (req, res) => {
  try {
    const { borrowId } = req.params;
    const borrow = await get('SELECT * FROM borrowed_books WHERE id = ? AND user_id = ?', [borrowId, req.user.id]);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found or unauthorized' });
    }
    
    // Extend borrow date by 7 days
    const newDate = new Date(borrow.borrow_date);
    newDate.setDate(newDate.getDate() + 7);
    
    await run('UPDATE borrowed_books SET borrow_date = ? WHERE id = ?', [newDate.toISOString(), borrowId]);
    res.json({ message: 'Book renewed successfully', newDueDate: newDate.toISOString() });
  } catch (e) {
    console.error('Renew book error:', e);
    res.status(500).json({ error: 'Failed to renew book' });
  }
});

app.post('/api/books', authenticateToken, authorizeAdmin, upload.single('cover'), async (req, res) => {
  try {
    const { title, author, isbn, description, year, publisher, pages, language, category, abstract, tableOfContents, subjects } = req.body;
    const cover = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await run(
      `INSERT INTO books (title, author, isbn, description, year, publisher, pages, language, category, cover, abstract, tableOfContents, subjects, available) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [title, author, isbn, description, year, publisher, pages, language, category, cover, abstract, tableOfContents, subjects]
    );
    res.json({ id: result.lastID, message: 'Book added successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add book' });
  }
});

app.put('/api/books/:id', authenticateToken, authorizeAdmin, upload.single('cover'), async (req, res) => {
  try {
    const { title, author, isbn, description, year, publisher, pages, language, category, abstract, tableOfContents, subjects } = req.body;
    let cover = req.body.cover;
    if (req.file) {
      cover = `/uploads/${req.file.filename}`;
    }
    await run(
      `UPDATE books SET title = ?, author = ?, isbn = ?, description = ?, year = ?, publisher = ?, pages = ?, language = ?, category = ?, cover = ?, abstract = ?, tableOfContents = ?, subjects = ? WHERE id = ?`,
      [title, author, isbn, description, year, publisher, pages, language, category, cover, abstract, tableOfContents, subjects, req.params.id]
    );
    res.json({ message: 'Book updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update book' });
  }
});

app.delete('/api/books/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    await run('DELETE FROM books WHERE id = ?', [req.params.id]);
    res.json({ message: 'Book deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// ========== BORROW/RETURN ROUTES ==========
app.post('/api/borrow', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    const book = await get('SELECT * FROM books WHERE id = ? AND available = 1', [bookId]);
    if (!book) {
      return res.status(400).json({ error: 'Book not available' });
    }
    
    // Get user details
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    await run('INSERT INTO borrowed_books (user_id, book_id, borrow_date) VALUES (?, ?, datetime("now"))', [req.user.id, bookId]);
    await run('UPDATE books SET available = 0 WHERE id = ?', [bookId]);
    
    // Record in history
    await run(`INSERT INTO borrow_history 
      (book_id, user_id, username, book_title, book_author, book_isbn, issue_date, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+14 days'), 'borrowed')`,
      [bookId, req.user.id, user.username, book.title, book.author, book.isbn]);
    
    res.json({ message: 'Book borrowed successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to borrow book' });
  }
});

app.post('/api/return', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    await run('DELETE FROM borrowed_books WHERE user_id = ? AND book_id = ?', [req.user.id, bookId]);
    await run('UPDATE books SET available = 1 WHERE id = ?', [bookId]);
    res.json({ message: 'Book returned successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to return book' });
  }
});

app.get('/api/borrowed', authenticateToken, async (req, res) => {
  try {
    const borrowed = await all(
      `SELECT b.*, bb.borrow_date 
       FROM borrowed_books bb 
       JOIN books b ON bb.book_id = b.id 
       WHERE bb.user_id = ?`,
      [req.user.id]
    );
    res.json(borrowed);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch borrowed books' });
  }
});

// Get user statistics
app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get currently borrowed count (books in borrowed_books table)
    const currentlyBorrowedResult = await get(
      'SELECT COUNT(*) as count FROM borrowed_books WHERE user_id = ?',
      [userId]
    );
    const currentlyBorrowed = currentlyBorrowedResult?.count || 0;
    
    // For total borrowed, we'll use the current count as a baseline
    // In a real system, you'd have a history table
    const totalBorrowed = currentlyBorrowed;
    
    // Calculate returned books (would need a history table for accurate count)
    const totalReturned = 0;
    
    // Get favorite category (most borrowed category)
    const favoriteCategoryResult = await get(
      `SELECT b.category, COUNT(*) as count 
       FROM borrowed_books bb 
       JOIN books b ON bb.book_id = b.id 
       WHERE bb.user_id = ? 
       GROUP BY b.category 
       ORDER BY count DESC 
       LIMIT 1`,
      [userId]
    );
    const favoriteCategory = favoriteCategoryResult?.category || 'None';
    
    // Calculate reading streak (simplified - days with active borrows)
    const readingStreak = currentlyBorrowed > 0 ? Math.min(currentlyBorrowed * 7, 30) : 0;
    
    // Calculate total points (10 points per book borrowed, 5 bonus for returns)
    const totalPoints = (totalBorrowed * 10) + (totalReturned * 5);
    
    res.json({
      totalBorrowed,
      totalReturned,
      currentlyBorrowed,
      readingStreak,
      favoriteCategory,
      totalPoints
    });
  } catch (e) {
    console.error('User stats error:', e);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ========== ADMIN ROUTES ==========

// Get pending registrations
app.get('/api/admin/pending-registrations', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const pending = await all(`
      SELECT id, username, full_name, roll_no, date_of_birth, mobile_no, email,
             user_photo, id_proof_photo, registration_date, verification_status
      FROM users 
      WHERE verification_status = 'pending'
      ORDER BY registration_date DESC
    `);
    res.json(pending);
  } catch (e) {
    console.error('Get pending registrations error:', e);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
});

// Get all registrations (pending, approved, rejected)
app.get('/api/admin/all-registrations', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const all_regs = await all(`
      SELECT id, username, full_name, roll_no, date_of_birth, mobile_no, email,
             user_photo, id_proof_photo, registration_date, verification_status,
             verified_date, rejection_reason
      FROM users 
      WHERE full_name IS NOT NULL
      ORDER BY registration_date DESC
    `);
    res.json(all_regs);
  } catch (e) {
    console.error('Get all registrations error:', e);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Approve registration
app.post('/api/admin/approve-registration/:userId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const adminId = req.user.id;
    
    await run(`
      UPDATE users 
      SET is_verified = 1, 
          verification_status = 'approved',
          verified_by = ?,
          verified_date = datetime('now')
      WHERE id = ?
    `, [adminId, userId]);
    
    const user = await get('SELECT username, full_name FROM users WHERE id = ?', [userId]);
    
    console.log('✅ Registration approved:', {
      userId,
      username: user.username,
      fullName: user.full_name,
      approvedBy: req.user.username
    });
    
    res.json({ message: 'Registration approved successfully', user });
  } catch (e) {
    console.error('Approve registration error:', e);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject registration - DELETE user data so they can re-register
app.post('/api/admin/reject-registration/:userId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { reason } = req.body;
    
    // Get user details before deletion
    const user = await get('SELECT username, full_name, roll_no, user_photo, id_proof_photo FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete uploaded photos
    const fs = require('fs');
    const path = require('path');
    if (user.user_photo) {
      const photoPath = path.join(__dirname, 'uploads', user.user_photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log('🗑️ Deleted user photo:', user.user_photo);
      }
    }
    if (user.id_proof_photo) {
      const idPath = path.join(__dirname, 'uploads', user.id_proof_photo);
      if (fs.existsSync(idPath)) {
        fs.unlinkSync(idPath);
        console.log('🗑️ Deleted ID proof:', user.id_proof_photo);
      }
    }
    
    // DELETE user completely so they can re-register
    await run('DELETE FROM users WHERE id = ?', [userId]);
    
    console.log('❌ Registration rejected and deleted:', {
      userId,
      username: user.username,
      fullName: user.full_name,
      rollNo: user.roll_no,
      reason,
      rejectedBy: req.user.username
    });
    
    res.json({ 
      message: 'Registration rejected and deleted. User can now re-register.', 
      user: {
        username: user.username,
        fullName: user.full_name
      }
    });
  } catch (e) {
    console.error('Reject registration error:', e);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// Get all books (for admin panel)
app.get('/api/admin/books/all', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM books');
    res.json(rows);
  } catch (e) {
    console.error('Admin books fetch error:', e);
    res.status(500).json({ error: 'Failed to retrieve all books.' });
  }
});

// Add a new book
app.post('/api/admin/books', authenticateToken, authorizeAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, author, isbn, category, description, publisher, year } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || '/uploads/default.jpg');
    
    if (!title || !author || !category) {
      return res.status(400).json({ error: 'Title, author, and category are required.' });
    }
    
    const result = await run(
      'INSERT INTO books (title, author, isbn, category, description, image, publisher, year, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [title, author, isbn || null, category, description || null, image, publisher || null, year || null]
    );
    
    res.status(201).json({ id: result.lastID, message: 'Book added successfully' });
  } catch (e) {
    console.error('Add book error:', e);
    res.status(500).json({ error: 'Failed to add book: ' + e.message });
  }
});

// Update a book
app.put('/api/admin/books/:id', authenticateToken, authorizeAdmin, upload.single('image'), async (req, res) => {
  try {
    const id = req.params.id;
    const { title, author, isbn, category, description, publisher, year } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image || null;
    
    await run(
      'UPDATE books SET title=?, author=?, isbn=?, category=?, description=?, image=?, publisher=?, year=? WHERE id=?',
      [title, author, isbn || null, category, description || null, image, publisher || null, year || null, id]
    );
    
    res.json({ message: 'Book updated successfully' });
  } catch (e) {
    console.error('Update book error:', e);
    res.status(500).json({ error: 'Failed to update book: ' + e.message });
  }
});

// Delete a book
app.delete('/api/admin/books/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await run('DELETE FROM books WHERE id = ?', [id]);
    res.json({ message: 'Book deleted successfully' });
  } catch (e) {
    console.error('Delete book error:', e);
    res.status(500).json({ error: 'Failed to delete book: ' + e.message });
  }
});

// Admin endpoint to issue a book to a user
app.post('/api/admin/books/:id/issue', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const bookId = req.params.id;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const user = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    if (book.available === 0) {
      return res.status(400).json({ error: 'Book is not available' });
    }
    
    await run('UPDATE books SET available = 0 WHERE id = ?', [bookId]);
    await run('INSERT INTO borrowed_books (book_id, user_id, borrow_date) VALUES (?, ?, datetime("now"))', [bookId, user.id]);
    
    res.json({ message: 'Book issued successfully', book: book.title, user: username });
  } catch (e) {
    console.error('Admin issue book error:', e);
    res.status(500).json({ error: 'Failed to issue book' });
  }
});

// Get all borrowed books (for admin dashboard)
app.get('/api/admin/borrowed', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const borrowed = await all(
      `SELECT bb.id, b.title, b.author, b.id as book_id, u.username, u.id as user_id, bb.borrow_date
       FROM borrowed_books bb
       JOIN books b ON bb.book_id = b.id
       JOIN users u ON bb.user_id = u.id
       ORDER BY bb.borrow_date DESC`
    );
    res.json(borrowed);
  } catch (e) {
    console.error('Admin borrowed fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch borrowed books' });
  }
});

// Alternative endpoint name (for compatibility)
app.get('/api/admin/all-borrowed', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const borrowed = await all(
      `SELECT bb.id, b.title, b.author, u.username, bb.borrow_date, b.id as book_id, u.id as user_id
       FROM borrowed_books bb
       JOIN books b ON bb.book_id = b.id
       JOIN users u ON bb.user_id = u.id`
    );
    res.json(borrowed);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch borrowed books' });
  }
});

app.post('/api/admin/issue', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { bookId, username } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const book = await get('SELECT * FROM books WHERE id = ? AND available = 1', [bookId]);
    if (!book) {
      return res.status(400).json({ error: 'Book not available' });
    }
    await run('INSERT INTO borrowed_books (user_id, book_id, borrow_date) VALUES (?, ?, datetime("now"))', [user.id, bookId]);
    await run('UPDATE books SET available = 0 WHERE id = ?', [bookId]);
    res.json({ message: 'Book issued successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to issue book' });
  }
});

app.post('/api/admin/return', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { borrowId } = req.body;
    const borrow = await get('SELECT book_id FROM borrowed_books WHERE id = ?', [borrowId]);
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);
    await run('UPDATE books SET available = 1 WHERE id = ?', [borrow.book_id]);
    res.json({ message: 'Book returned successfully' });
  } catch (e) {
    console.error('Admin return error:', e);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

// Return book by borrow ID (alternative endpoint format)
app.post('/api/admin/borrowed/:id/return', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const borrowId = req.params.id;
    const borrow = await get(`SELECT bb.*, b.title, u.username 
      FROM borrowed_books bb
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN users u ON bb.user_id = u.id
      WHERE bb.id = ?`, [borrowId]);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }
    
    // Get the original borrow record from history
    const historyRecord = await get(`SELECT * FROM borrow_history 
      WHERE book_id = ? AND user_id = ? AND status = 'borrowed' 
      ORDER BY issue_date DESC LIMIT 1`, [borrow.book_id, borrow.user_id]);
    
    if (historyRecord) {
      // Calculate fine (Rs. 5 per day after due date)
      const now = new Date();
      const dueDate = new Date(historyRecord.due_date);
      const daysLate = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
      const fineAmount = daysLate * 5;
      
      // Mark original record as returned
      await run(`UPDATE borrow_history SET status = 'returned' WHERE id = ?`, [historyRecord.id]);
      
      // Create NEW separate return record
      await run(`INSERT INTO borrow_history 
        (book_id, user_id, username, book_title, book_author, book_isbn, 
         issue_date, due_date, return_date, status, fine_amount, returned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'returned', ?, ?)`,
        [borrow.book_id, borrow.user_id, borrow.username, borrow.title, historyRecord.book_author, 
         historyRecord.book_isbn, historyRecord.issue_date, historyRecord.due_date, 
         fineAmount, req.user.username]);
    }
    
    // Remove from active borrows and make book available
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);
    await run('UPDATE books SET available = 1 WHERE id = ?', [borrow.book_id]);
    
    res.json({ message: 'Book returned successfully', book: borrow.title, user: borrow.username });
  } catch (e) {
    console.error('Admin return error:', e);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

// Admin issue book to user
app.post('/api/admin/issue', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { bookId, username } = req.body;
    
    if (!bookId || !username) {
      return res.status(400).json({ error: 'Book ID and username are required' });
    }
    
    // Find the user by username
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if book exists and is available
    const book = await get('SELECT * FROM books WHERE id = ? AND available = 1', [bookId]);
    if (!book) {
      return res.status(400).json({ error: 'Book not available or does not exist' });
    }
    
    // Issue the book
    await run('INSERT INTO borrowed_books (user_id, book_id, borrow_date) VALUES (?, ?, datetime("now"))', [user.id, bookId]);
    await run('UPDATE books SET available = 0 WHERE id = ?', [bookId]);
    
    // Record in history with due date (14 days from now)
    await run(`INSERT INTO borrow_history 
      (book_id, user_id, username, book_title, book_author, book_isbn, issue_date, due_date, status, issued_by)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+14 days'), 'borrowed', ?)`,
      [bookId, user.id, username, book.title, book.author, book.isbn, req.user.username]);
    
    res.json({ message: 'Book issued successfully', book: book.title, user: username });
  } catch (e) {
    console.error('Admin issue error:', e);
    res.status(500).json({ error: 'Failed to issue book' });
  }
});

// Admin: get complete borrow history with all transactions
app.get('/api/admin/borrow-history', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const history = await all(`SELECT 
      bh.*,
      CASE 
        WHEN bh.status = 'borrowed' THEN 'Active'
        WHEN bh.status = 'returned' THEN 'Returned'
        ELSE bh.status
      END as display_status,
      CASE 
        WHEN bh.return_date IS NULL AND datetime('now') > bh.due_date THEN 1
        ELSE 0
      END as is_overdue,
      CASE 
        WHEN bh.return_date IS NULL AND datetime('now') > bh.due_date 
        THEN CAST((julianday('now') - julianday(bh.due_date)) * 5 AS INTEGER)
        ELSE bh.fine_amount
      END as calculated_fine,
      CASE 
        WHEN bh.return_date IS NOT NULL THEN bh.return_date
        ELSE bh.issue_date
      END as transaction_date
      FROM borrow_history bh
      ORDER BY transaction_date DESC`);
    res.json(history);
  } catch (e) { 
    console.error('History fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch borrow history.' }); 
  }
});

// Old endpoint removed - using new one with borrowed_count below
// Get dashboard statistics
app.get('/api/admin/stats', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const totalBooks = await get('SELECT COUNT(*) as count FROM books');
    // Registered users should exclude admins and only include approved (or null) verifications
    const totalUsers = await get("SELECT COUNT(*) as count FROM users WHERE is_admin = 0 AND (verification_status IS NULL OR verification_status = 'approved')");
    // Count only currently issued (not yet returned)
    const borrowedBooks = await get('SELECT COUNT(*) as count FROM borrowed_books WHERE returned_date IS NULL');
    const availableBooks = await get('SELECT COUNT(*) as count FROM books WHERE available = 1');
    
    res.json({
      totalBooks: totalBooks.count || 0,
      totalUsers: totalUsers.count || 0,
      borrowedBooks: borrowedBooks.count || 0,
      availableBooks: availableBooks.count || 0
    });
  } catch (e) {
    console.error('Stats fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ========== QR CODE ROUTES ==========
app.get('/api/books/:id/qrcode', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const qrData = {
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      available: book.available === 1
    };
    
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2
    });
    
    res.json({ qrCode: qrCodeDataURL, bookData: qrData });
  } catch (e) {
    console.error('QR Code generation error:', e);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/books/:id/info', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const borrowInfo = await get(`
      SELECT bb.borrow_date, u.username 
      FROM borrowed_books bb 
      JOIN users u ON bb.user_id = u.id 
      WHERE bb.book_id = ?
    `, [bookId]);
    
    res.json({
      ...book,
      borrowedBy: borrowInfo ? borrowInfo.username : null,
      borrowDate: borrowInfo ? borrowInfo.borrow_date : null
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch book info' });
  }
});

// ========== GATE SECURITY SYSTEM ==========
app.get('/api/gate/verify/:bookId', async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    
    if (!book) {
      return res.json({
        allowed: false,
        status: 'ALARM',
        reason: 'Book not found in system',
        alertLevel: 'HIGH',
        message: '🚨 SECURITY ALERT: Unknown book detected!',
        book: null
      });
    }

    const borrowInfo = await get(`
      SELECT bb.id, bb.borrow_date, bb.user_id, u.username, u.id as userId
      FROM borrowed_books bb 
      JOIN users u ON bb.user_id = u.id 
      WHERE bb.book_id = ?
    `, [bookId]);

    if (borrowInfo) {
      return res.json({
        allowed: true,
        status: 'APPROVED',
        reason: 'Book is properly borrowed',
        alertLevel: 'NONE',
        message: '✅ Exit Approved - Book borrowed by ' + borrowInfo.username,
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          borrowedBy: borrowInfo.username,
          borrowedDate: borrowInfo.borrow_date,
          userId: borrowInfo.userId
        }
      });
    } else {
      return res.json({
        allowed: false,
        status: 'ALARM',
        reason: 'Book is not borrowed - Possible theft',
        alertLevel: 'HIGH',
        message: '🚨 ALARM: Unauthorized book removal detected!',
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          borrowedBy: null,
          borrowedDate: null
        }
      });
    }
  } catch (e) {
    console.error('Error verifying book at gate:', e);
    res.status(500).json({
      allowed: false,
      status: 'ERROR',
      reason: 'System error',
      alertLevel: 'HIGH',
      message: '⚠️ System Error - Security check failed',
      error: e.message
    });
  }
});

app.post('/api/gate/log', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { bookId, userId, status, timestamp } = req.body;
    res.json({ message: 'Exit logged successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to log exit' });
  }
});

// ==================== NEW FEATURES API ====================
// Import and use new features router
const newFeaturesRouter = require('./new-features-api')(get, all, run, authenticateToken);
app.use(newFeaturesRouter);

// ========== USER BORROWED BOOKS ENDPOINT ==========

// Get user's borrowed books
app.get('/api/user/borrowed-books', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const books = await all(`
      SELECT 
        bb.id,
        bb.book_id,
        bb.user_id,
        bb.borrow_date,
        b.title,
        b.author,
        b.isbn,
        b.image,
        b.category
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.user_id = ?
      ORDER BY bb.borrow_date DESC
    `, [userId]);
    
    res.json(books);
  } catch (error) {
    console.error('Get user borrowed books error:', error);
    res.status(500).json({ error: 'Failed to get borrowed books' });
  }
});

// ========== NOTIFICATION ENDPOINTS ==========

// User: Request borrow (do NOT auto-borrow; creates admin notification)
app.post('/api/notifications/borrow-request', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!bookId) {
      return res.status(400).json({ error: 'bookId is required' });
    }

    // Validate book and availability
    const book = await get('SELECT id, title, available FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Prevent duplicate pending requests from same user for same book
    const existing = await get(`
      SELECT id FROM notifications
      WHERE type = 'borrow_request' AND status = 'pending' AND user_id = ? AND book_id = ?
    `, [userId, bookId]);
    if (existing) {
      return res.status(400).json({ error: 'Borrow request already pending for this book' });
    }

    // Create notification for admin. Use borrow_id = 0 (placeholder) since not yet borrowed
    await run(`
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, message)
      VALUES ('borrow_request', ?, ?, ?, ?, 0, ?)
    `, [
      userId,
      username,
      book.id,
      book.title,
      `${username} requests to borrow "${book.title}"`
    ]);

    res.json({ message: 'Borrow request sent to admin' });
  } catch (error) {
    console.error('Borrow request error:', error);
    res.status(500).json({ error: 'Failed to submit borrow request' });
  }
});

// User: Request return
app.post('/api/notifications/return-request', authenticateToken, async (req, res) => {
  try {
    const { borrowId } = req.body;
    const userId = req.user.id;
    
    // Get borrow details
    const borrow = await get(`
      SELECT bb.*, b.title, u.username
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      JOIN users u ON bb.user_id = u.id
      WHERE bb.id = ? AND bb.user_id = ?
    `, [borrowId, userId]);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrowed book not found' });
    }
    
    // Check if request already exists
    const existing = await get(`
      SELECT id FROM notifications 
      WHERE borrow_id = ? AND type = 'return_request' AND status = 'pending'
    `, [borrowId]);
    
    if (existing) {
      return res.status(400).json({ error: 'Return request already pending' });
    }
    
    // Create notification
    await run(`
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, message)
      VALUES ('return_request', ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      borrow.username,
      borrow.book_id,
      borrow.title,
      borrowId,
      `${borrow.username} requests to return "${borrow.title}"`
    ]);
    
    res.json({ message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Return request error:', error);
    res.status(500).json({ error: 'Failed to submit return request' });
  }
});

// User: Request renewal
app.post('/api/notifications/renew-request', authenticateToken, async (req, res) => {
  try {
    const { borrowId } = req.body;
    const userId = req.user.id;
    
    // Get borrow details
    const borrow = await get(`
      SELECT bb.*, b.title, u.username
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      JOIN users u ON bb.user_id = u.id
      WHERE bb.id = ? AND bb.user_id = ?
    `, [borrowId, userId]);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrowed book not found' });
    }
    
    // Check if request already exists
    const existing = await get(`
      SELECT id FROM notifications 
      WHERE borrow_id = ? AND type = 'renew_request' AND status = 'pending'
    `, [borrowId]);
    
    if (existing) {
      return res.status(400).json({ error: 'Renewal request already pending' });
    }
    
    // Create notification
    await run(`
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, message)
      VALUES ('renew_request', ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      borrow.username,
      borrow.book_id,
      borrow.title,
      borrowId,
      `${borrow.username} requests to renew "${borrow.title}"`
    ]);
    
    res.json({ message: 'Renewal request submitted successfully' });
  } catch (error) {
    console.error('Renewal request error:', error);
    res.status(500).json({ error: 'Failed to submit renewal request' });
  }
});

// Admin: Get all notifications
app.get('/api/admin/notifications', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notifications = await all(`
      SELECT * FROM notifications 
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Admin: Get notification count
app.get('/api/admin/notifications/count', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await get(`
      SELECT COUNT(*) as count FROM notifications WHERE status = 'pending'
    `);
    res.json({ count: result.count });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

// Admin: Approve return request
app.post('/api/admin/notifications/:id/approve-return', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;
    
    // Get notification details
    const notification = await get('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Process return (same logic as admin return)
    const borrowId = notification.borrow_id;
    const borrow = await get('SELECT * FROM borrowed_books WHERE id = ?', [borrowId]);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrowed book not found' });
    }
    
    // Calculate fine
    const dueDate = new Date(borrow.borrow_date);
    dueDate.setDate(dueDate.getDate() + 14);
    const now = new Date();
    const daysLate = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
    const fine = daysLate * 5;
    
    // Delete from borrowed_books
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);
    
    // Update book availability
    await run('UPDATE books SET available = available + 1 WHERE id = ?', [borrow.book_id]);
    
    // Update notification
    await run(`
      UPDATE notifications 
      SET status = 'approved', resolved_at = datetime('now'), resolved_by = ?
      WHERE id = ?
    `, [adminUsername, notificationId]);
    
    res.json({ message: 'Return approved successfully', fine });
  } catch (error) {
    console.error('Approve return error:', error);
    res.status(500).json({ error: 'Failed to approve return' });
  }
});

// Admin: Approve renewal request
app.post('/api/admin/notifications/:id/approve-renew', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;
    
    // Get notification details
    const notification = await get('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Renew book (extend by 14 days)
    const borrowId = notification.borrow_id;
    await run(`
      UPDATE borrowed_books 
      SET borrow_date = datetime('now')
      WHERE id = ?
    `, [borrowId]);
    
    // Update notification
    await run(`
      UPDATE notifications 
      SET status = 'approved', resolved_at = datetime('now'), resolved_by = ?
      WHERE id = ?
    `, [adminUsername, notificationId]);
    
    res.json({ message: 'Renewal approved successfully' });
  } catch (error) {
    console.error('Approve renewal error:', error);
    res.status(500).json({ error: 'Failed to approve renewal' });
  }
});

// Admin: Reject notification
app.post('/api/admin/notifications/:id/reject', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;
    
    await run(`
      UPDATE notifications 
      SET status = 'rejected', resolved_at = datetime('now'), resolved_by = ?
      WHERE id = ?
    `, [adminUsername, notificationId]);
    
    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Reject notification error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Admin: Approve borrow request (issue book to user)
app.post('/api/admin/notifications/:id/approve-borrow', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;
    
    // Fetch notification
    const notif = await get('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (notif.type !== 'borrow_request') {
      return res.status(400).json({ error: 'Invalid notification type' });
    }
    if (notif.status !== 'pending') {
      return res.status(400).json({ error: 'Notification already processed' });
    }

    // Check book availability
    const book = await get('SELECT * FROM books WHERE id = ?', [notif.book_id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (book.available === 0) {
      return res.status(400).json({ error: 'Book is currently unavailable' });
    }

    // Issue the book
    await run('UPDATE books SET available = 0 WHERE id = ?', [book.id]);
    const borrowInsert = await run(`
      INSERT INTO borrowed_books (book_id, user_id, borrow_date)
      VALUES (?, ?, datetime('now'))
    `, [book.id, notif.user_id]);

    // Record in history with due date 14 days
    await run(`INSERT INTO borrow_history 
      (book_id, user_id, username, book_title, book_author, book_isbn, issue_date, due_date, status, issued_by)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now','+14 days'), 'borrowed', ?)`,
      [book.id, notif.user_id, notif.username, book.title, book.author, book.isbn, adminUsername]);

    // Mark notification as approved
    await run(`UPDATE notifications SET status = 'approved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`, [adminUsername, notificationId]);

    res.json({ message: 'Borrow request approved. Book issued to user.' });
  } catch (error) {
    console.error('Approve borrow error:', error);
    res.status(500).json({ error: 'Failed to approve borrow request' });
  }
});

// ========== USER MANAGEMENT ENDPOINTS ==========

// Get all users with borrowed book count
app.get('/api/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await all(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.is_admin,
        u.full_name,
        u.roll_no,
        u.mobile_no,
        u.user_photo,
        COUNT(bb.id) as borrowed_count
      FROM users u
      LEFT JOIN borrowed_books bb ON u.id = bb.user_id AND bb.returned_date IS NULL
      WHERE (u.verification_status IS NULL OR u.verification_status = 'approved')
      GROUP BY u.id
      ORDER BY u.id
    `);
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user details
app.get('/api/admin/user/:id/details', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await get(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.is_admin,
        COUNT(bb.id) as borrowed_count
      FROM users u
      LEFT JOIN borrowed_books bb ON u.id = bb.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `, [userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// Toggle user role
app.post('/api/admin/user/:id/toggle-role', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await get('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const newRole = user.is_admin ? 0 : 1;
    await run('UPDATE users SET is_admin = ? WHERE id = ?', [newRole, userId]);
    
    res.json({ message: 'User role updated successfully', is_admin: newRole });
  } catch (error) {
    console.error('Toggle user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Make user admin
app.post('/api/admin/make-admin/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await get('SELECT username, is_admin FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.is_admin) {
      return res.status(400).json({ error: 'User is already an admin' });
    }
    
    await run('UPDATE users SET is_admin = 1 WHERE id = ?', [userId]);
    
    console.log('👑 User promoted to admin:', {
      userId,
      username: user.username,
      promotedBy: req.user.username
    });
    
    res.json({ message: 'User promoted to admin successfully', username: user.username });
  } catch (error) {
    console.error('Make admin error:', error);
    res.status(500).json({ error: 'Failed to make user admin' });
  }
});

// Remove admin privileges (demote to user)
app.post('/api/admin/remove-admin/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await get('SELECT username, is_admin FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.is_admin) {
      return res.status(400).json({ error: 'User is not an admin' });
    }
    
    await run('UPDATE users SET is_admin = 0 WHERE id = ?', [userId]);
    
    console.log('⬇️ Admin demoted to user:', {
      userId,
      username: user.username,
      demotedBy: req.user.username
    });
    
    res.json({ message: 'Admin privileges removed successfully', username: user.username });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ error: 'Failed to remove admin privileges' });
  }
});

// Delete user
app.delete('/api/admin/user/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const borrowed = await get('SELECT COUNT(*) as count FROM borrowed_books WHERE user_id = ?', [userId]);
    if (borrowed.count > 0) {
      return res.status(400).json({ error: 'Cannot delete user with borrowed books' });
    }
    
    await run('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ========== NOTIFICATION SYSTEM ==========

// Get admin notifications (pending registrations count)
app.get('/api/admin/notifications', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const pendingCount = await get(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE verification_status = 'pending'
    `);
    
    const pendingRegistrations = await all(`
      SELECT id, username, full_name, registration_date
      FROM users 
      WHERE verification_status = 'pending'
      ORDER BY registration_date DESC
      LIMIT 10
    `);
    
    res.json({
      pendingCount: pendingCount.count,
      pendingRegistrations,
      hasNotifications: pendingCount.count > 0
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// ========== FINE MANAGEMENT ENDPOINTS ==========

// Get all fines (overdue books)
app.get('/api/admin/fines', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const fines = await all(`
      SELECT 
        bb.id as borrow_id,
        bb.user_id,
        u.username,
        bb.book_id,
        b.title as book_title,
        bb.borrow_date,
        datetime(bb.borrow_date, '+14 days') as due_date,
        CAST((julianday('now') - julianday(datetime(bb.borrow_date, '+14 days'))) AS INTEGER) as days_overdue,
        CAST((julianday('now') - julianday(datetime(bb.borrow_date, '+14 days'))) * 5 AS INTEGER) as fine_amount,
        COALESCE(bb.fine_paid, 0) as fine_paid
      FROM borrowed_books bb
      JOIN users u ON bb.user_id = u.id
      JOIN books b ON bb.book_id = b.id
      WHERE datetime(bb.borrow_date, '+14 days') < datetime('now')
      ORDER BY days_overdue DESC
    `);
    
    res.json(fines);
  } catch (error) {
    console.error('Get fines error:', error);
    res.status(500).json({ error: 'Failed to get fines' });
  }
});

// Mark fine as paid
app.post('/api/admin/fine/:borrowId/mark-paid', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const borrowId = req.params.borrowId;
    
    await run('UPDATE borrowed_books SET fine_paid = 1 WHERE id = ?', [borrowId]);
    
    res.json({ message: 'Fine marked as paid successfully' });
  } catch (error) {
    console.error('Mark fine paid error:', error);
    res.status(500).json({ error: 'Failed to mark fine as paid' });
  }
});

// Send fine reminder
app.post('/api/admin/fine/:userId/send-reminder', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log(`Fine reminder sent to user ${userId}`);
    
    res.json({ message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// ========== CATCH-ALL ROUTE (MUST BE LAST) ==========
// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Automatic sync function to ensure all borrowed books are in history
async function autoSyncHistory() {
  try {
    const borrowed = await all(`
      SELECT bb.*, b.title, b.author, b.isbn, u.username
      FROM borrowed_books bb
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN users u ON bb.user_id = u.id
    `);
    
    let synced = 0;
    for (const book of borrowed) {
      // Check if already in history
      const existing = await get(`
        SELECT id FROM borrow_history 
        WHERE book_id = ? AND user_id = ? AND status = 'borrowed'
        ORDER BY issue_date DESC LIMIT 1
      `, [book.book_id, book.user_id]);
      
      if (!existing) {
        // Add to history
        await run(`INSERT INTO borrow_history 
          (book_id, user_id, username, book_title, book_author, book_isbn, 
           issue_date, due_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?, '+14 days'), 'borrowed')`,
          [book.book_id, book.user_id, book.username, book.title, 
           book.author, book.isbn, book.borrow_date, book.borrow_date]);
        synced++;
        console.log(`🔄 Auto-synced: Book ${book.book_id} - ${book.title}`);
      }
    }
    
    if (synced > 0) {
      console.log(`✅ Auto-sync completed: ${synced} records added to history`);
    }
  } catch (error) {
    console.error('❌ Auto-sync error:', error);
  }
}

// Run auto-sync every 10 seconds
setInterval(autoSyncHistory, 10000);

// Start HTTPS server
// Get local network IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

https.createServer(httpsOptions, app).listen(PORT, () => {
  const localIP = getLocalIP();
  
  console.log(`✅ SSL Certificate loaded\n`);
  console.log('🔐 ========================================');
  console.log('🔐  HTTPS Server running securely!');
  console.log('🔐 ========================================\n');
  console.log('📱 On this computer:');
  console.log(`   https://localhost:${PORT}\n`);
  console.log('📱 On mobile (same WiFi):');
  console.log(`   https://${localIP}:${PORT}\n`);
  console.log('📷 Camera QR scanning will now work!');
  console.log('⚠️  You may see a security warning - click "Advanced" → "Proceed"\n');
  console.log('🔄 Auto-sync enabled: History syncs every 10 seconds\n');
  console.log('⚠️  IMPORTANT: Make sure Windows Firewall allows port', PORT);
  console.log('   Run SETUP-FIREWALL.bat as Administrator if mobile cannot connect\n');
  
  // Initialize database
  db.serialize(() => {
    console.log('✅ Database connected');
    // Run initial sync
    autoSyncHistory();
  });
});
