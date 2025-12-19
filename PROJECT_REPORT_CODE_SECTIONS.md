# 📸 Project Report - Important Code Sections for Screenshots

## 🎯 Overview
This document lists the **most important code sections** to include in your project report with screenshots. These sections demonstrate the core functionality, architecture, and key features of the Library Management System.

---

## 📋 **SECTION 1: AUTHENTICATION & SECURITY** 🔐

### **1.1 JWT Token Authentication (Backend)**
**File:** `backend/server-https.js`  
**Lines:** 201-247  
**Why Important:** Shows secure login implementation with JWT tokens, password hashing, and admin verification.

**Key Code to Screenshot:**
```javascript
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  const match = await bcrypt.compare(password, user.password);
  const token = jwt.sign({ 
    id: user.id, 
    username: user.username, 
    isAdmin: isAdmin 
  }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, isAdmin: isAdmin });
});
```

### **1.2 Authentication Middleware**
**File:** `backend/server-https.js`  
**Lines:** 88-98  
**Why Important:** Demonstrates token verification and request protection.

**Key Code to Screenshot:**
```javascript
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
```

### **1.3 Admin Authorization**
**File:** `backend/server-https.js`  
**Lines:** 100-106  
**Why Important:** Shows role-based access control.

---

## 📋 **SECTION 2: DATABASE SCHEMA** 🗄️

### **2.1 Database Initialization**
**File:** `backend/init-db.js`  
**Lines:** 8-31  
**Why Important:** Shows complete database schema design with all tables.

**Key Code to Screenshot:**
```javascript
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  is_admin INTEGER DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS books (
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
  subjects TEXT
)`);
```

### **2.2 Full-Text Search (FTS5) Implementation**
**File:** `backend/init-db.js`  
**Lines:** 41-61  
**Why Important:** Demonstrates advanced search functionality with SQLite FTS5.

**Key Code to Screenshot:**
```javascript
db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  title, author, isbn, publisher, year, abstract, toc, subjects, category,
  content='books', content_rowid='id', tokenize='porter'
)`);
```

### **2.3 Borrowed Books Table**
**File:** `backend/init-db.js`  
**Lines:** 63-86  
**Why Important:** Shows transaction tracking with dates and due dates.

---

## 📋 **SECTION 3: QR CODE SCANNER** 📸

### **3.1 QR Scanner Implementation (Frontend)**
**File:** `frontend/admin.js`  
**Lines:** 1064-1115  
**Why Important:** Core feature - QR code scanning for book issue/return.

**Key Code to Screenshot:**
```javascript
issueScannerInstance = new Html5Qrcode("issue-scanner");

await issueScannerInstance.start(
  { facingMode: "environment" },
  { fps: 10, qrbox: { width: 250, height: 250 } },
  (decodedText) => {
    let bookId = decodedText;
    try {
      const qrData = JSON.parse(decodedText);
      bookId = qrData.id || decodedText;
    } catch (e) {
      // Not JSON, use as is
    }
    document.getElementById('issue-book-id').value = bookId;
    stopIssueScanner();
    showIssueStatus('QR Code scanned! Book ID: ' + bookId, 'success');
  }
);
```

### **3.2 QR Code Generation (Backend)**
**File:** `backend/server-https.js`  
**Search for:** QRCode generation endpoint  
**Why Important:** Shows how QR codes are generated for books.

---

## 📋 **SECTION 4: BOOK MANAGEMENT** 📚

### **4.1 Book Issue API**
**File:** `backend/server-https.js`  
**Search for:** `/api/admin/issue-book` endpoint  
**Why Important:** Core functionality - issuing books to users.

**Key Code to Screenshot:**
```javascript
app.post('/api/admin/issue-book', authenticateToken, authorizeAdmin, async (req, res) => {
  const { bookId, username } = req.body;
  // Check book availability
  // Check user exists
  // Create borrow record
  // Update book availability
  // Return success
});
```

