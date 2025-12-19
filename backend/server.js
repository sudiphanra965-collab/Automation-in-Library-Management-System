// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Disable caching for frontend assets to ensure latest UI is served
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

const db = new sqlite3.Database(path.join(__dirname, 'library.db'), (err) => {
  if (err) console.error('DB open error', err);
  else console.log('Database opened');
});

// helpers
const run = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(err){ if(err) rej(err); else res(this); }));
const all = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const get = (sql, params=[]) => new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

// multer for uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../frontend/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Authentication token required' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}
function authorizeAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// --- Auth routes ---
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
    res.json({ message: 'User created' });
  } catch (e) {
    if (e && e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
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
    const hashedPassword = bcrypt.hashSync(password, 10);
    
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
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = bcrypt.compareSync(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, isAdmin: !!user.is_admin });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Public endpoints ---
// categories
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT category FROM books ORDER BY category');
    res.json(rows.map(r => r.category));
  } catch (e) { res.status(500).json({ error: 'Failed to fetch categories' }); }
});

// books - supports category=q and q= general search and advanced field+term
app.get('/api/books', async (req, res) => {
  try {
    const { category, q, field, term, filters, match, publisher, subject, yearFrom, yearTo } = req.query;

    // Advanced multi-filter search: filters is JSON array [{field, term}]
    if (filters) {
      let parsed;
      try { parsed = JSON.parse(filters); } catch(e){ return res.status(400).json({ error: 'Invalid filters JSON' }); }
      if (!Array.isArray(parsed) || parsed.length===0) return res.json([]);
      const joiner = (String(match||'ALL').toUpperCase()==='ANY') ? ' OR ' : ' AND ';

      const whereParts = [];
      const params = [];
      for (const f of parsed) {
        const fld = (f && f.field) ? String(f.field) : 'all';
        const val = (f && f.term) ? String(f.term) : '';
        if (!val) continue;
        const like = `%${val}%`;
        if (fld === 'all') {
          whereParts.push('(title LIKE ? OR author LIKE ? OR isbn LIKE ?)');
          params.push(like, like, like);
        } else if (['title','author','isbn'].includes(fld)) {
          whereParts.push(`${fld} LIKE ?`);
          params.push(like);
        }
      }
      const whereClause = whereParts.length ? (' WHERE ' + whereParts.join(joiner)) : '';
      const rows = await all('SELECT * FROM books' + whereClause, params);
      return res.json(rows);
    }
    if (field && term) {
      const like = `%${term}%`;
      if (field === 'all') {
        const rows = await all('SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?', [like, like, like]);
        return res.json(rows);
      } else if (['title','author','isbn'].includes(field)) {
        const rows = await all(`SELECT * FROM books WHERE ${field} LIKE ?`, [like]);
        return res.json(rows);
      } else {
        const rows = await all('SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?', [like, like, like]);
        return res.json(rows);
      }
    }

    let sql = 'SELECT * FROM books WHERE 1=1';
    const params = [];
    if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
    if (q) { sql += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR abstract LIKE ? OR toc LIKE ? OR subjects LIKE ? OR publisher LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    if (publisher) { sql += ' AND publisher LIKE ?'; params.push(`%${publisher}%`); }
    if (subject) { sql += ' AND subjects LIKE ?'; params.push(`%${subject}%`); }
    if (yearFrom) { sql += ' AND year >= ?'; params.push(Number(yearFrom)); }
    if (yearTo) { sql += ' AND year <= ?'; params.push(Number(yearTo)); }
    const rows = await all(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch books' }); }
});

// Advanced search with FTS and keyword mapping
app.get('/api/search/advanced', async (req, res) => {
  try {
    const { q, filters, match='ALL', sort='relevance:desc', page='1', pageSize='20' } = req.query;
    const joiner = (String(match).toUpperCase()==='ANY') ? ' OR ' : ' AND ';
    const ftsParts = [];
    const baseWhere = [];
    const params = [];

    let parsed = [];
    if (filters) { try { parsed = JSON.parse(filters); } catch(e){ return res.status(400).json({ error: 'Invalid filters JSON' }); } }

    const mapField = (f) => ({ title:'title', author:'author', isbn:'isbn', publisher:'publisher', year:'year', abstract:'abstract', toc:'toc', subject:'subjects', subjects:'subjects', category:'category', all:'all' })[String(f||'all').toLowerCase()] || 'all';

    for (const f of parsed){
      const fld = mapField(f.field);
      const val = f.value ?? f.term;
      const op = String(f.op||'contains').toLowerCase();
      if (val==null || val==='') continue;
      if (fld==='year'){
        if (op==='between' && Array.isArray(val) && val.length===2){ baseWhere.push('b.year BETWEEN ? AND ?'); params.push(Number(val[0]), Number(val[1])); }
        else if (op==='gte'){ baseWhere.push('b.year >= ?'); params.push(Number(val)); }
        else if (op==='lte'){ baseWhere.push('b.year <= ?'); params.push(Number(val)); }
        else { baseWhere.push('b.year = ?'); params.push(Number(val)); }
      } else if (fld==='isbn') { baseWhere.push('b.isbn = ?'); params.push(String(val)); }
      else if (fld==='all') { ftsParts.push(`(title : ${val} OR author : ${val} OR isbn : ${val} OR publisher : ${val} OR abstract : ${val} OR toc : ${val} OR subjects : ${val} OR category : ${val})`); }
      else { ftsParts.push(`${fld} : ${val}`); }
    }

    if (q) ftsParts.push(q);

    let sql = 'SELECT b.*' + (ftsParts.length ? ', bm25(f) AS score' : '') + ' FROM books b';
    if (ftsParts.length){ sql += ' JOIN books_fts f ON f.rowid = b.id AND f MATCH ?'; params.unshift(ftsParts.join(' ' + joiner + ' ')); }
    if (baseWhere.length){ sql += ' WHERE ' + baseWhere.join(' AND '); }

    const [sField, sDirRaw] = String(sort).split(':');
    const sDir = (String(sDirRaw||'desc').toUpperCase()==='ASC') ? 'ASC' : 'DESC';
    const allow = { title:'b.title', author:'b.author', year:'b.year', publisher:'b.publisher' };
    if (sField==='relevance' && ftsParts.length) sql += ' ORDER BY score ASC'; else if (allow[sField]) sql += ` ORDER BY ${allow[sField]} ${sDir}`;

    const pg = Math.max(1, parseInt(req.query.page||'1')); const ps = Math.min(100, Math.max(1, parseInt(req.query.pageSize||'20')));
    sql += ' LIMIT ? OFFSET ?'; params.push(ps, (pg-1)*ps);

    const rows = await all(sql, params);
    res.json({ items: rows, page: pg, pageSize: ps });
  } catch (e) { res.status(500).json({ error: 'Advanced search failed' }); }
});

// --- Borrow / return / my-books ---
app.post('/api/books/:id/borrow', authenticateToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const userId = req.user.id;
    
    console.log('Attempting to borrow book:', { bookId, userId });
    
    const book = await get('SELECT available FROM books WHERE id = ?', [bookId]);
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
    
    // Set due date to 14 days from now
    const now = new Date();
    const dueDate = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
    
    console.log('Inserting borrow record:', { bookId, userId, dueDate: dueDate.toISOString() });
    
    // Get book and user details for history
    const bookDetails = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    const userDetails = await get('SELECT * FROM users WHERE id = ?', [userId]);
    
    // Update book availability
    await run('UPDATE books SET available = 0 WHERE id = ?', [bookId]);
    
    // Insert borrow record using existing column names
    await run(`INSERT INTO borrowed_books (book_id, user_id, borrow_date) 
               VALUES (?, ?, datetime('now'))`, 
             [bookId, userId]);
    
    // Record in history
    try {
      await run(`INSERT INTO borrow_history 
        (book_id, user_id, username, book_title, book_author, book_isbn, issue_date, due_date, status)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+14 days'), 'borrowed')`,
        [bookId, userId, userDetails.username, bookDetails.title, bookDetails.author, bookDetails.isbn]);
      console.log('✅ History record created for book', bookId);
    } catch (historyError) {
      console.error('❌ Failed to create history record:', historyError);
      // Continue anyway - book is already borrowed
    }
    
    console.log('Book borrowed successfully');
    res.json({ message: 'Book borrowed successfully!', dueDate: dueDate });
  } catch (e) { 
    console.error('Error borrowing book:', e);
    res.status(500).json({ error: 'Failed to borrow book: ' + e.message }); 
  }
});

app.post('/api/books/:id/return', authenticateToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const userId = req.user.id;
    const rec = await get('SELECT id FROM borrowed_books WHERE book_id = ? AND user_id = ?', [bookId, userId]);
    if (!rec) return res.status(400).json({ error: 'Book was not borrowed by this user.' });
    await run('UPDATE books SET available = 1 WHERE id = ?', [bookId]);
    await run('DELETE FROM borrowed_books WHERE id = ?', [rec.id]);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: 'Failed to return book.' }); }
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
    const borrowId = req.params.borrowId;
    const userId = req.user.id;
    
    // Verify the borrow record belongs to the user
    const borrowRecord = await get('SELECT * FROM borrowed_books WHERE id = ? AND user_id = ?', [borrowId, userId]);
    if (!borrowRecord) {
      return res.status(404).json({ error: 'Borrow record not found.' });
    }
    
    // Make the book available again
    await run('UPDATE books SET available = 1 WHERE id = ?', [borrowRecord.book_id]);
    
    // Delete the borrow record (simpler approach)
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);
    
    res.json({ message: 'Book returned successfully.' });
  } catch (e) {
    console.error('Error returning book:', e);
    res.status(500).json({ error: 'Failed to return book.' });
  }
});

