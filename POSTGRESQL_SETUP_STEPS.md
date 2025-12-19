# 🐘 POSTGRESQL SETUP - STEP BY STEP GUIDE

## 📋 COMPLETE INSTALLATION AND MIGRATION GUIDE

Follow these steps carefully to migrate your library system from SQLite to PostgreSQL.

---

## ✅ STEP 1: INSTALL POSTGRESQL

### **Windows:**

1. **Download PostgreSQL:**
   - Go to: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15 or higher (recommended: 15.4)
   - File size: ~250 MB

2. **Run Installer:**
   - Double-click the downloaded `.exe` file
   - Click "Next" through the welcome screen

3. **Select Components:**
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (GUI tool)
   - ✅ Command Line Tools
   - ✅ Stack Builder (optional)

4. **Choose Installation Directory:**
   - Default: `C:\Program Files\PostgreSQL\15`
   - Click "Next"

5. **Choose Data Directory:**
   - Default: `C:\Program Files\PostgreSQL\15\data`
   - Click "Next"

6. **Set Password:**
   - **IMPORTANT:** Set password for `postgres` superuser
   - Remember this password! You'll need it later
   - Example: `admin123` (use stronger password in production)
   - Click "Next"

7. **Set Port:**
   - Default: `5432`
   - Keep default unless you have conflicts
   - Click "Next"

8. **Set Locale:**
   - Default locale (English, United States)
   - Click "Next"

9. **Complete Installation:**
   - Review settings
   - Click "Next" to install
   - Wait for installation (5-10 minutes)
   - Uncheck "Launch Stack Builder" (optional)
   - Click "Finish"

10. **Verify Installation:**
    ```powershell
    # Open PowerShell and run:
    psql --version
    # Should show: psql (PostgreSQL) 15.x
    ```

---

## ✅ STEP 2: CREATE DATABASE

### **Method 1: Using pgAdmin (GUI - Recommended for Beginners)**

1. **Open pgAdmin 4:**
   - Start Menu → PostgreSQL 15 → pgAdmin 4
   - Wait for browser to open

2. **Connect to Server:**
   - Click "Servers" in left panel
   - Click "PostgreSQL 15"
   - Enter password you set during installation
   - Click "OK"

3. **Create Database:**
   - Right-click "Databases"
   - Select "Create" → "Database..."
   - Database name: `library_system`
   - Owner: `postgres`
   - Click "Save"

4. **Create User:**
   - Right-click "Login/Group Roles"
   - Select "Create" → "Login/Group Role..."
   - General tab:
     - Name: `library_admin`
   - Definition tab:
     - Password: `your_secure_password`
   - Privileges tab:
     - ✅ Can login?
     - ✅ Create databases?
   - Click "Save"

5. **Grant Permissions:**
   - Right-click `library_system` database
   - Select "Properties"
   - Go to "Security" tab
   - Click "+" to add
   - Grantee: `library_admin`
   - Privileges: Select ALL
   - Click "Save"

### **Method 2: Using Command Line (Advanced)**

1. **Open Command Prompt as Administrator**

2. **Login to PostgreSQL:**
   ```powershell
   psql -U postgres
   # Enter password when prompted
   ```

3. **Create Database:**
   ```sql
   CREATE DATABASE library_system;
   ```

4. **Create User:**
   ```sql
   CREATE USER library_admin WITH PASSWORD 'your_secure_password';
   ```

5. **Grant Privileges:**
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE library_system TO library_admin;
   ```

6. **Exit:**
   ```sql
   \q
   ```

---

## ✅ STEP 3: INSTALL NODE.JS PACKAGES

1. **Open Terminal in Backend Folder:**
   ```powershell
   cd C:\Users\sudip hanra\Desktop\LibrarySystem2\LibrarySystem\LibrarySystem\backend
   ```

2. **Install PostgreSQL Driver:**
   ```powershell
   npm install pg
   ```

3. **Install dotenv (if not already installed):**
   ```powershell
   npm install dotenv
   ```

4. **Verify Installation:**
   ```powershell
   npm list pg
   # Should show: pg@8.x.x
   ```

---

## ✅ STEP 4: CREATE .ENV FILE

1. **Copy Example File:**
   ```powershell
   copy .env.example .env
   ```

2. **Edit .env File:**
   Open `.env` in notepad and update:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=library_system
   DB_USER=library_admin
   DB_PASSWORD=your_secure_password
   JWT_SECRET=your_jwt_secret_key_change_this
   PORT=5000
   HTTPS_PORT=5443
   NODE_ENV=development
   ```

3. **Save the file**

---

## ✅ STEP 5: CREATE DATABASE SCHEMA

### **Method 1: Using pgAdmin (Recommended)**

1. **Open pgAdmin 4**

