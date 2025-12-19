// script.js
// Always use HTTPS for both mobile and desktop (required for camera access)
function getAPIBase() {
  const hostname = window.location.hostname;
  const currentPort = window.location.port;
  
  // If already on a backend port, use relative URLs
  if (currentPort === '5443' || currentPort === '5000') {
    return '';
  }
  
  // Always use HTTPS port 5443 for camera features
  // For localhost (desktop)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://localhost:5443';
  }
  
  // If hostname is an IP (LAN usage), use HTTPS backend port 5443
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (isIPv4) {
    // Mobile users need to accept certificate warning once
    return `https://${hostname}:5443`;
  }

  // Hosted deployments (Netlify/custom domain):
  // Frontend should call relative /api/* and rely on a reverse-proxy/redirect to the backend.
  return '';
}

const API_BASE = getAPIBase();
const API_ORIGIN = API_BASE; // convenience alias

// Helper to generate upload URLs that always hit the backend origin
const UPLOAD = (name) => `${API_ORIGIN}/uploads/${name}`;

// Expose to other scripts (some scripts read window.API_BASE)
window.API_BASE = API_BASE;
window.API_ORIGIN = API_ORIGIN;
window.UPLOAD = UPLOAD;

const categoryImages = {
  "Science": UPLOAD('science.jpg'),
  "Technology": UPLOAD('technology.jpg'),
  "Engineering": UPLOAD('engineering.jpg'),
  "Mathematics": UPLOAD('math.jpg'),
  "History": UPLOAD('history.jpg'),
  "Literature": UPLOAD('literature.jpg')
};

const authContainer = document.getElementById('auth-container');
const searchInput = document.getElementById('searchInput');
const searchField = document.getElementById('searchField');
const searchButton = document.getElementById('searchButton');
const categoriesWrapper = document.getElementById('categoriesWrapper');
const arrowLeft = document.getElementById('arrow-left');
const arrowRight = document.getElementById('arrow-right');
const booksGrid = document.getElementById('books-grid');
const booksTitle = document.getElementById('books-title');
const booksGridUnavail = document.getElementById('books-grid-unavail');
const booksTitleUnavail = document.getElementById('books-title-unavail');
const authModal = document.getElementById('authModal');

// Category carousel variables
let categories = [];
let scrollPos = 0;
let autoScrollInterval = null;