// Renew a borrowed book
app.post('/api/renew-book/:borrowId', authenticateToken, async (req, res) => {
  try {
    const borrowId = req.params.borrowId;
    const userId = req.user.id;
    
    // Verify the borrow record belongs to the user
    const borrowRecord = await get('SELECT * FROM borrowed_books WHERE id = ? AND user_id = ?', [borrowId, userId]);
    if (!borrowRecord) {
      return res.status(404).json({ error: 'Borrow record not found.' });
    }
    
    // For now, just update the borrow date to extend the borrowing period
    await run('UPDATE borrowed_books SET borrow_date = datetime(\'now\') WHERE id = ?', [borrowId]);
    
    res.json({ message: 'Book renewed successfully for 7 more days.' });
  } catch (e) {
    console.error('Error renewing book:', e);
    res.status(500).json({ error: 'Failed to renew book.' });
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

    const book = await get('SELECT id, title, available FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const existing = await get(`
      SELECT id FROM notifications
      WHERE type = 'borrow_request' AND status = 'pending' AND user_id = ? AND book_id = ?
    `, [userId, bookId]);
    if (existing) {
      return res.status(400).json({ error: 'Borrow request already pending for this book' });
    }

    await run(`
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, message)
      VALUES ('borrow_request', ?, ?, ?, ?, 0, ?)
    `, [userId, username, book.id, book.title, `${username} requests to borrow "${book.title}"`]);

    res.json({ message: 'Borrow request sent to admin' });
  } catch (error) {
    console.error('Borrow request error (HTTP):', error);
    res.status(500).json({ error: 'Failed to submit borrow request' });
  }
});

// Legacy endpoint for backward compatibility
app.get('/api/my-books', authenticateToken, async (req, res) => {
  try {
    const rows = await all(`SELECT b.* FROM books b JOIN borrowed_books bb ON b.id = bb.book_id WHERE bb.user_id = ?`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch borrowed books.' }); }
});

// Admin endpoint to get all users
app.get('/api/admin/users/all', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await all('SELECT id, username, is_admin FROM users');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to retrieve users.' }); }
});

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

// Admin endpoint to get all borrowing records
app.get('/api/admin/borrows/all', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await all(`
      SELECT 
        bb.id,
        bb.book_id,
        bb.user_id,
        bb.borrow_date,
        b.title as book_title,
        u.username
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      JOIN users u ON bb.user_id = u.id
      ORDER BY bb.borrow_date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to retrieve borrowing records.' }); }
});

// Admin endpoint to force return a book
app.post('/api/admin/force-return/:borrowId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const borrowId = req.params.borrowId;
    
    // Get the borrow record
    const borrowRecord = await get('SELECT * FROM borrowed_books WHERE id = ?', [borrowId]);
    if (!borrowRecord) {
      return res.status(404).json({ error: 'Borrow record not found.' });
    }
    
    // Make the book available again
    await run('UPDATE books SET available = 1 WHERE id = ?', [borrowRecord.book_id]);
    
    // Delete the borrow record
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);
    
    res.json({ message: 'Book returned successfully by admin.' });
  } catch (e) {
    console.error('Error force returning book:', e);
    res.status(500).json({ error: 'Failed to return book.' });
  }
});

