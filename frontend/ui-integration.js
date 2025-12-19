// UI Integration for New Features
// This file connects the new features to the existing UI

// ==================== NAVIGATION FUNCTIONS ====================

function showMainBooks() {
  // Hide all sections
  document.getElementById('main-books-section').classList.remove('hidden');
  document.getElementById('my-books-section').classList.add('hidden');
  document.getElementById('reading-lists-section').classList.add('hidden');
  document.getElementById('reservations-section').classList.add('hidden');
  document.getElementById('user-stats-page').classList.add('hidden');
  
  // Show user stats and recommendations on main page (only for regular users, not admins)
  if (localStorage.getItem('token')) {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      document.getElementById('user-stats-section').classList.remove('hidden');
      document.getElementById('recommendations-section').classList.remove('hidden');
    } else {
      // Hide user-only sections for admins
      document.getElementById('user-stats-section').classList.add('hidden');
      document.getElementById('recommendations-section').classList.add('hidden');
    }
  }
}

function showUserStats() {
  // Hide all sections
  document.getElementById('main-books-section').classList.add('hidden');
  document.getElementById('my-books-section').classList.add('hidden');
  document.getElementById('reading-lists-section').classList.add('hidden');
  document.getElementById('reservations-section').classList.add('hidden');
  document.getElementById('user-stats-section').classList.add('hidden');
  document.getElementById('recommendations-section').classList.add('hidden');
  document.getElementById('user-stats-page').classList.remove('hidden');
  
  // Load stats
  loadUserStatsPage();
  closeUserMenu();
}

function showReadingLists() {
  // Hide all sections
  document.getElementById('main-books-section').classList.add('hidden');
  document.getElementById('my-books-section').classList.add('hidden');
  document.getElementById('reading-lists-section').classList.remove('hidden');
  document.getElementById('reservations-section').classList.add('hidden');
  document.getElementById('user-stats-page').classList.add('hidden');
  document.getElementById('user-stats-section').classList.add('hidden');
  document.getElementById('recommendations-section').classList.add('hidden');
  
  // Load reading lists
  loadReadingLists();
  closeUserMenu();
}

function showReservations() {
  // Hide all sections
  document.getElementById('main-books-section').classList.add('hidden');
  document.getElementById('my-books-section').classList.add('hidden');
  document.getElementById('reading-lists-section').classList.add('hidden');
  document.getElementById('reservations-section').classList.remove('hidden');
  document.getElementById('user-stats-page').classList.add('hidden');
  document.getElementById('user-stats-section').classList.add('hidden');
  document.getElementById('recommendations-section').classList.add('hidden');
  
  // Load reservations
  loadReservations();
  closeUserMenu();
}

// ==================== USER MENU ====================