// --- JWT helpers to derive current user/admin from token ---
function decodeJwtPayload(token){
  try { return JSON.parse(atob(token.split('.')[1])); } catch(e){ return null; }
}
function getCurrentUser(){
  const token = localStorage.getItem('token');
  if (!token) return null;
  const p = decodeJwtPayload(token);
  return p ? { username: p.username, isAdmin: !!p.isAdmin } : null;
}

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function apiFetch(path, opts={}) {
  const DEBUG = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (DEBUG) console.log('apiFetch called with:', path, opts);
  opts.headers = { ...(opts.headers||{}), ...authHeader() };
  if (opts.body && !(opts.body instanceof FormData)) opts.headers['Content-Type'] = 'application/json';
  if (DEBUG) console.log('Making request to:', API_BASE + path, 'with headers:', opts.headers);
  const res = await fetch(API_BASE + path, opts);
  if (DEBUG) console.log('Response status:', res.status, 'ok:', res.ok);
  if (!res.ok) {
    let txt = await res.text();
    if (DEBUG) console.log('Error response text:', txt);

    // If we got HTML (common when frontend is deployed but backend API isn't), show a clean error.
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const looksHtml = ct.includes('text/html') || /^\s*</.test(txt);
    if (looksHtml && path.startsWith('/api/')) {
      throw new Error(
        'Backend API is not reachable. If you deployed only the frontend (Netlify), you must deploy the backend and proxy /api/* to it.'
      );
    }

    try { const j = JSON.parse(txt); txt = j.error || j.message || txt; } catch(e){}
    throw new Error(txt || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  const json = await res.json();
  if (DEBUG) console.log('Response JSON:', json);
  return json;
}

// Removed duplicate getCurrentUser function - using the JWT version above

function updateHeader() {
  const user = getCurrentUser();
  const body = document.body;
  
  // Remove existing role classes
  body.classList.remove('admin-mode', 'user-mode', 'admin-view', 'user-view');
  
  if (user) {
    // Add role-based CSS classes to body
    if (user.isAdmin) {
      body.classList.add('admin-mode', 'admin-view');
    } else {
      body.classList.add('user-mode', 'user-view');
    }
    
    const roleBadge = user.isAdmin ? 
      '<span class="role-badge admin">Admin</span>' : 
      '<span class="role-badge user">User</span>';
    
    authContainer.innerHTML = `
      <span style="margin-right:10px;color:#fff">Welcome, ${user.username}! ${roleBadge}</span>
      ${user.isAdmin ? '' : '<button onclick="showMyBooks()" class="primary user-context">My Books</button>'}
      ${user.isAdmin ? `<button id="openAdminBtn" class="primary admin-context">🛠️ Admin Panel</button>` : ''}
      ${user.isAdmin ? `<button id="openGateScannerBtn" class="primary admin-context">🚪 Gate Scanner</button>` : ''}
      <button onclick="logout()" class="primary">Logout</button>`;
      
    if (user.isAdmin) {
      document.getElementById('openAdminBtn')?.addEventListener('click', () => {
        const dest = API_BASE ? `${API_BASE}/admin.html` : '/admin.html';
        window.location.href = dest;
      });
      
      document.getElementById('openGateScannerBtn')?.addEventListener('click', () => {
        openGateScanner();
      });
    }
  } else {
    // Remove role classes for non-logged in users
    body.classList.remove('admin-mode', 'user-mode', 'admin-view', 'user-view');
    
    authContainer.innerHTML = `
      <button id="loginBtn" onclick="openAuthModal('login')" class="primary">Login</button>
      <button id="signupBtn" onclick="openAuthModal('signup')" class="primary">Sign Up</button>`;
      
    setTimeout(() => {
      document.getElementById('loginBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); openAuthModal('login'); });
      document.getElementById('signupBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); openAuthModal('signup'); });
    }, 100);
  }
}

async function loadCategories() {
  try {
    const cats = await apiFetch('/api/categories');
    categories = (cats && cats.length) ? cats : ['Engineering','History','Literature','Mathematics','Science','Technology'];
  } catch (e) {
    categories = ['Engineering','History','Literature','Mathematics','Science','Technology'];
  }
  renderCategories();
}

function renderCategories() {
  categoriesWrapper.innerHTML = '';
  const list = [...categories, ...categories]; // loop copy for visual infinite feel
  list.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'category-card';
    const img = categoryImages[cat] || UPLOAD('default.jpg');
    el.innerHTML = `<img src="${img}" alt="${cat}" onerror="this.src='${UPLOAD('default.jpg')}'"/><h2>${cat}</h2>`;
    el.onclick = () => loadBooks({ category: cat, title: `Category: ${cat}` });
    categoriesWrapper.appendChild(el);
  });
  startAutoScroll();
}

function startAutoScroll(){ stopAutoScroll(); autoScrollInterval = setInterval(()=>{ const maxScroll = categoriesWrapper.scrollWidth / 2; scrollPos += 1; if (categoriesWrapper.scrollWidth > 0 && scrollPos >= maxScroll) scrollPos = 0; categoriesWrapper.style.transform = `translateX(${-scrollPos}px)`; }, 25); }
function stopAutoScroll(){ clearInterval(autoScrollInterval); }
if (arrowLeft) arrowLeft.addEventListener('click', ()=> { stopAutoScroll(); scrollPos = Math.max(0, scrollPos-260); categoriesWrapper.style.transform = `translateX(${-scrollPos}px)`; startAutoScroll(); });
if (arrowRight) arrowRight.addEventListener('click', ()=> { stopAutoScroll(); const maxScroll = categoriesWrapper.scrollWidth / 2; scrollPos += 260; if (scrollPos >= maxScroll) scrollPos = scrollPos % maxScroll; categoriesWrapper.style.transform = `translateX(${-scrollPos}px)`; startAutoScroll(); });

// Debounce function to improve performance
let loadBooksTimeout = null;

async function loadBooks({ category=null, search=null, title=null } = {}) {
  // Clear any existing timeout
  if (loadBooksTimeout) {
    clearTimeout(loadBooksTimeout);
  }
  
  // Debounce the actual loading
  loadBooksTimeout = setTimeout(async () => {
    stopAutoScroll();
    
    // Show loading state
    booksGrid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading books…</p></div>';
    booksTitle.textContent = title || (category ? `Category: ${category}` : (search ? `Search: ${search}` : 'Available Books'));
    
    try {
      let qs = [];
      if (category) qs.push(`category=${encodeURIComponent(category)}`);
      if (search) qs.push(`q=${encodeURIComponent(search)}`);
      const path = '/api/books' + (qs.length ? `?${qs.join('&')}` : '');
      
      console.log('Loading books from:', path);
      const books = await apiFetch(path);
      console.log('Loaded books:', books.length);
      
      renderBooks(books);
    } catch (e) {
      console.error('Error loading books:', e);
      const msg = (e && e.message) ? e.message : 'Failed to load books';
      const isBackendMissing = /Backend API is not reachable/i.test(msg);
      if (isBackendMissing) {
        booksGrid.innerHTML =
          `<div class="error-message" style="max-width:720px;margin:0 auto;padding:16px;border-radius:12px;background:#fee2e2;color:#7f1d1d;">
            <div style="font-weight:700;margin-bottom:6px;">❌ Backend not connected</div>
            <div style="margin-bottom:10px;">You deployed the frontend on Netlify, but the backend API is not deployed/linked yet.</div>
            <div style="font-size:14px;line-height:1.4;">
              <div style="margin-bottom:6px;"><b>Fix:</b> Deploy the backend (Node/Express) on Render/Railway, then proxy <code>/api/*</code> and <code>/uploads/*</code> to it (or set an API base override).</div>
              <div><b>Backend start:</b> <code>backend/server.js</code> (uses <code>PORT</code> env)</div>
            </div>
          </div>`;
      } else {
        booksGrid.innerHTML = `<p class="error-message">❌ Error: ${escapeHtml(msg)}</p>`;
      }
    }
  }, 100); // 100ms debounce
}

function renderBooks(books) {
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  const fragmentUnavail = document.createDocumentFragment();
  
  booksGrid.innerHTML = '';
  if (booksGridUnavail) booksGridUnavail.innerHTML = '';
  if (booksTitleUnavail) { booksTitleUnavail.style.display = 'none'; }
  if (booksGridUnavail) { booksGridUnavail.style.display = 'none'; }
  
  if (!books || books.length === 0) { 
    booksGrid.innerHTML = '<p class="no-results-message">❌ No books found.</p>'; 
    return; 
  }

  const available = [];
  const unavailable = [];
  books.forEach(b => { (b.available ? available : unavailable).push(b); });

  const renderInto = (arr, targetFragment) => {
    // Get user info once outside the loop to avoid redeclaration errors
    const currentUser = getCurrentUser();
    const isAdmin = currentUser && currentUser.isAdmin;
    
    arr.forEach(b => {
      const img = (b.image && (b.image.startsWith('http') ? b.image : `${API_ORIGIN}${b.image}`)) || UPLOAD('default.jpg');
      const card = document.createElement('div');
      
      let cardClasses = 'book-card';
      if (!b.available) cardClasses += ' unavailable';
      if (isAdmin) cardClasses += ' admin-view';
      
      card.className = cardClasses;
      
      // Create elements instead of innerHTML for better performance
      const bookLeft = document.createElement('div');
      bookLeft.className = 'book-left';
      
      const imgEl = document.createElement('img');
      imgEl.src = img;
      imgEl.alt = escapeHtml(b.title);
      imgEl.onerror = () => imgEl.src = UPLOAD('default.jpg');
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'book-actions';
      
      const detailsBtn = document.createElement('button');
      detailsBtn.className = 'primary';
      detailsBtn.textContent = 'Details';
      detailsBtn.onclick = () => openDetails(b.id);
      
      const qrBtn = document.createElement('button');
      qrBtn.className = 'primary';
      qrBtn.textContent = '📱 QR Code';
      qrBtn.onclick = () => openQRCodeModal(b.id);
      
      // Check if current user is admin - admins should not see borrow buttons
      if (!isAdmin) {
        const borrowBtn = document.createElement('button');
        borrowBtn.className = 'primary';
        borrowBtn.textContent = b.available ? 'Borrow Request' : 'Unavailable';
        borrowBtn.disabled = !b.available;
        if (b.available) {
          borrowBtn.onclick = () => attemptBorrow(b.id);
        }
        actionsDiv.appendChild(borrowBtn);
      }
      
      actionsDiv.appendChild(detailsBtn);
      actionsDiv.appendChild(qrBtn);
      // borrowBtn is only added if user is not admin (see above)
      bookLeft.appendChild(imgEl);
      bookLeft.appendChild(actionsDiv);
      
      const bookBody = document.createElement('div');
      bookBody.className = 'book-body';
      bookBody.innerHTML = `
        <h3>${escapeHtml(b.title)}</h3>
        <p class="author">${escapeHtml(b.author || '')}</p>
        <p class="category">${escapeHtml(b.category || '')}</p>
        <p class="desc">${escapeHtml(b.description || '')}</p>
      `;
      
      card.appendChild(bookLeft);
      card.appendChild(bookBody);
      targetFragment.appendChild(card);
    });
  };

  renderInto(available, fragment);
  booksGrid.appendChild(fragment);
  
  if (unavailable.length && booksGridUnavail && booksTitleUnavail) {
    renderInto(unavailable, fragmentUnavail);
    booksTitleUnavail.style.display = '';
    booksGridUnavail.style.display = '';
    booksGridUnavail.appendChild(fragmentUnavail);
  }
}

// Enhanced book rendering with metadata
function renderEnhancedBooks(books) {
  booksGrid.innerHTML = '';
  if (booksGridUnavail) booksGridUnavail.innerHTML = '';
  if (booksTitleUnavail) booksTitleUnavail.style.display = 'none';
  if (booksGridUnavail) booksGridUnavail.style.display = 'none';
  
  if (!books || books.length === 0) {
    booksGrid.innerHTML = '<p class="text-center py-8 text-gray-600">No books found matching your search criteria.</p>';
    return;
  }
  
  const available = [];
  const unavailable = [];
  books.forEach(b => (b.available ? available : unavailable).push(b));
  
  const renderInto = (arr, targetGrid) => {
    arr.forEach(b => {
      const img = (b.image && (b.image.startsWith('http') ? b.image : `${API_ORIGIN}${b.image}`)) || UPLOAD('default.jpg');
      const card = document.createElement('div');
      card.className = 'book-card enhanced' + (b.available ? '' : ' unavailable');
      
      // Enhanced metadata display
      const metadata = [];
      if (b.publisher) metadata.push(`Publisher: ${b.publisher}`);
      if (b.year) metadata.push(`Year: ${b.year}`);
      if (b.isbn) metadata.push(`ISBN: ${b.isbn}`);
      
      card.innerHTML = `
        <div class="book-left">
          <img src="${img}" alt="${escapeHtml(b.title)}" onerror="this.src='${UPLOAD('default.jpg')}'" />
          <div class="book-actions">
            <button class="primary" onclick="openEnhancedDetails(${b.id})">📖 Details</button>
            <button class="primary" onclick="openQRCodeModal(${b.id})">📱 QR Code</button>
            <button class="primary" ${b.available ? '' : 'disabled'} onclick="attemptBorrow(${b.id})">
              ${b.available ? '📚 Borrow Request' : '❌ Unavailable'}
            </button>
          </div>
        </div>
        <div class="book-body">
          <h3 class="font-bold text-lg mb-2">${escapeHtml(b.title)}</h3>
          <p class="author text-blue-600 font-medium mb-1">👤 ${escapeHtml(b.author || 'Unknown Author')}</p>
          <p class="category text-green-600 text-sm mb-2">🏷️ ${escapeHtml(b.category || 'Uncategorized')}</p>
          ${metadata.length ? `<div class="metadata text-xs text-gray-600 mb-2">${metadata.join(' • ')}</div>` : ''}
          ${b.abstract ? `<p class="abstract text-sm text-gray-700 mb-2 line-clamp-3">📄 ${escapeHtml(b.abstract.substring(0, 150))}${b.abstract.length > 150 ? '...' : ''}</p>` : ''}
          ${b.description ? `<p class="desc text-sm text-gray-600 line-clamp-2">${escapeHtml(b.description)}</p>` : ''}
        </div>
      `;
      targetGrid.appendChild(card);
    });
  };
  
  renderInto(available, booksGrid);
  if (unavailable.length && booksGridUnavail && booksTitleUnavail) {
    booksTitleUnavail.style.display = '';
    booksGridUnavail.style.display = '';
    renderInto(unavailable, booksGridUnavail);
  }
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Function to detect if user is on a mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
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

// Comprehensive book details modal functions
function openDetails(id) {
  showBookDetailsModal(id);
}

function openEnhancedDetails(id) {
  showBookDetailsModal(id);
}

function showBookDetailsModal(id) {
  console.log('Opening book details for ID:', id);
  
  // Show loading state
  const modal = document.getElementById('bookDetailsModal');
  const title = document.getElementById('bookDetailsTitle');
  title.textContent = 'Loading...';
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  
  // Add keyboard event listener
  document.addEventListener('keydown', handleGlobalKeydown);
  
  // Fetch book details
  apiFetch(`/api/books`)
    .then(books => {
      const book = books.find(b => b.id == id);
      if (book) {
        populateBookDetailsModal(book);
      } else {
        title.textContent = 'Book not found';
        console.error('Book not found for ID:', id);
      }
    })
    .catch(e => {
      title.textContent = 'Error loading book details';
      console.error('Error loading book details:', e);
    });
}

function populateBookDetailsModal(book) {
  console.log('Populating modal with book:', book);
  
  // Basic information
  document.getElementById('bookDetailsTitle').textContent = book.title || 'Unknown Title';
  document.getElementById('bookDetailsAuthor').textContent = book.author || 'Unknown Author';
  document.getElementById('bookDetailsCategory').textContent = book.category || 'Uncategorized';
  document.getElementById('bookDetailsID').textContent = book.id || 'N/A';
  document.getElementById('bookDetailsISBN').textContent = book.isbn || 'Not available';
  document.getElementById('bookDetailsPublisher').textContent = book.publisher || 'Not available';
  document.getElementById('bookDetailsYear').textContent = book.year || 'Not available';
  document.getElementById('bookDetailsDescription').textContent = book.description || 'No description available.';
  
  // Status
  const statusElement = document.getElementById('bookDetailsStatus');
  if (book.available) {
    statusElement.textContent = '✅ Available';
    statusElement.className = 'font-medium text-green-600';
  } else {
    statusElement.textContent = '❌ Not Available';
    statusElement.className = 'font-medium text-red-600';
  }
  
  // Book cover
  const coverElement = document.getElementById('bookDetailsCover');
  const imgSrc = (book.image && (book.image.startsWith('http') ? book.image : `${API_ORIGIN}${book.image}`)) || UPLOAD('default.jpg');
  coverElement.src = imgSrc;
  coverElement.onerror = () => coverElement.src = UPLOAD('default.jpg');
  
  // Borrow button - hide for admin users
  const borrowBtn = document.getElementById('bookDetailsBorrowBtn');
  const currentUser = getCurrentUser();
  const isAdmin = currentUser && currentUser.isAdmin;
  
  if (isAdmin) {
    // Hide borrow button for admin users
    borrowBtn.style.display = 'none';
  } else {
    borrowBtn.style.display = 'block';
    if (book.available) {
      borrowBtn.textContent = '📚 Borrow Request';
      borrowBtn.className = 'w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium transition-colors';
      borrowBtn.disabled = false;
      borrowBtn.onclick = () => {
        closeBookDetailsModal();
        attemptBorrow(book.id);
      };
    } else {
      borrowBtn.textContent = '❌ Not Available';
      borrowBtn.className = 'w-full bg-gray-400 text-white px-4 py-2 rounded-md font-medium cursor-not-allowed';
      borrowBtn.disabled = true;
      borrowBtn.onclick = null;
    }
  }
  
  // Abstract section
  const abstractSection = document.getElementById('bookDetailsAbstractSection');
  const abstractElement = document.getElementById('bookDetailsAbstract');
  if (book.abstract && book.abstract.trim()) {
    abstractElement.textContent = book.abstract;
    abstractSection.classList.remove('hidden');
  } else {
    abstractSection.classList.add('hidden');
  }
  
  // Table of Contents section
  const tocSection = document.getElementById('bookDetailsTOCSection');
  const tocElement = document.getElementById('bookDetailsTOC');
  if (book.toc && book.toc.trim()) {
    tocElement.textContent = book.toc;
    tocSection.classList.remove('hidden');
  } else {
    tocSection.classList.add('hidden');
  }
  
  // Subjects section
  const subjectsSection = document.getElementById('bookDetailsSubjectsSection');
  const subjectsElement = document.getElementById('bookDetailsSubjects');
  if (book.subjects && book.subjects.trim()) {
    // Parse subjects (assuming comma-separated)
    const subjects = book.subjects.split(',').map(s => s.trim()).filter(s => s);
    subjectsElement.innerHTML = subjects.map(subject => 
      `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">${escapeHtml(subject)}</span>`
    ).join('');
    subjectsSection.classList.remove('hidden');
  } else {
    subjectsSection.classList.add('hidden');
  }
}

function closeBookDetailsModal() {
  const modal = document.getElementById('bookDetailsModal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
  
  // Remove event listeners
  document.removeEventListener('keydown', handleGlobalKeydown);
}

// Comprehensive keyboard support for all modals
function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    // Close any open modal
    const bookDetailsModal = document.getElementById('bookDetailsModal');
    const advModal = document.getElementById('advModal');
    const authModal = document.getElementById('authModal');
    const saveSearchModal = document.getElementById('saveSearchModal');
    const loadSearchModal = document.getElementById('loadSearchModal');
    
    if (bookDetailsModal && !bookDetailsModal.classList.contains('hidden')) {
      closeBookDetailsModal();
    } else if (advModal && !advModal.classList.contains('hidden')) {
      closeAdvModal();
    } else if (authModal && !authModal.classList.contains('hidden')) {
      closeAuthModal();
    } else if (saveSearchModal && !saveSearchModal.classList.contains('hidden')) {
      closeSaveSearchModal();
    } else if (loadSearchModal && !loadSearchModal.classList.contains('hidden')) {
      closeLoadSearchModal();
    }
  }
}

// Legacy function for backward compatibility
function handleBookDetailsKeydown(e) {
  handleGlobalKeydown(e);
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Clear all forms on page load
  clearAllForms();
  
  // Initialize search suggestions system
  initializeSearchSuggestions();
  
  // Click outside to close modals
  const bookDetailsModal = document.getElementById('bookDetailsModal');
  if (bookDetailsModal) {
    bookDetailsModal.addEventListener('click', function(e) {
      if (e.target === bookDetailsModal) {
        closeBookDetailsModal();
      }
    });
  }
  
  // Click outside to close advanced search modal
  const advModal = document.getElementById('advModal');
  if (advModal) {
    advModal.addEventListener('click', function(e) {
      if (e.target === advModal) {
        closeAdvModal();
      }
    });
  }
  
  // Click outside to close save search modal
  const saveSearchModal = document.getElementById('saveSearchModal');
  if (saveSearchModal) {
    saveSearchModal.addEventListener('click', function(e) {
      if (e.target === saveSearchModal) {
        closeSaveSearchModal();
      }
    });
  }
  
  // Click outside to close load search modal
  const loadSearchModal = document.getElementById('loadSearchModal');
  if (loadSearchModal) {
    loadSearchModal.addEventListener('click', function(e) {
      if (e.target === loadSearchModal) {
        closeLoadSearchModal();
      }
    });
  }
});

// Clear all forms function
function clearAllForms() {
  // Clear main search
  const searchInput = document.getElementById('searchInput');
  const searchField = document.getElementById('searchField');
  if (searchInput) searchInput.value = '';
  if (searchField) searchField.value = 'all';
  
  // Clear auth forms
  clearAuthForms();
  
  // Clear advanced search form
  clearAdvancedSearchForm();
  
  // Clear save search form
  clearSaveSearchForm();
  
  // Hide search suggestions
  hideSuggestions();
}

// Search Suggestions System
let suggestionsCache = [];
let currentSuggestionIndex = -1;
let suggestionTimeout = null;

// Initialize search suggestions
function initializeSearchSuggestions() {
  const searchInput = document.getElementById('searchInput');
  const suggestionsContainer = document.getElementById('searchSuggestions');
  
  if (!searchInput || !suggestionsContainer) return;
  
  // Load initial suggestions cache
  loadSuggestionsCache();
  
  // Input event listener for real-time suggestions
  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }
    
    if (query.length >= 2) {
      // Debounce the search to avoid too many requests
      suggestionTimeout = setTimeout(() => {
        showSuggestions(query);
      }, 300);
    } else {
      hideSuggestions();
    }
  });
  
  // Keyboard navigation
  searchInput.addEventListener('keydown', function(e) {
    const suggestions = document.querySelectorAll('.suggestion-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, suggestions.length - 1);
      highlightSuggestion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
      highlightSuggestion();
    } else if (e.key === 'Enter') {
      if (currentSuggestionIndex >= 0 && suggestions[currentSuggestionIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[currentSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      hideSuggestions();
    }
  });
}

// Load suggestions cache from books data
async function loadSuggestionsCache() {
  try {
    const books = await apiFetch('/api/books');
    suggestionsCache = extractSuggestionsFromBooks(books);
    console.log('Loaded', suggestionsCache.length, 'suggestions from', books.length, 'books');
  } catch (error) {
    console.error('Failed to load suggestions cache:', error);
    suggestionsCache = [];
  }
}

// Extract various types of suggestions from books data
function extractSuggestionsFromBooks(books) {
  const suggestions = [];
  const seen = new Set();
  
  books.forEach(book => {
    // Add title suggestions
    if (book.title && !seen.has(book.title.toLowerCase())) {
      suggestions.push({
        text: book.title,
        type: 'title',
        field: 'title',
        book: book
      });
      seen.add(book.title.toLowerCase());
    }
    
    // Add author suggestions
    if (book.author && !seen.has(book.author.toLowerCase())) {
      suggestions.push({
        text: book.author,
        type: 'author',
        field: 'author',
        book: book
      });
      seen.add(book.author.toLowerCase());
    }
    
    // Add category suggestions
    if (book.category && !seen.has(book.category.toLowerCase())) {
      suggestions.push({
        text: book.category,
        type: 'category',
        field: 'category',
        book: book
      });
      seen.add(book.category.toLowerCase());
    }
    
    // Add ISBN suggestions
    if (book.isbn && !seen.has(book.isbn.toLowerCase())) {
      suggestions.push({
        text: book.isbn,
        type: 'isbn',
        field: 'isbn',
        book: book
      });
      seen.add(book.isbn.toLowerCase());
    }
    
    // Add keyword suggestions from description and abstract
    const keywords = extractKeywords(book.description, book.abstract, book.subjects);
    keywords.forEach(keyword => {
      if (!seen.has(keyword.toLowerCase())) {
        suggestions.push({
          text: keyword,
          type: 'keyword',
          field: 'all',
          book: book
        });
        seen.add(keyword.toLowerCase());
      }
    });
  });
  
  return suggestions;
}

// Extract keywords from text fields
function extractKeywords(description, abstract, subjects) {
  const keywords = [];
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
  
  // Extract from description
  if (description) {
    const words = description.toLowerCase().match(/\b\w{4,}\b/g) || [];
    words.forEach(word => {
      if (!stopWords.has(word) && word.length >= 4) {
        keywords.push(word);
      }
    });
  }
  
  // Extract from abstract
  if (abstract) {
    const words = abstract.toLowerCase().match(/\b\w{4,}\b/g) || [];
    words.forEach(word => {
      if (!stopWords.has(word) && word.length >= 4) {
        keywords.push(word);
      }
    });
  }
  
  // Extract from subjects
  if (subjects) {
    const subjectList = subjects.split(',').map(s => s.trim());
    keywords.push(...subjectList);
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

// Show suggestions based on query
function showSuggestions(query) {
  const suggestionsContainer = document.getElementById('searchSuggestions');
  const suggestionsList = document.getElementById('suggestionsList');
  
  if (!suggestionsContainer || !suggestionsList) return;
  
  // Filter suggestions based on query
  const filteredSuggestions = filterSuggestions(query);
  
  if (filteredSuggestions.length === 0) {
    suggestionsList.innerHTML = '<div class="suggestions-empty">No suggestions found for "' + escapeHtml(query) + '"</div>';
  } else {
    suggestionsList.innerHTML = filteredSuggestions.map((suggestion, index) => {
      const highlightedText = highlightMatch(suggestion.text, query);
      return `
        <div class="suggestion-item type-${suggestion.type}" data-index="${index}" data-text="${escapeHtml(suggestion.text)}" data-field="${suggestion.field}">
          <span class="suggestion-icon"></span>
          <span class="suggestion-text">${highlightedText}</span>
          <span class="suggestion-type">${suggestion.type}</span>
        </div>
      `;
    }).join('');
    
    // Add click listeners to suggestions
    suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => selectSuggestion(item));
    });
  }
  
  // Show the suggestions container
  suggestionsContainer.classList.remove('hidden');
  currentSuggestionIndex = -1;
}

// Filter suggestions based on query
function filterSuggestions(query) {
  const queryLower = query.toLowerCase();
  const matches = [];
  
  // Prioritize exact matches, then starts with, then contains
  const exactMatches = [];
  const startsWithMatches = [];
  const containsMatches = [];
  
  suggestionsCache.forEach(suggestion => {
    const textLower = suggestion.text.toLowerCase();
    
    if (textLower === queryLower) {
      exactMatches.push(suggestion);
    } else if (textLower.startsWith(queryLower)) {
      startsWithMatches.push(suggestion);
    } else if (textLower.includes(queryLower)) {
      containsMatches.push(suggestion);
    }
  });
  
  // Combine and limit results
  return [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 10);
}

// Highlight matching text in suggestions
function highlightMatch(text, query) {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="suggestion-match">$1</span>');
}

// Escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight current suggestion
function highlightSuggestion() {
  const suggestions = document.querySelectorAll('.suggestion-item');
  suggestions.forEach((item, index) => {
    if (index === currentSuggestionIndex) {
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('highlighted');
    }
  });
}

// Select a suggestion
function selectSuggestion(suggestionElement) {
  const text = suggestionElement.getAttribute('data-text');
  const field = suggestionElement.getAttribute('data-field');
  
  const searchInput = document.getElementById('searchInput');
  const searchField = document.getElementById('searchField');
  
  if (searchInput && searchField) {
    searchInput.value = text;
    if (field !== 'all') {
      searchField.value = field;
    }
    
    // Trigger search
    setTimeout(() => {
      document.getElementById('searchButton').click();
    }, 100);
  }
  
  hideSuggestions();
}

// Hide suggestions
function hideSuggestions() {
  const suggestionsContainer = document.getElementById('searchSuggestions');
  if (suggestionsContainer) {
    suggestionsContainer.classList.add('hidden');
  }
  currentSuggestionIndex = -1;
}

// My Books Functionality
function showMyBooks() {
  console.log('Redirecting to My Books page...');
  
  // REDIRECT TO WORKING PAGE - bypasses all cache issues
  window.location.href = '/my-books-fresh.html';
  return;
}

function showMainBooks() {
  console.log('Showing main books section');
  
  // Show main books section and hide my books section
  const mainBooksSection = document.getElementById('main-books-section');
  const myBooksSection = document.getElementById('my-books-view'); // Updated ID
  const searchContainer = document.querySelector('.search-container');
  const carouselContainer = document.querySelector('.carousel-container');
  const readingStatsSection = document.getElementById('user-stats-page');
  
  if (mainBooksSection) mainBooksSection.classList.remove('hidden');
  if (myBooksSection) myBooksSection.classList.add('hidden');
  if (searchContainer) searchContainer.classList.remove('hidden');
  if (carouselContainer) carouselContainer.classList.remove('hidden');
  if (readingStatsSection) readingStatsSection.classList.add('hidden');
  
  // Reload main books
  loadBooks();
}

async function loadMyBooks() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to view your books.');
    return;
  }
  
  // Show loading state
  showMyBooksLoading(true);
  
  try {
    console.log('📚 Loading My Books...');
    
    // Fetch borrowed books from API - WORKING VERSION
    const response = await fetch(`${API_BASE}/api/user/borrowed-books`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const borrowedBooks = await response.json();
    console.log('✅ Loaded borrowed books:', borrowedBooks.length, 'books');
    
    // Update statistics
    updateMyBooksStats(borrowedBooks);
    
    // Render borrowed books
    renderMyBooks(borrowedBooks);
    
  } catch (error) {
    console.error('❌ Error loading borrowed books:', error);
    showMyBooksError('Failed to load your borrowed books. Please try again.');
  } finally {
    showMyBooksLoading(false);
  }
}

