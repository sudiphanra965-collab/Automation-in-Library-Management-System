// New Features JavaScript
// Features: User Stats, Reading Lists, Reviews, Notifications, Reservations, PWA

// ==================== PWA REGISTRATION ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('✅ Service Worker registered:', reg.scope))
      .catch(err => console.error('❌ Service Worker registration failed:', err));
  });
}

// ==================== HELPER FUNCTIONS ====================
function getAPIBase() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const currentPort = window.location.port;
  
  if (currentPort === '5000' || currentPort === '5443') return '';
  
  const isHTTPS = protocol === 'https:';
  const port = isHTTPS ? '5443' : '5000';
  const proto = isHTTPS ? 'https' : 'http';
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${proto}://localhost:${port}`;
  }
  
  return `${proto}://${hostname}:${port}`;
}

const API_BASE = getAPIBase();

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ==================== FEATURE 5: USER STATS DASHBOARD ====================
window.loadUserStats = async function() {
  console.log('📊 loadUserStats() called');
  
  // Check if user is admin - don't load stats for admins
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (isAdmin) {
    console.log('⚠️ Admin user detected - skipping stats load');
    // Ensure stats section is hidden for admins
    const statsSection = document.getElementById('user-stats-section');
    if (statsSection) {
      statsSection.classList.add('hidden');
      statsSection.style.display = 'none';
    }
    return null;
  }
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No token found, skipping stats load');
      return null;
    }
    
    console.log('📡 Fetching user stats from /api/user/stats');
    const stats = await apiFetch('/api/user/stats');
    console.log('✅ User stats received:', stats);
    
    // Update stats display
    const elements = {
      'stat-total-borrowed': stats.totalBorrowed || 0,
      'stat-total-returned': stats.totalReturned || 0,
      'stat-currently-borrowed': stats.currentlyBorrowed || 0,
      'stat-reading-streak': stats.readingStreak || 0,
      'stat-favorite-category': stats.favoriteCategory || 'None',
      'stat-total-points': stats.totalPoints || 0
    };
    
    let updatedCount = 0;
    for (const [id, value] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        console.log(`✅ Updated ${id} to ${value}`);
        updatedCount++;
      } else {
        console.error(`❌ Element ${id} not found in DOM`);
      }
    }
    
    console.log(`📊 Updated ${updatedCount}/${Object.keys(elements).length} stat elements`);
    
    // Show the stats section (only for non-admin users)
    const statsSection = document.getElementById('user-stats-section');
    if (statsSection) {
      statsSection.classList.remove('hidden');
      console.log('✅ Stats section made visible');
    } else {
      console.error('❌ Stats section not found');
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to load user stats:', error);
    console.error('Error details:', error.message, error.stack);
    
    // Only show error for non-admin users
    const isAdminCheck = localStorage.getItem('isAdmin') === 'true';
    if (!isAdminCheck) {
      const statsSection = document.getElementById('user-stats-section');
      if (statsSection) {
        statsSection.innerHTML = `
          <div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c00;">
            <strong>⚠️ Failed to load stats:</strong> ${error.message}
          </div>
        `;
        statsSection.classList.remove('hidden');
      }
    }
    
    return null;
  }
}

// ==================== FEATURE 6: READING LISTS ====================
async function loadReadingLists() {
  try {
    const lists = await apiFetch('/api/reading-lists');
    const container = document.getElementById('reading-lists-container');
    
    if (!container) return;
    
    container.innerHTML = lists.map(list => `
      <div class="reading-list-card" data-list-id="${list.id}">
        <h3>${escapeHtml(list.name)}</h3>
        <p>${escapeHtml(list.description || '')}</p>
        <span class="book-count">${list.book_count} books</span>
        <button onclick="viewListBooks(${list.id})">View Books</button>
      </div>
    `).join('');
    
    return lists;
  } catch (error) {
    console.error('Failed to load reading lists:', error);
    return [];
  }
}