### **4.2 Book Return API**
**File:** `backend/server-https.js`  
**Search for:** `/api/admin/return-book` endpoint  
**Why Important:** Core functionality - returning books and calculating fines.

### **4.3 Book Search with FTS**
**File:** `backend/server-https.js`  
**Lines:** 280-316  
**Why Important:** Advanced search using full-text search.

**Key Code to Screenshot:**
```javascript
const books = await all(`
  SELECT DISTINCT b.* 
  FROM books b
  LEFT JOIN books_fts fts ON b.id = fts.rowid
  WHERE books_fts MATCH ? OR b.title LIKE ? OR b.author LIKE ?
  ORDER BY b.title
`, [searchQuery, search, search]);
```

---

## 📋 **SECTION 5: USER INTERFACE** 🎨

### **5.1 Admin Dashboard**
**File:** `frontend/admin.html`  
**Lines:** 138-188  
**Why Important:** Shows admin dashboard structure with statistics cards.

### **5.2 User Stats Section (Hidden for Admins)**
**File:** `frontend/index.html`  
**Lines:** 135-163  
**Why Important:** Demonstrates conditional UI rendering based on user role.

**Key Code to Screenshot:**
```html
<section id="user-stats-section" class="user-stats-dashboard hidden user-only-section">
  <h2>📊 Your Reading Stats</h2>
  <div class="stats-grid">
    <!-- Stats cards -->
  </div>
</section>
```

### **5.3 Admin Detection & UI Hiding**
**File:** `frontend/new-features.js`  
**Lines:** 56-70  
**Why Important:** Shows how admin users are detected and user-only sections are hidden.

**Key Code to Screenshot:**
```javascript
const isAdmin = localStorage.getItem('isAdmin') === 'true';
if (isAdmin) {
  console.log('⚠️ Admin user detected - skipping stats load');
  const statsSection = document.getElementById('user-stats-section');
  if (statsSection) {
    statsSection.classList.add('hidden');
    statsSection.style.display = 'none';
  }
  return null;
}
```

---

## 📋 **SECTION 6: API ENDPOINTS** 🌐

### **6.1 RESTful API Structure**
**File:** `backend/server-https.js`  
**Why Important:** Shows complete API endpoint organization.

**Key Endpoints to Document:**
- `POST /api/login` - User authentication
- `POST /api/register` - User registration
- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get book by ID
- `POST /api/books/:id/borrow` - Borrow a book
- `POST /api/admin/issue-book` - Admin issue book
- `POST /api/admin/return-book` - Admin return book
- `GET /api/borrowed-books` - Get user's borrowed books
- `GET /api/user/stats` - Get user statistics

### **6.2 Error Handling**
**File:** `backend/server-https.js`  
**Why Important:** Shows proper error handling and HTTP status codes.

---

## 📋 **SECTION 7: SECURITY FEATURES** 🔒

### **7.1 Password Hashing**
**File:** `backend/server-https.js`  
**Search for:** bcrypt usage  
**Why Important:** Shows secure password storage.

**Key Code to Screenshot:**
```javascript
const hashedPassword = await bcrypt.hash(password, 10);
// or
const match = await bcrypt.compare(password, user.password);
```

### **7.2 HTTPS Configuration**
**File:** `backend/server-https.js`  
**Lines:** 1-77  
**Why Important:** Shows SSL/TLS setup for secure connections.

**Key Code to Screenshot:**
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
};

