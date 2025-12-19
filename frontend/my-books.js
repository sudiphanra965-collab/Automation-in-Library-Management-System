// my-books.js - My Books functionality with auto-refresh

let myBooksRefreshInterval = null;

// Load user's borrowed books
async function loadMyBooks() {
  try {
    const response = await apiFetch('/api/user/borrowed-books');
    const books = await response.json();
    renderMyBooks(books);
  } catch (error) {
    console.error('Error loading my books:', error);
    showMyBooksError('Failed to load your books. Please try again.');
  }
}

// Render borrowed books
function renderMyBooks(books) {
  const container = document.getElementById('my-books-list');
  const statsContainer = document.getElementById('my-books-stats');
  
  if (!container) return;
  
  // Update stats
  if (statsContainer) {
    const totalBooks = books.length;
    const overdueBooks = books.filter(book => {
      const dueDate = new Date(book.borrow_date);
      dueDate.setDate(dueDate.getDate() + 14);
      return new Date() > dueDate;
    }).length;
    
    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${totalBooks}</div>
        <div class="stat-label">Books Borrowed</div>
      </div>
      <div class="stat-card ${overdueBooks > 0 ? 'overdue' : ''}">
        <div class="stat-number">${overdueBooks}</div>
        <div class="stat-label">Overdue</div>
      </div>
    `;
  }
  
  if (books.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>No Books Borrowed</h3>
        <p>Browse the library and borrow your first book!</p>
        <button onclick="showMainBooks()" class="btn-primary">Browse Books</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = books.map(book => {
    const borrowDate = new Date(book.borrow_date);
    const dueDate = new Date(borrowDate);
    dueDate.setDate(dueDate.getDate() + 14);
    const now = new Date();
    const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    const isOverdue = daysLeft < 0;
    const fine = isOverdue ? Math.abs(daysLeft) * 5 : 0;
    
    return `
      <div class="my-book-card ${isOverdue ? 'overdue' : ''}">
        <div class="book-image">
          <img src="${book.image || '/uploads/default.jpg'}" alt="${escapeHtml(book.title)}" />
        </div>
        <div class="book-info">
          <h3>${escapeHtml(book.title)}</h3>
          <p class="author">by ${escapeHtml(book.author)}</p>
          <div class="book-meta">
            <div class="meta-item">
              <span class="label">Borrowed:</span>
              <span class="value">${formatDate(book.borrow_date)}</span>
            </div>
            <div class="meta-item">
              <span class="label">Due Date:</span>
              <span class="value ${isOverdue ? 'overdue-text' : ''}">${formatDate(dueDate)}</span>
            </div>
            ${isOverdue ? `
              <div class="meta-item overdue-warning">
                <span class="label">⚠️ Overdue by:</span>
                <span class="value">${Math.abs(daysLeft)} days</span>
              </div>
              <div class="meta-item overdue-warning">
                <span class="label">Fine:</span>
                <span class="value">₹${fine}</span>
              </div>
            ` : `
              <div class="meta-item">
                <span class="label">Days Left:</span>
                <span class="value">${daysLeft} days</span>
              </div>
            `}
          </div>
        </div>
        <div class="book-actions">
          <button onclick="viewBookDetails(${book.book_id})" class="btn-secondary">
            📖 View Details
          </button>
          <button onclick="requestReturn(${book.id})" class="btn-return">
            📤 Request Return
          </button>
          <button onclick="requestRenewal(${book.id})" class="btn-renew">
            🔄 Request Renewal
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Request return
async function requestReturn(borrowId) {
  if (!confirm('Submit a return request for this book? The admin will approve it.')) return;
  
  try {
    const response = await apiFetch('/api/notifications/return-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrowId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit request');
    }
    
    const data = await response.json();
    alert('✅ ' + (data.message || 'Return request submitted successfully! Admin will review it.'));
    loadMyBooks(); // Refresh the list
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Request renewal
async function requestRenewal(borrowId) {
  if (!confirm('Submit a renewal request for this book? The admin will approve it.')) return;
  
  try {
    const response = await apiFetch('/api/notifications/renew-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrowId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit request');
    }
    
    const data = await response.json();
    alert('✅ ' + (data.message || 'Renewal request submitted successfully! Admin will review it.'));
    loadMyBooks(); // Refresh the list
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// View book details
function viewBookDetails(bookId) {
  // Call existing book details modal
  if (typeof openDetails === 'function') {
    openDetails(bookId);
  } else if (typeof showBookDetailsModal === 'function') {
    showBookDetailsModal(bookId);
  } else {
    alert('Book details feature not available');
  }
}

// Show My Books section
function showMyBooks() {
  // Hide main books view
  const mainView = document.getElementById('main-books-view');
  const myBooksView = document.getElementById('my-books-view');
  
  if (mainView) mainView.style.display = 'none';
  if (myBooksView) myBooksView.style.display = 'block';
  
  // Load books
  loadMyBooks();
  
  // Start auto-refresh (every 10 seconds)
  if (myBooksRefreshInterval) {
    clearInterval(myBooksRefreshInterval);
  }
  myBooksRefreshInterval = setInterval(loadMyBooks, 10000);
}

// Show main books view
function showMainBooks() {
  const mainView = document.getElementById('main-books-view');
  const myBooksView = document.getElementById('my-books-view');
  
  if (mainView) mainView.style.display = 'block';
  if (myBooksView) myBooksView.style.display = 'none';
  
  // Stop auto-refresh
  if (myBooksRefreshInterval) {
    clearInterval(myBooksRefreshInterval);
    myBooksRefreshInterval = null;
  }
  
  // Reload main books
  if (typeof loadBooks === 'function') {
    loadBooks();
  }
}

// Show error message
function showMyBooksError(message) {
  const container = document.getElementById('my-books-list');
  if (container) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Error</h3>
        <p>${escapeHtml(message)}</p>
        <button onclick="loadMyBooks()" class="btn-primary">Try Again</button>
      </div>
    `;
  }
}

// Format date helper
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and on My Books view
    const myBooksView = document.getElementById('my-books-view');
    if (myBooksView && myBooksView.style.display !== 'none') {
      loadMyBooks();
    }
  });
} else {
  // DOM already loaded
  const myBooksView = document.getElementById('my-books-view');
  if (myBooksView && myBooksView.style.display !== 'none') {
    loadMyBooks();
  }
}
