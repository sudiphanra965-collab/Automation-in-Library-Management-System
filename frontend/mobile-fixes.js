/* =================================================================
   MOBILE FIXES - Complete Solution for All Mobile Issues
   ================================================================= */

(function() {
  'use strict';
  
  console.log('🔧 Mobile Fixes Loaded');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileFixes);
  } else {
    initMobileFixes();
  }
  
  function initMobileFixes() {
    console.log('🔧 Initializing Mobile Fixes...');
    
    // Fix 1: Category Carousel Scrolling
    fixCategoryCarousel();
    
    // Fix 2: Login Form Issues
    fixLoginForms();
    
    // Fix 3: QR Code Generation
    enhanceQRCodeGeneration();
    
    // Fix 4: Database Connection Logging
    addDatabaseLogging();
    
    // Fix 5: My Books / Borrowed Books
    fixMyBooksSection();
    
    console.log('✅ Mobile Fixes Applied');
  }
  
  // ============= FIX 1: CATEGORY CAROUSEL SCROLLING =============
  function fixCategoryCarousel() {
    console.log('🎠 Fixing category carousel...');
    
    // Wait for categories to load
    setTimeout(() => {
      const wrapper = document.getElementById('categoriesWrapper');
      if (!wrapper) {
        console.log('⚠️ Categories wrapper not found');
        return;
      }
      
      // Enable smooth scrolling
      wrapper.style.overflowX = 'auto';
      wrapper.style.scrollBehavior = 'smooth';
      wrapper.style.WebkitOverflowScrolling = 'touch'; // iOS smooth scrolling
      
      // Add touch event handlers for better mobile scrolling
      let isDown = false;
      let startX;
      let scrollLeft;
      
      wrapper.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - wrapper.offsetLeft;
        scrollLeft = wrapper.scrollLeft;
      });
      
      wrapper.addEventListener('touchend', () => {
        isDown = false;
      });
      
      wrapper.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - wrapper.offsetLeft;
        const walk = (x - startX) * 2;
        wrapper.scrollLeft = scrollLeft - walk;
      });
      
      console.log('✅ Category carousel scrolling enabled');
    }, 1000);
  }
  
  // ============= FIX 2: LOGIN FORM ISSUES =============
  function fixLoginForms() {
    console.log('🔐 Fixing login forms...');
    
    // Wait for forms to be in DOM
    setTimeout(() => {
      const loginForm = document.getElementById('loginForm');
      const signupForm = document.getElementById('signupForm');
      
      if (loginForm) {
        console.log('✅ Login form found');
        
        // Ensure form doesn't have conflicting handlers
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);
        
        // Add proper submit handler
        newLoginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('🔐 Login form submitted');
          
          const formData = new FormData(newLoginForm);
          const data = {
            username: formData.get('username'),
            password: formData.get('password')
          };
          
          console.log('Login data:', { username: data.username, password: '***' });
          
          // Show loading
          const submitBtn = newLoginForm.querySelector('button[type="submit"]');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'Logging in...';
          submitBtn.disabled = true;
          
          try {
            // Use the global apiFetch if available
            const apiFetch = window.apiFetch || fetch;
            const API_BASE = window.API_BASE || '';
            
            const response = await fetch(`${API_BASE}/api/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok && result.token) {
              console.log('✅ Login successful:', result);
              console.log('User role:', result.isAdmin ? 'Admin' : 'Regular User');
              
              // Save to localStorage with proper boolean handling
              localStorage.setItem('token', result.token);
              localStorage.setItem('username', result.username);
              localStorage.setItem('isAdmin', result.isAdmin ? 'true' : 'false');
              
              console.log('Stored in localStorage:');
              console.log('- token:', localStorage.getItem('token') ? 'Present' : 'Missing');
              console.log('- username:', localStorage.getItem('username'));
              console.log('- isAdmin:', localStorage.getItem('isAdmin'));
              
              // Close modal
              document.getElementById('authModal')?.classList.add('hidden');
              
              // Show success message
              alert(`Login successful! Welcome ${result.username}${result.isAdmin ? ' (Admin)' : ''}`);
              
              // Reload page to update UI
              window.location.reload();
            } else {
              console.error('❌ Login failed:', result);
              alert(result.error || 'Login failed. Please try again.');
              submitBtn.textContent = originalText;
              submitBtn.disabled = false;
            }
          } catch (error) {
            console.error('❌ Login error:', error);
            alert('Network error. Please check your connection.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        });
        
        console.log('✅ Login form handler attached');
      } else {
        console.log('⚠️ Login form not found');
      }
      
      if (signupForm) {
        console.log('✅ Signup form found');
        
        // Similar fix for signup
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);
        
        newSignupForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('📝 Signup form submitted');
          
          const formData = new FormData(newSignupForm);
          const data = {
            username: formData.get('username'),
            password: formData.get('password')
          };
          
          const submitBtn = newSignupForm.querySelector('button[type="submit"]');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'Signing up...';
          submitBtn.disabled = true;
          
          try {
            const API_BASE = window.API_BASE || '';
            
            const response = await fetch(`${API_BASE}/api/signup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              console.log('✅ Signup successful');
              alert('Signup successful! You can now login.');
              
              // Switch to login tab
              const loginTab = document.querySelector('[data-tab="login"]');
              if (loginTab) loginTab.click();
              
              // Clear form
              newSignupForm.reset();
            } else {
              console.error('❌ Signup failed:', result);
              alert(result.error || 'Signup failed. Please try again.');
            }
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          } catch (error) {
            console.error('❌ Signup error:', error);
            alert('Network error. Please check your connection.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        });
        
        console.log('✅ Signup form handler attached');
      } else {
        console.log('⚠️ Signup form not found');
      }
    }, 500);
  }
  
  // ============= FIX 3: QR CODE GENERATION =============
  function enhanceQRCodeGeneration() {
    console.log('📱 Enhancing QR code generation...');
    
    // Override the global generateQRCode function if it exists
    if (window.generateQRCode) {
      const originalGenerateQRCode = window.generateQRCode;
      
      window.generateQRCode = async function(bookId) {
        console.log('📱 Generating QR code for book:', bookId);
        
        try {
          const API_BASE = window.API_BASE || '';
          console.log('API Base:', API_BASE);
          console.log('Full URL:', `${API_BASE}/api/books/${bookId}/qrcode`);
          
          const response = await fetch(`${API_BASE}/api/books/${bookId}/qrcode`);
          
          console.log('QR Response status:', response.status);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log('QR data received:', data);
          
          const loading = document.getElementById('qrCodeLoading');
          const display = document.getElementById('qrCodeDisplay');
          const error = document.getElementById('qrCodeError');
          
          if (loading) loading.classList.add('hidden');
          if (display) display.classList.remove('hidden');
          if (error) error.classList.add('hidden');
          
          // Set QR code image
          const qrImage = document.getElementById('qrCodeImage');
          if (qrImage && data.qrCode) {
            qrImage.src = data.qrCode;
            console.log('✅ QR code image set');
          }
          
          // Set book details
          const titleEl = document.getElementById('qrBookTitle');
          const authorEl = document.getElementById('qrBookAuthor');
          
          if (titleEl && data.bookData) {
            titleEl.textContent = data.bookData.title;
          }
          if (authorEl && data.bookData) {
            authorEl.textContent = `by ${data.bookData.author}`;
          }
          
          console.log('✅ QR code generated successfully');
          
        } catch (err) {
          console.error('❌ QR code generation error:', err);
          console.error('Error details:', err.message);
          
          const loading = document.getElementById('qrCodeLoading');
          const display = document.getElementById('qrCodeDisplay');
          const error = document.getElementById('qrCodeError');
          
          if (loading) loading.classList.add('hidden');
          if (display) display.classList.add('hidden');
          if (error) {
            error.classList.remove('hidden');
            error.textContent = `Error: ${err.message}`;
          }
          
          alert(`QR Code Error: ${err.message}\nPlease try again or check console for details.`);
        }
      };
      
      console.log('✅ QR code generation enhanced');
    }
  }
  
  // ============= FIX 4: DATABASE CONNECTION LOGGING =============
  function addDatabaseLogging() {
    console.log('💾 Adding database logging...');
    
    // Log all fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [url, options] = args;
      console.log('🌐 Fetch request:', url, options?.method || 'GET');
      
      return originalFetch.apply(this, args)
        .then(response => {
          console.log('✅ Fetch response:', url, response.status);
          return response;
        })
        .catch(error => {
          console.error('❌ Fetch error:', url, error);
          throw error;
        });
    };
    
    console.log('✅ Database logging enabled');
  }
  
  // ============= FIX 5: MY BOOKS / BORROWED BOOKS =============
  function fixMyBooksSection() {
    console.log('📚 Fixing My Books section...');
    
    // Enhance the showMyBooks function if it exists
    if (window.showMyBooks) {
      const originalShowMyBooks = window.showMyBooks;
      
      window.showMyBooks = async function() {
        console.log('📚 Opening My Books section...');
        
        try {
          // Call original function
          originalShowMyBooks();
          
          // Add extra logging
          const token = localStorage.getItem('token');
          const username = localStorage.getItem('username');
          
          console.log('User info:', { username, hasToken: !!token });
          
          if (!token) {
            console.error('❌ No token found - user not logged in');
            alert('Please login to view your borrowed books');
            return;
          }
          
          // Wait a bit for API call
          setTimeout(() => {
            const myBooksSection = document.getElementById('my-books-section');
            const borrowedBooksContainer = document.getElementById('borrowed-books-container');
            
            if (myBooksSection && myBooksSection.style.display !== 'none') {
              console.log('✅ My Books section is visible');
              
              if (borrowedBooksContainer) {
                const bookCount = borrowedBooksContainer.children.length;
                console.log(`📚 Showing ${bookCount} borrowed books`);
                
                if (bookCount === 0) {
                  console.log('ℹ️ No borrowed books found');
                  borrowedBooksContainer.innerHTML = `
                    <div style="text-align:center; padding:3rem; color:#666;">
                      <div style="font-size:4rem; margin-bottom:1rem;">📚</div>
                      <h3 style="font-size:1.5rem; margin-bottom:0.5rem;">No Borrowed Books</h3>
                      <p>You haven't borrowed any books yet.</p>
                      <button onclick="showMainBooks()" style="margin-top:1rem; padding:0.5rem 1rem; background:#4A90E2; color:white; border:none; border-radius:0.25rem; cursor:pointer;">
                        Browse Books
                      </button>
                    </div>
                  `;
                }
              }
            } else {
              console.log('⚠️ My Books section not visible');
            }
          }, 1000);
          
        } catch (error) {
          console.error('❌ Error in showMyBooks:', error);
          alert('Error loading borrowed books. Please try again.');
        }
      };
      
      console.log('✅ My Books function enhanced');
    } else {
      console.log('⚠️ showMyBooks function not found - will be available after page load');
    }
    
    // Try again after page load
    setTimeout(() => {
      if (window.showMyBooks && !window.showMyBooks.enhanced) {
        window.showMyBooks.enhanced = true;
        fixMyBooksSection();
      }
    }, 2000);
  }
  
})();
