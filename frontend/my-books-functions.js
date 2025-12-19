// ==================== MY BOOKS REQUEST FUNCTIONS ====================

// Request return
async function requestReturn(borrowId) {
  if (!confirm('Submit a return request for this book? The admin will approve it.')) return;
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in first.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/notifications/return-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ borrowId })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit request');
    }
    
    alert('✅ ' + (data.message || 'Return request submitted successfully! Admin will review it.'));
    
    // Refresh the list
    if (typeof loadMyBooks === 'function') {
      loadMyBooks();
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// Request renewal
async function requestRenewal(borrowId) {
  if (!confirm('Submit a renewal request for this book? The admin will approve it.')) return;
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in first.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/notifications/renew-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ borrowId })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit request');
    }
    
    alert('✅ ' + (data.message || 'Renewal request submitted successfully! Admin will review it.'));
    
    // Refresh the list
    if (typeof loadMyBooks === 'function') {
      loadMyBooks();
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// View book details
function viewBookDetails(bookId) {
  // Try to find and call the book details function
  if (typeof openDetails === 'function') {
    openDetails(bookId);
  } else if (typeof showBookDetailsModal === 'function') {
    showBookDetailsModal(bookId);
  } else if (typeof openBookDetails === 'function') {
    openBookDetails(bookId);
  } else {
    // Fallback: open book page in new tab
    window.open(`/book/${bookId}`, '_blank');
  }
}