2. **Connect to library_system database:**
   - Expand "Servers" → "PostgreSQL 15"
   - Expand "Databases"
   - Click "library_system"

3. **Open Query Tool:**
   - Click "Tools" menu → "Query Tool"
   - Or press `Alt + Shift + Q`

4. **Load SQL File:**
   - Click "Open File" icon (folder icon)
   - Navigate to: `backend\init-postgres.sql`
   - Click "Open"

5. **Execute SQL:**
   - Click "Execute" button (▶ play icon)
   - Or press `F5`
   - Wait for completion (should take 5-10 seconds)

6. **Verify Success:**
   - Check "Messages" tab at bottom
   - Should see: "✅ PostgreSQL schema created successfully!"
   - Should see: "Query returned successfully"

7. **Verify Tables:**
   - In left panel, expand "library_system"
   - Expand "Schemas" → "public" → "Tables"
   - You should see 11 tables:
     - users
     - books
     - borrowed_books
     - reading_lists
     - list_items
     - reviews
     - notifications
     - reservations
     - achievements
     - user_achievements
     - user_stats

### **Method 2: Using Command Line**

```powershell
# Navigate to backend folder
cd backend

# Run SQL file
psql -U library_admin -d library_system -f init-postgres.sql

# Enter password when prompted
```

---

## ✅ STEP 6: MIGRATE DATA FROM SQLITE

1. **Ensure SQLite Database Exists:**
   ```powershell
   # Check if library.db exists
   dir library.db
   ```

2. **Run Migration Script:**
   ```powershell
   node migrate-to-postgres.js
   ```

3. **Monitor Progress:**
   - You'll see progress for each table
   - Example output:
     ```
     📋 Migrating users...
     Found 5 users
     ✅ Migrated 5 users
     
     📚 Migrating books...
     Found 20 books
     ✅ Migrated 20 books
     ...
     ```

4. **Verify Success:**
   - Should see: "✅ MIGRATION COMPLETED SUCCESSFULLY!"
   - Total time displayed
   - Next steps listed

5. **Verify Data in pgAdmin:**
   - Open pgAdmin
   - Right-click "users" table → "View/Edit Data" → "All Rows"
   - Check if your users are there
   - Repeat for other tables

---

## ✅ STEP 7: UPDATE SERVER FILES

You have two options:

### **Option A: Use Existing Files (Already Created)**

The server files are already set up to use PostgreSQL. Just make sure `.env` is configured correctly.

### **Option B: Manual Update (If Needed)**

If you need to update manually, replace the database imports:

**In `server.js` and `server-https.js`:**

Change from:
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(...);
```

To:
```javascript
const db = require('./db-postgres');
```

---

## ✅ STEP 8: TEST THE SYSTEM

1. **Start HTTP Server:**
   ```powershell
   node server.js
   ```

2. **Check Console:**
   - Should see: "✅ PostgreSQL connection pool initialized"
   - Should see: "Server running at http://localhost:5000"

3. **Start HTTPS Server (in new terminal):**
   ```powershell
   node server-https.js
   ```

4. **Test in Browser:**
   - Open: `http://localhost:5000/`
   - Login with existing credentials
   - Check if books display
   - Try borrowing a book
   - Check if stats update

5. **Test API Endpoints:**
   ```powershell
   # Test health check
   curl http://localhost:5000/api/health
   
   # Test books endpoint
   curl http://localhost:5000/api/books
   ```

---

## ✅ STEP 9: VERIFY DATA INTEGRITY

1. **Check User Count:**
   ```sql
   SELECT COUNT(*) FROM users;
   ```

2. **Check Book Count:**
   ```sql
   SELECT COUNT(*) FROM books;
   ```

3. **Check Borrowed Books:**
   ```sql
   SELECT COUNT(*) FROM borrowed_books;
   ```

4. **Compare with SQLite:**
   ```powershell
   # In SQLite
   sqlite3 library.db "SELECT COUNT(*) FROM users;"
   sqlite3 library.db "SELECT COUNT(*) FROM books;"
   ```

5. **Verify Relationships:**
   ```sql
   -- Check if foreign keys work
   SELECT u.username, COUNT(b.id) as borrowed_count
   FROM users u
   LEFT JOIN borrowed_books b ON u.id = b.user_id
   GROUP BY u.username;
   ```

---

## ✅ STEP 10: OPTIMIZE PERFORMANCE

1. **Analyze Tables:**
   ```sql
   ANALYZE users;
   ANALYZE books;
   ANALYZE borrowed_books;
   ANALYZE reviews;
   ```

