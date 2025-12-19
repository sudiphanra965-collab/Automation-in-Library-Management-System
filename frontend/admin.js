// admin.js
const token = localStorage.getItem('token');
const storedIsAdmin = localStorage.getItem('isAdmin');
function decodeJwtPayload(t){ try{ return JSON.parse(atob(t.split('.')[1])); }catch(e){ return null; } }
const payload = token ? decodeJwtPayload(token) : null;

// Check both JWT payload and localStorage for admin status
const isAdmin = !!(
  (payload && payload.isAdmin) || 
  (storedIsAdmin === 'true') ||
  (payload && payload.role === 'admin')
);

console.log('Admin check:', { token: !!token, isAdmin, storedIsAdmin, payload });

if (!token || !isAdmin) { 
  console.error('Admin access denied. Token:', !!token, 'IsAdmin:', isAdmin);
  alert('Admin access required. Please login with an admin account.'); 
  window.location.href = '/'; 
}

const authHeaders = () => ({ 'Authorization': `Bearer ${token}` });

// API Base URL - Always HTTPS for camera access on both mobile and desktop
function getAPIBase() {
  const hostname = window.location.hostname;
  const currentPort = window.location.port;
  
  // If already on HTTPS backend port, use relative URLs
  if (currentPort === '5443') {
    return '';
  }
  
  // Always use HTTPS port 5443
  // For localhost (desktop)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://localhost:5443';
  }
  
  // For mobile/network access - use HTTPS
  return `https://${hostname}:5443`;
}

const API_BASE = getAPIBase();

// Function to detect if user is on a mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768); // Also check screen width
}

// Function to open Gate Scanner with automatic HTTPS redirect for camera access (mobile only)
function openGateScanner() {
  const isHTTP = window.location.protocol === 'http:';
  const isMobile = isMobileDevice();
  
  // Only redirect to HTTPS if on mobile device (for camera access)
  if (isHTTP && isMobile) {
    // Redirect to HTTPS for camera access on mobile
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let httpsURL;
    if (isLocalhost) {
      httpsURL = 'https://localhost:5443/gate-scanner.html';
    } else {
      httpsURL = 'https://10.237.19.96:5443/gate-scanner.html';
    }
    
    // Show helpful message
    const proceed = confirm(
      '📷 Camera access requires HTTPS!\n\n' +
      'Redirecting to secure connection for camera access.\n' +
      'You may see a security warning - click "Advanced" → "Proceed"\n\n' +
      'Click OK to continue.'
    );
    
    if (proceed) {
      window.open(httpsURL, '_blank');
    }
  } else {
    // Desktop or already on HTTPS - just open normally
    window.open('/gate-scanner.html', '_blank');
  }
}

const adminBookList = document.getElementById('admin-book-list');
const borrowedList = document.getElementById('borrowed-list');
const bookForm = document.getElementById('bookForm');
const clearBtn = document.getElementById('clearBtn');
const bookIdInput = document.getElementById('bookId');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const isbnInput = document.getElementById('isbn');
const categoryInput = document.getElementById('category');
const descriptionInput = document.getElementById('description');
const imageFileInput = document.getElementById('imageFile');

async function loadAdminBooks() {
  adminBookList.innerHTML = '<p>Loading…</p>';
  try {
    const res = await fetch('/api/admin/books/all', { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load');
    const books = await res.json();
    renderAdminBooks(books);
  } catch (e) {
    adminBookList.innerHTML = `<p style="color:red">${e.message}</p>`;
  }
}

function renderAdminBooks(books) {
  if (!books.length) { 
    adminBookList.innerHTML = '<p class="text-gray-500 text-center py-4">No books yet</p>'; 
    return; 
  }
  
  // Create table structure with Book ID column
  adminBookList.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-gray-100 border-b-2 border-gray-300">
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cover</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Author</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody id="book-table-body"></tbody>
      </table>
    </div>
  `;
  
  const tbody = document.getElementById('book-table-body');
  books.forEach(b => {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-gray-50 transition-colors';
    tr.innerHTML = `
      <td class="px-4 py-3">
        <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
          ${b.id}
        </span>
      </td>
      <td class="px-4 py-3">
        <img src="${b.image || '/uploads/default.jpg'}" 
             onerror="this.src='/uploads/default.jpg'" 
             class="w-12 h-16 object-cover rounded shadow-sm"
             alt="Book cover" />
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-gray-900">${escapeHtml(b.title)}</div>
        ${b.isbn ? `<div class="text-xs text-gray-500 mt-1">ISBN: ${escapeHtml(b.isbn)}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-gray-700">${escapeHtml(b.author || 'N/A')}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          ${escapeHtml(b.category || 'N/A')}
        </span>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 ${b.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full text-xs font-medium">
          ${b.available ? '✅ Available' : '📤 Issued'}
        </span>
      </td>
      <td class="px-4 py-3">
        <div class="flex gap-2">
          <button class="edit-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors" data-id="${b.id}">
            Edit
          </button>
          <button class="issue-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors" data-id="${b.id}">
            Issue
          </button>
          <button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors" data-id="${b.id}">
            Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', e => fillFormForEdit(e.currentTarget.dataset.id)));
  document.querySelectorAll('.issue-btn').forEach(btn => btn.addEventListener('click', e => issueBookPrompt(e.currentTarget.dataset.id)));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    if (!confirm('Delete this book?')) return;
    const res = await fetch(`/api/admin/books/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { alert('Delete failed'); return; }
    loadAdminBooks(); loadBorrowed();
  }));
}