// Admin endpoint to delete a book
app.delete('/api/admin/books/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const bookId = req.params.id;
    
    // First, delete any borrowing records for this book
    await run('DELETE FROM borrowed_books WHERE book_id = ?', [bookId]);
    
    // Then delete the book
    await run('DELETE FROM books WHERE id = ?', [bookId]);
    
    res.json({ message: 'Book deleted successfully.' });
  } catch (e) {
    console.error('Error deleting book:', e);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});

// Admin endpoint to toggle user admin status
app.post('/api/admin/users/:id/toggle-admin', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { isAdmin } = req.body;
    
    await run('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId]);
    
    res.json({ message: `User ${isAdmin ? 'promoted to admin' : 'demoted to user'} successfully.` });
  } catch (e) {
    console.error('Error toggling user admin status:', e);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// --- Admin endpoints ---
app.get('/api/admin/books/all', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM books');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to retrieve all books.' }); }
});

app.post('/api/admin/books', authenticateToken, authorizeAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, author, isbn, category, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || '/uploads/default.jpg');
    if (!title || !author || !category) return res.status(400).json({ error: 'Title, author, and category are required.' });
    const r = await run('INSERT INTO books (title, author, isbn, category, description, image) VALUES (?, ?, ?, ?, ?, ?)', [title, author, isbn || null, category, description || null, image]);
    res.status(201).json({ id: r.lastID });
  } catch (e) { res.status(500).json({ error: 'Failed to add book.' }); }
});

