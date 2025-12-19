/* =================================================================
   LIBRARY SYSTEM - PERFORMANCE & ERROR HANDLING
   Version: 3.3 - Bug-free & Optimized
   ================================================================= */

// ============= GLOBAL ERROR HANDLING =============

window.addEventListener('error', function(event) {
  // Only log to console, don't show annoying notifications
  console.error('Global error:', event.error);
  // Only show notification for critical errors
  if (event.error && event.error.message && event.error.message.includes('critical')) {
    showErrorNotification('An error occurred. Please refresh the page.');
  }
  return false;
});

window.addEventListener('unhandledrejection', function(event) {
  // Only log to console
  console.error('Unhandled promise rejection:', event.reason);
  // Don't show notification for every promise rejection
  return false;
});

// ============= PERFORMANCE MONITORING =============

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: 0,
      apiCalls: [],
      renderTime: 0
    };
    this.init();
  }

  init() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData) {
        this.metrics.pageLoad = perfData.loadEventEnd - perfData.fetchStart;
        console.log(`Page loaded in ${this.metrics.pageLoad}ms`);
      }
    });
  }

  trackAPICall(url, duration) {
    this.metrics.apiCalls.push({ url, duration, timestamp: Date.now() });
    if (duration > 3000) {
      console.warn(`Slow API call detected: ${url} took ${duration}ms`);
    }
  }

  getMetrics() {
    return this.metrics;
  }
}

const perfMonitor = new PerformanceMonitor();

// ============= NETWORK STATUS MONITORING =============

class NetworkMonitor {
  constructor() {
    this.online = navigator.onLine;
    this.init();
  }

  init() {
    window.addEventListener('online', () => {
      this.online = true;
      this.hideOfflineIndicator();
      console.log('Network: Online');
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.showOfflineIndicator();
      console.log('Network: Offline');
    });
  }

  showOfflineIndicator() {
    let indicator = document.getElementById('offline-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.className = 'offline-indicator';
      indicator.innerHTML = '⚠️ No internet connection. Some features may not work.';
      document.body.appendChild(indicator);
    }
    indicator.classList.add('show');
  }

  hideOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.classList.remove('show');
    }
  }

  isOnline() {
    return this.online;
  }
}

const networkMonitor = new NetworkMonitor();

// ============= ENHANCED FETCH WITH ERROR HANDLING =============

async function safeFetch(url, options = {}) {
  const startTime = performance.now();

  try {
    // Check network status
    if (!networkMonitor.isOnline()) {
      throw new Error('No internet connection');
    }

    // Add timeout
    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    options.signal = controller.signal;

    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    const duration = performance.now() - startTime;
    perfMonitor.trackAPICall(url, duration);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;

  } catch (error) {
    const duration = performance.now() - startTime;
    perfMonitor.trackAPICall(url, duration);

    if (error.name === 'AbortError') {
      console.error('Request timeout:', url);
      showErrorNotification('Request timed out. Please try again.');
    } else {
      console.error('Fetch error:', error);
      showErrorNotification('Network error: ' + error.message);
    }

    throw error;
  }
}

// ============= IMAGE LAZY LOADING =============

class ImageLazyLoader {
  constructor() {
    this.images = [];
    this.observer = null;
    this.init();
  }

  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
          }
        });
      }, {
        rootMargin: '50px'
      });

      this.observeImages();
    } else {
      // Fallback: load all images immediately
      this.loadAllImages();
    }
  }

  observeImages() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    lazyImages.forEach(img => {
      this.observer.observe(img);
      this.images.push(img);
    });
  }

  loadImage(img) {
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.classList.add('loaded');
      this.observer.unobserve(img);
    }
  }

  loadAllImages() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    lazyImages.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.classList.add('loaded');
      }
    });
  }

  refresh() {
    if (this.observer) {
      this.observeImages();
    }
  }
}

const imageLazyLoader = new ImageLazyLoader();

