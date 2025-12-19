// Admin User and Fine Management
// This file handles user management and fine management functionality

function getAPIBase() {
  const hostname = window.location.hostname;
  const port = window.location.port;
  if (port === '5443' || port === '5000') return '';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'https://localhost:5443';
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (isIPv4) return `https://${hostname}:5443`;
  return '';
}
// Avoid global const collisions (admin.js also defines API_BASE).
const API_BASE_FINES = (window.API_BASE != null) ? window.API_BASE : getAPIBase();

let allUsers = [];
let allFines = [];

// ==================== USER MANAGEMENT ====================

async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/users?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load users');
    }
    
    allUsers = await response.json();
    renderUsers(allUsers);
    updateUserStats(allUsers);
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('users-table-body').innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-red-500">
          Error loading users: ${error.message}
        </td>
      </tr>
    `;
  }
}

function updateUserStats(users) {
  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.is_admin).length;
  const adminUsers = users.filter(u => u.is_admin).length;
  
  document.getElementById('total-users').textContent = totalUsers;
  document.getElementById('active-users').textContent = activeUsers;
  document.getElementById('admin-users').textContent = adminUsers;
  
  // Get total borrowed books count
  fetch(`${API_BASE_FINES}/api/admin/all-borrowed?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
  .then(res => res.json())
  .then(borrowed => {
    document.getElementById('total-borrowed').textContent = borrowed.length;
  })
  .catch(err => console.error('Error loading borrowed count:', err));
}

function renderUsers(users) {
  const tbody = document.getElementById('users-table-body');
  
  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-gray-500">
          No users found
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr class="hover:bg-gray-50">
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
        <button onclick="viewUserDetails(${user.id})" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
          👁️ View
        </button>
        ${!user.is_admin ? `
          <button onclick="toggleUserRole(${user.id}, ${user.is_admin})" class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
            👑 Make Admin
          </button>
        ` : ''}
        ${!user.is_admin ? `
          <button onclick="deleteUser(${user.id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
            🗑️ Delete
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function filterUsers() {
  const usernameSearch = document.getElementById('user-search-username').value.toLowerCase();
  const emailSearch = document.getElementById('user-search-email').value.toLowerCase();
  const roleFilter = document.getElementById('user-filter-role').value;
  
  const filtered = allUsers.filter(user => {
    const matchesUsername = !usernameSearch || user.username.toLowerCase().includes(usernameSearch);
    const matchesEmail = !emailSearch || (user.email && user.email.toLowerCase().includes(emailSearch));
    const matchesRole = !roleFilter || user.is_admin.toString() === roleFilter;
    
    return matchesUsername && matchesEmail && matchesRole;
  });
  
  renderUsers(filtered);
}

async function viewUserDetails(userId) {
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/user/${userId}/details`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load user details');
    }
    
    const user = await response.json();
    
    alert(`User Details:\n\nID: ${user.id}\nUsername: ${user.username}\nEmail: ${user.email || 'N/A'}\nRole: ${user.is_admin ? 'Admin' : 'User'}\nBooks Borrowed: ${user.borrowed_count || 0}`);
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function toggleUserRole(userId, currentIsAdmin) {
  if (!confirm(`Make this user an admin?`)) return;
  
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/user/${userId}/toggle-role`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update role');
    }
    
    alert('✅ User role updated successfully!');
    loadUsers();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
  
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/user/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete user');
    }
    
    alert('✅ User deleted successfully!');
    loadUsers();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

function refreshUsers() {
  loadUsers();
}

// ==================== FINE MANAGEMENT ====================

async function loadFines() {
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/fines`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load fines');
    }
    
    allFines = await response.json();
    renderFines(allFines);
    updateFineStats(allFines);
  } catch (error) {
    console.error('Error loading fines:', error);
    document.getElementById('fines-table-body').innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-red-500">
          Error loading fines: ${error.message}
        </td>
      </tr>
    `;
  }
}

function updateFineStats(fines) {
  const totalFines = fines.reduce((sum, fine) => sum + fine.fine_amount, 0);
  const paidFines = fines.filter(f => f.fine_paid).reduce((sum, fine) => sum + fine.fine_amount, 0);
  const pendingFines = totalFines - paidFines;
  const overdueCount = fines.length;
  
  document.getElementById('total-fines').textContent = `₹${totalFines}`;
  document.getElementById('paid-fines').textContent = `₹${paidFines}`;
  document.getElementById('pending-fines').textContent = `₹${pendingFines}`;
  document.getElementById('overdue-count').textContent = overdueCount;
}

function renderFines(fines) {
  const tbody = document.getElementById('fines-table-body');
  
  if (fines.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
          No overdue books with fines
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = fines.map(fine => {
    const isPaid = fine.fine_paid;
    
    return `
      <tr class="hover:bg-gray-50">
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
          <button onclick="sendFineReminder(${fine.user_id}, '${escapeHtml(fine.username)}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
            📧 Remind
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function markFinePaid(borrowId) {
  if (!confirm('Mark this fine as paid?')) return;
  
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/fine/${borrowId}/mark-paid`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to mark fine as paid');
    }
    
    alert('✅ Fine marked as paid!');
    loadFines();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

async function sendFineReminder(userId, username) {
  if (!confirm(`Send fine reminder to ${username}?`)) return;
  
  try {
    const response = await fetch(`${API_BASE_FINES}/api/admin/fine/${userId}/send-reminder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reminder');
    }
    
    alert('✅ Reminder sent successfully!');
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

function refreshFines() {
  loadFines();
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// ==================== INITIALIZATION ====================

// Load data when switching to these views
document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin User & Fine Management loaded');
  
  // Listen for view changes
  document.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', function() {
      const view = this.getAttribute('data-view');
      console.log('View changed to:', view);
      
      if (view === 'users') {
        setTimeout(() => {
          console.log('Loading users...');
          loadUsers();
        }, 200);
      } else if (view === 'fines') {
        setTimeout(() => {
          console.log('Loading fines...');
          loadFines();
        }, 200);
      }
    });
  });
  
  // Also check if we're already on one of these views
  const currentView = document.querySelector('.admin-view:not([style*="display: none"])');
  if (currentView) {
    const viewId = currentView.id;
    console.log('Current view on load:', viewId);
    
    if (viewId === 'view-users') {
      setTimeout(loadUsers, 500);
    } else if (viewId === 'view-fines') {
      setTimeout(loadFines, 500);
    }
  }
});

// Make functions globally available
window.loadUsers = loadUsers;
window.filterUsers = filterUsers;
window.viewUserDetails = viewUserDetails;
window.toggleUserRole = toggleUserRole;
window.deleteUser = deleteUser;
window.refreshUsers = refreshUsers;
window.loadFines = loadFines;
window.markFinePaid = markFinePaid;
window.sendFineReminder = sendFineReminder;
window.refreshFines = refreshFines;