function toggleUserMenu() {
  const dropdown = document.getElementById('user-menu-dropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function closeUserMenu() {
  document.getElementById('user-menu-dropdown').style.display = 'none';
}

// Close user menu when clicking outside
document.addEventListener('click', (e) => {
  const userMenu = document.getElementById('user-menu-container');
  if (userMenu && !userMenu.contains(e.target)) {
    closeUserMenu();
  }
});

// ==================== NOTIFICATIONS ====================

function toggleNotifications() {
  const dropdown = document.getElementById('notifications-dropdown');
  dropdown.classList.toggle('show');
  
  // Load notifications when opening
  if (dropdown.classList.contains('show')) {
    loadNotifications();
  }
}

// Close notifications when clicking outside
document.addEventListener('click', (e) => {
  const notifContainer = document.getElementById('notification-container');
  if (notifContainer && !notifContainer.contains(e.target)) {
    document.getElementById('notifications-dropdown').classList.remove('show');
  }
});

// ==================== AUTH INTEGRATION ====================

// Override existing login success handler
const originalLoginSuccess = window.handleLoginSuccess || function() {};

window.handleLoginSuccess = function(data) {
  // Call original handler
  if (originalLoginSuccess !== window.handleLoginSuccess) {
    originalLoginSuccess(data);
  }
  
  // Show new features UI
  const username = data.username || localStorage.getItem('username');
  document.getElementById('notification-container').classList.remove('hidden');
  document.getElementById('user-menu-container').classList.remove('hidden');
  document.getElementById('user-menu-name').textContent = username;
  document.getElementById('user-menu-username').textContent = username;
  
  // Show user stats and recommendations (only for regular users, not admins)
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (!isAdmin) {
    document.getElementById('user-stats-section').classList.remove('hidden');
    document.getElementById('recommendations-section').classList.remove('hidden');
    // Load user-specific data
    loadUserStats();
    loadRecommendations();
  } else {
    // Hide user-only sections for admins
    document.getElementById('user-stats-section').classList.add('hidden');
    document.getElementById('recommendations-section').classList.add('hidden');
    // Hide user-only menu items for admins
    document.querySelectorAll('.user-only-menu-item').forEach(item => {
      item.style.display = 'none';
    });
  }
  
  // Load admin notifications
  loadNotifications();
  startNotificationPolling();
};

// Override logout handler
const originalLogout = window.logout || function() {};

window.logout = function() {
  // Call original handler
  if (originalLogout !== window.logout) {
    originalLogout();
  }
  
  // Hide new features UI
  document.getElementById('notification-container').classList.add('hidden');
  document.getElementById('user-menu-container').classList.add('hidden');
  document.getElementById('user-stats-section').classList.add('hidden');
  document.getElementById('recommendations-section').classList.add('hidden');
  
  // Stop polling
  stopNotificationPolling();
  
  // Show main books
  showMainBooks();
};

// ==================== BOOK CARD ENHANCEMENTS ====================

// Add buttons to book cards
function enhanceBookCard(bookCard, book) {
  // Add "Add to List" button
  const addToListBtn = document.createElement('button');
  addToListBtn.textContent = '➕ Add to List';
  addToListBtn.className = 'add-to-list-btn';
  addToListBtn.style.cssText = 'background: #4caf50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px; width: 100%;';
  addToListBtn.onclick = (e) => {
    e.stopPropagation();
    showAddToListModal(book.id, book.title);
  };
  
  // Add "Write Review" button if user has borrowed this book
  const reviewBtn = document.createElement('button');
  reviewBtn.textContent = '⭐ Write Review';
  reviewBtn.className = 'write-review-btn';
  reviewBtn.style.cssText = 'background: #ff9800; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 4px; width: 100%;';
  reviewBtn.onclick = (e) => {
    e.stopPropagation();
    showReviewModal(book.id, book.title);
  };
  
  // Add "Reserve" button if book is unavailable
  if (!book.available) {
    const reserveBtn = document.createElement('button');
    reserveBtn.textContent = '📅 Reserve';
    reserveBtn.className = 'reserve-btn';
    reserveBtn.style.cssText = 'background: #2196f3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 4px; width: 100%;';
    reserveBtn.onclick = (e) => {
      e.stopPropagation();
      handleReserveBook(book.id, book.title);
    };
    bookCard.appendChild(reserveBtn);
  }
  
  // Only show these buttons if user is logged in
  if (localStorage.getItem('token')) {
    bookCard.appendChild(addToListBtn);
    bookCard.appendChild(reviewBtn);
  }
}

// ==================== MODAL FUNCTIONS ====================

function showAddToListModal(bookId, bookTitle) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
      <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Add "${bookTitle}" to List</h3>
      <div id="lists-selection" style="max-height: 300px; overflow-y: auto;">
        <p style="text-align: center; color: #999;">Loading lists...</p>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <button onclick="this.closest('.modal').remove()" style="background: #f5f5f5; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Load user's lists
  apiFetch('/api/reading-lists').then(lists => {
    const container = modal.querySelector('#lists-selection');
    container.innerHTML = lists.map(list => `
      <div onclick="addBookToList(${list.id}, ${bookId}, '${bookTitle}', this.closest('.modal'))" style="padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="font-weight: 600;">${escapeHtml(list.name)}</div>
        <div style="font-size: 12px; color: #666;">${list.book_count} books</div>
      </div>
    `).join('') + `
      <div onclick="showCreateListModal(${bookId})" style="padding: 12px; border: 2px dashed #4caf50; border-radius: 8px; margin-top: 8px; cursor: pointer; text-align: center; color: #4caf50; font-weight: 600;">
        ➕ Create New List
      </div>
    `;
  }).catch(err => {
    modal.querySelector('#lists-selection').innerHTML = `<p style="color: #f44336;">Failed to load lists</p>`;
  });
}

async function addBookToList(listId, bookId, bookTitle, modal) {
  try {
    await addToReadingList(listId, bookId);
    showToast(`"${bookTitle}" added to list!`, 'success');
    modal.remove();
  } catch (error) {
    showToast('Failed to add book to list', 'error');
  }
}