app.put('/api/admin/books/:id', authenticateToken, authorizeAdmin, upload.single('image'), async (req, res) => {
  try {
    const id = req.params.id;
    const { title, author, isbn, category, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image || null;
    await run('UPDATE books SET title=?, author=?, isbn=?, category=?, description=?, image=? WHERE id=?', [title, author, isbn || null, category, description || null, image, id]);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: 'Failed to update book.' }); }
});

app.delete('/api/admin/books/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await run('DELETE FROM borrowed_books WHERE book_id = ?', [id]);
    await run('DELETE FROM books WHERE id = ?', [id]);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: 'Failed to delete book.' }); }
});

// Admin: issue a book to a user (admin can assign)
app.post('/api/admin/books/:id/issue', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { username } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const book = await get('SELECT available FROM books WHERE id = ?', [id]);
    if (!book || book.available === 0) return res.status(400).json({ error: 'Book not available.' });
    await run('UPDATE books SET available = 0 WHERE id = ?', [id]);
    await run('INSERT INTO borrowed_books (book_id, user_id) VALUES (?, ?)', [id, user.id]);
    res.json({ message: 'Issued' });
  } catch (e) { res.status(500).json({ error: 'Failed to issue book.' }); }
});

// Admin: issue book to user by username
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

// Admin: list borrowed records
app.get('/api/admin/borrowed', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await all(`SELECT bb.id, bb.book_id, bb.user_id, bb.borrow_date, 
      b.title, b.author, b.isbn, b.category, b.image, b.description,
      u.username
      FROM borrowed_books bb
      LEFT JOIN books b ON b.id = bb.book_id
      LEFT JOIN users u ON u.id = bb.user_id`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch borrowed records.' }); }
});