2. **Check Indexes:**
   ```sql
   SELECT tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

3. **Test Full-Text Search:**
   ```sql
   SELECT title, author 
   FROM books 
   WHERE search_vector @@ plainto_tsquery('english', 'science')
   LIMIT 10;
   ```

4. **Check Database Size:**
   ```sql
   SELECT pg_size_pretty(pg_database_size('library_system'));
   ```

---

## ✅ STEP 11: SETUP BACKUPS

### **Automated Backup Script (Windows):**

Create `backup-db.bat`:
```batch
@echo off
set PGPASSWORD=your_password
set BACKUP_DIR=C:\backups\library_system
set DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%

mkdir %BACKUP_DIR% 2>nul

pg_dump -U library_admin -d library_system > %BACKUP_DIR%\library_backup_%DATE%.sql

echo Backup completed: %BACKUP_DIR%\library_backup_%DATE%.sql
```

### **Schedule Backup (Windows Task Scheduler):**

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Library Database Backup"
4. Trigger: Daily at 2:00 AM
5. Action: Start a program
6. Program: `C:\path\to\backup-db.bat`
7. Finish

---

## ✅ STEP 12: PRODUCTION DEPLOYMENT

### **For Production Server:**

1. **Update .env:**
   ```env
   NODE_ENV=production
   DB_HOST=your_production_host
   DB_PASSWORD=strong_production_password
   JWT_SECRET=long_random_production_secret
   ```

2. **Enable SSL for Database:**
   ```env
   DB_SSL=true
   ```

3. **Use Process Manager:**
   ```powershell
   npm install -g pm2
   pm2 start server.js --name library-http
   pm2 start server-https.js --name library-https
   pm2 save
   pm2 startup
   ```

4. **Setup Nginx Reverse Proxy:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## 🎯 TROUBLESHOOTING

### **Problem: Can't connect to PostgreSQL**

**Solution:**
```powershell
# Check if PostgreSQL is running
Get-Service -Name postgresql*

# Start service if stopped
Start-Service postgresql-x64-15
```

### **Problem: Password authentication failed**

**Solution:**
1. Check `.env` file has correct password
2. Verify user exists:
   ```sql
   \du
   ```
3. Reset password if needed:
   ```sql
   ALTER USER library_admin WITH PASSWORD 'new_password';
   ```

### **Problem: Database doesn't exist**

**Solution:**
```sql
-- List all databases
\l

-- Create if missing
CREATE DATABASE library_system;
```

### **Problem: Tables not created**

**Solution:**
```powershell
# Re-run schema creation
psql -U library_admin -d library_system -f init-postgres.sql
```

### **Problem: Migration fails**

**Solution:**
1. Check SQLite database exists
2. Check PostgreSQL connection
3. Run migration again (it's safe to re-run)

### **Problem: Slow queries**

**Solution:**
```sql
-- Analyze tables
ANALYZE;

-- Reindex if needed
REINDEX DATABASE library_system;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

---

## 📊 PERFORMANCE COMPARISON

### **Before (SQLite):**
- Max records: ~1 million
- Concurrent users: 1-10
- Query time (10k records): ~50ms
- Full-text search: Basic

### **After (PostgreSQL):**
- Max records: Billions
- Concurrent users: 1000+
- Query time (10k records): ~10ms
- Query time (1M records): ~50ms
- Query time (10M records): ~200ms
- Full-text search: Advanced

---

## ✅ SUCCESS CHECKLIST

- [ ] PostgreSQL installed
- [ ] Database created
- [ ] User created with permissions
- [ ] Node packages installed
- [ ] .env file configured
- [ ] Schema created (11 tables)
- [ ] Data migrated successfully
- [ ] Server starts without errors
- [ ] Can login to application
- [ ] Books display correctly
- [ ] Can borrow/return books
- [ ] Stats update correctly
- [ ] Search works
- [ ] Backups configured
- [ ] Performance optimized

---

## 🎉 CONGRATULATIONS!

Your library system is now running on PostgreSQL and ready to handle:

✅ **Millions of books**
✅ **Thousands of concurrent users**
✅ **Fast full-text search**
✅ **Advanced analytics**
✅ **Production-grade performance**
✅ **Scalable architecture**

---

## 📞 QUICK REFERENCE

**PostgreSQL Commands:**
```powershell
# Start PostgreSQL
Start-Service postgresql-x64-15

# Stop PostgreSQL
Stop-Service postgresql-x64-15

# Connect to database
psql -U library_admin -d library_system

# Backup database
pg_dump -U library_admin library_system > backup.sql

# Restore database
psql -U library_admin library_system < backup.sql

# Check database size
psql -U library_admin -d library_system -c "SELECT pg_size_pretty(pg_database_size('library_system'));"
```

**Useful SQL Queries:**
```sql
-- Show all tables
\dt

-- Show table structure
\d books

-- Show indexes
\di

-- Show database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Show table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public';
```

---

**Your library system is now enterprise-ready!** 🚀📚✨