async function loadBorrowed() {
  borrowedList.innerHTML = '<div class="flex justify-center items-center py-8"><div class="animate-pulse text-gray-500">Loading borrowed records...</div></div>';
  try {
    const res = await fetch('/api/admin/borrowed', { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load borrowed');
    const rows = await res.json();
    
    if (!rows.length) { 
      borrowedList.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📚</div>
          <p class="text-gray-500 text-lg">No borrowed books at the moment</p>
          <p class="text-gray-400 text-sm mt-2">All books are available in the library</p>
        </div>`;
      return;
    }
    
    borrowedList.innerHTML = '<div class="grid grid-cols-1 gap-4"></div>';
    const container = borrowedList.firstChild;
    
    rows.forEach(r => {
      const borrowDate = new Date(r.borrow_date);
      const formattedDate = borrowDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      const formattedTime = borrowDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Get book image or use default
      const bookImage = r.image || '/uploads/default.jpg';
      
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border-l-4 border-blue-500';
      card.innerHTML = `
        <div class="flex items-start gap-6">
          <!-- Book Cover Image -->
          <div class="flex-shrink-0">
            <img src="${escapeHtml(bookImage)}" alt="${escapeHtml(r.title || 'Book Cover')}" 
                 class="w-32 h-44 object-cover rounded-lg shadow-lg border-2 border-gray-200"
                 onerror="this.src='/uploads/default.jpg'" />
          </div>
          
          <!-- Book Details -->
          <div class="flex-1 min-w-0">
            <h3 class="text-2xl font-bold text-gray-800 mb-3">${escapeHtml(r.title || 'Unknown Title')}</h3>
            
            <div class="space-y-2 mb-4">
              <div class="flex items-center gap-2 text-gray-700">
                <span class="font-semibold text-sm">👤 Author:</span>
                <span class="text-sm">${escapeHtml(r.author || 'Unknown Author')}</span>
              </div>
              
              <div class="flex items-center gap-2 text-gray-700">
                <span class="font-semibold text-sm">📚 ISBN:</span>
                <span class="text-sm font-mono">${escapeHtml(r.isbn || 'N/A')}</span>
              </div>
              
              <div class="flex items-center gap-2 text-gray-700">
                <span class="font-semibold text-sm">🏷️ Category:</span>
                <span class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">${escapeHtml(r.category || 'Uncategorized')}</span>
              </div>
            </div>
            
            <!-- Borrowed By - Large Display -->
            <div class="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
              <div class="flex items-center justify-center gap-3">
                <span class="text-2xl">👨</span>
                <div class="text-center">
                  <div class="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1">Borrowed by</div>
                  <div class="text-xl font-bold text-blue-700">${escapeHtml(r.username || 'Unknown')}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Date, Time & Action -->
          <div class="flex-shrink-0 flex flex-col items-end gap-3 min-w-max">
            <div class="text-right bg-gray-50 rounded-lg p-3">
              <div class="flex items-center gap-2 text-gray-700 mb-2">
                <span class="text-xl">📅</span>
                <span class="font-bold text-sm">${formattedDate}</span>
              </div>
              <div class="flex items-center gap-2 text-gray-600">
                <span class="text-xl">🕐</span>
                <span class="text-sm font-semibold">${formattedTime}</span>
              </div>
            </div>
            
            <button class="return-record bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2" data-id="${r.id}">
              <span class="text-xl">✅</span>
              <span>Return Book</span>
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
    
    document.querySelectorAll('.return-record').forEach(b => b.addEventListener('click', async (e)=>{
      const id = e.currentTarget.dataset.id;
      const button = e.currentTarget;
      
      if (!confirm('✅ Mark this book as returned?')) return;
      
      // Disable button and show loading
      button.disabled = true;
      button.innerHTML = '<span class="animate-pulse">Processing...</span>';
      
      try {
        const res = await fetch(`/api/admin/borrowed/${id}/return`, { method: 'POST', headers: authHeaders() });
        if (!res.ok) { 
          alert('❌ Return failed. Please try again.');
          button.disabled = false;
          button.innerHTML = '<span class="text-lg">✅</span><span>Mark Return</span>';
          return;
        }
        
        // Show success feedback
        button.innerHTML = '<span class="text-lg">✓</span><span>Returned!</span>';
        button.className = 'bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold';
        
        // Reload after short delay
        setTimeout(() => {
          loadBorrowed();
          loadAdminBooks();
        }, 800);
      } catch (err) {
        alert('Error: ' + err.message);
        button.disabled = false;
        button.innerHTML = '<span class="text-lg">✅</span><span>Mark Return</span>';
      }
    }));
  } catch (e) {
    borrowedList.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">⚠️</div>
        <p class="text-red-500 text-lg font-semibold">${escapeHtml(e.message)}</p>
        <p class="text-gray-500 text-sm mt-2">Please try refreshing the page</p>
      </div>`;
  }
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

async function fillFormForEdit(id) {
  const res = await fetch('/api/admin/books/all', { headers: authHeaders() });
  const books = await res.json();
  const b = books.find(x=>String(x.id)===String(id));
  if (!b) return alert('Not found');
  bookIdInput.value = b.id;
  titleInput.value = b.title || '';
  authorInput.value = b.author || '';
  isbnInput.value = b.isbn || '';
  categoryInput.value = b.category || '';
  descriptionInput.value = b.description || '';
  imageFileInput.value = '';
  
  // Switch to Add/Edit Book view
  const nav = document.getElementById('adminNav');
  if (nav) {
    nav.querySelectorAll('li').forEach(n => n.classList.remove('active'));
    const editTab = nav.querySelector('li[data-view="add-edit-book"]');
    if (editTab) {
      editTab.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      const editPane = document.getElementById('view-add-edit-book');
      if (editPane) {
        editPane.style.display = '';
        editPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}

async function issueBookPrompt(id) {
  const username = prompt('Issue to username:');
  if (!username) return;
  try {
    const res = await fetch(`/api/admin/books/${id}/issue`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || 'Issue failed');
    }
    alert('Issued');
    loadAdminBooks(); loadBorrowed();
  } catch (e) {
    alert('Error: '+e.message);
  }
}

bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = bookIdInput.value;
  const fd = new FormData();
  fd.append('title', titleInput.value.trim());
  fd.append('author', authorInput.value.trim());
  fd.append('isbn', isbnInput.value.trim());
  fd.append('category', categoryInput.value.trim());
  fd.append('description', descriptionInput.value.trim());
  if (imageFileInput.files[0]) fd.append('image', imageFileInput.files[0]);

  try {
    let res;
    if (id) {
      res = await fetch(`/api/admin/books/${id}`, { method: 'PUT', headers: authHeaders(), body: fd });
    } else {
      res = await fetch('/api/admin/books', { method: 'POST', headers: authHeaders(), body: fd });
    }
    if (!res.ok) { const t = await res.text(); throw new Error(t || 'Save failed'); }
    alert(id ? 'Updated' : 'Added');
    bookForm.reset(); bookIdInput.value = '';
    loadAdminBooks(); loadBorrowed();
  } catch (err) {
    alert('Error: '+err.message);
  }
});

clearBtn.addEventListener('click', (e) => { e.preventDefault(); bookForm.reset(); bookIdInput.value = ''; });

loadAdminBooks();
loadBorrowed();

// --- Sidebar navigation and dashboard rendering ---
const nav = document.getElementById('adminNav');
if (nav){
  nav.addEventListener('click', (e)=>{
    const li = e.target.closest('li');
    if (!li) return;
    nav.querySelectorAll('li').forEach(n=>n.classList.remove('active'));
    li.classList.add('active');
    const view = li.dataset.view;
    document.querySelectorAll('.admin-view').forEach(v=> v.style.display='none');
    const pane = document.getElementById(`view-${view}`);
    if (pane) {
      pane.style.display = '';
      
      // Load data when switching views
      if (view === 'users') {
        setTimeout(loadUsersData, 100);
      } else if (view === 'fines') {
        setTimeout(loadFinesData, 100);
      } else if (view === 'dashboard') {
        setTimeout(loadDashboard, 100);
      }
    }
  });
}

// Load dashboard statistics
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: authHeaders() });
    if (res.ok) {
      const stats = await res.json();
      console.log('📊 Dashboard stats loaded:', stats);
      
      document.getElementById('stat-total') && (document.getElementById('stat-total').textContent = stats.totalBooks || 0);
      document.getElementById('stat-issued') && (document.getElementById('stat-issued').textContent = stats.borrowedBooks || 0);
      document.getElementById('stat-users') && (document.getElementById('stat-users').textContent = stats.totalUsers || 0);
      
      // Load overdue count from fines API
      try {
        const finesRes = await fetch('/api/admin/fines', { headers: authHeaders() });
        if (finesRes.ok) {
          const fines = await finesRes.json();
          document.getElementById('stat-overdue') && (document.getElementById('stat-overdue').textContent = fines.length);
        }
      } catch (err) {
        console.error('Error loading overdue count:', err);
        document.getElementById('stat-overdue') && (document.getElementById('stat-overdue').textContent = 0);
      }
    } else {
      console.error('Failed to load stats:', res.status);
    }
  } catch (e) {
    console.error('Error loading stats:', e);
  }
}

// Dashboard stats (basic from existing endpoints)
async function loadDashboard(){
  // Load statistics
  await loadStats();
  
  try{
    // Fetch books for additional info if needed
    const booksRes = await fetch('/api/books', { headers: authHeaders() });
    const books = booksRes.ok ? await booksRes.json() : [];

    const tbody = document.querySelector('#activityTable tbody');
    if (tbody){
      tbody.innerHTML = '';
      const rows = [
        ['User login','10:15 AM','—'],
        ['Book Issue','10:00 AM','—'],
        ['User logout','9:45 AM','—'],
        ['Book Issue','9:30 AM','—']
      ];
      rows.forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>`;
        tbody.appendChild(tr);
      });
    }
  }catch(e){ /* ignore */ }
}

