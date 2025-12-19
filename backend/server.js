// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
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

// Lightweight health endpoint for cloud debugging
app.get('/api/health', async (req, res) => {
  try {
    const row = await get('SELECT COUNT(*) AS c FROM books');
    res.json({
      ok: true,
      booksCount: row ? row.c : null,
      seedPath: path.join(__dirname, 'seed-books.json'),
      seedPathExists: !!app.locals.seedPathExists,
      seedBooksLength: app.locals.seedBooksLength ?? null,
      cwd: process.cwd()
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================== DATABASE AUTO-INIT (for cloud deploys) ====================
// Render/Netlify deploys do not include local `library.db` (we don't commit DB files).
// This ensures the DB schema exists and seeds sample data when empty.
async function initializeDatabase() {
  const safeRun = async (sql, params = []) => {
    try { await run(sql, params); } catch (_) { /* best-effort */ }
  };

  // Users (full schema for registration + admin)
  await safeRun(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT,
    role TEXT,
    is_admin INTEGER DEFAULT 0,
    full_name TEXT,
    roll_no TEXT UNIQUE,
    date_of_birth TEXT,
    mobile_no TEXT,
    user_photo TEXT,
    id_proof_photo TEXT,
    is_verified INTEGER DEFAULT 0,
    verification_status TEXT DEFAULT 'pending',
    registration_date TEXT,
    verified_by INTEGER,
    verified_date TEXT,
    rejection_reason TEXT
  )`);

  // Books (full schema)
  await safeRun(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    isbn TEXT,
    category TEXT,
    description TEXT,
    image TEXT,
    available INTEGER DEFAULT 1,
    publisher TEXT,
    year INTEGER,
    abstract TEXT,
    toc TEXT,
    subjects TEXT,
    rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0
  )`);

  // Ensure newer columns exist if DB was created by an older version (best-effort)
  await safeRun(`ALTER TABLE books ADD COLUMN publisher TEXT`);
  await safeRun(`ALTER TABLE books ADD COLUMN year INTEGER`);
  await safeRun(`ALTER TABLE books ADD COLUMN abstract TEXT`);
  await safeRun(`ALTER TABLE books ADD COLUMN toc TEXT`);
  await safeRun(`ALTER TABLE books ADD COLUMN subjects TEXT`);
  await safeRun(`ALTER TABLE books ADD COLUMN rating REAL DEFAULT 0`);
  await safeRun(`ALTER TABLE books ADD COLUMN review_count INTEGER DEFAULT 0`);

  // FTS (optional but used by advanced search)
  await safeRun(`CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
    title, author, isbn, publisher, year, abstract, toc, subjects, category,
    content='books', content_rowid='id', tokenize='porter'
  )`);
  await safeRun(`CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
    INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES (new.id, new.title, new.author, new.isbn, new.publisher, new.year, new.abstract, new.toc, new.subjects, new.category);
  END`);
  await safeRun(`CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES('delete', old.id, old.title, old.author, old.isbn, old.publisher, old.year, old.abstract, old.toc, old.subjects, old.category);
    INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES (new.id, new.title, new.author, new.isbn, new.publisher, new.year, new.abstract, new.toc, new.subjects, new.category);
  END`);
  await safeRun(`CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
    VALUES('delete', old.id, old.title, old.author, old.isbn, old.publisher, old.year, old.abstract, old.toc, old.subjects, old.category);
  END`);

  // Borrowed books + due dates + fine_paid
  await safeRun(`CREATE TABLE IF NOT EXISTS borrowed_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    user_id INTEGER,
    borrowed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    returned_date DATETIME,
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    fine_paid INTEGER DEFAULT 0
  )`);

  // Ensure newer columns exist if DB was created by an older version (best-effort)
  await safeRun(`ALTER TABLE borrowed_books ADD COLUMN borrowed_date DATETIME DEFAULT CURRENT_TIMESTAMP`);
  await safeRun(`ALTER TABLE borrowed_books ADD COLUMN due_date DATETIME`);
  await safeRun(`ALTER TABLE borrowed_books ADD COLUMN returned_date DATETIME`);
  await safeRun(`ALTER TABLE borrowed_books ADD COLUMN fine_paid INTEGER DEFAULT 0`);

  // Borrow history (used by auto-sync + admin history UI)
  await safeRun(`CREATE TABLE IF NOT EXISTS borrow_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT,
    book_title TEXT,
    book_author TEXT,
    book_isbn TEXT,
    issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    due_date DATETIME,
    fine_amount DECIMAL(10,2) DEFAULT 0,
    fine_paid INTEGER DEFAULT 0,
    status TEXT DEFAULT 'borrowed',
    issued_by TEXT,
    returned_to TEXT,
    notes TEXT
  )`);

  // New features tables (best-effort)
  await safeRun(`CREATE TABLE IF NOT EXISTS reading_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await safeRun(`CREATE TABLE IF NOT EXISTS list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(list_id, book_id)
  )`);
  await safeRun(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    review_text TEXT,
    helpful_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, user_id)
  )`);
  // Notifications table is used by both:
  // - User notifications (title/link/read)
  // - Admin workflow requests (borrow/return/renew requests with status + book fields)
  // So we keep a superset schema.
  await safeRun(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT NOT NULL,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Admin workflow fields (optional for user-only notifications)
    username TEXT,
    book_id INTEGER,
    book_title TEXT,
    borrow_id INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    resolved_at DATETIME,
    resolved_by TEXT
  )`);

  // Ensure admin-workflow columns exist if DB was created by an older version (best-effort)
  await safeRun(`ALTER TABLE notifications ADD COLUMN username TEXT`);
  await safeRun(`ALTER TABLE notifications ADD COLUMN book_id INTEGER`);
  await safeRun(`ALTER TABLE notifications ADD COLUMN book_title TEXT`);
  await safeRun(`ALTER TABLE notifications ADD COLUMN borrow_id INTEGER DEFAULT 0`);
  await safeRun(`ALTER TABLE notifications ADD COLUMN status TEXT DEFAULT 'pending'`);
  await safeRun(`ALTER TABLE notifications ADD COLUMN resolved_at DATETIME`);
  await safeRun(`ALTER TABLE notifications ADD COLUMN resolved_by TEXT`);
  await safeRun(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'available', 'expired', 'cancelled')),
    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notified_at DATETIME,
    expires_at DATETIME
  )`);
  await safeRun(`CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    criteria TEXT NOT NULL,
    points INTEGER DEFAULT 0
  )`);
  await safeRun(`CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
  )`);
  await safeRun(`CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY,
    total_borrowed INTEGER DEFAULT 0,
    total_returned INTEGER DEFAULT 0,
    currently_borrowed INTEGER DEFAULT 0,
    reading_streak INTEGER DEFAULT 0,
    last_borrow_date DATE,
    favorite_category TEXT,
    total_points INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed books if empty
  const row = await get('SELECT COUNT(*) AS c FROM books');
  const currentCount = (row && typeof row.c === 'number') ? row.c : 0;

  // Prefer seeding from a committed dataset (backend/seed-books.json) when available.
  const seedPath = path.join(__dirname, 'seed-books.json');
  let seedBooks = null;
  try {
    if (fs.existsSync(seedPath)) {
      seedBooks = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (!Array.isArray(seedBooks)) seedBooks = null;
    }
  } catch (e) {
    console.error('⚠️ Failed to read seed-books.json:', e.message);
    seedBooks = null;
  }

  app.locals.seedPathExists = fs.existsSync(seedPath);
  app.locals.seedBooksLength = seedBooks ? seedBooks.length : 0;
  console.log(`📦 Seed file: ${app.locals.seedPathExists ? 'found' : 'missing'} (${app.locals.seedBooksLength} books)`);

  const normalizeImage = (img) => {
    const s = String(img || '').trim();
    if (!s) return '/uploads/default.jpg';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/uploads/')) return s;
    return '/uploads/default.jpg';
  };

  if (seedBooks && (currentCount === 0 || currentCount < seedBooks.length)) {
    // Insert missing books (best-effort). We don't assume any unique constraints exist.
    let inserted = 0;
    for (const b of seedBooks) {
      const title = String(b.title || '').trim();
      const author = String(b.author || '').trim();
      const isbn = String(b.isbn || '').trim();
      if (!title) continue;
      const exists = await get('SELECT id FROM books WHERE title = ? AND author = ? AND isbn = ? LIMIT 1', [title, author, isbn]);
      if (exists) continue;
      try {
        await run(
          `INSERT INTO books (title, author, isbn, category, description, image, available, publisher, year, abstract, toc, subjects, rating, review_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            author,
            isbn,
            String(b.category || ''),
            String(b.description || ''),
            normalizeImage(b.image),
            (b.available == null ? 1 : (b.available ? 1 : 0)),
            String(b.publisher || ''),
            (b.year == null || b.year === '' ? null : Number(b.year)),
            String(b.abstract || ''),
            String(b.toc || ''),
            String(b.subjects || ''),
            Number(b.rating || 0),
            Number(b.review_count || 0)
          ]
        );
        inserted++;
      } catch (e) {
        // Log a short error so cloud logs show why seeding failed
        console.error(`⚠️ Seed insert failed for "${title}" (${isbn}):`, e.message);
      }
    }

    // Backfill FTS index (best-effort, avoid duplicates by full rebuild when small)
    await safeRun('DELETE FROM books_fts');
    await safeRun(`INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
                  SELECT id, title, author, isbn, IFNULL(publisher,''), IFNULL(year,''), IFNULL(abstract,''), IFNULL(toc,''), IFNULL(subjects,''), IFNULL(category,'') FROM books`);
    console.log(`✅ Seeded books from seed-books.json (+${inserted})`);
  } else if (currentCount === 0) {
    // Fallback minimal demo data
    const samples = [
      ["Cosmos", "Carl Sagan", "9780345539434", "Science", "A journey through the universe exploring astronomy and cosmology", "/uploads/science.jpg", 1, "Ballantine Books", 1980, "Cosmos traces the origins of knowledge and the scientific method...", "Chapter 1: The Shores of the Cosmic Ocean", "astronomy, cosmology, science"],
      ["A Brief History of Time", "Stephen Hawking", "9780553380163", "Science", "From the Big Bang to black holes - cosmology explained", "/uploads/science.jpg", 1, "Bantam Books", 1988, "A landmark volume in science writing...", "Chapter 1: Our Picture of the Universe", "physics, cosmology, black holes"],
      ["Code Complete", "Steve McConnell", "9780735619678", "Technology", "A practical handbook of software construction", "/uploads/technology.jpg", 1, "Microsoft Press", 2004, "Widely considered one of the best practical guides to programming...", "Part I: Laying the Foundation", "software engineering, programming, best practices"]
    ];
    const stmt = db.prepare('INSERT INTO books (title, author, isbn, category, description, image, available, publisher, year, abstract, toc, subjects) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    samples.forEach(s => stmt.run(s));
    await new Promise((resolve) => stmt.finalize(resolve));
    await safeRun(`INSERT INTO books_fts(rowid, title, author, isbn, publisher, year, abstract, toc, subjects, category)
                  SELECT id, title, author, isbn, IFNULL(publisher,''), IFNULL(year,''), IFNULL(abstract,''), IFNULL(toc,''), IFNULL(subjects,''), IFNULL(category,'') FROM books`);
    console.log('✅ Seeded fallback sample books (cloud init)');
  }

  // Create default admin user if missing (admin/admin)
  const ensureUser = async ({ username, password, isAdmin }) => {
    const existing = await get('SELECT * FROM users WHERE username = ?', [username]);
    const desiredHash = bcrypt.hashSync(password, 10);

    if (!existing) {
      await safeRun(
        `INSERT INTO users (username, password, is_admin, role, verification_status, is_verified)
         VALUES (?, ?, ?, ?, 'approved', 1)`,
        [username, desiredHash, isAdmin ? 1 : 0, isAdmin ? 'admin' : 'user']
      );
      console.log(`✅ Created default ${isAdmin ? 'admin' : 'user'} (${username}/${password})`);
      return;
    }

    // Ensure role/admin flags are correct
    await safeRun('UPDATE users SET is_admin = ?, role = ? WHERE id = ?', [isAdmin ? 1 : 0, isAdmin ? 'admin' : 'user', existing.id]);
    await safeRun("UPDATE users SET verification_status = 'approved', is_verified = 1 WHERE id = ?", [existing.id]);

    // If password hash is missing/invalid or doesn't match, reset to the expected default
    let ok = false;
    try { ok = bcrypt.compareSync(password, existing.password || ''); } catch (_) { ok = false; }
    if (!ok) {
      await safeRun('UPDATE users SET password = ? WHERE id = ?', [desiredHash, existing.id]);
      console.log(`🔑 Reset password for ${username} to default (${username}/${password})`);
    }
  };

  await ensureUser({ username: 'admin', password: 'admin', isAdmin: true });
  // Demo user matching docs (kj/kj) so the public site can be tested immediately
  await ensureUser({ username: 'kj', password: 'kj', isAdmin: false });
}

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
  const username = (req.body && req.body.username != null) ? String(req.body.username).trim() : '';
  const password = (req.body && req.body.password != null) ? String(req.body.password) : '';
  if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    let match = false;
    try { match = bcrypt.compareSync(password, user.password || ''); } catch (_) { match = false; }
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
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, title, message, status, read)
      VALUES ('borrow_request', ?, ?, ?, ?, 0, 'Borrow Request', ?, 'pending', 0)
    `, [userId, username, book.id, book.title, `${username} requests to borrow "${book.title}"`]);

    res.json({ message: 'Borrow request sent to admin' });
  } catch (error) {
    console.error('Borrow request error (HTTP):', error);
    res.status(500).json({ error: 'Failed to submit borrow request' });
  }
});

// User: Request return (creates admin notification)
app.post('/api/notifications/return-request', authenticateToken, async (req, res) => {
  try {
    const { borrowId } = req.body;
    const userId = req.user.id;

    const borrow = await get(`
      SELECT bb.*, b.title, u.username
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      JOIN users u ON bb.user_id = u.id
      WHERE bb.id = ? AND bb.user_id = ?
    `, [borrowId, userId]);

    if (!borrow) return res.status(404).json({ error: 'Borrowed book not found' });

    const existing = await get(`
      SELECT id FROM notifications
      WHERE borrow_id = ? AND type = 'return_request' AND status = 'pending'
    `, [borrowId]);
    if (existing) return res.status(400).json({ error: 'Return request already pending' });

    await run(`
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, title, message, status, read)
      VALUES ('return_request', ?, ?, ?, ?, ?, 'Return Request', ?, 'pending', 0)
    `, [userId, borrow.username, borrow.book_id, borrow.title, borrowId, `${borrow.username} requests to return "${borrow.title}"`]);

    res.json({ message: 'Return request submitted successfully' });
  } catch (e) {
    console.error('Return request error:', e);
    res.status(500).json({ error: 'Failed to submit return request' });
  }
});

// User: Request renewal (creates admin notification)
app.post('/api/notifications/renew-request', authenticateToken, async (req, res) => {
  try {
    const { borrowId } = req.body;
    const userId = req.user.id;

    const borrow = await get(`
      SELECT bb.*, b.title, u.username
      FROM borrowed_books bb
      JOIN books b ON bb.book_id = b.id
      JOIN users u ON bb.user_id = u.id
      WHERE bb.id = ? AND bb.user_id = ?
    `, [borrowId, userId]);

    if (!borrow) return res.status(404).json({ error: 'Borrowed book not found' });

    const existing = await get(`
      SELECT id FROM notifications
      WHERE borrow_id = ? AND type = 'renew_request' AND status = 'pending'
    `, [borrowId]);
    if (existing) return res.status(400).json({ error: 'Renewal request already pending' });

    await run(`
      INSERT INTO notifications (type, user_id, username, book_id, book_title, borrow_id, title, message, status, read)
      VALUES ('renew_request', ?, ?, ?, ?, ?, 'Renewal Request', ?, 'pending', 0)
    `, [userId, borrow.username, borrow.book_id, borrow.title, borrowId, `${borrow.username} requests to renew "${borrow.title}"`]);

    res.json({ message: 'Renewal request submitted successfully' });
  } catch (e) {
    console.error('Renew request error:', e);
    res.status(500).json({ error: 'Failed to submit renewal request' });
  }
});

// Legacy endpoint for backward compatibility
app.get('/api/my-books', authenticateToken, async (req, res) => {
  try {
    const rows = await all(`SELECT b.* FROM books b JOIN borrowed_books bb ON b.id = bb.book_id WHERE bb.user_id = ?`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch borrowed books.' }); }
});

// Admin endpoint to get all users (with details + borrowed count)
async function getAdminUsersList() {
  return await all(`
    SELECT
      u.id,
      u.username,
      u.email,
      u.full_name,
      u.roll_no,
      u.mobile_no,
      u.user_photo,
      u.is_admin,
      u.role,
      u.verification_status,
      COALESCE((SELECT COUNT(*) FROM borrowed_books bb WHERE bb.user_id = u.id), 0) as borrowed_count
    FROM users u
    ORDER BY u.id ASC
  `);
}

app.get('/api/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await getAdminUsersList();
    res.json(users);
  } catch (e) {
    console.error('Admin users fetch error:', e);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// Compatibility alias (some pages call /api/admin/users/all)
app.get('/api/admin/users/all', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await getAdminUsersList();
    res.json(users);
  } catch (e) {
    console.error('Admin users(all) fetch error:', e);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
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

// ========== USER MANAGEMENT (compat for admin-user-fine-management.js) ==========
app.get('/api/admin/user/:id/details', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await get(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.roll_no,
        u.mobile_no,
        u.user_photo,
        u.is_admin,
        u.role,
        u.verification_status,
        COALESCE((SELECT COUNT(*) FROM borrowed_books bb WHERE bb.user_id = u.id), 0) as borrowed_count
      FROM users u
      WHERE u.id = ?
      LIMIT 1
    `, [userId]);

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    console.error('Get user details error:', e);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// Toggle user role (make admin/remove admin)
app.post('/api/admin/user/:id/toggle-role', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await get('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newRole = user.is_admin ? 0 : 1;
    await run('UPDATE users SET is_admin = ?, role = ? WHERE id = ?', [newRole, newRole ? 'admin' : 'user', userId]);
    res.json({ message: 'User role updated successfully', is_admin: newRole });
  } catch (e) {
    console.error('Toggle user role error:', e);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (block if they have borrowed books)
app.delete('/api/admin/user/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const borrowed = await get('SELECT COUNT(*) as count FROM borrowed_books WHERE user_id = ?', [userId]);
    if ((borrowed && borrowed.count) > 0) {
      return res.status(400).json({ error: 'Cannot delete user with borrowed books' });
    }
    await run('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'User deleted successfully' });
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ========== FINE MANAGEMENT ==========
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
  } catch (e) {
    console.error('Get fines error:', e);
    res.status(500).json({ error: 'Failed to get fines' });
  }
});

app.post('/api/admin/fine/:borrowId/mark-paid', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const borrowId = req.params.borrowId;
    await run('UPDATE borrowed_books SET fine_paid = 1 WHERE id = ?', [borrowId]);
    res.json({ message: 'Fine marked as paid successfully' });
  } catch (e) {
    console.error('Mark fine paid error:', e);
    res.status(500).json({ error: 'Failed to mark fine as paid' });
  }
});

