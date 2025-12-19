/* =================================================================
   AUTO HTTPS REDIRECT FOR MOBILE DEVICES
   Ensures camera access works everywhere in the library system
   ================================================================= */

(function() {
  'use strict';
  
  // Detect if device is mobile
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
  }
  
  // Check if we're on HTTP
  const isHTTP = window.location.protocol === 'http:';
  const isMobile = isMobileDevice();
  
  // Only redirect mobile devices from HTTP to HTTPS
  if (isHTTP && isMobile) {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    
    // Determine if localhost or network access
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // Build HTTPS URL
    // Build HTTPS URL using current hostname so it always matches network IP
    const httpsHost = isLocalhost ? 'localhost' : hostname;
    const httpsURL = `https://${httpsHost}:5443${pathname}${search}${hash}`;
    
    // Log the redirect for debugging
    console.log('📱 Mobile device detected on HTTP');
    console.log('⚡ Auto-redirecting to HTTPS for camera access...');
    console.log(`🔒 New URL: ${httpsURL}`);
    
    // Perform the redirect
    window.location.replace(httpsURL);
  } else if (isHTTP && !isMobile) {
    // Desktop on HTTP - show helpful console message
    console.log('💻 Desktop detected - HTTP is OK for camera access');
    console.log('💡 For best security, you can also access via HTTPS:');
    console.log(`   https://${window.location.hostname}:5443${window.location.pathname}`);
  } else if (!isHTTP) {
    // Already on HTTPS
    console.log('🔒 HTTPS connection - Camera access enabled');
    console.log('✅ All features including QR scanning are available');
  }
  
})();