loadDashboard();

// --- Dashboard Stat Card Click Handlers ---

// Show all books when Total Books card is clicked
function showAllBooks() {
  // Switch to View Books view
  const nav = document.getElementById('adminNav');
  if (nav) {
    nav.querySelectorAll('li').forEach(n => n.classList.remove('active'));
    const booksTab = nav.querySelector('li[data-view="view-books"]');
    if (booksTab) {
      booksTab.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      const booksPane = document.getElementById('view-view-books');
      if (booksPane) {
        booksPane.style.display = '';
        // Scroll to books section
        booksPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}

// Show issued books when Books Issued card is clicked
function showIssuedBooks() {
  // Switch to Issue & Return view
  const nav = document.getElementById('adminNav');
  if (nav) {
    nav.querySelectorAll('li').forEach(n => n.classList.remove('active'));
    const issueTab = nav.querySelector('li[data-view="issue"]');
    if (issueTab) {
      issueTab.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      const issuePane = document.getElementById('view-issue');
      if (issuePane) {
        issuePane.style.display = '';
        // Scroll to issued books section
        issuePane.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}

// Show overdue books when Books Overdue card is clicked
function showOverdueBooks() {
  // Switch to Fine Management view to show overdue books
  const nav = document.getElementById('adminNav');
  if (nav) {
    nav.querySelectorAll('li').forEach(n => n.classList.remove('active'));
    const finesTab = nav.querySelector('li[data-view="fines"]');
    if (finesTab) {
      finesTab.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      const finesPane = document.getElementById('view-fines');
      if (finesPane) {
        finesPane.style.display = '';
        finesPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Load fines data
        loadFinesData();
      }
    }
  }
}

// Load fines data when showing fines view
async function loadFinesData() {
  // Call the new loadFines function from admin-user-fine-management.js
  if (typeof window.loadFines === 'function') {
    window.loadFines();
    return;
  }
  
  try {
    const res = await fetch('/api/admin/fines', { headers: authHeaders() });
    if (!res.ok) {
      console.error('Failed to load fines');
      return;
    }
    const fines = await res.json();
    
    console.log('Fines loaded:', fines);
    
    // Update statistics
    const totalFines = fines.reduce((sum, fine) => sum + fine.fine_amount, 0);
    const paidFines = fines.filter(f => f.fine_paid).reduce((sum, fine) => sum + fine.fine_amount, 0);
    const pendingFines = totalFines - paidFines;
    const overdueCount = fines.length;
    
    document.getElementById('total-fines') && (document.getElementById('total-fines').textContent = `₹${totalFines}`);
    document.getElementById('paid-fines') && (document.getElementById('paid-fines').textContent = `₹${paidFines}`);
    document.getElementById('pending-fines') && (document.getElementById('pending-fines').textContent = `₹${pendingFines}`);
    document.getElementById('overdue-count') && (document.getElementById('overdue-count').textContent = overdueCount);
    
    // Update dashboard overdue stat
    document.getElementById('stat-overdue') && (document.getElementById('stat-overdue').textContent = overdueCount);
    
    // Display fines in table
    const finesTable = document.getElementById('fines-table-body');
    if (finesTable) {
      if (fines.length === 0) {
        finesTable.innerHTML = `
          <tr>
            <td colspan="7" class="px-6 py-8 text-center text-gray-500">
              ✅ No overdue books! All books are returned on time.
            </td>
          </tr>
        `;
      } else {
        finesTable.innerHTML = '';
        fines.forEach(fine => {
          const isPaid = fine.fine_paid;
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-gray-50';
          tr.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(fine.username)}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(fine.book_title)}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${formatDate(fine.due_date)}</td>
            <td class="px-6 py-4 text-sm text-red-600 font-semibold">${fine.days_overdue} days</td>
            <td class="px-6 py-4 text-sm text-red-600 font-semibold">₹${fine.fine_amount}</td>
            <td class="px-6 py-4 text-sm">
              <span class="px-3 py-1 ${isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'} rounded-full text-xs font-medium">
                ${isPaid ? '✅ Paid' : '⏳ Pending'}
              </span>
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
              ${!isPaid ? `
                <button onclick="markFinePaid(${fine.borrow_id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                  💰 Mark Paid
                </button>
              ` : `
                <span class="text-green-600 text-xs">Paid</span>
              `}
              <button onclick="alert('Reminder sent to ${escapeHtml(fine.username)}!')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                📧 Remind
              </button>
            </td>
          `;
          finesTable.appendChild(tr);
        });
      }
    }
  } catch (e) {
    console.error('Error loading fines:', e);
    const finesTable = document.getElementById('fines-table-body');
    if (finesTable) {
      finesTable.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-red-500">
            Error loading fines: ${e.message}
          </td>
        </tr>
      `;
    }
  }
}

// Mark fine as paid
async function markFinePaid(borrowId) {
  if (!confirm('Mark this fine as paid?')) return;
  
  try {
    const res = await fetch(`/api/admin/fine/${borrowId}/mark-paid`, {
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error('Failed to mark fine as paid');
    }
    
    alert('✅ Fine marked as paid!');
    loadFinesData();
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}

// Refresh fines
function refreshFines() {
  loadFinesData();
}

// Helper function to format date
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Show all users when Registered Users card is clicked
async function showAllUsers() {
  // Hide all views
  document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
  
  // Show users view
  const usersView = document.getElementById('view-users');
  if (usersView) {
    usersView.style.display = 'block';
    loadUsersData(); // Load users when view is shown
  }
  
  // Update navigation
  document.querySelectorAll('.admin-nav li').forEach(li => li.classList.remove('active'));
  const usersNavItem = Array.from(document.querySelectorAll('.admin-nav li')).find(li => 
    li.textContent.trim().includes('User Management')
  );
  if (usersNavItem) {
    usersNavItem.classList.add('active');
  }
}

// Load User Management dashboard stats
async function loadUserManagementStats() {
  try {
    const apiBase = window.location.hostname === 'localhost' ? 'https://localhost:5443' : `https://${window.location.hostname}:5443`;
    const response = await fetch(`${apiBase}/api/admin/users?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Failed to load user stats');
      return;
    }
    
    const users = await response.json();
    
    // Calculate stats
    const totalUsers = users.length;
    const activeUsers = users.filter(u => !u.is_admin).length; // Regular users
    const adminUsers = users.filter(u => u.is_admin).length;
    const totalBorrowed = users.reduce((sum, u) => sum + (u.borrowed_count || 0), 0);
    
    // Update dashboard
    const totalUsersEl = document.getElementById('total-users');
    const activeUsersEl = document.getElementById('active-users');
    const adminUsersEl = document.getElementById('admin-users');
    const totalBorrowedEl = document.getElementById('total-borrowed');
    
    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (activeUsersEl) activeUsersEl.textContent = activeUsers;
    if (adminUsersEl) adminUsersEl.textContent = adminUsers;
    if (totalBorrowedEl) totalBorrowedEl.textContent = totalBorrowed;
    
    console.log('📊 User Management stats updated:', { totalUsers, activeUsers, adminUsers, totalBorrowed });
  } catch (error) {
    console.error('Error loading user management stats:', error);
  }
}

// Load users data when showing users view
async function loadUsersData() {
  // Call the new loadUsers function from admin-user-fine-management.js
  if (typeof window.loadUsers === 'function') {
    window.loadUsers();
    return;
  }
  
  try {
    // Load stats first
    await loadUserManagementStats();
    
    const apiBase = window.location.hostname === 'localhost' ? 'https://localhost:5443' : `https://${window.location.hostname}:5443`;
    const res = await fetch(`${apiBase}/api/admin/users?t=${Date.now()}`, { headers: { ...authHeaders(), 'Cache-Control': 'no-store' }, cache: 'no-store' });
    if (!res.ok) {
      console.error('Failed to load users');
      return;
    }
    const users = await res.json();
    
    console.log('Users loaded:', users);
    
    // Update statistics
    const totalUsers = users.length;
    const activeUsers = users.filter(u => !u.is_admin).length;
    const adminUsers = users.filter(u => u.is_admin).length;
    
    document.getElementById('total-users') && (document.getElementById('total-users').textContent = totalUsers);
    document.getElementById('active-users') && (document.getElementById('active-users').textContent = activeUsers);
    document.getElementById('admin-users') && (document.getElementById('admin-users').textContent = adminUsers);
    
    // Get total borrowed books count
    try {
      const borrowedRes = await fetch(`${apiBase}/api/admin/all-borrowed?t=${Date.now()}`, { headers: { ...authHeaders(), 'Cache-Control': 'no-store' }, cache: 'no-store' });
      if (borrowedRes.ok) {
        const borrowed = await borrowedRes.json();
        document.getElementById('total-borrowed') && (document.getElementById('total-borrowed').textContent = borrowed.length);
      }
    } catch (err) {
      console.error('Error loading borrowed count:', err);
    }
    
    // Display users in table with NEW structure (ID, USERNAME, EMAIL, ROLE, BOOKS, ACTIONS)
    const usersTable = document.getElementById('users-table-body');
    if (usersTable) {
      usersTable.innerHTML = '';
      users.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
          <td class="px-6 py-4 text-sm text-gray-900 font-medium">${user.id}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(user.username)}</td>
          <td class="px-6 py-4 text-sm text-gray-600">${escapeHtml(user.email || 'N/A')}</td>
          <td class="px-6 py-4 text-sm">
            <span class="px-3 py-1 ${user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'} rounded-full text-xs font-medium">
              ${user.is_admin ? '👑 Admin' : '👤 User'}
            </span>
          </td>
          <td class="px-6 py-4 text-sm text-gray-900">${user.borrowed_count || 0}</td>
          <td class="px-6 py-4 text-sm space-x-2">
            <button data-user='${JSON.stringify(user)}' class="btn-view bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
              👁️ View
            </button>
            ${!user.is_admin ? `
              <button data-userid="${user.id}" data-username="${escapeHtml(user.username)}" class="btn-make-admin bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                👑 Make Admin
              </button>
              <button data-userid="${user.id}" data-username="${escapeHtml(user.username)}" class="btn-delete bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                🗑️ Delete
              </button>
            ` : `
              <button data-userid="${user.id}" data-username="${escapeHtml(user.username)}" class="btn-remove-admin bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                ⬇️ Remove Admin
              </button>
              <button data-userid="${user.id}" data-username="${escapeHtml(user.username)}" class="btn-delete bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                🗑️ Delete
              </button>
            `}
          </td>
        `;
        usersTable.appendChild(tr);
      });
      
      // Add event listeners using event delegation
      if (usersTable) {
        usersTable.addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          
          if (btn.classList.contains('btn-view')) {
            const user = JSON.parse(btn.dataset.user);
            viewUserDetails(user.id, user.username, user.email || 'N/A', user.full_name || 'N/A', 
                          user.roll_no || 'N/A', user.mobile_no || 'N/A', user.is_admin, 
                          user.borrowed_count || 0, user.user_photo || 'N/A');
          } else if (btn.classList.contains('btn-make-admin')) {
            makeUserAdmin(parseInt(btn.dataset.userid), btn.dataset.username);
          } else if (btn.classList.contains('btn-remove-admin')) {
            removeAdmin(parseInt(btn.dataset.userid), btn.dataset.username);
          } else if (btn.classList.contains('btn-delete')) {
            deleteUser(parseInt(btn.dataset.userid), btn.dataset.username);
          }
        });
      }
    }
  } catch (e) {
    console.error('Error loading users:', e);
    alert('Failed to load users data');
  }
}

// Set admin username in header
const adminUsernameEl = document.getElementById('admin-username');
if (adminUsernameEl && payload && payload.username) {
  adminUsernameEl.textContent = payload.username;
}

// --- Bulk Import Functionality ---

let parsedBooksData = [];

// Download CSV template
document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
  const template = `title,author,isbn,category,description
"The Great Gatsby","F. Scott Fitzgerald","9780743273565","Fiction","A classic American novel"
"1984","George Orwell","9780451524935","Fiction","Dystopian social science fiction"
"To Kill a Mockingbird","Harper Lee","9780061120084","Fiction","A gripping tale of racial injustice"`;
  
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'books_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
  
  alert('📄 Template downloaded! Fill it with your book data and import it.');
});

// Parse CSV file
function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const books = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    if (values.length === headers.length) {
      const book = {};
      headers.forEach((header, index) => {
        book[header.toLowerCase()] = values[index] || '';
      });
      if (book.title && book.author) {
        books.push(book);
      }
    }
  }
  
  return books;
}

// Import button click handler
document.getElementById('importBtn')?.addEventListener('click', async () => {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select a file to import');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      parsedBooksData = parseCSV(text);
      
      if (parsedBooksData.length === 0) {
        alert('No valid book data found in file. Please check the format.');
        return;
      }
      
      // Show preview
      displayImportPreview(parsedBooksData);
    } catch (error) {
      alert('Error parsing file: ' + error.message);
    }
  };
  
  reader.readAsText(file);
});

// Display import preview
function displayImportPreview(books) {
  const previewDiv = document.getElementById('importPreview');
  const contentDiv = document.getElementById('importPreviewContent');
  const countSpan = document.getElementById('importCount');
  
  countSpan.textContent = books.length;
  
  let html = '<table class="w-full text-sm"><thead class="bg-gray-100"><tr>';
  html += '<th class="px-2 py-1 text-left">Title</th>';
  html += '<th class="px-2 py-1 text-left">Author</th>';
  html += '<th class="px-2 py-1 text-left">ISBN</th>';
  html += '<th class="px-2 py-1 text-left">Category</th>';
  html += '</tr></thead><tbody>';
  
  books.forEach((book, index) => {
    html += `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">`;
    html += `<td class="px-2 py-1">${escapeHtml(book.title)}</td>`;
    html += `<td class="px-2 py-1">${escapeHtml(book.author)}</td>`;
    html += `<td class="px-2 py-1">${escapeHtml(book.isbn || 'N/A')}</td>`;
    html += `<td class="px-2 py-1">${escapeHtml(book.category || 'N/A')}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  contentDiv.innerHTML = html;
  previewDiv.classList.remove('hidden');
}

// Confirm import
document.getElementById('confirmImportBtn')?.addEventListener('click', async () => {
  if (parsedBooksData.length === 0) {
    alert('No books to import');
    return;
  }
  
  const confirmBtn = document.getElementById('confirmImportBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Importing...';
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const book of parsedBooksData) {
    try {
      const fd = new FormData();
      fd.append('title', book.title);
      fd.append('author', book.author);
      fd.append('isbn', book.isbn || '');
      fd.append('category', book.category || 'General');
      fd.append('description', book.description || '');
      
      const res = await fetch('/api/admin/books', {
        method: 'POST',
        headers: authHeaders(),
        body: fd
      });
      
      if (res.ok) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
  }
  
  confirmBtn.disabled = false;
  confirmBtn.textContent = `✅ Confirm Import (${parsedBooksData.length} books)`;
  
  alert(`Import Complete!\n✅ Success: ${successCount}\n❌ Failed: ${errorCount}`);
  
  // Reset and reload
  document.getElementById('importFile').value = '';
  document.getElementById('importPreview').classList.add('hidden');
  parsedBooksData = [];
  loadAdminBooks();
  loadDashboard();
});

// Cancel import
document.getElementById('cancelImportBtn')?.addEventListener('click', () => {
  document.getElementById('importPreview').classList.add('hidden');
  document.getElementById('importFile').value = '';
  parsedBooksData = [];
});

// ============= QR SCANNER FOR ISSUE & RETURN =============

let issueScannerInstance = null;
let returnScannerInstance = null;

// Start Issue Book Scanner
document.getElementById('start-issue-scanner')?.addEventListener('click', async () => {
  const scannerDiv = document.getElementById('issue-scanner');
  const placeholder = document.getElementById('issue-scanner-placeholder');
  const startBtn = document.getElementById('start-issue-scanner');
  const stopBtn = document.getElementById('stop-issue-scanner');
  
  try {
    scannerDiv.style.display = 'block';
    placeholder.querySelector('.text-6xl').style.display = 'none';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    
    issueScannerInstance = new Html5Qrcode("issue-scanner");
    
    await issueScannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Extract book ID from QR code
        let bookId = decodedText;
        try {
          const qrData = JSON.parse(decodedText);
          bookId = qrData.id || decodedText;
        } catch (e) {
          // Not JSON, use as is
        }
        
        // Set the book ID and trigger issue
        document.getElementById('issue-book-id').value = bookId;
        
        // Stop scanner
        stopIssueScanner();
        
        // Show success message
        showIssueStatus('QR Code scanned! Book ID: ' + bookId, 'success');
      },
      (error) => {
        // Ignore scanning errors (too noisy)
      }
    );
  } catch (err) {
    console.error('Camera error:', err);
    showIssueStatus('Camera access denied or not available. Use manual input.', 'error');
    stopIssueScanner();
  }
});

// Stop Issue Scanner
document.getElementById('stop-issue-scanner')?.addEventListener('click', () => {
  stopIssueScanner();
});

function stopIssueScanner() {
  if (issueScannerInstance) {
    issueScannerInstance.stop().then(() => {
      issueScannerInstance.clear();
      issueScannerInstance = null;
    }).catch(err => console.error('Stop error:', err));
  }
  
  document.getElementById('issue-scanner').style.display = 'none';
  document.getElementById('issue-scanner-placeholder').querySelector('.text-6xl').style.display = 'block';
  document.getElementById('start-issue-scanner').style.display = 'inline-block';
  document.getElementById('stop-issue-scanner').style.display = 'none';
}

// Start Return Book Scanner
document.getElementById('start-return-scanner')?.addEventListener('click', async () => {
  const scannerDiv = document.getElementById('return-scanner');
  const placeholder = document.getElementById('return-scanner-placeholder');
  const startBtn = document.getElementById('start-return-scanner');
  const stopBtn = document.getElementById('stop-return-scanner');
  
  try {
    scannerDiv.style.display = 'block';
    placeholder.querySelector('.text-6xl').style.display = 'none';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    
    returnScannerInstance = new Html5Qrcode("return-scanner");
    
    await returnScannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Extract book ID from QR code
        let bookId = decodedText;
        try {
          const qrData = JSON.parse(decodedText);
          bookId = qrData.id || decodedText;
        } catch (e) {
          // Not JSON, use as is
        }
        
        // Set the book ID and trigger return
        document.getElementById('return-book-id').value = bookId;
        
        // Stop scanner
        stopReturnScanner();
        
        // Show success message
        showReturnStatus('QR Code scanned! Book ID: ' + bookId, 'success');
        
        // Auto-return after 1 second
        setTimeout(() => {
          returnBookByQR();
        }, 1000);
      },
      (error) => {
        // Ignore scanning errors (too noisy)
      }
    );
  } catch (err) {
    console.error('Camera error:', err);
    showReturnStatus('Camera access denied or not available. Use manual input.', 'error');
    stopReturnScanner();
  }
});

// Stop Return Scanner
document.getElementById('stop-return-scanner')?.addEventListener('click', () => {
  stopReturnScanner();
});

function stopReturnScanner() {
  if (returnScannerInstance) {
    returnScannerInstance.stop().then(() => {
      returnScannerInstance.clear();
      returnScannerInstance = null;
    }).catch(err => console.error('Stop error:', err));
  }
  
  document.getElementById('return-scanner').style.display = 'none';
  document.getElementById('return-scanner-placeholder').querySelector('.text-6xl').style.display = 'block';
  document.getElementById('start-return-scanner').style.display = 'inline-block';
  document.getElementById('stop-return-scanner').style.display = 'none';
}

// Issue Book by QR or Manual Input
async function issueBookByQR() {
  const bookId = document.getElementById('issue-book-id').value.trim();
  const username = document.getElementById('issue-username').value.trim();
  
  if (!bookId) {
    showIssueStatus('Please enter or scan a Book ID', 'error');
    return;
  }
  
  if (!username) {
    showIssueStatus('Please enter a username', 'error');
    return;
  }
  
  try {
    showIssueStatus('Processing...', 'info');
    
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ bookId, username })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      showIssueStatus('✅ Book issued successfully to ' + username, 'success');
      // Clear inputs
      document.getElementById('issue-book-id').value = '';
      document.getElementById('issue-username').value = '';
      // Refresh borrowed list and history
      setTimeout(() => {
        loadBorrowed();
        loadStats();
        // Also refresh history if on history view
        if (historyRefreshInterval) {
          loadBorrowHistory();
        }
      }, 1000);
    } else {
      showIssueStatus('❌ ' + (data.error || 'Failed to issue book'), 'error');
    }
  } catch (error) {
    console.error('Issue error:', error);
    showIssueStatus('❌ Error: ' + error.message, 'error');
  }
}

// Return Book by QR or Manual Input
async function returnBookByQR() {
  const bookId = document.getElementById('return-book-id').value.trim();
  
  if (!bookId) {
    showReturnStatus('Please enter or scan a Book ID', 'error');
    return;
  }
  
  try {
    showReturnStatus('Processing...', 'info');
    
    const token = localStorage.getItem('token');
    
    // Find the borrow record for this book
    const borrowRes = await fetch('/api/admin/borrowed', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    const borrows = await borrowRes.json();
    const borrowRecord = borrows.find(b => b.book_id == bookId);
    
    if (!borrowRecord) {
      showReturnStatus('❌ This book is not currently borrowed', 'error');
      return;
    }
    
    // Return the book
    const res = await fetch(`/api/admin/borrowed/${borrowRecord.id}/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    });
    
    const data = await res.json();
    
    if (res.ok) {
      showReturnStatus('✅ Book returned successfully!', 'success');
      // Clear input
      document.getElementById('return-book-id').value = '';
      // Refresh borrowed list and history
      setTimeout(() => {
        loadBorrowed();
        loadStats();
        // Also refresh history if on history view
        if (historyRefreshInterval) {
          loadBorrowHistory();
        }
      }, 1000);
    } else {
      showReturnStatus('❌ ' + (data.error || 'Failed to return book'), 'error');
    }
  } catch (error) {
    console.error('Return error:', error);
    showReturnStatus('❌ Error: ' + error.message, 'error');
  }
}

// Show Issue Status Message
function showIssueStatus(message, type) {
  const statusDiv = document.getElementById('issue-status');
  statusDiv.style.display = 'block';
  statusDiv.textContent = message;
  
  statusDiv.className = 'p-4 rounded-lg text-center font-medium';
  
  if (type === 'success') {
    statusDiv.classList.add('bg-green-100', 'text-green-800', 'border-2', 'border-green-300');
  } else if (type === 'error') {
    statusDiv.classList.add('bg-red-100', 'text-red-800', 'border-2', 'border-red-300');
  } else {
    statusDiv.classList.add('bg-blue-100', 'text-blue-800', 'border-2', 'border-blue-300');
  }
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

// Show Return Status Message
function showReturnStatus(message, type) {
  const statusDiv = document.getElementById('return-status');
  statusDiv.style.display = 'block';
  statusDiv.textContent = message;
  
  statusDiv.className = 'p-4 rounded-lg text-center font-medium';
  
  if (type === 'success') {
    statusDiv.classList.add('bg-green-100', 'text-green-800', 'border-2', 'border-green-300');
  } else if (type === 'error') {
    statusDiv.classList.add('bg-red-100', 'text-red-800', 'border-2', 'border-red-300');
  } else {
    statusDiv.classList.add('bg-blue-100', 'text-blue-800', 'border-2', 'border-blue-300');
  }
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

// Cleanup scanners when leaving the view
const navItems = document.querySelectorAll('.admin-nav li[data-view]');
navItems.forEach(item => {
  item.addEventListener('click', () => {
    stopIssueScanner();
    stopReturnScanner();
    
    // Show camera status when entering Issue & Return view
    if (item.dataset.view === 'issue') {
      setTimeout(showCameraStatus, 100);
    }
  });
});

// Show Camera Status Indicator
function showCameraStatus() {
  const indicator = document.getElementById('camera-status-indicator');
  const icon = document.getElementById('camera-status-icon');
  const text = document.getElementById('camera-status-text');
  
  if (!indicator) return;
  
  const isHTTPS = window.location.protocol === 'https:';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (window.innerWidth <= 768);
  
  indicator.style.display = 'block';
  
  if (isHTTPS) {
    // HTTPS - Camera available
    indicator.className = 'mt-4 p-3 rounded-lg text-sm font-medium bg-green-100 border-2 border-green-300 text-green-800';
    icon.textContent = '✅ ';
    text.textContent = 'Camera access enabled! QR scanning is ready to use.';
  } else if (isMobile) {
    // Mobile on HTTP - Should have been redirected
    indicator.className = 'mt-4 p-3 rounded-lg text-sm font-medium bg-blue-100 border-2 border-blue-300 text-blue-800';
    icon.textContent = '📱 ';
    text.textContent = 'Mobile detected. For camera access, you\'ll be redirected to HTTPS automatically.';
  } else {
    // Desktop on HTTP - Camera should work
    indicator.className = 'mt-4 p-3 rounded-lg text-sm font-medium bg-blue-100 border-2 border-blue-300 text-blue-800';
    icon.textContent = '💻 ';
    text.textContent = 'Camera available. Click "Start QR Scanner" to begin. Manual entry also available.';
  }
}

// Check camera status when page loads if on Issue & Return view
setTimeout(() => {
  const issueView = document.getElementById('view-issue');
  if (issueView && issueView.style.display !== 'none') {
    showCameraStatus();
  }
}, 1000);

// ==================== TRANSACTION HISTORY ====================

async function loadBorrowHistory() {
  console.log('loadBorrowHistory called');
  console.log('API_BASE:', API_BASE);
  console.log('Auth headers:', authHeaders());
  
  try {
    const url = `${API_BASE}/api/admin/borrow-history`;
    console.log('Fetching from:', url);
    
    const response = await fetch(url, {
      headers: authHeaders()
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error('Failed to load history: ' + response.status);
    }
    
    const history = await response.json();
    console.log('Borrow history loaded:', history);
    console.log('Number of records:', history.length);
    
    // Apply filter
    const filter = document.getElementById('historyFilter')?.value || 'all';
    let filtered = history;
    
    if (filter === 'borrowed') {
      filtered = history.filter(h => h.status === 'borrowed');
    } else if (filter === 'returned') {
      filtered = history.filter(h => h.status === 'returned');
    } else if (filter === 'overdue') {
      filtered = history.filter(h => h.is_overdue === 1);
    }
    
    renderBorrowHistory(filtered);
  } catch (error) {
    console.error('Error loading borrow history:', error);
    document.getElementById('history-table-body').innerHTML = `
      <tr><td colspan="10" class="text-center py-4 text-red-500">Error loading history</td></tr>
    `;
  }
}

function renderBorrowHistory(history) {
  console.log('renderBorrowHistory called with', history.length, 'records');
  const tbody = document.getElementById('history-table-body');
  
  if (!tbody) {
    console.error('history-table-body element not found!');
    return;
  }
  
  if (!history || history.length === 0) {
    console.log('No history records to display');
    tbody.innerHTML = `
      <tr><td colspan="8" class="text-center py-4 text-gray-500">No transactions found</td></tr>
    `;
    return;
  }
  
  tbody.innerHTML = history.map(h => {
    console.log('Rendering record:', h.id, h.book_title, 'Status:', h.status, 'Return date:', h.return_date);
    
    const issueDate = h.issue_date ? new Date(h.issue_date).toLocaleString() : '-';
    const returnDate = h.return_date ? new Date(h.return_date).toLocaleString() : null;
    
    // Determine if this is an ISSUE or RETURN record
    const isReturnRecord = returnDate !== null;
    const displayDate = isReturnRecord ? returnDate : issueDate;
    
    const actionBadge = isReturnRecord ? 
      '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">📥 RETURN</span>' :
      '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">📤 ISSUE</span>';
    
    let statusBadge = '';
    if (h.status === 'borrowed') {
      if (h.is_overdue) {
        statusBadge = '<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">OVERDUE</span>';
      } else {
        statusBadge = '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">ACTIVE</span>';
      }
    } else {
      statusBadge = '<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-semibold">RETURNED</span>';
    }
    
    const fine = h.calculated_fine || 0;
    const fineDisplay = fine > 0 ? 
      `<span class="text-red-600 font-semibold">₹${fine}</span>` : 
      '<span class="text-gray-400">₹0</span>';
    
    const adminName = h.returned_to || h.issued_by || '-';
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="text-center"><span class="font-mono font-semibold text-blue-600">${h.book_id || 'N/A'}</span></td>
        <td>
          <div class="font-semibold">${escapeHtml(h.book_title || 'N/A')}</div>
          <div class="text-xs text-gray-500">${escapeHtml(h.book_author || '')}</div>
        </td>
        <td>${escapeHtml(h.username || 'N/A')}</td>
        <td class="text-sm">${displayDate}</td>
        <td class="text-center">${actionBadge}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center">${fineDisplay}</td>
        <td class="text-sm text-gray-600">${escapeHtml(adminName)}</td>
      </tr>
    `;
  }).join('');
}

// Add filter change listener
document.getElementById('historyFilter')?.addEventListener('change', loadBorrowHistory);

// Auto-refresh interval for transaction history
let historyRefreshInterval = null;

// Load history when view is shown
document.querySelector('[data-view="history"]')?.addEventListener('click', () => {
  console.log('Transaction History view opened');
  loadBorrowHistory();
  
  // Start auto-refresh every 5 seconds
  if (historyRefreshInterval) {
    clearInterval(historyRefreshInterval);
  }
  historyRefreshInterval = setInterval(() => {
    console.log('Auto-refreshing transaction history...');
    loadBorrowHistory();
  }, 5000); // Refresh every 5 seconds
});

// Stop auto-refresh when leaving the history view
document.querySelectorAll('.admin-nav li[data-view]').forEach(item => {
  item.addEventListener('click', (e) => {
    const view = e.currentTarget.dataset.view;
    if (view !== 'history' && historyRefreshInterval) {
      console.log('Stopping transaction history auto-refresh');
      clearInterval(historyRefreshInterval);
      historyRefreshInterval = null;
    }
    // Start notifications refresh when entering notifications view
    if (view === 'notifications') {
      loadNotifications();
      startNotificationsRefresh();
    } else if (notificationsRefreshInterval) {
      stopNotificationsRefresh();
    }
  });
});

// ============= NOTIFICATIONS SYSTEM =============

let notificationsRefreshInterval = null;

// Load notifications
async function loadNotifications() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications`, {
      headers: authHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to load notifications');
    }
    
    const notifications = await response.json();
    renderNotifications(notifications);
    updateNotificationBadge(notifications.length);
  } catch (error) {
    console.error('Error loading notifications:', error);
    showNotificationsError('Failed to load notifications');
  }
}

// Render notifications
function renderNotifications(notifications) {
  const container = document.getElementById('notifications-container');
  
  if (!container) return;
  
  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-md p-8 text-center">
        <div class="text-6xl mb-4">✅</div>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">All Caught Up!</h3>
        <p class="text-gray-500">No pending notifications at the moment.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = notifications.map(notif => {
    const isReturn = notif.type === 'return_request';
    const isRenew = notif.type === 'renew_request';
    const isBorrow = notif.type === 'borrow_request';
    const icon = isBorrow ? '📚' : (isReturn ? '📤' : '🔄');
    const title = isBorrow ? 'Borrow Request' : (isReturn ? 'Return Request' : 'Renewal Request');
    const bgColor = isBorrow ? 'bg-purple-50 border-purple-200' : (isReturn ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200');
    
    return `
      <div class="notification-card ${bgColor} border-2 rounded-xl p-6 shadow-md">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="text-3xl">${icon}</span>
            <div>
              <h4 class="text-lg font-bold text-gray-800">${title}</h4>
              <p class="text-sm text-gray-600">${formatNotificationDate(notif.created_at)}</p>
            </div>
          </div>
        </div>
        
        <div class="mb-4 space-y-2">
          <p class="text-gray-700"><strong>User:</strong> ${escapeHtml(notif.username)}</p>
          <p class="text-gray-700"><strong>Book:</strong> ${escapeHtml(notif.book_title)}</p>
          <p class="text-gray-600 italic">${escapeHtml(notif.message)}</p>
        </div>
        
        <div class="flex gap-3">
          ${isBorrow ? `
            <button onclick="approveBorrow(${notif.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              ✅ Approve Borrow
            </button>
          ` : (isReturn ? `
            <button onclick="approveReturn(${notif.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              ✅ Approve Return
            </button>
          ` : `
            <button onclick="approveRenewal(${notif.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              ✅ Approve Renewal
            </button>
          `)}
          <button onclick="rejectNotification(${notif.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            ❌ Reject
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Update notification badge
function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// Refresh key admin panels after notification actions
function refreshAdminData() {
  loadNotifications();
  if (typeof loadBorrowed === 'function') loadBorrowed();
  if (typeof loadBorrowHistory === 'function') loadBorrowHistory();
  if (typeof loadStats === 'function') loadStats();
  if (typeof loadUserManagementStats === 'function') loadUserManagementStats();
  if (typeof loadDashboard === 'function') loadDashboard();
}

// Approve borrow
async function approveBorrow(notificationId) {
  if (!confirm('Approve this borrow request? The book will be issued to the user.')) return;
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}/approve-borrow`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve borrow');
    }
    const data = await response.json();
    alert('✅ ' + data.message);
    refreshAdminData();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Approve return
async function approveReturn(notificationId) {
  if (!confirm('Approve this return request? The book will be returned and made available.')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}/approve-return`, {
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve return');
    }
    
    const data = await response.json();
    alert(`✅ Return approved successfully!${data.fine > 0 ? `\nFine: ₹${data.fine}` : ''}`);
    refreshAdminData();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Approve renewal
async function approveRenewal(notificationId) {
  if (!confirm('Approve this renewal request? The due date will be extended by 14 days.')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}/approve-renew`, {
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve renewal');
    }
    
    const data = await response.json();
    alert('✅ ' + data.message);
    refreshAdminData();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Reject notification
async function rejectNotification(notificationId) {
  if (!confirm('Reject this request?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}/reject`, {
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject request');
    }
    
    const data = await response.json();
    alert('✅ ' + data.message);
    refreshAdminData();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Show notifications error
function showNotificationsError(message) {
  const container = document.getElementById('notifications-container');
  if (container) {
    container.innerHTML = `
      <div class="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
        <div class="text-6xl mb-4">⚠️</div>
        <h3 class="text-xl font-semibold text-red-700 mb-2">Error</h3>
        <p class="text-red-600">${escapeHtml(message)}</p>
        <button onclick="loadNotifications()" class="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
          Try Again
        </button>
      </div>
    `;
  }
}

// Format notification date
function formatNotificationDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Start notifications auto-refresh
function startNotificationsRefresh() {
  if (notificationsRefreshInterval) {
    clearInterval(notificationsRefreshInterval);
  }
  notificationsRefreshInterval = setInterval(loadNotifications, 5000); // Refresh every 5 seconds
  console.log('✅ Notifications auto-refresh started (5s interval)');
}

// Stop notifications auto-refresh
function stopNotificationsRefresh() {
  if (notificationsRefreshInterval) {
    clearInterval(notificationsRefreshInterval);
    notificationsRefreshInterval = null;
    console.log('⏹️ Notifications auto-refresh stopped');
  }
}

// Load notification count on page load and update badge periodically
async function updateNotificationCount() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/count`, {
      headers: authHeaders()
    });
    
    if (response.ok) {
      const data = await response.json();
      updateNotificationBadge(data.count);
    }
  } catch (error) {
    console.error('Error updating notification count:', error);
  }
}

// Update notification count every 10 seconds
setInterval(updateNotificationCount, 10000);
updateNotificationCount(); // Initial load