function showCreateListModal(bookIdToAdd = null) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
      <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Create New Reading List</h3>
      <form id="create-list-form">
        <input type="text" id="list-name" placeholder="List Name" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; font-size: 14px;" />
        <textarea id="list-description" placeholder="Description (optional)" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px; font-size: 14px; resize: vertical;" rows="3"></textarea>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" onclick="this.closest('.modal').remove()" style="background: #f5f5f5; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Create List</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#create-list-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = modal.querySelector('#list-name').value;
    const description = modal.querySelector('#list-description').value;
    
    try {
      await createReadingList(name, description);
      showToast('List created successfully!', 'success');
      modal.remove();
      
      // If we're on the reading lists page, reload
      if (!document.getElementById('reading-lists-section').classList.contains('hidden')) {
        loadReadingLists();
      }
      
      // If we need to add a book to this list
      if (bookIdToAdd) {
        // Reload the add to list modal
        setTimeout(() => showAddToListModal(bookIdToAdd, ''), 300);
      }
    } catch (error) {
      showToast('Failed to create list', 'error');
    }
  };
}

function showReviewModal(bookId, bookTitle) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
      <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Review "${bookTitle}"</h3>
      <form id="review-form">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600;">Rating:</label>
          <div class="rating-input" style="display: flex; gap: 8px;">
            <span class="star" data-rating="1" onclick="selectRating(1, this.parentElement)">⭐</span>
            <span class="star" data-rating="2" onclick="selectRating(2, this.parentElement)">⭐</span>
            <span class="star" data-rating="3" onclick="selectRating(3, this.parentElement)">⭐</span>
            <span class="star" data-rating="4" onclick="selectRating(4, this.parentElement)">⭐</span>
            <span class="star" data-rating="5" onclick="selectRating(5, this.parentElement)">⭐</span>
          </div>
          <input type="hidden" id="rating-value" required />
        </div>
        <textarea id="review-text" placeholder="Write your review (optional)" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px; font-size: 14px; resize: vertical;" rows="4"></textarea>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" onclick="this.closest('.modal').remove()" style="background: #f5f5f5; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" style="background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Submit Review</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#review-form').onsubmit = async (e) => {
    e.preventDefault();
    const rating = parseInt(modal.querySelector('#rating-value').value);
    const reviewText = modal.querySelector('#review-text').value;
    
    if (!rating) {
      showToast('Please select a rating', 'error');
      return;
    }
    
    try {
      await submitReview(bookId, rating, reviewText);
      showToast('Review submitted successfully!', 'success');
      modal.remove();
    } catch (error) {
      showToast('Failed to submit review', 'error');
    }
  };
}

function selectRating(rating, container) {
  container.querySelectorAll('.star').forEach((star, index) => {
    if (index < rating) {
      star.classList.add('selected');
      star.style.color = '#ffa000';
    } else {
      star.classList.remove('selected');
      star.style.color = '#ddd';
    }
  });
  container.parentElement.querySelector('#rating-value').value = rating;
}

async function handleReserveBook(bookId, bookTitle) {
  if (!confirm(`Reserve "${bookTitle}"? You'll be notified when it becomes available.`)) {
    return;
  }
  
  try {
    const result = await reserveBook(bookId);
    showToast(`Reservation confirmed! You're #${result.position} in line`, 'success');
  } catch (error) {
    // Error already shown by reserveBook function
  }
}

// ==================== LOAD USER STATS PAGE ====================

async function loadUserStatsPage() {
  try {
    const stats = await apiFetch('/api/user/stats');
    
    // Update page stats
    document.getElementById('stat-page-total-borrowed').textContent = stats.totalBorrowed || 0;
    document.getElementById('stat-page-total-returned').textContent = stats.totalReturned || 0;
    document.getElementById('stat-page-currently-borrowed').textContent = stats.currentlyBorrowed || 0;
    document.getElementById('stat-page-reading-streak').textContent = stats.readingStreak || 0;
    document.getElementById('stat-page-favorite-category').textContent = stats.favoriteCategory || 'None';
    document.getElementById('stat-page-total-points').textContent = stats.totalPoints || 0;
  } catch (error) {
    console.error('Failed to load user stats page:', error);
  }
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  
  if (token && username) {
    // Show new features UI
    document.getElementById('notification-container').classList.remove('hidden');
    document.getElementById('user-menu-container').classList.remove('hidden');
    document.getElementById('user-menu-name').textContent = username;
    document.getElementById('user-menu-username').textContent = username;
    
    // Only show stats for regular users, not admins
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      document.getElementById('user-stats-section').classList.remove('hidden');
      document.getElementById('recommendations-section').classList.remove('hidden');
      // Load user-specific data
      loadUserStats();
      loadRecommendations();
    } else {
      // Hide user-only sections for admins
      document.getElementById('user-stats-section').classList.add('hidden');
      document.getElementById('recommendations-section').classList.add('hidden');
      // Hide user-only menu items for admins
      document.querySelectorAll('.user-only-menu-item').forEach(item => {
        item.style.display = 'none';
      });
    }
    
    // Load admin notifications
    loadNotifications();
    startNotificationPolling();
  }
});