// ============= DEBOUNCE UTILITY =============

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============= THROTTLE UTILITY =============

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============= CACHE MANAGER =============

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100;
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const age = Date.now() - item.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  has(key) {
    return this.cache.has(key) && this.get(key) !== null;
  }
}

const cacheManager = new CacheManager();

// ============= NOTIFICATION SYSTEM =============

function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, duration);
}

function showErrorNotification(message) {
  showNotification(message, 'error', 5000);
}

function showSuccessNotification(message) {
  showNotification(message, 'success', 3000);
}

// ============= FORM VALIDATION =============

function validateForm(form) {
  const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
  let isValid = true;

  inputs.forEach(input => {
    if (!input.value.trim()) {
      isValid = false;
      input.classList.add('error');
      input.addEventListener('input', function() {
        this.classList.remove('error');
      }, { once: true });
    }
  });

  if (!isValid) {
    showErrorNotification('Please fill in all required fields');
  }

  return isValid;
}

// ============= LOCAL STORAGE MANAGER =============

class StorageManager {
  constructor(prefix = 'lib_') {
    this.prefix = prefix;
  }

  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return false;
    }
  }

  get(key) {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return null;
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return false;
    }
  }

  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return false;
    }
  }
}

const storageManager = new StorageManager();

// ============= RESPONSIVE UTILITIES =============

function isMobile() {
  return window.innerWidth <= 768;
}

function isTablet() {
  return window.innerWidth > 768 && window.innerWidth <= 1024;
}

function isDesktop() {
  return window.innerWidth > 1024;
}

// ============= SCROLL UTILITIES =============

function smoothScrollTo(element, offset = 0) {
  const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });
}

// ============= ANIMATION UTILITIES =============

function fadeIn(element, duration = 300) {
  element.style.opacity = 0;
  element.style.display = 'block';

  let start = null;
  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    element.style.opacity = Math.min(progress / duration, 1);

    if (progress < duration) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function fadeOut(element, duration = 300) {
  let start = null;
  const initialOpacity = parseFloat(window.getComputedStyle(element).opacity) || 1;

  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    element.style.opacity = Math.max(initialOpacity - (progress / duration), 0);

    if (progress < duration) {
      requestAnimationFrame(animate);
    } else {
      element.style.display = 'none';
    }
  }

  requestAnimationFrame(animate);
}

// ============= KEYBOARD SHORTCUTS =============

class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => {
      const key = this.getKeyCombo(e);
      const callback = this.shortcuts.get(key);
      if (callback) {
        e.preventDefault();
        callback(e);
      }
    });
  }

  getKeyCombo(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  register(combo, callback) {
    this.shortcuts.set(combo.toLowerCase(), callback);
  }

  unregister(combo) {
    this.shortcuts.delete(combo.toLowerCase());
  }
}

const keyboardShortcuts = new KeyboardShortcuts();

// ============= EXPORT UTILITIES =============

window.LibraryUtils = {
  perfMonitor,
  networkMonitor,
  safeFetch,
  imageLazyLoader,
  debounce,
  throttle,
  cacheManager,
  showNotification,
  showErrorNotification,
  showSuccessNotification,
  validateForm,
  storageManager,
  isMobile,
  isTablet,
  isDesktop,
  smoothScrollTo,
  fadeIn,
  fadeOut,
  keyboardShortcuts
};

// ============= INITIALIZATION =============

document.addEventListener('DOMContentLoaded', () => {
  console.log('Library System Performance Module Loaded');
  console.log('Device type:', isMobile() ? 'Mobile' : isTablet() ? 'Tablet' : 'Desktop');
  console.log('Network status:', networkMonitor.isOnline() ? 'Online' : 'Offline');
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  input.error,
  select.error,
  textarea.error {
    border-color: #ff4444 !important;
    background-color: #fff5f5 !important;
  }
`;
document.head.appendChild(style);
