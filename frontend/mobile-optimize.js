/**
 * Mobile & Performance Optimizations
 * Handles device detection, lazy loading, and responsive behavior
 */

(function() {
  'use strict';

  // ===== DEVICE DETECTION =====
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(navigator.userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Add device classes to body
  document.body.classList.add(
    isMobile ? 'is-mobile' : 'is-desktop',
    isTablet ? 'is-tablet' : '',
    isTouchDevice ? 'is-touch' : 'is-mouse'
  );

  // ===== LAZY LOADING IMAGES =====
  const lazyLoadImages = () => {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src || img.src;
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for older browsers
      images.forEach(img => {
        img.src = img.dataset.src || img.src;
        img.classList.add('loaded');
      });
    }
  };

  // ===== RESPONSIVE TABLE HANDLING =====
  const makeTablesResponsive = () => {
    const tables = document.querySelectorAll('table:not(.responsive-table)');
    tables.forEach(table => {
      if (table.parentElement && !table.parentElement.classList.contains('overflow-x-auto')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'overflow-x-auto smooth-scroll';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
      table.classList.add('responsive-table');
    });
  };

  // ===== SMOOTH SCROLL FOR ANCHORS =====
  const enableSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          
          // Update URL without scrolling
          history.pushState(null, null, href);
        }
      });
    });
  };

  // ===== VIEWPORT HEIGHT FIX (Mobile Safari) =====
  const fixViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  window.addEventListener('resize', fixViewportHeight);
  fixViewportHeight();

  // ===== DEBOUNCE UTILITY =====
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // ===== OPTIMIZE RESIZE EVENTS =====
  let resizeTimer;
  window.addEventListener('resize', debounce(() => {
    document.body.classList.add('resize-animation-stopper');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.body.classList.remove('resize-animation-stopper');
    }, 400);
  }, 100));

  // ===== PREVENT iOS ZOOM ON DOUBLE TAP =====
  if (isMobile || isTablet) {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }

  // ===== OPTIMIZE IMAGES ON MOBILE =====
  const optimizeImages = () => {
    if (isMobile) {
      document.querySelectorAll('img').forEach(img => {
        // Skip if already optimized
        if (img.dataset.optimized) return;
        
        // Add loading="lazy" if not present
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }
        
        // Add error handler
        img.onerror = function() {
          this.src = '/uploads/default.jpg';
          this.classList.add('error-image');
        };
        
        img.dataset.optimized = 'true';
      });
    }
  };

  // ===== REDUCE ANIMATIONS ON LOW-END DEVICES =====
  const reduceAnimations = () => {
    if (isMobile && navigator.hardwareConcurrency <= 4) {
      document.body.classList.add('reduce-animations');
    }
  };

  // ===== PREVENT SCROLL BOUNCE ON iOS =====
  const preventScrollBounce = () => {
    document.body.addEventListener('touchmove', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      const scrollable = e.target.closest('.overflow-auto, .overflow-y-auto, .overflow-x-auto');
      if (!scrollable) {
        e.preventDefault();
      }
    }, { passive: false });
  };

  // ===== FIX INPUT ZOOM ON iOS =====
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        const fontSize = window.getComputedStyle(input).fontSize;
        if (parseFloat(fontSize) < 16) {
          input.style.fontSize = '16px';
        }
      });
    });
  }

  // ===== PERFORMANCE MONITORING =====
  const monitorPerformance = () => {
    if ('performance' in window && 'PerformanceObserver' in window) {
      try {
        // Monitor Long Tasks
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn('Long task detected:', entry.duration.toFixed(2) + 'ms');
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // PerformanceObserver not fully supported
      }
    }
  };

  // ===== CACHE API RESPONSES =====
  const cacheAPIResponses = () => {
    const cache = new Map();
    const MAX_CACHE_SIZE = 50;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    window.apiCache = {
      get: (key) => {
        const item = cache.get(key);
        if (item && Date.now() - item.timestamp < CACHE_DURATION) {
          return item.data;
        }
        cache.delete(key);
        return null;
      },
      set: (key, data) => {
        if (cache.size >= MAX_CACHE_SIZE) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(key, { data, timestamp: Date.now() });
      },
      clear: () => cache.clear()
    };
  };

  // ===== OFFLINE DETECTION =====
  const handleOffline = () => {
    window.addEventListener('offline', () => {
      const offlineBanner = document.createElement('div');
      offlineBanner.id = 'offline-banner';
      offlineBanner.className = 'fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-50';
      offlineBanner.textContent = '⚠️ No internet connection';
      document.body.prepend(offlineBanner);
    });

    window.addEventListener('online', () => {
      const banner = document.getElementById('offline-banner');
      if (banner) {
        banner.className += ' bg-green-500';
        banner.textContent = '✅ Back online';
        setTimeout(() => banner.remove(), 2000);
      }
    });
  };

  // ===== INIT ON DOM READY =====
  const init = () => {
    lazyLoadImages();
    makeTablesResponsive();
    enableSmoothScroll();
    optimizeImages();
    reduceAnimations();
    cacheAPIResponses();
    handleOffline();
    
    if (isMobile) {
      preventScrollBounce();
    }
    
    // Monitor performance in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      monitorPerformance();
    }
    
    // Re-run optimizations on dynamic content changes
    const contentObserver = new MutationObserver(debounce(() => {
      lazyLoadImages();
      optimizeImages();
      makeTablesResponsive();
    }, 500));
    
    contentObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ===== EXPORT UTILITIES =====
  window.mobileUtils = {
    isMobile,
    isTablet,
    isTouchDevice,
    debounce,
    lazyLoadImages,
    optimizeImages
  };

})();