async function createReadingList(name, description) {
  try {
    await apiFetch('/api/reading-lists', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
    
    showToast('Reading list created successfully', 'success');
    await loadReadingLists();
  } catch (error) {
    showToast('Failed to create reading list: ' + error.message, 'error');
  }
}

async function addToReadingList(listId, bookId, notes = '') {
  try {
    await apiFetch(`/api/reading-lists/${listId}/books`, {
      method: 'POST',
      body: JSON.stringify({ bookId, notes })
    });
    
    showToast('Book added to list', 'success');
  } catch (error) {
    showToast('Failed to add book: ' + error.message, 'error');
  }
}

async function removeFromReadingList(listId, bookId) {
  try {
    await apiFetch(`/api/reading-lists/${listId}/books/${bookId}`, {
      method: 'DELETE'
    });
    
    showToast('Book removed from list', 'success');
  } catch (error) {
    showToast('Failed to remove book: ' + error.message, 'error');
  }
}

async function viewListBooks(listId) {
  try {
    const books = await apiFetch(`/api/reading-lists/${listId}/books`);
    
    // Display books in modal or dedicated section
    showListBooksModal(books, listId);
  } catch (error) {
    showToast('Failed to load list books: ' + error.message, 'error');
  }
}

// ==================== FEATURE 7: REVIEWS & RATINGS ====================
async function loadBookReviews(bookId) {
  try {
    const reviews = await apiFetch(`/api/books/${bookId}/reviews`);
    const container = document.getElementById('reviews-container');
    
    if (!container) return;
    
    if (reviews.length === 0) {
      container.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review!</p>';
      return;
    }
    
    container.innerHTML = reviews.map(review => `
      <div class="review-card">
        <div class="review-header">
          <span class="review-author">${escapeHtml(review.username)}</span>
          <span class="review-rating">${'⭐'.repeat(review.rating)}</span>
        </div>
        <p class="review-text">${escapeHtml(review.review_text || '')}</p>
        <div class="review-footer">
          <span class="review-date">${formatDate(review.created_at)}</span>
          <button onclick="markReviewHelpful(${review.id})" class="helpful-btn">
            👍 Helpful (${review.helpful_count})
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load reviews:', error);
  }
}

async function submitReview(bookId, rating, reviewText) {
  try {
    await apiFetch(`/api/books/${bookId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, reviewText })
    });
    
    showToast('Review submitted successfully', 'success');
    await loadBookReviews(bookId);
  } catch (error) {
    showToast('Failed to submit review: ' + error.message, 'error');
  }
}

async function markReviewHelpful(reviewId) {
  try {
    await apiFetch(`/api/reviews/${reviewId}/helpful`, {
      method: 'POST'
    });
    
    showToast('Marked as helpful', 'success');
  } catch (error) {
    showToast('Failed to mark as helpful: ' + error.message, 'error');
  }
}

// ==================== FEATURE 8: NOTIFICATIONS ====================
let notificationCheckInterval;