const server = https.createServer(options, app);
```

---

## 📋 **SECTION 8: ADVANCED FEATURES** ⚡

### **8.1 User Statistics API**
**File:** `backend/new-features-api.js`  
**Search for:** `/api/user/stats`  
**Why Important:** Shows complex query with aggregations.

### **8.2 Book Recommendations**
**File:** `backend/new-features-api.js`  
**Search for:** `/api/recommendations`  
**Why Important:** Demonstrates personalized recommendations algorithm.

### **8.3 Fine Calculation**
**File:** `backend/server-https.js`  
**Search for:** fine calculation logic  
**Why Important:** Shows business logic for overdue fines.

---

## 📋 **SECTION 9: FRONTEND-BACKEND INTEGRATION** 🔄

### **9.1 API Fetch Function**
**File:** `frontend/script.js`  
**Lines:** 72-89  
**Why Important:** Shows how frontend communicates with backend.

**Key Code to Screenshot:**
```javascript
async function apiFetch(path, opts={}) {
  opts.headers = { ...(opts.headers||{}), ...authHeader() };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) {
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}
```

### **9.2 Login Success Handler**
**File:** `frontend/ui-integration.js`  
**Lines:** 113-151  
**Why Important:** Shows complete login flow and UI updates.

---

## 📋 **SECTION 10: CONFIGURATION & SETUP** ⚙️

### **10.1 Server Configuration**
**File:** `backend/server-https.js`  
**Lines:** 1-30  
**Why Important:** Shows dependencies and server setup.

**Key Code to Screenshot:**
```javascript
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const QRCode = require('qrcode');
```

### **10.2 Database Connection**
**File:** `backend/server-https.js`  
**Search for:** Database initialization  
**Why Important:** Shows database connection setup.

---

## 📸 **SCREENSHOT PRIORITY LIST**

### **HIGH PRIORITY (Must Include):**
1. ✅ **Authentication & JWT** (Section 1.1, 1.2)
2. ✅ **Database Schema** (Section 2.1)
3. ✅ **QR Scanner Implementation** (Section 3.1)
4. ✅ **Book Issue/Return APIs** (Section 4.1, 4.2)
5. ✅ **Admin Detection Logic** (Section 5.3)

### **MEDIUM PRIORITY (Should Include):**
6. ✅ **Full-Text Search** (Section 2.2)
7. ✅ **API Endpoints Structure** (Section 6.1)
8. ✅ **Password Hashing** (Section 7.1)
9. ✅ **Frontend-Backend Integration** (Section 9.1)

### **LOW PRIORITY (Nice to Have):**
10. ✅ **HTTPS Configuration** (Section 7.2)
11. ✅ **User Statistics API** (Section 8.1)
12. ✅ **Error Handling** (Section 6.2)

---

## 📝 **SCREENSHOT TIPS**

1. **Use High Contrast Theme** - Makes code more readable in screenshots
2. **Highlight Key Lines** - Use your IDE's line highlighting feature
3. **Include Line Numbers** - Shows code location
4. **Add Annotations** - Use arrows or boxes to highlight important parts
5. **Show Context** - Include surrounding code (10-20 lines before/after)
6. **Multiple Views** - Show both frontend and backend for integration points
7. **Clean Code** - Remove console.logs and comments if they clutter the view

---

## 🎯 **RECOMMENDED SCREENSHOT SEQUENCE**

1. **Start with Architecture:**
   - Database Schema (init-db.js)
   - Server Setup (server-https.js beginning)

2. **Show Security:**
   - Authentication Middleware
   - JWT Token Generation
   - Password Hashing

3. **Core Features:**
   - Book Issue API
   - Book Return API
   - QR Scanner Code

4. **Advanced Features:**
   - Full-Text Search
   - User Statistics
   - Admin Detection

5. **Integration:**
   - Frontend API Calls
   - UI Updates on Login
   - Error Handling

---

## 📄 **FILE LOCATIONS SUMMARY**

| Section | File | Lines |
|---------|------|-------|
| Authentication | `backend/server-https.js` | 201-247 |
| Auth Middleware | `backend/server-https.js` | 88-98 |
| Database Schema | `backend/init-db.js` | 8-86 |
| QR Scanner | `frontend/admin.js` | 1064-1115 |
| Book Search | `backend/server-https.js` | 280-316 |
| Admin Detection | `frontend/new-features.js` | 56-70 |
| API Integration | `frontend/script.js` | 72-89 |
| User Stats | `frontend/index.html` | 135-163 |

---

**Good luck with your project report! 🎓📚**