// Admin: mark return (admin can mark a borrowed record returned)
app.post('/api/admin/borrowed/:id/return', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const rec = await get(`SELECT bb.*, b.title, u.username 
      FROM borrowed_books bb
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN users u ON bb.user_id = u.id
      WHERE bb.id = ?`, [id]);
    
    if (!rec) return res.status(404).json({ error: 'Record not found' });
    
    // Get the original borrow record from history
    const historyRecord = await get(`SELECT * FROM borrow_history 
      WHERE book_id = ? AND user_id = ? AND status = 'borrowed' 
      ORDER BY issue_date DESC LIMIT 1`, [rec.book_id, rec.user_id]);
    
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
        [rec.book_id, rec.user_id, rec.username, rec.title, historyRecord.book_author, 
         historyRecord.book_isbn, historyRecord.issue_date, historyRecord.due_date, 
         fineAmount, req.user.username]);
    }
    
    await run('UPDATE books SET available = 1 WHERE id = ?', [rec.book_id]);
    await run('DELETE FROM borrowed_books WHERE id = ?', [id]);
    res.json({ message: 'Returned', book: rec.title, user: rec.username });
  } catch (e) { 
    console.error('Return error:', e);
    res.status(500).json({ error: 'Failed to mark return.' }); 
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

// Admin: Approve borrow request (issue book to user)
app.post('/api/admin/notifications/:id/approve-borrow', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;
    const notif = await get('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.type !== 'borrow_request') return res.status(400).json({ error: 'Invalid notification type' });
    if (notif.status !== 'pending') return res.status(400).json({ error: 'Notification already processed' });

    const book = await get('SELECT * FROM books WHERE id = ?', [notif.book_id]);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.available === 0) return res.status(400).json({ error: 'Book is currently unavailable' });

    await run('UPDATE books SET available = 0 WHERE id = ?', [book.id]);
    await run(`INSERT INTO borrowed_books (book_id, user_id, borrow_date) VALUES (?, ?, datetime('now'))`, [book.id, notif.user_id]);
    await run(`INSERT INTO borrow_history 
      (book_id, user_id, username, book_title, book_author, book_isbn, issue_date, due_date, status, issued_by)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now','+14 days'), 'borrowed', ?)`,
      [book.id, notif.user_id, notif.username, book.title, book.author, book.isbn, adminUsername]);

    await run(`UPDATE notifications SET status = 'approved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`, [adminUsername, notificationId]);
    res.json({ message: 'Borrow request approved. Book issued to user.' });
  } catch (e) {
    console.error('Approve borrow error (HTTP):', e);
    res.status(500).json({ error: 'Failed to approve borrow request' });
  }
});

// QR Code endpoints
// Generate QR code for a book
app.get('/api/books/:id/qrcode', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) return res.status(404).json({ error: 'Book not found.' });

    // Create QR code data with book details
    const qrData = {
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      available: book.available,
      url: `${req.protocol}://${req.get('host')}/book-info?id=${book.id}`
    };

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));
    res.json({ qrCode: qrCodeDataURL, bookData: qrData });
  } catch (e) {
    console.error('Error generating QR code:', e);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

// Get book info by ID (for QR code scanning)
app.get('/api/books/:id/info', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) return res.status(404).json({ error: 'Book not found.' });

    // Check if book is currently borrowed and by whom
    const borrowInfo = await get(`
      SELECT bb.borrow_date, u.username 
      FROM borrowed_books bb 
      JOIN users u ON bb.user_id = u.id 
      WHERE bb.book_id = ?
    `, [bookId]);

    const response = {
      ...book,
      status: book.available ? 'Available' : 'Borrowed',
      borrowedBy: borrowInfo ? borrowInfo.username : null,
      borrowedDate: borrowInfo ? borrowInfo.borrow_date : null
    };

    res.json(response);
  } catch (e) {
    console.error('Error fetching book info:', e);
    res.status(500).json({ error: 'Failed to fetch book info.' });
  }
});

// GATE SECURITY SYSTEM - Verify book for exit
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

    // Check if book is borrowed
    const borrowInfo = await get(`
      SELECT bb.id, bb.borrow_date, bb.user_id, u.username, u.id as userId
      FROM borrowed_books bb 
      JOIN users u ON bb.user_id = u.id 
      WHERE bb.book_id = ?
    `, [bookId]);

    if (borrowInfo) {
      // Book is borrowed - ALLOWED to exit
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
      // Book is NOT borrowed - ALARM!
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

// GATE SECURITY SYSTEM - Log exit attempts
app.post('/api/gate/log', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { bookId, userId, status, timestamp } = req.body;
    // You can create a gate_logs table to track all exit attempts
    // For now, just return success
    res.json({ message: 'Exit logged successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to log exit' });
  }
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('🔄 Auto-sync enabled: History syncs every 10 seconds');
  // Run initial sync
  autoSyncHistory();
});

// ==================== NEW FEATURES API ====================
// Import and use new features router
const newFeaturesRouter = require('./new-features-api')(get, all, run, authenticateToken);
app.use(newFeaturesRouter);

// Note: Static files are served by express.static middleware above
// This catch-all is only for client-side routing fallback
