// Admin Notification System
// Loads and displays pending registration count

async function loadNotifications() {
  try {
    const response = await fetch('/api/admin/notifications', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Failed to load notifications');
      return;
    }
    
    const data = await response.json();
    console.log('📬 Notifications loaded:', data);
    
    updateNotificationBadge(data.pendingCount);
    
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;
  
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
    console.log(`🔔 Notification badge updated: ${count} pending registrations`);
  } else {
    badge.classList.add('hidden');
    console.log('🔕 No pending registrations');
  }
}

// Load notifications on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔔 Notification system initialized');
  loadNotifications();
  
  // Refresh every 30 seconds
  setInterval(loadNotifications, 30000);
});

console.log('✅ Admin notifications script loaded');