// Placeholder reminder endpoint (no external email service wired)
app.post('/api/admin/fine/:userId/send-reminder', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`Fine reminder requested for user ${userId} by ${req.user.username}`);
    res.json({ message: 'Reminder sent successfully' });
  } catch (e) {
    console.error('Send reminder error:', e);
    res.status(500).json({ error: 'Failed to send reminder' });
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

// Compatibility endpoint used by some admin pages
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
    console.error('Admin all-borrowed fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch borrowed books' });
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

// ==================== NEW FEATURES API ====================
// Import and use new features router
const newFeaturesRouter = require('./new-features-api')(get, all, run, authenticateToken);
app.use(newFeaturesRouter);

// ==================== ADMIN: STUDENT REGISTRATIONS (Cloud/HTTP) ====================
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

app.get('/api/admin/all-registrations', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const regs = await all(`
      SELECT id, username, full_name, roll_no, date_of_birth, mobile_no, email,
             user_photo, id_proof_photo, registration_date, verification_status,
             verified_date, rejection_reason
      FROM users
      WHERE full_name IS NOT NULL
      ORDER BY registration_date DESC
    `);
    res.json(regs);
  } catch (e) {
    console.error('Get all registrations error:', e);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

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
    res.json({ message: 'Registration approved successfully', user });
  } catch (e) {
    console.error('Approve registration error:', e);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject registration (keep record + reason so admin history works on cloud)
app.post('/api/admin/reject-registration/:userId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const reason = (req.body && req.body.reason) ? String(req.body.reason).trim() : 'Rejected';
    const adminId = req.user.id;

    await run(`
      UPDATE users
      SET is_verified = 2,
          verification_status = 'rejected',
          rejection_reason = ?,
          verified_by = ?,
          verified_date = datetime('now')
      WHERE id = ?
    `, [reason, adminId, userId]);

    const user = await get('SELECT username, full_name FROM users WHERE id = ?', [userId]);
    res.json({ message: 'Registration rejected', user });
  } catch (e) {
    console.error('Reject registration error:', e);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// ==================== ADMIN: NOTIFICATIONS (Cloud/HTTP) ====================
app.get('/api/admin/notifications', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notifications = await all(`
      SELECT * FROM notifications
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);
    res.json(notifications);
  } catch (e) {
    console.error('Get notifications error:', e);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

app.get('/api/admin/notifications/count', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await get(`SELECT COUNT(*) as count FROM notifications WHERE status = 'pending'`);
    res.json({ count: result.count || 0 });
  } catch (e) {
    console.error('Get notification count error:', e);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

app.post('/api/admin/notifications/:id/approve-return', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;

    const notification = await get('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    const borrowId = notification.borrow_id;
    const borrow = await get('SELECT * FROM borrowed_books WHERE id = ?', [borrowId]);
    if (!borrow) return res.status(404).json({ error: 'Borrowed book not found' });

    // Set book available again (boolean available 0/1)
    await run('UPDATE books SET available = 1 WHERE id = ?', [borrow.book_id]);
    await run('DELETE FROM borrowed_books WHERE id = ?', [borrowId]);

    await run(`UPDATE notifications SET status = 'approved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`, [adminUsername, notificationId]);
    res.json({ message: 'Return approved successfully' });
  } catch (e) {
    console.error('Approve return error:', e);
    res.status(500).json({ error: 'Failed to approve return' });
  }
});

app.post('/api/admin/notifications/:id/approve-renew', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;

    const notification = await get('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    const borrowId = notification.borrow_id;
    await run(`UPDATE borrowed_books SET borrow_date = datetime('now') WHERE id = ?`, [borrowId]);

    await run(`UPDATE notifications SET status = 'approved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`, [adminUsername, notificationId]);
    res.json({ message: 'Renewal approved successfully' });
  } catch (e) {
    console.error('Approve renewal error:', e);
    res.status(500).json({ error: 'Failed to approve renewal' });
  }
});

app.post('/api/admin/notifications/:id/reject', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminUsername = req.user.username;
    await run(`UPDATE notifications SET status = 'rejected', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`, [adminUsername, notificationId]);
    res.json({ message: 'Request rejected' });
  } catch (e) {
    console.error('Reject notification error:', e);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Start server (after DB init so cloud deploys don't 500 on /api/books)
(async () => {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized');
  } catch (e) {
    console.error('❌ Database initialization failed:', e);
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('🔄 Auto-sync enabled: History syncs every 10 seconds');
    // Run initial sync
    autoSyncHistory();
  });
})();

// Note: Static files are served by express.static middleware above
// This catch-all is only for client-side routing fallback