function updateMyBooksStats(borrowedBooks) {
  const totalBorrowed = borrowedBooks.length;
  const currentlyBorrowed = borrowedBooks.length; // All books in the list are currently borrowed
  const booksReturned = 0; // We don't track returned books in this simplified version
  
  document.getElementById('total-borrowed').textContent = totalBorrowed;
  document.getElementById('currently-borrowed').textContent = currentlyBorrowed;
  document.getElementById('books-returned').textContent = booksReturned;
}

function renderMyBooks(borrowedBooks) {
  const myBooksList = document.getElementById('my-books-list');
  const myBooksEmpty = document.getElementById('my-books-empty');
  
  if (!borrowedBooks || borrowedBooks.length === 0) {
    myBooksList.innerHTML = '';
    myBooksEmpty.classList.remove('hidden');
    return;
  }
  
  myBooksEmpty.classList.add('hidden');
  
  // Sort books by borrow date (most recent first)
  const sortedBooks = borrowedBooks.sort((a, b) => new Date(b.borrowed_date) - new Date(a.borrowed_date));
  
  myBooksList.innerHTML = sortedBooks.map(book => createBorrowedBookCard(book)).join('');
}

function createBorrowedBookCard(book) {
  const borrowedDate = new Date(book.borrowed_date || book.borrow_date);
  const dueDate = new Date(borrowedDate.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from borrow
  const isOverdue = new Date() > dueDate;
  const daysOverdue = isOverdue ? Math.ceil((new Date() - dueDate) / (1000 * 60 * 60 * 24)) : 0;
  
  const statusClass = isOverdue ? 'overdue' : 'active';
  const statusText = isOverdue ? `Overdue (${daysOverdue} days)` : 'Active';
  
  return `
    <div class="borrowed-book-card">
      <div class="borrowed-book-status ${statusClass}">${statusText}</div>
      
      <div class="borrowed-book-header">
        <div class="borrowed-book-info">
          <h3 class="borrowed-book-title">${escapeHtml(book.title)}</h3>
          <p class="borrowed-book-author">👤 ${escapeHtml(book.author || 'Unknown Author')}</p>
          <span class="borrowed-book-category">🏷️ ${escapeHtml(book.category || 'Uncategorized')}</span>
        </div>
      </div>
      
      <div class="borrowed-book-dates">
        <div class="borrowed-date-item">
          <span class="borrowed-date-label">📅 Borrowed Date:</span>
          <span class="borrowed-date-value">${formatDate(borrowedDate)}</span>
        </div>
        <div class="borrowed-date-item">
          <span class="borrowed-date-label">🗓️ Due Date:</span>
          <span class="borrowed-date-value ${isOverdue ? 'borrowed-date-overdue' : ''}">${formatDate(dueDate)}</span>
        </div>

      </div>
      
      <div class="borrowed-book-actions">
        <button class="borrowed-book-btn details" onclick="viewBookDetails(${book.book_id})">
          📖 View Details
        </button>
        <button class="borrowed-book-btn return" onclick="requestReturn(${book.id})">
          📤 Request Return
        </button>
        ${!isOverdue ? `
          <button class="borrowed-book-btn renew" onclick="requestRenewal(${book.id})">
            🔄 Request Renewal
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showMyBooksLoading(show) {
  const loadingElement = document.getElementById('my-books-loading');
  if (loadingElement) {
    if (show) {
      loadingElement.classList.remove('hidden');
    } else {
      loadingElement.classList.add('hidden');
    }
  }
}

function showMyBooksError(message) {
  const myBooksList = document.getElementById('my-books-list');
  if (myBooksList) {
    myBooksList.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">⚠️</div>
        <h3 class="text-xl font-semibold text-red-600 mb-2">Error</h3>
        <p class="text-gray-600 mb-4">${escapeHtml(message)}</p>
        <button onclick="loadMyBooks()" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors">
          Try Again
        </button>
      </div>
    `;
  }
}

async function returnBook(borrowId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to return books.');
    return;
  }
  
  if (!confirm('Are you sure you want to return this book?')) {
    return;
  }
  
  try {
    console.log('Returning book with borrow ID:', borrowId);
    
    await apiFetch(`/api/return-book/${borrowId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Book returned successfully');
    
    // Use the helper function for consistent handling
    handleBookOperationSuccess('return');
    
  } catch (error) {
    console.error('Error returning book:', error);
    alert('Failed to return book. Please try again.');
  }
}

async function renewBook(borrowId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to renew books.');
    return;
  }
  
  if (!confirm('Are you sure you want to renew this book for 7 more days?')) {
    return;
  }
  
  try {
    await apiFetch(`/api/renew-book/${borrowId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Use the helper function for consistent handling
    handleBookOperationSuccess('renew');
    
  } catch (error) {
    console.error('Error renewing book:', error);
    alert('Failed to renew book. Please try again.');
  }
}

// Helper function to check if borrow buttons should be shown
function shouldShowBorrowButton() {
  const currentUser = getCurrentUser();
  return currentUser && !currentUser.isAdmin;
}

// Function to refresh book availability after borrow/return operations
async function refreshBookAvailability() {
  try {
    console.log('Refreshing book availability...');
    
    // Reload the main books display
    await loadBooks();
    
    // Refresh suggestions cache
    loadSuggestionsCache();
    
    console.log('Book availability refreshed successfully');
  } catch (error) {
    console.error('Error refreshing book availability:', error);
  }
}

// Function to handle successful book operations (borrow/return/renew)
function handleBookOperationSuccess(operation, bookTitle = '') {
  const messages = {
    'borrow': `Book borrowed successfully! ${bookTitle ? `"${bookTitle}"` : 'The book'} is now in your library. Check "My Books" to view your borrowed books.`,
    'return': `Book returned successfully! ${bookTitle ? `"${bookTitle}"` : 'The book'} is now available for others to borrow.`,
    'renew': `Book renewed successfully for 7 more days! ${bookTitle ? `"${bookTitle}"` : 'The book'} due date has been extended.`
  };
  
  alert(messages[operation] || 'Operation completed successfully!');
  
  // Refresh both sections
  loadMyBooks();
  refreshBookAvailability();
}

async function attemptBorrow(id){
  const token = localStorage.getItem('token');
  if (!token) { 
    openAuthModal('login'); 
    return; 
  }
  
  // Check if user is admin - admins should not be able to borrow books
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.isAdmin) {
    alert('Administrators cannot borrow books. Please use the Admin panel to manage the library.');
    return;
  }
  
  if (!confirm('Are you sure you want to send a borrow request for this book?')) return;
  
  // Disable borrow buttons to prevent double-clicking
  const borrowButtons = document.querySelectorAll(`button[onclick*="attemptBorrow(${id})"]`);
  borrowButtons.forEach(btn => {
    btn.disabled = true;
    btn.textContent = 'Requesting...';
  });
  
  try {
    console.log('Submitting borrow request for book ID:', id);
    const response = await apiFetch(`/api/notifications/borrow-request`, { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bookId: id })
    });
    
    console.log('Borrow request response:', response);
    alert('Borrow request sent to admin. You will see the book in My Books once approved.');
    refreshBookAvailability();
    
  } catch (e) { 
    console.error('Borrow error:', e);
    alert('Error borrowing book: ' + e.message);
    
    // Re-enable buttons on error
    borrowButtons.forEach(btn => {
      btn.disabled = false;
      btn.textContent = 'Borrow Request';
    });
  }
}

// search handlers
searchButton.addEventListener('click', () => {
  const term = searchInput.value.trim();
  const field = searchField.value;
  if (!term) { loadBooks(); return; }
  
  // Perform the search
  if (field && field !== 'all') {
    loadAdvancedSearch(field, term);
  } else {
    loadBooks({ search: term, title: `Search: ${term}` });
  }
  
  // Clear the search input after performing search
  setTimeout(() => {
    searchInput.value = '';
    searchField.value = 'all'; // Reset to default
  }, 100);
});
searchInput.addEventListener('keyup', (e)=> { if (e.key==='Enter') searchButton.click(); });

async function loadAdvancedSearch(field, term) {
  booksGrid.innerHTML = '<p>Searching…</p>';
  booksTitle.textContent = `Search: ${field} contains "${term}"`;
  try {
    const url = `/api/books?field=${encodeURIComponent(field)}&term=${encodeURIComponent(term)}`;
    const books = await apiFetch(url);
    renderBooks(books);
  } catch (e) {
    booksGrid.innerHTML = `<p style="color:red">${e.message}</p>`;
  }
}

// Auth modal functions
function openAuthModal(form='login'){
  if (!authModal) {
    console.error('authModal element not found!');
    return;
  }
  
  // Clear all form data
  clearAuthForms();
  
  // Remove the hidden class instead of setting display
  authModal.classList.remove('hidden');
  authModal.style.display = 'flex';
  toggleAuthForm(form);
  const lm = document.getElementById('login-message'); const sm = document.getElementById('signup-message');
  if (lm) lm.textContent = ''; if (sm) sm.textContent = '';
  
  // Add keyboard event listener
  document.addEventListener('keydown', handleGlobalKeydown);
}
function closeAuthModal(){ 
  // Clear forms when closing
  clearAuthForms();
  authModal.classList.add('hidden');
  authModal.style.display = 'none';
  
  // Remove keyboard event listener
  document.removeEventListener('keydown', handleGlobalKeydown);
}

// Form clearing functions
function clearAuthForms() {
  // Clear login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.reset();
    // Clear individual fields as backup
    const loginInputs = loginForm.querySelectorAll('input');
    loginInputs.forEach(input => input.value = '');
  }
  
  // Clear signup form
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.reset();
    // Clear individual fields as backup
    const signupInputs = signupForm.querySelectorAll('input');
    signupInputs.forEach(input => input.value = '');
  }
  
  // Clear any error messages
  const loginMessage = document.getElementById('login-message');
  const signupMessage = document.getElementById('signup-message');
  if (loginMessage) loginMessage.textContent = '';
  if (signupMessage) signupMessage.textContent = '';
}

function clearAdvancedSearchForm() {
  // Clear search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  
  // Clear advanced search rows
  const advRows = document.getElementById('advRows');
  if (advRows) {
    advRows.innerHTML = '';
    // Add one empty row
    addAdvRow();
  }
  
  // Reset dropdowns to defaults
  const advMatch = document.getElementById('advMatch');
  const advSort = document.getElementById('advSort');
  if (advMatch) advMatch.value = 'ALL';
  if (advSort) advSort.value = 'relevance:desc';
}

function clearSaveSearchForm() {
  const searchNameInput = document.getElementById('searchNameInput');
  if (searchNameInput) searchNameInput.value = '';
}
// Advanced search modal handlers
const advModal = document.getElementById('advModal');
const advRows = document.getElementById('advRows');
const addAdvFieldBtn = document.getElementById('addAdvFieldBtn');
const clearAdvFieldsBtn = document.getElementById('clearAdvFieldsBtn');
const advSearchBtn = document.getElementById('advSearchBtn');
const saveSearchBtn = document.getElementById('saveSearchBtn');
const loadSearchBtn = document.getElementById('loadSearchBtn');
const openAdvBtn = document.getElementById('openAdvBtn');

// Search templates
const searchTemplates = {
  recent: {
    name: 'Recent Publications',
    fields: [{ field: 'year', operator: 'gte', value: '2020' }]
  },
  science: {
    name: 'Science & Technology',
    fields: [
      { field: 'category', operator: 'contains', value: 'Science' },
      { field: 'category', operator: 'contains', value: 'Technology' }
    ],
    match: 'ANY'
  },
  classic: {
    name: 'Classic Literature',
    fields: [
      { field: 'category', operator: 'contains', value: 'Literature' },
      { field: 'year', operator: 'lte', value: '1950' }
    ]
  },
  academic: {
    name: 'Academic Resources',
    fields: [
      { field: 'abstract', operator: 'contains', value: 'research' },
      { field: 'toc', operator: 'contains', value: 'chapter' }
    ],
    match: 'ANY'
  }
};

// Enhanced field options with keyword mapping
const fieldOptions = {
  'all': { label: 'All Fields', operators: ['contains'] },
  'title': { label: 'Title', operators: ['contains', 'exact', 'starts_with'] },
  'author': { label: 'Author', operators: ['contains', 'exact', 'starts_with'] },
  'isbn': { label: 'ISBN', operators: ['exact', 'contains'] },
  'publisher': { label: 'Publisher', operators: ['contains', 'exact'] },
  'category': { label: 'Category/Subject', operators: ['contains', 'exact'] },
  'year': { label: 'Publication Year', operators: ['exact', 'gte', 'lte', 'between'] },
  'abstract': { label: 'Abstract/Summary', operators: ['contains'] },
  'toc': { label: 'Table of Contents', operators: ['contains'] },
  'subjects': { label: 'Subject Headings', operators: ['contains', 'exact'] }
};

const operatorLabels = {
  'contains': 'Contains',
  'exact': 'Exact Match',
  'starts_with': 'Starts With',
  'gte': 'Greater Than or Equal',
  'lte': 'Less Than or Equal',
  'between': 'Between (Year Range)'
};

function openAdvModal() {
  if (!advModal) return;
  advModal.classList.remove('hidden');
  advModal.style.display = 'flex';
  if (advRows && advRows.children.length === 0) addAdvRow();
}

function closeAdvModal() {
  if (!advModal) return;
  advModal.classList.add('hidden');
  advModal.style.display = 'none';
}

function addAdvRow(fieldData = null) {
  if (!advRows) return;
  
  const row = document.createElement('div');
  row.className = 'adv-search-row flex flex-wrap items-center gap-2 p-3 bg-white border rounded-lg';
  
  const fieldSelect = Object.keys(fieldOptions).map(key => 
    `<option value="${key}" ${fieldData?.field === key ? 'selected' : ''}>${fieldOptions[key].label}</option>`
  ).join('');
  
  row.innerHTML = `
    <div class="flex-1 min-w-48">
      <label class="block text-sm font-medium mb-1">Search Term:</label>
      <input class="adv-term w-full py-2 px-3 rounded border" placeholder="Enter search term..." value="${fieldData?.value || ''}" />
    </div>
    <div class="min-w-32">
      <label class="block text-sm font-medium mb-1">Field:</label>
      <select class="adv-field w-full py-2 px-3 rounded border">
        ${fieldSelect}
      </select>
    </div>
    <div class="min-w-32">
      <label class="block text-sm font-medium mb-1">Operator:</label>
      <select class="adv-operator w-full py-2 px-3 rounded border">
        <option value="contains">Contains</option>
      </select>
    </div>
    <div class="flex items-end">
      <button type="button" class="remove-adv bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded" title="Remove Field">✖</button>
    </div>
  `;
  
  const fieldSelect_el = row.querySelector('.adv-field');
  const operatorSelect = row.querySelector('.adv-operator');
  const termInput = row.querySelector('.adv-term');
  
  // Update operators when field changes
  fieldSelect_el.addEventListener('change', () => {
    const field = fieldSelect_el.value;
    const operators = fieldOptions[field]?.operators || ['contains'];
    operatorSelect.innerHTML = operators.map(op => 
      `<option value="${op}">${operatorLabels[op]}</option>`
    ).join('');
    
    // Update placeholder based on field
    const placeholders = {
      'year': 'e.g., 2020 or 2015-2020',
      'isbn': 'e.g., 9780123456789',
      'author': 'e.g., Stephen King',
      'title': 'e.g., Introduction to Algorithms'
    };
    termInput.placeholder = placeholders[field] || 'Enter search term...';
  });
  
  // Set initial operator if fieldData provided
  if (fieldData?.operator) {
    fieldSelect_el.dispatchEvent(new Event('change'));
    operatorSelect.value = fieldData.operator;
  }
  
  row.querySelector('.remove-adv').addEventListener('click', () => row.remove());
  advRows.appendChild(row);
  
  // Trigger field change to set up operators
  fieldSelect_el.dispatchEvent(new Event('change'));
}

function clearAdvFields() {
  if (advRows) {
    advRows.innerHTML = '';
    addAdvRow();
  }
}

function loadTemplate(templateKey) {
  const template = searchTemplates[templateKey];
  if (!template) return;
  
  clearAdvFields();
  advRows.innerHTML = '';
  
  template.fields.forEach(field => addAdvRow(field));
  
  if (template.match) {
    const matchSelect = document.getElementById('advMatch');
    if (matchSelect) matchSelect.value = template.match;
  }
}

async function performAdvancedSearch() {
  if (!advRows) { closeAdvModal(); return; }
  
  const rows = Array.from(advRows.children);
  if (rows.length === 0) return closeAdvModal();
  
  const match = document.getElementById('advMatch')?.value || 'ALL';
  const sort = document.getElementById('advSort')?.value || 'relevance:desc';
  const pageSize = document.getElementById('advPageSize')?.value || '20';
  
  const filters = rows.map(row => {
    const term = row.querySelector('.adv-term')?.value?.trim();
    const field = row.querySelector('.adv-field')?.value;
    const operator = row.querySelector('.adv-operator')?.value;
    
    if (!term) return null;
    
    return {
      field: field,
      value: term,
      op: operator
    };
  }).filter(Boolean);
  
  if (filters.length === 0) {
    alert('Please enter at least one search term.');
    return;
  }
  
  booksGrid.innerHTML = '<p class="text-center py-8">🔍 Searching...</p>';
  booksTitle.textContent = `Advanced Search Results (${match})`;
  
  console.log('Performing advanced search with filters:', filters);
  console.log('Match type:', match, 'Sort:', sort, 'Page size:', pageSize);
  
  try {
    // First try the advanced search endpoint
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      match: match,
      sort: sort,
      pageSize: pageSize
    });
    
    console.log('Making request to:', `/api/search/advanced?${params}`);
    let result;
    
    try {
      result = await apiFetch(`/api/search/advanced?${params}`);
      console.log('Advanced search result:', result);
    } catch (advError) {
      console.log('Advanced search failed, falling back to basic search:', advError.message);
      // Fallback to basic search if advanced search fails
      const basicParams = new URLSearchParams({
        filters: JSON.stringify(filters.map(f => ({ field: f.field, term: f.value }))),
        match: match
      });
      result = await apiFetch(`/api/books?${basicParams}`);
    }
    
    const books = result.items || result; // Handle both formats
    console.log('Final books result:', books);
    
    // Use enhanced rendering if available, otherwise fall back to regular rendering
    if (typeof renderEnhancedBooks === 'function') {
      renderEnhancedBooks(books);
    } else {
      renderBooks(books);
    }
    
    // Show search summary
    const summary = `Found ${books.length} results. Filters: ${filters.map(f => `${fieldOptions[f.field]?.label || f.field}: "${f.value}"`).join(', ')}`;
    const summaryColor = books.length === 0 ? 'text-red-600 font-semibold' : 'text-gray-600';
    booksTitle.innerHTML = `Advanced Search Results <span class="text-sm font-normal ${summaryColor}">(${summary})</span>`;
    
  } catch (e) {
    console.error('Search failed completely:', e);
    booksGrid.innerHTML = `<p class="error-message">❌ Search failed: ${e.message}</p>`;
  }
  
  closeAdvModal();
}

// Enhanced book rendering with metadata
function renderEnhancedBooks(books) {
  booksGrid.innerHTML = '';
  if (booksGridUnavail) booksGridUnavail.innerHTML = '';
  if (booksTitleUnavail) booksTitleUnavail.style.display = 'none';
  if (booksGridUnavail) booksGridUnavail.style.display = 'none';
  
  if (!books || books.length === 0) {
    booksGrid.innerHTML = '<p class="text-center py-8 text-gray-600">No books found matching your search criteria.</p>';
    return;
  }
  
  const available = [];
  const unavailable = [];
  books.forEach(b => (b.available ? available : unavailable).push(b));
  
  const renderInto = (arr, targetGrid) => {
    arr.forEach(b => {
      const img = (b.image && (b.image.startsWith('http') ? b.image : `${API_ORIGIN}${b.image}`)) || UPLOAD('default.jpg');
      const card = document.createElement('div');
      card.className = 'book-card enhanced' + (b.available ? '' : ' unavailable');
      
      // Enhanced metadata display
      const metadata = [];
      if (b.publisher) metadata.push(`Publisher: ${b.publisher}`);
      if (b.year) metadata.push(`Year: ${b.year}`);
      if (b.isbn) metadata.push(`ISBN: ${b.isbn}`);
      
      card.innerHTML = `
        <div class="book-left">
          <img src="${img}" alt="${escapeHtml(b.title)}" onerror="this.src='${UPLOAD('default.jpg')}'" />
          <div class="book-actions">
            <button class="primary" onclick="openEnhancedDetails(${b.id})">📖 Details</button>
            <button class="primary" onclick="openQRCodeModal(${b.id})">📱 QR Code</button>
            <button class="primary" ${b.available ? '' : 'disabled'} onclick="attemptBorrow(${b.id})">
              ${b.available ? '📚 Borrow' : '❌ Unavailable'}
            </button>
          </div>
        </div>
        <div class="book-body">
          <h3 class="font-bold text-lg mb-2">${escapeHtml(b.title)}</h3>
          <p class="author text-blue-600 font-medium mb-1">👤 ${escapeHtml(b.author || 'Unknown Author')}</p>
          <p class="category text-green-600 text-sm mb-2">🏷️ ${escapeHtml(b.category || 'Uncategorized')}</p>
          ${metadata.length ? `<div class="metadata text-xs text-gray-600 mb-2">${metadata.join(' • ')}</div>` : ''}
          ${b.abstract ? `<p class="abstract text-sm text-gray-700 mb-2 line-clamp-3">📄 ${escapeHtml(b.abstract.substring(0, 150))}${b.abstract.length > 150 ? '...' : ''}</p>` : ''}
          ${b.description ? `<p class="desc text-sm text-gray-600 line-clamp-2">${escapeHtml(b.description)}</p>` : ''}
        </div>
      `;
      targetGrid.appendChild(card);
    });
  };
  
  renderInto(available, booksGrid);
  if (unavailable.length && booksGridUnavail && booksTitleUnavail) {
    booksTitleUnavail.style.display = '';
    booksGridUnavail.style.display = '';
    renderInto(unavailable, booksGridUnavail);
  }
}

// Enhanced book details modal
function openEnhancedDetails(id) {
  // This would open a detailed modal with all metadata
  // For now, show an alert with enhanced info
  apiFetch(`/api/books?filters=${encodeURIComponent(JSON.stringify([{field: 'all', value: id, op: 'exact'}]))}`)
    .then(books => {
      const book = books.find(b => b.id == id) || books[0];
      if (book) {
        let details = `📖 ${book.title}\n`;
        details += `👤 Author: ${book.author || 'Unknown'}\n`;
        details += `🏷️ Category: ${book.category || 'Uncategorized'}\n`;
        if (book.isbn) details += `📚 ISBN: ${book.isbn}\n`;
        if (book.publisher) details += `🏢 Publisher: ${book.publisher}\n`;
        if (book.year) details += `📅 Year: ${book.year}\n`;
        if (book.abstract) details += `\n📄 Abstract:\n${book.abstract}\n`;
        if (book.toc) details += `\n📋 Table of Contents:\n${book.toc}\n`;
        if (book.subjects) details += `\n🔖 Subjects: ${book.subjects}\n`;
        alert(details);
      }
    })
    .catch(e => alert('Error loading book details: ' + e.message));
}

// Saved searches functionality
function getSavedSearches() {
  return JSON.parse(localStorage.getItem('savedSearches') || '[]');
}

function saveCurrentSearch() {
  const name = document.getElementById('searchNameInput')?.value?.trim();
  if (!name) {
    alert('Please enter a name for this search.');
    return;
  }
  
  const rows = Array.from(advRows.children);
  const filters = rows.map(row => ({
    field: row.querySelector('.adv-field')?.value,
    value: row.querySelector('.adv-term')?.value?.trim(),
    op: row.querySelector('.adv-operator')?.value
  })).filter(f => f.value);
  
  if (filters.length === 0) {
    alert('Please add some search criteria before saving.');
    return;
  }
  
  const search = {
    id: Date.now(),
    name: name,
    filters: filters,
    match: document.getElementById('advMatch')?.value || 'ALL',
    sort: document.getElementById('advSort')?.value || 'relevance:desc',
    created: new Date().toISOString()
  };
  
  const saved = getSavedSearches();
  saved.push(search);
  localStorage.setItem('savedSearches', JSON.stringify(saved));
  
  closeSaveSearchModal();
  alert('Search saved successfully!');
}

function loadSavedSearch(searchId) {
  const saved = getSavedSearches();
  const search = saved.find(s => s.id === searchId);
  if (!search) return;
  
  // Clear and populate fields
  advRows.innerHTML = '';
  search.filters.forEach(filter => addAdvRow(filter));
  
  // Set options
  if (document.getElementById('advMatch')) document.getElementById('advMatch').value = search.match;
  if (document.getElementById('advSort')) document.getElementById('advSort').value = search.sort;
  
  closeLoadSearchModal();
}

function deleteSavedSearch(searchId) {
  if (!confirm('Delete this saved search?')) return;
  
  const saved = getSavedSearches().filter(s => s.id !== searchId);
  localStorage.setItem('savedSearches', JSON.stringify(saved));
  loadSavedSearchesList();
}

function loadSavedSearchesList() {
  const list = document.getElementById('savedSearchesList');
  if (!list) return;
  
  const saved = getSavedSearches();
  if (saved.length === 0) {
    list.innerHTML = '<p class="text-gray-500 text-center py-4">No saved searches yet.</p>';
    return;
  }
  
  list.innerHTML = saved.map(search => `
    <div class="saved-search-item border rounded p-3 mb-2 hover:bg-gray-50">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h4 class="font-medium">${escapeHtml(search.name)}</h4>
          <p class="text-sm text-gray-600">${search.filters.length} filters • ${search.match} match</p>
          <p class="text-xs text-gray-500">Created: ${new Date(search.created).toLocaleDateString()}</p>
        </div>
        <div class="flex gap-1">
          <button onclick="loadSavedSearch(${search.id})" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">Load</button>
          <button onclick="deleteSavedSearch(${search.id})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Modal functions for save/load
function openSaveSearchModal() {
  const modal = document.getElementById('saveSearchModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.getElementById('searchNameInput').focus();
  }
}

function closeSaveSearchModal() {
  const modal = document.getElementById('saveSearchModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.getElementById('searchNameInput').value = '';
  }
}

function openLoadSearchModal() {
  const modal = document.getElementById('loadSearchModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    loadSavedSearchesList();
  }
}

function closeLoadSearchModal() {
  const modal = document.getElementById('loadSearchModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Advanced search modal functions
function openAdvModal() {
  if (advModal) {
    // Clear the form when opening
    clearAdvancedSearchForm();
    advModal.classList.remove('hidden');
    advModal.style.display = 'flex';
    
    // Add keyboard event listener
    document.addEventListener('keydown', handleGlobalKeydown);
  }
}

function closeAdvModal() {
  if (advModal) {
    // Clear the form when closing
    clearAdvancedSearchForm();
    advModal.classList.add('hidden');
    advModal.style.display = 'none';
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleGlobalKeydown);
  }
}

function openSaveSearchModal() {
  const modal = document.getElementById('saveSearchModal');
  if (modal) {
    // Clear the form when opening
    clearSaveSearchForm();
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.getElementById('searchNameInput')?.focus();
  }
}

function closeSaveSearchModal() {
  const modal = document.getElementById('saveSearchModal');
  if (modal) {
    // Clear the form when closing
    clearSaveSearchForm();
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function openLoadSearchModal() {
  const modal = document.getElementById('loadSearchModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    loadSavedSearchesList();
  }
}

function closeLoadSearchModal() {
  const modal = document.getElementById('loadSearchModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Event listeners
if (addAdvFieldBtn) addAdvFieldBtn.addEventListener('click', () => addAdvRow());
if (clearAdvFieldsBtn) clearAdvFieldsBtn.addEventListener('click', clearAdvFields);
if (openAdvBtn) openAdvBtn.addEventListener('click', openAdvModal);
if (advSearchBtn) advSearchBtn.addEventListener('click', performAdvancedSearch);
if (saveSearchBtn) saveSearchBtn.addEventListener('click', openSaveSearchModal);
if (loadSearchBtn) loadSearchBtn.addEventListener('click', openLoadSearchModal);
function toggleAuthForm(form){
  const l = document.getElementById('login-form-container');
  const s = document.getElementById('signup-form-container');
  if (!l || !s) return;
  if (form === 'signup') { l.classList.add('hidden'); s.classList.remove('hidden'); } else { l.classList.remove('hidden'); s.classList.add('hidden'); }
}
document.addEventListener('click', (e) => { 
  if (e.target === authModal) closeAuthModal();
  
  // Only treat the header buttons (with explicit ids) as open-modal triggers.
  // Do NOT intercept the auth modal submit buttons.
  if (e.target && e.target.id === 'loginBtn') {
    e.preventDefault();
    openAuthModal('login');
  }
  if (e.target && e.target.id === 'signupBtn') {
    e.preventDefault();
    openAuthModal('signup');
  }
});

// form submissions and initial setup
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - setting up forms');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  console.log('Login form found:', !!loginForm, 'Signup form found:', !!signupForm);
  
  // Test if form elements are accessible
  const usernameInput = document.querySelector('input[name="username"]');
  const passwordInput = document.querySelector('input[name="password"]');
  console.log('Username input found:', !!usernameInput, 'Password input found:', !!passwordInput);

  if (loginForm) {
    console.log('Adding submit listener to login form');
    loginForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      console.log('Login form submitted!');
      const data = Object.fromEntries(new FormData(loginForm).entries());
      console.log('Form data:', data);
      try {
        console.log('Attempting login with:', data);
        const res = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(data) });
        console.log('Login successful:', res);
        localStorage.setItem('token', res.token);
        localStorage.setItem('username', res.username);
        localStorage.setItem('isAdmin', res.isAdmin ? 'true' : 'false');
        closeAuthModal(); updateHeader(); loadCategories(); loadBooks();
      } catch (err) {
        console.error('Login error:', err);
        
        // Check if it's a rejection error with reason
        if (err.message && err.message.includes('rejected')) {
          // Parse the error to get the reason
          const reasonMatch = err.message.match(/rejected[:\s]*(.*)/i);
          const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';
          
          // Create beautiful modal for rejection
          const modal = document.createElement('div');
          modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
          modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideIn 0.3s ease-out;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);">
                  <span style="font-size: 48px;">❌</span>
                </div>
                <h2 style="font-size: 28px; font-weight: bold; color: #991b1b; margin: 0;">Registration Rejected</h2>
              </div>
              
              <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="font-weight: 600; color: #991b1b; margin: 0 0 8px 0; font-size: 14px;">Rejection Reason:</p>
                <p style="color: #7f1d1d; margin: 0; font-size: 16px; line-height: 1.5;">${reason}</p>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong>📝 Good News:</strong> Your previous registration has been deleted. You can register again with correct information.
                </p>
              </div>
              
              <div style="display: flex; gap: 12px;">
                <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; background: #ef4444; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                  Close
                </button>
                <button onclick="this.closest('div[style*=fixed]').remove(); window.location.href='/signup-enhanced.html'" style="flex: 1; background: #10b981; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                  📝 Register Again
                </button>
              </div>
            </div>
            <style>
              @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            </style>
          `;
          document.body.appendChild(modal);
          
        } else if (err.message && err.message.includes('pending')) {
          // Create beautiful modal for pending
          const modal = document.createElement('div');
          modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
          modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideIn 0.3s ease-out;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);">
                  <span style="font-size: 48px;">⏳</span>
                </div>
                <h2 style="font-size: 28px; font-weight: bold; color: #92400e; margin: 0;">Pending Verification</h2>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="color: #78350f; margin: 0; font-size: 16px; line-height: 1.6; text-align: center;">
                  Your registration is awaiting admin approval. Please check back later.
                </p>
              </div>
              
              <button onclick="this.closest('div[style*=fixed]').remove()" style="width: 100%; background: #f59e0b; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
                OK
              </button>
            </div>
            <style>
              @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            </style>
          `;
          document.body.appendChild(modal);
          
        } else {
          // Regular error
          const messageEl = document.getElementById('login-message');
          if (messageEl) {
            messageEl.textContent = err.message;
            messageEl.style.color = 'red';
          }
        }
      }
    });
  } else {
    console.error('Login form not found!');
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(signupForm).entries());
      try {
        await apiFetch('/api/signup', { method: 'POST', body: JSON.stringify(data) });
        const messageEl = document.getElementById('signup-message');
        if (messageEl) {
          messageEl.textContent = 'Signup success — login now';
          messageEl.style.color = 'green';
        }
        setTimeout(()=> toggleAuthForm('login'), 900);
      } catch (err) {
        const messageEl = document.getElementById('signup-message');
        if (messageEl) {
          messageEl.textContent = err.message;
          messageEl.style.color = 'red';
        }
      }
    });
  }

  updateHeader();
  loadCategories();
  loadBooks();
});