// ==================== ADMIN NOTIFICATIONS ====================

async function loadNotifications() {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  if (!isAdmin) {
    // Regular users don't see notifications
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) return;
    
    const notifications = await response.json();
    updateNotificationBadge(notifications.length);
    renderNotifications(notifications);
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function renderNotifications(notifications) {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  
  if (notifications.length === 0) {
    list.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No pending requests</div>';
    return;
  }
  
  list.innerHTML = notifications.map(notif => {
    const isReturn = notif.type === 'return_request';
    const isRenew = notif.type === 'renew_request';
    const isBorrow = notif.type === 'borrow_request';
    const icon = isBorrow ? '📚' : (isReturn ? '📤' : '🔄');
    const title = isBorrow ? 'Borrow Request' : (isReturn ? 'Return Request' : 'Renewal Request');
    const bgColor = isBorrow ? '#f5f3ff' : (isReturn ? '#eff6ff' : '#f0fdf4');
    const approveLabel = isBorrow ? '✅ Approve Borrow' : '✅ Approve';
    
    return `
      <div style="padding: 12px; border-bottom: 1px solid #eee; background: ${bgColor};">
        <div style="display: flex; align-items: start; gap: 10px;">
          <span style="font-size: 24px;">${icon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
              <strong>${notif.username}</strong> - ${notif.book_title}
            </div>
            <div style="font-size: 12px; color: #999;">${formatNotificationTime(notif.created_at)}</div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button onclick="approveNotification(${notif.id}, '${notif.type}')" 
                      style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                ${approveLabel}
              </button>
              <button onclick="rejectNotification(${notif.id})" 
                      style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function refreshAdminPanels() {
  if (typeof loadNotifications === 'function') loadNotifications();
  if (typeof loadBorrowed === 'function') loadBorrowed();
  if (typeof loadBorrowHistory === 'function') loadBorrowHistory();
  if (typeof loadStats === 'function') loadStats();
  if (typeof loadUserManagementStats === 'function') loadUserManagementStats();
  if (typeof loadDashboard === 'function') loadDashboard();
}

async function approveNotification(notificationId, type) {
  let endpoint = 'approve-renew';
  if (type === 'return_request') endpoint = 'approve-return';
  if (type === 'borrow_request') endpoint = 'approve-borrow';
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to approve');
    }
    
    alert('✅ ' + (data.message || 'Request approved'));
    loadNotifications();
    refreshAdminPanels();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

async function rejectNotification(notificationId) {
  if (!confirm('Reject this request?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to reject');
    }
    
    alert('✅ ' + data.message);
    loadNotifications();
    refreshAdminPanels();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

function formatNotificationTime(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function startNotificationPolling() {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (!isAdmin) return;
  
  // Poll every 10 seconds
  setInterval(loadNotifications, 10000);
}

function markAllNotificationsRead() {
  // For now, just close the dropdown
  document.getElementById('notifications-dropdown').classList.remove('show');
}

// Make functions globally available
window.showMainBooks = showMainBooks;
window.showUserStats = showUserStats;
window.showReadingLists = showReadingLists;
window.showReservations = showReservations;
window.toggleUserMenu = toggleUserMenu;
window.toggleNotifications = toggleNotifications;
window.showAddToListModal = showAddToListModal;
window.showCreateListModal = showCreateListModal;
window.showReviewModal = showReviewModal;
window.selectRating = selectRating;
window.loadNotifications = loadNotifications;
window.approveNotification = approveNotification;
window.rejectNotification = rejectNotification;
window.markAllNotificationsRead = markAllNotificationsRead;
window.addBookToList = addBookToList;
window.handleReserveBook = handleReserveBook;
window.enhanceBookCard = enhanceBookCard;