window.loadNotifications = async function() {
  try {
    const data = await apiFetch('/api/notifications');
    const { notifications, unreadCount } = data;
    
    // Update notification badge
    const badge = document.getElementById('notification-badge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    
    // Update notifications dropdown
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    if (notifications.length === 0) {
      container.innerHTML = '<p class="no-notifications">No notifications</p>';
      return;
    }
    
    container.innerHTML = notifications.map(notif => `
      <div class="notification-item ${notif.read ? 'read' : 'unread'}" data-id="${notif.id}">
        <div class="notification-icon">${getNotificationIcon(notif.type)}</div>
        <div class="notification-content">
          <h4>${escapeHtml(notif.title)}</h4>
          <p>${escapeHtml(notif.message)}</p>
          <span class="notification-time">${formatTimeAgo(notif.created_at)}</span>
        </div>
        ${!notif.read ? `<button onclick="markNotificationRead(${notif.id})" class="mark-read-btn">✓</button>` : ''}
      </div>
    `).join('');
    
    return { notifications, unreadCount };
  } catch (error) {
    console.error('Failed to load notifications:', error);
    return { notifications: [], unreadCount: 0 };
  }
}

async function markNotificationRead(notificationId) {
  try {
    await apiFetch(`/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
    
    await loadNotifications();
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiFetch('/api/notifications/read-all', {
      method: 'PUT'
    });
    
    await loadNotifications();
    showToast('All notifications marked as read', 'success');
  } catch (error) {
    showToast('Failed to mark all as read: ' + error.message, 'error');
  }
}

function getNotificationIcon(type) {
  const icons = {
    'due_date': '📅',
    'overdue': '⚠️',
    'return': '✅',
    'new_arrival': '📚',
    'reservation': '🔔',
    'achievement': '🏆'
  };
  return icons[type] || '🔔';
}

// Start notification polling
window.startNotificationPolling = function() {
  if (localStorage.getItem('token')) {
    loadNotifications();
    notificationCheckInterval = setInterval(loadNotifications, 60000); // Check every minute
  }
}

function stopNotificationPolling() {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }
}

// ==================== FEATURE 11: RESERVATIONS ====================
async function reserveBook(bookId) {
  try {
    const result = await apiFetch(`/api/books/${bookId}/reserve`, {
      method: 'POST'
    });
    
    showToast(`Reservation confirmed! You're #${result.position} in line`, 'success');
    return result;
  } catch (error) {
    showToast('Failed to reserve book: ' + error.message, 'error');
    throw error;
  }
}

async function loadReservations() {
  try {
    const reservations = await apiFetch('/api/reservations');
    const container = document.getElementById('reservations-container');
    
    if (!container) return;
    
    if (reservations.length === 0) {
      container.innerHTML = '<p class="no-reservations">No active reservations</p>';
      return;
    }
    
    container.innerHTML = reservations.map(res => `
      <div class="reservation-card">
        <img src="${res.image}" alt="${escapeHtml(res.title)}" />
        <div class="reservation-info">
          <h4>${escapeHtml(res.title)}</h4>
          <p>${escapeHtml(res.author)}</p>
          <span class="reservation-status ${res.status}">
            ${res.status === 'available' ? '✅ Available Now!' : `⏳ Position #${res.position}`}
          </span>
          ${res.status === 'available' ? 
            `<button onclick="borrowReservedBook(${res.book_id})" class="borrow-btn">Borrow Now</button>` :
            `<button onclick="cancelReservation(${res.id})" class="cancel-btn">Cancel</button>`
          }
        </div>
      </div>
    `).join('');
    
    return reservations;
  } catch (error) {
    console.error('Failed to load reservations:', error);
    return [];
  }
}

async function cancelReservation(reservationId) {
  try {
    await apiFetch(`/api/reservations/${reservationId}`, {
      method: 'DELETE'
    });
    
    showToast('Reservation cancelled', 'success');
    await loadReservations();
  } catch (error) {
    showToast('Failed to cancel reservation: ' + error.message, 'error');
  }
}

// ==================== FEATURE 15: RECOMMENDATIONS ====================
window.loadRecommendations = async function() {
  try {
    const recs = await apiFetch('/api/recommendations');
    
    // Display different recommendation sections
    displayRecommendationSection('based-on-history', recs.basedOnHistory, 'Based on Your Reading History');
    displayRecommendationSection('favorite-authors', recs.favoriteAuthors, 'More from Your Favorite Authors');
    displayRecommendationSection('trending', recs.trending, 'Trending This Month');
    displayRecommendationSection('top-rated', recs.topRated, 'Top Rated Books');
    
    return recs;
  } catch (error) {
    console.error('Failed to load recommendations:', error);
    return null;
  }
}

function displayRecommendationSection(containerId, books, title) {
  const container = document.getElementById(containerId);
  if (!container || !books || books.length === 0) return;
  
  container.innerHTML = `
    <h3 class="recommendation-title">${title}</h3>
    <div class="recommendation-grid">
      ${books.map(book => `
        <div class="book-card" onclick="showBookDetails(${book.id})">
          <img src="${book.image}" alt="${escapeHtml(book.title)}" />
          <h4>${escapeHtml(book.title)}</h4>
          <p>${escapeHtml(book.author)}</p>
          ${book.rating ? `<span class="rating">⭐ ${book.rating.toFixed(1)}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return formatDate(dateString);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showListBooksModal(books, listId) {
  // Create and show modal with list books
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
      <h2>Books in List</h2>
      <div class="list-books-grid">
        ${books.map(book => `
          <div class="book-card">
            <img src="${book.image}" alt="${escapeHtml(book.title)}" />
            <h4>${escapeHtml(book.title)}</h4>
            <p>${escapeHtml(book.author)}</p>
            ${book.notes ? `<p class="notes">${escapeHtml(book.notes)}</p>` : ''}
            <button onclick="removeFromReadingList(${listId}, ${book.id}); this.closest('.book-card').remove();">Remove</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  
  if (token) {
    // Load user-specific features
    loadUserStats();
    loadNotifications();
    startNotificationPolling();
    loadRecommendations();
  }
});

// Clean up on logout
window.addEventListener('logout', () => {
  stopNotificationPolling();
});