function logout(){ localStorage.removeItem('token'); localStorage.removeItem('username'); localStorage.removeItem('isAdmin'); updateHeader(); loadBooks(); loadCategories(); }

async function testLogin(){
  console.log('Testing login manually...');
  try {
    const res = await apiFetch('/api/login', { 
      method: 'POST', 
      body: JSON.stringify({username: 'testuser', password: 'testpass123'}) 
    });
    console.log('Manual login successful:', res);
    localStorage.setItem('token', res.token);
    localStorage.setItem('username', res.username);
    localStorage.setItem('isAdmin', res.isAdmin ? 'true' : 'false');
    
    updateHeader();
    alert('Login successful! You are now logged in as: ' + res.username + (res.isAdmin ? ' (Admin)' : ''));
  } catch (err) {
    console.error('Manual login failed:', err);
    alert('Login failed: ' + err.message);
  }
}


// Update header with login/logout buttons and My Books
function updateHeader() {
  const authContainer = document.getElementById('auth-container');
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  if (!authContainer) return;
  
  if (token && username) {
    // User is logged in
    if (isAdmin) {
      // Admin user - link to standalone admin dashboard
      authContainer.innerHTML = `
        <span class="text-white mr-3">Welcome, ${escapeHtml(username)}!</span>
        <button id="adminBtn" class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded mr-2 transition-colors">
          Admin
        </button>
        <button id="gateScannerBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mr-2 transition-colors">
          🚪 Gate Scanner
        </button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors" onclick="logout()">
          Logout
        </button>
      `;
      // navigate to standalone admin page on click
      const adminBtn = document.getElementById('adminBtn');
      if (adminBtn) {
        adminBtn.addEventListener('click', () => {
          const dest = (API_BASE || '') + '/admin.html';
          window.location.href = dest;
        });
      }
      
      // Open gate scanner on click
      const gateScannerBtn = document.getElementById('gateScannerBtn');
      if (gateScannerBtn) {
        gateScannerBtn.addEventListener('click', () => {
          openGateScanner();
        });
      }
    } else {
      // Regular user - show My Books, no admin panel
      authContainer.innerHTML = `
        <span class="text-white mr-3">Welcome, ${escapeHtml(username)}!</span>
        <button id="myBooksBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mr-2 transition-colors" onclick="showMyBooks()">
          My Books
        </button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors" onclick="logout()">
          Logout
        </button>
      `;
    }
  } else {
    // User is not logged in
    authContainer.innerHTML = `
      <button id="loginBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mr-2 transition-colors" onclick="openAuthModal('login')">
        Login
      </button>
      <button id="signupBtn" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-colors" onclick="openAuthModal('signup')">
        Sign Up
      </button>
    `;
  }
}

