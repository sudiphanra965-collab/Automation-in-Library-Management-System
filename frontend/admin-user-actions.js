// Admin User Management Actions
// Functions for View, Make Admin, and Delete buttons

// View user details in a beautiful modal with photo
function viewUserDetails(id, username, email, fullName, rollNo, mobileNo, isAdmin, borrowedCount, userPhoto) {
  // Create beautiful modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';
  
  const photoUrl = userPhoto && userPhoto !== 'N/A' ? `/uploads/${userPhoto}` : null;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideIn 0.3s ease-out; margin: auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        ${photoUrl ? `
          <div style="width: 120px; height: 120px; margin: 0 auto 16px; border-radius: 50%; overflow: hidden; border: 4px solid #3b82f6; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);">
            <img src="${photoUrl}" alt="User Photo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:48px;\\'>${isAdmin ? '👑' : '👤'}</div>'">
          </div>
        ` : `
          <div style="width: 120px; height: 120px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);">
            <span style="font-size: 64px;">${isAdmin ? '👑' : '👤'}</span>
          </div>
        `}
        <h2 style="font-size: 28px; font-weight: bold; color: #1f2937; margin: 0;">User Details</h2>
      </div>
      
      <!-- Vertical Layout -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- User ID -->
        <div style="background: linear-gradient(135deg, #f3f4f6, #e5e7eb); padding: 16px; border-radius: 12px; border-left: 4px solid #3b82f6;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">User ID</p>
          <p style="font-size: 24px; color: #1f2937; margin: 0; font-weight: bold;">#${id}</p>
        </div>
        
        <!-- Username -->
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; border-left: 4px solid #10b981;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">Username</p>
          <p style="font-size: 18px; color: #1f2937; margin: 0; font-weight: 600;">${username}</p>
        </div>
        
        ${fullName !== 'N/A' ? `
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; border-left: 4px solid #8b5cf6;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">Full Name</p>
          <p style="font-size: 18px; color: #1f2937; margin: 0; font-weight: 600;">${fullName}</p>
        </div>
        ` : ''}
        
        ${rollNo !== 'N/A' ? `
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; border-left: 4px solid #f59e0b;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">Roll Number</p>
          <p style="font-size: 18px; color: #1f2937; margin: 0; font-weight: 600;">${rollNo}</p>
        </div>
        ` : ''}
        
        ${mobileNo !== 'N/A' ? `
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; border-left: 4px solid #ec4899;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">Mobile Number</p>
          <p style="font-size: 18px; color: #1f2937; margin: 0; font-weight: 600;">📱 ${mobileNo}</p>
        </div>
        ` : ''}
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; border-left: 4px solid #06b6d4;">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">Email</p>
          <p style="font-size: 16px; color: #1f2937; margin: 0; font-weight: 500; word-break: break-all;">📧 ${email}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; border-left: 4px solid ${isAdmin ? '#7c3aed' : '#3b82f6'};">
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase;">Role</p>
          <span style="background: ${isAdmin ? '#f3e8ff' : '#dbeafe'}; color: ${isAdmin ? '#7c3aed' : '#2563eb'}; padding: 8px 16px; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">
            ${isAdmin ? '👑 Administrator' : '👤 User'}
          </span>
        </div>
        
        <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 16px; border-radius: 12px; border-left: 4px solid #f59e0b;">
          <p style="font-size: 12px; color: #78350f; margin: 0 0 4px 0; font-weight: 600; text-transform: uppercase;">Books Borrowed</p>
          <p style="font-size: 24px; color: #78350f; margin: 0; font-weight: bold;">📚 ${borrowedCount}</p>
        </div>
      </div>
      
      <button onclick="this.closest('div[style*=fixed]').remove()" style="width: 100%; background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 24px; transition: all 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
        Close
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
}

// Make user admin
async function makeUserAdmin(userId, username) {
  if (!confirm(`Are you sure you want to make "${username}" an admin?\n\nThis will give them full administrative privileges.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/make-admin/${userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to make user admin');
    }
    
    const data = await response.json();
    alert(`✅ ${username} is now an admin!`);
    
    // Reload users table
    if (typeof loadUsersData === 'function') {
      loadUsersData();
    }
  } catch (error) {
    console.error('Make admin error:', error);
    alert(`❌ Failed to make user admin: ${error.message}`);
  }
}

// Remove admin privileges (demote to user)
async function removeAdmin(userId, username) {
  if (!confirm(`Are you sure you want to remove admin privileges from "${username}"?\n\nThey will become a regular user.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/remove-admin/${userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove admin');
    }
    
    const data = await response.json();
    alert(`✅ ${username} is now a regular user!`);
    
    // Reload users table
    if (typeof loadUsersData === 'function') {
      loadUsersData();
    }
  } catch (error) {
    console.error('Remove admin error:', error);
    alert(`❌ Failed to remove admin: ${error.message}`);
  }
}

// Delete user
async function deleteUser(userId, username) {
  if (!confirm(`⚠️ WARNING: Are you sure you want to DELETE user "${username}"?\n\nThis action cannot be undone!`)) {
    return;
  }
  
  // Double confirmation
  const confirmText = prompt(`Type "${username}" to confirm deletion:`);
  if (confirmText !== username) {
    alert('Deletion cancelled - username did not match');
    return;
  }
  
  try {
    const hostname = window.location.hostname;
    const port = window.location.port;
    let apiBase = '';
    if (port === '5443' || port === '5000') {
      apiBase = '';
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      apiBase = 'https://localhost:5443';
    } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      apiBase = `https://${hostname}:5443`;
    } else {
      // Hosted deployments: expect /api/* reverse-proxy
      apiBase = '';
    }
    const response = await fetch(`${apiBase}/api/admin/user/${userId}?t=${Date.now()}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
    
    const data = await response.json();
    alert(`✅ User "${username}" has been deleted`);
    
    // Reload users table
    if (typeof loadUsersData === 'function') {
      loadUsersData();
    }
    // Also refresh dashboard stats immediately
    if (typeof loadUserManagementStats === 'function') {
      loadUserManagementStats();
    }
  } catch (error) {
    console.error('Delete user error:', error);
    alert(`❌ Failed to delete user: ${error.message}`);
  }
}

console.log('✅ Admin user actions loaded');