// ==================== QR CODE FUNCTIONALITY ====================
// Use window.currentQRCodeData instead of local variable
if (!window.currentQRCodeData) {
  window.currentQRCodeData = null;
}

function openQRCodeModal(bookId) {
  const modal = document.getElementById('qrCodeModal');
  const loading = document.getElementById('qrCodeLoading');
  const display = document.getElementById('qrCodeDisplay');
  const error = document.getElementById('qrCodeError');
  
  modal.classList.remove('hidden');
  loading.classList.remove('hidden');
  display.classList.add('hidden');
  error.classList.add('hidden');
  
  generateQRCode(bookId);
}

function closeQRCodeModal() {
  const modal = document.getElementById('qrCodeModal');
  modal.classList.add('hidden');
  window.currentQRCodeData = null;
}

async function generateQRCode(bookId) {
  try {
    console.log('🔍 Generating QR code for book ID:', bookId);
    
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`/api/books/${bookId}/qrcode`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ QR code data received:', data);
    
    const loading = document.getElementById('qrCodeLoading');
    const display = document.getElementById('qrCodeDisplay');
    const error = document.getElementById('qrCodeError');
    
    loading.classList.add('hidden');
    display.classList.remove('hidden');
    
    // Set QR code image
    const qrImage = document.getElementById('qrCodeImage');
    qrImage.src = data.qrCode;
    console.log('✅ QR image set:', data.qrCode.substring(0, 50) + '...');
    
    // Set book details
    document.getElementById('qrBookTitle').textContent = data.bookData.title;
    document.getElementById('qrBookAuthor').textContent = `by ${data.bookData.author}`;
    
    // Store for download/print - use window to make it globally accessible
    window.currentQRCodeData = {
      image: data.qrCode,
      title: data.bookData.title,
      author: data.bookData.author
    };
    console.log('✅ QR code data stored for download/print');
    console.log('✅ window.currentQRCodeData:', window.currentQRCodeData);
  } catch (err) {
    console.error('❌ Error generating QR code:', err);
    
    const loading = document.getElementById('qrCodeLoading');
    const display = document.getElementById('qrCodeDisplay');
    const error = document.getElementById('qrCodeError');
    
    loading.classList.add('hidden');
    display.classList.add('hidden');
    error.classList.remove('hidden');
  }
}

function downloadQRCode() {
  console.log('💾 Download QR code clicked');
  
  if (!currentQRCodeData) {
    console.error('❌ No QR code data available');
    alert('⚠️ QR code not loaded yet. Please wait for it to generate.');
    return;
  }
  
  try {
    console.log('📥 Downloading QR code:', currentQRCodeData.title);
    
    const link = document.createElement('a');
    link.href = currentQRCodeData.image;
    link.download = `qrcode-${currentQRCodeData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ QR code download initiated');
  } catch (err) {
    console.error('❌ Error downloading QR code:', err);
    alert('⚠️ Failed to download QR code. Please try again.');
  }
}

function printQRCode() {
  console.log('🖨️ Print QR code clicked');
  
  if (!currentQRCodeData) {
    console.error('❌ No QR code data available');
    alert('⚠️ QR code not loaded yet. Please wait for it to generate.');
    return;
  }
  
  try {
    console.log('🖨️ Opening print window for:', currentQRCodeData.title);
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      throw new Error('Failed to open print window. Please allow popups for this site.');
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${escapeHtml(currentQRCodeData.title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
          }
          img {
            max-width: 400px;
            width: 100%;
            margin: 20px auto;
            display: block;
            border: 2px solid #ddd;
            padding: 10px;
            background: white;
          }
          h2 {
            margin-bottom: 10px;
            color: #333;
          }
          p {
            color: #666;
          }
          .print-btn {
            margin-top: 20px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
          }
          .print-btn:hover {
            background: #1d4ed8;
          }
          @media print {
            button { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(currentQRCodeData.title)}</h2>
        <p>by ${escapeHtml(currentQRCodeData.author)}</p>
        <img src="${currentQRCodeData.image}" alt="QR Code" />
        <p style="margin-top: 20px;">📱 Scan this QR code to view book details</p>
        <button class="print-btn" onclick="window.print()">
          🖨️ Print
        </button>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    console.log('✅ Print window opened');
  } catch (err) {
    console.error('❌ Error printing QR code:', err);
    alert('⚠️ ' + err.message);
  }
}
